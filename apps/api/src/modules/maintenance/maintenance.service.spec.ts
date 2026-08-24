import { Test, TestingModule } from '@nestjs/testing';
import { MaintenanceService } from './maintenance.service';
import { PrismaService } from '../../database/prisma.service';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceStatus,
  MaintenanceTargetType,
  MaintenanceAttachmentType,
  MaintenanceVendorStatus,
  UserRole,
} from '@propertyos/types';
import { Prisma } from '@prisma/client';

describe('MaintenanceService', () => {
  let service: MaintenanceService;
  let prisma: any;

  const mockOrgId = 'org-11111111-1111-1111-1111-111111111111';
  const mockUserId = 'user-11111111-1111-1111-1111-111111111111';
  const mockStaffId = 'staff-22222222-2222-2222-2222-222222222222';
  const mockPgPropertyId = 'prop-pg-1111-1111-1111-111111111111';
  const mockRentalPropertyId = 'prop-rental-2222-2222-2222-222222222222';
  const mockTicketId = 'tkt-11111111-1111-1111-1111-111111111111';
  const mockVendorId = 'vendor-11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    const mockPrismaService: any = {
      property: {
        findFirst: jest.fn(),
      },
      floor: {
        findFirst: jest.fn(),
      },
      room: {
        findFirst: jest.fn(),
      },
      bed: {
        findFirst: jest.fn(),
      },
      rentalUnit: {
        findFirst: jest.fn(),
      },
      tenant: {
        findFirst: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
      },
      maintenanceTicket: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        aggregate: jest.fn(),
      },
      maintenanceComment: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      maintenanceAttachment: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      maintenanceAssignment: {
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      maintenanceStatusHistory: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      maintenanceVendor: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      $executeRaw: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn((callback: (tx: any) => any) => callback(mockPrismaService)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<MaintenanceService>(MaintenanceService);
    prisma = module.get(PrismaService);
  });

  // ============================================================================
  // 1. TICKET CREATION & TARGET VALIDATION
  // ============================================================================

  describe('createTicket', () => {
    it('should successfully create a maintenance ticket for a PG room', async () => {
      prisma.property.findFirst.mockResolvedValue({
        id: mockPgPropertyId,
        organizationId: mockOrgId,
        propertyType: 'PG',
      });
      prisma.room.findFirst.mockResolvedValue({
        id: 'room-1',
        propertyId: mockPgPropertyId,
      });
      prisma.maintenanceTicket.count.mockResolvedValue(0);
      prisma.maintenanceTicket.create.mockResolvedValue({
        id: mockTicketId,
        ticketNumber: 'TKT-2026-000001',
        organizationId: mockOrgId,
        propertyId: mockPgPropertyId,
        roomId: 'room-1',
        title: 'Leaking Faucet',
        description: 'Water leaking in bathroom',
        category: MaintenanceCategory.PLUMBING,
        priority: MaintenancePriority.HIGH,
        status: MaintenanceStatus.OPEN,
      });
      prisma.maintenanceStatusHistory.create.mockResolvedValue({ id: 'hist-1' });

      const result = await service.createTicket(
        mockOrgId,
        mockUserId,
        [UserRole.OWNER],
        {
          propertyId: mockPgPropertyId,
          targetType: MaintenanceTargetType.ROOM,
          roomId: 'room-1',
          title: 'Leaking Faucet',
          description: 'Water leaking in bathroom',
          category: MaintenanceCategory.PLUMBING,
          priority: MaintenancePriority.HIGH,
        }
      );

      expect(result.id).toBe(mockTicketId);
      expect(result.ticketNumber).toBe('TKT-2026-000001');
      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(prisma.maintenanceTicket.create).toHaveBeenCalled();
      expect(prisma.maintenanceStatusHistory.create).toHaveBeenCalled();
    });

    it('should reject non-existent property with 404 Not Found', async () => {
      prisma.property.findFirst.mockResolvedValue(null);

      await expect(
        service.createTicket(mockOrgId, mockUserId, [UserRole.OWNER], {
          propertyId: 'non-existent-prop',
          title: 'Broken Light',
          description: 'Light fixture broken',
          category: MaintenanceCategory.ELECTRICAL,
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject rental unit targeting on a PG property with 400 Bad Request', async () => {
      prisma.property.findFirst.mockResolvedValue({
        id: mockPgPropertyId,
        organizationId: mockOrgId,
        propertyType: 'PG',
      });

      await expect(
        service.createTicket(
          mockOrgId,
          mockUserId,
          [UserRole.OWNER],
          {
            propertyId: mockPgPropertyId,
            targetType: MaintenanceTargetType.RENTAL_UNIT,
            rentalUnitId: 'unit-1',
            title: 'Broken Door',
            description: 'Unit door lock damaged',
            category: MaintenanceCategory.CARPENTRY,
          }
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject PG room targeting on a RENTAL_HOUSE property with 400 Bad Request', async () => {
      prisma.property.findFirst.mockResolvedValue({
        id: mockRentalPropertyId,
        organizationId: mockOrgId,
        propertyType: 'RENTAL_HOUSE',
      });

      await expect(
        service.createTicket(
          mockOrgId,
          mockUserId,
          [UserRole.OWNER],
          {
            propertyId: mockRentalPropertyId,
            targetType: MaintenanceTargetType.ROOM,
            roomId: 'room-1',
            title: 'Broken Light',
            description: 'Room light is flickering',
            category: MaintenanceCategory.ELECTRICAL,
          }
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject cost modification by tenant users with 403 Forbidden', async () => {
      prisma.property.findFirst.mockResolvedValue({
        id: mockPgPropertyId,
        organizationId: mockOrgId,
        propertyType: 'PG',
      });
      prisma.tenant.findFirst.mockResolvedValue({
        id: 'tenant-1',
        organizationId: mockOrgId,
      });

      await expect(
        service.createTicket(
          mockOrgId,
          mockUserId,
          [UserRole.TENANT],
          {
            propertyId: mockPgPropertyId,
            title: 'Broken Chair',
            description: 'Study chair leg is broken',
            category: MaintenanceCategory.FURNITURE,
            estimatedCost: 1500,
          }
        )
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject negative estimated cost with 400 Bad Request', async () => {
      prisma.property.findFirst.mockResolvedValue({
        id: mockPgPropertyId,
        organizationId: mockOrgId,
        propertyType: 'PG',
      });

      await expect(
        service.createTicket(
          mockOrgId,
          mockUserId,
          [UserRole.OWNER],
          {
            propertyId: mockPgPropertyId,
            title: 'Broken Chair',
            description: 'Study chair leg is broken',
            category: MaintenanceCategory.FURNITURE,
            estimatedCost: -500,
          }
        )
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================================================
  // 2. ASSIGNMENT & REASSIGNMENT
  // ============================================================================

  describe('assignTicket & unassignTicket', () => {
    it('should assign ticket to staff and transition OPEN status to ASSIGNED', async () => {
      prisma.maintenanceTicket.findFirst.mockResolvedValue({
        id: mockTicketId,
        organizationId: mockOrgId,
        status: MaintenanceStatus.OPEN,
      });
      prisma.user.findFirst.mockResolvedValue({
        id: mockStaffId,
        organizationId: mockOrgId,
        firstName: 'Ramesh',
        lastName: 'Sharma',
      });
      prisma.maintenanceAssignment.updateMany.mockResolvedValue({ count: 0 });
      prisma.maintenanceAssignment.create.mockResolvedValue({ id: 'assign-1' });
      prisma.maintenanceTicket.update.mockResolvedValue({
        id: mockTicketId,
        status: MaintenanceStatus.ASSIGNED,
        assignedToId: mockStaffId,
      });
      prisma.maintenanceStatusHistory.create.mockResolvedValue({ id: 'hist-2' });

      const result = await service.assignTicket(
        mockOrgId,
        mockUserId,
        [UserRole.OWNER],
        mockTicketId,
        { assignedToId: mockStaffId, notes: 'Please inspect ASAP' }
      );

      expect(result.status).toBe(MaintenanceStatus.ASSIGNED);
      expect(result.assignedToId).toBe(mockStaffId);
      expect(prisma.maintenanceAssignment.create).toHaveBeenCalled();
      expect(prisma.maintenanceStatusHistory.create).toHaveBeenCalled();
    });

    it('should reject assignment to a user in another organization with 404 Not Found', async () => {
      prisma.maintenanceTicket.findFirst.mockResolvedValue({
        id: mockTicketId,
        organizationId: mockOrgId,
        status: MaintenanceStatus.OPEN,
      });
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.assignTicket(
          mockOrgId,
          mockUserId,
          [UserRole.OWNER],
          mockTicketId,
          { assignedToId: 'cross-org-user' }
        )
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject assignment of a CLOSED ticket with 409 Conflict', async () => {
      prisma.maintenanceTicket.findFirst.mockResolvedValue({
        id: mockTicketId,
        organizationId: mockOrgId,
        status: MaintenanceStatus.CLOSED,
      });

      await expect(
        service.assignTicket(
          mockOrgId,
          mockUserId,
          [UserRole.OWNER],
          mockTicketId,
          { assignedToId: mockStaffId }
        )
      ).rejects.toThrow(ConflictException);
    });

    it('should unassign staff and transition ASSIGNED ticket back to OPEN', async () => {
      prisma.maintenanceTicket.findFirst.mockResolvedValue({
        id: mockTicketId,
        organizationId: mockOrgId,
        status: MaintenanceStatus.ASSIGNED,
        assignedToId: mockStaffId,
      });
      prisma.maintenanceAssignment.updateMany.mockResolvedValue({ count: 1 });
      prisma.maintenanceTicket.update.mockResolvedValue({
        id: mockTicketId,
        status: MaintenanceStatus.OPEN,
        assignedToId: null,
      });

      const result = await service.unassignTicket(mockOrgId, mockUserId, mockTicketId);
      expect(result.status).toBe(MaintenanceStatus.OPEN);
      expect(result.assignedToId).toBeNull();
      expect(prisma.maintenanceAssignment.updateMany).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // 3. STATUS LIFECYCLE & STATE MACHINE
  // ============================================================================

  describe('status transitions', () => {
    it('should start work and transition ASSIGNED to IN_PROGRESS', async () => {
      prisma.maintenanceTicket.findFirst.mockResolvedValue({
        id: mockTicketId,
        organizationId: mockOrgId,
        status: MaintenanceStatus.ASSIGNED,
      });
      prisma.maintenanceTicket.update.mockResolvedValue({
        id: mockTicketId,
        status: MaintenanceStatus.IN_PROGRESS,
      });
      prisma.maintenanceStatusHistory.create.mockResolvedValue({ id: 'hist-3' });

      const result = await service.startTicket(mockOrgId, mockUserId, mockTicketId);
      expect(result.status).toBe(MaintenanceStatus.IN_PROGRESS);
      expect(prisma.$executeRaw).toHaveBeenCalled();
    });

    it('should reject invalid transition from OPEN directly to VERIFIED with 409 Conflict', async () => {
      prisma.maintenanceTicket.findFirst.mockResolvedValue({
        id: mockTicketId,
        organizationId: mockOrgId,
        status: MaintenanceStatus.OPEN,
      });

      await expect(
        service.verifyTicket(mockOrgId, mockUserId, mockTicketId)
      ).rejects.toThrow(ConflictException);
    });

    it('should complete work and transition IN_PROGRESS to COMPLETED', async () => {
      prisma.maintenanceTicket.findFirst.mockResolvedValue({
        id: mockTicketId,
        organizationId: mockOrgId,
        status: MaintenanceStatus.IN_PROGRESS,
        actualCost: null,
      });
      prisma.maintenanceTicket.update.mockResolvedValue({
        id: mockTicketId,
        status: MaintenanceStatus.COMPLETED,
        actualCost: new Prisma.Decimal(500),
      });
      prisma.maintenanceStatusHistory.create.mockResolvedValue({ id: 'hist-4' });

      const result = await service.completeTicket(
        mockOrgId,
        mockUserId,
        [UserRole.MAINTENANCE_STAFF],
        mockTicketId,
        { actualCost: 500, resolutionNotes: 'Replaced washers and checked flow' }
      );

      expect(result.status).toBe(MaintenanceStatus.COMPLETED);
    });

    it('should reject actual cost recording by TENANT with 403 Forbidden', async () => {
      await expect(
        service.completeTicket(
          mockOrgId,
          mockUserId,
          [UserRole.TENANT],
          mockTicketId,
          { actualCost: 500, resolutionNotes: 'Work completed' }
        )
      ).rejects.toThrow(ForbiddenException);
    });

    it('should verify work and transition COMPLETED to VERIFIED', async () => {
      prisma.maintenanceTicket.findFirst.mockResolvedValue({
        id: mockTicketId,
        organizationId: mockOrgId,
        status: MaintenanceStatus.COMPLETED,
      });
      prisma.maintenanceTicket.update.mockResolvedValue({
        id: mockTicketId,
        status: MaintenanceStatus.VERIFIED,
      });
      prisma.maintenanceStatusHistory.create.mockResolvedValue({ id: 'hist-5' });

      const result = await service.verifyTicket(mockOrgId, mockUserId, mockTicketId);
      expect(result.status).toBe(MaintenanceStatus.VERIFIED);
    });

    it('should close ticket and transition VERIFIED to CLOSED', async () => {
      prisma.maintenanceTicket.findFirst.mockResolvedValue({
        id: mockTicketId,
        organizationId: mockOrgId,
        status: MaintenanceStatus.VERIFIED,
      });
      prisma.maintenanceTicket.update.mockResolvedValue({
        id: mockTicketId,
        status: MaintenanceStatus.CLOSED,
      });
      prisma.maintenanceStatusHistory.create.mockResolvedValue({ id: 'hist-6' });

      const result = await service.closeTicket(mockOrgId, mockUserId, mockTicketId);
      expect(result.status).toBe(MaintenanceStatus.CLOSED);
    });

    it('should cancel OPEN ticket with a reason', async () => {
      prisma.maintenanceTicket.findFirst.mockResolvedValue({
        id: mockTicketId,
        organizationId: mockOrgId,
        status: MaintenanceStatus.OPEN,
      });
      prisma.maintenanceTicket.update.mockResolvedValue({
        id: mockTicketId,
        status: MaintenanceStatus.CANCELLED,
      });
      prisma.maintenanceStatusHistory.create.mockResolvedValue({ id: 'hist-7' });

      const result = await service.cancelTicket(
        mockOrgId,
        mockUserId,
        mockTicketId,
        { reason: 'Issue resolved by tenant independently' }
      );

      expect(result.status).toBe(MaintenanceStatus.CANCELLED);
    });

    it('should reject cancelling a CLOSED ticket with 409 Conflict', async () => {
      prisma.maintenanceTicket.findFirst.mockResolvedValue({
        id: mockTicketId,
        organizationId: mockOrgId,
        status: MaintenanceStatus.CLOSED,
      });

      await expect(
        service.cancelTicket(
          mockOrgId,
          mockUserId,
          mockTicketId,
          { reason: 'Cannot cancel closed' }
        )
      ).rejects.toThrow(ConflictException);
    });
  });

  // ============================================================================
  // 4. COST MANAGEMENT & DECIMAL PROTECTION
  // ============================================================================

  describe('updateCost', () => {
    it('should update estimated and actual cost for authorized manager', async () => {
      prisma.maintenanceTicket.findFirst.mockResolvedValue({
        id: mockTicketId,
        organizationId: mockOrgId,
        estimatedCost: null,
        actualCost: null,
      });
      prisma.maintenanceTicket.update.mockResolvedValue({
        id: mockTicketId,
        estimatedCost: new Prisma.Decimal(1200),
        actualCost: new Prisma.Decimal(1150),
      });

      const result = await service.updateCost(
        mockOrgId,
        mockUserId,
        mockTicketId,
        { estimatedCost: 1200, actualCost: 1150 }
      );

      expect(result.estimatedCost).toEqual(new Prisma.Decimal(1200));
      expect(result.actualCost).toEqual(new Prisma.Decimal(1150));
      expect(prisma.$executeRaw).toHaveBeenCalled();
    });

    it('should reject negative cost updates with 400 Bad Request', async () => {
      prisma.maintenanceTicket.findFirst.mockResolvedValue({
        id: mockTicketId,
        organizationId: mockOrgId,
      });

      await expect(
        service.updateCost(
          mockOrgId,
          mockUserId,
          mockTicketId,
          { estimatedCost: -100 }
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject cost update by tenant with 403 Forbidden', async () => {
      await expect(
        service.updateCost(
          mockOrgId,
          mockUserId,
          mockTicketId,
          { estimatedCost: 500 },
          [UserRole.TENANT]
        )
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ============================================================================
  // 5. VENDORS & ADVISORY LOCKING
  // ============================================================================

  describe('vendors', () => {
    it('should create vendor and acquire advisory lock', async () => {
      prisma.maintenanceVendor.findFirst.mockResolvedValue(null);
      prisma.maintenanceVendor.create.mockResolvedValue({
        id: mockVendorId,
        organizationId: mockOrgId,
        name: 'Cool Air Services',
        phone: '9876543210',
        category: MaintenanceCategory.AC_SERVICE,
        status: MaintenanceVendorStatus.ACTIVE,
      });

      const result = await service.createVendor(mockOrgId, mockUserId, {
        name: 'Cool Air Services',
        phone: '9876543210',
        category: MaintenanceCategory.AC_SERVICE,
      });

      expect(result.id).toBe(mockVendorId);
      expect(result.name).toBe('Cool Air Services');
      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(prisma.maintenanceVendor.create).toHaveBeenCalled();
    });

    it('should reject duplicate vendor name in organization with 409 Conflict', async () => {
      prisma.maintenanceVendor.findFirst.mockResolvedValue({
        id: 'existing-vendor',
        name: 'Cool Air Services',
        organizationId: mockOrgId,
      });

      await expect(
        service.createVendor(mockOrgId, mockUserId, {
          name: 'Cool Air Services',
          phone: '9876543210',
        })
      ).rejects.toThrow(ConflictException);
    });
  });

  // ============================================================================
  // 6. COMMENTS & ATTACHMENTS
  // ============================================================================

  describe('comments & attachments', () => {
    it('should add comment to ticket', async () => {
      prisma.maintenanceTicket.findFirst.mockResolvedValue({
        id: mockTicketId,
        organizationId: mockOrgId,
      });
      prisma.maintenanceComment.create.mockResolvedValue({
        id: 'comment-1',
        ticketId: mockTicketId,
        body: 'Parts ordered from vendor',
      });

      const result = await service.addComment(mockOrgId, mockUserId, mockTicketId, {
        body: 'Parts ordered from vendor',
      });

      expect(result.id).toBe('comment-1');
      expect(prisma.maintenanceComment.create).toHaveBeenCalled();
    });

    it('should add attachment metadata', async () => {
      prisma.maintenanceTicket.findFirst.mockResolvedValue({
        id: mockTicketId,
        organizationId: mockOrgId,
      });
      prisma.maintenanceAttachment.create.mockResolvedValue({
        id: 'att-1',
        ticketId: mockTicketId,
        type: MaintenanceAttachmentType.BEFORE,
        fileName: 'broken-pipe.jpg',
      });

      const result = await service.addAttachment(mockOrgId, mockUserId, mockTicketId, {
        type: MaintenanceAttachmentType.BEFORE,
        fileName: 'broken-pipe.jpg',
        storagePath: '/uploads/org-1/maintenance/broken-pipe.jpg',
        mimeType: 'image/jpeg',
        fileSize: 102400,
      });

      expect(result.id).toBe('att-1');
      expect(prisma.maintenanceAttachment.create).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // 7. MULTI-TENANT ISOLATION & SUMMARIES
  // ============================================================================

  describe('multi-tenant isolation & summary', () => {
    it('should fail closed with 404 when ticket belongs to another organization', async () => {
      prisma.maintenanceTicket.findFirst.mockResolvedValue(null);

      await expect(
        service.getTicketById('org-2', mockUserId, [UserRole.OWNER], mockTicketId)
      ).rejects.toThrow(NotFoundException);
    });

    it('should sanitize cost fields when tenant queries tickets', async () => {
      prisma.maintenanceTicket.count.mockResolvedValue(1);
      prisma.maintenanceTicket.findMany.mockResolvedValue([
        {
          id: mockTicketId,
          title: 'Faucet Leak',
          estimatedCost: new Prisma.Decimal(500),
          actualCost: new Prisma.Decimal(450),
          createdById: mockUserId,
        },
      ]);

      const result = await service.getTickets(
        mockOrgId,
        mockUserId,
        [UserRole.TENANT],
        {}
      );

      expect(result.data[0].estimatedCost).toBeNull();
      expect(result.data[0].actualCost).toBeNull();
    });

    it('should compute organization maintenance summary KPIs correctly', async () => {
      prisma.maintenanceTicket.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(3)  // open
        .mockResolvedValueOnce(2)  // assigned
        .mockResolvedValueOnce(2)  // in_progress
        .mockResolvedValueOnce(1)  // urgent
        .mockResolvedValueOnce(2)  // completed
        .mockResolvedValueOnce(1)  // completed today
        .mockResolvedValueOnce(1); // closed

      prisma.maintenanceTicket.findMany.mockResolvedValue([
        {
          createdAt: new Date('2026-08-24T10:00:00Z'),
          completedAt: new Date('2026-08-24T14:00:00Z'), // 4 hours
        },
      ]);

      prisma.maintenanceTicket.aggregate.mockResolvedValue({
        _sum: {
          estimatedCost: new Prisma.Decimal(5000),
          actualCost: new Prisma.Decimal(4800),
        },
      });

      const summary = await service.getSummary(mockOrgId);

      expect(summary.totalTickets).toBe(10);
      expect(summary.openTickets).toBe(3);
      expect(summary.avgResolutionHours).toBe(4);
      expect(summary.totalEstimatedCost).toBe('5000');
      expect(summary.totalActualCost).toBe('4800');
    });
  });
});

