import { Test, TestingModule } from '@nestjs/testing';
import { PgStructureService } from './pg-structure.service';
import { PrismaService } from '../../database/prisma.service';
import { PropertyType, BedStatus, RoomSharingType, BedDto } from '@propertyos/types';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

describe('PgStructureService', () => {
  let service: PgStructureService;

  const mockPrismaService: any = {
    property: {
      findFirst: jest.fn(),
    },
    floor: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    room: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    bed: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((cb: any) => cb(mockPrismaService)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PgStructureService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<PgStructureService>(PgStructureService);

    jest.clearAllMocks();
  });

  describe('validatePgProperty', () => {
    it('should throw NotFoundException if property does not exist or belongs to another tenant', async () => {
      mockPrismaService.property.findFirst.mockResolvedValue(null);

      await expect(service.validatePgProperty('org-1', 'prop-1')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw BadRequestException if property type is not PG', async () => {
      mockPrismaService.property.findFirst.mockResolvedValue({
        propertyType: PropertyType.RENTAL_HOUSE,
      });

      await expect(service.validatePgProperty('org-1', 'prop-1')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should pass if property is PG and belongs to organization', async () => {
      mockPrismaService.property.findFirst.mockResolvedValue({
        propertyType: PropertyType.PG,
      });

      await expect(service.validatePgProperty('org-1', 'prop-1')).resolves.toBeUndefined();
    });
  });

  describe('getPgSummary', () => {
    it('should calculate summary metrics accurately', async () => {
      mockPrismaService.property.findFirst.mockResolvedValue({ propertyType: PropertyType.PG });
      mockPrismaService.floor.findMany.mockResolvedValue([{ id: 'f-1' }, { id: 'f-2' }]);
      mockPrismaService.room.findMany.mockResolvedValue([{ id: 'r-1' }]);
      mockPrismaService.bed.findMany.mockResolvedValue([
        { id: 'b-1', status: BedStatus.AVAILABLE },
        { id: 'b-2', status: BedStatus.OCCUPIED },
        { id: 'b-3', status: BedStatus.OCCUPIED },
        { id: 'b-4', status: BedStatus.RESERVED },
        { id: 'b-5', status: BedStatus.MAINTENANCE },
        { id: 'b-6', status: BedStatus.BLOCKED },
      ]);

      const summary = await service.getPgSummary('org-1', 'prop-1');

      expect(summary.totalFloors).toBe(2);
      expect(summary.totalRooms).toBe(1);
      expect(summary.totalBeds).toBe(6);
      expect(summary.availableBeds).toBe(1);
      expect(summary.occupiedBeds).toBe(2);
      expect(summary.occupancyRate).toBe(33); // 2/6 = 33%
    });
  });

  describe('Floor CRUD', () => {
    it('should create floor successfully if floor number is unique', async () => {
      mockPrismaService.property.findFirst.mockResolvedValue({ propertyType: PropertyType.PG });
      mockPrismaService.floor.findFirst.mockResolvedValue(null);
      mockPrismaService.floor.create.mockResolvedValue({
        id: 'floor-1',
        floorNumber: 1,
        name: 'First Floor',
      });

      const floor = await service.createFloor('org-1', 'prop-1', 'user-1', {
        floorNumber: 1,
        name: 'First Floor',
      });

      expect(floor.floorNumber).toBe(1);
      expect(mockPrismaService.auditLog.create).toHaveBeenCalled();
    });

    it('should throw ConflictException on duplicate floor number', async () => {
      mockPrismaService.property.findFirst.mockResolvedValue({ propertyType: PropertyType.PG });
      mockPrismaService.floor.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        service.createFloor('org-1', 'prop-1', 'user-1', {
          floorNumber: 1,
          name: 'First Floor',
        })
      ).rejects.toThrow(ConflictException);
    });

    it('should protect floor deletion if beds are occupied', async () => {
      mockPrismaService.property.findFirst.mockResolvedValue({ propertyType: PropertyType.PG });
      mockPrismaService.floor.findFirst.mockResolvedValue({
        id: 'floor-1',
        rooms: [
          {
            id: 'room-1',
            beds: [{ id: 'bed-1', status: BedStatus.OCCUPIED }],
          },
        ],
      });

      await expect(service.deleteFloor('org-1', 'prop-1', 'floor-1', 'user-1')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('Room CRUD & Capacity Validation', () => {
    it('should auto-generate beds matching room capacity', async () => {
      mockPrismaService.property.findFirst.mockResolvedValue({ propertyType: PropertyType.PG });
      mockPrismaService.floor.findFirst.mockResolvedValue({ id: 'floor-1' });
      mockPrismaService.room.findFirst.mockResolvedValue(null);
      mockPrismaService.room.create.mockResolvedValue({
        id: 'room-1',
        roomNumber: '101',
        sharingType: RoomSharingType.DOUBLE,
        capacity: 2,
        baseRent: { toNumber: () => 5000 },
        amenities: [],
      });
      mockPrismaService.bed.create.mockImplementation((args: any) => ({
        ...args.data,
        id: 'bed-id',
        monthlyRent: { toNumber: () => 5000 },
      }));

      const room = await service.createRoom('org-1', 'prop-1', 'user-1', {
        floorId: 'floor-1',
        roomNumber: '101',
        sharingType: RoomSharingType.DOUBLE,
        baseRent: 5000,
        autoGenerateBeds: true,
      });

      expect(room.beds).toBeDefined();
      expect(room.beds).toHaveLength(2);
      expect(room.beds?.[0].bedNumber).toBe('101-A');
      expect(room.beds?.[1].bedNumber).toBe('101-B');
    });

    it('should throw ConflictException on duplicate room number', async () => {
      mockPrismaService.property.findFirst.mockResolvedValue({ propertyType: PropertyType.PG });
      mockPrismaService.floor.findFirst.mockResolvedValue({ id: 'floor-1' });
      mockPrismaService.room.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        service.createRoom('org-1', 'prop-1', 'user-1', {
          floorId: 'floor-1',
          roomNumber: '101',
          sharingType: RoomSharingType.DOUBLE,
          baseRent: 5000,
        })
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Bed CRUD & Lifecycle Validation', () => {
    it('should dynamically expand room capacity when adding bed beyond initial limit', async () => {
      mockPrismaService.property.findFirst.mockResolvedValue({ propertyType: PropertyType.PG });
      mockPrismaService.room.findFirst.mockResolvedValue({
        id: 'room-1',
        capacity: 2,
        beds: [{ id: 'b1' }, { id: 'b2' }],
      });
      mockPrismaService.room.update = jest.fn().mockResolvedValue({ id: 'room-1', capacity: 3 });
      mockPrismaService.bed.findFirst.mockResolvedValue(null);
      mockPrismaService.bed.create = jest.fn().mockResolvedValue({
        id: 'b3',
        roomId: 'room-1',
        bedNumber: '101-C',
        monthlyRent: new Decimal(5000),
        status: BedStatus.AVAILABLE,
      });

      const res = await service.createBed('org-1', 'prop-1', 'user-1', {
        roomId: 'room-1',
        bedNumber: '101-C',
        monthlyRent: 5000,
      });

      expect(res.bedNumber).toBe('101-C');
      expect(mockPrismaService.room.update).toHaveBeenCalledWith({
        where: { id: 'room-1' },
        data: { capacity: 3 },
      });
    });

    it('should block invalid status transitions', async () => {
      mockPrismaService.property.findFirst.mockResolvedValue({ propertyType: PropertyType.PG });
      mockPrismaService.bed.findFirst.mockResolvedValue({
        id: 'bed-1',
        status: BedStatus.OCCUPIED,
      });

      await expect(
        service.updateBedStatus('org-1', 'prop-1', 'bed-1', 'user-1', BedStatus.MAINTENANCE)
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow valid status transitions', async () => {
      mockPrismaService.property.findFirst.mockResolvedValue({ propertyType: PropertyType.PG });
      mockPrismaService.bed.findFirst.mockResolvedValue({
        id: 'bed-1',
        status: BedStatus.AVAILABLE,
      });
      mockPrismaService.bed.update.mockResolvedValue({
        id: 'bed-1',
        status: BedStatus.MAINTENANCE,
        monthlyRent: { toNumber: () => 5000 },
      });

      const updated = await service.updateBedStatus(
        'org-1',
        'prop-1',
        'bed-1',
        'user-1',
        BedStatus.MAINTENANCE
      );

      expect(updated.status).toBe(BedStatus.MAINTENANCE);
    });

    it('should block deletion of occupied bed', async () => {
      mockPrismaService.property.findFirst.mockResolvedValue({ propertyType: PropertyType.PG });
      mockPrismaService.bed.findFirst.mockResolvedValue({
        id: 'bed-1',
        status: BedStatus.OCCUPIED,
      });

      await expect(service.deleteBed('org-1', 'prop-1', 'bed-1', 'user-1')).rejects.toThrow(
        BadRequestException
      );
    });
  });
});
