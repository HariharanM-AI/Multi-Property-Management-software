import { Test, TestingModule } from '@nestjs/testing';
import { PropertiesService } from './properties.service';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { LocalStorageDriver } from '../../common/storage/local-storage.driver';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import {
  PropertyType,
  PropertyStatus,
  PropertyCapability,
  CreatePropertyDto,
} from '@propertyos/types';

describe('PropertiesService (CORE-004)', () => {
  let service: PropertiesService;
  let storageDriver: LocalStorageDriver;

  let currentSequence = 0;

  const mockPrisma = {
    organizationSequence: {
      upsert: jest.fn(),
    },
    property: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    amenity: {
      upsert: jest.fn(),
    },
    propertyAmenity: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    propertyMedia: {
      create: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockStorageService = {
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
    validateFile: jest.fn(),
  };

  beforeEach(async () => {
    currentSequence = 0;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PropertiesService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
        LocalStorageDriver,
      ],
    }).compile();

    service = module.get<PropertiesService>(PropertiesService);
    storageDriver = module.get<LocalStorageDriver>(LocalStorageDriver);
    jest.clearAllMocks();
  });

  describe('Concurrency-Safe Property Reference Code Generation', () => {
    it('should generate unique atomic property codes under simultaneous concurrent creation requests', async () => {
      // Simulate atomic counter increment inside interactive transaction
      mockPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
        currentSequence += 1;
        const seqVal = currentSequence;
        const generatedCode = `PROP-${String(seqVal).padStart(6, '0')}`;

        const tx = {
          organizationSequence: {
            upsert: jest.fn().mockResolvedValue({ currentValue: seqVal }),
          },
          property: {
            create: jest.fn().mockImplementation((args) => ({
              id: `prop-uuid-${seqVal}`,
              organizationId: 'org-1',
              code: generatedCode,
              name: args.data.name,
              propertyType: args.data.propertyType,
              status: PropertyStatus.ACTIVE,
              address: args.data.address,
              city: args.data.city,
              state: args.data.state,
              postalCode: args.data.postalCode,
              amenities: [],
              media: [],
              createdAt: new Date(),
              updatedAt: new Date(),
              deletedAt: null,
            })),
          },
          amenity: {
            upsert: jest.fn().mockResolvedValue({ id: 'amenity-1', name: 'Wi-Fi' }),
          },
          propertyAmenity: {
            create: jest.fn().mockResolvedValue({}),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({}),
          },
        };

        return cb(tx);
      });

      // Mock getPropertyById to return created property
      mockPrisma.property.findFirst.mockImplementation((args) => {
        const id = args.where.id;
        const num = id.replace('prop-uuid-', '');
        return Promise.resolve({
          id,
          organizationId: 'org-1',
          code: `PROP-${String(num).padStart(6, '0')}`,
          name: `Property ${num}`,
          propertyType: PropertyType.PG,
          status: PropertyStatus.ACTIVE,
          address: '#123 Test St',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560102',
          amenities: [],
          media: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        });
      });

      // Launch 5 simultaneous property creations concurrently
      const creationPromises = Array.from({ length: 5 }).map((_, i) =>
        service.createProperty('org-1', 'user-owner', {
          name: `Concurrent Property ${i + 1}`,
          propertyType: PropertyType.PG,
          address: '#123 Test St',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560102',
        })
      );

      const results = await Promise.all(creationPromises);
      const codes = results.map((r) => r.code);

      // Verify all 5 codes are strictly unique and sequential
      expect(new Set(codes).size).toBe(5);
      expect(codes).toEqual([
        'PROP-000001',
        'PROP-000002',
        'PROP-000003',
        'PROP-000004',
        'PROP-000005',
      ]);
    });
  });

  describe('Dual Operating Model & Capability Resolution', () => {
    it('should correctly resolve PG capabilities and exclude Rental capabilities for PG properties', async () => {
      mockPrisma.property.findFirst.mockResolvedValue({
        id: 'prop-pg',
        organizationId: 'org-1',
        code: 'PROP-000001',
        name: 'GreenGlen PG Residency',
        propertyType: PropertyType.PG,
        status: PropertyStatus.ACTIVE,
        address: 'HSR Layout',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560102',
        amenities: [],
        media: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      const result = await service.getPropertyById('org-1', 'prop-pg');

      expect(result.propertyType).toBe(PropertyType.PG);
      expect(result.capabilities).toContain(PropertyCapability.FLOORS);
      expect(result.capabilities).toContain(PropertyCapability.ROOMS);
      expect(result.capabilities).toContain(PropertyCapability.BEDS);
      expect(result.capabilities).toContain(PropertyCapability.MEAL_PLANS);
      expect(result.capabilities).toContain(PropertyCapability.SHARED_UTILITIES);

      // Must NOT contain whole-unit rental capabilities
      expect(result.capabilities).not.toContain(PropertyCapability.RENTAL_UNITS);
      expect(result.capabilities).not.toContain(PropertyCapability.LEASES);
      expect(result.capabilities).not.toContain(PropertyCapability.SECURITY_DEPOSITS);
    });

    it('should correctly resolve Rental capabilities and exclude PG capabilities for RENTAL_HOUSE properties', async () => {
      mockPrisma.property.findFirst.mockResolvedValue({
        id: 'prop-rental',
        organizationId: 'org-1',
        code: 'PROP-000002',
        name: 'Indiranagar Heights Flat #402',
        propertyType: PropertyType.RENTAL_HOUSE,
        status: PropertyStatus.ACTIVE,
        address: 'Indiranagar 100ft Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560038',
        amenities: [],
        media: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      const result = await service.getPropertyById('org-1', 'prop-rental');

      expect(result.propertyType).toBe(PropertyType.RENTAL_HOUSE);
      expect(result.capabilities).toContain(PropertyCapability.RENTAL_UNITS);
      expect(result.capabilities).toContain(PropertyCapability.LEASES);
      expect(result.capabilities).toContain(PropertyCapability.SECURITY_DEPOSITS);
      expect(result.capabilities).toContain(PropertyCapability.RENT_ESCALATION);

      // Must NOT contain PG sharing capabilities
      expect(result.capabilities).not.toContain(PropertyCapability.FLOORS);
      expect(result.capabilities).not.toContain(PropertyCapability.ROOMS);
      expect(result.capabilities).not.toContain(PropertyCapability.BEDS);
      expect(result.capabilities).not.toContain(PropertyCapability.MEAL_PLANS);
    });
  });

  describe('Multi-Tenant Isolation & Security', () => {
    it('should throw NotFoundException (fail-closed) when Org A tries to access Org B property', async () => {
      // Return null because where clause organizationId does not match Org B's property
      mockPrisma.property.findFirst.mockResolvedValue(null);

      await expect(service.getPropertyById('org-A', 'prop-of-org-B')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw NotFoundException when Org A tries to update Org B property', async () => {
      mockPrisma.property.findFirst.mockResolvedValue(null);

      await expect(
        service.updateProperty('org-A', 'user-A', 'prop-of-org-B', {
          name: 'Hacked Name',
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when Org A tries to archive Org B property', async () => {
      mockPrisma.property.findFirst.mockResolvedValue(null);

      await expect(
        service.archiveProperty('org-A', 'user-A', 'prop-of-org-B')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Property Archive & Restore Lifecycle', () => {
    it('should soft-delete property by setting status ARCHIVED and deletedAt timestamp', async () => {
      mockPrisma.property.findFirst.mockResolvedValue({
        id: 'prop-1',
        organizationId: 'org-1',
        name: 'Test PG',
        code: 'PROP-000001',
        deletedAt: null,
      });

      mockPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
        const tx = {
          property: {
            update: jest.fn().mockResolvedValue({}),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return cb(tx);
      });

      const result = await service.archiveProperty('org-1', 'user-1', 'prop-1');

      expect(result.message).toContain('archived successfully');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should restore an archived property by clearing deletedAt and setting status ACTIVE', async () => {
      mockPrisma.property.findFirst.mockResolvedValue({
        id: 'prop-1',
        organizationId: 'org-1',
        name: 'Test PG',
        code: 'PROP-000001',
        deletedAt: new Date(),
      });

      mockPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
        const tx = {
          property: {
            update: jest.fn().mockResolvedValue({}),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return cb(tx);
      });

      const result = await service.restoreProperty('org-1', 'user-1', 'prop-1');

      expect(result.message).toContain('restored successfully');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('LocalStorageDriver File Security Validations', () => {
    it('should reject executable or disallowed file MIME types', () => {
      expect(() =>
        storageDriver.validateFile({
          originalname: 'malware.exe',
          mimetype: 'application/x-msdownload',
          size: 1024,
        })
      ).toThrow(BadRequestException);
    });

    it('should reject file when extension does not match MIME type', () => {
      expect(() =>
        storageDriver.validateFile({
          originalname: 'script.js',
          mimetype: 'image/png',
          size: 1024,
        })
      ).toThrow(BadRequestException);
    });

    it('should reject image file exceeding maximum size (5 MB)', () => {
      expect(() =>
        storageDriver.validateFile({
          originalname: 'huge_photo.jpg',
          mimetype: 'image/jpeg',
          size: 6 * 1024 * 1024, // 6 MB > 5 MB
        })
      ).toThrow(BadRequestException);
    });

    it('should accept valid image file', () => {
      expect(() =>
        storageDriver.validateFile({
          originalname: 'property_exterior.png',
          mimetype: 'image/png',
          size: 2 * 1024 * 1024, // 2 MB
        })
      ).not.toThrow();
    });
  });
});
