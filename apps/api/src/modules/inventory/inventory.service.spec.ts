import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../../database/prisma.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('InventoryService', () => {
  let service: InventoryService;
  let prisma: any;

  const mockOrgId = 'org-1111-uuid';
  const mockPgPropertyId = 'prop-pg-uuid';
  const mockRentalPropertyId = 'prop-rental-uuid';
  const mockRoomId = 'room-101-uuid';
  const mockUnitId = 'unit-302-uuid';
  const mockItemId = 'item-9999-uuid';
  const mockActorId = 'actor-5555-uuid';

  const mockPgProperty = {
    id: mockPgPropertyId,
    name: 'GreenGlen PG',
    propertyType: 'PG',
    organizationId: mockOrgId,
    deletedAt: null,
  };

  const mockRentalProperty = {
    id: mockRentalPropertyId,
    name: 'Sunrise Apartments',
    propertyType: 'RENTAL_HOUSE',
    organizationId: mockOrgId,
    deletedAt: null,
  };

  const mockRoom = {
    id: mockRoomId,
    propertyId: mockPgPropertyId,
    roomNumber: '101',
    property: { organizationId: mockOrgId },
  };

  const mockRentalUnit = {
    id: mockUnitId,
    propertyId: mockRentalPropertyId,
    unitNumber: 'Flat 302',
    property: { organizationId: mockOrgId },
  };

  const mockInventoryItem = {
    id: mockItemId,
    propertyId: mockPgPropertyId,
    roomId: mockRoomId,
    rentalUnitId: null,
    itemName: 'Voltas 1.5 Ton Split AC',
    category: 'APPLIANCE',
    serialNumber: 'VOLT-2026-9988',
    condition: 'GOOD',
    status: 'ASSIGNED',
    purchaseDate: new Date('2026-01-15T00:00:00.000Z'),
    purchasePrice: new Prisma.Decimal('32500.00'),
    createdAt: new Date('2026-01-15T10:00:00.000Z'),
    updatedAt: new Date('2026-01-15T10:00:00.000Z'),
    property: mockPgProperty,
    room: mockRoom,
    rentalUnit: null,
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(async (callback) => callback(prisma)),
      $executeRaw: jest.fn().mockResolvedValue(1),
      inventoryItem: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
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
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-log-uuid' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  describe('createItem', () => {
    it('should create an inventory item in PG property with room assignment', async () => {
      prisma.property.findFirst.mockResolvedValue(mockPgProperty);
      prisma.room.findFirst.mockResolvedValue(mockRoom);
      prisma.inventoryItem.findFirst.mockResolvedValue(null); // no serial conflict
      prisma.inventoryItem.create.mockResolvedValue(mockInventoryItem);

      const result = await service.createItem(
        mockOrgId,
        {
          propertyId: mockPgPropertyId,
          roomId: mockRoomId,
          itemName: 'Voltas 1.5 Ton Split AC',
          category: 'APPLIANCE',
          serialNumber: 'VOLT-2026-9988',
          purchasePrice: 32500,
        },
        mockActorId
      );

      expect(prisma.property.findFirst).toHaveBeenCalledWith({
        where: { id: mockPgPropertyId, organizationId: mockOrgId, deletedAt: null },
      });
      expect(prisma.room.findFirst).toHaveBeenCalled();
      expect(prisma.inventoryItem.create).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'INVENTORY_CREATED',
            resourceType: 'INVENTORY_ITEM',
          }),
        })
      );
      expect(result.id).toBe(mockItemId);
      expect(result.status).toBe('ASSIGNED');
      expect(result.locationDisplay).toBe('Room 101');
    });

    it('should create an unassigned common inventory item (status: AVAILABLE)', async () => {
      prisma.property.findFirst.mockResolvedValue(mockPgProperty);
      prisma.inventoryItem.findFirst.mockResolvedValue(null);
      prisma.inventoryItem.create.mockResolvedValue({
        ...mockInventoryItem,
        roomId: null,
        room: null,
        status: 'AVAILABLE',
      });

      const result = await service.createItem(
        mockOrgId,
        {
          propertyId: mockPgPropertyId,
          itemName: 'Lobby Smart TV',
          category: 'ELECTRONIC',
        },
        mockActorId
      );

      expect(result.status).toBe('AVAILABLE');
      expect(result.locationDisplay).toBe('Property Stock (Unassigned)');
    });

    it('should create an inventory item in Rental property with unit assignment', async () => {
      prisma.property.findFirst.mockResolvedValue(mockRentalProperty);
      prisma.rentalUnit.findFirst.mockResolvedValue(mockRentalUnit);
      prisma.inventoryItem.findFirst.mockResolvedValue(null);
      prisma.inventoryItem.create.mockResolvedValue({
        ...mockInventoryItem,
        propertyId: mockRentalPropertyId,
        property: mockRentalProperty,
        roomId: null,
        room: null,
        rentalUnitId: mockUnitId,
        rentalUnit: mockRentalUnit,
      });

      const result = await service.createItem(
        mockOrgId,
        {
          propertyId: mockRentalPropertyId,
          rentalUnitId: mockUnitId,
          itemName: 'Geyser 25L',
          category: 'APPLIANCE',
        },
        mockActorId
      );

      expect(prisma.rentalUnit.findFirst).toHaveBeenCalled();
      expect(result.locationDisplay).toBe('Unit Flat 302');
    });

    it('should throw NotFoundException if property does not exist or wrong org', async () => {
      prisma.property.findFirst.mockResolvedValue(null);

      await expect(
        service.createItem(
          mockOrgId,
          {
            propertyId: 'non-existent-prop',
            itemName: 'Chair',
            category: 'FURNITURE',
          },
          mockActorId
        )
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if assigning rentalUnitId to PG property', async () => {
      prisma.property.findFirst.mockResolvedValue(mockPgProperty);

      await expect(
        service.createItem(
          mockOrgId,
          {
            propertyId: mockPgPropertyId,
            rentalUnitId: mockUnitId,
            itemName: 'Chair',
            category: 'FURNITURE',
          },
          mockActorId
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if assigning roomId to Rental property', async () => {
      prisma.property.findFirst.mockResolvedValue(mockRentalProperty);

      await expect(
        service.createItem(
          mockOrgId,
          {
            propertyId: mockRentalPropertyId,
            roomId: mockRoomId,
            itemName: 'Chair',
            category: 'FURNITURE',
          },
          mockActorId
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if roomId does not exist in target PG property', async () => {
      prisma.property.findFirst.mockResolvedValue(mockPgProperty);
      prisma.room.findFirst.mockResolvedValue(null);

      await expect(
        service.createItem(
          mockOrgId,
          {
            propertyId: mockPgPropertyId,
            roomId: 'wrong-room-uuid',
            itemName: 'Bed Desk',
            category: 'FURNITURE',
          },
          mockActorId
        )
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if purchase price is negative', async () => {
      prisma.property.findFirst.mockResolvedValue(mockPgProperty);

      await expect(
        service.createItem(
          mockOrgId,
          {
            propertyId: mockPgPropertyId,
            itemName: 'Chair',
            category: 'FURNITURE',
            purchasePrice: -500,
          },
          mockActorId
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if duplicate serial number in same property', async () => {
      prisma.property.findFirst.mockResolvedValue(mockPgProperty);
      prisma.inventoryItem.findFirst.mockResolvedValue({ id: 'other-item-id' }); // existing serial

      await expect(
        service.createItem(
          mockOrgId,
          {
            propertyId: mockPgPropertyId,
            itemName: 'AC Unit',
            category: 'APPLIANCE',
            serialNumber: 'DUPLICATE-SN',
          },
          mockActorId
        )
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if creating disposed item with room assignment', async () => {
      prisma.property.findFirst.mockResolvedValue(mockPgProperty);
      prisma.room.findFirst.mockResolvedValue(mockRoom);

      await expect(
        service.createItem(
          mockOrgId,
          {
            propertyId: mockPgPropertyId,
            roomId: mockRoomId,
            itemName: 'Broken Table',
            category: 'FURNITURE',
            status: 'DISPOSED',
          },
          mockActorId
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if creating under repair item with room assignment', async () => {
      prisma.property.findFirst.mockResolvedValue(mockPgProperty);
      prisma.room.findFirst.mockResolvedValue(mockRoom);

      await expect(
        service.createItem(
          mockOrgId,
          {
            propertyId: mockPgPropertyId,
            roomId: mockRoomId,
            itemName: 'Broken Geyser',
            category: 'APPLIANCE',
            status: 'UNDER_REPAIR',
          },
          mockActorId
        )
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getItems', () => {
    it('should return paginated inventory items with total and pages', async () => {
      prisma.inventoryItem.findMany.mockResolvedValue([mockInventoryItem]);
      prisma.inventoryItem.count.mockResolvedValue(1);

      const result = await service.getItems(mockOrgId, { page: 1, limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.items[0].itemName).toBe('Voltas 1.5 Ton Split AC');
    });

    it('should apply search, category, condition, and status filters', async () => {
      prisma.inventoryItem.findMany.mockResolvedValue([]);
      prisma.inventoryItem.count.mockResolvedValue(0);

      await service.getItems(mockOrgId, {
        category: 'APPLIANCE',
        condition: 'GOOD',
        status: 'ASSIGNED',
        search: 'Voltas',
      });

      expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: 'APPLIANCE',
            condition: 'GOOD',
            status: 'ASSIGNED',
            OR: expect.any(Array),
          }),
        })
      );
    });
  });

  describe('getItemById', () => {
    it('should return item by id', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem);

      const result = await service.getItemById(mockOrgId, mockItemId);
      expect(result.id).toBe(mockItemId);
      expect(result.locationDisplay).toBe('Room 101');
    });

    it('should throw NotFoundException if item not found', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(null);

      await expect(service.getItemById(mockOrgId, 'invalid-id')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('updateItem', () => {
    it('should update item details successfully', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem);
      prisma.inventoryItem.update.mockResolvedValue({
        ...mockInventoryItem,
        itemName: 'Voltas 2.0 Ton Inverter AC',
        condition: 'FAIR',
      });

      const result = await service.updateItem(
        mockOrgId,
        mockItemId,
        { itemName: 'Voltas 2.0 Ton Inverter AC', condition: 'FAIR' },
        mockActorId
      );

      expect(prisma.inventoryItem.update).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'INVENTORY_CONDITION_CHANGED',
          }),
        })
      );
      expect(result.itemName).toBe('Voltas 2.0 Ton Inverter AC');
    });

    it('should auto-unassign room when status transitioned to DISPOSED', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem);
      prisma.inventoryItem.update.mockResolvedValue({
        ...mockInventoryItem,
        roomId: null,
        rentalUnitId: null,
        room: null,
        status: 'DISPOSED',
      });

      const result = await service.updateItem(
        mockOrgId,
        mockItemId,
        { status: 'DISPOSED' },
        mockActorId
      );

      expect(prisma.inventoryItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            roomId: null,
            rentalUnitId: null,
            status: 'DISPOSED',
          }),
        })
      );
      expect(result.status).toBe('DISPOSED');
    });

    it('should throw ConflictException if updating to serial number already in use', async () => {
      prisma.inventoryItem.findFirst
        .mockResolvedValueOnce(mockInventoryItem) // initial lookup
        .mockResolvedValueOnce({ id: 'another-item-with-same-serial' }); // serial check

      await expect(
        service.updateItem(
          mockOrgId,
          mockItemId,
          { serialNumber: 'TAKEN-SERIAL-99' },
          mockActorId
        )
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('assignItem', () => {
    it('should assign item to room in PG property', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue({
        ...mockInventoryItem,
        roomId: null,
        room: null,
        status: 'AVAILABLE',
      });
      prisma.room.findFirst.mockResolvedValue(mockRoom);
      prisma.inventoryItem.update.mockResolvedValue(mockInventoryItem);

      const result = await service.assignItem(
        mockOrgId,
        mockItemId,
        { roomId: mockRoomId },
        mockActorId
      );

      expect(prisma.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: mockItemId },
        data: { roomId: mockRoomId, rentalUnitId: null, status: 'ASSIGNED' },
        include: { property: true, room: true, rentalUnit: true },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'INVENTORY_ASSIGNED',
          }),
        })
      );
      expect(result.status).toBe('ASSIGNED');
    });

    it('should throw BadRequestException if item is DISPOSED', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue({
        ...mockInventoryItem,
        status: 'DISPOSED',
      });

      await expect(
        service.assignItem(
          mockOrgId,
          mockItemId,
          { roomId: mockRoomId },
          mockActorId
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if item is UNDER_REPAIR', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue({
        ...mockInventoryItem,
        status: 'UNDER_REPAIR',
      });

      await expect(
        service.assignItem(
          mockOrgId,
          mockItemId,
          { roomId: mockRoomId },
          mockActorId
        )
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('unassignItem', () => {
    it('should unassign item and return status to AVAILABLE', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem);
      prisma.inventoryItem.update.mockResolvedValue({
        ...mockInventoryItem,
        roomId: null,
        rentalUnitId: null,
        room: null,
        status: 'AVAILABLE',
      });

      const result = await service.unassignItem(mockOrgId, mockItemId, mockActorId);

      expect(prisma.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: mockItemId },
        data: { roomId: null, rentalUnitId: null, status: 'AVAILABLE' },
        include: { property: true, room: true, rentalUnit: true },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'INVENTORY_UNASSIGNED',
          }),
        })
      );
      expect(result.status).toBe('AVAILABLE');
      expect(result.locationDisplay).toBe('Property Stock (Unassigned)');
    });
  });

  describe('deleteItem', () => {
    it('should write audit log and delete item', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem);
      prisma.inventoryItem.delete.mockResolvedValue(mockInventoryItem);

      const result = await service.deleteItem(mockOrgId, mockItemId, mockActorId);

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'INVENTORY_DELETED',
          }),
        })
      );
      expect(prisma.inventoryItem.delete).toHaveBeenCalledWith({
        where: { id: mockItemId },
      });
      expect(result.success).toBe(true);
    });

    it('should throw NotFoundException if deleting non-existent item', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(null);

      await expect(service.deleteItem(mockOrgId, 'invalid-id', mockActorId)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('getSummary', () => {
    it('should aggregate counts and Decimal valuation', async () => {
      prisma.inventoryItem.count
        .mockResolvedValueOnce(20) // total
        .mockResolvedValueOnce(12) // assigned
        .mockResolvedValueOnce(5)  // available
        .mockResolvedValueOnce(2)  // under repair
        .mockResolvedValueOnce(1); // damaged

      prisma.inventoryItem.aggregate.mockResolvedValue({
        _sum: {
          purchasePrice: new Prisma.Decimal('185400.00'),
        },
      });

      const summary = await service.getSummary(mockOrgId, mockPgPropertyId);

      expect(summary.totalItems).toBe(20);
      expect(summary.assignedItems).toBe(12);
      expect(summary.availableItems).toBe(5);
      expect(summary.underRepairItems).toBe(2);
      expect(summary.damagedItems).toBe(1);
      expect(summary.totalAssetValue).toBe('185400.00');
    });
  });
});
