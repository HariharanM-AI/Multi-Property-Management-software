import { Test, TestingModule } from '@nestjs/testing';
import { StaffService } from './staff.service';
import { PrismaService } from '../../database/prisma.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { StaffAttendanceStatus } from '@propertyos/types';

describe('StaffService', () => {
  let service: StaffService;
  let prisma: any;

  const mockOrgId = 'org-1111-uuid';
  const mockPropertyId = 'prop-2222-uuid';
  const mockUserId = 'user-3333-uuid';
  const mockStaffId = 'staff-4444-uuid';
  const mockActorId = 'actor-5555-uuid';

  const mockStaffRecord = {
    id: mockStaffId,
    organizationId: mockOrgId,
    propertyId: mockPropertyId,
    userId: mockUserId,
    name: 'Ramesh Singh',
    roleTitle: 'Warden',
    phone: '9876543210',
    salaryMonthly: new Prisma.Decimal(25000),
    joinedDate: new Date('2025-01-15'),
    isActive: true,
    createdAt: new Date('2025-01-15T10:00:00Z'),
    updatedAt: new Date('2025-01-15T10:00:00Z'),
    property: { id: mockPropertyId, name: 'Sunrise PG' },
    user: { id: mockUserId, email: 'ramesh@propertyos.test' },
    _count: { attendance: 12 },
  };

  const mockAttendanceRecord = {
    id: 'att-6666-uuid',
    staffMemberId: mockStaffId,
    date: new Date('2026-08-24T00:00:00.000Z'),
    checkInTime: new Date('2026-08-24T09:00:00.000Z'),
    checkOutTime: new Date('2026-08-24T18:00:00.000Z'),
    status: StaffAttendanceStatus.PRESENT,
    createdAt: new Date('2026-08-24T09:00:00.000Z'),
    staffMember: {
      id: mockStaffId,
      name: 'Ramesh Singh',
      roleTitle: 'Warden',
      property: { id: mockPropertyId, name: 'Sunrise PG' },
    },
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(async (callback) => callback(prisma)),
      $executeRaw: jest.fn().mockResolvedValue(1),
      staffMember: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      staffAttendance: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
        count: jest.fn(),
      },
      property: {
        findFirst: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-log-1' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<StaffService>(StaffService);
  });

  describe('createStaff', () => {
    it('should successfully create a staff member with valid data', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, organizationId: mockOrgId });
      prisma.user.findFirst.mockResolvedValue({ id: mockUserId, organizationId: mockOrgId });
      prisma.staffMember.findUnique.mockResolvedValue(null);
      prisma.staffMember.findFirst.mockResolvedValue(null);
      prisma.staffMember.create.mockResolvedValue(mockStaffRecord);

      const result = await service.createStaff(
        mockOrgId,
        {
          name: 'Ramesh Singh',
          roleTitle: 'Warden',
          phone: '9876543210',
          salaryMonthly: 25000,
          joinedDate: '2025-01-15',
          propertyId: mockPropertyId,
          userId: mockUserId,
        },
        mockActorId
      );

      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(prisma.staffMember.create).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'STAFF_CREATED',
            organizationId: mockOrgId,
          }),
        })
      );
      expect(result.id).toBe(mockStaffId);
      expect(result.name).toBe('Ramesh Singh');
      expect(result.salaryMonthly).toBe(25000);
    });

    it('should accept zero monthly salary (salaryMonthly = 0)', async () => {
      prisma.staffMember.findFirst.mockResolvedValue(null);
      prisma.staffMember.create.mockResolvedValue({
        ...mockStaffRecord,
        salaryMonthly: new Prisma.Decimal(0),
        propertyId: null,
        userId: null,
      });

      const result = await service.createStaff(mockOrgId, {
        name: 'Volunteer Guard',
        roleTitle: 'Night Guard',
        phone: '9876543211',
        salaryMonthly: 0,
        joinedDate: '2025-02-01',
      });

      expect(result.salaryMonthly).toBe(0);
    });

    it('should reject negative monthly salary with BadRequestException', async () => {
      await expect(
        service.createStaff(mockOrgId, {
          name: 'Invalid Staff',
          roleTitle: 'Guard',
          phone: '9876543212',
          salaryMonthly: -5000,
          joinedDate: '2025-02-01',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid joinedDate format', async () => {
      await expect(
        service.createStaff(mockOrgId, {
          name: 'Invalid Date Staff',
          roleTitle: 'Guard',
          phone: '9876543213',
          salaryMonthly: 15000,
          joinedDate: 'not-a-valid-date',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when propertyId belongs to another organization', async () => {
      prisma.property.findFirst.mockResolvedValue(null);

      await expect(
        service.createStaff(mockOrgId, {
          name: 'Staff Other Org',
          roleTitle: 'Guard',
          phone: '9876543214',
          salaryMonthly: 15000,
          joinedDate: '2025-02-01',
          propertyId: 'foreign-property-uuid',
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject when userId belongs to another organization', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.createStaff(mockOrgId, {
          name: 'Staff Other User',
          roleTitle: 'Guard',
          phone: '9876543215',
          salaryMonthly: 15000,
          joinedDate: '2025-02-01',
          userId: 'foreign-user-uuid',
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject when userId is already linked to another staff member', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: mockUserId, organizationId: mockOrgId });
      prisma.staffMember.findUnique.mockResolvedValue({ id: 'existing-staff-id' });

      await expect(
        service.createStaff(mockOrgId, {
          name: 'Duplicate User Link',
          roleTitle: 'Guard',
          phone: '9876543216',
          salaryMonthly: 15000,
          joinedDate: '2025-02-01',
          userId: mockUserId,
        })
      ).rejects.toThrow(ConflictException);
    });

    it('should reject when phone number is already registered for an active staff in the organization', async () => {
      prisma.staffMember.findFirst.mockResolvedValue({ id: 'existing-staff-phone' });

      await expect(
        service.createStaff(mockOrgId, {
          name: 'Duplicate Phone Staff',
          roleTitle: 'Guard',
          phone: '9876543210',
          salaryMonthly: 15000,
          joinedDate: '2025-02-01',
        })
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getStaff & getStaffById', () => {
    it('should list staff members with pagination and filters', async () => {
      prisma.staffMember.findMany.mockResolvedValue([mockStaffRecord]);
      prisma.staffMember.count.mockResolvedValue(1);

      const result = await service.getStaff(mockOrgId, {
        propertyId: mockPropertyId,
        isActive: true,
        search: 'Ramesh',
        page: 1,
        limit: 10,
      });

      expect(result.data.length).toBe(1);
      expect(result.total).toBe(1);
      expect(result.data[0].id).toBe(mockStaffId);
      expect(result.data[0].attendanceCount).toBe(12);
    });

    it('should get single staff member by ID with details', async () => {
      prisma.staffMember.findFirst.mockResolvedValue({
        ...mockStaffRecord,
        attendance: [mockAttendanceRecord],
      });

      const result = await service.getStaffById(mockOrgId, mockStaffId);

      expect(result.id).toBe(mockStaffId);
      expect(result.name).toBe('Ramesh Singh');
    });

    it('should throw NotFoundException if staff member not found in organization', async () => {
      prisma.staffMember.findFirst.mockResolvedValue(null);

      await expect(service.getStaffById(mockOrgId, 'non-existent-id')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('updateStaff', () => {
    it('should successfully update staff member details', async () => {
      prisma.staffMember.findFirst
        .mockResolvedValueOnce(mockStaffRecord) // check exists
        .mockResolvedValueOnce(null); // check duplicate phone
      prisma.staffMember.update.mockResolvedValue({
        ...mockStaffRecord,
        roleTitle: 'Senior Warden',
        salaryMonthly: new Prisma.Decimal(28000),
      });

      const result = await service.updateStaff(
        mockOrgId,
        mockStaffId,
        {
          roleTitle: 'Senior Warden',
          salaryMonthly: 28000,
        },
        mockActorId
      );

      expect(result.roleTitle).toBe('Senior Warden');
      expect(result.salaryMonthly).toBe(28000);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'STAFF_UPDATED',
            resourceId: mockStaffId,
          }),
        })
      );
    });

    it('should reject update with negative salary', async () => {
      prisma.staffMember.findFirst.mockResolvedValue(mockStaffRecord);

      await expect(
        service.updateStaff(mockOrgId, mockStaffId, { salaryMonthly: -1000 })
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject update if foreign property is assigned', async () => {
      prisma.staffMember.findFirst.mockResolvedValue(mockStaffRecord);
      prisma.property.findFirst.mockResolvedValue(null);

      await expect(
        service.updateStaff(mockOrgId, mockStaffId, { propertyId: 'foreign-prop-id' })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivateStaff (Safe Deactivation)', () => {
    it('should safely deactivate staff member (isActive = false) preserving attendance history', async () => {
      prisma.staffMember.findFirst.mockResolvedValue(mockStaffRecord);
      prisma.staffMember.update.mockResolvedValue({ ...mockStaffRecord, isActive: false });

      const result = await service.deactivateStaff(mockOrgId, mockStaffId, mockActorId);

      expect(result.success).toBe(true);
      expect(prisma.staffMember.update).toHaveBeenCalledWith({
        where: { id: mockStaffId },
        data: { isActive: false },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'STAFF_DELETED',
            resourceId: mockStaffId,
          }),
        })
      );
    });

    it('should throw NotFoundException when deactivating nonexistent staff member', async () => {
      prisma.staffMember.findFirst.mockResolvedValue(null);

      await expect(
        service.deactivateStaff(mockOrgId, 'missing-staff-id', mockActorId)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('checkInStaff', () => {
    it('should record daily check-in with advisory lock and write audit log', async () => {
      prisma.staffMember.findFirst.mockResolvedValue(mockStaffRecord);
      prisma.staffAttendance.findUnique.mockResolvedValue(null);
      prisma.staffAttendance.create.mockResolvedValue(mockAttendanceRecord);

      const result = await service.checkInStaff(
        mockOrgId,
        {
          staffMemberId: mockStaffId,
          date: '2026-08-24',
          checkInTime: '2026-08-24T09:00:00Z',
          status: StaffAttendanceStatus.PRESENT,
        },
        mockActorId
      );

      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(prisma.staffAttendance.create).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'STAFF_CHECKED_IN',
          }),
        })
      );
      expect(result.status).toBe(StaffAttendanceStatus.PRESENT);
      expect(result.staffName).toBe('Ramesh Singh');
    });

    it('should reject check-in for inactive staff member', async () => {
      prisma.staffMember.findFirst.mockResolvedValue({ ...mockStaffRecord, isActive: false });

      await expect(
        service.checkInStaff(mockOrgId, {
          staffMemberId: mockStaffId,
          date: '2026-08-24',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject duplicate check-in on the same date with ConflictException', async () => {
      prisma.staffMember.findFirst.mockResolvedValue(mockStaffRecord);
      prisma.staffAttendance.findUnique.mockResolvedValue(mockAttendanceRecord);

      await expect(
        service.checkInStaff(mockOrgId, {
          staffMemberId: mockStaffId,
          date: '2026-08-24',
        })
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('checkOutStaff', () => {
    it('should record check-out time on existing attendance record', async () => {
      prisma.staffMember.findFirst.mockResolvedValue(mockStaffRecord);
      prisma.staffAttendance.findUnique.mockResolvedValue(mockAttendanceRecord);
      prisma.staffAttendance.update.mockResolvedValue({
        ...mockAttendanceRecord,
        checkOutTime: new Date('2026-08-24T18:00:00Z'),
      });

      const result = await service.checkOutStaff(
        mockOrgId,
        {
          staffMemberId: mockStaffId,
          date: '2026-08-24',
          checkOutTime: '2026-08-24T18:00:00Z',
        },
        mockActorId
      );

      expect(prisma.staffAttendance.update).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'STAFF_CHECKED_OUT',
          }),
        })
      );
      expect(result.checkOutTime).toBeTruthy();
    });

    it('should throw NotFoundException if no check-in exists for checkout', async () => {
      prisma.staffMember.findFirst.mockResolvedValue(mockStaffRecord);
      prisma.staffAttendance.findUnique.mockResolvedValue(null);

      await expect(
        service.checkOutStaff(mockOrgId, {
          staffMemberId: mockStaffId,
          date: '2026-08-24',
        })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('recordAttendance (Manual Upsert)', () => {
    it('should upsert attendance record with specified status and times', async () => {
      prisma.staffMember.findFirst.mockResolvedValue(mockStaffRecord);
      prisma.staffAttendance.upsert.mockResolvedValue({
        ...mockAttendanceRecord,
        status: StaffAttendanceStatus.LEAVE,
      });

      const result = await service.recordAttendance(
        mockOrgId,
        {
          staffMemberId: mockStaffId,
          date: '2026-08-24',
          status: StaffAttendanceStatus.LEAVE,
        },
        mockActorId
      );

      expect(prisma.staffAttendance.upsert).toHaveBeenCalled();
      expect(result.status).toBe(StaffAttendanceStatus.LEAVE);
    });
  });

  describe('getAttendanceRecords', () => {
    it('should query attendance records scoped to organization', async () => {
      prisma.staffAttendance.findMany.mockResolvedValue([mockAttendanceRecord]);
      prisma.staffAttendance.count.mockResolvedValue(1);

      const result = await service.getAttendanceRecords(mockOrgId, {
        propertyId: mockPropertyId,
        status: StaffAttendanceStatus.PRESENT,
      });

      expect(result.data.length).toBe(1);
      expect(result.total).toBe(1);
      expect(result.data[0].staffName).toBe('Ramesh Singh');
    });
  });

  describe('getStaffSummary (KPIs & Payroll Aggregate)', () => {
    it('should calculate accurate KPI counts and Decimal payroll summary', async () => {
      prisma.staffMember.count
        .mockResolvedValueOnce(5) // totalStaff
        .mockResolvedValueOnce(4) // activeStaff
        .mockResolvedValueOnce(1); // inactiveStaff

      prisma.staffMember.findMany.mockResolvedValue([
        { salaryMonthly: new Prisma.Decimal(25000) },
        { salaryMonthly: new Prisma.Decimal(18000) },
        { salaryMonthly: new Prisma.Decimal(12000.5) },
        { salaryMonthly: new Prisma.Decimal(15000) },
      ]);

      prisma.staffAttendance.findMany.mockResolvedValue([
        { status: StaffAttendanceStatus.PRESENT },
        { status: StaffAttendanceStatus.PRESENT },
        { status: StaffAttendanceStatus.HALF_DAY },
        { status: StaffAttendanceStatus.LEAVE },
      ]);

      const summary = await service.getStaffSummary(mockOrgId);

      expect(summary.totalStaff).toBe(5);
      expect(summary.activeStaff).toBe(4);
      expect(summary.inactiveStaff).toBe(1);
      expect(summary.presentToday).toBe(3); // 2 PRESENT + 1 HALF_DAY
      expect(summary.onLeaveToday).toBe(1);
      expect(summary.absentToday).toBe(0);
      expect(summary.totalMonthlyPayroll).toBe('70000.50');
    });
  });
});
