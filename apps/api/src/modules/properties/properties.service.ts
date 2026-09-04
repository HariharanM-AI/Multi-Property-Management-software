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

      // Build composite description with owner metadata & tenancy agreement terms if provided
      const hasMeta = (
        propertyData.ownerName ||
        propertyData.ownerAddress ||
        propertyData.ownerPhone ||
        propertyData.ownerSignature ||
        propertyData.noticePeriodDays !== undefined ||
        propertyData.lockInPeriodValue !== undefined ||
        propertyData.lockInPeriodUnit !== undefined ||
        propertyData.lockInMonths !== undefined
      );

      const cleanDesc = this.extractCleanDescription(propertyData.description);

      const descriptionPayload = hasMeta
        ? JSON.stringify({
            text: cleanDesc,
            ownerName: propertyData.ownerName?.trim() || null,
            ownerAddress: propertyData.ownerAddress?.trim() || null,
            ownerPhone: propertyData.ownerPhone?.trim() || null,
            ownerSignature: propertyData.ownerSignature || null,
            noticePeriodDays: propertyData.noticePeriodDays !== undefined ? Number(propertyData.noticePeriodDays) : 30,
            lockInPeriodValue: propertyData.lockInPeriodValue !== undefined ? Number(propertyData.lockInPeriodValue) : 1,
            lockInPeriodUnit: propertyData.lockInPeriodUnit || 'MONTHS',
            lockInMonths: propertyData.lockInMonths !== undefined ? Number(propertyData.lockInMonths) : (propertyData.lockInPeriodUnit === 'YEARS' ? (Number(propertyData.lockInPeriodValue || 1) * 12) : Number(propertyData.lockInPeriodValue || 1)),
          })
        : cleanDesc;

      // 2. Create Property
      const created = await tx.property.create({
        data: {
          organizationId,
          code: propertyCode,
          name: propertyData.name.trim(),
          propertyType: propertyData.propertyType,
          status: PropertyStatus.ACTIVE,
          description: descriptionPayload,
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
    if (filter.status) {
      whereClause.status = filter.status;
    } else {
      // Default: exclude soft-deleted properties unless specifically requested
      whereClause.deletedAt = null;
    }

    // Operating model filter
    if (filter.propertyType) {
      whereClause.propertyType = filter.propertyType;
    }

    // Location based multi-field filtering
    if (filter.city) {
      whereClause.city = { contains: filter.city.trim(), mode: 'insensitive' };
    }

    if (filter.state) {
      whereClause.state = { contains: filter.state.trim(), mode: 'insensitive' };
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
      // 1. Resolve composite description if owner or terms fields are touched
      let descriptionPayload = updateData.description !== undefined ? this.extractCleanDescription(updateData.description) : undefined;
      if (
        updateData.ownerName !== undefined ||
        updateData.ownerAddress !== undefined ||
        updateData.ownerPhone !== undefined ||
        updateData.ownerSignature !== undefined ||
        updateData.noticePeriodDays !== undefined ||
        updateData.lockInPeriodValue !== undefined ||
        updateData.lockInPeriodUnit !== undefined ||
        updateData.lockInMonths !== undefined
      ) {
        let existingMeta: any = {};
        if (existing.description && existing.description.startsWith('{')) {
          try {
            existingMeta = JSON.parse(existing.description);
          } catch {}
        }

        const cleanExistingText = this.extractCleanDescription(existingMeta.text ?? existing.description);
        const text = updateData.description !== undefined
          ? this.extractCleanDescription(updateData.description)
          : cleanExistingText;
        const ownerName = updateData.ownerName !== undefined ? updateData.ownerName?.trim() : existingMeta.ownerName || null;
        const ownerAddress = updateData.ownerAddress !== undefined ? updateData.ownerAddress?.trim() : existingMeta.ownerAddress || null;
        const ownerPhone = updateData.ownerPhone !== undefined ? updateData.ownerPhone?.trim() : existingMeta.ownerPhone || null;
        const ownerSignature = updateData.ownerSignature !== undefined ? updateData.ownerSignature : existingMeta.ownerSignature || null;
        const noticePeriodDays = updateData.noticePeriodDays !== undefined ? Number(updateData.noticePeriodDays) : (existingMeta.noticePeriodDays ?? 30);
        const lockInPeriodValue = updateData.lockInPeriodValue !== undefined ? Number(updateData.lockInPeriodValue) : (existingMeta.lockInPeriodValue ?? 1);
        const lockInPeriodUnit = updateData.lockInPeriodUnit !== undefined ? updateData.lockInPeriodUnit : (existingMeta.lockInPeriodUnit || 'MONTHS');
        const lockInMonths = updateData.lockInMonths !== undefined ? Number(updateData.lockInMonths) : (existingMeta.lockInMonths ?? (lockInPeriodUnit === 'YEARS' ? lockInPeriodValue * 12 : lockInPeriodValue));

        descriptionPayload = (ownerName || ownerAddress || ownerPhone || ownerSignature || noticePeriodDays !== undefined)
          ? JSON.stringify({
              text: text || null,
              ownerName,
              ownerAddress,
              ownerPhone,
              ownerSignature,
              noticePeriodDays,
              lockInPeriodValue,
              lockInPeriodUnit,
              lockInMonths,
            })
          : (text || null);
      }

      // Update Core Fields
      await tx.property.update({
        where: { id: propertyId },
        data: {
          name: updateData.name !== undefined ? (updateData.name ? updateData.name.trim() : undefined) : undefined,
          status: updateData.status !== undefined ? updateData.status : undefined,
          description: descriptionPayload !== undefined ? descriptionPayload : undefined,
          address: updateData.address !== undefined ? (updateData.address ? updateData.address.trim() : undefined) : undefined,
          addressLine1: updateData.addressLine1 !== undefined ? (updateData.addressLine1 ? updateData.addressLine1.trim() : null) : undefined,
          addressLine2: updateData.addressLine2 !== undefined ? (updateData.addressLine2 ? updateData.addressLine2.trim() : null) : undefined,
          locality: updateData.locality !== undefined ? (updateData.locality ? updateData.locality.trim() : null) : undefined,
          city: updateData.city !== undefined ? (updateData.city ? updateData.city.trim() : undefined) : undefined,
          district: updateData.district !== undefined ? (updateData.district ? updateData.district.trim() : null) : undefined,
          state: updateData.state !== undefined ? (updateData.state ? updateData.state.trim() : undefined) : undefined,
          country: updateData.country !== undefined ? (updateData.country ? updateData.country.trim() : undefined) : undefined,
          postalCode: updateData.postalCode !== undefined ? (updateData.postalCode ? updateData.postalCode.trim() : undefined) : undefined,
          latitude: updateData.latitude !== undefined ? updateData.latitude : undefined,
          longitude: updateData.longitude !== undefined ? updateData.longitude : undefined,
          contactPhone: updateData.contactPhone !== undefined ? (updateData.contactPhone ? updateData.contactPhone.trim() : null) : undefined,
          contactEmail: updateData.contactEmail !== undefined ? (updateData.contactEmail ? updateData.contactEmail.trim().toLowerCase() : null) : undefined,
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

      // 3. Audit Log
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
            updatedFields: Object.keys(updateData),
          },
        },
      });
    });

    return this.getPropertyById(organizationId, propertyId);
  }

  /**
   * Helper to recursively unwrap JSON and extract pure human-readable text.
   * Prevents raw JSON containing owner metadata from leaking into description or getting nested into text.
   */
  private extractCleanDescription(raw: string | null | undefined): string | null {
    if (!raw) return null;
    let current: any = raw;
    for (let i = 0; i < 10; i++) {
      if (typeof current === 'string' && current.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(current);
          if (parsed && typeof parsed === 'object') {
            if ('text' in parsed) {
              current = parsed.text;
              continue;
            } else {
              return null;
            }
          }
        } catch {
          break;
        }
      } else {
        break;
      }
    }
    if (typeof current === 'string') {
      const trimmed = current.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          JSON.parse(trimmed);
          return null;
        } catch {}
      }
      return trimmed.length > 0 ? trimmed : null;
    }
    return null;
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

    const cleanDescription = this.extractCleanDescription(property.description);
    let ownerName: string | null = null;
    let ownerAddress: string | null = null;
    let ownerPhone: string | null = null;
    let ownerSignature: string | null = null;
    let noticePeriodDays: number | null = 30;
    let lockInPeriodValue: number | null = 1;
    let lockInPeriodUnit: 'DAYS' | 'MONTHS' | 'YEARS' | null = 'MONTHS';
    let lockInMonths: number | null = 1;

    if (property.description && property.description.startsWith('{')) {
      try {
        const meta = JSON.parse(property.description);
        ownerName = meta.ownerName ?? null;
        ownerAddress = meta.ownerAddress ?? null;
        ownerPhone = meta.ownerPhone ?? null;
        ownerSignature = meta.ownerSignature ?? null;
        if (meta.noticePeriodDays !== undefined) noticePeriodDays = Number(meta.noticePeriodDays);
        if (meta.lockInPeriodValue !== undefined) lockInPeriodValue = Number(meta.lockInPeriodValue);
        if (meta.lockInPeriodUnit) lockInPeriodUnit = meta.lockInPeriodUnit;
        if (meta.lockInMonths !== undefined) lockInMonths = Number(meta.lockInMonths);
      } catch {}
    }

    return {
      id: property.id,
      organizationId: property.organizationId,
      code: property.code,
      name: property.name,
      propertyType: property.propertyType,
      status: property.status,
      description: cleanDescription,
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
      ownerName,
      ownerAddress,
      ownerPhone,
      ownerSignature,
      noticePeriodDays,
      lockInPeriodValue,
      lockInPeriodUnit,
      lockInMonths,
      images: property.images || [],
      amenities,
      media: property.media || [],
      capabilities: [...capabilities],
      createdAt: property.createdAt,
      updatedAt: property.updatedAt,
      deletedAt: property.deletedAt,
    };
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
}
