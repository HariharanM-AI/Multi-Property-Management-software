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
  MealChargeStatus,
  MealBillingMode,
  PropertyType,
  CheckInStatus,
  BillingFrequency,
} from '@propertyos/types';
import { Prisma } from '@prisma/client';

describe('MealsService (CORE-015 Hardening Pass)', () => {
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
      $executeRaw: jest.fn().mockResolvedValue(1),
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

  describe('validateProperty (Operating Model & Tenant Isolation)', () => {
    it('should throw NotFoundException if property does not exist', async () => {
      prisma.property.findFirst.mockResolvedValue(null);
      await expect(service.validateProperty(mockOrgId, 'invalid-id')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw NotFoundException if property belongs to whole-unit rental model', async () => {
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

  describe('createPlan (Validation & Concurrency Hardening)', () => {
    it('should throw BadRequestException for non-positive price', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, propertyType: PropertyType.PG });
      await expect(
        service.createPlan(
          mockOrgId,
          mockPropertyId,
          { name: 'Zero Plan', price: 0 },
          mockUserId
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if all meal flags are false', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, propertyType: PropertyType.PG });
      await expect(
        service.createPlan(
          mockOrgId,
          mockPropertyId,
          {
            name: 'No Meals Plan',
            price: 2000,
            hasBreakfast: false,
            hasLunch: false,
            hasDinner: false,
          },
          mockUserId
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if effectiveTo is earlier than effectiveFrom', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, propertyType: PropertyType.PG });
      await expect(
        service.createPlan(
          mockOrgId,
          mockPropertyId,
          {
            name: 'Invalid Date Plan',
            price: 2000,
            effectiveFrom: '2026-09-01',
            effectiveTo: '2026-08-01',
          },
          mockUserId
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if plan with same name already exists in property', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, propertyType: PropertyType.PG });
      prisma.mealPlan.findFirst.mockResolvedValue({ id: 'existing-plan-1', name: 'Standard Plan' });

      await expect(
        service.createPlan(
          mockOrgId,
          mockPropertyId,
          { name: 'Standard Plan', price: 3000 },
          mockUserId
        )
      ).rejects.toThrow(ConflictException);
    });

    it('should acquire advisory lock, create plan with decimal price and audit log', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, propertyType: PropertyType.PG });
      prisma.mealPlan.findFirst.mockResolvedValue(null);

      const created = {
        id: 'plan-1',
        organizationId: mockOrgId,
        propertyId: mockPropertyId,
        name: 'Full 3-Meal Plan',
        price: new Prisma.Decimal('3500.00'),
        billingFrequency: BillingFrequency.MONTHLY,
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
      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(prisma.mealPlan.create).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('updatePlan', () => {
    it('should throw BadRequestException if update turns all meal flags false', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, propertyType: PropertyType.PG });
      prisma.mealPlan.findFirst.mockResolvedValue({
        id: 'plan-1',
        hasBreakfast: true,
        hasLunch: false,
        hasDinner: false,
      });

      await expect(
        service.updatePlan(
          mockOrgId,
          mockPropertyId,
          'plan-1',
          { hasBreakfast: false },
          mockUserId
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should update plan price and status successfully', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, propertyType: PropertyType.PG });
      prisma.mealPlan.findFirst.mockResolvedValue({
        id: 'plan-1',
        hasBreakfast: true,
        hasLunch: true,
        hasDinner: true,
      });

      const updated = {
        id: 'plan-1',
        organizationId: mockOrgId,
        propertyId: mockPropertyId,
        name: 'Updated Plan',
        price: new Prisma.Decimal('4000.00'),
        billingFrequency: BillingFrequency.MONTHLY,
        status: MealPlanStatus.INACTIVE,
        hasBreakfast: true,
        hasLunch: true,
        hasDinner: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.mealPlan.update.mockResolvedValue(updated);

      const res = await service.updatePlan(
        mockOrgId,
        mockPropertyId,
        'plan-1',
        { price: 4000, status: MealPlanStatus.INACTIVE },
        mockUserId
      );

      expect(res.price).toBe(4000);
      expect(res.status).toBe(MealPlanStatus.INACTIVE);
    });
  });

  describe('createSubscription (Validation & Overlap Hardening)', () => {
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

    it('should reject subscription if meal plan is not found or inactive', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, propertyType: PropertyType.PG });
      prisma.tenant.findFirst.mockResolvedValue({ id: 'tenant-1', organizationId: mockOrgId });
      prisma.checkIn.findFirst.mockResolvedValue({ id: 'checkin-1', status: CheckInStatus.CHECKED_IN });
      prisma.mealPlan.findFirst.mockResolvedValue(null); // inactive or not found

      await expect(
        service.createSubscription(
          mockOrgId,
          mockPropertyId,
          { tenantId: 'tenant-1', mealPlanId: 'plan-1', startDate: '2026-08-01' },
          mockUserId
        )
      ).rejects.toThrow(NotFoundException);
    });

    it('should prevent overlapping active subscriptions for same tenant', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, propertyType: PropertyType.PG });
      prisma.tenant.findFirst.mockResolvedValue({ id: 'tenant-1', organizationId: mockOrgId });
      prisma.checkIn.findFirst.mockResolvedValue({ id: 'checkin-1', status: CheckInStatus.CHECKED_IN });
      prisma.mealPlan.findFirst.mockResolvedValue({ id: 'plan-1', status: MealPlanStatus.ACTIVE });
      prisma.mealSubscription.findMany.mockResolvedValue([
        {
          id: 'existing-sub-1',
          startDate: new Date('2026-08-01'),
          endDate: new Date('2026-08-31'),
          status: MealSubscriptionStatus.ACTIVE,
        },
      ]);

      await expect(
        service.createSubscription(
          mockOrgId,
          mockPropertyId,
          { tenantId: 'tenant-1', mealPlanId: 'plan-1', startDate: '2026-08-15', endDate: '2026-09-15' },
          mockUserId
        )
      ).rejects.toThrow(ConflictException);
    });

    it('should acquire advisory lock and create subscription when non-overlapping', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, propertyType: PropertyType.PG });
      prisma.tenant.findFirst.mockResolvedValue({ id: 'tenant-1', organizationId: mockOrgId });
      prisma.checkIn.findFirst.mockResolvedValue({ id: 'checkin-1', status: CheckInStatus.CHECKED_IN });
      prisma.mealPlan.findFirst.mockResolvedValue({ id: 'plan-1', status: MealPlanStatus.ACTIVE });
      prisma.mealSubscription.findMany.mockResolvedValue([]); // No overlapping active subs

      const created = {
        id: 'sub-1',
        organizationId: mockOrgId,
        propertyId: mockPropertyId,
        tenantId: 'tenant-1',
        mealPlanId: 'plan-1',
        startDate: new Date('2026-08-01'),
        endDate: null,
        status: MealSubscriptionStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.mealSubscription.create.mockResolvedValue(created);

      const res = await service.createSubscription(
        mockOrgId,
        mockPropertyId,
        { tenantId: 'tenant-1', mealPlanId: 'plan-1', startDate: '2026-08-01' },
        mockUserId
      );

      expect(res.id).toBe('sub-1');
      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(prisma.mealSubscription.create).toHaveBeenCalled();
    });
  });

  describe('attendance and bulk recording', () => {
    it('should reject single attendance if tenant is not checked in', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, propertyType: PropertyType.PG });
      prisma.tenant.findFirst.mockResolvedValue({ id: 'tenant-1', organizationId: mockOrgId });
      prisma.checkIn.findFirst.mockResolvedValue(null);

      await expect(
        service.recordAttendance(
          mockOrgId,
          mockPropertyId,
          {
            tenantId: 'tenant-1',
            mealDate: '2026-08-15',
            mealType: MealType.BREAKFAST,
            status: MealRecordStatus.CONSUMED,
          },
          mockUserId
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject bulk attendance if any tenant in batch is not checked in (atomicity)', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, propertyType: PropertyType.PG });
      prisma.checkIn.findFirst
        .mockResolvedValueOnce({ id: 'checkin-1' })
        .mockResolvedValueOnce(null); // Second tenant not checked in

      await expect(
        service.bulkRecordAttendance(
          mockOrgId,
          mockPropertyId,
          {
            mealDate: '2026-08-15',
            mealType: MealType.BREAKFAST,
            records: [
              { tenantId: 'tenant-1', status: MealRecordStatus.CONSUMED },
              { tenantId: 'tenant-2', status: MealRecordStatus.CONSUMED },
            ],
          },
          mockUserId
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should bulk upsert attendance atomically when all valid', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, propertyType: PropertyType.PG });
      prisma.checkIn.findFirst.mockResolvedValue({ id: 'checkin-valid' });
      prisma.mealRecord.upsert.mockResolvedValue({});

      const res = await service.bulkRecordAttendance(
        mockOrgId,
        mockPropertyId,
        {
          mealDate: '2026-08-15',
          mealType: MealType.LUNCH,
          records: [
            { tenantId: 'tenant-1', status: MealRecordStatus.CONSUMED },
            { tenantId: 'tenant-2', status: MealRecordStatus.SKIPPED },
          ],
        },
        mockUserId
      );

      expect(res.count).toBe(2);
      expect(prisma.mealRecord.upsert).toHaveBeenCalledTimes(2);
    });
  });

  describe('generateCharges (Concurrency & Transaction Propagation Hardening)', () => {
    it('should acquire advisory lock, generate charges, and propagate tx to InvoicesService', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, propertyType: PropertyType.PG });
      prisma.mealSubscription.findMany.mockResolvedValue([
        {
          id: 'sub-1',
          tenantId: 'tenant-1',
          mealPlanId: 'plan-1',
          mealPlan: { name: 'Full Board', price: new Prisma.Decimal('3000.00') },
          tenant: { id: 'tenant-1', firstName: 'John', lastName: 'Doe', phone: '9845011111' },
        },
      ]);
      prisma.mealCharge.findFirst.mockResolvedValue(null); // No existing charge

      const createdCharge = {
        id: 'charge-1',
        organizationId: mockOrgId,
        propertyId: mockPropertyId,
        tenantId: 'tenant-1',
        mealPlanId: 'plan-1',
        amount: new Prisma.Decimal('3000.00'),
        periodStart: new Date('2026-08-01'),
        periodEnd: new Date('2026-08-31'),
        status: MealChargeStatus.PENDING,
        mealPlan: { id: 'plan-1', name: 'Full Board', price: new Prisma.Decimal('3000.00') },
      };
      prisma.mealCharge.create.mockResolvedValue(createdCharge);
      prisma.mealCharge.update.mockResolvedValue({ ...createdCharge, status: MealChargeStatus.INVOICED });

      invoicesService.createInvoice.mockResolvedValue({ id: 'inv-1', totalAmount: 3000 });
      invoicesService.issueInvoice.mockResolvedValue({ id: 'inv-1', status: 'ISSUED' });

      const res = await service.generateCharges(
        mockOrgId,
        mockPropertyId,
        {
          periodStart: '2026-08-01',
          periodEnd: '2026-08-31',
          autoInvoice: true,
        },
        mockUserId
      );

      expect(res).toHaveLength(1);
      expect(res[0].amount).toBe(3000);
      expect(prisma.$executeRaw).toHaveBeenCalled(); // Advisory lock
      expect(invoicesService.createInvoice).toHaveBeenCalledWith(
        mockOrgId,
        expect.anything(),
        mockUserId,
        prisma // Verifies tx client is propagated!
      );
      expect(invoicesService.issueInvoice).toHaveBeenCalledWith(
        mockOrgId,
        'inv-1',
        mockUserId,
        prisma // Verifies tx client is propagated!
      );
    });

    it('should idempotently return existing charges if already generated for the period', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, propertyType: PropertyType.PG });
      prisma.mealSubscription.findMany.mockResolvedValue([
        {
          id: 'sub-1',
          tenantId: 'tenant-1',
          mealPlanId: 'plan-1',
          mealPlan: { name: 'Full Board', price: new Prisma.Decimal('3000.00') },
          tenant: { id: 'tenant-1', firstName: 'John', lastName: 'Doe', phone: '9845011111' },
        },
      ]);
      const existingCharge = {
        id: 'charge-existing',
        organizationId: mockOrgId,
        propertyId: mockPropertyId,
        tenantId: 'tenant-1',
        mealPlanId: 'plan-1',
        amount: new Prisma.Decimal('3000.00'),
        periodStart: new Date('2026-08-01'),
        periodEnd: new Date('2026-08-31'),
        status: MealChargeStatus.INVOICED,
        invoiceId: 'inv-existing',
        mealPlan: { id: 'plan-1', name: 'Full Board', price: new Prisma.Decimal('3000.00') },
      };
      prisma.mealCharge.findFirst.mockResolvedValue(existingCharge);

      const res = await service.generateCharges(
        mockOrgId,
        mockPropertyId,
        {
          periodStart: '2026-08-01',
          periodEnd: '2026-08-31',
          autoInvoice: true,
        },
        mockUserId
      );

      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('charge-existing');
      expect(prisma.mealCharge.create).not.toHaveBeenCalled();
      expect(invoicesService.createInvoice).not.toHaveBeenCalled();
    });

    it('should rethrow and trigger transaction rollback if invoice issuing fails midway', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, propertyType: PropertyType.PG });
      prisma.mealSubscription.findMany.mockResolvedValue([
        {
          id: 'sub-1',
          tenantId: 'tenant-1',
          mealPlanId: 'plan-1',
          mealPlan: { name: 'Full Board', price: new Prisma.Decimal('3000.00') },
          tenant: { id: 'tenant-1', firstName: 'John', lastName: 'Doe', phone: '9845011111' },
        },
      ]);
      prisma.mealCharge.findFirst.mockResolvedValue(null);

      const createdCharge = {
        id: 'charge-1',
        organizationId: mockOrgId,
        propertyId: mockPropertyId,
        tenantId: 'tenant-1',
        mealPlanId: 'plan-1',
        amount: new Prisma.Decimal('3000.00'),
        periodStart: new Date('2026-08-01'),
        periodEnd: new Date('2026-08-31'),
        status: MealChargeStatus.PENDING,
        mealPlan: { id: 'plan-1', name: 'Full Board', price: new Prisma.Decimal('3000.00') },
      };
      prisma.mealCharge.create.mockResolvedValue(createdCharge);
      invoicesService.createInvoice.mockResolvedValue({ id: 'inv-1', totalAmount: 3000 });
      invoicesService.issueInvoice.mockRejectedValue(new Error('Controlled ledger failure simulation'));

      await expect(
        service.generateCharges(
          mockOrgId,
          mockPropertyId,
          {
            periodStart: '2026-08-01',
            periodEnd: '2026-08-31',
            autoInvoice: true,
          },
          mockUserId
        )
      ).rejects.toThrow('Controlled ledger failure simulation');
    });
  });
});
