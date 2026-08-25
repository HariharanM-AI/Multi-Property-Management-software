import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  Prisma,
  UserRoleType,
  MarketplaceCategory as PrismaMarketplaceCategory,
  MarketplaceItemCondition as PrismaMarketplaceItemCondition,
  MarketplaceListingStatus as PrismaMarketplaceListingStatus,
} from '@prisma/client';
import {
  AuthenticatedUser,
  UserRole,
  MarketplaceCategory,
  MarketplaceItemCondition,
  MarketplaceListingStatus,
  MarketplaceListingDto,
  CreateMarketplaceListingDto,
  UpdateMarketplaceListingDto,
  UpdateMarketplaceStatusDto,
  MarketplaceListingQuery,
  PaginatedMarketplaceListingsDto,
  MarketplaceSummaryDto,
  MarketplaceSortBy,
} from '@propertyos/types';

@Injectable()
export class MarketplaceService {
  constructor(private readonly prisma: PrismaService) {}

  private isTenantOnly(caller: AuthenticatedUser): boolean {
    return (
      caller.roles.includes(UserRole.TENANT) &&
      !caller.roles.includes(UserRole.OWNER) &&
      !caller.roles.includes(UserRole.PROPERTY_MANAGER) &&
      !caller.roles.includes(UserRole.WARDEN)
    );
  }

  private isModerator(caller: AuthenticatedUser): boolean {
    return (
      caller.roles.includes(UserRole.OWNER) ||
      caller.roles.includes(UserRole.PROPERTY_MANAGER) ||
      caller.roles.includes(UserRole.WARDEN)
    );
  }

