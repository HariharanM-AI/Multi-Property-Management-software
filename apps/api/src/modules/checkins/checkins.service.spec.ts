import { Test, TestingModule } from '@nestjs/testing';
import { CheckinsService } from './checkins.service';
import { PrismaService } from '../../database/prisma.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  PropertyType,
  BedStatus,
  LeaseStatus,
  TenantStatus,
  CheckInStatus,
  KycVerificationStatus,
  KycDocumentType,
} from '@propertyos/types';

describe('CheckinsService', () => {
  let service: CheckinsService;
  let prisma: PrismaService;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = '22222222-2222-2222-2222-222222222222';
  const mockPgPropertyId = '33333333-3333-3333-3333-333333333333';
  const mockRentalPropertyId = '44444444-4444-4444-4444-444444444444';
  const mockTenantId = '55555555-5555-5555-5555-555555555555';
  const mockBedId = '66666666-6666-6666-6666-666666666666';
  const mockLeaseId = '77777777-7777-7777-7777-777777777777';
  const mockUnitId = '88888888-8888-8888-8888-888888888888';
  const mockCheckInId = '99999999-9999-9999-9999-999999999999';

  const validTenant = {
    id: mockTenantId,
    organizationId: mockOrgId,
    firstName: 'Rahul',
    lastName: 'Sharma',
    phone: '9876543210',
    email: 'rahul.sharma@example.com',
    permanentAddress: '123 MG Road',
    permanentCity: 'Bengaluru',
    permanentState: 'Karnataka',
    permanentPostalCode: '560001',
    emergencyContactName: 'Ramesh Sharma',
    emergencyContactPhone: '9876543211',
    emergencyContactRelation: 'Father',
    status: TenantStatus.PROSPECT,
    deletedAt: null,
    documents: [
      {
        id: 'doc-1',
        documentType: KycDocumentType.AADHAAR,
        verificationStatus: KycVerificationStatus.VERIFIED,
        storagePath: '/uploads/doc.pdf',
      },
    ],
    stayHistories: [],
    leases: [],
  };

  const validPgProperty = {
    id: mockPgPropertyId,
    organizationId: mockOrgId,
    name: 'Green PG',
    propertyType: PropertyType.PG,
    deletedAt: null,
  };

  const validRentalProperty = {
    id: mockRentalPropertyId,
    organizationId: mockOrgId,
    name: 'Green Villa',
    propertyType: PropertyType.RENTAL_HOUSE,
    deletedAt: null,
  };

  const validBed = {
    id: mockBedId,
    bedNumber: 'A-101',
    monthlyRent: { toNumber: () => 8000 },
    status: BedStatus.AVAILABLE,
    deletedAt: null,
    room: {
      id: 'room-1',
      propertyId: mockPgPropertyId,
      floor: { floorNumber: 1 },
    },
  };

  const validLease = {
    id: mockLeaseId,
    tenantId: mockTenantId,
    rentalUnitId: mockUnitId,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    monthlyRent: { toNumber: () => 25000 },
    status: LeaseStatus.ACTIVE,
    rentalUnit: {
      id: mockUnitId,
      unitNumber: 'Flat 101',
      propertyId: mockRentalPropertyId,
    },
  };

  const mockPrismaService: any = {
    property: {
      findFirst: jest.fn(),
    },
    tenant: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    bed: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    lease: {
      findFirst: jest.fn(),
    },
    checkIn: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    tenantStayHistory: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: mockBedId }]),
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckinsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CheckinsService>(CheckinsService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();

    mockPrismaService.tenant.findFirst.mockResolvedValue(validTenant);
    mockPrismaService.property.findFirst.mockResolvedValue(validPgProperty);
    mockPrismaService.bed.findFirst.mockResolvedValue(validBed);
    mockPrismaService.lease.findFirst.mockResolvedValue(validLease);
  });

  describe('getOnboardingStatus', () => {
    it('should return readyForCheckIn: true when all requirements are satisfied', async () => {
      mockPrismaService.tenant.findFirst.mockResolvedValue(validTenant);

      const status = await service.getOnboardingStatus(mockOrgId, mockTenantId);

      expect(status.tenantProfileComplete).toBe(true);
      expect(status.emergencyContactComplete).toBe(true);
      expect(status.kycVerified).toBe(true);
      expect(status.activePgStayPresent).toBe(false);
      expect(status.readyForCheckIn).toBe(true);
      expect(status.missingItems).toHaveLength(0);
    });

    it('should report missing items if KYC is not verified', async () => {
      mockPrismaService.tenant.findFirst.mockResolvedValue({
        ...validTenant,
        documents: [
          {
            id: 'doc-1',
            verificationStatus: KycVerificationStatus.PENDING,
          },
        ],
      });

      const status = await service.getOnboardingStatus(mockOrgId, mockTenantId);

      expect(status.kycVerified).toBe(false);
      expect(status.readyForCheckIn).toBe(false);
      expect(status.missingItems).toContain(
        'No verified KYC identity documents found for this tenant'
      );
    });

    it('should report missing emergency contact if incomplete', async () => {
      mockPrismaService.tenant.findFirst.mockResolvedValue({
        ...validTenant,
        emergencyContactName: '',
      });

      const status = await service.getOnboardingStatus(mockOrgId, mockTenantId);

      expect(status.emergencyContactComplete).toBe(false);
      expect(status.readyForCheckIn).toBe(false);
      expect(status.missingItems).toContain(
        'Missing emergency contact information (name, phone, relation)'
      );
    });

    it('should throw NotFoundException if tenant belongs to another organization', async () => {
      mockPrismaService.tenant.findFirst.mockResolvedValue(null);

      await expect(service.getOnboardingStatus(mockOrgId, mockTenantId)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw BadRequestException if tenant is archived', async () => {
      mockPrismaService.tenant.findFirst.mockResolvedValue({
        ...validTenant,
        status: TenantStatus.ARCHIVED,
      });

      await expect(service.getOnboardingStatus(mockOrgId, mockTenantId)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('createPgCheckIn', () => {
    it('should initiate a PG check-in successfully', async () => {
      mockPrismaService.property.findFirst.mockResolvedValue(validPgProperty);
      mockPrismaService.tenant.findFirst.mockResolvedValue(validTenant);
      mockPrismaService.bed.findFirst.mockResolvedValue(validBed);
      mockPrismaService.checkIn.create.mockResolvedValue({
        id: mockCheckInId,
        organizationId: mockOrgId,
        propertyId: mockPgPropertyId,
        tenantId: mockTenantId,
        bedId: mockBedId,
        status: CheckInStatus.INITIATED,
        checkInDate: new Date('2026-01-01'),
        emergencyContactConfirmed: true,
        kycConfirmed: true,
      });

      const result = await service.createPgCheckIn(mockOrgId, mockPgPropertyId, mockUserId, {
        tenantId: mockTenantId,
        bedId: mockBedId,
        checkInDate: '2026-01-01',
      });

      expect(result.status).toBe(CheckInStatus.INITIATED);
      expect(mockPrismaService.checkIn.create).toHaveBeenCalled();
      expect(mockPrismaService.auditLog.create).toHaveBeenCalled();
    });

    it('should reject PG check-in on a RENTAL_HOUSE property', async () => {
      mockPrismaService.property.findFirst.mockResolvedValue(validRentalProperty);

      await expect(
        service.createPgCheckIn(mockOrgId, mockRentalPropertyId, mockUserId, {
          tenantId: mockTenantId,
          bedId: mockBedId,
          checkInDate: '2026-01-01',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject check-in if bed is unavailable or occupied', async () => {
      mockPrismaService.property.findFirst.mockResolvedValue(validPgProperty);
      mockPrismaService.tenant.findFirst.mockResolvedValue(validTenant);
      mockPrismaService.bed.findFirst.mockResolvedValue({
        ...validBed,
        status: BedStatus.OCCUPIED,
      });

      await expect(
        service.createPgCheckIn(mockOrgId, mockPgPropertyId, mockUserId, {
          tenantId: mockTenantId,
          bedId: mockBedId,
          checkInDate: '2026-01-01',
        })
      ).rejects.toThrow(ConflictException);
    });

    it('should reject check-in if tenant already has an active PG stay', async () => {
      mockPrismaService.property.findFirst.mockResolvedValue(validPgProperty);
      mockPrismaService.tenant.findFirst.mockResolvedValue({
        ...validTenant,
        stayHistories: [{ id: 'stay-1', checkOutDate: null }],
      });
      mockPrismaService.bed.findFirst.mockResolvedValue(validBed);

      await expect(
        service.createPgCheckIn(mockOrgId, mockPgPropertyId, mockUserId, {
          tenantId: mockTenantId,
          bedId: mockBedId,
          checkInDate: '2026-01-01',
        })
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('createRentalCheckIn', () => {
    it('should initiate a Whole-Unit check-in with active lease', async () => {
      mockPrismaService.property.findFirst.mockResolvedValue(validRentalProperty);
      mockPrismaService.tenant.findFirst.mockResolvedValue(validTenant);
      mockPrismaService.lease.findFirst.mockResolvedValue(validLease);
      mockPrismaService.checkIn.create.mockResolvedValue({
        id: mockCheckInId,
        organizationId: mockOrgId,
        propertyId: mockRentalPropertyId,
        tenantId: mockTenantId,
        rentalUnitId: mockUnitId,
        leaseId: mockLeaseId,
        status: CheckInStatus.INITIATED,
        checkInDate: new Date('2026-01-01'),
        emergencyContactConfirmed: true,
        kycConfirmed: true,
        lease: validLease,
      });

      const result = await service.createRentalCheckIn(mockOrgId, mockRentalPropertyId, mockUserId, {
        tenantId: mockTenantId,
        leaseId: mockLeaseId,
        checkInDate: '2026-01-01',
      });

      expect(result.status).toBe(CheckInStatus.INITIATED);
      expect(mockPrismaService.checkIn.create).toHaveBeenCalled();
      expect(mockPrismaService.auditLog.create).toHaveBeenCalled();
    });

    it('should reject whole-unit check-in on a PG property', async () => {
      mockPrismaService.property.findFirst.mockResolvedValue(validPgProperty);

      await expect(
        service.createRentalCheckIn(mockOrgId, mockPgPropertyId, mockUserId, {
          tenantId: mockTenantId,
          leaseId: mockLeaseId,
          checkInDate: '2026-01-01',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject check-in if active lease is not found', async () => {
      mockPrismaService.property.findFirst.mockResolvedValue(validRentalProperty);
      mockPrismaService.tenant.findFirst.mockResolvedValue(validTenant);
      mockPrismaService.lease.findFirst.mockResolvedValue(null);

      await expect(
        service.createRentalCheckIn(mockOrgId, mockRentalPropertyId, mockUserId, {
          tenantId: mockTenantId,
          leaseId: mockLeaseId,
          checkInDate: '2026-01-01',
        })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('markCheckInReady', () => {
    it('should transition INITIATED to READY successfully', async () => {
      mockPrismaService.checkIn.findFirst.mockResolvedValue({
        id: mockCheckInId,
        organizationId: mockOrgId,
        tenantId: mockTenantId,
        propertyId: mockPgPropertyId,
        bedId: mockBedId,
        status: CheckInStatus.INITIATED,
        property: validPgProperty,
      });
      mockPrismaService.tenant.findFirst.mockResolvedValue(validTenant);
      mockPrismaService.bed.findFirst.mockResolvedValue(validBed);
      mockPrismaService.checkIn.update.mockResolvedValue({
        id: mockCheckInId,
        status: CheckInStatus.READY,
      });

      const result = await service.markCheckInReady(mockOrgId, mockCheckInId, mockUserId);

      expect(result.status).toBe(CheckInStatus.READY);
    });

    it('should reject transition if check-in is already completed', async () => {
      mockPrismaService.checkIn.findFirst.mockResolvedValue({
        id: mockCheckInId,
        organizationId: mockOrgId,
        status: CheckInStatus.CHECKED_IN,
        property: validPgProperty,
      });

      await expect(service.markCheckInReady(mockOrgId, mockCheckInId, mockUserId)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('completeCheckIn (Concurrency and Row-Locking)', () => {
    it('should lock bed with row-level locking, create stay history, and update bed to OCCUPIED', async () => {
      mockPrismaService.checkIn.findFirst.mockResolvedValue({
        id: mockCheckInId,
        organizationId: mockOrgId,
        tenantId: mockTenantId,
        propertyId: mockPgPropertyId,
        bedId: mockBedId,
        status: CheckInStatus.READY,
        checkInDate: new Date('2026-01-01'),
        property: validPgProperty,
      });
      mockPrismaService.tenant.findFirst.mockResolvedValue(validTenant);
      mockPrismaService.tenant.findUnique.mockResolvedValue(validTenant);
      mockPrismaService.bed.findFirst.mockResolvedValue(validBed);
      mockPrismaService.tenantStayHistory.findFirst.mockResolvedValue(null);
      mockPrismaService.tenantStayHistory.create.mockResolvedValue({
        id: 'stay-1',
        tenantId: mockTenantId,
        bedId: mockBedId,
      });
      mockPrismaService.bed.update.mockResolvedValue({ ...validBed, status: BedStatus.OCCUPIED });
      mockPrismaService.tenant.update.mockResolvedValue({ ...validTenant, status: TenantStatus.ACTIVE });
      mockPrismaService.checkIn.update.mockResolvedValue({
        id: mockCheckInId,
        status: CheckInStatus.CHECKED_IN,
        stayHistoryId: 'stay-1',
        completedAt: new Date(),
      });

      const result = await service.completeCheckIn(mockOrgId, mockCheckInId, mockUserId);

      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalledWith(
        'SELECT id FROM beds WHERE id = $1 FOR UPDATE',
        mockBedId
      );
      expect(mockPrismaService.tenantStayHistory.create).toHaveBeenCalled();
      expect(mockPrismaService.bed.update).toHaveBeenCalledWith({
        where: { id: mockBedId },
        data: { status: BedStatus.OCCUPIED },
      });
      expect(mockPrismaService.tenant.update).toHaveBeenCalledWith({
        where: { id: mockTenantId },
        data: { status: TenantStatus.ACTIVE },
      });
      expect(result.status).toBe(CheckInStatus.CHECKED_IN);
    });

    it('should reject completion if another concurrent request occupied the bed', async () => {
      mockPrismaService.checkIn.findFirst.mockResolvedValue({
        id: mockCheckInId,
        organizationId: mockOrgId,
        tenantId: mockTenantId,
        propertyId: mockPgPropertyId,
        bedId: mockBedId,
        status: CheckInStatus.READY,
        checkInDate: new Date('2026-01-01'),
        property: validPgProperty,
      });
      mockPrismaService.tenant.findFirst.mockResolvedValue(validTenant);
      mockPrismaService.bed.findFirst.mockResolvedValue({
        ...validBed,
        status: BedStatus.OCCUPIED,
      });

      await expect(service.completeCheckIn(mockOrgId, mockCheckInId, mockUserId)).rejects.toThrow(
        ConflictException
      );
    });
  });

  describe('cancelCheckIn', () => {
    it('should cancel an INITIATED check-in successfully', async () => {
      mockPrismaService.checkIn.findFirst.mockResolvedValue({
        id: mockCheckInId,
        organizationId: mockOrgId,
        tenantId: mockTenantId,
        propertyId: mockPgPropertyId,
        status: CheckInStatus.INITIATED,
        notes: null,
      });
      mockPrismaService.checkIn.update.mockResolvedValue({
        id: mockCheckInId,
        status: CheckInStatus.CANCELLED,
        cancelledAt: new Date(),
      });

      const result = await service.cancelCheckIn(mockOrgId, mockCheckInId, mockUserId, {
        reason: 'Tenant plans changed',
      });

      expect(result.status).toBe(CheckInStatus.CANCELLED);
      expect(mockPrismaService.auditLog.create).toHaveBeenCalled();
    });

    it('should reject cancellation if check-in is already CHECKED_IN', async () => {
      mockPrismaService.checkIn.findFirst.mockResolvedValue({
        id: mockCheckInId,
        organizationId: mockOrgId,
        status: CheckInStatus.CHECKED_IN,
      });

      await expect(
        service.cancelCheckIn(mockOrgId, mockCheckInId, mockUserId, { reason: 'Should fail' })
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject cancellation if already CANCELLED', async () => {
      mockPrismaService.checkIn.findFirst.mockResolvedValue({
        id: mockCheckInId,
        organizationId: mockOrgId,
        status: CheckInStatus.CANCELLED,
      });

      await expect(
        service.cancelCheckIn(mockOrgId, mockCheckInId, mockUserId, { reason: 'Already cancelled' })
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject CANCELLED -> READY transition with BadRequestException', async () => {
      mockPrismaService.checkIn.findFirst.mockResolvedValue({
        id: mockCheckInId,
        organizationId: mockOrgId,
        status: CheckInStatus.CANCELLED,
      });

      await expect(service.markCheckInReady(mockOrgId, mockCheckInId, mockUserId)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should reject CANCELLED -> CHECKED_IN transition with BadRequestException', async () => {
      mockPrismaService.checkIn.findFirst.mockResolvedValue({
        id: mockCheckInId,
        organizationId: mockOrgId,
        status: CheckInStatus.CANCELLED,
      });

      await expect(service.completeCheckIn(mockOrgId, mockCheckInId, mockUserId)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should reject CHECKED_IN -> CHECKED_IN completion with BadRequestException', async () => {
      mockPrismaService.checkIn.findFirst.mockResolvedValue({
        id: mockCheckInId,
        organizationId: mockOrgId,
        status: CheckInStatus.CHECKED_IN,
      });

      await expect(service.completeCheckIn(mockOrgId, mockCheckInId, mockUserId)).rejects.toThrow(
        BadRequestException
      );
    });
  });
});
