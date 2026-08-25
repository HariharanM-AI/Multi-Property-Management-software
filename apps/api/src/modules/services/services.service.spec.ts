import { Test, TestingModule } from '@nestjs/testing';
import { ServicesService } from './services.service';
import { PrismaService } from '../../database/prisma.service';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  AuthUser,
  UserRole,
  ServiceRequestCategory,
  ServiceRequestPriority,
  ServiceRequestStatus,
  ServiceRequestSlot,
} from '@propertyos/types';
import { Prisma } from '@prisma/client';

describe('ServicesService', () => {
  let service: ServicesService;
  let prisma: any;

  const mockOwnerUser: AuthUser = {
    id: 'user-owner-1',
    email: 'owner@propertyos.test',
    firstName: 'Owner',
    lastName: 'Admin',
    phone: '9876543210',
    organizationId: 'org-1',
    organizationName: 'Test Org',
    roles: [UserRole.OWNER],
  };

  const mockManagerUser: AuthUser = {
    id: 'user-mgr-1',
    email: 'manager@propertyos.test',
    firstName: 'Manager',
    lastName: 'User',
    phone: '9876543211',
    organizationId: 'org-1',
    organizationName: 'Test Org',
    roles: [UserRole.PROPERTY_MANAGER],
  };

  const mockTenantUser: AuthUser = {
    id: 'user-tenant-1',
    email: 'tenant1@propertyos.test',
    firstName: 'Rahul',
    lastName: 'Sharma',
    phone: '9876543222',
    organizationId: 'org-1',
    organizationName: 'Test Org',
    roles: [UserRole.TENANT],
  };

  const mockOtherTenantUser: AuthUser = {
    id: 'user-tenant-2',
    email: 'tenant2@propertyos.test',
    firstName: 'Priya',
    lastName: 'Patel',
    phone: '9876543333',
    organizationId: 'org-1',
    organizationName: 'Test Org',
    roles: [UserRole.TENANT],
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
      tenant: {
        findFirst: jest.fn(),
      },
      checkIn: {
        findMany: jest.fn(),
      },
      lease: {
        findMany: jest.fn(),
      },
      property: {
        findFirst: jest.fn(),
      },
      room: {
        findFirst: jest.fn(),
      },
      rentalUnit: {
        findFirst: jest.fn(),
      },
      staffMember: {
        findFirst: jest.fn(),
      },
      serviceRequest: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        groupBy: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => {
        if (typeof cb === 'function') {
          return cb(prisma);
        }
        return cb;
      }),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ServicesService>(ServicesService);
  });

  describe('createServiceRequest', () => {
    it('should allow active tenant to create a service request on assigned property', async () => {
      prisma.property.findFirst.mockResolvedValue({
        id: 'prop-1',
        organizationId: 'org-1',
        propertyType: 'PG',
      });

      prisma.user.findUnique.mockResolvedValue({ phone: '9876543222', email: 'tenant1@propertyos.test' });
      prisma.tenant.findFirst.mockResolvedValue({ id: 'tenant-1' });
      prisma.checkIn.findMany.mockResolvedValue([{ propertyId: 'prop-1' }]);
      prisma.lease.findMany.mockResolvedValue([]);

      prisma.serviceRequest.create.mockResolvedValue({
        id: 'req-1',
        organizationId: 'org-1',
        propertyId: 'prop-1',
        requesterId: mockTenantUser.id,
        tenantId: 'tenant-1',
        serviceCategory: ServiceRequestCategory.PLUMBING,
        priority: ServiceRequestPriority.HIGH,
        status: ServiceRequestStatus.PENDING,
        title: 'Leaking tap in bathroom',
        description: 'Water is dripping continuously from the washbasin tap',
        requesterName: 'Rahul Sharma',
        requesterRole: UserRole.TENANT,
        contactPhone: '9876543222',
        roomId: null,
        rentalUnitId: null,
        locationDetails: 'Room 201 Bathroom',
        preferredSlot: ServiceRequestSlot.MORNING,
        preferredDate: null,
        scheduledDate: null,
        assignedStaffId: null,
        assignedVendorName: null,
        assignedVendorPhone: null,
        estimatedCost: new Prisma.Decimal('350.00'),
        actualCost: null,
        isPaidByTenant: false,
        resolutionNotes: null,
        completedAt: null,
        cancelledAt: null,
        cancellationReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        property: { id: 'prop-1', name: 'Sunrise PG', code: 'PROP-001', propertyType: 'PG' },
        room: null,
        rentalUnit: null,
        assignedStaff: null,
      });

      const res = await service.createServiceRequest(mockTenantUser, 'org-1', {
        propertyId: 'prop-1',
        serviceCategory: ServiceRequestCategory.PLUMBING,
        priority: ServiceRequestPriority.HIGH,
        title: 'Leaking tap in bathroom',
        description: 'Water is dripping continuously from the washbasin tap',
        locationDetails: 'Room 201 Bathroom',
        preferredSlot: ServiceRequestSlot.MORNING,
        estimatedCost: 350,
      });

      expect(res.id).toBe('req-1');
      expect(res.status).toBe(ServiceRequestStatus.PENDING);
      expect(res.serviceCategory).toBe(ServiceRequestCategory.PLUMBING);
      expect(res.estimatedCost).toBe('350.00');
    });

    it('should reject tenant creating request for unassigned property (403 Forbidden)', async () => {
      prisma.property.findFirst.mockResolvedValue({
        id: 'prop-2',
        organizationId: 'org-1',
        propertyType: 'PG',
      });

      prisma.user.findUnique.mockResolvedValue({ phone: '9876543222', email: 'tenant1@propertyos.test' });
      prisma.tenant.findFirst.mockResolvedValue({ id: 'tenant-1' });
      prisma.checkIn.findMany.mockResolvedValue([{ propertyId: 'prop-1' }]);
      prisma.lease.findMany.mockResolvedValue([]);

      await expect(
        service.createServiceRequest(mockTenantUser, 'org-1', {
          propertyId: 'prop-2',
          serviceCategory: ServiceRequestCategory.ELECTRICAL,
          title: 'Fan making noise',
          description: 'Ceiling fan is making rattling sounds',
        })
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if property does not exist in org', async () => {
      prisma.property.findFirst.mockResolvedValue(null);

      await expect(
        service.createServiceRequest(mockOwnerUser, 'org-1', {
          propertyId: 'nonexistent',
          serviceCategory: ServiceRequestCategory.CARPENTRY,
          title: 'Door handle repair',
          description: 'Front door handle is loose',
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject rental unit targeting on PG property (400 Bad Request)', async () => {
      prisma.property.findFirst.mockResolvedValue({
        id: 'prop-1',
        organizationId: 'org-1',
        propertyType: 'PG',
      });

      await expect(
        service.createServiceRequest(mockOwnerUser, 'org-1', {
          propertyId: 'prop-1',
          serviceCategory: ServiceRequestCategory.PAINTING,
          title: 'Balcony touch-up',
          description: 'Paint peeling on wall',
          rentalUnitId: 'unit-1',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject room targeting on Rental House property (400 Bad Request)', async () => {
      prisma.property.findFirst.mockResolvedValue({
        id: 'prop-2',
        organizationId: 'org-1',
        propertyType: 'RENTAL_HOUSE',
      });

      await expect(
        service.createServiceRequest(mockOwnerUser, 'org-1', {
          propertyId: 'prop-2',
          serviceCategory: ServiceRequestCategory.HOUSEKEEPING,
          title: 'Deep cleaning',
          description: 'Full house deep cleaning required',
          roomId: 'room-1',
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getServiceRequests', () => {
    it('should return paginated requests for owner', async () => {
      prisma.serviceRequest.count.mockResolvedValue(1);
      prisma.serviceRequest.findMany.mockResolvedValue([
        {
          id: 'req-1',
          organizationId: 'org-1',
          propertyId: 'prop-1',
          requesterId: 'user-1',
          serviceCategory: ServiceRequestCategory.APPLIANCE_REPAIR,
          priority: ServiceRequestPriority.MEDIUM,
          status: ServiceRequestStatus.PENDING,
          title: 'AC filter cleaning',
          description: 'AC blowing warm air',
          requesterName: 'Anil Kumar',
          requesterRole: UserRole.TENANT,
          contactPhone: '9876500000',
          preferredSlot: ServiceRequestSlot.EVENING,
          isPaidByTenant: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          property: { id: 'prop-1', name: 'Apex PG', code: 'PROP-001', propertyType: 'PG' },
        },
      ]);

      const res = await service.getServiceRequests(mockOwnerUser, 'org-1', { page: 1, limit: 10 });
      expect(res.total).toBe(1);
      expect(res.data.length).toBe(1);
      expect(res.data[0].serviceCategory).toBe(ServiceRequestCategory.APPLIANCE_REPAIR);
    });

    it('should automatically scope tenant queries to active stay properties', async () => {
      prisma.user.findUnique.mockResolvedValue({ phone: '9876543222', email: 'tenant1@propertyos.test' });
      prisma.tenant.findFirst.mockResolvedValue({ id: 'tenant-1' });
      prisma.checkIn.findMany.mockResolvedValue([{ propertyId: 'prop-1' }]);
      prisma.lease.findMany.mockResolvedValue([]);

      prisma.serviceRequest.count.mockResolvedValue(1);
      prisma.serviceRequest.findMany.mockResolvedValue([]);

      await service.getServiceRequests(mockTenantUser, 'org-1', {});
      expect(prisma.serviceRequest.findMany).toHaveBeenCalled();
    });

    it('should reject tenant querying unassigned property (403 Forbidden)', async () => {
      prisma.user.findUnique.mockResolvedValue({ phone: '9876543222', email: 'tenant1@propertyos.test' });
      prisma.tenant.findFirst.mockResolvedValue({ id: 'tenant-1' });
      prisma.checkIn.findMany.mockResolvedValue([{ propertyId: 'prop-1' }]);
      prisma.lease.findMany.mockResolvedValue([]);

      await expect(
        service.getServiceRequests(mockTenantUser, 'org-1', { propertyId: 'prop-foreign' })
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getServiceRequestById', () => {
    it('should return request details by ID', async () => {
      prisma.serviceRequest.findFirst.mockResolvedValue({
        id: 'req-1',
        organizationId: 'org-1',
        propertyId: 'prop-1',
        requesterId: mockOwnerUser.id,
        serviceCategory: ServiceRequestCategory.PEST_CONTROL,
        priority: ServiceRequestPriority.HIGH,
        status: ServiceRequestStatus.SCHEDULED,
        title: 'Termite inspection',
        description: 'Inspect wooden frames in dining hall',
        requesterName: 'Owner Admin',
        requesterRole: UserRole.OWNER,
        contactPhone: '9876543210',
        preferredSlot: ServiceRequestSlot.MORNING,
        isPaidByTenant: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        property: { id: 'prop-1', name: 'Apex PG', code: 'PROP-001', propertyType: 'PG' },
      });

      const res = await service.getServiceRequestById(mockOwnerUser, 'org-1', 'req-1');
      expect(res.id).toBe('req-1');
      expect(res.serviceCategory).toBe(ServiceRequestCategory.PEST_CONTROL);
    });

    it('should throw NotFoundException if request does not exist', async () => {
      prisma.serviceRequest.findFirst.mockResolvedValue(null);
      await expect(service.getServiceRequestById(mockOwnerUser, 'org-1', 'invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateServiceRequest', () => {
    it('should allow author to update request in PENDING status', async () => {
      prisma.serviceRequest.findFirst.mockResolvedValue({
        id: 'req-1',
        organizationId: 'org-1',
        propertyId: 'prop-1',
        requesterId: mockTenantUser.id,
        status: ServiceRequestStatus.PENDING,
        property: { propertyType: 'PG' },
      });

      prisma.serviceRequest.update.mockResolvedValue({
        id: 'req-1',
        organizationId: 'org-1',
        propertyId: 'prop-1',
        requesterId: mockTenantUser.id,
        serviceCategory: ServiceRequestCategory.PLUMBING,
        priority: ServiceRequestPriority.URGENT,
        status: ServiceRequestStatus.PENDING,
        title: 'Major water pipe leak',
        description: 'Urgent leak under sink',
        requesterName: 'Rahul Sharma',
        requesterRole: UserRole.TENANT,
        contactPhone: '9876543222',
        preferredSlot: ServiceRequestSlot.MORNING,
        isPaidByTenant: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        property: { id: 'prop-1', name: 'Apex PG', code: 'PROP-001', propertyType: 'PG' },
      });

      const res = await service.updateServiceRequest(mockTenantUser, 'org-1', 'req-1', {
        title: 'Major water pipe leak',
        priority: ServiceRequestPriority.URGENT,
      });

      expect(res.title).toBe('Major water pipe leak');
      expect(res.priority).toBe(ServiceRequestPriority.URGENT);
    });

    it('should reject non-author non-moderator tenant (403 Forbidden)', async () => {
      prisma.serviceRequest.findFirst.mockResolvedValue({
        id: 'req-1',
        organizationId: 'org-1',
        propertyId: 'prop-1',
        requesterId: mockTenantUser.id,
        status: ServiceRequestStatus.PENDING,
        property: { propertyType: 'PG' },
      });

      await expect(
        service.updateServiceRequest(mockOtherTenantUser, 'org-1', 'req-1', { title: 'Hacked title' })
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('assignServiceRequest', () => {
    it('should allow manager to assign staff with advisory lock', async () => {
      prisma.serviceRequest.findFirst.mockResolvedValue({
        id: 'req-1',
        organizationId: 'org-1',
        propertyId: 'prop-1',
        status: ServiceRequestStatus.PENDING,
      });

      prisma.staffMember.findFirst.mockResolvedValue({
        id: 'staff-1',
        organizationId: 'org-1',
        name: 'Gopal Plumber',
        isActive: true,
      });

      prisma.serviceRequest.update.mockResolvedValue({
        id: 'req-1',
        organizationId: 'org-1',
        propertyId: 'prop-1',
        requesterId: mockTenantUser.id,
        serviceCategory: ServiceRequestCategory.PLUMBING,
        priority: ServiceRequestPriority.HIGH,
        status: ServiceRequestStatus.SCHEDULED,
        title: 'Tap repair',
        description: 'Dripping tap',
        requesterName: 'Rahul Sharma',
        requesterRole: UserRole.TENANT,
        contactPhone: '9876543222',
        preferredSlot: ServiceRequestSlot.MORNING,
        assignedStaffId: 'staff-1',
        isPaidByTenant: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        property: { id: 'prop-1', name: 'Apex PG', code: 'PROP-001', propertyType: 'PG' },
        assignedStaff: { id: 'staff-1', name: 'Gopal Plumber', roleTitle: 'Plumber', phone: '9876500001' },
      });

      const res = await service.assignServiceRequest(mockManagerUser, 'org-1', 'req-1', {
        assignedStaffId: 'staff-1',
        scheduledDate: '2026-08-26T10:00:00Z',
      });

      expect(res.status).toBe(ServiceRequestStatus.SCHEDULED);
      expect(res.assignedStaffId).toBe('staff-1');
    });

    it('should reject tenant attempting to assign staff (403 Forbidden)', async () => {
      await expect(
        service.assignServiceRequest(mockTenantUser, 'org-1', 'req-1', { assignedStaffId: 'staff-1' })
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateServiceRequestStatus', () => {
    it('should allow manager to complete request with resolution notes and actual cost', async () => {
      prisma.serviceRequest.findFirst.mockResolvedValue({
        id: 'req-1',
        organizationId: 'org-1',
        requesterId: mockTenantUser.id,
        status: ServiceRequestStatus.IN_PROGRESS,
      });

      prisma.serviceRequest.update.mockResolvedValue({
        id: 'req-1',
        organizationId: 'org-1',
        propertyId: 'prop-1',
        requesterId: mockTenantUser.id,
        serviceCategory: ServiceRequestCategory.PLUMBING,
        priority: ServiceRequestPriority.HIGH,
        status: ServiceRequestStatus.COMPLETED,
        title: 'Tap repair',
        description: 'Dripping tap',
        requesterName: 'Rahul Sharma',
        requesterRole: UserRole.TENANT,
        contactPhone: '9876543222',
        preferredSlot: ServiceRequestSlot.MORNING,
        actualCost: new Prisma.Decimal('450.00'),
        resolutionNotes: 'Replaced tap washer and tightened valve',
        isPaidByTenant: true,
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        property: { id: 'prop-1', name: 'Apex PG', code: 'PROP-001', propertyType: 'PG' },
      });

      const res = await service.updateServiceRequestStatus(mockManagerUser, 'org-1', 'req-1', {
        status: ServiceRequestStatus.COMPLETED,
        resolutionNotes: 'Replaced tap washer and tightened valve',
        actualCost: 450,
        isPaidByTenant: true,
      });

      expect(res.status).toBe(ServiceRequestStatus.COMPLETED);
      expect(res.actualCost).toBe('450.00');
      expect(res.isPaidByTenant).toBe(true);
    });

    it('should allow author to cancel their own pending request', async () => {
      prisma.serviceRequest.findFirst.mockResolvedValue({
        id: 'req-1',
        organizationId: 'org-1',
        requesterId: mockTenantUser.id,
        status: ServiceRequestStatus.PENDING,
      });

      prisma.serviceRequest.update.mockResolvedValue({
        id: 'req-1',
        organizationId: 'org-1',
        propertyId: 'prop-1',
        requesterId: mockTenantUser.id,
        serviceCategory: ServiceRequestCategory.PLUMBING,
        priority: ServiceRequestPriority.HIGH,
        status: ServiceRequestStatus.CANCELLED,
        title: 'Tap repair',
        description: 'Dripping tap',
        requesterName: 'Rahul Sharma',
        requesterRole: UserRole.TENANT,
        contactPhone: '9876543222',
        preferredSlot: ServiceRequestSlot.MORNING,
        cancellationReason: 'Fixed it myself',
        cancelledAt: new Date(),
        isPaidByTenant: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        property: { id: 'prop-1', name: 'Apex PG', code: 'PROP-001', propertyType: 'PG' },
      });

      const res = await service.updateServiceRequestStatus(mockTenantUser, 'org-1', 'req-1', {
        status: ServiceRequestStatus.CANCELLED,
        cancellationReason: 'Fixed it myself',
      });

      expect(res.status).toBe(ServiceRequestStatus.CANCELLED);
      expect(res.cancellationReason).toBe('Fixed it myself');
    });

    it('should reject status change on already cancelled request (409 Conflict)', async () => {
      prisma.serviceRequest.findFirst.mockResolvedValue({
        id: 'req-1',
        organizationId: 'org-1',
        requesterId: mockTenantUser.id,
        status: ServiceRequestStatus.CANCELLED,
      });

      await expect(
        service.updateServiceRequestStatus(mockManagerUser, 'org-1', 'req-1', {
          status: ServiceRequestStatus.IN_PROGRESS,
        })
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('deleteServiceRequest', () => {
    it('should allow owner to soft-delete request with advisory lock', async () => {
      prisma.serviceRequest.findFirst.mockResolvedValue({
        id: 'req-1',
        organizationId: 'org-1',
        title: 'Old request',
        serviceCategory: ServiceRequestCategory.OTHER,
      });

      prisma.serviceRequest.update.mockResolvedValue({});

      const res = await service.deleteServiceRequest(mockOwnerUser, 'org-1', 'req-1');
      expect(res.success).toBe(true);
    });

    it('should reject tenant from deleting service request (403 Forbidden)', async () => {
      await expect(service.deleteServiceRequest(mockTenantUser, 'org-1', 'req-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getSummary', () => {
    it('should compute exact decimal aggregates and category breakdown', async () => {
      prisma.serviceRequest.count
        .mockResolvedValueOnce(5) // total
        .mockResolvedValueOnce(2) // pending
        .mockResolvedValueOnce(1) // scheduled
        .mockResolvedValueOnce(1) // in_progress
        .mockResolvedValueOnce(1) // completed
        .mockResolvedValueOnce(0); // cancelled

      prisma.serviceRequest.findMany.mockResolvedValue([
        { actualCost: new Prisma.Decimal('450.50'), estimatedCost: new Prisma.Decimal('400.00') },
        { actualCost: null, estimatedCost: new Prisma.Decimal('1200.00') },
      ]);

      prisma.serviceRequest.groupBy.mockResolvedValue([
        { serviceCategory: ServiceRequestCategory.PLUMBING, _count: { id: 3 } },
        { serviceCategory: ServiceRequestCategory.ELECTRICAL, _count: { id: 2 } },
      ]);

      const summary = await service.getSummary(mockOwnerUser, 'org-1');
      expect(summary.totalRequests).toBe(5);
      expect(summary.pendingRequests).toBe(2);
      expect(summary.totalActualCost).toBe('450.50');
      expect(summary.totalEstimatedCost).toBe('1600.00');
      expect(summary.categoryBreakdown.length).toBe(2);
    });
  });
});
