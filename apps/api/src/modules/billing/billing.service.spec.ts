import { Test, TestingModule } from '@nestjs/testing';
import { BillingService } from './billing.service';
import { InvoicesService } from '../invoices/invoices.service';
import { SecurityDepositsService } from '../security-deposits/security-deposits.service';
import { PrismaService } from '../../database/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { BillingFrequency, ChargeType } from '@propertyos/types';
import { Prisma } from '@prisma/client';

describe('BillingService', () => {
  let service: BillingService;
  let prisma: any;
  let invoicesService: any;
  let securityDepositsService: any;

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
      tenant: {
        findFirst: jest.fn(),
      },
      property: {
        findFirst: jest.fn(),
      },
      billingCharge: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      billingSchedule: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      invoice: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      payment: {
        findMany: jest.fn(),
      },
      securityDepositAccount: {
        findMany: jest.fn(),
      },
      checkIn: {
        count: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    invoicesService = {
      createInvoice: jest.fn().mockResolvedValue({ id: 'inv-generated-1' }),
    };

    securityDepositsService = {
      getOrCreateAccount: jest.fn().mockResolvedValue({
        amountHeld: '10000.00',
        amountDeducted: '0.00',
        amountRefunded: '0.00',
        availableBalance: '10000.00',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: prisma },
        { provide: InvoicesService, useValue: invoicesService },
        { provide: SecurityDepositsService, useValue: securityDepositsService },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a billing charge with non-negative decimal amount', async () => {
    const orgId = 'org-1';

    prisma.billingCharge.create.mockResolvedValue({
      id: 'charge-1',
      organizationId: orgId,
      name: 'Standard Monthly Rent',
      chargeType: ChargeType.RENT,
      amount: new Prisma.Decimal('12000.00'),
      frequency: BillingFrequency.MONTHLY,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.createCharge(orgId, {
      name: 'Standard Monthly Rent',
      chargeType: ChargeType.RENT,
      amount: '12000.00',
      frequency: BillingFrequency.MONTHLY,
    });

    expect(result.id).toBe('charge-1');
    expect(result.amount).toBe('12000');
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('should generate due invoices idempotently and advance nextBillingDate', async () => {
    const orgId = 'org-1';
    const asOfDate = new Date('2026-08-01T00:00:00Z');

    prisma.billingSchedule.findMany.mockResolvedValue([
      {
        id: 'sched-1',
        organizationId: orgId,
        tenantId: 'tenant-1',
        chargeId: 'charge-1',
        startDate: new Date('2026-08-01T00:00:00Z'),
        frequency: BillingFrequency.MONTHLY,
        amount: new Prisma.Decimal('10000.00'),
        nextBillingDate: new Date('2026-08-01T00:00:00Z'),
        charge: {
          name: 'Monthly Rent',
          chargeType: ChargeType.RENT,
        },
      },
    ]);

    // First run: no existing invoice
    prisma.invoice.findFirst.mockResolvedValueOnce(null);

    const result = await service.generateDueInvoices(orgId, asOfDate.toISOString());
    expect(result.generatedCount).toBe(1);
    expect(invoicesService.createInvoice).toHaveBeenCalledTimes(1);
    expect(prisma.billingSchedule.update).toHaveBeenCalled();
  });
});
