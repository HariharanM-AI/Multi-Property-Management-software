import { Test, TestingModule } from '@nestjs/testing';
import { VisitorsService } from './visitors.service';
import { PrismaService } from '../../database/prisma.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

describe('VisitorsService', () => {
  let service: VisitorsService;
  let prisma: any;

  const mockOrgId = 'org-1111-uuid';
  const mockPropertyId = 'prop-2222-uuid';
  const mockTenantId = 'tenant-3333-uuid';
  const mockVisitorId = 'visitor-4444-uuid';
  const mockActorId = 'actor-5555-uuid';

  const mockVisitorRecord = {
    id: mockVisitorId,
    propertyId: mockPropertyId,
    tenantId: mockTenantId,
    visitorName: 'Aditya Verma',
    visitorPhone: '9876543210',
    purpose: 'Personal Visit / Friend',
    gatePassCode: 'GP-20260824-A1B2',
    entryTime: new Date('2026-08-24T10:00:00.000Z'),
    exitTime: null,
    isApproved: true,
    createdAt: new Date('2026-08-24T09:30:00.000Z'),
    property: {
      id: mockPropertyId,
      name: 'Sunrise PG',
      organizationId: mockOrgId,
    },
    tenant: {
      id: mockTenantId,
      firstName: 'Rahul',
      lastName: 'Sharma',
      phone: '9123456789',
      leases: [{ rentalUnit: { unitNumber: 'Flat 302' } }],
      checkIns: [
        {
          propertyId: mockPropertyId,
          rentalUnit: null,
          bed: { room: { roomNumber: '101' }, bedNumber: 'A' },
        },
      ],
    },
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(async (callback) => callback(prisma)),
      $executeRaw: jest.fn().mockResolvedValue(1),
      visitorRecord: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      property: {
        findFirst: jest.fn(),
      },
      tenant: {
        findFirst: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-log-1' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VisitorsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<VisitorsService>(VisitorsService);
  });

  describe('createVisitor', () => {
    it('should successfully register a visitor and generate gatepass code', async () => {
      prisma.property.findFirst.mockResolvedValue({
        id: mockPropertyId,
        organizationId: mockOrgId,
      });
      prisma.tenant.findFirst.mockResolvedValue({
        id: mockTenantId,
        organizationId: mockOrgId,
        leases: [],
        checkIns: [],
      });
      prisma.visitorRecord.findUnique.mockResolvedValue(null);
      prisma.visitorRecord.create.mockResolvedValue(mockVisitorRecord);

      const result = await service.createVisitor(
        mockOrgId,
        {
          propertyId: mockPropertyId,
          tenantId: mockTenantId,
          visitorName: 'Aditya Verma',
          visitorPhone: '9876543210',
          purpose: 'Personal Visit / Friend',
        },
        mockActorId
      );

      expect(result).toBeDefined();
      expect(result.id).toBe(mockVisitorId);
      expect(result.visitorName).toBe('Aditya Verma');
      expect(result.status).toBe('CHECKED_IN');
      expect(result.roomOrUnitNumber).toBe('Room 101 (Bed A)');
      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: mockOrgId,
          action: 'VISITOR_REGISTERED',
          resourceType: 'VISITOR',
          resourceId: mockVisitorId,
        }),
      });
    });

    it('should throw ForbiddenException if caller tenant attempts to register for another tenant', async () => {
      await expect(
        service.createVisitor(
          mockOrgId,
          {
            propertyId: mockPropertyId,
            tenantId: 'other-tenant-id',
            visitorName: 'Aditya Verma',
            visitorPhone: '9876543210',
            purpose: 'Personal Visit',
          },
          mockActorId,
          mockTenantId // caller tenant
        )
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if property is not found in organization', async () => {
      prisma.property.findFirst.mockResolvedValue(null);

      await expect(
        service.createVisitor(mockOrgId, {
          propertyId: mockPropertyId,
          tenantId: mockTenantId,
          visitorName: 'Aditya Verma',
          visitorPhone: '9876543210',
          purpose: 'Personal Visit',
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if host tenant is not found in organization', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId });
      prisma.tenant.findFirst.mockResolvedValue(null);

      await expect(
        service.createVisitor(mockOrgId, {
          propertyId: mockPropertyId,
          tenantId: mockTenantId,
          visitorName: 'Aditya Verma',
          visitorPhone: '9876543210',
          purpose: 'Personal Visit',
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if invalid entryTime is provided', async () => {
      await expect(
        service.createVisitor(mockOrgId, {
          propertyId: mockPropertyId,
          tenantId: mockTenantId,
          visitorName: 'Aditya Verma',
          visitorPhone: '9876543210',
          purpose: 'Personal Visit',
          entryTime: 'invalid-date-string',
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getVisitors', () => {
    it('should list visitors with pagination and filters', async () => {
      prisma.visitorRecord.count.mockResolvedValue(1);
      prisma.visitorRecord.findMany.mockResolvedValue([mockVisitorRecord]);

      const result = await service.getVisitors(mockOrgId, {
        propertyId: mockPropertyId,
        status: 'CHECKED_IN',
        page: 1,
        limit: 10,
      });

      expect(result.total).toBe(1);
      expect(result.data.length).toBe(1);
      expect(result.data[0].gatePassCode).toBe('GP-20260824-A1B2');
      expect(prisma.visitorRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            property: { organizationId: mockOrgId },
            propertyId: mockPropertyId,
            isApproved: true,
            exitTime: null,
          }),
        })
      );
    });

    it('should enforce caller tenant scoping', async () => {
      prisma.visitorRecord.count.mockResolvedValue(1);
      prisma.visitorRecord.findMany.mockResolvedValue([mockVisitorRecord]);

      await service.getVisitors(
        mockOrgId,
        { page: 1, limit: 10 },
        mockTenantId // callerTenantId
      );

      expect(prisma.visitorRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: mockTenantId,
          }),
        })
      );
    });
  });

  describe('getVisitorById', () => {
    it('should return a single visitor record', async () => {
      prisma.visitorRecord.findFirst.mockResolvedValue(mockVisitorRecord);

      const result = await service.getVisitorById(mockOrgId, mockVisitorId);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockVisitorId);
      expect(result.tenantName).toBe('Rahul Sharma');
    });

    it('should throw NotFoundException if visitor not found', async () => {
      prisma.visitorRecord.findFirst.mockResolvedValue(null);

      await expect(
        service.getVisitorById(mockOrgId, 'non-existent-id')
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if caller tenant attempts to view another tenant visitor', async () => {
      prisma.visitorRecord.findFirst.mockResolvedValue(mockVisitorRecord);

      await expect(
        service.getVisitorById(mockOrgId, mockVisitorId, 'other-tenant-id')
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getVisitorByGatePass', () => {
    it('should lookup visitor by uppercase gatepass code', async () => {
      prisma.visitorRecord.findFirst.mockResolvedValue(mockVisitorRecord);

      const result = await service.getVisitorByGatePass(
        mockOrgId,
        'gp-20260824-a1b2'
      );

      expect(result).toBeDefined();
      expect(result.gatePassCode).toBe('GP-20260824-A1B2');
      expect(prisma.visitorRecord.findFirst).toHaveBeenCalledWith({
        where: {
          gatePassCode: 'GP-20260824-A1B2',
          property: { organizationId: mockOrgId },
        },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if gatepass code not found', async () => {
      prisma.visitorRecord.findFirst.mockResolvedValue(null);

      await expect(
        service.getVisitorByGatePass(mockOrgId, 'INVALID-CODE')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('checkInVisitor', () => {
    it('should successfully record physical check-in', async () => {
      const pendingVisitor = {
        ...mockVisitorRecord,
        isApproved: true,
        exitTime: null,
      };
      prisma.visitorRecord.findFirst.mockResolvedValue(pendingVisitor);
      prisma.visitorRecord.update.mockResolvedValue({
        ...pendingVisitor,
        entryTime: new Date('2026-08-24T10:15:00.000Z'),
      });

      const result = await service.checkInVisitor(
        mockOrgId,
        mockVisitorId,
        { entryTime: '2026-08-24T10:15:00.000Z', notes: 'Badge #12 issued' },
        mockActorId
      );

      expect(result).toBeDefined();
      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'VISITOR_CHECKED_IN',
          resourceId: mockVisitorId,
        }),
      });
    });

    it('should throw ForbiddenException if visitor is not approved', async () => {
      prisma.visitorRecord.findFirst.mockResolvedValue({
        ...mockVisitorRecord,
        isApproved: false,
      });

      await expect(
        service.checkInVisitor(mockOrgId, mockVisitorId)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if visitor has already checked out', async () => {
      prisma.visitorRecord.findFirst.mockResolvedValue({
        ...mockVisitorRecord,
        exitTime: new Date('2026-08-24T11:00:00.000Z'),
      });

      await expect(
        service.checkInVisitor(mockOrgId, mockVisitorId)
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('checkOutVisitor', () => {
    it('should successfully check out visitor with advisory lock', async () => {
      prisma.visitorRecord.findFirst.mockResolvedValue({
        ...mockVisitorRecord,
        entryTime: new Date('2026-08-24T10:00:00.000Z'),
        exitTime: null,
      });
      prisma.visitorRecord.update.mockResolvedValue({
        ...mockVisitorRecord,
        entryTime: new Date('2026-08-24T10:00:00.000Z'),
        exitTime: new Date('2026-08-24T11:30:00.000Z'),
      });

      const result = await service.checkOutVisitor(
        mockOrgId,
        mockVisitorId,
        { exitTime: '2026-08-24T11:30:00.000Z', notes: 'Left premises' },
        mockActorId
      );

      expect(result).toBeDefined();
      expect(result.status).toBe('CHECKED_OUT');
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'VISITOR_CHECKED_OUT',
          resourceId: mockVisitorId,
        }),
      });
    });

    it('should throw ConflictException if visitor is already checked out', async () => {
      prisma.visitorRecord.findFirst.mockResolvedValue({
        ...mockVisitorRecord,
        exitTime: new Date('2026-08-24T11:00:00.000Z'),
      });

      await expect(
        service.checkOutVisitor(mockOrgId, mockVisitorId)
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if exitTime is before entryTime', async () => {
      prisma.visitorRecord.findFirst.mockResolvedValue({
        ...mockVisitorRecord,
        entryTime: new Date('2026-08-24T10:00:00.000Z'),
        exitTime: null,
      });

      await expect(
        service.checkOutVisitor(mockOrgId, mockVisitorId, {
          exitTime: '2026-08-24T09:00:00.000Z',
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('approveVisitor & rejectVisitor', () => {
    it('should approve visitor and record audit log', async () => {
      prisma.visitorRecord.findFirst.mockResolvedValue({
        ...mockVisitorRecord,
        isApproved: false,
        exitTime: null,
      });
      prisma.visitorRecord.update.mockResolvedValue({
        ...mockVisitorRecord,
        isApproved: true,
      });

      const result = await service.approveVisitor(
        mockOrgId,
        mockVisitorId,
        mockActorId
      );

      expect(result.isApproved).toBe(true);
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'VISITOR_APPROVED',
        }),
      });
    });

    it('should reject visitor and record audit log', async () => {
      prisma.visitorRecord.findFirst.mockResolvedValue({
        ...mockVisitorRecord,
        isApproved: true,
        exitTime: null,
      });
      prisma.visitorRecord.update.mockResolvedValue({
        ...mockVisitorRecord,
        isApproved: false,
      });

      const result = await service.rejectVisitor(
        mockOrgId,
        mockVisitorId,
        mockActorId
      );

      expect(result.isApproved).toBe(false);
      expect(result.status).toBe('REJECTED');
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'VISITOR_REJECTED',
        }),
      });
    });

    it('should throw ForbiddenException if tenant caller attempts to approve other tenant visitor', async () => {
      prisma.visitorRecord.findFirst.mockResolvedValue(mockVisitorRecord);

      await expect(
        service.approveVisitor(
          mockOrgId,
          mockVisitorId,
          mockActorId,
          'other-tenant-id'
        )
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if attempting to reject visitor who has already checked out', async () => {
      prisma.visitorRecord.findFirst.mockResolvedValue({
        ...mockVisitorRecord,
        exitTime: new Date('2026-08-24T11:00:00.000Z'),
      });

      await expect(
        service.rejectVisitor(mockOrgId, mockVisitorId, mockActorId)
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('deleteVisitor', () => {
    it('should delete visitor record and write audit log', async () => {
      prisma.visitorRecord.findFirst.mockResolvedValue(mockVisitorRecord);
      prisma.visitorRecord.delete.mockResolvedValue(mockVisitorRecord);

      const result = await service.deleteVisitor(
        mockOrgId,
        mockVisitorId,
        mockActorId
      );

      expect(result.success).toBe(true);
      expect(prisma.visitorRecord.delete).toHaveBeenCalledWith({
        where: { id: mockVisitorId },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'VISITOR_DELETED',
        }),
      });
    });

    it('should throw NotFoundException if visitor not found', async () => {
      prisma.visitorRecord.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteVisitor(mockOrgId, 'non-existent')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getVisitorSummary', () => {
    it('should aggregate KPI counts for today, inside, expected, and month', async () => {
      prisma.visitorRecord.count
        .mockResolvedValueOnce(15) // totalToday
        .mockResolvedValueOnce(3) // activeInside
        .mockResolvedValueOnce(2) // expected
        .mockResolvedValueOnce(120); // totalThisMonth

      const result = await service.getVisitorSummary(
        mockOrgId,
        mockPropertyId,
        mockTenantId
      );

      expect(result).toEqual({
        totalVisitorsToday: 15,
        activeVisitorsInside: 3,
        expectedVisitors: 2,
        totalVisitorsThisMonth: 120,
      });
    });
  });
});
