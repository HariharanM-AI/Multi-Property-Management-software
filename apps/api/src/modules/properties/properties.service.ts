import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import {
  PropertyDto,
  CreatePropertyDto,
  UpdatePropertyDto,
  PropertyFilterDto,
  PaginatedPropertiesDto,
  AmenityDto,
  PropertyStatus,
  PropertyType,
  STANDARD_AMENITIES_CATALOG,
  getPropertyCapabilities,
} from '@propertyos/types';

@Injectable()
export class PropertiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService
  ) {}

  /**
   * Retrieves standard amenity catalog definitions
   */
  async getAmenitiesCatalog(): Promise<AmenityDto[]> {
    // Return standard catalog definitions
    return STANDARD_AMENITIES_CATALOG.map((a) => ({
      id: a.id,
      name: a.name,
      category: a.category,
      icon: a.icon,
    }));
  }

  /**
   * Concurrency-safe Property Creation with atomic sequence generation and 5-tier isolation
   */
  async createProperty(
    organizationId: string,
    userId: string,
    input: CreatePropertyDto,
    ipAddress?: string,
    userAgent?: string
  ): Promise<PropertyDto> {
    const { amenityIds, ...propertyData } = input;

    const property = await this.prisma.$transaction(async (tx) => {
      // 1. Concurrency-safe atomic sequence generation
      const sequence = await tx.organizationSequence.upsert({
        where: {
          organizationId_key: {
            organizationId,
            key: 'PROPERTY',
          },
        },
        create: {
          organizationId,
          key: 'PROPERTY',
          currentValue: 1,
        },
        update: {
          currentValue: {
            increment: 1,
          },
        },
      });

      const propertyCode = `PROP-${String(sequence.currentValue).padStart(6, '0')}`;

      // 2. Create Property
      const created = await tx.property.create({
        data: {
          organizationId,
          code: propertyCode,
          name: propertyData.name.trim(),
          propertyType: propertyData.propertyType,
          status: PropertyStatus.ACTIVE,
          description: propertyData.description?.trim() || null,
          address: propertyData.address.trim(),
          addressLine1: propertyData.addressLine1?.trim() || null,
          addressLine2: propertyData.addressLine2?.trim() || null,
          locality: propertyData.locality?.trim() || null,
          city: propertyData.city.trim(),
          district: propertyData.district?.trim() || null,
          state: propertyData.state.trim(),
          country: propertyData.country?.trim() || 'India',
          postalCode: propertyData.postalCode.trim(),
          latitude: propertyData.latitude ?? null,
          longitude: propertyData.longitude ?? null,
          contactPhone: propertyData.contactPhone?.trim() || null,
          contactEmail: propertyData.contactEmail?.trim().toLowerCase() || null,
        },
      });

      // 3. Link Amenities if specified
      if (amenityIds && amenityIds.length > 0) {
        for (const amenityId of amenityIds) {
          const catalogItem = STANDARD_AMENITIES_CATALOG.find((a) => a.id === amenityId);
          const amenityName = catalogItem?.name || amenityId;

          // Upsert master amenity
          const masterAmenity = await tx.amenity.upsert({
            where: { name: amenityName },
            create: {
              name: amenityName,
              category: catalogItem?.category || 'Facility',
              icon: catalogItem?.icon || 'Check',
            },
            update: {},
          });

          await tx.propertyAmenity.create({
            data: {
              propertyId: created.id,
              amenityId: masterAmenity.id,
            },
          });
        }
      }

      // 4. Record Audit Log
      await tx.auditLog.create({
        data: {
          organizationId,
          userId,
          action: 'PROPERTY_CREATED',
          resourceType: 'Property',
          resourceId: created.id,
          ipAddress,
          userAgent,
          metadata: {
            code: propertyCode,
            name: created.name,
            propertyType: created.propertyType,
            city: created.city,
          },
        },
      });

      return created;
    });

    return this.getPropertyById(organizationId, property.id);
  }

  /**
   * Scoped Property Listing with search, multi-field filters, and pagination
   */
  async listProperties(
    organizationId: string,
    filter: PropertyFilterDto
  ): Promise<PaginatedPropertiesDto> {
    const page = Math.max(1, filter.page || 1);
    const pageSize = Math.min(100, Math.max(1, filter.pageSize || 10));
    const skip = (page - 1) * pageSize;

    const whereClause: any = {
      organizationId,
    };

    // Lifecycle status filtering
    if (filter.status === PropertyStatus.ARCHIVED) {
      whereClause.status = PropertyStatus.ARCHIVED;
      whereClause.deletedAt = { not: null };
    } else if (filter.status) {
      whereClause.status = filter.status;
      whereClause.deletedAt = null;
    } else {
      // Default: show active non-archived properties
      whereClause.status = { not: PropertyStatus.ARCHIVED };
      whereClause.deletedAt = null;
    }

    if (filter.propertyType) {
      whereClause.propertyType = filter.propertyType;
    }

    if (filter.city) {
      whereClause.city = {
        contains: filter.city.trim(),
        mode: 'insensitive',
      };
    }

    if (filter.state) {
      whereClause.state = {
        contains: filter.state.trim(),
        mode: 'insensitive',
      };
    }

    if (filter.search) {
      const searchTerms = filter.search.trim();
      whereClause.OR = [
        { name: { contains: searchTerms, mode: 'insensitive' } },
        { code: { contains: searchTerms, mode: 'insensitive' } },
        { locality: { contains: searchTerms, mode: 'insensitive' } },
        { city: { contains: searchTerms, mode: 'insensitive' } },
      ];
    }

    const [properties, total] = await Promise.all([
      this.prisma.property.findMany({
        where: whereClause,
        include: {
          amenities: {
            include: {
              amenity: true,
            },
          },
          media: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: pageSize,
      }),
      this.prisma.property.count({
        where: whereClause,
      }),
    ]);

    const items: PropertyDto[] = properties.map((p) => this.mapToDto(p));

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  /**
   * Scoped Property Retrieval with capability resolution
   */
  async getPropertyById(organizationId: string, propertyId: string): Promise<PropertyDto> {
    const property = await this.prisma.property.findFirst({
      where: {
        id: propertyId,
        organizationId,
      },
      include: {
        amenities: {
          include: {
            amenity: true,
          },
        },
        media: true,
      },
    });

    if (!property) {
      // Fail-closed: Never disclose existence of properties belonging to another tenant
      throw new NotFoundException('Property not found');
    }

    return this.mapToDto(property);
  }

  /**
   * Scoped Property Update (enforcing immutability of operating model propertyType)
   */
  async updateProperty(
    organizationId: string,
    userId: string,
    propertyId: string,
    input: UpdatePropertyDto,
    ipAddress?: string,
    userAgent?: string
  ): Promise<PropertyDto> {
    const existing = await this.prisma.property.findFirst({
      where: {
        id: propertyId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException('Property not found or is archived');
    }

    const { amenityIds, ...updateData } = input;

    await this.prisma.$transaction(async (tx) => {
      // 1. Update Core Fields
      await tx.property.update({
        where: { id: propertyId },
        data: {
          name: updateData.name?.trim(),
          status: updateData.status,
          description: updateData.description !== undefined ? updateData.description?.trim() : undefined,
          address: updateData.address?.trim(),
          addressLine1: updateData.addressLine1 !== undefined ? updateData.addressLine1?.trim() : undefined,
          addressLine2: updateData.addressLine2 !== undefined ? updateData.addressLine2?.trim() : undefined,
          locality: updateData.locality !== undefined ? updateData.locality?.trim() : undefined,
          city: updateData.city?.trim(),
          district: updateData.district !== undefined ? updateData.district?.trim() : undefined,
          state: updateData.state?.trim(),
          country: updateData.country?.trim(),
          postalCode: updateData.postalCode?.trim(),
          latitude: updateData.latitude,
          longitude: updateData.longitude,
          contactPhone: updateData.contactPhone !== undefined ? updateData.contactPhone?.trim() : undefined,
          contactEmail: updateData.contactEmail !== undefined ? updateData.contactEmail?.trim().toLowerCase() : undefined,
        },
      });

      // 2. Sync Amenities if specified
      if (amenityIds !== undefined) {
        await tx.propertyAmenity.deleteMany({
          where: { propertyId },
        });

        for (const amenityId of amenityIds) {
          const catalogItem = STANDARD_AMENITIES_CATALOG.find((a) => a.id === amenityId);
          const amenityName = catalogItem?.name || amenityId;

          const masterAmenity = await tx.amenity.upsert({
            where: { name: amenityName },
            create: {
              name: amenityName,
              category: catalogItem?.category || 'Facility',
              icon: catalogItem?.icon || 'Check',
            },
            update: {},
          });

          await tx.propertyAmenity.create({
            data: {
              propertyId,
              amenityId: masterAmenity.id,
            },
          });
        }
      }

      // 3. Record Audit Log
      await tx.auditLog.create({
        data: {
          organizationId,
          userId,
          action: 'PROPERTY_UPDATED',
          resourceType: 'Property',
          resourceId: propertyId,
          ipAddress,
          userAgent,
          metadata: {
            updatedFields: Object.keys(input),
          },
        },
      });
    });

    return this.getPropertyById(organizationId, propertyId);
  }

  /**
   * Authorized Property Archive (Soft-Delete)
   */
  async archiveProperty(
    organizationId: string,
    userId: string,
    propertyId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ message: string; propertyId: string }> {
    const existing = await this.prisma.property.findFirst({
      where: {
        id: propertyId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException('Property not found or already archived');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.property.update({
        where: { id: propertyId },
        data: {
          status: PropertyStatus.ARCHIVED,
          deletedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          userId,
          action: 'PROPERTY_ARCHIVED',
          resourceType: 'Property',
          resourceId: propertyId,
          ipAddress,
          userAgent,
          metadata: {
            code: existing.code,
            name: existing.name,
          },
        },
      });
    });

    return {
      message: `Property ${existing.name} (${existing.code}) archived successfully`,
      propertyId,
    };
  }

  /**
   * Authorized Property Restore
   */
  async restoreProperty(
    organizationId: string,
    userId: string,
    propertyId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ message: string; propertyId: string }> {
    const existing = await this.prisma.property.findFirst({
      where: {
        id: propertyId,
        organizationId,
        deletedAt: { not: null },
      },
    });

    if (!existing) {
      throw new NotFoundException('Archived property not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.property.update({
        where: { id: propertyId },
        data: {
          status: PropertyStatus.ACTIVE,
          deletedAt: null,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          userId,
          action: 'PROPERTY_RESTORED',
          resourceType: 'Property',
          resourceId: propertyId,
          ipAddress,
          userAgent,
          metadata: {
            code: existing.code,
            name: existing.name,
          },
        },
      });
    });

    return {
      message: `Property ${existing.name} (${existing.code}) restored successfully`,
      propertyId,
    };
  }

  /**
   * Property Media Upload
   */
  async addPropertyMedia(
    organizationId: string,
    userId: string,
    propertyId: string,
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
    category = 'IMAGE',
    ipAddress?: string,
    userAgent?: string
  ) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, organizationId, deletedAt: null },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    const uploaded = await this.storage.uploadFile(file, organizationId, propertyId, category);

    const mediaRecord = await this.prisma.propertyMedia.create({
      data: {
        propertyId,
        organizationId,
        fileName: uploaded.fileName,
        originalName: uploaded.originalName,
        mimeType: uploaded.mimeType,
        fileSize: uploaded.fileSize,
        fileUrl: uploaded.fileUrl,
        category: uploaded.category,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action: 'PROPERTY_MEDIA_ADDED',
        resourceType: 'PropertyMedia',
        resourceId: mediaRecord.id,
        ipAddress,
        userAgent,
        metadata: {
          propertyId,
          fileName: uploaded.fileName,
          category: uploaded.category,
        },
      },
    });

    return mediaRecord;
  }

  /**
   * Property Media Removal
   */
  async removePropertyMedia(
    organizationId: string,
    userId: string,
    propertyId: string,
    mediaId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const media = await this.prisma.propertyMedia.findFirst({
      where: {
        id: mediaId,
        propertyId,
        organizationId,
      },
    });

    if (!media) {
      throw new NotFoundException('Media item not found');
    }

    await this.storage.deleteFile(media.fileUrl, organizationId, propertyId);
    await this.prisma.propertyMedia.delete({ where: { id: mediaId } });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action: 'PROPERTY_MEDIA_REMOVED',
        resourceType: 'PropertyMedia',
        resourceId: mediaId,
        ipAddress,
        userAgent,
        metadata: {
          propertyId,
          fileName: media.fileName,
        },
      },
    });

    return { message: 'Media removed successfully', mediaId };
  }

  /**
   * Maps Prisma Property entity to PropertyDto including capability resolution
   */
  private mapToDto(property: any): PropertyDto {
    const capabilities = getPropertyCapabilities(property.propertyType as PropertyType);

    const amenities: AmenityDto[] =
      property.amenities?.map((pa: any) => ({
        id: pa.amenity.id,
        name: pa.amenity.name,
        category: pa.amenity.category,
        icon: pa.amenity.icon,
      })) || [];

    return {
      id: property.id,
      organizationId: property.organizationId,
      code: property.code,
      name: property.name,
      propertyType: property.propertyType,
      status: property.status,
      description: property.description,
      address: property.address,
      addressLine1: property.addressLine1,
      addressLine2: property.addressLine2,
      locality: property.locality,
      city: property.city,
      district: property.district,
      state: property.state,
      country: property.country,
      postalCode: property.postalCode,
      latitude: property.latitude,
      longitude: property.longitude,
      contactPhone: property.contactPhone,
      contactEmail: property.contactEmail,
      images: property.images || [],
      amenities,
      media: property.media || [],
      capabilities: [...capabilities],
      createdAt: property.createdAt,
      updatedAt: property.updatedAt,
      deletedAt: property.deletedAt,
    };
  }
}
