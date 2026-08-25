import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';
import { PrismaService } from '../../database/prisma.service';
import {
  PropertyType,
  PropertyStatus,
  RoomSharingType,
  DiscoverySortBy,
} from '@propertyos/types';

describe('DiscoveryService', () => {
  let service: DiscoveryService;
  let prisma: any;

  const mockProperties = [
    {
      id: 'prop-1',
      organizationId: 'org-1',
      organization: { name: 'Apex Living' },
      code: 'PROP-000001',
      name: 'Apex PG Koramangala',
      propertyType: PropertyType.PG,
      status: PropertyStatus.ACTIVE,
      description: 'Luxury PG near Sony World Signal with fast WiFi and food',
      address: '123, 5th Block',
      locality: 'Koramangala',
      city: 'Bangalore',
      district: 'Bangalore Urban',
      state: 'Karnataka',
      country: 'India',
      postalCode: '560095',
      latitude: 12.9352,
      longitude: 77.6245,
      contactPhone: '+919876543210',
      contactEmail: 'apex@example.com',
      images: ['https://example.com/p1.jpg'],
      media: [],
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
      deletedAt: null,
      amenities: [
        { amenity: { id: 'a1', name: 'High-Speed WiFi', category: 'Connectivity', icon: 'Wifi' } },
        { amenity: { id: 'a2', name: 'Air Conditioning', category: 'Climate', icon: 'AirVent' } },
        { amenity: { id: 'a3', name: 'Food/Mess Included', category: 'Food', icon: 'Utensils' } },
      ],
      rooms: [
        {
          id: 'room-1',
          roomNumber: '101',
          sharingType: RoomSharingType.DOUBLE,
          baseRent: '9000',
          amenities: ['AC'],
          deletedAt: null,
          beds: [
            { id: 'bed-1', bedNumber: '101-A', monthlyRent: '9500', status: 'AVAILABLE', deletedAt: null },
            { id: 'bed-2', bedNumber: '101-B', monthlyRent: '9500', status: 'OCCUPIED', deletedAt: null },
          ],
        },
        {
          id: 'room-2',
          roomNumber: '102',
          sharingType: RoomSharingType.SINGLE,
          baseRent: '16000',
          amenities: ['AC', 'Balcony'],
          deletedAt: null,
          beds: [
            { id: 'bed-3', bedNumber: '102-A', monthlyRent: '16000', status: 'AVAILABLE', deletedAt: null },
          ],
        },
      ],
      rentalUnits: [],
    },
    {
      id: 'prop-2',
      organizationId: 'org-1',
      organization: { name: 'Apex Living' },
      code: 'PROP-000002',
      name: 'Zenith Heights 2BHK',
      propertyType: PropertyType.RENTAL_HOUSE,
      status: PropertyStatus.ACTIVE,
      description: 'Spacious 2BHK apartment in HSR Layout',
      address: '456, 27th Main',
      locality: 'HSR Layout',
      city: 'Bangalore',
      district: 'Bangalore Urban',
      state: 'Karnataka',
      country: 'India',
      postalCode: '560102',
      latitude: 12.9121,
      longitude: 77.6446,
      contactPhone: '+919876543211',
      contactEmail: 'zenith@example.com',
      images: ['https://example.com/p2.jpg'],
      media: [],
      createdAt: new Date('2026-02-01'),
      updatedAt: new Date('2026-02-01'),
      deletedAt: null,
      amenities: [
        { amenity: { id: 'a1', name: 'High-Speed WiFi', category: 'Connectivity', icon: 'Wifi' } },
        { amenity: { id: 'a4', name: 'Covered Parking', category: 'Parking', icon: 'Car' } },
      ],
      rooms: [],
      rentalUnits: [
        {
          id: 'unit-1',
          unitNumber: 'Flat 201',
          unitType: '2BHK',
          furnishingStatus: 'SEMI_FURNISHED',
          monthlyRent: '32000',
          securityDeposit: '100000',
          maintenanceCharges: '2500',
          status: 'AVAILABLE',
          deletedAt: null,
        },
        {
          id: 'unit-2',
          unitNumber: 'Flat 202',
          unitType: '3BHK',
          furnishingStatus: 'FULLY_FURNISHED',
          monthlyRent: '45000',
          securityDeposit: '150000',
          maintenanceCharges: '3500',
          status: 'OCCUPIED',
          deletedAt: null,
        },
      ],
    },
    {
      id: 'prop-3',
      organizationId: 'org-2',
      organization: { name: 'Metro Homes' },
      code: 'PROP-000003',
      name: 'Cyber City PG',
      propertyType: PropertyType.PG,
      status: PropertyStatus.ACTIVE,
      description: 'Affordable triple sharing near HITEC City',
      address: '789 Madhapur',
      locality: 'Madhapur',
      city: 'Hyderabad',
      district: 'Hyderabad',
      state: 'Telangana',
      country: 'India',
      postalCode: '500081',
      latitude: 17.4483,
      longitude: 78.3915,
      contactPhone: '+919876543212',
      contactEmail: 'cyber@example.com',
      images: [],
      media: [{ fileUrl: 'https://example.com/p3.jpg', category: 'IMAGE' }],
      createdAt: new Date('2026-03-01'),
      updatedAt: new Date('2026-03-01'),
      deletedAt: null,
      amenities: [
        { amenity: { id: 'a1', name: 'High-Speed WiFi', category: 'Connectivity', icon: 'Wifi' } },
      ],
      rooms: [
        {
          id: 'room-3',
          roomNumber: '301',
          sharingType: RoomSharingType.TRIPLE,
          baseRent: '6500',
          amenities: [],
          deletedAt: null,
          beds: [
            { id: 'bed-4', bedNumber: '301-A', monthlyRent: '6500', status: 'OCCUPIED', deletedAt: null },
            { id: 'bed-5', bedNumber: '301-B', monthlyRent: '6500', status: 'OCCUPIED', deletedAt: null },
            { id: 'bed-6', bedNumber: '301-C', monthlyRent: '6500', status: 'OCCUPIED', deletedAt: null },
          ],
        },
      ],
      rentalUnits: [],
    },
  ];

  beforeEach(async () => {
    prisma = {
      property: {
        findMany: jest.fn().mockImplementation((args: any) => {
          let list = [...mockProperties];
          if (args?.where?.propertyType) {
            list = list.filter((p) => p.propertyType === args.where.propertyType);
          }
          if (args?.where?.city?.contains) {
            const c = args.where.city.contains.toLowerCase();
            list = list.filter((p) => p.city.toLowerCase().includes(c));
          }
          if (args?.where?.locality?.contains) {
            const loc = args.where.locality.contains.toLowerCase();
            list = list.filter((p) => p.locality.toLowerCase().includes(loc));
          }
          return Promise.resolve(list);
        }),
        findFirst: jest.fn().mockImplementation((args: any) => {
          const found = mockProperties.find((p) => p.id === args?.where?.id && p.status === args?.where?.status);
          return Promise.resolve(found || null);
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscoveryService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<DiscoveryService>(DiscoveryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateHaversineDistance', () => {
    it('calculates accurate distance in km between Koramangala and HSR Layout (approx 3.3 km)', () => {
      const dist = service.calculateHaversineDistance(12.9352, 77.6245, 12.9121, 77.6446);
      expect(dist).toBeGreaterThan(3.0);
      expect(dist).toBeLessThan(3.6);
    });

    it('returns 0 for identical coordinates', () => {
      const dist = service.calculateHaversineDistance(12.9352, 77.6245, 12.9352, 77.6245);
      expect(dist).toBe(0);
    });
  });

  describe('searchProperties', () => {
    it('returns all active discoverable properties with pagination', async () => {
      const res = await service.searchProperties({ page: 1, limit: 10 });
      expect(res.items.length).toBe(3);
      expect(res.total).toBe(3);
      expect(res.page).toBe(1);
      expect(res.totalPages).toBe(1);
      expect(res.items[0].organizationName).toBeDefined();
    });

    it('filters properties by operating model (PG)', async () => {
      const res = await service.searchProperties({ propertyType: PropertyType.PG });
      expect(res.items.every((p) => p.propertyType === PropertyType.PG)).toBe(true);
      expect(res.items.length).toBe(2);
    });

    it('filters properties by city (Bangalore)', async () => {
      const res = await service.searchProperties({ city: 'Bangalore' });
      expect(res.items.length).toBe(2);
      expect(res.items.every((p) => p.city === 'Bangalore')).toBe(true);
    });

    it('filters properties by locality (Koramangala)', async () => {
      const res = await service.searchProperties({ locality: 'Koramangala' });
      expect(res.items.length).toBe(1);
      expect(res.items[0].id).toBe('prop-1');
    });

    it('calculates available capacity and starting rent for PG', async () => {
      const res = await service.searchProperties({ search: 'Apex' });
      const pg = res.items.find((p) => p.id === 'prop-1')!;
      expect(pg.totalCapacity).toBe(3);
      expect(pg.availableCapacity).toBe(2);
      expect(pg.hasAvailability).toBe(true);
      expect(pg.startingRent).toBe(9500);
      expect(pg.maxRent).toBe(16000);
      expect(pg.availableSharingTypes).toContain(RoomSharingType.DOUBLE);
      expect(pg.availableSharingTypes).toContain(RoomSharingType.SINGLE);
    });

    it('filters by availableOnly flag (excludes fully occupied PG)', async () => {
      const res = await service.searchProperties({ availableOnly: true });
      expect(res.items.some((p) => p.id === 'prop-3')).toBe(false); // prop-3 has 0 available beds
      expect(res.items.length).toBe(2);
    });

    it('filters by rent bounds (minRent and maxRent)', async () => {
      const res = await service.searchProperties({ minRent: 20000, maxRent: 40000 });
      expect(res.items.length).toBe(1);
      expect(res.items[0].id).toBe('prop-2'); // 2BHK rental starting at 32000
    });

    it('filters by required amenity intersection (WiFi and AC)', async () => {
      const res = await service.searchProperties({ amenities: ['High-Speed WiFi', 'Air Conditioning'] });
      expect(res.items.length).toBe(1);
      expect(res.items[0].id).toBe('prop-1');
    });

    it('filters by geo-proximity radius (within 5km of Koramangala)', async () => {
      const res = await service.searchProperties({
        latitude: 12.9352,
        longitude: 77.6245,
        radiusKm: 5,
        sortBy: DiscoverySortBy.DISTANCE_ASC,
      });
      expect(res.items.length).toBe(2); // Koramangala (0km) and HSR Layout (~3.3km), Hyderabad excluded
      expect(res.items[0].id).toBe('prop-1');
      expect(res.items[0].distanceKm).toBe(0);
      expect(res.items[1].id).toBe('prop-2');
    });

    it('sorts by lowest rent first (RENT_ASC)', async () => {
      const res = await service.searchProperties({ sortBy: DiscoverySortBy.RENT_ASC });
      expect(res.items[0].startingRent).toBeLessThanOrEqual(res.items[1].startingRent);
    });
  });

  describe('getDiscoveryCities', () => {
    it('returns distinct cities with active property counts', async () => {
      const cities = await service.getDiscoveryCities();
      expect(cities.length).toBe(2);
      expect(cities[0].city).toBe('Bangalore');
      expect(cities[0].activePropertiesCount).toBe(2);
      expect(cities[0].localities).toContain('Koramangala');
      expect(cities[0].localities).toContain('HSR Layout');
    });
  });

  describe('getFeaturedProperties', () => {
    it('returns curated properties with available inventory prioritized', async () => {
      const featured = await service.getFeaturedProperties(2);
      expect(featured.length).toBe(2);
      expect(featured.every((p) => p.hasAvailability)).toBe(true);
    });
  });

  describe('getDiscoveryDetailById', () => {
    it('returns full public discovery details for a valid active property', async () => {
      const detail = await service.getDiscoveryDetailById('prop-1');
      expect(detail.id).toBe('prop-1');
      expect(detail.availableRooms).toBeDefined();
      expect(detail.availableRooms?.length).toBe(2);
      expect(detail.amenities.length).toBe(3);
    });

    it('throws NotFoundException for non-existent or inactive property (fail-closed)', async () => {
      await expect(service.getDiscoveryDetailById('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });
});
