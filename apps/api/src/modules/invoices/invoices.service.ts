import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { InvoiceNumberService } from './invoice-number.service';
import {
  InvoiceDto,
  CreateInvoiceDto,
  UpdateInvoiceDto,
  InvoiceStatus,
  ChargeType,
  LedgerAccountType,
  LedgerEntryType,
  InvoiceSummaryDto,
} from '@propertyos/types';
import { InvoiceFilterInput } from '@propertyos/validation';
import { Prisma } from '@prisma/client';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
    private readonly invoiceNumberService: InvoiceNumberService
  ) {}

  /**
   * Helper: map ChargeType to corresponding revenue LedgerAccountType
   */
  private getRevenueAccountForChargeType(chargeType: ChargeType): LedgerAccountType {
    switch (chargeType) {
      case ChargeType.RENT:
        return LedgerAccountType.RENT_REVENUE;
      case ChargeType.MAINTENANCE:
        return LedgerAccountType.MAINTENANCE_REVENUE;
      case ChargeType.UTILITY:
        return LedgerAccountType.UTILITY_REVENUE;
      case ChargeType.SECURITY_DEPOSIT:
        return LedgerAccountType.SECURITY_DEPOSIT_LIABILITY;
      default:
        return LedgerAccountType.RENT_REVENUE;
    }
  }

  /**
   * Creates a new Invoice in DRAFT status with line items
   */
  async createInvoice(
    organizationId: string,
    dto: CreateInvoiceDto,
    userId?: string
  ): Promise<InvoiceDto> {
    // Validate tenant exists in organization
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: dto.tenantId, organizationId },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${dto.tenantId} not found`);
    }

    if (dto.propertyId) {
      const property = await this.prisma.property.findFirst({
        where: { id: dto.propertyId, organizationId },
      });
      if (!property) {
        throw new NotFoundException(`Property ${dto.propertyId} not found`);
      }
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const invoiceNumber = await this.invoiceNumberService.generateInvoiceNumber(
        organizationId,
        tx
      );

      let subtotal = new Prisma.Decimal(0);
      const linesData: {
        chargeId?: string | null;
        description: string;
        chargeType: ChargeType;
        quantity: Prisma.Decimal;
        unitAmount: Prisma.Decimal;
        totalAmount: Prisma.Decimal;
      }[] = [];

      for (const line of dto.lines) {
        const qty = new Prisma.Decimal(line.quantity || 1);
        const unitAmt = new Prisma.Decimal(line.unitAmount || 0);

        if (qty.isNegative() || qty.isZero()) {
          throw new BadRequestException('Line item quantity must be strictly positive');
        }
        if (unitAmt.isNegative()) {
          throw new BadRequestException('Line item unit amount cannot be negative');
        }

        const lineTotal = qty.mul(unitAmt);
        subtotal = subtotal.plus(lineTotal);

        linesData.push({
          chargeId: line.chargeId || null,
          description: line.description,
          chargeType: line.chargeType,
          quantity: qty,
          unitAmount: unitAmt,
          totalAmount: lineTotal,
        });
      }

      const adjustments = new Prisma.Decimal(dto.adjustments || 0);
      let totalAmount = subtotal.plus(adjustments);
      if (totalAmount.isNegative()) {
        totalAmount = new Prisma.Decimal(0);
      }

      const invoice = await tx.invoice.create({
        data: {
          organizationId,
          tenantId: dto.tenantId,
          propertyId: dto.propertyId || null,
          leaseId: dto.leaseId || null,
          checkInId: dto.checkInId || null,
          invoiceNumber,
          issueDate: new Date(dto.issueDate),
          dueDate: new Date(dto.dueDate),
          subtotal,
          adjustments,
          totalAmount,
          paidAmount: new Prisma.Decimal(0),
          outstandingAmount: totalAmount,
          status: InvoiceStatus.DRAFT,
          notes: dto.notes || null,
          lines: {
            create: linesData,
          },
        },
        include: {
          lines: true,
          tenant: true,
          property: true,
        },
      });

      // Create Audit Log
      await tx.auditLog.create({
        data: {
          organizationId,
          userId: userId || null,
          action: 'INVOICE_CREATED',
          resourceType: 'Invoice',
          resourceId: invoice.id,
          metadata: {
            invoiceNumber: invoice.invoiceNumber,
            totalAmount: invoice.totalAmount.toString(),
            tenantId: invoice.tenantId,
          },
        },
      });

      return this.mapToDto(invoice);
    });
  }

  /**
   * Retrieves an invoice by ID
   */
  async getInvoice(organizationId: string, id: string): Promise<InvoiceDto> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, organizationId },
      include: {
        lines: true,
        allocations: {
          include: {
            payment: true,
          },
        },
        tenant: true,
        property: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }

    return this.mapToDto(invoice);
  }

  /**
   * Lists invoices with filtering
   */
  async listInvoices(
    organizationId: string,
    filters?: InvoiceFilterInput
  ): Promise<InvoiceDto[]> {
    const where: Prisma.InvoiceWhereInput = {
      organizationId,
    };

    if (filters?.tenantId) where.tenantId = filters.tenantId;
    if (filters?.propertyId) where.propertyId = filters.propertyId;
    if (filters?.status) where.status = filters.status;

    if (filters?.fromDate || filters?.toDate) {
      where.issueDate = {};
      if (filters.fromDate) where.issueDate.gte = new Date(filters.fromDate);
      if (filters.toDate) where.issueDate.lte = new Date(filters.toDate);
    }

    if (filters?.search) {
      where.OR = [
        { invoiceNumber: { contains: filters.search, mode: 'insensitive' } },
        { tenant: { firstName: { contains: filters.search, mode: 'insensitive' } } },
        { tenant: { lastName: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    const invoices = await this.prisma.invoice.findMany({
      where,
      include: {
        lines: true,
        allocations: true,
        tenant: true,
        property: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return invoices.map(this.mapToDto);
  }

  /**
   * Updates a DRAFT invoice
   */
  async updateDraftInvoice(
    organizationId: string,
    id: string,
    dto: UpdateInvoiceDto,
    userId?: string
  ): Promise<InvoiceDto> {
    const existing = await this.prisma.invoice.findFirst({
      where: { id, organizationId },
      include: { lines: true },
    });

    if (!existing) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }

    if (existing.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException(`Cannot edit invoice with status ${existing.status}. Only DRAFT invoices can be edited.`);
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      let subtotal = existing.subtotal;
      let adjustments = dto.adjustments !== undefined ? new Prisma.Decimal(dto.adjustments) : existing.adjustments;

      if (dto.lines && dto.lines.length > 0) {
        // Delete old lines
        await tx.invoiceLine.deleteMany({
          where: { invoiceId: id },
        });

        subtotal = new Prisma.Decimal(0);
        const linesData: {
          invoiceId: string;
          chargeId?: string | null;
          description: string;
          chargeType: ChargeType;
          quantity: Prisma.Decimal;
          unitAmount: Prisma.Decimal;
          totalAmount: Prisma.Decimal;
        }[] = [];

        for (const line of dto.lines) {
          const qty = new Prisma.Decimal(line.quantity || 1);
          const unitAmt = new Prisma.Decimal(line.unitAmount || 0);

          if (qty.isNegative() || qty.isZero()) {
            throw new BadRequestException('Line item quantity must be strictly positive');
          }
          if (unitAmt.isNegative()) {
            throw new BadRequestException('Line item unit amount cannot be negative');
          }

          const lineTotal = qty.mul(unitAmt);
          subtotal = subtotal.plus(lineTotal);

          linesData.push({
            invoiceId: id,
            chargeId: line.chargeId || null,
            description: line.description,
            chargeType: line.chargeType,
            quantity: qty,
            unitAmount: unitAmt,
            totalAmount: lineTotal,
          });
        }

        await tx.invoiceLine.createMany({
          data: linesData,
        });
      }

      let totalAmount = subtotal.plus(adjustments);
      if (totalAmount.isNegative()) {
        totalAmount = new Prisma.Decimal(0);
      }

      const updated = await tx.invoice.update({
        where: { id },
        data: {
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          adjustments,
          subtotal,
          totalAmount,
          outstandingAmount: totalAmount.minus(existing.paidAmount),
          notes: dto.notes !== undefined ? dto.notes : undefined,
        },
        include: {
          lines: true,
          tenant: true,
          property: true,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          userId: userId || null,
          action: 'INVOICE_UPDATED',
          resourceType: 'Invoice',
          resourceId: id,
          metadata: {
            totalAmount: updated.totalAmount.toString(),
          },
        },
      });

      return this.mapToDto(updated);
    });
  }

  /**
   * Issues an invoice (DRAFT -> ISSUED) and generates double-entry ledger entries atomically
   */
  async issueInvoice(
    organizationId: string,
    id: string,
    userId?: string
  ): Promise<InvoiceDto> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, organizationId },
      include: { lines: true, tenant: true, property: true },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }

    if (invoice.status !== InvoiceStatus.DRAFT) {
      // Idempotency: if already ISSUED, return cleanly
      if (invoice.status === InvoiceStatus.ISSUED || invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.PARTIALLY_PAID) {
        return this.mapToDto(invoice);
      }
      throw new BadRequestException(`Cannot issue invoice with status ${invoice.status}`);
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.invoice.update({
        where: { id },
        data: {
          status: InvoiceStatus.ISSUED,
        },
        include: {
          lines: true,
          tenant: true,
          property: true,
        },
      });

      // Generate double-entry ledger entries:
      // Debit: TENANT_RECEIVABLE for invoice totalAmount
      // Credit: respective revenue accounts for line totals
      const ledgerEntries: {
        tenantId: string;
        invoiceId: string;
        entryType: LedgerEntryType;
        accountType: LedgerAccountType;
        debitAmount: Prisma.Decimal;
        creditAmount: Prisma.Decimal;
        reference: string;
        description: string;
      }[] = [];

      // Debit side: Total receivable
      ledgerEntries.push({
        tenantId: invoice.tenantId,
        invoiceId: invoice.id,
        entryType: LedgerEntryType.INVOICE,
        accountType: LedgerAccountType.TENANT_RECEIVABLE,
        debitAmount: invoice.totalAmount,
        creditAmount: new Prisma.Decimal(0),
        reference: invoice.invoiceNumber,
        description: `Invoice ${invoice.invoiceNumber} receivable`,
      });

      // Credit side: Sum per charge type
      // Group lines by revenue account
      const revenueGroup = new Map<LedgerAccountType, Prisma.Decimal>();
      for (const line of invoice.lines) {
        const account = this.getRevenueAccountForChargeType(line.chargeType as unknown as ChargeType);
        const current = revenueGroup.get(account) || new Prisma.Decimal(0);
        revenueGroup.set(account, current.plus(line.totalAmount));
      }

      // If adjustments exist, credit/debit adjustment account or adjust rent revenue
      if (invoice.adjustments && !invoice.adjustments.isZero()) {
        const adjAccount = LedgerAccountType.ADJUSTMENT;
        const current = revenueGroup.get(adjAccount) || new Prisma.Decimal(0);
        revenueGroup.set(adjAccount, current.plus(invoice.adjustments));
      }

      for (const [account, amount] of revenueGroup.entries()) {
        if (amount.isPositive()) {
          ledgerEntries.push({
            tenantId: invoice.tenantId,
            invoiceId: invoice.id,
            entryType: LedgerEntryType.INVOICE,
            accountType: account,
            debitAmount: new Prisma.Decimal(0),
            creditAmount: amount,
            reference: invoice.invoiceNumber,
            description: `Revenue recognized for Invoice ${invoice.invoiceNumber}`,
          });
        } else if (amount.isNegative()) {
          // Negative revenue (discount) represented as debit to revenue
          ledgerEntries.push({
            tenantId: invoice.tenantId,
            invoiceId: invoice.id,
            entryType: LedgerEntryType.INVOICE,
            accountType: account,
            debitAmount: amount.abs(),
            creditAmount: new Prisma.Decimal(0),
            reference: invoice.invoiceNumber,
            description: `Discount/adjustment on Invoice ${invoice.invoiceNumber}`,
          });
        }
      }

      await this.ledgerService.recordTransaction(organizationId, ledgerEntries, tx);

      await tx.auditLog.create({
        data: {
          organizationId,
          userId: userId || null,
          action: 'INVOICE_ISSUED',
          resourceType: 'Invoice',
          resourceId: id,
          metadata: {
            invoiceNumber: invoice.invoiceNumber,
            status: InvoiceStatus.ISSUED,
          },
        },
      });

      return this.mapToDto(updated);
    });
  }

  /**
   * Voids an invoice (DRAFT | ISSUED -> VOID)
   */
  async voidInvoice(
    organizationId: string,
    id: string,
    userId?: string
  ): Promise<InvoiceDto> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, organizationId },
      include: { lines: true, allocations: true, tenant: true, property: true },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }

    if (invoice.status === InvoiceStatus.VOID) {
      return this.mapToDto(invoice);
    }

    if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.PARTIALLY_PAID) {
      throw new BadRequestException(
        `Cannot void invoice with status ${invoice.status}. Existing payment allocations must be reversed first.`
      );
    }

    if (invoice.status !== InvoiceStatus.DRAFT && invoice.status !== InvoiceStatus.ISSUED && invoice.status !== InvoiceStatus.OVERDUE) {
      throw new BadRequestException(`Cannot void invoice with status ${invoice.status}`);
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const wasIssued = invoice.status === InvoiceStatus.ISSUED || invoice.status === InvoiceStatus.OVERDUE;

      const updated = await tx.invoice.update({
        where: { id },
        data: {
          status: InvoiceStatus.VOID,
          outstandingAmount: new Prisma.Decimal(0),
        },
        include: {
          lines: true,
          tenant: true,
          property: true,
        },
      });

      // If the invoice was issued, record reversing ledger entries
      if (wasIssued) {
        const reversalEntries: {
          tenantId: string;
          invoiceId: string;
          entryType: LedgerEntryType;
          accountType: LedgerAccountType;
          debitAmount: Prisma.Decimal;
          creditAmount: Prisma.Decimal;
          reference: string;
          description: string;
        }[] = [];

        // Reverse receivable (Credit TENANT_RECEIVABLE)
        reversalEntries.push({
          tenantId: invoice.tenantId,
          invoiceId: invoice.id,
          entryType: LedgerEntryType.REVERSAL,
          accountType: LedgerAccountType.TENANT_RECEIVABLE,
          debitAmount: new Prisma.Decimal(0),
          creditAmount: invoice.totalAmount,
          reference: invoice.invoiceNumber,
          description: `Void reversal for Invoice ${invoice.invoiceNumber}`,
        });

        // Reverse revenue (Debit respective revenue accounts)
        const revenueGroup = new Map<LedgerAccountType, Prisma.Decimal>();
        for (const line of invoice.lines) {
          const account = this.getRevenueAccountForChargeType(line.chargeType as unknown as ChargeType);
          const current = revenueGroup.get(account) || new Prisma.Decimal(0);
          revenueGroup.set(account, current.plus(line.totalAmount));
        }

        if (invoice.adjustments && !invoice.adjustments.isZero()) {
          const adjAccount = LedgerAccountType.ADJUSTMENT;
          const current = revenueGroup.get(adjAccount) || new Prisma.Decimal(0);
          revenueGroup.set(adjAccount, current.plus(invoice.adjustments));
        }

        for (const [account, amount] of revenueGroup.entries()) {
          if (amount.isPositive()) {
            reversalEntries.push({
              tenantId: invoice.tenantId,
              invoiceId: invoice.id,
              entryType: LedgerEntryType.REVERSAL,
              accountType: account,
              debitAmount: amount,
              creditAmount: new Prisma.Decimal(0),
              reference: invoice.invoiceNumber,
              description: `Void revenue reversal for Invoice ${invoice.invoiceNumber}`,
            });
          } else if (amount.isNegative()) {
            reversalEntries.push({
              tenantId: invoice.tenantId,
              invoiceId: invoice.id,
              entryType: LedgerEntryType.REVERSAL,
              accountType: account,
              debitAmount: new Prisma.Decimal(0),
              creditAmount: amount.abs(),
              reference: invoice.invoiceNumber,
              description: `Void discount reversal for Invoice ${invoice.invoiceNumber}`,
            });
          }
        }

        await this.ledgerService.recordTransaction(organizationId, reversalEntries, tx);
      }

      await tx.auditLog.create({
        data: {
          organizationId,
          userId: userId || null,
          action: 'INVOICE_VOIDED',
          resourceType: 'Invoice',
          resourceId: id,
          metadata: {
            invoiceNumber: invoice.invoiceNumber,
          },
        },
      });

      return this.mapToDto(updated);
    });
  }

  /**
   * Retrieves high-level invoice summary statistics
   */
  async getInvoiceSummary(organizationId: string): Promise<InvoiceSummaryDto> {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        status: {
          notIn: [InvoiceStatus.VOID, InvoiceStatus.CANCELLED],
        },
      },
      select: {
        totalAmount: true,
        paidAmount: true,
        outstandingAmount: true,
      },
    });

    let totalInvoiced = new Prisma.Decimal(0);
    let totalPaid = new Prisma.Decimal(0);
    let totalOutstanding = new Prisma.Decimal(0);

    for (const inv of invoices) {
      totalInvoiced = totalInvoiced.plus(inv.totalAmount);
      totalPaid = totalPaid.plus(inv.paidAmount);
      totalOutstanding = totalOutstanding.plus(inv.outstandingAmount);
    }

    return {
      totalInvoiced: totalInvoiced.toString(),
      totalPaid: totalPaid.toString(),
      totalOutstanding: totalOutstanding.toString(),
      count: invoices.length,
    };
  }

  private mapToDto(invoice: any): InvoiceDto {
    return {
      id: invoice.id,
      organizationId: invoice.organizationId,
      tenantId: invoice.tenantId,
      propertyId: invoice.propertyId,
      leaseId: invoice.leaseId,
      checkInId: invoice.checkInId,
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate.toISOString(),
      dueDate: invoice.dueDate.toISOString(),
      subtotal: invoice.subtotal.toString(),
      adjustments: invoice.adjustments.toString(),
      totalAmount: invoice.totalAmount.toString(),
      paidAmount: invoice.paidAmount.toString(),
      outstandingAmount: invoice.outstandingAmount.toString(),
      status: invoice.status as InvoiceStatus,
      notes: invoice.notes,
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
      lines: invoice.lines
        ? invoice.lines.map((l: any) => ({
            id: l.id,
            invoiceId: l.invoiceId,
            chargeId: l.chargeId,
            description: l.description,
            chargeType: l.chargeType as ChargeType,
            quantity: l.quantity.toString(),
            unitAmount: l.unitAmount.toString(),
            totalAmount: l.totalAmount.toString(),
            createdAt: l.createdAt.toISOString(),
          }))
        : undefined,
      allocations: invoice.allocations
        ? invoice.allocations.map((a: any) => ({
            id: a.id,
            paymentId: a.paymentId,
            invoiceId: a.invoiceId,
            amount: a.amount.toString(),
            status: a.status,
            createdAt: a.createdAt.toISOString(),
          }))
        : undefined,
      tenant: invoice.tenant
        ? {
            id: invoice.tenant.id,
            firstName: invoice.tenant.firstName,
            lastName: invoice.tenant.lastName,
            email: invoice.tenant.email,
            phone: invoice.tenant.phone,
          }
        : undefined,
      property: invoice.property
        ? {
            id: invoice.property.id,
            name: invoice.property.name,
            code: invoice.property.code,
          }
        : null,
    };
  }
}
