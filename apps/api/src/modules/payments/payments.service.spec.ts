import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../../database/prisma.service';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { PaymentMethod, PaymentStatus } from '@propertyos/types';
import { Prisma } from '@prisma/client';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: any;
  let ledgerService: any;

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
      $queryRaw: jest.fn(),
      tenant: {
        findFirst: jest.fn(),
      },
      payment: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      paymentAllocation: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      invoice: {
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    ledgerService = {
      recordTransaction: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: LedgerService, useValue: ledgerService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should record a valid payment and create balanced ledger entries', async () => {
    const orgId = 'org-1';
    const tenantId = 'tenant-1';

    prisma.tenant.findFirst.mockResolvedValue({ id: tenantId, organizationId: orgId });
    prisma.payment.findFirst.mockResolvedValue(null);
    prisma.payment.create.mockResolvedValue({
      id: 'pay-1',
      organizationId: orgId,
      tenantId,
      amount: new Prisma.Decimal('10000.00'),
      paymentMethod: PaymentMethod.UPI,
      referenceNumber: 'UPI-REF-123456',
      paymentDate: new Date(),
      status: PaymentStatus.RECORDED,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    prisma.payment.findUniqueOrThrow.mockResolvedValue({
      id: 'pay-1',
      organizationId: orgId,
      tenantId,
      amount: new Prisma.Decimal('10000.00'),
      paymentMethod: PaymentMethod.UPI,
      referenceNumber: 'UPI-REF-123456',
      paymentDate: new Date(),
      status: PaymentStatus.RECORDED,
      createdAt: new Date(),
      updatedAt: new Date(),
      allocations: [],
    });

    const result = await service.recordPayment(orgId, {
      tenantId,
      amount: '10000.00',
      paymentMethod: PaymentMethod.UPI,
      referenceNumber: 'UPI-REF-123456',
      paymentDate: new Date().toISOString(),
    });

    expect(result.id).toBe('pay-1');
    expect(result.amount).toBe('10000');
    expect(ledgerService.recordTransaction).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('should reject recording duplicate payment with the same referenceNumber', async () => {
    const orgId = 'org-1';
    const tenantId = 'tenant-1';

    prisma.tenant.findFirst.mockResolvedValue({ id: tenantId, organizationId: orgId });
    prisma.payment.findFirst.mockResolvedValue({
      id: 'pay-existing',
      organizationId: orgId,
      referenceNumber: 'UPI-REF-DUPLICATE',
    });

    await expect(
      service.recordPayment(orgId, {
        tenantId,
        amount: '10000.00',
        paymentMethod: PaymentMethod.UPI,
        referenceNumber: 'UPI-REF-DUPLICATE',
        paymentDate: new Date().toISOString(),
      })
    ).rejects.toThrow(ConflictException);
  });

  it('should reject allocation amount greater than unallocated payment amount', async () => {
    const orgId = 'org-1';
    const paymentId = 'pay-1';
    const invoiceId = 'inv-1';

    prisma.$queryRaw.mockResolvedValueOnce([
      {
        id: paymentId,
        tenantId: 'tenant-1',
        amount: '5000.00',
        status: PaymentStatus.RECORDED,
      },
    ]);

    prisma.paymentAllocation.findMany.mockResolvedValueOnce([
      {
        id: 'alloc-1',
        paymentId,
        amount: new Prisma.Decimal('3000.00'),
        status: 'ACTIVE',
      },
    ]);

    await expect(
      service.allocatePayment(orgId, paymentId, {
        invoiceId,
        amount: '3000.00', // Only 2000 is available
      })
    ).rejects.toThrow(BadRequestException);
  });
});
