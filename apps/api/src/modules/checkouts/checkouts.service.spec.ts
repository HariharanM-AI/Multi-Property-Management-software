import { Test, TestingModule } from '@nestjs/testing';
import { CheckoutsService } from './checkouts.service';
import { SettlementService } from './settlement.service';
import { PrismaService } from '../../database/prisma.service';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  PropertyType,
  BedStatus,
  RentalUnitStatus,
  LeaseStatus,
  TenantStatus,
  CheckoutStatus,
  SettlementStatus,
} from '@propertyos/types';
import { Prisma } from '@prisma/client';

describe('CheckoutsService', () => {
  let service: CheckoutsService;
  let prisma: PrismaService;
  let settlementService: SettlementService;

  const mockOrgId = 'org-12345';
  const mockUserId = 'user-12345';
  const mockPropertyId = 'prop-pg-123';
  const mockRentalPropId = 'prop-rental-123';
  const mockTenantId = 'tenant-123';
  const mockBedId = 'bed-123';
  const mockUnitId = 'unit-123';
  const mockStayId = 'stay-123';
  const mockLeaseId = 'lease-123';
  const mockCheckInId = 'checkin-123';
  const mockCheckoutId = 'checkout-123';

  const mockPrismaService = {
    property: {
      findFirst: jest.fn(),
    },
    tenant: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    bed: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    rentalUnit: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    lease: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    tenantStayHistory: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    checkIn: {
      findFirst: jest.fn(),
    },
    checkout: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    settlement: {
      create: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
    $executeRawUnsafe: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckoutsService,
        SettlementService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CheckoutsService>(CheckoutsService);
    prisma = module.get<PrismaService>(PrismaService);
    settlementService = module.get<SettlementService>(SettlementService);

    jest.clearAllMocks();
  });

  describe('createCheckout', () => {
    it('should initiate a PG checkout with draft settlement', async () => {
      mockPrismaService.property.findFirst.mockResolvedValue({
        id: mockPropertyId,
        organizationId: mockOrgId,
        propertyType: PropertyType.PG,
        deletedAt: null,
      });
      mockPrismaService.tenant.findFirst.mockResolvedValue({
        id: mockTenantId,
        organizationId: mockOrgId,
        deletedAt: null,
      });
      mockPrismaService.tenantStayHistory.findFirst.mockResolvedValue({
        id: mockStayId,
        tenantId: mockTenantId,
        bedId: mockBedId,
        checkInDate: new Date('2026-01-01'),
        checkOutDate: null,
        bed: { id: mockBedId, status: BedStatus.OCCUPIED },
      });
      mockPrismaService.checkIn.findFirst.mockResolvedValue({
        id: mockCheckInId,
      });
      mockPrismaService.checkout.findFirst.mockResolvedValue(null);

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          checkout: {
            create: jest.fn().mockResolvedValue({ id: mockCheckoutId }),
            findUnique: jest.fn().mockResolvedValue({
              id: mockCheckoutId,
              organizationId: mockOrgId,
              tenantId: mockTenantId,
              propertyId: mockPropertyId,
              checkoutDate: new Date('2026-06-30'),
              status: CheckoutStatus.INITIATED,
              settlement: {
                id: 'settlement-123',
                securityDeposit: new Prisma.Decimal(0),
                outstandingRent: new Prisma.Decimal(0),
                maintenanceCharges: new Prisma.Decimal(0),
                deductions: new Prisma.Decimal(0),
                refundableAmount: new Prisma.Decimal(0),
                amountDue: new Prisma.Decimal(0),
                amountRefundable: new Prisma.Decimal(0),
                status: SettlementStatus.DRAFT,
              },
            }),
          },
          settlement: {
            create: jest.fn().mockResolvedValue({ id: 'settlement-123' }),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
          },
        });
      });

      const result = await service.createCheckout(
        mockOrgId,
        mockPropertyId,
        {
          tenantId: mockTenantId,
          checkoutDate: '2026-06-30',
          reason: 'End of internship',
        },
        mockUserId
      );

      expect(result.id).toBe(mockCheckoutId);
      expect(result.status).toBe(CheckoutStatus.INITIATED);
      expect(result.settlement?.status).toBe(SettlementStatus.DRAFT);
    });

    it('should reject checkout if checkoutDate is earlier than checkInDate', async () => {
      mockPrismaService.property.findFirst.mockResolvedValue({
        id: mockPropertyId,
        organizationId: mockOrgId,
        propertyType: PropertyType.PG,
        deletedAt: null,
      });
      mockPrismaService.tenant.findFirst.mockResolvedValue({
        id: mockTenantId,
        organizationId: mockOrgId,
        deletedAt: null,
      });
      mockPrismaService.tenantStayHistory.findFirst.mockResolvedValue({
        id: mockStayId,
        tenantId: mockTenantId,
        bedId: mockBedId,
        checkInDate: new Date('2026-03-01'),
        checkOutDate: null,
        bed: { id: mockBedId, status: BedStatus.OCCUPIED },
      });
      mockPrismaService.checkIn.findFirst.mockResolvedValue(null);
      mockPrismaService.checkout.findFirst.mockResolvedValue(null);

      // Attempting checkout date before check-in date (2026-02-01 < 2026-03-01)
      await expect(
        service.createCheckout(
          mockOrgId,
          mockPropertyId,
          {
            tenantId: mockTenantId,
            checkoutDate: '2026-02-01',
          },
          mockUserId
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject checkout if tenant has no active stay', async () => {
      mockPrismaService.property.findFirst.mockResolvedValue({
        id: mockPropertyId,
        organizationId: mockOrgId,
        propertyType: PropertyType.PG,
        deletedAt: null,
      });
      mockPrismaService.tenant.findFirst.mockResolvedValue({
        id: mockTenantId,
        organizationId: mockOrgId,
        deletedAt: null,
      });
      mockPrismaService.tenantStayHistory.findFirst.mockResolvedValue(null);

      await expect(
        service.createCheckout(
          mockOrgId,
          mockPropertyId,
          {
            tenantId: mockTenantId,
            checkoutDate: '2026-06-30',
          },
          mockUserId
        )
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateSettlement', () => {
    it('should update settlement deductions and transition status', async () => {
      mockPrismaService.checkout.findFirst.mockResolvedValue({
        id: mockCheckoutId,
        organizationId: mockOrgId,
        status: CheckoutStatus.INITIATED,
        settlement: {
          id: 'settlement-123',
          securityDeposit: new Prisma.Decimal(50000),
          outstandingRent: new Prisma.Decimal(0),
          maintenanceCharges: new Prisma.Decimal(0),
          deductions: new Prisma.Decimal(0),
        },
      });

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          settlement: {
            update: jest.fn().mockResolvedValue({ id: 'settlement-123' }),
          },
          checkout: {
            update: jest.fn().mockResolvedValue({ id: mockCheckoutId }),
            findUnique: jest.fn().mockResolvedValue({
              id: mockCheckoutId,
              organizationId: mockOrgId,
              status: CheckoutStatus.SETTLEMENT_PENDING,
              settlement: {
                id: 'settlement-123',
                securityDeposit: new Prisma.Decimal(50000),
                outstandingRent: new Prisma.Decimal(5000),
                maintenanceCharges: new Prisma.Decimal(1000),
                deductions: new Prisma.Decimal(4000),
                refundableAmount: new Prisma.Decimal(46000),
                amountDue: new Prisma.Decimal(0),
                amountRefundable: new Prisma.Decimal(40000),
                status: SettlementStatus.DRAFT,
              },
            }),
          },
          auditLog: {
            create: jest.fn(),
          },
        });
      });

      const result = await service.updateSettlement(
        mockOrgId,
        mockCheckoutId,
        {
          outstandingRent: 5000,
          maintenanceCharges: 1000,
          deductions: 4000,
        },
        mockUserId
      );

      expect(result.settlement?.amountRefundable).toBe(40000);
      expect(result.settlement?.amountDue).toBe(0);
    });

    it('should reject update on completed checkout', async () => {
      mockPrismaService.checkout.findFirst.mockResolvedValue({
        id: mockCheckoutId,
        organizationId: mockOrgId,
        status: CheckoutStatus.COMPLETED,
        settlement: { id: 'settlement-123' },
      });

      await expect(
        service.updateSettlement(mockOrgId, mockCheckoutId, { deductions: 500 }, mockUserId)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('completeCheckout', () => {
    it('should release PG occupancy, close stay history and finalize settlement inside transaction', async () => {
      mockPrismaService.checkout.findFirst.mockResolvedValue({
        id: mockCheckoutId,
        organizationId: mockOrgId,
        tenantId: mockTenantId,
        propertyId: mockPropertyId,
        bedId: mockBedId,
        stayHistoryId: mockStayId,
        checkoutDate: new Date('2026-06-30'),
        status: CheckoutStatus.READY,
        property: { id: mockPropertyId, propertyType: PropertyType.PG },
        settlement: { id: 'settlement-123', amountDue: new Prisma.Decimal(0), amountRefundable: new Prisma.Decimal(20000) },
      });

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          $executeRawUnsafe: jest.fn().mockResolvedValue(1),
          checkout: {
            findUnique: jest.fn().mockResolvedValue({
              id: mockCheckoutId,
              status: CheckoutStatus.READY,
            }),
            update: jest.fn().mockResolvedValue({
              id: mockCheckoutId,
              organizationId: mockOrgId,
              status: CheckoutStatus.COMPLETED,
              completedAt: new Date(),
              settlement: {
                id: 'settlement-123',
                status: SettlementStatus.FINALIZED,
                securityDeposit: new Prisma.Decimal(20000),
                outstandingRent: new Prisma.Decimal(0),
                maintenanceCharges: new Prisma.Decimal(0),
                deductions: new Prisma.Decimal(0),
                refundableAmount: new Prisma.Decimal(20000),
                amountDue: new Prisma.Decimal(0),
                amountRefundable: new Prisma.Decimal(20000),
              },
            }),
          },
          bed: {
            findUnique: jest.fn().mockResolvedValue({
              id: mockBedId,
              status: BedStatus.OCCUPIED,
            }),
            update: jest.fn().mockResolvedValue({ id: mockBedId, status: BedStatus.AVAILABLE }),
          },
          tenantStayHistory: {
            update: jest.fn().mockResolvedValue({ id: mockStayId }),
          },
          tenant: {
            update: jest.fn().mockResolvedValue({ id: mockTenantId, status: TenantStatus.CHECKED_OUT }),
          },
          settlement: {
            update: jest.fn().mockResolvedValue({ id: 'settlement-123', status: SettlementStatus.FINALIZED }),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
          },
        };
        return callback(mockTx);
      });

      const result = await service.completeCheckout(mockOrgId, mockCheckoutId, mockUserId);

      expect(result.status).toBe(CheckoutStatus.COMPLETED);
      expect(result.settlement?.status).toBe(SettlementStatus.FINALIZED);
    });

    it('should handle natural Whole-Unit checkout transition to EXPIRED', async () => {
      mockPrismaService.checkout.findFirst.mockResolvedValue({
        id: mockCheckoutId,
        organizationId: mockOrgId,
        tenantId: mockTenantId,
        propertyId: mockRentalPropId,
        rentalUnitId: mockUnitId,
        leaseId: mockLeaseId,
        checkoutDate: new Date('2026-12-31'), // Natural end
        status: CheckoutStatus.READY,
        property: { id: mockRentalPropId, propertyType: PropertyType.RENTAL_HOUSE },
        settlement: { id: 'settlement-123' },
      });

      let capturedLeaseStatus: string | null = null;

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          $executeRawUnsafe: jest.fn().mockResolvedValue(1),
          checkout: {
            findUnique: jest.fn().mockResolvedValue({ id: mockCheckoutId, status: CheckoutStatus.READY }),
            update: jest.fn().mockResolvedValue({
              id: mockCheckoutId,
              organizationId: mockOrgId,
              status: CheckoutStatus.COMPLETED,
              completedAt: new Date(),
              settlement: { id: 'settlement-123', status: SettlementStatus.FINALIZED, securityDeposit: 0, outstandingRent: 0, maintenanceCharges: 0, deductions: 0, refundableAmount: 0, amountDue: 0, amountRefundable: 0 },
            }),
          },
          rentalUnit: {
            findUnique: jest.fn().mockResolvedValue({ id: mockUnitId, status: RentalUnitStatus.OCCUPIED }),
            update: jest.fn().mockResolvedValue({ id: mockUnitId, status: RentalUnitStatus.AVAILABLE }),
          },
          lease: {
            findUnique: jest.fn().mockResolvedValue({
              id: mockLeaseId,
              status: LeaseStatus.ACTIVE,
              endDate: new Date('2026-12-31'),
            }),
            update: jest.fn().mockImplementation(({ data }) => {
              capturedLeaseStatus = data.status;
              return { id: mockLeaseId, status: data.status };
            }),
          },
          tenant: {
            update: jest.fn().mockResolvedValue({ id: mockTenantId, status: TenantStatus.CHECKED_OUT }),
          },
          settlement: {
            update: jest.fn().mockResolvedValue({ id: 'settlement-123', status: SettlementStatus.FINALIZED }),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
          },
        };
        return callback(mockTx);
      });

      const result = await service.completeCheckout(mockOrgId, mockCheckoutId, mockUserId);

      expect(result.status).toBe(CheckoutStatus.COMPLETED);
      expect(capturedLeaseStatus).toBe(LeaseStatus.EXPIRED);
    });

    it('should handle early Whole-Unit checkout transition to TERMINATED', async () => {
      mockPrismaService.checkout.findFirst.mockResolvedValue({
        id: mockCheckoutId,
        organizationId: mockOrgId,
        tenantId: mockTenantId,
        propertyId: mockRentalPropId,
        rentalUnitId: mockUnitId,
        leaseId: mockLeaseId,
        checkoutDate: new Date('2026-06-30'), // Early termination (before 2026-12-31)
        status: CheckoutStatus.READY,
        property: { id: mockRentalPropId, propertyType: PropertyType.RENTAL_HOUSE },
        settlement: { id: 'settlement-123' },
      });

      let capturedLeaseStatus: string | null = null;

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          $executeRawUnsafe: jest.fn().mockResolvedValue(1),
          checkout: {
            findUnique: jest.fn().mockResolvedValue({ id: mockCheckoutId, status: CheckoutStatus.READY }),
            update: jest.fn().mockResolvedValue({
              id: mockCheckoutId,
              organizationId: mockOrgId,
              status: CheckoutStatus.COMPLETED,
              completedAt: new Date(),
              settlement: { id: 'settlement-123', status: SettlementStatus.FINALIZED, securityDeposit: 0, outstandingRent: 0, maintenanceCharges: 0, deductions: 0, refundableAmount: 0, amountDue: 0, amountRefundable: 0 },
            }),
          },
          rentalUnit: {
            findUnique: jest.fn().mockResolvedValue({ id: mockUnitId, status: RentalUnitStatus.OCCUPIED }),
            update: jest.fn().mockResolvedValue({ id: mockUnitId, status: RentalUnitStatus.AVAILABLE }),
          },
          lease: {
            findUnique: jest.fn().mockResolvedValue({
              id: mockLeaseId,
              status: LeaseStatus.ACTIVE,
              endDate: new Date('2026-12-31'),
            }),
            update: jest.fn().mockImplementation(({ data }) => {
              capturedLeaseStatus = data.status;
              return { id: mockLeaseId, status: data.status };
            }),
          },
          tenant: {
            update: jest.fn().mockResolvedValue({ id: mockTenantId, status: TenantStatus.CHECKED_OUT }),
          },
          settlement: {
            update: jest.fn().mockResolvedValue({ id: 'settlement-123', status: SettlementStatus.FINALIZED }),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
          },
        };
        return callback(mockTx);
      });

      const result = await service.completeCheckout(mockOrgId, mockCheckoutId, mockUserId);

      expect(result.status).toBe(CheckoutStatus.COMPLETED);
      expect(capturedLeaseStatus).toBe(LeaseStatus.TERMINATED);
    });

    it('should reject completion if unit/bed is no longer occupied (concurrency collision)', async () => {
      mockPrismaService.checkout.findFirst.mockResolvedValue({
        id: mockCheckoutId,
        organizationId: mockOrgId,
        tenantId: mockTenantId,
        propertyId: mockPropertyId,
        bedId: mockBedId,
        status: CheckoutStatus.READY,
        property: { id: mockPropertyId, propertyType: PropertyType.PG },
        settlement: { id: 'settlement-123' },
      });

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          $executeRawUnsafe: jest.fn().mockResolvedValue(1),
          checkout: {
            findUnique: jest.fn().mockResolvedValue({ id: mockCheckoutId, status: CheckoutStatus.READY }),
          },
          bed: {
            findUnique: jest.fn().mockResolvedValue({ id: mockBedId, status: BedStatus.AVAILABLE }), // already available
          },
        };
        return callback(mockTx);
      });

      await expect(service.completeCheckout(mockOrgId, mockCheckoutId, mockUserId)).rejects.toThrow(
        ConflictException
      );
    });
  });

  describe('cancelCheckout', () => {
    it('should cancel pending checkout successfully', async () => {
      mockPrismaService.checkout.findFirst.mockResolvedValue({
        id: mockCheckoutId,
        organizationId: mockOrgId,
        status: CheckoutStatus.INITIATED,
        settlement: { id: 'settlement-123' },
      });

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          checkout: {
            update: jest.fn().mockResolvedValue({
              id: mockCheckoutId,
              organizationId: mockOrgId,
              status: CheckoutStatus.CANCELLED,
              cancelledAt: new Date(),
              settlement: { id: 'settlement-123', status: SettlementStatus.VOID, securityDeposit: 0, outstandingRent: 0, maintenanceCharges: 0, deductions: 0, refundableAmount: 0, amountDue: 0, amountRefundable: 0 },
            }),
          },
          settlement: {
            update: jest.fn(),
          },
          auditLog: {
            create: jest.fn(),
          },
        });
      });

      const result = await service.cancelCheckout(
        mockOrgId,
        mockCheckoutId,
        { reason: 'Tenant extended stay' },
        mockUserId
      );

      expect(result.status).toBe(CheckoutStatus.CANCELLED);
    });

    it('should reject cancellation if checkout is already COMPLETED', async () => {
      mockPrismaService.checkout.findFirst.mockResolvedValue({
        id: mockCheckoutId,
        organizationId: mockOrgId,
        status: CheckoutStatus.COMPLETED,
      });

      await expect(
        service.cancelCheckout(mockOrgId, mockCheckoutId, { reason: 'Cannot cancel' }, mockUserId)
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject cancellation if checkout is already CANCELLED', async () => {
      mockPrismaService.checkout.findFirst.mockResolvedValue({
        id: mockCheckoutId,
        organizationId: mockOrgId,
        status: CheckoutStatus.CANCELLED,
      });

      await expect(
        service.cancelCheckout(mockOrgId, mockCheckoutId, { reason: 'Cannot cancel' }, mockUserId)
      ).rejects.toThrow(BadRequestException);
    });
  });
});
