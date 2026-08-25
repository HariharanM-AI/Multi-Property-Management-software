import { Test, TestingModule } from '@nestjs/testing';
import { MarketplaceService } from './marketplace.service';
import { PrismaService } from '../../database/prisma.service';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  UserRole,
  MarketplaceCategory,
  MarketplaceItemCondition,
  MarketplaceListingStatus,
  AuthenticatedUser,
} from '@propertyos/types';
import { Prisma } from '@prisma/client';

describe('MarketplaceService', () => {
  let service: MarketplaceService;
  let prisma: any;

  const mockOrgId = '00000000-0000-4000-a000-000000000001';
  const mockPropId = '00000000-0000-4000-a000-000000000002';
  const foreignPropId = '00000000-0000-4000-a000-000000000099';
  const mockUserId = '00000000-0000-4000-a000-000000000003';
  const otherUserId = '00000000-0000-4000-a000-000000000004';
  const mockTenantId = '00000000-0000-4000-a000-000000000005';
  const mockListingId = '00000000-0000-4000-a000-000000000006';

  const ownerUser: AuthenticatedUser = {
    id: mockUserId,
    email: 'owner@propertyos.test',
    firstName: 'Ramesh',
    lastName: 'Sharma',
    phone: '9876543210',
    organizationId: mockOrgId,
    isActive: true,
    roles: [UserRole.OWNER],
    permissions: [],
  };

  const managerUser: AuthenticatedUser = {
    id: '00000000-0000-4000-a000-000000000008',
    email: 'manager@propertyos.test',
    firstName: 'Priya',
    lastName: 'Patel',
    phone: '9876543211',
    organizationId: mockOrgId,
    isActive: true,
    roles: [UserRole.PROPERTY_MANAGER],
    permissions: [],
  };

  const wardenUser: AuthenticatedUser = {
    id: '00000000-0000-4000-a000-000000000009',
    email: 'warden@propertyos.test',
    firstName: 'Vikas',
    lastName: 'Gupta',
    phone: '9876543212',
    organizationId: mockOrgId,
    isActive: true,
    roles: [UserRole.WARDEN],
    permissions: [],
  };

  const tenantUser: AuthenticatedUser = {
    id: mockUserId,
    email: 'tenant@propertyos.test',
    firstName: 'Aditya',
    lastName: 'Verma',
    phone: '9876543213',
    organizationId: mockOrgId,
    isActive: true,
    roles: [UserRole.TENANT],
    permissions: [],
  };

  const otherTenantUser: AuthenticatedUser = {
    id: otherUserId,
    email: 'other_tenant@propertyos.test',
    firstName: 'Karan',
    lastName: 'Mehta',
    phone: '9876543214',
    organizationId: mockOrgId,
    isActive: true,
    roles: [UserRole.TENANT],
    permissions: [],
  };

  const mockListingEntity = {
    id: mockListingId,
    organizationId: mockOrgId,
    propertyId: mockPropId,
    sellerId: mockUserId,
    sellerName: 'Aditya Verma',
    sellerRole: 'TENANT',
    sellerPhone: '9876543213',
    tenantId: mockTenantId,
    title: 'Study Table & Chair',
    description: 'Wooden study table with ergonomic chair in good condition.',
    price: new Prisma.Decimal('2500.00'),
    isNegotiable: true,
    category: 'FURNITURE',
    condition: 'GOOD',
    status: 'ACTIVE',
    images: ['https://example.com/table.jpg'],
    locationNote: 'Room 204, Tower B',
    createdAt: new Date('2026-08-25T10:00:00Z'),
    updatedAt: new Date('2026-08-25T10:00:00Z'),
    deletedAt: null,
    property: {
      name: 'Skyline Heights PG',
    },
  };

  beforeEach(async () => {
    const mockPrisma = {
      property: {
        findFirst: jest.fn(),
      },
      tenant: {
        findFirst: jest.fn(),
      },
      marketplaceListing: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return await callback(mockPrisma);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketplaceService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<MarketplaceService>(MarketplaceService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createListing', () => {
    it('should allow active tenant to create a marketplace listing on their assigned property', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropId, name: 'Skyline Heights PG' });
      prisma.tenant.findFirst.mockResolvedValue({
        id: mockTenantId,
        checkIns: [{ propertyId: mockPropId }],
      });
      prisma.marketplaceListing.create.mockResolvedValue(mockListingEntity);

      const result = await service.createListing(mockOrgId, tenantUser, {
        propertyId: mockPropId,
        title: 'Study Table & Chair',
        description: 'Wooden study table with ergonomic chair.',
        price: 2500,
        isNegotiable: true,
        category: MarketplaceCategory.FURNITURE,
        condition: MarketplaceItemCondition.GOOD,
        images: ['https://example.com/table.jpg'],
        locationNote: 'Room 204, Tower B',
      });

      expect(result.id).toBe(mockListingId);
      expect(result.title).toBe('Study Table & Chair');
      expect(result.price).toBe('2500.00');
      expect(result.category).toBe(MarketplaceCategory.FURNITURE);
      expect(prisma.marketplaceListing.create).toHaveBeenCalled();
    });

    it('should reject tenant attempting to create listing on unassigned property (403 Forbidden)', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: foreignPropId, name: 'Other Tower' });
      prisma.tenant.findFirst.mockResolvedValue({
        id: mockTenantId,
        checkIns: [{ propertyId: mockPropId }], // Assigned to mockPropId, not foreignPropId
      });

      await expect(
        service.createListing(mockOrgId, tenantUser, {
          propertyId: foreignPropId,
          title: 'Bookshelf',
          description: '3 shelf wooden rack',
          price: 800,
          category: MarketplaceCategory.FURNITURE,
          condition: MarketplaceItemCondition.GOOD,
        })
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject listing creation if property is not found in organization (404 Not Found)', async () => {
      prisma.property.findFirst.mockResolvedValue(null);

      await expect(
        service.createListing(mockOrgId, ownerUser, {
          propertyId: '00000000-0000-4000-a000-000000000999',
          title: 'Microwave Oven',
          description: '800W Convection microwave oven',
          price: 3500,
          category: MarketplaceCategory.APPLIANCES,
          condition: MarketplaceItemCondition.LIKE_NEW,
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject non-positive price (400 Bad Request)', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropId, name: 'Skyline Heights PG' });
      prisma.tenant.findFirst.mockResolvedValue({
        id: mockTenantId,
        checkIns: [{ propertyId: mockPropId }],
      });

      await expect(
        service.createListing(mockOrgId, tenantUser, {
          propertyId: mockPropId,
          title: 'Free Kettle',
          description: 'Electric kettle in working condition',
          price: 0,
          category: MarketplaceCategory.APPLIANCES,
          condition: MarketplaceItemCondition.FAIR,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject price exceeding 10,000,000 (400 Bad Request)', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropId, name: 'Skyline Heights PG' });
      prisma.tenant.findFirst.mockResolvedValue({
        id: mockTenantId,
        checkIns: [{ propertyId: mockPropId }],
      });

      await expect(
        service.createListing(mockOrgId, tenantUser, {
          propertyId: mockPropId,
          title: 'Super Luxury Car',
          description: 'Exotic vehicle',
          price: 15000000,
          category: MarketplaceCategory.VEHICLES,
          condition: MarketplaceItemCondition.BRAND_NEW,
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getListings', () => {
    it('should return paginated listings with search and filters', async () => {
      prisma.marketplaceListing.findMany.mockResolvedValue([mockListingEntity]);
      prisma.marketplaceListing.count.mockResolvedValue(1);

      const result = await service.getListings(mockOrgId, ownerUser, {
        page: 1,
        limit: 10,
        category: MarketplaceCategory.FURNITURE,
        condition: MarketplaceItemCondition.GOOD,
        search: 'Table',
      });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.data[0].title).toBe('Study Table & Chair');
    });

    it('should scope tenant query to assigned properties', async () => {
      prisma.tenant.findFirst.mockResolvedValue({
        id: mockTenantId,
        checkIns: [{ propertyId: mockPropId }],
      });
      prisma.marketplaceListing.findMany.mockResolvedValue([mockListingEntity]);
      prisma.marketplaceListing.count.mockResolvedValue(1);

      const result = await service.getListings(mockOrgId, tenantUser, {
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(prisma.marketplaceListing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            propertyId: { in: [mockPropId] },
          }),
        })
      );
    });

    it('should reject tenant querying unassigned property (403 Forbidden)', async () => {
      prisma.tenant.findFirst.mockResolvedValue({
        id: mockTenantId,
        checkIns: [{ propertyId: mockPropId }],
      });

      await expect(
        service.getListings(mockOrgId, tenantUser, {
          propertyId: foreignPropId,
        })
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getListingById', () => {
    it('should return listing details by ID', async () => {
      prisma.marketplaceListing.findFirst.mockResolvedValue(mockListingEntity);

      const result = await service.getListingById(mockOrgId, ownerUser, mockListingId);

      expect(result.id).toBe(mockListingId);
      expect(result.title).toBe('Study Table & Chair');
    });

    it('should throw NotFoundException if listing does not exist (404 Not Found)', async () => {
      prisma.marketplaceListing.findFirst.mockResolvedValue(null);

      await expect(
        service.getListingById(mockOrgId, ownerUser, 'nonexistent-uuid')
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject tenant accessing listing from unassigned property (403 Forbidden)', async () => {
      prisma.marketplaceListing.findFirst.mockResolvedValue({
        ...mockListingEntity,
        propertyId: foreignPropId,
      });
      prisma.tenant.findFirst.mockResolvedValue({
        id: mockTenantId,
        checkIns: [{ propertyId: mockPropId }],
      });

      await expect(
        service.getListingById(mockOrgId, tenantUser, mockListingId)
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateListing', () => {
    it('should allow author to update listing details', async () => {
      prisma.marketplaceListing.findFirst.mockResolvedValue(mockListingEntity);
      prisma.marketplaceListing.update.mockResolvedValue({
        ...mockListingEntity,
        price: new Prisma.Decimal('2200.00'),
        title: 'Study Table & Chair (Reduced Price)',
      });

      const result = await service.updateListing(mockOrgId, tenantUser, mockListingId, {
        title: 'Study Table & Chair (Reduced Price)',
        price: 2200,
      });

      expect(result.title).toBe('Study Table & Chair (Reduced Price)');
      expect(result.price).toBe('2200.00');
    });

    it('should allow moderator (Property Manager) to update any listing', async () => {
      prisma.marketplaceListing.findFirst.mockResolvedValue(mockListingEntity);
      prisma.marketplaceListing.update.mockResolvedValue({
        ...mockListingEntity,
        description: 'Moderated description.',
      });

      const result = await service.updateListing(mockOrgId, managerUser, mockListingId, {
        description: 'Moderated description.',
      });

      expect(result.description).toBe('Moderated description.');
    });

    it('should reject non-author non-moderator from updating listing (403 Forbidden)', async () => {
      prisma.marketplaceListing.findFirst.mockResolvedValue(mockListingEntity);

      await expect(
        service.updateListing(mockOrgId, otherTenantUser, mockListingId, {
          title: 'Hijacked Title',
        })
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateListingStatus', () => {
    it('should allow author to mark listing as RESERVED and SOLD with advisory locking', async () => {
      prisma.marketplaceListing.findFirst.mockResolvedValue(mockListingEntity);
      prisma.marketplaceListing.update.mockResolvedValue({
        ...mockListingEntity,
        status: 'RESERVED',
      });

      const result = await service.updateListingStatus(mockOrgId, tenantUser, mockListingId, {
        status: MarketplaceListingStatus.RESERVED,
      });

      expect(result.status).toBe(MarketplaceListingStatus.RESERVED);
      expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('pg_advisory_xact_lock'),
        mockListingId
      );
    });

    it('should allow moderator (Warden) to change listing status', async () => {
      prisma.marketplaceListing.findFirst.mockResolvedValue(mockListingEntity);
      prisma.marketplaceListing.update.mockResolvedValue({
        ...mockListingEntity,
        status: 'SOLD',
      });

      const result = await service.updateListingStatus(mockOrgId, wardenUser, mockListingId, {
        status: MarketplaceListingStatus.SOLD,
      });

      expect(result.status).toBe(MarketplaceListingStatus.SOLD);
    });

    it('should reject status transition on a DELETED listing (409 Conflict)', async () => {
      prisma.marketplaceListing.findFirst.mockResolvedValue({
        ...mockListingEntity,
        status: 'DELETED',
      });

      await expect(
        service.updateListingStatus(mockOrgId, tenantUser, mockListingId, {
          status: MarketplaceListingStatus.ACTIVE,
        })
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('deleteListing', () => {
    it('should allow author to soft-delete listing with advisory lock', async () => {
      prisma.marketplaceListing.findFirst.mockResolvedValue(mockListingEntity);
      prisma.marketplaceListing.update.mockResolvedValue({
        ...mockListingEntity,
        status: 'DELETED',
        deletedAt: new Date(),
      });

      const result = await service.deleteListing(mockOrgId, tenantUser, mockListingId);

      expect(result.success).toBe(true);
      expect(prisma.marketplaceListing.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockListingId },
          data: expect.objectContaining({
            status: 'DELETED',
          }),
        })
      );
    });

    it('should allow moderator (Owner) to soft-delete any listing', async () => {
      prisma.marketplaceListing.findFirst.mockResolvedValue(mockListingEntity);
      prisma.marketplaceListing.update.mockResolvedValue({
        ...mockListingEntity,
        status: 'DELETED',
        deletedAt: new Date(),
      });

      const result = await service.deleteListing(mockOrgId, ownerUser, mockListingId);

      expect(result.success).toBe(true);
    });

    it('should reject non-author non-moderator from deleting listing (403 Forbidden)', async () => {
      prisma.marketplaceListing.findFirst.mockResolvedValue(mockListingEntity);

      await expect(
        service.deleteListing(mockOrgId, otherTenantUser, mockListingId)
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getSummary', () => {
    it('should compute summary KPIs with exact Decimal summation', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropId, name: 'Skyline Heights PG' });
      prisma.marketplaceListing.findMany.mockResolvedValue([
        { price: new Prisma.Decimal('2500.00'), category: 'FURNITURE' },
        { price: new Prisma.Decimal('1200.50'), category: 'ELECTRONICS' },
        { price: new Prisma.Decimal('800.00'), category: 'FURNITURE' },
      ]);
      prisma.marketplaceListing.count
        .mockResolvedValueOnce(2) // sold count
        .mockResolvedValueOnce(1); // reserved count

      const summary = await service.getSummary(mockOrgId, ownerUser, mockPropId);

      expect(summary.activeListings).toBe(3);
      expect(summary.soldListings).toBe(2);
      expect(summary.reservedListings).toBe(1);
      expect(summary.totalActiveValue).toBe('4500.50');
      expect(summary.categoryBreakdown).toEqual({
        FURNITURE: 2,
        ELECTRONICS: 1,
      });
    });
  });
});
