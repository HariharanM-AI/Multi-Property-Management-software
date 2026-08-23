import { Test, TestingModule } from '@nestjs/testing';
import { LedgerService } from './ledger.service';
import { PrismaService } from '../../database/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { LedgerAccountType, LedgerEntryType } from '@propertyos/types';
import { Prisma } from '@prisma/client';

describe('LedgerService', () => {
  let service: LedgerService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      ledgerEntry: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'ledger-uuid-1',
            ...data,
            createdAt: new Date(),
          })
        ),
        findMany: jest.fn().mockResolvedValue([]),
      },
      tenant: {
        findFirst: jest.fn(),
      },
      invoice: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<LedgerService>(LedgerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should successfully record balanced double-entry transactions (debit === credit)', async () => {
    const orgId = 'org-1';
    const tenantId = 'tenant-1';

    const entries = [
      {
        tenantId,
        entryType: LedgerEntryType.INVOICE,
        accountType: LedgerAccountType.TENANT_RECEIVABLE,
        debitAmount: new Prisma.Decimal('10000.00'),
        creditAmount: new Prisma.Decimal('0.00'),
        description: 'Rent charge receivable',
      },
      {
        tenantId,
        entryType: LedgerEntryType.INVOICE,
        accountType: LedgerAccountType.RENT_REVENUE,
        debitAmount: new Prisma.Decimal('0.00'),
        creditAmount: new Prisma.Decimal('10000.00'),
        description: 'Rent revenue recognized',
      },
    ];

    const result = await service.recordTransaction(orgId, entries);
    expect(result).toHaveLength(2);
    expect(prisma.ledgerEntry.create).toHaveBeenCalledTimes(2);
  });

  it('should reject unbalanced transactions where total debit != total credit', async () => {
    const orgId = 'org-1';
    const tenantId = 'tenant-1';

    const unbalancedEntries = [
      {
        tenantId,
        entryType: LedgerEntryType.INVOICE,
        accountType: LedgerAccountType.TENANT_RECEIVABLE,
        debitAmount: new Prisma.Decimal('10000.00'),
        creditAmount: new Prisma.Decimal('0.00'),
      },
      {
        tenantId,
        entryType: LedgerEntryType.INVOICE,
        accountType: LedgerAccountType.RENT_REVENUE,
        debitAmount: new Prisma.Decimal('0.00'),
        creditAmount: new Prisma.Decimal('9500.00'),
      },
    ];

    await expect(service.recordTransaction(orgId, unbalancedEntries)).rejects.toThrow(
      BadRequestException
    );
  });

  it('should reject negative amounts in ledger entries', async () => {
    const orgId = 'org-1';
    const tenantId = 'tenant-1';

    const negativeEntries = [
      {
        tenantId,
        entryType: LedgerEntryType.INVOICE,
        accountType: LedgerAccountType.TENANT_RECEIVABLE,
        debitAmount: new Prisma.Decimal('-100.00'),
        creditAmount: new Prisma.Decimal('0.00'),
      },
      {
        tenantId,
        entryType: LedgerEntryType.INVOICE,
        accountType: LedgerAccountType.RENT_REVENUE,
        debitAmount: new Prisma.Decimal('0.00'),
        creditAmount: new Prisma.Decimal('-100.00'),
      },
    ];

    await expect(service.recordTransaction(orgId, negativeEntries)).rejects.toThrow(
      BadRequestException
    );
  });
});
