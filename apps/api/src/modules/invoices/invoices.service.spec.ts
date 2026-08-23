import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesService } from './invoices.service';
import { InvoiceNumberService } from './invoice-number.service';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../../database/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ChargeType, InvoiceStatus } from '@propertyos/types';
import { Prisma } from '@prisma/client';

describe('InvoicesService', () => {
  let service: InvoicesService;
  let prisma: any;
  let ledgerService: any;
  let invoiceNumberService: any;

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
      tenant: {
        findFirst: jest.fn(),
      },
      property: {
        findFirst: jest.fn(),
      },
      invoice: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      invoiceLine: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    ledgerService = {
      recordTransaction: jest.fn().mockResolvedValue([]),
    };

    invoiceNumberService = {
      generateInvoiceNumber: jest.fn().mockResolvedValue('INV-2026-000001'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: PrismaService, useValue: prisma },
        { provide: LedgerService, useValue: ledgerService },
        { provide: InvoiceNumberService, useValue: invoiceNumberService },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create an invoice with accurate decimal calculations and DRAFT status', async () => {
    const orgId = 'org-1';
    const tenantId = 'tenant-1';

    prisma.tenant.findFirst.mockResolvedValue({ id: tenantId, organizationId: orgId });
    prisma.invoice.create.mockImplementation(({ data }: any) =>
      Promise.resolve({
        id: 'inv-1',
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
        lines: [
          {
            id: 'line-1',
            invoiceId: 'inv-1',
            chargeType: ChargeType.RENT,
            description: 'Monthly Rent',
            quantity: new Prisma.Decimal(1),
            unitAmount: new Prisma.Decimal('10000.00'),
            totalAmount: new Prisma.Decimal('10000.00'),
            createdAt: new Date(),
          },
        ],
      })
    );

    const result = await service.createInvoice(orgId, {
      tenantId,
      issueDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 86400000 * 5).toISOString(),
      lines: [
        {
          chargeType: ChargeType.RENT,
          description: 'Monthly Rent',
          quantity: 1,
          unitAmount: '10000.00',
        },
      ],
      adjustments: '500.00',
    });

    expect(result.invoiceNumber).toBe('INV-2026-000001');
    expect(result.status).toBe(InvoiceStatus.DRAFT);
    expect(result.subtotal).toBe('10000');
    expect(result.totalAmount).toBe('10500');
    expect(result.outstandingAmount).toBe('10500');
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('should issue a DRAFT invoice, transition status to ISSUED, and record balanced ledger entries', async () => {
    const orgId = 'org-1';
    const invoiceId = 'inv-1';

    prisma.invoice.findFirst.mockResolvedValue({
      id: invoiceId,
      organizationId: orgId,
      tenantId: 'tenant-1',
      invoiceNumber: 'INV-2026-000001',
      status: InvoiceStatus.DRAFT,
      subtotal: new Prisma.Decimal('10000.00'),
      adjustments: new Prisma.Decimal('0.00'),
      totalAmount: new Prisma.Decimal('10000.00'),
      paidAmount: new Prisma.Decimal('0.00'),
      outstandingAmount: new Prisma.Decimal('10000.00'),
      issueDate: new Date(),
      dueDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      lines: [
        {
          id: 'line-1',
          chargeType: ChargeType.RENT,
          description: 'Monthly Rent',
          quantity: new Prisma.Decimal(1),
          unitAmount: new Prisma.Decimal('10000.00'),
          totalAmount: new Prisma.Decimal('10000.00'),
          createdAt: new Date(),
        },
      ],
    });

    prisma.invoice.update.mockResolvedValue({
      id: invoiceId,
      organizationId: orgId,
      tenantId: 'tenant-1',
      invoiceNumber: 'INV-2026-000001',
      status: InvoiceStatus.ISSUED,
      subtotal: new Prisma.Decimal('10000.00'),
      adjustments: new Prisma.Decimal('0.00'),
      totalAmount: new Prisma.Decimal('10000.00'),
      paidAmount: new Prisma.Decimal('0.00'),
      outstandingAmount: new Prisma.Decimal('10000.00'),
      issueDate: new Date(),
      dueDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      lines: [],
    });

    const result = await service.issueInvoice(orgId, invoiceId);
    expect(result.status).toBe(InvoiceStatus.ISSUED);
    expect(ledgerService.recordTransaction).toHaveBeenCalled();
  });

  it('should reject voiding a PAID invoice', async () => {
    const orgId = 'org-1';
    const invoiceId = 'inv-1';

    prisma.invoice.findFirst.mockResolvedValue({
      id: invoiceId,
      organizationId: orgId,
      status: InvoiceStatus.PAID,
    });

    await expect(service.voidInvoice(orgId, invoiceId)).rejects.toThrow(
      BadRequestException
    );
  });
});
