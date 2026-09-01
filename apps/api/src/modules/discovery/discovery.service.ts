import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  PropertyType,
  PropertyStatus,
  RoomSharingType,
  DiscoverySortBy,
  PropertyDiscoveryDto,
  PropertyDiscoveryDetailDto,
  PropertyDiscoveryQuery,
  PaginatedDiscoveryDto,
  DiscoveryCitySummaryDto,
} from '@propertyos/types';

// Mean Earth radius in kilometers for Haversine calculations
const EARTH_RADIUS_KM = 6371;

@Injectable()
export class DiscoveryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculates deterministic great-circle Haversine distance in kilometers
   */
  public calculateHaversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(EARTH_RADIUS_KM * c * 100) / 100;
  }

  /**
   * Public deterministic Property Discovery Search Engine
   */
  async searchProperties(
    query: PropertyDiscoveryQuery
  ): Promise<PaginatedDiscoveryDto> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 12));

    // Base scoping: Strictly active and non-deleted properties
    const where: any = {
      status: PropertyStatus.ACTIVE,
      deletedAt: null,
    };

    if (query.organizationId) {
      where.organizationId = query.organizationId;
    }

    if (query.propertyType) {
      where.propertyType = query.propertyType;
    }

    if (query.city) {
      where.city = {
        contains: query.city.trim(),
        mode: 'insensitive',
      };
    }

    if (query.locality) {
      where.locality = {
        contains: query.locality.trim(),
        mode: 'insensitive',
      };
    }

    if (query.state) {
      where.state = {
        contains: query.state.trim(),
        mode: 'insensitive',
      };
    }

    if (query.postalCode) {
      where.postalCode = query.postalCode.trim();
    }

    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { code: { contains: term, mode: 'insensitive' } },
        { locality: { contains: term, mode: 'insensitive' } },
        { city: { contains: term, mode: 'insensitive' } },
        { address: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }

    // Bounding box pre-filter for geographic proximity
    const hasCoordinates =
      query.latitude !== undefined &&
      query.latitude !== null &&
      query.longitude !== undefined &&
      query.longitude !== null;

    if (hasCoordinates) {
      const radiusKm = Math.min(100, Math.max(0.5, Number(query.radiusKm) || 10));
      const deltaLat = radiusKm / 111.045;
      const deltaLon =
        radiusKm / (111.045 * Math.cos((query.latitude! * Math.PI) / 180));

      where.latitude = {
        gte: query.latitude! - deltaLat,
        lte: query.latitude! + deltaLat,
      };
      where.longitude = {
        gte: query.longitude! - deltaLon,
        lte: query.longitude! + deltaLon,
      };
    }

    // Fetch candidate properties matching SQL filters
    const rawProperties: any[] = await (this.prisma as any).property.findMany({
      where,
      include: {
        organization: {
          select: {
            name: true,
          },
        },
        amenities: {
          include: {
            amenity: true,
          },
        },
        media: {
          where: { category: 'IMAGE' },
          take: 5,
        },
        rooms: {
          where: { deletedAt: null },
          include: {
            beds: {
              where: { deletedAt: null },
            },
          },
        },
        rentalUnits: {
          where: { deletedAt: null },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Map and calculate derived inventory, pricing, and distance metrics
    let candidates: PropertyDiscoveryDto[] = rawProperties.map((p: any) => {
      let distanceKm: number | null = null;
      if (
        hasCoordinates &&
        p.latitude !== null &&
        p.latitude !== undefined &&
        p.longitude !== null &&
        p.longitude !== undefined
      ) {
        distanceKm = this.calculateHaversineDistance(
          query.latitude!,
          query.longitude!,
          p.latitude,
          p.longitude
        );
      }

      let startingRent = 0;
      let maxRent = 0;
      let totalCapacity = 0;
      let availableCapacity = 0;
      const availableSharingTypes: RoomSharingType[] = [];
      const availableUnitTypes: string[] = [];

      if (p.propertyType === PropertyType.PG) {
        const activeBeds: any[] = (p.rooms || []).flatMap((r: any) => r.beds || []);
        totalCapacity = activeBeds.length;
        const availableBeds = activeBeds.filter((b: any) => b.status === 'AVAILABLE');
        availableCapacity = availableBeds.length;

        // Sharing types with available beds
        (p.rooms || []).forEach((r: any) => {
          if ((r.beds || []).some((b: any) => b.status === 'AVAILABLE')) {
            if (!availableSharingTypes.includes(r.sharingType)) {
              availableSharingTypes.push(r.sharingType);
            }
          }
        });

        const activeBedRents = activeBeds.map((b: any) => Number(b.monthlyRent));
        const activeRoomRents = (p.rooms || []).map((r: any) => Number(r.baseRent));
        const allRents = [...activeBedRents, ...activeRoomRents].filter((r: number) => r > 0);

        if (availableBeds.length > 0) {
          const availRents = availableBeds.map((b: any) => Number(b.monthlyRent)).filter((r: number) => r > 0);
          startingRent = availRents.length > 0 ? Math.min(...availRents) : (allRents.length > 0 ? Math.min(...allRents) : 0);
        } else {
          startingRent = allRents.length > 0 ? Math.min(...allRents) : 0;
        }
        maxRent = allRents.length > 0 ? Math.max(...allRents) : 0;
      } else {
        // Whole-Unit Rental
        const units: any[] = p.rentalUnits || [];
        totalCapacity = units.length;
        const availableUnits = units.filter((u: any) => u.status === 'AVAILABLE');
        availableCapacity = availableUnits.length;

        availableUnits.forEach((u: any) => {
          if (u.unitType && !availableUnitTypes.includes(u.unitType)) {
            availableUnitTypes.push(u.unitType);
          }
        });

        const activeUnitRents = units.map((u: any) => Number(u.monthlyRent)).filter((r: number) => r > 0);
        if (availableUnits.length > 0) {
          const availRents = availableUnits.map((u: any) => Number(u.monthlyRent)).filter((r: number) => r > 0);
          startingRent = availRents.length > 0 ? Math.min(...availRents) : (activeUnitRents.length > 0 ? Math.min(...activeUnitRents) : 0);
        } else {
          startingRent = activeUnitRents.length > 0 ? Math.min(...activeUnitRents) : 0;
        }
        maxRent = activeUnitRents.length > 0 ? Math.max(...activeUnitRents) : 0;
      }

      const amenitiesList = (p.amenities || [])
        .filter((pa: any) => pa.amenity)
        .map((pa: any) => ({
          id: pa.amenity.id,
          name: pa.amenity.name,
          category: pa.amenity.category,
          icon: pa.amenity.icon,
        }));

      const images = p.images && p.images.length > 0
        ? p.images
        : (p.media || []).map((m: any) => m.fileUrl);

      return {
        id: p.id,
        organizationId: p.organizationId,
        organizationName: p.organization?.name || 'PropertyOS Host',
        code: p.code,
        name: p.name,
        propertyType: p.propertyType,
        status: p.status,
        description: p.description,
        address: p.address,
        addressLine1: p.addressLine1,
        addressLine2: p.addressLine2,
        locality: p.locality,
        city: p.city,
        district: p.district,
        state: p.state,
        country: p.country,
        postalCode: p.postalCode,
        latitude: p.latitude,
        longitude: p.longitude,
        distanceKm,
        contactPhone: p.contactPhone,
        contactEmail: p.contactEmail,
        images,
        startingRent,
        maxRent,
        totalCapacity,
        availableCapacity,
        hasAvailability: availableCapacity > 0,
        availableSharingTypes,
        availableUnitTypes,
        amenities: amenitiesList,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      };
    });

    // Post-filtering for exact radius, price bounds, inventory types, and amenity intersection
    if (hasCoordinates) {
      const radiusKm = Math.min(100, Math.max(0.5, Number(query.radiusKm) || 10));
      candidates = candidates.filter(
        (c) => c.distanceKm !== null && c.distanceKm !== undefined && c.distanceKm <= radiusKm
      );
    }

    if (query.availableOnly) {
      candidates = candidates.filter((c) => c.hasAvailability);
    }

    if (query.minRent !== undefined && query.minRent !== null) {
      const min = Number(query.minRent);
      candidates = candidates.filter((c) => c.startingRent >= min || (c.maxRent >= min && c.maxRent > 0));
    }

    if (query.maxRent !== undefined && query.maxRent !== null) {
      const max = Number(query.maxRent);
      candidates = candidates.filter((c) => c.startingRent <= max && c.startingRent > 0);
    }

    if (query.sharingTypes && query.sharingTypes.length > 0) {
      candidates = candidates.filter((c) =>
        c.propertyType === PropertyType.PG &&
        c.availableSharingTypes.some((st) => query.sharingTypes!.includes(st))
      );
    }

    if (query.unitTypes && query.unitTypes.length > 0) {
      const lowerUnitTypes = query.unitTypes.map((u) => u.toLowerCase().trim());
      candidates = candidates.filter((c) =>
        c.propertyType === PropertyType.RENTAL_HOUSE &&
        c.availableUnitTypes.some((ut) => lowerUnitTypes.includes(ut.toLowerCase()))
      );
    }

    if (query.amenities && query.amenities.length > 0) {
      // Required intersection: Property must have ALL requested amenities
      const requiredAmenityNames = query.amenities.map((a) => a.toLowerCase().trim());
      candidates = candidates.filter((c) => {
        const propertyAmenityNames = c.amenities.map((a) => a.name.toLowerCase().trim());
        return requiredAmenityNames.every((req) => propertyAmenityNames.includes(req));
      });
    }

    // Deterministic Sorting
    const sortBy = query.sortBy || DiscoverySortBy.NEWEST;
    candidates.sort((a, b) => {
      switch (sortBy) {
        case DiscoverySortBy.RENT_ASC: {
          const rentDiff = a.startingRent - b.startingRent;
          return rentDiff !== 0 ? rentDiff : a.id.localeCompare(b.id);
        }
        case DiscoverySortBy.RENT_DESC: {
          const rentDiff = b.startingRent - a.startingRent;
          return rentDiff !== 0 ? rentDiff : a.id.localeCompare(b.id);
        }
        case DiscoverySortBy.DISTANCE_ASC: {
          const distA = a.distanceKm !== null && a.distanceKm !== undefined ? a.distanceKm : 999999;
          const distB = b.distanceKm !== null && b.distanceKm !== undefined ? b.distanceKm : 999999;
          const distDiff = distA - distB;
          return distDiff !== 0 ? distDiff : a.id.localeCompare(b.id);
        }
        case DiscoverySortBy.NAME_ASC: {
          const nameDiff = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
          return nameDiff !== 0 ? nameDiff : a.id.localeCompare(b.id);
        }
        case DiscoverySortBy.NEWEST:
        default: {
          const dateDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          return dateDiff !== 0 ? dateDiff : a.id.localeCompare(b.id);
        }
      }
    });

    const total = candidates.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const skip = (page - 1) * limit;
    const items = candidates.slice(skip, skip + limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Returns active discovery cities and locality summaries
   */
  async getDiscoveryCities(): Promise<DiscoveryCitySummaryDto[]> {
    const properties: any[] = await (this.prisma as any).property.findMany({
      where: {
        status: PropertyStatus.ACTIVE,
        deletedAt: null,
      },
      select: {
        city: true,
        state: true,
        locality: true,
        propertyType: true,
      },
    });

    const cityMap = new Map<
      string,
      {
        city: string;
        state: string;
        activePropertiesCount: number;
        pgCount: number;
        rentalCount: number;
        localities: Set<string>;
      }
    >();

    for (const p of properties) {
      const cityKey = p.city.trim().toLowerCase();
      const existing = cityMap.get(cityKey);

      if (existing) {
        existing.activePropertiesCount++;
        if (p.propertyType === PropertyType.PG) existing.pgCount++;
        if (p.propertyType === PropertyType.RENTAL_HOUSE) existing.rentalCount++;
        if (p.locality && p.locality.trim()) {
          existing.localities.add(p.locality.trim());
        }
      } else {
        const localities = new Set<string>();
        if (p.locality && p.locality.trim()) localities.add(p.locality.trim());

        cityMap.set(cityKey, {
          city: p.city.trim(),
          state: p.state.trim(),
          activePropertiesCount: 1,
          pgCount: p.propertyType === PropertyType.PG ? 1 : 0,
          rentalCount: p.propertyType === PropertyType.RENTAL_HOUSE ? 1 : 0,
          localities,
        });
      }
    }

    return Array.from(cityMap.values())
      .map((item) => ({
        city: item.city,
        state: item.state,
        activePropertiesCount: item.activePropertiesCount,
        pgCount: item.pgCount,
        rentalCount: item.rentalCount,
        localities: Array.from(item.localities).sort((a, b) => a.localeCompare(b)),
      }))
      .sort((a, b) => b.activePropertiesCount - a.activePropertiesCount || a.city.localeCompare(b.city));
  }

  /**
   * Returns deterministic curated featured properties
   */
  async getFeaturedProperties(limit = 6): Promise<PropertyDiscoveryDto[]> {
    const availableResult = await this.searchProperties({
      page: 1,
      limit,
      availableOnly: true,
      sortBy: DiscoverySortBy.NEWEST,
    });

    if (availableResult.items.length >= limit) {
      return availableResult.items.slice(0, limit);
    }

    const generalResult = await this.searchProperties({
      page: 1,
      limit,
      sortBy: DiscoverySortBy.NEWEST,
    });

    const combined = [...availableResult.items];
    for (const item of generalResult.items) {
      if (!combined.some((c) => c.id === item.id)) {
        combined.push(item);
      }
      if (combined.length >= limit) break;
    }

    return combined.slice(0, limit);
  }

  /**
   * Returns public discovery details for a single property by ID
   */
  async getDiscoveryDetailById(id: string): Promise<PropertyDiscoveryDetailDto> {
    const property: any = await (this.prisma as any).property.findFirst({
      where: {
        id,
        status: PropertyStatus.ACTIVE,
        deletedAt: null,
      },
      include: {
        organization: {
          select: {
            name: true,
          },
        },
        amenities: {
          include: {
            amenity: true,
          },
        },
        media: true,
        rooms: {
          where: { deletedAt: null },
          include: {
            floor: { select: { floorNumber: true } },
            beds: {
              where: { deletedAt: null },
            },
          },
        },
        rentalUnits: {
          where: { deletedAt: null },
        },
      },
    });

    if (!property) {
      // Fail-closed: Return 404 for inactive, archived, deleted, or foreign properties
      throw new NotFoundException('Property not found or is not available for public discovery');
    }

    let startingRent = 0;
    let maxRent = 0;
    let totalCapacity = 0;
    let availableCapacity = 0;
    const availableSharingTypes: RoomSharingType[] = [];
    const availableUnitTypes: string[] = [];

    let availableRooms: PropertyDiscoveryDetailDto['availableRooms'];
    let availableUnits: PropertyDiscoveryDetailDto['availableUnits'];

    if (property.propertyType === PropertyType.PG) {
      const rooms: any[] = property.rooms || [];
      const activeBeds: any[] = rooms.flatMap((r: any) => r.beds || []);
      totalCapacity = activeBeds.length;
      const availableBeds = activeBeds.filter((b: any) => b.status === 'AVAILABLE');
      availableCapacity = availableBeds.length;

      rooms.forEach((r: any) => {
        if ((r.beds || []).some((b: any) => b.status === 'AVAILABLE')) {
          if (!availableSharingTypes.includes(r.sharingType)) {
            availableSharingTypes.push(r.sharingType);
          }
        }
      });

      const activeBedRents = activeBeds.map((b: any) => Number(b.monthlyRent));
      const activeRoomRents = rooms.map((r: any) => Number(r.baseRent));
      const allRents = [...activeBedRents, ...activeRoomRents].filter((r: number) => r > 0);

      if (availableBeds.length > 0) {
        const availRents = availableBeds.map((b: any) => Number(b.monthlyRent)).filter((r: number) => r > 0);
        startingRent = availRents.length > 0 ? Math.min(...availRents) : (allRents.length > 0 ? Math.min(...allRents) : 0);
      } else {
        startingRent = allRents.length > 0 ? Math.min(...allRents) : 0;
      }
      maxRent = allRents.length > 0 ? Math.max(...allRents) : 0;

      // Group rooms for public summary
      availableRooms = rooms.map((r: any) => ({
        id: r.id,
        roomNumber: r.roomNumber,
        floorNumber: r.floor?.floorNumber || null,
        sharingType: r.sharingType,
        capacity: r.capacity,
        baseRent: Number(r.baseRent),
        availableBedsCount: (r.beds || []).filter((b: any) => b.status === 'AVAILABLE').length,
        amenities: r.amenities || [],
        beds: (r.beds || []).map((b: any) => ({
          id: b.id,
          bedNumber: b.bedNumber,
          monthlyRent: Number(b.monthlyRent),
          status: b.status,
        })),
      }));
    } else {
      // Whole-Unit Rental
      const units: any[] = property.rentalUnits || [];
      totalCapacity = units.length;
      const availableUnitsList = units.filter((u: any) => u.status === 'AVAILABLE');
      availableCapacity = availableUnitsList.length;

      availableUnitsList.forEach((u: any) => {
        if (u.unitType && !availableUnitTypes.includes(u.unitType)) {
          availableUnitTypes.push(u.unitType);
        }
      });

      const activeUnitRents = units.map((u: any) => Number(u.monthlyRent)).filter((r: number) => r > 0);
      if (availableUnitsList.length > 0) {
        const availRents = availableUnitsList.map((u: any) => Number(u.monthlyRent)).filter((r: number) => r > 0);
        startingRent = availRents.length > 0 ? Math.min(...availRents) : (activeUnitRents.length > 0 ? Math.min(...activeUnitRents) : 0);
      } else {
        startingRent = activeUnitRents.length > 0 ? Math.min(...activeUnitRents) : 0;
      }
      maxRent = activeUnitRents.length > 0 ? Math.max(...activeUnitRents) : 0;

      availableUnits = units.map((u: any) => ({
        id: u.id,
        unitNumber: u.unitNumber,
        unitType: u.unitType,
        floorNumber: u.floorNumber,
        superBuiltupAreaSqFt: u.superBuiltupAreaSqFt,
        carpetAreaSqFt: u.carpetAreaSqFt,
        furnishingStatus: u.furnishingStatus,
        monthlyRent: Number(u.monthlyRent),
        securityDeposit: Number(u.securityDeposit),
        maintenanceCharges: Number(u.maintenanceCharges),
        status: u.status,
      }));
    }

    const amenitiesList = (property.amenities || [])
      .filter((pa: any) => pa.amenity)
      .map((pa: any) => ({
        id: pa.amenity.id,
        name: pa.amenity.name,
        category: pa.amenity.category,
        icon: pa.amenity.icon,
      }));

    const mediaList = (property.media || []).map((m: any) => ({
      id: m.id,
      propertyId: m.propertyId,
      fileName: m.fileName,
      originalName: m.originalName,
      mimeType: m.mimeType,
      fileSize: m.fileSize,
      fileUrl: m.fileUrl,
      category: m.category,
      createdAt: m.createdAt,
    }));

    const images = property.images && property.images.length > 0
      ? property.images
      : (property.media || []).filter((m: any) => m.category === 'IMAGE').map((m: any) => m.fileUrl);

    return {
      id: property.id,
      organizationId: property.organizationId,
      organizationName: property.organization?.name || 'PropertyOS Host',
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
      distanceKm: null,
      contactPhone: property.contactPhone,
      contactEmail: property.contactEmail,
      images,
      startingRent,
      maxRent,
      totalCapacity,
      availableCapacity,
      hasAvailability: availableCapacity > 0,
      availableSharingTypes,
      availableUnitTypes,
      amenities: amenitiesList,
      media: mediaList,
      availableRooms,
      availableUnits,
      createdAt: property.createdAt,
      updatedAt: property.updatedAt,
    };
  }
}
