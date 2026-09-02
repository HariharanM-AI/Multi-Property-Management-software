import { Test, TestingModule } from '@nestjs/testing';
import { RentalService } from './rental.service';
import { PrismaService } from '../../database/prisma.service';
import { PropertyType, RentalUnitStatus, LeaseStatus } from '@propertyos/types';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

describe('RentalService', () => {
  let service: RentalService;

  const mockPrismaService: any = {
    property: {
      findFirst: jest.fn(),
    },
    rentalUnit: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    lease: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    rentEscalation: {
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    tenant: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    tenantStayHistory: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((cb: any) => cb(mockPrismaService)),
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RentalService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<RentalService>(RentalService);

    jest.clearAllMocks();
  });

  describe('validateRentalProperty', () => {
    it('should throw NotFoundException if property does not exist', async () => {
      mockPrismaService.property.findFirst.mockResolvedValue(null);

      await expect(service.validateRentalProperty('org-1', 'prop-1')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw BadRequestException if property type is PG', async () => {
      mockPrismaService.property.findFirst.mockResolvedValue({
        propertyType: PropertyType.PG,
      });

      await expect(service.validateRentalProperty('org-1', 'prop-1')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should pass if property is RENTAL_HOUSE', async () => {
      mockPrismaService.property.findFirst.mockResolvedValue({
        propertyType: PropertyType.RENTAL_HOUSE,
      });

      await expect(service.validateRentalProperty('org-1', 'prop-1')).resolves.not.toThrow();
    });
  });

  describe('createRentalUnit', () => {
    it('should throw ConflictException if unit number already exists', async () => {
      mockPrismaService.property.findFirst.mockResolvedValue({
        propertyType: PropertyType.RENTAL_HOUSE,
      });
      mockPrismaService.rentalUnit.findFirst.mockResolvedValue({
        id: 'unit-1',
        unitNumber: 'V-101',
      });

      await expect(
        service.createRentalUnit('org-1', 'prop-1', 'user-1', {
          unitNumber: 'V-101',
          unitType: 'VILLA',
          monthlyRent: 30000,
          securityDeposit: 60000,
        })
      ).rejects.toThrow(ConflictException);
    });

    it('should successfully create a rental unit', async () => {
      mockPrismaService.property.findFirst.mockResolvedValue({
        propertyType: PropertyType.RENTAL_HOUSE,
      });
      mockPrismaService.rentalUnit.findFirst.mockResolvedValue(null);
      mockPrismaService.rentalUnit.create.mockResolvedValue({
        id: 'unit-new',
        unitNumber: 'V-101',
        unitType: 'VILLA',
        monthlyRent: new Decimal(30000),
        securityDeposit: new Decimal(60000),
        maintenanceCharges: new Decimal(1000),
        status: RentalUnitStatus.AVAILABLE,
      });

      const res = await service.createRentalUnit('org-1', 'prop-1', 'user-1', {
        unitNumber: 'V-101',
        unitType: 'VILLA',
        monthlyRent: 30000,
        securityDeposit: 60000,
        maintenanceCharges: 1000,
      });

      expect(res.unitNumber).toBe('V-101');
      expect(res.monthlyRent).toBe(30000);
      expect(mockPrismaService.rentalUnit.create).toHaveBeenCalled();
    });
  });

  describe('createLease with overlap check', () => {
    it('should throw ConflictException if there is an overlapping lease', async () => {
      mockPrismaService.property.findFirst.mockResolvedValue({
        propertyType: PropertyType.RENTAL_HOUSE,
      });
      mockPrismaService.$queryRaw.mockResolvedValue([{ id: 'unit-1', propertyId: 'prop-1', status: 'AVAILABLE' }]);
      mockPrismaService.tenant.findFirst.mockResolvedValue({ id: 'tenant-1' });

      // Simulate overlapping lease exists
      mockPrismaService.lease.findFirst.mockResolvedValue({
        id: 'lease-overlap',
        status: LeaseStatus.ACTIVE,
      });

      await expect(
        service.createLease('org-1', 'prop-1', 'user-1', {
          rentalUnitId: 'unit-1',
          tenantId: 'tenant-1',
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2026-06-30T00:00:00.000Z',
          monthlyRent: 30000,
          securityDeposit: 60000,
        })
      ).rejects.toThrow(ConflictException);
    });

    it('should succeed creating lease when no overlaps exist', async () => {
      mockPrismaService.property.findFirst.mockResolvedValue({
        propertyType: PropertyType.RENTAL_HOUSE,
      });
      mockPrismaService.$queryRaw.mockResolvedValue([{ id: 'unit-1', propertyId: 'prop-1', status: 'AVAILABLE' }]);
      mockPrismaService.tenant.findFirst.mockResolvedValue({ id: 'tenant-1' });
      mockPrismaService.lease.findFirst.mockResolvedValue(null);
      mockPrismaService.lease.create.mockResolvedValue({
        id: 'lease-ok',
        rentalUnitId: 'unit-1',
        tenantId: 'tenant-1',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-06-30T00:00:00.000Z'),
        monthlyRent: new Decimal(30000),
        securityDeposit: new Decimal(60000),
        noticePeriodDays: 30,
        lockInMonths: 6,
        status: LeaseStatus.ACTIVE,
        terms: null,
      });

      const res = await service.createLease('org-1', 'prop-1', 'user-1', {
        rentalUnitId: 'unit-1',
        tenantId: 'tenant-1',
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-06-30T00:00:00.000Z',
        monthlyRent: 30000,
        securityDeposit: 60000,
      });

      expect(res.status).toBe(LeaseStatus.ACTIVE);
      expect(mockPrismaService.rentalUnit.update).toHaveBeenCalledWith({
        where: { id: 'unit-1' },
        data: { status: RentalUnitStatus.OCCUPIED },
      });
    });
  });

  describe('updateLease transitions', () => {
    it('should throw BadRequestException if transition is invalid', async () => {
      mockPrismaService.property.findFirst.mockResolvedValue({
        propertyType: PropertyType.RENTAL_HOUSE,
      });
      mockPrismaService.lease.findFirst.mockResolvedValue({
        id: 'lease-1',
        status: LeaseStatus.ACTIVE,
        rentalUnitId: 'unit-1',
        monthlyRent: new Decimal(30000),
      });

      // ACTIVE -> EXPIRED directly is invalid (must reach NOTICE first or transition naturally)
      await expect(
        service.updateLease('org-1', 'prop-1', 'lease-1', 'user-1', {
          status: LeaseStatus.EXPIRED,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow valid transitions (ACTIVE -> TERMINATED)', async () => {
      mockPrismaService.property.findFirst.mockResolvedValue({
        propertyType: PropertyType.RENTAL_HOUSE,
      });
      mockPrismaService.lease.findFirst.mockResolvedValue({
        id: 'lease-1',
        status: LeaseStatus.ACTIVE,
        rentalUnitId: 'unit-1',
        monthlyRent: new Decimal(30000),
      });
      mockPrismaService.lease.findFirst.mockResolvedValueOnce({
        id: 'lease-1',
        status: LeaseStatus.ACTIVE,
        rentalUnitId: 'unit-1',
        monthlyRent: new Decimal(30000),
      });
      mockPrismaService.lease.update.mockResolvedValue({
        id: 'lease-1',
        status: LeaseStatus.TERMINATED,
        rentalUnitId: 'unit-1',
        tenantId: 'tenant-1',
        startDate: new Date(),
        endDate: new Date(),
        monthlyRent: new Decimal(30000),
        securityDeposit: new Decimal(60000),
        noticePeriodDays: 30,
        lockInMonths: 6,
        terms: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrismaService.lease.findFirst.mockResolvedValue(null); // No other active leases

      const res = await service.updateLease('org-1', 'prop-1', 'lease-1', 'user-1', {
        status: LeaseStatus.TERMINATED,
      });

      expect(res.status).toBe(LeaseStatus.TERMINATED);
      expect(mockPrismaService.rentalUnit.update).toHaveBeenCalledWith({
        where: { id: 'unit-1' },
        data: { status: RentalUnitStatus.AVAILABLE },
      });
    });
  });

  describe('deleteRentalUnit occupied check', () => {
    it('should throw BadRequestException if unit has active leases', async () => {
      mockPrismaService.property.findFirst.mockResolvedValue({
        propertyType: PropertyType.RENTAL_HOUSE,
      });
      mockPrismaService.rentalUnit.findFirst.mockResolvedValue({
        id: 'unit-1',
        unitNumber: 'V-101',
        leases: [{ id: 'lease-1', status: LeaseStatus.ACTIVE }],
      });

      await expect(service.deleteRentalUnit('org-1', 'prop-1', 'unit-1', 'user-1')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('addRentEscalation checks', () => {
    it('should calculate escalated amount and create record', async () => {
      mockPrismaService.property.findFirst.mockResolvedValue({
        propertyType: PropertyType.RENTAL_HOUSE,
      });
      mockPrismaService.lease.findFirst.mockResolvedValue({
        id: 'lease-1',
        monthlyRent: new Decimal(30000),
        status: LeaseStatus.ACTIVE,
      });
      mockPrismaService.rentEscalation.create.mockResolvedValue({
        id: 'esc-1',
        leaseId: 'lease-1',
        effectiveDate: new Date('2027-01-01'),
        percentage: 10,
        escalatedAmount: new Decimal(33000),
        notes: 'Annual escalation',
      });

      const res = await service.addRentEscalation('org-1', 'prop-1', 'lease-1', 'user-1', {
        effectiveDate: '2027-01-01T00:00:00.000Z',
        percentage: 10,
        notes: 'Annual escalation',
      });

      expect(res.escalatedAmount).toBe(33000);
      expect(mockPrismaService.rentEscalation.create).toHaveBeenCalled();
    });
  });
});