  /**
   * Helper to resolve active tenant and assigned property for a user.
   */
  async getActiveTenantPropertyForUser(
    organizationId: string,
    user: AuthenticatedUser
  ): Promise<{ tenantId: string; propertyId: string } | null> {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        organizationId,
        OR: [
          ...(user.email ? [{ email: user.email }] : []),
          ...(user.phone ? [{ phone: user.phone }] : []),
        ],
        deletedAt: null,
      },
      include: {
        checkIns: {
          where: {
            status: 'CHECKED_IN',
          },
          select: {
            propertyId: true,
          },
          take: 1,
        },
        leases: {
          where: {
            status: 'ACTIVE',
          },
          include: {
            rentalUnit: {
              select: {
                propertyId: true,
              },
            },
          },
          take: 1,
        },
      },
    });

    if (!tenant) return null;

    let propertyId: string | null = null;
    if (tenant.checkIns && tenant.checkIns.length > 0) {
      propertyId = tenant.checkIns[0].propertyId;
    } else if (
      tenant.leases &&
      tenant.leases.length > 0 &&
      tenant.leases[0].rentalUnit
    ) {
      propertyId = tenant.leases[0].rentalUnit.propertyId;
    }

    if (!propertyId) return null;

    return {
      tenantId: tenant.id,
      propertyId,
    };
  }

  /**
   * Helper to get all active stay property IDs for a tenant.
   */
  async getTenantAssignedPropertyIds(
    organizationId: string,
    user: AuthenticatedUser
  ): Promise<string[]> {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        organizationId,
        OR: [
          ...(user.email ? [{ email: user.email }] : []),
          ...(user.phone ? [{ phone: user.phone }] : []),
        ],
        deletedAt: null,
      },
      include: {
        checkIns: {
          where: {
            status: 'CHECKED_IN',
          },
          select: {
            propertyId: true,
          },
        },
        leases: {
          where: {
            status: 'ACTIVE',
          },
          include: {
            rentalUnit: {
              select: {
                propertyId: true,
              },
            },
          },
        },
      },
    });

    if (!tenant) return [];

    const propertyIds = new Set<string>();
    for (const c of tenant.checkIns || []) {
      propertyIds.add(c.propertyId);
    }
    for (const l of tenant.leases || []) {
      if (l.rentalUnit && l.rentalUnit.propertyId) {
        propertyIds.add(l.rentalUnit.propertyId);
      }
    }

    return Array.from(propertyIds);
  }

  /**
   * Helper to verify property belongs to organization and is active/non-deleted.
   */
  private async verifyProperty(
    organizationId: string,
    propertyId: string
  ): Promise<{ id: string; name: string }> {
    const property = await this.prisma.property.findFirst({
      where: {
        id: propertyId,
        organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found in this organization');
    }

    return property;
  }

  /**
   * Helper to write structured audit log records.
   */
  private async writeAuditLog(
    tx: Prisma.TransactionClient | PrismaService,
    organizationId: string,
    userId: string | null | undefined,
    action: string,
    resourceType: string,
    resourceId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await (tx as any).auditLog.create({
        data: {
          organizationId,
          userId: userId || null,
          action,
          resourceType,
          resourceId,
          metadata: metadata ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
        },
      });
    } catch {
      // Audit failure should not block core transaction if logging fails
    }
  }

  /**
   * Transform DB listing entity into typed DTO.
   */
  private mapToDto(listing: any): MarketplaceListingDto {
    return {
      id: listing.id,
      organizationId: listing.organizationId,
      propertyId: listing.propertyId,
      propertyName: listing.property ? listing.property.name : undefined,
      sellerId: listing.sellerId,
      sellerName: listing.sellerName,
      sellerRole: listing.sellerRole as UserRole,
      sellerPhone: listing.sellerPhone,
      tenantId: listing.tenantId,
      title: listing.title,
      description: listing.description,
      price: listing.price
        ? typeof listing.price === 'object' && typeof listing.price.toFixed === 'function'
          ? listing.price.toFixed(2)
          : Number(listing.price).toFixed(2)
        : '0.00',
      isNegotiable: listing.isNegotiable,
      category: listing.category as MarketplaceCategory,
      condition: listing.condition as MarketplaceItemCondition,
      status: listing.status as MarketplaceListingStatus,
      images: listing.images || [],
      locationNote: listing.locationNote,
      createdAt: listing.createdAt.toISOString(),
      updatedAt: listing.updatedAt.toISOString(),
      deletedAt: listing.deletedAt ? listing.deletedAt.toISOString() : null,
    };
  }

  /**
   * Create a new marketplace listing
   */
  async createListing(
    organizationId: string,
    user: AuthenticatedUser,
    dto: CreateMarketplaceListingDto
  ): Promise<MarketplaceListingDto> {
    const property = await this.verifyProperty(organizationId, dto.propertyId);

    let resolvedTenantId: string | null = null;
    if (this.isTenantOnly(user)) {
      const activeStay = await this.getActiveTenantPropertyForUser(organizationId, user);
      if (!activeStay || activeStay.propertyId !== dto.propertyId) {
        throw new ForbiddenException(
          'Tenant can only create marketplace listings for their currently active assigned property.'
        );
      }
      resolvedTenantId = activeStay.tenantId;
    } else {
      // Staff/management might have a linked tenant record
      const possibleStay = await this.getActiveTenantPropertyForUser(organizationId, user);
      if (possibleStay) {
        resolvedTenantId = possibleStay.tenantId;
      }
    }

    const priceNum = typeof dto.price === 'string' ? parseFloat(dto.price) : dto.price;
    if (isNaN(priceNum) || priceNum <= 0) {
      throw new BadRequestException('Price must be greater than 0');
    }
    if (priceNum > 10000000) {
      throw new BadRequestException('Price cannot exceed ₹10,000,000');
    }

    const primaryRole = user.roles[0] || UserRole.TENANT;
    const sellerName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Resident';
    const sellerPhone = dto.contactPhone || user.phone || null;

    const created = await this.prisma.marketplaceListing.create({
      data: {
        organizationId,
        propertyId: dto.propertyId,
        sellerId: user.id,
        sellerName,
        sellerRole: primaryRole as unknown as UserRoleType,
        sellerPhone,
        tenantId: resolvedTenantId,
        title: dto.title.trim(),
        description: dto.description.trim(),
        price: new Prisma.Decimal(priceNum.toFixed(2)),
        isNegotiable: dto.isNegotiable ?? false,
        category: dto.category as PrismaMarketplaceCategory,
        condition: dto.condition as PrismaMarketplaceItemCondition,
        status: PrismaMarketplaceListingStatus.ACTIVE,
        images: dto.images || [],
        locationNote: dto.locationNote ? dto.locationNote.trim() : null,
      },
      include: {
        property: {
          select: {
            name: true,
          },
        },
      },
    });

    await this.writeAuditLog(
      this.prisma,
      organizationId,
      user.id,
      'MARKETPLACE_LISTING_CREATED',
      'MARKETPLACE_LISTING',
      created.id,
      {
        propertyId: dto.propertyId,
        title: created.title,
        category: created.category,
        price: created.price.toString(),
      }
    );

    return this.mapToDto(created);
  }

  /**
   * List and search marketplace listings with multi-tenant and tenant-property scoping
   */
  async getListings(
    organizationId: string,
    user: AuthenticatedUser,
    query: MarketplaceListingQuery
  ): Promise<PaginatedMarketplaceListingsDto> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    let allowedPropertyIds: string[] | undefined = undefined;

    if (this.isTenantOnly(user)) {
      allowedPropertyIds = await this.getTenantAssignedPropertyIds(organizationId, user);
      if (allowedPropertyIds.length === 0) {
        return {
          data: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
        };
      }

      if (query.propertyId) {
        if (!allowedPropertyIds.includes(query.propertyId)) {
          throw new ForbiddenException(
            'Tenant cannot access marketplace listings for unassigned properties.'
          );
        }
        allowedPropertyIds = [query.propertyId];
      }
    } else if (query.propertyId) {
      await this.verifyProperty(organizationId, query.propertyId);
      allowedPropertyIds = [query.propertyId];
    }

    const where: Prisma.MarketplaceListingWhereInput = {
      organizationId,
      deletedAt: null,
      ...(allowedPropertyIds && allowedPropertyIds.length > 0
        ? { propertyId: { in: allowedPropertyIds } }
        : {}),
      ...(query.category ? { category: query.category as PrismaMarketplaceCategory } : {}),
      ...(query.condition ? { condition: query.condition as PrismaMarketplaceItemCondition } : {}),
      ...(query.status
        ? { status: query.status as PrismaMarketplaceListingStatus }
        : { status: { not: PrismaMarketplaceListingStatus.DELETED } }),
      ...(query.isNegotiable !== undefined ? { isNegotiable: query.isNegotiable } : {}),
      ...(query.sellerId ? { sellerId: query.sellerId } : {}),
      ...(query.minPrice !== undefined || query.maxPrice !== undefined
        ? {
            price: {
              ...(query.minPrice !== undefined
                ? { gte: new Prisma.Decimal(query.minPrice.toFixed(2)) }
                : {}),
              ...(query.maxPrice !== undefined
                ? { lte: new Prisma.Decimal(query.maxPrice.toFixed(2)) }
                : {}),
            },
          }
        : {}),
      ...(query.search && query.search.trim()
        ? {
            OR: [
              { title: { contains: query.search.trim(), mode: 'insensitive' } },
              { description: { contains: query.search.trim(), mode: 'insensitive' } },
              { locationNote: { contains: query.search.trim(), mode: 'insensitive' } },
              { sellerName: { contains: query.search.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    let orderBy: Prisma.MarketplaceListingOrderByWithRelationInput[] = [
      { createdAt: 'desc' },
    ];

    if (query.sortBy === MarketplaceSortBy.PRICE_ASC) {
      orderBy = [{ price: 'asc' }, { createdAt: 'desc' }];
    } else if (query.sortBy === MarketplaceSortBy.PRICE_DESC) {
      orderBy = [{ price: 'desc' }, { createdAt: 'desc' }];
    }

    const [items, total] = await Promise.all([
      this.prisma.marketplaceListing.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          property: {
            select: {
              name: true,
            },
          },
        },
      }),
      this.prisma.marketplaceListing.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit) || 0;

    return {
      data: items.map((item) => this.mapToDto(item)),
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Get single marketplace listing by ID
   */
  async getListingById(
    organizationId: string,
    user: AuthenticatedUser,
    id: string
  ): Promise<MarketplaceListingDto> {
    const listing = await this.prisma.marketplaceListing.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
      include: {
        property: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!listing) {
      throw new NotFoundException('Marketplace listing not found');
    }

    if (this.isTenantOnly(user)) {
      const allowedPropertyIds = await this.getTenantAssignedPropertyIds(organizationId, user);
      if (!allowedPropertyIds.includes(listing.propertyId)) {
        throw new ForbiddenException(
          'Tenant cannot access marketplace listings for unassigned properties.'
        );
      }
    }

    return this.mapToDto(listing);
  }

  /**
   * Update listing details (author or moderator)
   */
  async updateListing(
    organizationId: string,
    user: AuthenticatedUser,
    id: string,
    dto: UpdateMarketplaceListingDto
  ): Promise<MarketplaceListingDto> {
    const listing = await this.prisma.marketplaceListing.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
    });

    if (!listing) {
      throw new NotFoundException('Marketplace listing not found');
    }

    const isAuthor = listing.sellerId === user.id;
    const isMod = this.isModerator(user);

    if (!isAuthor && !isMod) {
      throw new ForbiddenException(
        'You do not have permission to update this marketplace listing.'
      );
    }

    let priceDecimal: Prisma.Decimal | undefined = undefined;
    if (dto.price !== undefined) {
      const priceNum = typeof dto.price === 'string' ? parseFloat(dto.price) : dto.price;
      if (isNaN(priceNum) || priceNum <= 0) {
        throw new BadRequestException('Price must be greater than 0');
      }
      if (priceNum > 10000000) {
        throw new BadRequestException('Price cannot exceed ₹10,000,000');
      }
      priceDecimal = new Prisma.Decimal(priceNum.toFixed(2));
    }

    const updated = await this.prisma.marketplaceListing.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
        ...(priceDecimal !== undefined ? { price: priceDecimal } : {}),
        ...(dto.isNegotiable !== undefined ? { isNegotiable: dto.isNegotiable } : {}),
        ...(dto.category !== undefined ? { category: dto.category as PrismaMarketplaceCategory } : {}),
        ...(dto.condition !== undefined ? { condition: dto.condition as PrismaMarketplaceItemCondition } : {}),
        ...(dto.images !== undefined ? { images: dto.images } : {}),
        ...(dto.locationNote !== undefined ? { locationNote: dto.locationNote ? dto.locationNote.trim() : null } : {}),
        ...(dto.contactPhone !== undefined ? { sellerPhone: dto.contactPhone } : {}),
      },
      include: {
        property: {
          select: {
            name: true,
          },
        },
      },
    });

    await this.writeAuditLog(
      this.prisma,
      organizationId,
      user.id,
      'MARKETPLACE_LISTING_UPDATED',
      'MARKETPLACE_LISTING',
      updated.id,
      {
        title: updated.title,
        price: updated.price.toString(),
        category: updated.category,
      }
    );

    return this.mapToDto(updated);
  }

  /**
   * Update listing status with transaction-scoped advisory locking
   */
  async updateListingStatus(
    organizationId: string,
    user: AuthenticatedUser,
    id: string,
    dto: UpdateMarketplaceStatusDto
  ): Promise<MarketplaceListingDto> {
    return await this.prisma.$transaction(async (tx) => {
      // Advisory lock serialized per listing
      await tx.$executeRawUnsafe(
        "SELECT pg_advisory_xact_lock(hashtext('marketplace_status_' || $1))",
        id
      );

      const listing = await tx.marketplaceListing.findFirst({
        where: {
          id,
          organizationId,
          deletedAt: null,
        },
      });

      if (!listing) {
        throw new NotFoundException('Marketplace listing not found');
      }

      const isAuthor = listing.sellerId === user.id;
      const isMod = this.isModerator(user);

      if (!isAuthor && !isMod) {
        throw new ForbiddenException(
          'You do not have permission to update the status of this marketplace listing.'
        );
      }

      const currentStatus = listing.status as MarketplaceListingStatus;
      const targetStatus = dto.status as MarketplaceListingStatus;

      // Validate allowed transitions
      if (currentStatus === MarketplaceListingStatus.DELETED || currentStatus === MarketplaceListingStatus.EXPIRED) {
        throw new ConflictException(
          `Cannot change status of a ${currentStatus.toLowerCase()} listing.`
        );
      }

      if (currentStatus === targetStatus) {
        // Idempotent return
        const fullListing = await tx.marketplaceListing.findUnique({
          where: { id },
          include: { property: { select: { name: true } } },
        });
        return this.mapToDto(fullListing!);
      }

      const updated = await tx.marketplaceListing.update({
        where: { id },
        data: {
          status: targetStatus as PrismaMarketplaceListingStatus,
        },
        include: {
          property: {
            select: {
              name: true,
            },
          },
        },
      });

      await this.writeAuditLog(
        tx,
        organizationId,
        user.id,
        'MARKETPLACE_LISTING_STATUS_CHANGED',
        'MARKETPLACE_LISTING',
        updated.id,
        {
          previousStatus: currentStatus,
          newStatus: targetStatus,
          title: updated.title,
        }
      );

      return this.mapToDto(updated);
    });
  }

  /**
   * Soft-delete marketplace listing with advisory lock
   */
  async deleteListing(
    organizationId: string,
    user: AuthenticatedUser,
    id: string
  ): Promise<{ success: boolean; message: string }> {
    return await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        "SELECT pg_advisory_xact_lock(hashtext('marketplace_status_' || $1))",
        id
      );

      const listing = await tx.marketplaceListing.findFirst({
        where: {
          id,
          organizationId,
          deletedAt: null,
        },
      });

      if (!listing) {
        throw new NotFoundException('Marketplace listing not found');
      }

      const isAuthor = listing.sellerId === user.id;
      const isMod = this.isModerator(user);

      if (!isAuthor && !isMod) {
        throw new ForbiddenException(
          'You do not have permission to delete this marketplace listing.'
        );
      }

      await this.writeAuditLog(
        tx,
        organizationId,
        user.id,
        'MARKETPLACE_LISTING_DELETED',
        'MARKETPLACE_LISTING',
        listing.id,
        {
          title: listing.title,
          price: listing.price.toString(),
          category: listing.category,
        }
      );

      await tx.marketplaceListing.update({
        where: { id },
        data: {
          status: PrismaMarketplaceListingStatus.DELETED,
          deletedAt: new Date(),
        },
      });

      return {
        success: true,
        message: 'Marketplace listing deleted successfully',
      };
    });
  }

  /**
   * Get property-scoped or portfolio summary KPIs with Decimal calculations
   */
  async getSummary(
    organizationId: string,
    user: AuthenticatedUser,
    propertyId?: string
  ): Promise<MarketplaceSummaryDto> {
    let targetPropertyIds: string[] | undefined = undefined;

    if (this.isTenantOnly(user)) {
      const allowedPropertyIds = await this.getTenantAssignedPropertyIds(organizationId, user);
      if (allowedPropertyIds.length === 0) {
        return {
          propertyId,
          activeListings: 0,
          soldListings: 0,
          reservedListings: 0,
          totalActiveValue: '0.00',
          categoryBreakdown: {},
        };
      }

      if (propertyId) {
        if (!allowedPropertyIds.includes(propertyId)) {
          throw new ForbiddenException(
            'Tenant cannot access marketplace summary for unassigned properties.'
          );
        }
        targetPropertyIds = [propertyId];
      } else {
        targetPropertyIds = allowedPropertyIds;
      }
    } else if (propertyId) {
      await this.verifyProperty(organizationId, propertyId);
      targetPropertyIds = [propertyId];
    }

    const whereBase: Prisma.MarketplaceListingWhereInput = {
      organizationId,
      deletedAt: null,
      ...(targetPropertyIds && targetPropertyIds.length > 0
        ? { propertyId: { in: targetPropertyIds } }
        : {}),
    };

    const [activeListings, soldCount, reservedCount] = await Promise.all([
      this.prisma.marketplaceListing.findMany({
        where: {
          ...whereBase,
          status: PrismaMarketplaceListingStatus.ACTIVE,
        },
        select: {
          price: true,
          category: true,
        },
      }),
      this.prisma.marketplaceListing.count({
        where: {
          ...whereBase,
          status: PrismaMarketplaceListingStatus.SOLD,
        },
      }),
      this.prisma.marketplaceListing.count({
        where: {
          ...whereBase,
          status: PrismaMarketplaceListingStatus.RESERVED,
        },
      }),
    ]);

    let totalActiveValueDecimal = new Prisma.Decimal(0);
    const categoryBreakdown: Record<string, number> = {};

    for (const item of activeListings) {
      totalActiveValueDecimal = totalActiveValueDecimal.add(item.price);
      const cat = item.category;
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
    }

    return {
      propertyId,
      activeListings: activeListings.length,
      soldListings: soldCount,
      reservedListings: reservedCount,
      totalActiveValue: totalActiveValueDecimal.toFixed(2),
      categoryBreakdown,
    };
  }
}
