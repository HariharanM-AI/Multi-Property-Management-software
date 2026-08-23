import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import {
  PaymentDto,
  CreatePaymentDto,
  AllocatePaymentDto,
  PaymentStatus,
  PaymentMethod,
  PaymentAllocationStatus,
  InvoiceStatus,
  LedgerAccountType,
  LedgerEntryType,
} from '@propertyos/types';
import { PaymentFilterInput } from '@propertyos/validation';
import { Prisma } from '@prisma/client';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService
  ) {}

  private getPaymentAccountForMethod(method: PaymentMethod): LedgerAccountType {
    switch (method) {
      case PaymentMethod.CASH:
        return LedgerAccountType.CASH;
      case PaymentMethod.BANK_TRANSFER:
      case PaymentMethod.UPI:
      case PaymentMethod.CARD:
      case PaymentMethod.CHEQUE:
      default:
        return LedgerAccountType.BANK;
    }
  }

  /**
   * Records a payment received from a tenant (idempotent on referenceNumber)
   */
  async recordPayment(
    organizationId: string,
    dto: CreatePaymentDto,
    userId?: string
  ): Promise<PaymentDto> {
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.isNegative() || amount.isZero()) {
      throw new BadRequestException('Payment amount must be strictly greater than zero');
    }

    // Validate tenant
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: dto.tenantId, organizationId },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${dto.tenantId} not found`);
    }

    // Idempotency check: if referenceNumber is provided, check uniqueness per organization
    if (dto.referenceNumber) {
      const existing = await this.prisma.payment.findFirst({
        where: {
          organizationId,
          referenceNumber: dto.referenceNumber,
        },
        include: {
          allocations: true,
          tenant: true,
        },
      });

      if (existing) {
        throw new ConflictException(
          `Payment with reference number '${dto.referenceNumber}' already exists`
        );
      }
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const payment = await tx.payment.create({
        data: {
          organizationId,
          tenantId: dto.tenantId,
          amount,
          paymentMethod: dto.paymentMethod,
          referenceNumber: dto.referenceNumber || null,
          paymentDate: new Date(dto.paymentDate),
          status: PaymentStatus.RECORDED,
          notes: dto.notes || null,
        },
      });

      // If initial allocations are requested, allocate them now
      if (dto.allocations && dto.allocations.length > 0) {
        let totalAllocated = new Prisma.Decimal(0);

        for (const alloc of dto.allocations) {
          const allocAmount = new Prisma.Decimal(alloc.amount);
          if (allocAmount.isNegative() || allocAmount.isZero()) {
            throw new BadRequestException('Allocation amount must be strictly positive');
          }

          totalAllocated = totalAllocated.plus(allocAmount);
          if (totalAllocated.greaterThan(amount)) {
            throw new BadRequestException('Sum of allocations cannot exceed payment amount');
          }

          // Lock invoice row
          const invoiceRows = await tx.$queryRaw<any[]>`
            SELECT id, "tenantId", "status", "totalAmount", "paidAmount", "outstandingAmount", "invoiceNumber"
            FROM "invoices"
            WHERE id = ${alloc.invoiceId} AND "organizationId" = ${organizationId}
            FOR UPDATE
          `;

          if (!invoiceRows || invoiceRows.length === 0) {
            throw new NotFoundException(`Invoice ${alloc.invoiceId} not found`);
          }

          const invoice = invoiceRows[0];
          if (invoice.tenantId !== dto.tenantId) {
            throw new BadRequestException('Cannot allocate payment to an invoice of another tenant');
          }

          if (invoice.status === InvoiceStatus.VOID || invoice.status === InvoiceStatus.CANCELLED) {
            throw new BadRequestException(`Cannot allocate payment to ${invoice.status} invoice`);
          }

          const outstanding = new Prisma.Decimal(invoice.outstandingAmount);
          if (allocAmount.greaterThan(outstanding)) {
            throw new BadRequestException(
              `Allocation amount (${allocAmount.toString()}) exceeds invoice outstanding balance (${outstanding.toString()})`
            );
          }

          // Create allocation
          await tx.paymentAllocation.create({
            data: {
              paymentId: payment.id,
              invoiceId: alloc.invoiceId,
              amount: allocAmount,
              status: PaymentAllocationStatus.ACTIVE,
            },
          });

          // Update invoice balances and status
          const newPaid = new Prisma.Decimal(invoice.paidAmount).plus(allocAmount);
          const newOutstanding = outstanding.minus(allocAmount);
          const newStatus = newOutstanding.isZero() ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;

          await tx.invoice.update({
            where: { id: alloc.invoiceId },
            data: {
              paidAmount: newPaid,
              outstandingAmount: newOutstanding,
              status: newStatus,
            },
          });
        }

        const paymentStatus = totalAllocated.equals(amount)
          ? PaymentStatus.ALLOCATED
          : PaymentStatus.PARTIALLY_ALLOCATED;

        await tx.payment.update({
          where: { id: payment.id },
          data: { status: paymentStatus },
        });
      }

      // Record double-entry ledger entries for the payment:
      // Debit: CASH or BANK for payment amount
      // Credit: TENANT_RECEIVABLE for payment amount
      const paymentAccount = this.getPaymentAccountForMethod(dto.paymentMethod);
      const ledgerEntries = [
        {
          tenantId: dto.tenantId,
          paymentId: payment.id,
          entryType: LedgerEntryType.PAYMENT,
          accountType: paymentAccount,
          debitAmount: amount,
          creditAmount: new Prisma.Decimal(0),
          reference: dto.referenceNumber || payment.id,
          description: `Payment received (${dto.paymentMethod})`,
        },
        {
          tenantId: dto.tenantId,
          paymentId: payment.id,
          entryType: LedgerEntryType.PAYMENT,
          accountType: LedgerAccountType.TENANT_RECEIVABLE,
          debitAmount: new Prisma.Decimal(0),
          creditAmount: amount,
          reference: dto.referenceNumber || payment.id,
          description: `Payment credited to tenant account`,
        },
      ];

      await this.ledgerService.recordTransaction(organizationId, ledgerEntries, tx);

      await tx.auditLog.create({
        data: {
          organizationId,
          userId: userId || null,
          action: 'PAYMENT_RECORDED',
          resourceType: 'Payment',
          resourceId: payment.id,
          metadata: {
            amount: amount.toString(),
            paymentMethod: dto.paymentMethod,
            referenceNumber: dto.referenceNumber,
          },
        },
      });

      const fullPayment = await tx.payment.findUniqueOrThrow({
        where: { id: payment.id },
        include: {
          allocations: {
            include: { invoice: true },
          },
          tenant: true,
        },
      });

      return this.mapToDto(fullPayment);
    });
  }

  /**
   * Allocates an existing payment to an invoice with concurrency row-locking
   */
  async allocatePayment(
    organizationId: string,
    paymentId: string,
    dto: AllocatePaymentDto,
    userId?: string
  ): Promise<PaymentDto> {
    const allocAmount = new Prisma.Decimal(dto.amount);
    if (allocAmount.isNegative() || allocAmount.isZero()) {
      throw new BadRequestException('Allocation amount must be strictly greater than zero');
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Lock payment row
      const paymentRows = await tx.$queryRaw<any[]>`
        SELECT id, "tenantId", "amount", "status", "paymentMethod"
        FROM "payments"
        WHERE id = ${paymentId} AND "organizationId" = ${organizationId}
        FOR UPDATE
      `;

      if (!paymentRows || paymentRows.length === 0) {
        throw new NotFoundException(`Payment ${paymentId} not found`);
      }
      const payment = paymentRows[0];

      if (payment.status === PaymentStatus.VOID || payment.status === PaymentStatus.REFUNDED) {
        throw new BadRequestException(`Cannot allocate from ${payment.status} payment`);
      }

      // Calculate currently active allocations for this payment
      const existingAllocations = await tx.paymentAllocation.findMany({
        where: {
          paymentId,
          status: PaymentAllocationStatus.ACTIVE,
        },
      });

      let currentAllocated = new Prisma.Decimal(0);
      for (const a of existingAllocations) {
        currentAllocated = currentAllocated.plus(a.amount);
      }

      const totalPaymentAmount = new Prisma.Decimal(payment.amount);
      const unallocated = totalPaymentAmount.minus(currentAllocated);

      if (allocAmount.greaterThan(unallocated)) {
        throw new BadRequestException(
          `Allocation amount (${allocAmount.toString()}) exceeds unallocated payment balance (${unallocated.toString()})`
        );
      }

      // 2. Lock invoice row
      const invoiceRows = await tx.$queryRaw<any[]>`
        SELECT id, "tenantId", "status", "totalAmount", "paidAmount", "outstandingAmount", "invoiceNumber"
        FROM "invoices"
        WHERE id = ${dto.invoiceId} AND "organizationId" = ${organizationId}
        FOR UPDATE
      `;

      if (!invoiceRows || invoiceRows.length === 0) {
        throw new NotFoundException(`Invoice ${dto.invoiceId} not found`);
      }
      const invoice = invoiceRows[0];

      if (invoice.tenantId !== payment.tenantId) {
        throw new BadRequestException('Payment tenant and invoice tenant do not match');
      }

      if (invoice.status === InvoiceStatus.VOID || invoice.status === InvoiceStatus.CANCELLED) {
        throw new BadRequestException(`Cannot allocate payment to ${invoice.status} invoice`);
      }

      const outstanding = new Prisma.Decimal(invoice.outstandingAmount);
      if (allocAmount.greaterThan(outstanding)) {
        throw new BadRequestException(
          `Allocation amount (${allocAmount.toString()}) exceeds invoice outstanding balance (${outstanding.toString()})`
        );
      }

      // 3. Create allocation
      await tx.paymentAllocation.create({
        data: {
          paymentId,
          invoiceId: dto.invoiceId,
          amount: allocAmount,
          status: PaymentAllocationStatus.ACTIVE,
        },
      });

      // 4. Update invoice balances
      const newPaid = new Prisma.Decimal(invoice.paidAmount).plus(allocAmount);
      const newOutstanding = outstanding.minus(allocAmount);
      const newInvoiceStatus = newOutstanding.isZero()
        ? InvoiceStatus.PAID
        : InvoiceStatus.PARTIALLY_PAID;

      await tx.invoice.update({
        where: { id: dto.invoiceId },
        data: {
          paidAmount: newPaid,
          outstandingAmount: newOutstanding,
          status: newInvoiceStatus,
        },
      });

      // 5. Update payment status
      const updatedTotalAllocated = currentAllocated.plus(allocAmount);
      const newPaymentStatus = updatedTotalAllocated.equals(totalPaymentAmount)
        ? PaymentStatus.ALLOCATED
        : PaymentStatus.PARTIALLY_ALLOCATED;

      await tx.payment.update({
        where: { id: paymentId },
        data: { status: newPaymentStatus },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          userId: userId || null,
          action: 'PAYMENT_ALLOCATED',
          resourceType: 'PaymentAllocation',
          resourceId: paymentId,
          metadata: {
            invoiceId: dto.invoiceId,
            amount: allocAmount.toString(),
          },
        },
      });

      const fullPayment = await tx.payment.findUniqueOrThrow({
        where: { id: paymentId },
        include: {
          allocations: {
            include: { invoice: true },
          },
          tenant: true,
        },
      });

      return this.mapToDto(fullPayment);
    });
  }

  /**
   * Reverses a payment allocation
   */
  async reverseAllocation(
    organizationId: string,
    paymentId: string,
    allocationId: string,
    userId?: string
  ): Promise<PaymentDto> {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const allocation = await tx.paymentAllocation.findFirst({
        where: {
          id: allocationId,
          paymentId,
          status: PaymentAllocationStatus.ACTIVE,
        },
        include: { invoice: true },
      });

      if (!allocation) {
        throw new NotFoundException(`Active allocation ${allocationId} not found`);
      }

      // 1. Mark allocation reversed
      await tx.paymentAllocation.update({
        where: { id: allocationId },
        data: { status: PaymentAllocationStatus.REVERSED },
      });

      // 2. Restore invoice outstanding amount
      const allocAmount = allocation.amount;
      const invoice = allocation.invoice;
      const newPaid = invoice.paidAmount.minus(allocAmount);
      const newOutstanding = invoice.outstandingAmount.plus(allocAmount);
      const newInvoiceStatus = newPaid.isZero()
        ? InvoiceStatus.ISSUED
        : InvoiceStatus.PARTIALLY_PAID;

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: newPaid,
          outstandingAmount: newOutstanding,
          status: newInvoiceStatus,
        },
      });

      // 3. Update payment status
      const remainingActive = await tx.paymentAllocation.findMany({
        where: {
          paymentId,
          status: PaymentAllocationStatus.ACTIVE,
        },
      });

      let totalRemainingAllocated = new Prisma.Decimal(0);
      for (const a of remainingActive) {
        totalRemainingAllocated = totalRemainingAllocated.plus(a.amount);
      }

      const payment = await tx.payment.findUniqueOrThrow({
        where: { id: paymentId },
      });

      let newPaymentStatus = PaymentStatus.RECORDED;
      if (totalRemainingAllocated.equals(payment.amount)) {
        newPaymentStatus = PaymentStatus.ALLOCATED;
      } else if (totalRemainingAllocated.isPositive()) {
        newPaymentStatus = PaymentStatus.PARTIALLY_ALLOCATED;
      }

      await tx.payment.update({
        where: { id: paymentId },
        data: { status: newPaymentStatus },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          userId: userId || null,
          action: 'PAYMENT_ALLOCATION_REVERSED',
          resourceType: 'PaymentAllocation',
          resourceId: allocationId,
          metadata: {
            paymentId,
            invoiceId: invoice.id,
            amount: allocAmount.toString(),
          },
        },
      });

      const updatedPayment = await tx.payment.findUniqueOrThrow({
        where: { id: paymentId },
        include: {
          allocations: {
            include: { invoice: true },
          },
          tenant: true,
        },
      });

      return this.mapToDto(updatedPayment);
    });
  }

  /**
   * Retrieves a single payment by ID
   */
  async getPayment(organizationId: string, id: string): Promise<PaymentDto> {
    const payment = await this.prisma.payment.findFirst({
      where: { id, organizationId },
      include: {
        allocations: {
          include: { invoice: true },
        },
        tenant: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment ${id} not found`);
    }

    return this.mapToDto(payment);
  }

  /**
   * Lists payments with filtering
   */
  async listPayments(
    organizationId: string,
    filters?: PaymentFilterInput
  ): Promise<PaymentDto[]> {
    const where: Prisma.PaymentWhereInput = {
      organizationId,
    };

    if (filters?.tenantId) where.tenantId = filters.tenantId;
    if (filters?.status) where.status = filters.status;
    if (filters?.paymentMethod) where.paymentMethod = filters.paymentMethod;

    if (filters?.fromDate || filters?.toDate) {
      where.paymentDate = {};
      if (filters.fromDate) where.paymentDate.gte = new Date(filters.fromDate);
      if (filters.toDate) where.paymentDate.lte = new Date(filters.toDate);
    }

    const payments = await this.prisma.payment.findMany({
      where,
      include: {
        allocations: true,
        tenant: true,
      },
      orderBy: { paymentDate: 'desc' },
    });

    return payments.map(this.mapToDto);
  }

  private mapToDto(payment: any): PaymentDto {
    let allocatedSum = new Prisma.Decimal(0);
    if (payment.allocations) {
      for (const a of payment.allocations) {
        if (a.status === PaymentAllocationStatus.ACTIVE) {
          allocatedSum = allocatedSum.plus(a.amount);
        }
      }
    }
    const amount = new Prisma.Decimal(payment.amount);
    const unallocated = amount.minus(allocatedSum);

    return {
      id: payment.id,
      organizationId: payment.organizationId,
      tenantId: payment.tenantId,
      amount: payment.amount.toString(),
      allocatedAmount: allocatedSum.toString(),
      unallocatedAmount: unallocated.toString(),
      paymentMethod: payment.paymentMethod as PaymentMethod,
      referenceNumber: payment.referenceNumber,
      paymentDate: payment.paymentDate.toISOString(),
      status: payment.status as PaymentStatus,
      notes: payment.notes,
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
      allocations: payment.allocations
        ? payment.allocations.map((a: any) => ({
            id: a.id,
            paymentId: a.paymentId,
            invoiceId: a.invoiceId,
            amount: a.amount.toString(),
            status: a.status as PaymentAllocationStatus,
            createdAt: a.createdAt.toISOString(),
            invoice: a.invoice
              ? {
                  id: a.invoice.id,
                  invoiceNumber: a.invoice.invoiceNumber,
                  totalAmount: a.invoice.totalAmount?.toString() || '0',
                  paidAmount: a.invoice.paidAmount?.toString() || '0',
                  outstandingAmount: a.invoice.outstandingAmount?.toString() || '0',
                  status: a.invoice.status,
                }
              : undefined,
          }))
        : undefined,
      tenant: payment.tenant
        ? {
            id: payment.tenant.id,
            firstName: payment.tenant.firstName,
            lastName: payment.tenant.lastName,
            email: payment.tenant.email,
            phone: payment.tenant.phone,
          }
        : undefined,
    };
  }
}
