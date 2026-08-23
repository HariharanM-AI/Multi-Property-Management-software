import { Test, TestingModule } from '@nestjs/testing';
import { SecurityDepositsService } from './security-deposits.service';
import { PrismaService } from '../../database/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('SecurityDepositsService', () => {
  let service: SecurityDepositsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      tenant: {
        findFirst: jest.fn(),
      },
      securityDepositAccount: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecurityDepositsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<SecurityDepositsService>(SecurityDepositsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should update deposit and enforce invariant: amountRefunded + amountDeducted <= amountHeld', async () => {
    const orgId = 'org-1';
    const accountId = 'acc-1';

    prisma.securityDepositAccount.findFirst.mockResolvedValue({
      id: accountId,
      organizationId: orgId,
      tenantId: 'tenant-1',
      amountHeld: new Prisma.Decimal('20000.00'),
      amountRefunded: new Prisma.Decimal('0.00'),
      amountDeducted: new Prisma.Decimal('0.00'),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    prisma.securityDepositAccount.update.mockResolvedValue({
      id: accountId,
      organizationId: orgId,
      tenantId: 'tenant-1',
      amountHeld: new Prisma.Decimal('20000.00'),
      amountRefunded: new Prisma.Decimal('15000.00'),
      amountDeducted: new Prisma.Decimal('5000.00'),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.updateDeposit(orgId, accountId, {
      refundAmount: '15000.00',
      deductionAmount: '5000.00',
    });

    expect(result.amountHeld).toBe('20000');
    expect(result.amountRefunded).toBe('15000');
    expect(result.amountDeducted).toBe('5000');
    expect(result.availableBalance).toBe('0');
  });

  it('should reject updates where refund + deduction exceeds held deposit', async () => {
    const orgId = 'org-1';
    const accountId = 'acc-1';

    prisma.securityDepositAccount.findFirst.mockResolvedValue({
      id: accountId,
      organizationId: orgId,
      tenantId: 'tenant-1',
      amountHeld: new Prisma.Decimal('20000.00'),
      amountRefunded: new Prisma.Decimal('0.00'),
      amountDeducted: new Prisma.Decimal('0.00'),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      service.updateDeposit(orgId, accountId, {
        refundAmount: '18000.00',
        deductionAmount: '5000.00', // Total 23000 > 20000
      })
    ).rejects.toThrow(BadRequestException);
  });
});
