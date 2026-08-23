import { Test, TestingModule } from '@nestjs/testing';
import { ElectricityService } from './electricity.service';
import { PrismaService } from '../../database/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  MeterType,
  MeterStatus,
  ElectricityRateStatus,
  ElectricityChargeStatus,
  PropertyType,
  CheckInStatus,
  UserRole,
} from '@propertyos/types';
import { Prisma } from '@prisma/client';

describe('ElectricityService', () => {
  let service: ElectricityService;
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
      room: {
        findFirst: jest.fn(),
      },
      electricityMeter: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      electricityReading: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      electricityRate: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      electricityCharge: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      checkIn: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      tenant: {
        findFirst: jest.fn(),
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
        ElectricityService,
        { provide: PrismaService, useValue: prisma },
        { provide: InvoicesService, useValue: invoicesService },
      ],
    }).compile();

    service = module.get<ElectricityService>(ElectricityService);
  });

  describe('validateProperty', () => {
    it('should throw NotFoundException if property does not exist', async () => {
      prisma.property.findFirst.mockResolvedValue(null);
      await expect(service.validateProperty(mockOrgId, 'invalid-id')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw NotFoundException if property is not PG', async () => {
      prisma.property.findFirst.mockResolvedValue({
        id: mockPropertyId,
        propertyType: PropertyType.RENTAL_HOUSE,
      });
      await expect(service.validateProperty(mockOrgId, mockPropertyId)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should return property if valid PG property', async () => {
      const prop = { id: mockPropertyId, propertyType: PropertyType.PG };
      prisma.property.findFirst.mockResolvedValue(prop);
      const result = await service.validateProperty(mockOrgId, mockPropertyId);
      expect(result).toEqual(prop);
    });
  });

  describe('createMeter', () => {
    it('should create meter successfully', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, propertyType: PropertyType.PG });
      prisma.electricityMeter.findFirst.mockResolvedValue(null);
      const created = {
        id: 'meter-1',
        organizationId: mockOrgId,
        propertyId: mockPropertyId,
        meterNumber: 'M-101',
        meterType: MeterType.ROOM,
        status: MeterStatus.ACTIVE,
        initialReading: new Prisma.Decimal('1000.00'),
        installedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.electricityMeter.create.mockResolvedValue(created);

      const res = await service.createMeter(
        mockOrgId,
        mockPropertyId,
        { meterNumber: 'M-101', initialReading: 1000 },
        mockUserId
      );

      expect(res.meterNumber).toBe('M-101');
      expect(prisma.electricityMeter.create).toHaveBeenCalled();
    });

    it('should reject duplicate meter number in property', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, propertyType: PropertyType.PG });
      prisma.electricityMeter.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        service.createMeter(mockOrgId, mockPropertyId, { meterNumber: 'M-101' }, mockUserId)
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('recordReading & Reset Authorization', () => {
    it('should calculate consumption correctly for normal reading', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, propertyType: PropertyType.PG });
      prisma.electricityMeter.findFirst.mockResolvedValue({
        id: 'm-1',
        meterNumber: 'M-101',
        initialReading: new Prisma.Decimal('1000.00'),
      });
      prisma.electricityReading.findFirst
        .mockResolvedValueOnce(null) // no duplicate on date
        .mockResolvedValueOnce({
          id: 'prev-1',
          currentReading: new Prisma.Decimal('1000.00'),
        }); // previous reading

      const created = {
        id: 'r-1',
        organizationId: mockOrgId,
        propertyId: mockPropertyId,
        meterId: 'm-1',
        readingDate: new Date('2026-08-01'),
        previousReading: new Prisma.Decimal('1000.00'),
        currentReading: new Prisma.Decimal('1125.00'),
        unitsConsumed: new Prisma.Decimal('125.00'),
        isResetOverride: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.electricityReading.create.mockResolvedValue(created);

      const res = await service.recordReading(
        mockOrgId,
        mockPropertyId,
        { meterId: 'm-1', readingDate: '2026-08-01', currentReading: 1125 },
        mockUserId,
        [UserRole.OWNER]
      );

      expect(res.unitsConsumed).toBe(125);
    });

    it('should reject lower reading without reset override', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, propertyType: PropertyType.PG });
      prisma.electricityMeter.findFirst.mockResolvedValue({
        id: 'm-1',
        meterNumber: 'M-101',
        initialReading: new Prisma.Decimal('1000.00'),
      });
      prisma.electricityReading.findFirst
        .mockResolvedValueOnce(null) // no duplicate
        .mockResolvedValueOnce({
          id: 'prev-1',
          currentReading: new Prisma.Decimal('1125.00'),
        });

      await expect(
        service.recordReading(
          mockOrgId,
          mockPropertyId,
          { meterId: 'm-1', readingDate: '2026-08-02', currentReading: 500, isResetOverride: false },
          mockUserId,
          [UserRole.OWNER]
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject reset override when user lacks ELECTRICITY_UPDATE permission', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, propertyType: PropertyType.PG });
      prisma.electricityMeter.findFirst.mockResolvedValue({
        id: 'm-1',
        meterNumber: 'M-101',
        initialReading: new Prisma.Decimal('1000.00'),
      });

      await expect(
        service.recordReading(
          mockOrgId,
          mockPropertyId,
          {
            meterId: 'm-1',
            readingDate: '2026-08-02',
            currentReading: 50,
            isResetOverride: true,
            resetReason: 'Defective meter replacement',
          },
          mockUserId,
          [UserRole.ACCOUNTANT] // Accountant only has ELECTRICITY_READ & ELECTRICITY_FINALIZE, lacks ELECTRICITY_UPDATE
        )
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject reset override when reset reason is missing', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, propertyType: PropertyType.PG });
      prisma.electricityMeter.findFirst.mockResolvedValue({
        id: 'm-1',
        meterNumber: 'M-101',
        initialReading: new Prisma.Decimal('1000.00'),
      });

      await expect(
        service.recordReading(
          mockOrgId,
          mockPropertyId,
          {
            meterId: 'm-1',
            readingDate: '2026-08-02',
            currentReading: 50,
            isResetOverride: true,
            resetReason: '',
          },
          mockUserId,
          [UserRole.OWNER]
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow lower reading with authorized reset override and reason', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, propertyType: PropertyType.PG });
      prisma.electricityMeter.findFirst.mockResolvedValue({
        id: 'm-1',
        meterNumber: 'M-101',
        initialReading: new Prisma.Decimal('1000.00'),
      });
      prisma.electricityReading.findFirst
        .mockResolvedValueOnce(null) // no duplicate
        .mockResolvedValueOnce({
          id: 'prev-1',
          currentReading: new Prisma.Decimal('1125.00'),
        });

      const created = {
        id: 'r-2',
        organizationId: mockOrgId,
        propertyId: mockPropertyId,
        meterId: 'm-1',
        readingDate: new Date('2026-08-02'),
        previousReading: new Prisma.Decimal('1125.00'),
        currentReading: new Prisma.Decimal('50.00'),
        unitsConsumed: new Prisma.Decimal('50.00'),
        isResetOverride: true,
        resetReason: 'Defective meter replaced',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.electricityReading.create.mockResolvedValue(created);

      const res = await service.recordReading(
        mockOrgId,
        mockPropertyId,
        {
          meterId: 'm-1',
          readingDate: '2026-08-02',
          currentReading: 50,
          isResetOverride: true,
          resetReason: 'Defective meter replaced',
        },
        mockUserId,
        [UserRole.OWNER]
      );

      expect(res.isResetOverride).toBe(true);
      expect(res.unitsConsumed).toBe(50);
    });

    it('should normalize P2002 error to ConflictException on concurrent duplicate reading', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, propertyType: PropertyType.PG });
      prisma.electricityMeter.findFirst.mockResolvedValue({
        id: 'm-1',
        meterNumber: 'M-101',
        initialReading: new Prisma.Decimal('1000.00'),
      });
      prisma.electricityReading.findFirst.mockResolvedValue(null);

      const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.x',
      });
      prisma.electricityReading.create.mockRejectedValue(p2002Error);

      await expect(
        service.recordReading(
          mockOrgId,
          mockPropertyId,
          { meterId: 'm-1', readingDate: '2026-08-01', currentReading: 1200 },
          mockUserId,
          [UserRole.OWNER]
        )
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('createRate & Overlap Protection', () => {
    it('should reject overlapping active rate period', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, propertyType: PropertyType.PG });
      prisma.electricityRate.findMany.mockResolvedValue([
        {
          id: 'existing-rate-1',
          effectiveFrom: new Date('2026-08-01'),
          effectiveTo: new Date('2026-08-31'),
          status: ElectricityRateStatus.ACTIVE,
        },
      ]);

      await expect(
        service.createRate(
          mockOrgId,
          mockPropertyId,
          {
            ratePerUnit: 12.5,
            effectiveFrom: '2026-08-15',
            effectiveTo: '2026-09-15',
          },
          mockUserId
        )
      ).rejects.toThrow(ConflictException);
    });

    it('should create rate successfully when periods do not overlap', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, propertyType: PropertyType.PG });
      prisma.electricityRate.findMany.mockResolvedValue([]); // no overlapping rates

      const createdRate = {
        id: 'rate-new',
        organizationId: mockOrgId,
        propertyId: mockPropertyId,
        ratePerUnit: new Prisma.Decimal('14.00'),
        effectiveFrom: new Date('2026-09-01'),
        effectiveTo: null,
        status: ElectricityRateStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.electricityRate.create.mockResolvedValue(createdRate);

      const res = await service.createRate(
        mockOrgId,
        mockPropertyId,
        {
          ratePerUnit: 14.0,
          effectiveFrom: '2026-09-01',
        },
        mockUserId
      );

      expect(res.id).toBe('rate-new');
      expect(Number(res.ratePerUnit)).toBe(14);
      expect(prisma.$executeRaw).toHaveBeenCalled();
    });
  });

  describe('generateCharges & Transaction Propagation', () => {
    it('should split room charges deterministically among 3 occupants with exact 100.00 sum', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, propertyType: PropertyType.PG });
      prisma.electricityReading.findFirst.mockResolvedValue({
        id: 'read-1',
        propertyId: mockPropertyId,
        readingDate: new Date('2026-08-01'),
        unitsConsumed: new Prisma.Decimal('10.00'),
        meterId: 'm-1',
        meter: {
          id: 'm-1',
          meterNumber: 'M-101',
          meterType: MeterType.ROOM,
          roomId: 'room-1',
        },
      });

      prisma.electricityCharge.findMany.mockResolvedValue([]); // no existing charges
      prisma.electricityRate.findFirst.mockResolvedValue({
        id: 'rate-1',
        ratePerUnit: new Prisma.Decimal('10.00'), // 10 units * 10 = 100.00
      });

      prisma.checkIn.findMany.mockResolvedValue([
        { tenantId: 't-1', tenant: { id: 't-1', firstName: 'A', lastName: 'X', phone: '111' } },
        { tenantId: 't-2', tenant: { id: 't-2', firstName: 'B', lastName: 'Y', phone: '222' } },
        { tenantId: 't-3', tenant: { id: 't-3', firstName: 'C', lastName: 'Z', phone: '333' } },
      ]);

      const createdCharges: any[] = [];
      prisma.electricityCharge.create.mockImplementation(({ data }: any) => {
        const item = {
          ...data,
          id: `charge-${createdCharges.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        createdCharges.push(item);
        return item;
      });

      const res = await service.generateCharges(
        mockOrgId,
        mockPropertyId,
        { readingId: 'read-1', autoInvoice: false },
        mockUserId
      );

      expect(res.length).toBe(3);
      // 100.00 / 3 = 33.34, 33.33, 33.33 -> sum = 100.00
      expect(Number(res[0].amount)).toBe(33.34);
      expect(Number(res[1].amount)).toBe(33.33);
      expect(Number(res[2].amount)).toBe(33.33);

      const totalSum = res.reduce((acc, c) => acc + Number(c.amount), 0);
      expect(totalSum).toBe(100.00);
      expect(prisma.$executeRaw).toHaveBeenCalled();
    });

    it('should return existing charges idempotently if charges already generated', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, propertyType: PropertyType.PG });
      prisma.electricityReading.findFirst.mockResolvedValue({
        id: 'read-1',
        propertyId: mockPropertyId,
        readingDate: new Date('2026-08-01'),
        unitsConsumed: new Prisma.Decimal('10.00'),
        meterId: 'm-1',
        meter: {
          id: 'm-1',
          meterNumber: 'M-101',
          meterType: MeterType.ROOM,
          roomId: 'room-1',
        },
      });

      const existing = [
        {
          id: 'charge-existing-1',
          organizationId: mockOrgId,
          propertyId: mockPropertyId,
          meterId: 'm-1',
          readingId: 'read-1',
          tenantId: 't-1',
          unitsConsumed: new Prisma.Decimal('10.00'),
          ratePerUnit: new Prisma.Decimal('10.00'),
          amount: new Prisma.Decimal('100.00'),
          allocationType: 'TENANT_SPECIFIC',
          status: ElectricityChargeStatus.PENDING,
          chargePeriodStart: new Date('2026-08-01'),
          chargePeriodEnd: new Date('2026-08-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      prisma.electricityCharge.findMany.mockResolvedValue(existing);

      const res = await service.generateCharges(
        mockOrgId,
        mockPropertyId,
        { readingId: 'read-1', autoInvoice: false },
        mockUserId
      );

      expect(res.length).toBe(1);
      expect(res[0].id).toBe('charge-existing-1');
      expect(prisma.electricityCharge.create).not.toHaveBeenCalled();
    });

    it('should propagate tx to createInvoice and issueInvoice when autoInvoice is true', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, propertyType: PropertyType.PG });
      prisma.electricityReading.findFirst.mockResolvedValue({
        id: 'read-1',
        propertyId: mockPropertyId,
        readingDate: new Date('2026-08-01'),
        unitsConsumed: new Prisma.Decimal('10.00'),
        meterId: 'm-1',
        meter: {
          id: 'm-1',
          meterNumber: 'M-101',
          meterType: MeterType.ROOM,
          roomId: 'room-1',
        },
      });

      prisma.electricityCharge.findMany.mockResolvedValue([]); // no existing charges
      prisma.electricityRate.findFirst.mockResolvedValue({
        id: 'rate-1',
        ratePerUnit: new Prisma.Decimal('10.00'),
      });

      prisma.checkIn.findMany.mockResolvedValue([
        { tenantId: 't-1', tenant: { id: 't-1', firstName: 'A', lastName: 'X', phone: '111' } },
      ]);

      prisma.electricityCharge.create.mockResolvedValue({
        id: 'charge-1',
        organizationId: mockOrgId,
        propertyId: mockPropertyId,
        meterId: 'm-1',
        readingId: 'read-1',
        roomId: 'room-1',
        tenantId: 't-1',
        chargePeriodStart: new Date('2026-08-01'),
        chargePeriodEnd: new Date('2026-08-01'),
        unitsConsumed: new Prisma.Decimal('10.00'),
        ratePerUnit: new Prisma.Decimal('10.00'),
        amount: new Prisma.Decimal('100.00'),
        allocationType: 'TENANT_SPECIFIC',
        status: ElectricityChargeStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      invoicesService.createInvoice.mockResolvedValue({ id: 'inv-1', invoiceNumber: 'INV-2026-000001' });
      invoicesService.issueInvoice.mockResolvedValue({ id: 'inv-1', status: 'ISSUED' });
      prisma.electricityCharge.update.mockResolvedValue({});

      const res = await service.generateCharges(
        mockOrgId,
        mockPropertyId,
        { readingId: 'read-1', autoInvoice: true },
        mockUserId
      );

      expect(res.length).toBe(1);
      expect(invoicesService.createInvoice).toHaveBeenCalledWith(
        mockOrgId,
        expect.any(Object),
        mockUserId,
        prisma // passed transaction client tx
      );
      expect(invoicesService.issueInvoice).toHaveBeenCalledWith(
        mockOrgId,
        'inv-1',
        mockUserId,
        prisma // passed transaction client tx
      );
    });

    it('should throw and rollback transaction if invoice issuing fails midway', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, propertyType: PropertyType.PG });
      prisma.electricityReading.findFirst.mockResolvedValue({
        id: 'read-fail',
        organizationId: mockOrgId,
        propertyId: mockPropertyId,
        meterId: 'm-1',
        readingDate: new Date('2026-08-01'),
        unitsConsumed: new Prisma.Decimal('10.00'),
        meter: {
          id: 'm-1',
          meterNumber: 'M-101',
          meterType: 'ROOM',
          roomId: 'room-1',
        },
      });

      prisma.electricityCharge.findMany.mockResolvedValue([]);
      prisma.electricityRate.findFirst.mockResolvedValue({
        id: 'rate-1',
        ratePerUnit: new Prisma.Decimal('10.00'),
      });

      prisma.checkIn.findMany.mockResolvedValue([
        { tenantId: 't-1', tenant: { id: 't-1', firstName: 'A', lastName: 'X', phone: '111' } },
      ]);

      prisma.electricityCharge.create.mockResolvedValue({
        id: 'charge-fail',
        organizationId: mockOrgId,
        propertyId: mockPropertyId,
        meterId: 'm-1',
        readingId: 'read-fail',
        roomId: 'room-1',
        tenantId: 't-1',
        chargePeriodStart: new Date('2026-08-01'),
        chargePeriodEnd: new Date('2026-08-01'),
        unitsConsumed: new Prisma.Decimal('10.00'),
        ratePerUnit: new Prisma.Decimal('10.00'),
        amount: new Prisma.Decimal('100.00'),
        allocationType: 'TENANT_SPECIFIC',
        status: ElectricityChargeStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      invoicesService.createInvoice.mockResolvedValue({ id: 'inv-1', invoiceNumber: 'INV-2026-000001' });
      invoicesService.issueInvoice.mockRejectedValue(new Error('Ledger write constraint failure'));

      await expect(
        service.generateCharges(
          mockOrgId,
          mockPropertyId,
          { readingId: 'read-fail', autoInvoice: true },
          mockUserId
        )
      ).rejects.toThrow('Ledger write constraint failure');
    });
  });
});
