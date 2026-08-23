import { Test, TestingModule } from '@nestjs/testing';
import { MealsService } from './meals.service';
import { PrismaService } from '../../database/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  MealType,
  MealPlanStatus,
  MealSubscriptionStatus,
  MealRecordStatus,
  MealBillingMode,
  PropertyType,
  CheckInStatus,
} from '@propertyos/types';
import { Prisma } from '@prisma/client';

describe('MealsService', () => {
  let service: MealsService;
  let prisma: any;
  let invoicesService: any;

  const mockOrgId = 'org-123';
  const mockPropertyId = 'prop-123';
  const mockUserId = 'user-123';

  beforeEach(async () => {
    prisma = {
      property: {
        findFirst: jest.fn(),
      },
      tenant: {
        findFirst: jest.fn(),
      },
      checkIn: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      mealPlan: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      mealSubscription: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      mealRecord: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
        count: jest.fn(),
      },
      mealCharge: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    invoicesService = {
      createInvoice: jest.fn(),
      issueInvoice: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MealsService,
        { provide: PrismaService, useValue: prisma },
        { provide: InvoicesService, useValue: invoicesService },
      ],
    }).compile();

    service = module.get<MealsService>(MealsService);
  });

  describe('validateProperty', () => {
    it('should throw NotFoundException if property does not exist', async () => {
      prisma.property.findFirst.mockResolvedValue(null);
      await expect(service.validateProperty(mockOrgId, 'invalid-id')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw NotFoundException if property is whole-unit rental', async () => {
      prisma.property.findFirst.mockResolvedValue({
        id: mockPropertyId,
        propertyType: PropertyType.RENTAL_HOUSE,
      });
      await expect(service.validateProperty(mockOrgId, mockPropertyId)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should succeed for PG property', async () => {
      const prop = { id: mockPropertyId, propertyType: PropertyType.PG };
      prisma.property.findFirst.mockResolvedValue(prop);
      const res = await service.validateProperty(mockOrgId, mockPropertyId);
      expect(res).toEqual(prop);
    });
  });

  describe('createPlan', () => {
    it('should create meal plan with decimal price', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, propertyType: PropertyType.PG });
      const created = {
        id: 'plan-1',
        organizationId: mockOrgId,
        propertyId: mockPropertyId,
        name: 'Full 3-Meal Plan',
        price: new Prisma.Decimal('3500.00'),
        billingFrequency: 'MONTHLY',
        status: MealPlanStatus.ACTIVE,
        hasBreakfast: true,
        hasLunch: true,
        hasDinner: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.mealPlan.create.mockResolvedValue(created);

      const res = await service.createPlan(
        mockOrgId,
        mockPropertyId,
        { name: 'Full 3-Meal Plan', price: 3500 },
        mockUserId
      );

      expect(res.name).toBe('Full 3-Meal Plan');
      expect(res.price).toBe(3500);
      expect(prisma.mealPlan.create).toHaveBeenCalled();
    });
  });

  describe('createSubscription', () => {
    it('should prevent overlapping active subscriptions for tenant', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, propertyType: PropertyType.PG });
      prisma.tenant.findFirst.mockResolvedValue({ id: 'tenant-1', organizationId: mockOrgId });
      prisma.checkIn.findFirst.mockResolvedValue({ id: 'checkin-1', status: CheckInStatus.CHECKED_IN });
      prisma.mealPlan.findFirst.mockResolvedValue({ id: 'plan-1', status: MealPlanStatus.ACTIVE });
      prisma.mealSubscription.findFirst.mockResolvedValue({ id: 'existing-sub-1', status: MealSubscriptionStatus.ACTIVE });

      await expect(
        service.createSubscription(
          mockOrgId,
          mockPropertyId,
          { tenantId: 'tenant-1', mealPlanId: 'plan-1', startDate: '2026-08-01' },
          mockUserId
        )
      ).rejects.toThrow(ConflictException);
    });

    it('should reject subscription if tenant is not actively checked in', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, propertyType: PropertyType.PG });
      prisma.tenant.findFirst.mockResolvedValue({ id: 'tenant-1', organizationId: mockOrgId });
      prisma.checkIn.findFirst.mockResolvedValue(null); // not checked in

      await expect(
        service.createSubscription(
          mockOrgId,
          mockPropertyId,
          { tenantId: 'tenant-1', mealPlanId: 'plan-1', startDate: '2026-08-01' },
          mockUserId
        )
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('recordAttendance', () => {
    it('should record breakfast attendance successfully', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, propertyType: PropertyType.PG });
      prisma.tenant.findFirst.mockResolvedValue({ id: 'tenant-1', organizationId: mockOrgId });
      prisma.mealRecord.findUnique.mockResolvedValue(null);

      const created = {
        id: 'record-1',
        organizationId: mockOrgId,
        propertyId: mockPropertyId,
        tenantId: 'tenant-1',
        mealDate: new Date('2026-08-15T00:00:00Z'),
        mealType: MealType.BREAKFAST,
        status: MealRecordStatus.CONSUMED,
        recordedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.mealRecord.create.mockResolvedValue(created);

      const res = await service.recordAttendance(
        mockOrgId,
        mockPropertyId,
        {
          tenantId: 'tenant-1',
          mealDate: '2026-08-15',
          mealType: MealType.BREAKFAST,
          status: MealRecordStatus.CONSUMED,
        },
        mockUserId
      );

      expect(res.mealType).toBe(MealType.BREAKFAST);
      expect(res.status).toBe(MealRecordStatus.CONSUMED);
    });
  });
});
