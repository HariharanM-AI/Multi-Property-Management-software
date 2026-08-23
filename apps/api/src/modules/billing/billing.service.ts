import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import { SecurityDepositsService } from '../security-deposits/security-deposits.service';
import {
  BillingChargeDto,
  CreateBillingChargeDto,
  UpdateBillingChargeDto,
  BillingScheduleDto,
  CreateBillingScheduleDto,
  UpdateBillingScheduleDto,
  BillingFrequency,
  ChargeType,
  TenantFinancialSummaryDto,
  PropertyFinancialSummaryDto,
  OrganizationFinancialSummaryDto,
  InvoiceStatus,
} from '@propertyos/types';
import { BillingFilterInput } from '@propertyos/validation';
import { Prisma } from '@prisma/client';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoicesService,
    private readonly securityDepositsService: SecurityDepositsService
  ) {}

  // ----------------------------------------------------------------------------
  // BILLING CHARGES
  // ----------------------------------------------------------------------------

  async createCharge(
    organizationId: string,
    dto: CreateBillingChargeDto,
    userId?: string
  ): Promise<BillingChargeDto> {
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.isNegative()) {
      throw new BadRequestException('Charge amount cannot be negative');
    }

    const charge = await this.prisma.billingCharge.create({
      data: {
        organizationId,
        name: dto.name,
        chargeType: dto.chargeType,
        description: dto.description || null,
        amount,
        frequency: dto.frequency,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId: userId || null,
        action: 'BILLING_CHARGE_CREATED',
        resourceType: 'BillingCharge',
        resourceId: charge.id,
        metadata: {
          name: charge.name,
          amount: charge.amount.toString(),
          chargeType: charge.chargeType,
        },
      },
    });

    return this.mapChargeToDto(charge);
  }

  async listCharges(
    organizationId: string,
    activeOnly?: boolean
  ): Promise<BillingChargeDto[]> {
    const where: Prisma.BillingChargeWhereInput = {
      organizationId,
    };
    if (activeOnly) {
      where.isActive = true;
    }

    const charges = await this.prisma.billingCharge.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return charges.map(this.mapChargeToDto);
  }

  async getCharge(organizationId: string, id: string): Promise<BillingChargeDto> {
    const charge = await this.prisma.billingCharge.findFirst({
      where: { id, organizationId },
    });

    if (!charge) {
      throw new NotFoundException(`Billing charge ${id} not found`);
    }

    return this.mapChargeToDto(charge);
  }

  async updateCharge(
    organizationId: string,
    id: string,
    dto: UpdateBillingChargeDto,
    userId?: string
  ): Promise<BillingChargeDto> {
    const existing = await this.prisma.billingCharge.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      throw new NotFoundException(`Billing charge ${id} not found`);
    }

    const updated = await this.prisma.billingCharge.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description !== undefined ? dto.description : undefined,
        amount: dto.amount !== undefined ? new Prisma.Decimal(dto.amount) : undefined,
        frequency: dto.frequency,
        isActive: dto.isActive !== undefined ? dto.isActive : undefined,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId: userId || null,
        action: 'BILLING_CHARGE_UPDATED',
        resourceType: 'BillingCharge',
        resourceId: id,
      },
    });

    return this.mapChargeToDto(updated);
  }

  async archiveCharge(
    organizationId: string,
    id: string,
    userId?: string
  ): Promise<BillingChargeDto> {
    const existing = await this.prisma.billingCharge.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      throw new NotFoundException(`Billing charge ${id} not found`);
    }

    const updated = await this.prisma.billingCharge.update({
      where: { id },
      data: { isActive: false },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId: userId || null,
        action: 'BILLING_CHARGE_ARCHIVED',
        resourceType: 'BillingCharge',
        resourceId: id,
      },
    });

    return this.mapChargeToDto(updated);
  }

  // ----------------------------------------------------------------------------
  // BILLING SCHEDULES
  // ----------------------------------------------------------------------------

  async createBillingSchedule(
    organizationId: string,
    dto: CreateBillingScheduleDto,
    userId?: string
  ): Promise<BillingScheduleDto> {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: dto.tenantId, organizationId },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${dto.tenantId} not found`);
    }

    const charge = await this.prisma.billingCharge.findFirst({
      where: { id: dto.chargeId, organizationId },
    });
    if (!charge) {
      throw new NotFoundException(`Charge ${dto.chargeId} not found`);
    }

    const amount = dto.amount !== undefined ? new Prisma.Decimal(dto.amount) : charge.amount;
    const startDate = new Date(dto.startDate);
    const nextBillingDate = startDate;

    const schedule = await this.prisma.billingSchedule.create({
      data: {
        organizationId,
        tenantId: dto.tenantId,
        propertyId: dto.propertyId || null,
        leaseId: dto.leaseId || null,
        checkInId: dto.checkInId || null,
        chargeId: dto.chargeId,
        startDate,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        frequency: dto.frequency,
        amount,
        nextBillingDate,
        active: dto.active !== undefined ? dto.active : true,
      },
      include: {
        charge: true,
        tenant: true,
        property: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId: userId || null,
        action: 'BILLING_SCHEDULE_CREATED',
        resourceType: 'BillingSchedule',
        resourceId: schedule.id,
        metadata: {
          tenantId: schedule.tenantId,
          chargeId: schedule.chargeId,
          amount: schedule.amount.toString(),
        },
      },
    });

    return this.mapScheduleToDto(schedule);
  }

  async listBillingSchedules(
    organizationId: string,
    filters?: BillingFilterInput
  ): Promise<BillingScheduleDto[]> {
    const where: Prisma.BillingScheduleWhereInput = {
      organizationId,
    };

    if (filters?.tenantId) where.tenantId = filters.tenantId;
    if (filters?.propertyId) where.propertyId = filters.propertyId;
    if (filters?.active !== undefined) where.active = filters.active;

    const schedules = await this.prisma.billingSchedule.findMany({
      where,
      include: {
        charge: true,
        tenant: true,
        property: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return schedules.map(this.mapScheduleToDto);
  }

  async updateBillingSchedule(
    organizationId: string,
    id: string,
    dto: UpdateBillingScheduleDto,
    userId?: string
  ): Promise<BillingScheduleDto> {
    const schedule = await this.prisma.billingSchedule.findFirst({
      where: { id, organizationId },
    });

    if (!schedule) {
      throw new NotFoundException(`Billing schedule ${id} not found`);
    }

    const updated = await this.prisma.billingSchedule.update({
      where: { id },
      data: {
        endDate: dto.endDate !== undefined ? (dto.endDate ? new Date(dto.endDate) : null) : undefined,
        amount: dto.amount !== undefined ? new Prisma.Decimal(dto.amount) : undefined,
        frequency: dto.frequency,
        nextBillingDate: dto.nextBillingDate !== undefined ? (dto.nextBillingDate ? new Date(dto.nextBillingDate) : null) : undefined,
        active: dto.active !== undefined ? dto.active : undefined,
      },
      include: {
        charge: true,
        tenant: true,
        property: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId: userId || null,
        action: 'BILLING_SCHEDULE_UPDATED',
        resourceType: 'BillingSchedule',
        resourceId: id,
      },
    });

    return this.mapScheduleToDto(updated);
  }

  async pauseBillingSchedule(
    organizationId: string,
    id: string,
    userId?: string
  ): Promise<BillingScheduleDto> {
    const schedule = await this.prisma.billingSchedule.findFirst({
      where: { id, organizationId },
    });

    if (!schedule) {
      throw new NotFoundException(`Billing schedule ${id} not found`);
    }

    const updated = await this.prisma.billingSchedule.update({
      where: { id },
      data: { active: false },
      include: { charge: true, tenant: true, property: true },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId: userId || null,
        action: 'BILLING_SCHEDULE_PAUSED',
        resourceType: 'BillingSchedule',
        resourceId: id,
      },
    });

    return this.mapScheduleToDto(updated);
  }

  async resumeBillingSchedule(
    organizationId: string,
    id: string,
    userId?: string
  ): Promise<BillingScheduleDto> {
    const schedule = await this.prisma.billingSchedule.findFirst({
      where: { id, organizationId },
    });

    if (!schedule) {
      throw new NotFoundException(`Billing schedule ${id} not found`);
    }

    const updated = await this.prisma.billingSchedule.update({
      where: { id },
      data: { active: true },
      include: { charge: true, tenant: true, property: true },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId: userId || null,
        action: 'BILLING_SCHEDULE_RESUMED',
        resourceType: 'BillingSchedule',
        resourceId: id,
      },
    });

    return this.mapScheduleToDto(updated);
  }

  /**
   * Generates invoices for all schedules due on or before `asOfDate`.
   * Enforces idempotency and increments nextBillingDate transactionally.
   */
  async generateDueInvoices(
    organizationId: string,
    asOfDateStr?: string,
    userId?: string
  ): Promise<{ generatedCount: number; invoiceIds: string[] }> {
    const asOfDate = asOfDateStr ? new Date(asOfDateStr) : new Date();

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Find active schedules due on or before asOfDate
      const dueSchedules = await tx.billingSchedule.findMany({
        where: {
          organizationId,
          active: true,
          nextBillingDate: {
            lte: asOfDate,
          },
          OR: [
            { endDate: null },
            { endDate: { gte: asOfDate } },
          ],
        },
        include: {
          charge: true,
        },
      });

      const generatedInvoiceIds: string[] = [];

      for (const schedule of dueSchedules) {
        const issueDate = schedule.nextBillingDate || schedule.startDate;
        // Due date: default to 5 days after issue date
        const dueDate = new Date(issueDate.getTime() + 5 * 24 * 60 * 60 * 1000);

        // Check if an invoice for this tenant, property and date range was already created
        const existingInvoice = await tx.invoice.findFirst({
          where: {
            organizationId,
            tenantId: schedule.tenantId,
            issueDate,
            lines: {
              some: {
                chargeId: schedule.chargeId,
              },
            },
          },
        });

        if (!existingInvoice) {
          const invoice = await this.invoicesService.createInvoice(
            organizationId,
            {
              tenantId: schedule.tenantId,
              propertyId: schedule.propertyId,
              leaseId: schedule.leaseId,
              checkInId: schedule.checkInId,
              issueDate: issueDate.toISOString(),
              dueDate: dueDate.toISOString(),
              lines: [
                {
                  chargeId: schedule.chargeId,
                  description: `${schedule.charge.name} (${schedule.frequency})`,
                  chargeType: schedule.charge.chargeType as unknown as ChargeType,
                  quantity: 1,
                  unitAmount: schedule.amount.toString(),
                },
              ],
            },
            userId
          );

          generatedInvoiceIds.push(invoice.id);
        }

        // Calculate next billing date
        const nextDate = this.calculateNextBillingDate(
          issueDate,
          schedule.frequency as unknown as BillingFrequency
        );

        await tx.billingSchedule.update({
          where: { id: schedule.id },
          data: {
            nextBillingDate: nextDate,
          },
        });
      }

      return {
        generatedCount: generatedInvoiceIds.length,
        invoiceIds: generatedInvoiceIds,
      };
    });
  }

  private calculateNextBillingDate(current: Date, frequency: BillingFrequency): Date {
    const next = new Date(current);
    switch (frequency) {
      case BillingFrequency.DAILY:
        next.setDate(next.getDate() + 1);
        break;
      case BillingFrequency.WEEKLY:
        next.setDate(next.getDate() + 7);
        break;
      case BillingFrequency.MONTHLY:
        next.setMonth(next.getMonth() + 1);
        break;
      case BillingFrequency.QUARTERLY:
        next.setMonth(next.getMonth() + 3);
        break;
      case BillingFrequency.YEARLY:
        next.setFullYear(next.getFullYear() + 1);
        break;
      case BillingFrequency.ONE_TIME:
      default:
        // Set far in future or deactivate
        next.setFullYear(next.getFullYear() + 100);
        break;
    }
    return next;
  }

  // ----------------------------------------------------------------------------
  // FINANCIAL SUMMARIES
  // ----------------------------------------------------------------------------

  async getTenantFinancialSummary(
    organizationId: string,
    tenantId: string
  ): Promise<TenantFinancialSummaryDto> {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId, organizationId },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    const invoices = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        tenantId,
        status: { notIn: [InvoiceStatus.VOID, InvoiceStatus.CANCELLED] },
      },
      orderBy: { issueDate: 'desc' },
    });

    const payments = await this.prisma.payment.findMany({
      where: { organizationId, tenantId },
      orderBy: { paymentDate: 'desc' },
    });

    const deposit = await this.securityDepositsService.getOrCreateAccount(
      organizationId,
      tenantId
    );

    let totalInvoiced = new Prisma.Decimal(0);
    let totalPaid = new Prisma.Decimal(0);
    let outstandingBalance = new Prisma.Decimal(0);
    let overdueCount = 0;

    const now = new Date();
    for (const inv of invoices) {
      totalInvoiced = totalInvoiced.plus(inv.totalAmount);
      totalPaid = totalPaid.plus(inv.paidAmount);
      outstandingBalance = outstandingBalance.plus(inv.outstandingAmount);

      if (
        (inv.status === InvoiceStatus.ISSUED || inv.status === InvoiceStatus.PARTIALLY_PAID || inv.status === InvoiceStatus.OVERDUE) &&
        inv.dueDate < now &&
        inv.outstandingAmount.isPositive()
      ) {
        overdueCount++;
      }
    }

    return {
      tenantId,
      totalInvoiced: totalInvoiced.toString(),
      totalPaid: totalPaid.toString(),
      outstandingBalance: outstandingBalance.toString(),
      activeCredits: '0.00',
      securityDepositHeld: deposit.amountHeld,
      securityDepositDeducted: deposit.amountDeducted,
      securityDepositRefunded: deposit.amountRefunded,
      availableDeposit: deposit.availableBalance,
      currentInvoiceCount: invoices.length,
      overdueInvoiceCount: overdueCount,
      lastInvoiceDate: invoices.length > 0 ? invoices[0].issueDate.toISOString() : null,
      lastPaymentDate: payments.length > 0 ? payments[0].paymentDate.toISOString() : null,
    };
  }

  async getPropertyFinancialSummary(
    organizationId: string,
    propertyId: string
  ): Promise<PropertyFinancialSummaryDto> {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, organizationId },
    });

    if (!property) {
      throw new NotFoundException(`Property ${propertyId} not found`);
    }

    const invoices = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        propertyId,
        status: { notIn: [InvoiceStatus.VOID, InvoiceStatus.CANCELLED] },
      },
    });

    let totalInvoiced = new Prisma.Decimal(0);
    let totalCollected = new Prisma.Decimal(0);
    let outstandingAmount = new Prisma.Decimal(0);
    let overdueAmount = new Prisma.Decimal(0);
    let paidCount = 0;

    const now = new Date();
    for (const inv of invoices) {
      totalInvoiced = totalInvoiced.plus(inv.totalAmount);
      totalCollected = totalCollected.plus(inv.paidAmount);
      outstandingAmount = outstandingAmount.plus(inv.outstandingAmount);

      if (inv.status === InvoiceStatus.PAID) {
        paidCount++;
      }

      if (
        (inv.status === InvoiceStatus.ISSUED || inv.status === InvoiceStatus.PARTIALLY_PAID || inv.status === InvoiceStatus.OVERDUE) &&
        inv.dueDate < now &&
        inv.outstandingAmount.isPositive()
      ) {
        overdueAmount = overdueAmount.plus(inv.outstandingAmount);
      }
    }

    // Active tenants in this property
    const activeCheckIns = await this.prisma.checkIn.count({
      where: {
        organizationId,
        propertyId,
        status: 'CHECKED_IN',
      },
    });

    return {
      propertyId,
      totalInvoiced: totalInvoiced.toString(),
      totalCollected: totalCollected.toString(),
      outstandingAmount: outstandingAmount.toString(),
      overdueAmount: overdueAmount.toString(),
      activeTenantCount: activeCheckIns,
      totalInvoiceCount: invoices.length,
      paidInvoiceCount: paidCount,
    };
  }

  async getOrganizationFinancialSummary(
    organizationId: string
  ): Promise<OrganizationFinancialSummaryDto> {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        status: { notIn: [InvoiceStatus.VOID, InvoiceStatus.CANCELLED] },
      },
    });

    const payments = await this.prisma.payment.findMany({
      where: { organizationId },
    });

    const deposits = await this.prisma.securityDepositAccount.findMany({
      where: { organizationId },
    });

    let totalInvoiced = new Prisma.Decimal(0);
    let totalCollected = new Prisma.Decimal(0);
    let totalOutstanding = new Prisma.Decimal(0);
    let totalOverdue = new Prisma.Decimal(0);
    const now = new Date();

    for (const inv of invoices) {
      totalInvoiced = totalInvoiced.plus(inv.totalAmount);
      totalCollected = totalCollected.plus(inv.paidAmount);
      totalOutstanding = totalOutstanding.plus(inv.outstandingAmount);

      if (
        (inv.status === InvoiceStatus.ISSUED || inv.status === InvoiceStatus.PARTIALLY_PAID || inv.status === InvoiceStatus.OVERDUE) &&
        inv.dueDate < now &&
        inv.outstandingAmount.isPositive()
      ) {
        totalOverdue = totalOverdue.plus(inv.outstandingAmount);
      }
    }

    let depositsHeld = new Prisma.Decimal(0);
    let refundsIssued = new Prisma.Decimal(0);

    for (const d of deposits) {
      depositsHeld = depositsHeld.plus(d.amountHeld);
      refundsIssued = refundsIssued.plus(d.amountRefunded);
    }

    return {
      totalRevenueInvoiced: totalInvoiced.toString(),
      totalPaymentsCollected: totalCollected.toString(),
      totalOutstanding: totalOutstanding.toString(),
      totalOverdue: totalOverdue.toString(),
      totalRefundsIssued: refundsIssued.toString(),
      totalDepositsHeld: depositsHeld.toString(),
      totalInvoiceCount: invoices.length,
      totalPaymentCount: payments.length,
    };
  }

  private mapChargeToDto(charge: any): BillingChargeDto {
    return {
      id: charge.id,
      organizationId: charge.organizationId,
      name: charge.name,
      chargeType: charge.chargeType as ChargeType,
      description: charge.description,
      amount: charge.amount.toString(),
      frequency: charge.frequency as BillingFrequency,
      isActive: charge.isActive,
      createdAt: charge.createdAt.toISOString(),
      updatedAt: charge.updatedAt.toISOString(),
    };
  }

  private mapScheduleToDto(schedule: any): BillingScheduleDto {
    return {
      id: schedule.id,
      organizationId: schedule.organizationId,
      tenantId: schedule.tenantId,
      propertyId: schedule.propertyId,
      leaseId: schedule.leaseId,
      checkInId: schedule.checkInId,
      chargeId: schedule.chargeId,
      startDate: schedule.startDate.toISOString(),
      endDate: schedule.endDate ? schedule.endDate.toISOString() : null,
      frequency: schedule.frequency as BillingFrequency,
      amount: schedule.amount.toString(),
      nextBillingDate: schedule.nextBillingDate ? schedule.nextBillingDate.toISOString() : null,
      active: schedule.active,
      createdAt: schedule.createdAt.toISOString(),
      updatedAt: schedule.updatedAt.toISOString(),
      charge: schedule.charge ? this.mapChargeToDto(schedule.charge) : undefined,
      tenant: schedule.tenant
        ? {
            id: schedule.tenant.id,
            firstName: schedule.tenant.firstName,
            lastName: schedule.tenant.lastName,
            email: schedule.tenant.email,
            phone: schedule.tenant.phone,
          }
        : undefined,
      property: schedule.property
        ? {
            id: schedule.property.id,
            name: schedule.property.name,
            code: schedule.property.code,
          }
        : null,
    };
  }
}
