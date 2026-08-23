import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class InvoiceNumberService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a concurrency-safe, deterministic, organization-scoped invoice number.
   * Format: INV-YYYY-XXXXXX (e.g. INV-2026-000001)
   */
  async generateInvoiceNumber(
    organizationId: string,
    tx?: Prisma.TransactionClient
  ): Promise<string> {
    const client = tx || this.prisma;
    const year = new Date().getFullYear();
    const sequenceKey = `INVOICE_${year}`;

    // Upsert and increment sequence atomically
    const sequence = await client.organizationSequence.upsert({
      where: {
        organizationId_key: {
          organizationId,
          key: sequenceKey,
        },
      },
      create: {
        organizationId,
        key: sequenceKey,
        currentValue: 1,
      },
      update: {
        currentValue: {
          increment: 1,
        },
      },
    });

    const padded = String(sequence.currentValue).padStart(6, '0');
    return `INV-${year}-${padded}`;
  }
}
