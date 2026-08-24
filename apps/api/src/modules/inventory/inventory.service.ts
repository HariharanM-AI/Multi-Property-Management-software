import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '@prisma/client';
import {
  InventoryItemDto,
  InventorySummaryDto,
  InventoryCategory,
  InventoryCondition,
  InventoryStatus,
} from '@propertyos/types';
import {
  CreateInventoryItemInput,
  UpdateInventoryItemInput,
  AssignInventoryItemInput,
  InventoryFilterInput,
} from '@propertyos/validation';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  private mapToDto(item: any): InventoryItemDto {
    let locationDisplay = 'Property Stock (Unassigned)';
    if (item.room) {
      locationDisplay = `Room ${item.room.roomNumber}`;
    } else if (item.rentalUnit) {
      locationDisplay = `Unit ${item.rentalUnit.unitNumber}`;
    }

    return {
      id: item.id,
      propertyId: item.propertyId,
      propertyName: item.property?.name,
      propertyType: item.property?.propertyType,
      roomId: item.roomId || null,
      roomNumber: item.room?.roomNumber || null,
      rentalUnitId: item.rentalUnitId || null,
      unitNumber: item.rentalUnit?.unitNumber || null,
      itemName: item.itemName,
      category: item.category as InventoryCategory,
      serialNumber: item.serialNumber || null,
      condition: item.condition as InventoryCondition,
      status: item.status as InventoryStatus,
      purchaseDate: item.purchaseDate instanceof Date ? item.purchaseDate.toISOString() : item.purchaseDate || null,
      purchasePrice: item.purchasePrice !== null && item.purchasePrice !== undefined ? Number(item.purchasePrice) : null,
      locationDisplay,
      createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
      updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : item.updatedAt,
    };
  }

  private async writeAuditLog(
    tx: Prisma.TransactionClient,
    organizationId: string,
    userId: string | null | undefined,
    action: string,
    resourceType: string,
    resourceId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        organizationId,
        userId: userId || null,
        action,
        resourceType,
        resourceId,
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
  }

  /**
   * Validates target room or unit against the property's operating model
   */
  private async validateTargetLocation(
    tx: Prisma.TransactionClient,
    property: { id: string; organizationId: string; propertyType: string },
    roomId?: string | null,
    rentalUnitId?: string | null
  ): Promise<{ roomNumber?: string; unitNumber?: string }> {
    if (property.propertyType === 'PG') {
      if (rentalUnitId) {
        throw new BadRequestException('PG properties do not support rental unit inventory assignment');
      }
      if (roomId) {
        const room = await tx.room.findFirst({
          where: { id: roomId, propertyId: property.id, property: { organizationId: property.organizationId } },
        });
        if (!room) {
          throw new NotFoundException('Specified room not found in this PG property');
        }
        return { roomNumber: room.roomNumber };
      }
    } else if (property.propertyType === 'RENTAL_HOUSE') {
      if (roomId) {
        throw new BadRequestException('Rental properties do not support room inventory assignment');
      }
      if (rentalUnitId) {
        const unit = await tx.rentalUnit.findFirst({
          where: { id: rentalUnitId, propertyId: property.id, property: { organizationId: property.organizationId } },
        });
        if (!unit) {
          throw new NotFoundException('Specified rental unit not found in this rental property');
        }
        return { unitNumber: unit.unitNumber };
      }
    }
    return {};
  }

  /**
   * Create a new inventory asset
   */
  async createItem(
    organizationId: string,
    input: CreateInventoryItemInput,
    actorId?: string,
    externalTx?: Prisma.TransactionClient
  ): Promise<InventoryItemDto> {
    const execute = async (tx: Prisma.TransactionClient) => {
      // 1. Verify property belongs to organization
      const property = await tx.property.findFirst({
        where: { id: input.propertyId, organizationId, deletedAt: null },
      });
      if (!property) {
        throw new NotFoundException('Property not found or access denied');
      }

      // 2. Validate operating model room/unit assignment
      await this.validateTargetLocation(tx, property, input.roomId, input.rentalUnitId);

      // 3. Validate purchase price
      if (input.purchasePrice !== undefined && input.purchasePrice !== null && input.purchasePrice < 0) {
        throw new BadRequestException('Purchase price cannot be negative');
      }

      // 4. Validate and serialize serial number if provided
      const normalizedSerial = input.serialNumber ? input.serialNumber.trim() : null;
      if (normalizedSerial) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('inventory_serial_' || ${property.id} || '_' || ${normalizedSerial.toLowerCase()}))`;

        const existingSerial = await tx.inventoryItem.findFirst({
          where: {
            propertyId: property.id,
            serialNumber: { equals: normalizedSerial, mode: 'insensitive' },
            status: { not: 'DISPOSED' },
          },
        });
        if (existingSerial) {
          throw new ConflictException('An active inventory item with this serial number already exists for this property');
        }
      }

      // 5. Determine initial status
      let initialStatus: InventoryStatus = 'AVAILABLE';
      if (input.status) {
        initialStatus = input.status as InventoryStatus;
      } else if (input.roomId || input.rentalUnitId) {
        initialStatus = 'ASSIGNED';
      }

      if (initialStatus === 'DISPOSED' && (input.roomId || input.rentalUnitId)) {
        throw new BadRequestException('Disposed inventory items cannot be assigned to rooms or units');
      }
      if (initialStatus === 'UNDER_REPAIR' && (input.roomId || input.rentalUnitId)) {
        throw new BadRequestException('Items under repair cannot be newly assigned to rooms or units');
      }

      // 6. Create record
      const item = await tx.inventoryItem.create({
        data: {
          propertyId: property.id,
          roomId: input.roomId || null,
          rentalUnitId: input.rentalUnitId || null,
          itemName: input.itemName.trim(),
          category: input.category,
          serialNumber: normalizedSerial,
          condition: input.condition || 'GOOD',
          status: initialStatus,
          purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : null,
          purchasePrice: input.purchasePrice !== undefined && input.purchasePrice !== null ? new Prisma.Decimal(input.purchasePrice) : null,
        },
        include: {
          property: true,
          room: true,
          rentalUnit: true,
        },
      });

      // 7. Audit log
      await this.writeAuditLog(
        tx,
        organizationId,
        actorId,
        'INVENTORY_CREATED',
        'INVENTORY_ITEM',
        item.id,
        {
          itemName: item.itemName,
          category: item.category,
          condition: item.condition,
          status: item.status,
          propertyId: item.propertyId,
          roomId: item.roomId,
          rentalUnitId: item.rentalUnitId,
          serialNumber: item.serialNumber,
          purchasePrice: item.purchasePrice !== null ? Number(item.purchasePrice) : null,
        }
      );

      return this.mapToDto(item);
    };

    return externalTx ? execute(externalTx) : this.prisma.$transaction(execute);
  }

  /**
   * List inventory items with filters and pagination
   */
  async getItems(
    organizationId: string,
    filter: InventoryFilterInput,
    externalTx?: Prisma.TransactionClient
  ): Promise<{ items: InventoryItemDto[]; total: number; page: number; limit: number; totalPages: number }> {
    const tx = externalTx || this.prisma;
    const page = filter.page || 1;
    const limit = filter.limit || 50;
    const skip = (page - 1) * limit;

    const where: Prisma.InventoryItemWhereInput = {
      property: {
        organizationId,
        deletedAt: null,
      },
    };

    if (filter.propertyId) {
      where.propertyId = filter.propertyId;
    }
    if (filter.roomId) {
      where.roomId = filter.roomId;
    }
    if (filter.rentalUnitId) {
      where.rentalUnitId = filter.rentalUnitId;
    }
    if (filter.category) {
      where.category = filter.category;
    }
    if (filter.condition) {
      where.condition = filter.condition;
    }
    if (filter.status) {
      where.status = filter.status;
    }
    if (filter.search && filter.search.trim()) {
      const search = filter.search.trim();
      where.OR = [
        { itemName: { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      tx.inventoryItem.findMany({
        where,
        include: {
          property: true,
          room: true,
          rentalUnit: true,
        },
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      tx.inventoryItem.count({ where }),
    ]);

    return {
      items: items.map((i: any) => this.mapToDto(i)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Get single inventory item by ID
   */
  async getItemById(
    organizationId: string,
    id: string,
    externalTx?: Prisma.TransactionClient
  ): Promise<InventoryItemDto> {
    const tx = externalTx || this.prisma;
    const item = await tx.inventoryItem.findFirst({
      where: {
        id,
        property: {
          organizationId,
          deletedAt: null,
        },
      },
      include: {
        property: true,
        room: true,
        rentalUnit: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Inventory item not found');
    }

    return this.mapToDto(item);
  }

  /**
   * Update inventory item details
   */
  async updateItem(
    organizationId: string,
    id: string,
    input: UpdateInventoryItemInput,
    actorId?: string,
    externalTx?: Prisma.TransactionClient
  ): Promise<InventoryItemDto> {
    const execute = async (tx: Prisma.TransactionClient) => {
      // Advisory lock on item
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('inventory_assign_' || ${id}))`;

      const item = await tx.inventoryItem.findFirst({
        where: {
          id,
          property: { organizationId, deletedAt: null },
        },
        include: { property: true, room: true, rentalUnit: true },
      });
      if (!item) {
        throw new NotFoundException('Inventory item not found');
      }

      if (input.purchasePrice !== undefined && input.purchasePrice !== null && input.purchasePrice < 0) {
        throw new BadRequestException('Purchase price cannot be negative');
      }

      const normalizedSerial = input.serialNumber !== undefined ? (input.serialNumber ? input.serialNumber.trim() : null) : item.serialNumber;
      if (normalizedSerial && normalizedSerial !== item.serialNumber) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('inventory_serial_' || ${item.propertyId} || '_' || ${normalizedSerial.toLowerCase()}))`;

        const existingSerial = await tx.inventoryItem.findFirst({
          where: {
            propertyId: item.propertyId,
            serialNumber: { equals: normalizedSerial, mode: 'insensitive' },
            id: { not: id },
            status: { not: 'DISPOSED' },
          },
        });
        if (existingSerial) {
          throw new ConflictException('An active inventory item with this serial number already exists for this property');
        }
      }

      // If transitioning to DISPOSED, auto-unassign
      let roomId = item.roomId;
      let rentalUnitId = item.rentalUnitId;
      if (input.status === 'DISPOSED') {
        roomId = null;
        rentalUnitId = null;
      }

      const updated = await tx.inventoryItem.update({
        where: { id },
        data: {
          itemName: input.itemName !== undefined ? input.itemName.trim() : undefined,
          category: input.category !== undefined ? input.category : undefined,
          serialNumber: normalizedSerial,
          condition: input.condition !== undefined ? input.condition : undefined,
          status: input.status !== undefined ? input.status : undefined,
          roomId,
          rentalUnitId,
          purchaseDate: input.purchaseDate !== undefined ? (input.purchaseDate ? new Date(input.purchaseDate) : null) : undefined,
          purchasePrice: input.purchasePrice !== undefined ? (input.purchasePrice !== null ? new Prisma.Decimal(input.purchasePrice) : null) : undefined,
        },
        include: { property: true, room: true, rentalUnit: true },
      });

      if (input.condition && input.condition !== item.condition) {
        await this.writeAuditLog(tx, organizationId, actorId, 'INVENTORY_CONDITION_CHANGED', 'INVENTORY_ITEM', id, {
          previousCondition: item.condition,
          newCondition: input.condition,
        });
      }
      if (input.status && input.status !== item.status) {
        await this.writeAuditLog(tx, organizationId, actorId, 'INVENTORY_STATUS_CHANGED', 'INVENTORY_ITEM', id, {
          previousStatus: item.status,
          newStatus: input.status,
        });
      }

      await this.writeAuditLog(tx, organizationId, actorId, 'INVENTORY_UPDATED', 'INVENTORY_ITEM', id, {
        itemName: updated.itemName,
        category: updated.category,
        serialNumber: updated.serialNumber,
      });

      return this.mapToDto(updated);
    };

    return externalTx ? execute(externalTx) : this.prisma.$transaction(execute);
  }

  /**
   * Assign or reassign inventory asset to a room or rental unit
   */
  async assignItem(
    organizationId: string,
    id: string,
    input: AssignInventoryItemInput,
    actorId?: string,
    externalTx?: Prisma.TransactionClient
  ): Promise<InventoryItemDto> {
    const execute = async (tx: Prisma.TransactionClient) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('inventory_assign_' || ${id}))`;

      const item = await tx.inventoryItem.findFirst({
        where: { id, property: { organizationId, deletedAt: null } },
        include: { property: true, room: true, rentalUnit: true },
      });
      if (!item) {
        throw new NotFoundException('Inventory item not found');
      }

      if (item.status === 'DISPOSED') {
        throw new BadRequestException('Cannot assign a disposed inventory item');
      }
      if (item.status === 'UNDER_REPAIR') {
        throw new BadRequestException('Cannot assign an item that is currently under repair');
      }

      // If unassigning via assign endpoint with nulls
      if (!input.roomId && !input.rentalUnitId) {
        return this.unassignItem(organizationId, id, actorId, tx);
      }

      await this.validateTargetLocation(tx, item.property, input.roomId, input.rentalUnitId);

      const updated = await tx.inventoryItem.update({
        where: { id },
        data: {
          roomId: input.roomId || null,
          rentalUnitId: input.rentalUnitId || null,
          status: 'ASSIGNED',
        },
        include: { property: true, room: true, rentalUnit: true },
      });

      await this.writeAuditLog(tx, organizationId, actorId, 'INVENTORY_ASSIGNED', 'INVENTORY_ITEM', id, {
        previousRoomId: item.roomId,
        previousRentalUnitId: item.rentalUnitId,
        newRoomId: updated.roomId,
        newRentalUnitId: updated.rentalUnitId,
        locationDisplay: updated.room ? `Room ${updated.room.roomNumber}` : updated.rentalUnit ? `Unit ${updated.rentalUnit.unitNumber}` : 'Unassigned',
      });

      return this.mapToDto(updated);
    };

    return externalTx ? execute(externalTx) : this.prisma.$transaction(execute);
  }

  /**
   * Unassign inventory asset back to property-level common stock
   */
  async unassignItem(
    organizationId: string,
    id: string,
    actorId?: string,
    externalTx?: Prisma.TransactionClient
  ): Promise<InventoryItemDto> {
    const execute = async (tx: Prisma.TransactionClient) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('inventory_assign_' || ${id}))`;

      const item = await tx.inventoryItem.findFirst({
        where: { id, property: { organizationId, deletedAt: null } },
        include: { property: true, room: true, rentalUnit: true },
      });
      if (!item) {
        throw new NotFoundException('Inventory item not found');
      }

      const nextStatus: InventoryStatus =
        item.status === 'UNDER_REPAIR' || item.status === 'DISPOSED' ? (item.status as InventoryStatus) : 'AVAILABLE';

      const updated = await tx.inventoryItem.update({
        where: { id },
        data: {
          roomId: null,
          rentalUnitId: null,
          status: nextStatus,
        },
        include: { property: true, room: true, rentalUnit: true },
      });

      await this.writeAuditLog(tx, organizationId, actorId, 'INVENTORY_UNASSIGNED', 'INVENTORY_ITEM', id, {
        previousRoomId: item.roomId,
        previousRentalUnitId: item.rentalUnitId,
      });

      return this.mapToDto(updated);
    };

    return externalTx ? execute(externalTx) : this.prisma.$transaction(execute);
  }

  /**
   * Delete inventory asset record
   */
  async deleteItem(
    organizationId: string,
    id: string,
    actorId?: string,
    externalTx?: Prisma.TransactionClient
  ): Promise<{ success: boolean; message: string }> {
    const execute = async (tx: Prisma.TransactionClient) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('inventory_assign_' || ${id}))`;

      const item = await tx.inventoryItem.findFirst({
        where: { id, property: { organizationId, deletedAt: null } },
      });
      if (!item) {
        throw new NotFoundException('Inventory item not found');
      }

      await this.writeAuditLog(tx, organizationId, actorId, 'INVENTORY_DELETED', 'INVENTORY_ITEM', id, {
        itemName: item.itemName,
        category: item.category,
        serialNumber: item.serialNumber,
        propertyId: item.propertyId,
        roomId: item.roomId,
        rentalUnitId: item.rentalUnitId,
        purchasePrice: item.purchasePrice !== null ? Number(item.purchasePrice) : null,
      });

      await tx.inventoryItem.delete({
        where: { id },
      });

      return { success: true, message: 'Inventory item deleted successfully' };
    };

    return externalTx ? execute(externalTx) : this.prisma.$transaction(execute);
  }

  /**
   * Aggregated inventory metrics and Decimal asset valuation
   */
  async getSummary(
    organizationId: string,
    propertyId?: string,
    externalTx?: Prisma.TransactionClient
  ): Promise<InventorySummaryDto> {
    const tx = externalTx || this.prisma;

    const baseWhere: Prisma.InventoryItemWhereInput = {
      property: {
        organizationId,
        deletedAt: null,
      },
    };

    if (propertyId) {
      baseWhere.propertyId = propertyId;
    }

    const [totalItems, assignedItems, availableItems, underRepairItems, damagedItems, valuationAggregate] =
      await Promise.all([
        tx.inventoryItem.count({ where: baseWhere }),
        tx.inventoryItem.count({ where: { ...baseWhere, status: 'ASSIGNED' } }),
        tx.inventoryItem.count({ where: { ...baseWhere, status: 'AVAILABLE' } }),
        tx.inventoryItem.count({ where: { ...baseWhere, status: 'UNDER_REPAIR' } }),
        tx.inventoryItem.count({ where: { ...baseWhere, condition: 'DAMAGED' } }),
        tx.inventoryItem.aggregate({
          where: {
            ...baseWhere,
            status: { not: 'DISPOSED' },
            purchasePrice: { not: null },
          },
          _sum: {
            purchasePrice: true,
          },
        }),
      ]);

    const totalAssetValueDecimal = valuationAggregate._sum.purchasePrice || new Prisma.Decimal(0);

    return {
      totalItems,
      assignedItems,
      availableItems,
      underRepairItems,
      damagedItems,
      totalAssetValue: totalAssetValueDecimal.toFixed(2),
    };
  }
}
