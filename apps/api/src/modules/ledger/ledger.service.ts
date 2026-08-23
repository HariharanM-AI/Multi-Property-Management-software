import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  LedgerAccountType,
  LedgerEntryType,
  LedgerEntryDto,
} from '@propertyos/types';
import { Prisma } from '@prisma/client';

export interface LedgerEntryItem {
  tenantId: string;
  invoiceId?: string | null;
  paymentId?: string | null;
  entryType: LedgerEntryType;
  accountType: LedgerAccountType;
  debitAmount: Prisma.Decimal | number | string;
  creditAmount: Prisma.Decimal | number | string;
  reference?: string | null;
  description?: string | null;
}

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records a set of ledger entries atomically ensuring the double-entry invariant:
   * sum(debitAmount) === sum(creditAmount)
   */
  async recordTransaction(
    organizationId: string,
    entries: LedgerEntryItem[],
    tx?: Prisma.TransactionClient
  ): Promise<LedgerEntryDto[]> {
    if (!entries || entries.length === 0) {
      throw new BadRequestException('Ledger transaction must contain at least one entry');
    }

    const client = tx || this.prisma;

    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);

    const formattedEntries: {
      organizationId: string;
      tenantId: string;
      invoiceId?: string | null;
      paymentId?: string | null;
      entryType: LedgerEntryType;
      accountType: LedgerAccountType;
      debitAmount: Prisma.Decimal;
      creditAmount: Prisma.Decimal;
      reference?: string | null;
      description?: string | null;
    }[] = [];

    for (const item of entries) {
      const debit = new Prisma.Decimal(item.debitAmount || 0);
      const credit = new Prisma.Decimal(item.creditAmount || 0);

      // Invariant: debit and credit must be non-negative
      if (debit.isNegative() || credit.isNegative()) {
        throw new BadRequestException('Ledger debit and credit amounts must be non-negative');
      }

      // Invariant: a single entry line cannot have both debit > 0 and credit > 0
      if (debit.greaterThan(0) && credit.greaterThan(0)) {
        throw new BadRequestException('A single ledger line cannot contain both positive debit and positive credit');
      }

      // Invariant: at least one side must be positive
      if (debit.isZero() && credit.isZero()) {
        throw new BadRequestException('A ledger entry must have either a positive debit or credit amount');
      }

      totalDebit = totalDebit.plus(debit);
      totalCredit = totalCredit.plus(credit);

      formattedEntries.push({
        organizationId,
        tenantId: item.tenantId,
        invoiceId: item.invoiceId || null,
        paymentId: item.paymentId || null,
        entryType: item.entryType,
        accountType: item.accountType,
        debitAmount: debit,
        creditAmount: credit,
        reference: item.reference || null,
        description: item.description || null,
      });
    }

    // Double-entry invariant: total debit must equal total credit
    if (!totalDebit.equals(totalCredit)) {
      throw new BadRequestException(
        `Unbalanced ledger transaction: total debit (${totalDebit.toString()}) does not equal total credit (${totalCredit.toString()})`
      );
    }

    const created = await Promise.all(
      formattedEntries.map((entry) =>
        client.ledgerEntry.create({
          data: {
            organizationId: entry.organizationId,
            tenantId: entry.tenantId,
            invoiceId: entry.invoiceId,
            paymentId: entry.paymentId,
            entryType: entry.entryType,
            accountType: entry.accountType,
            debitAmount: entry.debitAmount,
            creditAmount: entry.creditAmount,
            reference: entry.reference,
            description: entry.description,
          },
        })
      )
    );

    return created.map(this.mapToDto);
  }

  /**
   * Retrieves ledger entries for an organization with optional filtering
   */
  async listLedgerEntries(
    organizationId: string,
    query?: {
      tenantId?: string;
      invoiceId?: string;
      paymentId?: string;
      accountType?: LedgerAccountType;
      entryType?: LedgerEntryType;
    }
  ): Promise<LedgerEntryDto[]> {
    const where: Prisma.LedgerEntryWhereInput = {
      organizationId,
    };

    if (query?.tenantId) where.tenantId = query.tenantId;
    if (query?.invoiceId) where.invoiceId = query.invoiceId;
    if (query?.paymentId) where.paymentId = query.paymentId;
    if (query?.accountType) where.accountType = query.accountType;
    if (query?.entryType) where.entryType = query.entryType;

    const entries = await this.prisma.ledgerEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return entries.map(this.mapToDto);
  }

  /**
   * Retrieves tenant-specific ledger history
   */
  async getTenantLedger(organizationId: string, tenantId: string): Promise<LedgerEntryDto[]> {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId, organizationId },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    const entries = await this.prisma.ledgerEntry.findMany({
      where: { organizationId, tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return entries.map(this.mapToDto);
  }

  /**
   * Retrieves invoice-specific ledger entries
   */
  async getInvoiceLedger(organizationId: string, invoiceId: string): Promise<LedgerEntryDto[]> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }

    const entries = await this.prisma.ledgerEntry.findMany({
      where: { organizationId, invoiceId },
      orderBy: { createdAt: 'asc' },
    });

    return entries.map(this.mapToDto);
  }

  private mapToDto(entry: {
    id: string;
    organizationId: string;
    tenantId: string;
    invoiceId: string | null;
    paymentId: string | null;
    entryType: LedgerEntryType;
    accountType: LedgerAccountType;
    debitAmount: Prisma.Decimal;
    creditAmount: Prisma.Decimal;
    reference: string | null;
    description: string | null;
    createdAt: Date;
  }): LedgerEntryDto {
    return {
      id: entry.id,
      organizationId: entry.organizationId,
      tenantId: entry.tenantId,
      invoiceId: entry.invoiceId,
      paymentId: entry.paymentId,
      entryType: entry.entryType,
      accountType: entry.accountType,
      debitAmount: entry.debitAmount.toString(),
      creditAmount: entry.creditAmount.toString(),
      reference: entry.reference,
      description: entry.description,
      createdAt: entry.createdAt.toISOString(),
    };
  }
}
