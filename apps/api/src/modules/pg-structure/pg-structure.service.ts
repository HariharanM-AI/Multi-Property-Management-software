import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  FloorDto,
  CreateFloorDto,
  UpdateFloorDto,
  RoomDto,
  CreateRoomDto,
  UpdateRoomDto,
  BedDto,
  CreateBedDto,
  UpdateBedDto,
  PgPropertySummaryDto,
  PropertyType,
  RoomSharingType,
  BedStatus,
} from '@propertyos/types';

@Injectable()
export class PgStructureService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to validate that a property belongs to the organization and is of type PG
   */
  async validatePgProperty(organizationId: string, propertyId: string): Promise<void> {
    const property = await this.prisma.property.findFirst({
      where: {
        id: propertyId,
        organizationId,
        deletedAt: null,
      },
      select: {
        propertyType: true,
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (property.propertyType !== PropertyType.PG) {
      throw new BadRequestException('This operation is only available for PG / Co-Living properties.');
    }
  }

  /**
   * Helper to write standardized Audit Logs
   */
  private async writeAuditLog(
    tx: any,
    organizationId: string,
    userId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    metadata: any
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        organizationId,
        userId,
        action,
        resourceType,
        resourceId,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
      },
    });
  }

  /**
   * Retrieve PG occupancy and capacity summaries
   */
  async getPgSummary(organizationId: string, propertyId: string): Promise<PgPropertySummaryDto> {
    await this.validatePgProperty(organizationId, propertyId);

    const floors = await this.prisma.floor.findMany({
      where: { propertyId, deletedAt: null },
      select: { id: true },
    });

    const rooms = await this.prisma.room.findMany({
      where: { propertyId, deletedAt: null },
      select: { id: true },
    });

    const beds = await this.prisma.bed.findMany({
      where: { room: { propertyId, deletedAt: null }, deletedAt: null },
      select: { id: true, status: true },
    });

    const available = beds.filter((b) => b.status === BedStatus.AVAILABLE).length;
    const occupied = beds.filter((b) => b.status === BedStatus.OCCUPIED).length;
    const reserved = beds.filter((b) => b.status === BedStatus.RESERVED).length;
    const maintenance = beds.filter((b) => b.status === BedStatus.MAINTENANCE).length;
    const blocked = beds.filter((b) => b.status === BedStatus.BLOCKED).length;
    const cleaning = beds.filter((b) => b.status === BedStatus.CLEANING).length;
    const notice = beds.filter((b) => b.status === BedStatus.NOTICE).length;

    const totalBeds = beds.length;
    const occupancyRate = totalBeds > 0 ? Math.round((occupied / totalBeds) * 100) : 0;

    return {
      propertyId,
      totalFloors: floors.length,
      totalRooms: rooms.length,
      totalBeds,
      availableBeds: available,
      occupiedBeds: occupied,
      reservedBeds: reserved,
      maintenanceBeds: maintenance,
      blockedBeds: blocked,
      cleaningBeds: cleaning,
      noticeBeds: notice,
      occupancyRate,
    };
  }

  // ==========================================================================
  // FLOORS CRUD
  // ==========================================================================

  async createFloor(
    organizationId: string,
    propertyId: string,
    userId: string,
    input: CreateFloorDto
  ): Promise<FloorDto> {
    await this.validatePgProperty(organizationId, propertyId);

    // Check unique floorNumber per property
    const existing = await this.prisma.floor.findFirst({
      where: {
        propertyId,
        floorNumber: input.floorNumber,
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ConflictException(`Floor number ${input.floorNumber} already exists for this property.`);
    }

    const floor = await this.prisma.$transaction(async (tx) => {
      const created = await tx.floor.create({
        data: {
          propertyId,
          floorNumber: input.floorNumber,
          name: input.name.trim(),
        },
      });

      await this.writeAuditLog(
        tx,
        organizationId,
        userId,
        'FLOOR_CREATED',
        'Floor',
        created.id,
        { floorNumber: created.floorNumber, name: created.name }
      );

      return created;
    });

    return {
      id: floor.id,
      propertyId: floor.propertyId,
      floorNumber: floor.floorNumber,
      name: floor.name,
      createdAt: floor.createdAt,
      updatedAt: floor.updatedAt,
      deletedAt: floor.deletedAt,
    };
  }

  async listFloors(organizationId: string, propertyId: string): Promise<FloorDto[]> {
    await this.validatePgProperty(organizationId, propertyId);

    const floors = await this.prisma.floor.findMany({
      where: {
        propertyId,
        deletedAt: null,
      },
      include: {
        rooms: {
          where: { deletedAt: null },
          include: {
            beds: {
              where: { deletedAt: null },
            },
          },
        },
      },
      orderBy: {
        floorNumber: 'asc',
      },
    });

    return floors.map((floor) => {
      const roomsCount = floor.rooms.length;
      let bedsCount = 0;
      let occupiedBedsCount = 0;

      for (const room of floor.rooms) {
        bedsCount += room.beds.length;
        occupiedBedsCount += room.beds.filter((b) => (b.status as BedStatus) === BedStatus.OCCUPIED).length;
      }

      return {
        id: floor.id,
        propertyId: floor.propertyId,
        floorNumber: floor.floorNumber,
        name: floor.name,
        createdAt: floor.createdAt,
        updatedAt: floor.updatedAt,
        deletedAt: floor.deletedAt,
        roomsCount,
        bedsCount,
        occupiedBedsCount,
      };
    });
  }

  async getFloorById(organizationId: string, propertyId: string, floorId: string): Promise<FloorDto> {
    await this.validatePgProperty(organizationId, propertyId);

    const floor = await this.prisma.floor.findFirst({
      where: {
        id: floorId,
        propertyId,
        deletedAt: null,
      },
      include: {
        rooms: {
          where: { deletedAt: null },
          include: {
            beds: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });

    if (!floor) {
      throw new NotFoundException('Floor not found');
    }

    const roomsCount = floor.rooms.length;
    let bedsCount = 0;
    let occupiedBedsCount = 0;

    const roomsMapped: RoomDto[] = floor.rooms.map((room) => {
      const roomBeds = room.beds.map((b) => ({
        id: b.id,
        roomId: b.roomId,
        bedNumber: b.bedNumber,
        monthlyRent: b.monthlyRent.toNumber(),
        status: b.status as BedStatus,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        deletedAt: b.deletedAt,
      }));

      bedsCount += roomBeds.length;
      const occupied = roomBeds.filter((b) => b.status === BedStatus.OCCUPIED).length;
      occupiedBedsCount += occupied;

      return {
        id: room.id,
        propertyId: room.propertyId,
        floorId: room.floorId,
        roomNumber: room.roomNumber,
        sharingType: room.sharingType as RoomSharingType,
        capacity: room.capacity,
        baseRent: room.baseRent.toNumber(),
        amenities: room.amenities,
        beds: roomBeds,
        bedsCount: roomBeds.length,
        availableBedsCount: roomBeds.filter((b) => b.status === BedStatus.AVAILABLE).length,
        occupiedBedsCount: occupied,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
        deletedAt: room.deletedAt,
      };
    });

    return {
      id: floor.id,
      propertyId: floor.propertyId,
      floorNumber: floor.floorNumber,
      name: floor.name,
      rooms: roomsMapped,
      roomsCount,
      bedsCount,
      occupiedBedsCount,
      createdAt: floor.createdAt,
      updatedAt: floor.updatedAt,
      deletedAt: floor.deletedAt,
    };
  }

  async updateFloor(
    organizationId: string,
    propertyId: string,
    floorId: string,
    userId: string,
    input: UpdateFloorDto
  ): Promise<FloorDto> {
    await this.validatePgProperty(organizationId, propertyId);

    const floor = await this.prisma.floor.findFirst({
      where: { id: floorId, propertyId, deletedAt: null },
    });

    if (!floor) {
      throw new NotFoundException('Floor not found');
    }

    if (input.floorNumber !== undefined && input.floorNumber !== floor.floorNumber) {
      const existing = await this.prisma.floor.findFirst({
        where: {
          propertyId,
          floorNumber: input.floorNumber,
          deletedAt: null,
        },
      });
      if (existing) {
        throw new ConflictException(`Floor number ${input.floorNumber} already exists for this property.`);
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.floor.update({
        where: { id: floorId },
        data: {
          floorNumber: input.floorNumber !== undefined ? input.floorNumber : undefined,
          name: input.name !== undefined ? input.name.trim() : undefined,
        },
      });

      await this.writeAuditLog(tx, organizationId, userId, 'FLOOR_UPDATED', 'Floor', floorId, input);
      return res;
    });

    return {
      id: updated.id,
      propertyId: updated.propertyId,
      floorNumber: updated.floorNumber,
      name: updated.name,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      deletedAt: updated.deletedAt,
    };
  }

  async deleteFloor(
    organizationId: string,
    propertyId: string,
    floorId: string,
    userId: string
  ): Promise<void> {
    await this.validatePgProperty(organizationId, propertyId);

    const floor = await this.prisma.floor.findFirst({
      where: { id: floorId, propertyId, deletedAt: null },
      include: {
        rooms: {
          where: { deletedAt: null },
          include: {
            beds: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });

    if (!floor) {
      throw new NotFoundException('Floor not found');
    }

    // Protection: check if any bed on this floor is OCCUPIED
    for (const room of floor.rooms) {
      const hasOccupied = room.beds.some((b) => (b.status as BedStatus) === BedStatus.OCCUPIED);
      if (hasOccupied) {
        throw new BadRequestException('Cannot delete floor containing occupied beds.');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const timestamp = new Date();

      // Soft delete floor
      await tx.floor.update({
        where: { id: floorId },
        data: { deletedAt: timestamp },
      });

      // Soft delete rooms and beds under this floor
      for (const room of floor.rooms) {
        await tx.room.update({
          where: { id: room.id },
          data: { deletedAt: timestamp },
        });

        await tx.bed.updateMany({
          where: { roomId: room.id, deletedAt: null },
          data: { deletedAt: timestamp },
        });
      }

      await this.writeAuditLog(
        tx,
        organizationId,
        userId,
        'FLOOR_DELETED',
        'Floor',
        floorId,
        { name: floor.name, floorNumber: floor.floorNumber }
      );
    });
  }

  // ==========================================================================
  // ROOMS CRUD
  // ==========================================================================

  private getDefaultCapacity(sharingType: RoomSharingType): number {
    switch (sharingType) {
      case RoomSharingType.SINGLE:
        return 1;
      case RoomSharingType.DOUBLE:
        return 2;
      case RoomSharingType.TRIPLE:
        return 3;
      case RoomSharingType.FOUR_SHARING:
        return 4;
      case RoomSharingType.DORMITORY:
        return 6;
      default:
        return 1;
    }
  }

  async createRoom(
    organizationId: string,
    propertyId: string,
    userId: string,
    input: CreateRoomDto
  ): Promise<RoomDto> {
    await this.validatePgProperty(organizationId, propertyId);

    // Verify floor belongs to this property
    const floor = await this.prisma.floor.findFirst({
      where: {
        id: input.floorId,
        propertyId,
        deletedAt: null,
      },
    });

    if (!floor) {
      throw new NotFoundException('Floor not found under this property');
    }

    // Check unique roomNumber per floor
    const existing = await this.prisma.room.findFirst({
      where: {
        floorId: input.floorId,
        roomNumber: input.roomNumber.trim(),
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ConflictException(`Room number ${input.roomNumber} already exists on this floor.`);
    }

    const capacity = input.capacity ?? this.getDefaultCapacity(input.sharingType);

    const room = await this.prisma.$transaction(async (tx) => {
      const created = await tx.room.create({
        data: {
          propertyId,
          floorId: input.floorId,
          roomNumber: input.roomNumber.trim(),
          sharingType: input.sharingType,
          capacity,
          baseRent: input.baseRent,
          amenities: input.amenities || [],
        },
      });

      // Auto-generate beds if requested
      const generatedBeds: BedDto[] = [];
      if (input.autoGenerateBeds) {
        for (let i = 0; i < capacity; i++) {
          const bedLetter = String.fromCharCode(65 + i); // A, B, C, etc.
          const bedNumber = `${created.roomNumber}-${bedLetter}`;

          const bed = await tx.bed.create({
            data: {
              roomId: created.id,
              bedNumber,
              monthlyRent: created.baseRent,
              status: BedStatus.AVAILABLE,
            },
          });

          generatedBeds.push({
            id: bed.id,
            roomId: bed.roomId,
            bedNumber: bed.bedNumber,
            monthlyRent: bed.monthlyRent.toNumber(),
            status: bed.status as BedStatus,
            createdAt: bed.createdAt,
            updatedAt: bed.updatedAt,
            deletedAt: bed.deletedAt,
          });
        }
      }

      await this.writeAuditLog(
        tx,
        organizationId,
        userId,
        'ROOM_CREATED',
        'Room',
        created.id,
        {
          roomNumber: created.roomNumber,
          sharingType: created.sharingType,
          capacity: created.capacity,
          autoGeneratedBedsCount: generatedBeds.length,
        }
      );

      return {
        ...created,
        sharingType: created.sharingType as RoomSharingType,
        baseRent: created.baseRent.toNumber(),
        beds: generatedBeds,
        bedsCount: generatedBeds.length,
        availableBedsCount: generatedBeds.length,
        occupiedBedsCount: 0,
      };
    });

    return room as RoomDto;
  }

  async listRooms(
    organizationId: string,
    propertyId: string,
    floorId?: string
  ): Promise<RoomDto[]> {
    await this.validatePgProperty(organizationId, propertyId);

    const rooms = await this.prisma.room.findMany({
      where: {
        propertyId,
        floorId: floorId || undefined,
        deletedAt: null,
      },
      include: {
        beds: {
          where: { deletedAt: null },
        },
      },
      orderBy: {
        roomNumber: 'asc',
      },
    });

    return rooms.map((room) => {
      const roomBeds = room.beds.map((b) => ({
        id: b.id,
        roomId: b.roomId,
        bedNumber: b.bedNumber,
        monthlyRent: b.monthlyRent.toNumber(),
        status: b.status as BedStatus,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        deletedAt: b.deletedAt,
      }));

      return {
        id: room.id,
        propertyId: room.propertyId,
        floorId: room.floorId,
        roomNumber: room.roomNumber,
        sharingType: room.sharingType as RoomSharingType,
        capacity: room.capacity,
        baseRent: room.baseRent.toNumber(),
        amenities: room.amenities,
        beds: roomBeds,
        bedsCount: roomBeds.length,
        availableBedsCount: roomBeds.filter((b) => b.status === BedStatus.AVAILABLE).length,
        occupiedBedsCount: roomBeds.filter((b) => b.status === BedStatus.OCCUPIED).length,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
        deletedAt: room.deletedAt,
      };
    });
  }

  async getRoomById(organizationId: string, propertyId: string, roomId: string): Promise<RoomDto> {
    await this.validatePgProperty(organizationId, propertyId);

    const room = await this.prisma.room.findFirst({
      where: { id: roomId, propertyId, deletedAt: null },
      include: {
        beds: {
          where: { deletedAt: null },
        },
      },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const roomBeds = room.beds.map((b) => ({
      id: b.id,
      roomId: b.roomId,
      bedNumber: b.bedNumber,
      monthlyRent: b.monthlyRent.toNumber(),
      status: b.status as BedStatus,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      deletedAt: b.deletedAt,
    }));

    return {
      id: room.id,
      propertyId: room.propertyId,
      floorId: room.floorId,
      roomNumber: room.roomNumber,
      sharingType: room.sharingType as RoomSharingType,
      capacity: room.capacity,
      baseRent: room.baseRent.toNumber(),
      amenities: room.amenities,
      beds: roomBeds,
      bedsCount: roomBeds.length,
      availableBedsCount: roomBeds.filter((b) => b.status === BedStatus.AVAILABLE).length,
      occupiedBedsCount: roomBeds.filter((b) => b.status === BedStatus.OCCUPIED).length,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      deletedAt: room.deletedAt,
    };
  }

  async updateRoom(
    organizationId: string,
    propertyId: string,
    roomId: string,
    userId: string,
    input: UpdateRoomDto
  ): Promise<RoomDto> {
    await this.validatePgProperty(organizationId, propertyId);

    const room = await this.prisma.room.findFirst({
      where: { id: roomId, propertyId, deletedAt: null },
      include: {
        beds: {
          where: { deletedAt: null },
        },
      },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (input.roomNumber !== undefined && input.roomNumber.trim() !== room.roomNumber) {
      const existing = await this.prisma.room.findFirst({
        where: {
          floorId: room.floorId,
          roomNumber: input.roomNumber.trim(),
          deletedAt: null,
        },
      });
      if (existing) {
        throw new ConflictException(`Room number ${input.roomNumber} already exists on this floor.`);
      }
    }

    // Capacity checks
    const targetCapacity = input.capacity ?? (input.sharingType ? this.getDefaultCapacity(input.sharingType) : room.capacity);
    if (targetCapacity < room.beds.length) {
      throw new BadRequestException(
        `Cannot reduce capacity below existing bed count (${room.beds.length}). Delete extra beds first.`
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.room.update({
        where: { id: roomId },
        data: {
          roomNumber: input.roomNumber !== undefined ? input.roomNumber.trim() : undefined,
          sharingType: input.sharingType !== undefined ? input.sharingType : undefined,
          capacity: targetCapacity,
          baseRent: input.baseRent !== undefined ? input.baseRent : undefined,
          amenities: input.amenities !== undefined ? input.amenities : undefined,
        },
      });

      await this.writeAuditLog(tx, organizationId, userId, 'ROOM_UPDATED', 'Room', roomId, input);
      return res;
    });

    return {
      id: updated.id,
      propertyId: updated.propertyId,
      floorId: updated.floorId,
      roomNumber: updated.roomNumber,
      sharingType: updated.sharingType as RoomSharingType,
      capacity: updated.capacity,
      baseRent: updated.baseRent.toNumber(),
      amenities: updated.amenities,
      bedsCount: room.beds.length,
      availableBedsCount: room.beds.filter((b) => (b.status as BedStatus) === BedStatus.AVAILABLE).length,
      occupiedBedsCount: room.beds.filter((b) => (b.status as BedStatus) === BedStatus.OCCUPIED).length,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      deletedAt: updated.deletedAt,
    };
  }

  async deleteRoom(
    organizationId: string,
    propertyId: string,
    roomId: string,
    userId: string
  ): Promise<void> {
    await this.validatePgProperty(organizationId, propertyId);

    const room = await this.prisma.room.findFirst({
      where: { id: roomId, propertyId, deletedAt: null },
      include: {
        beds: {
          where: { deletedAt: null },
        },
      },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    // Protection: check if any bed is OCCUPIED
    const hasOccupied = room.beds.some((b) => (b.status as BedStatus) === BedStatus.OCCUPIED);
    if (hasOccupied) {
      throw new BadRequestException('Cannot delete room containing occupied beds.');
    }

    await this.prisma.$transaction(async (tx) => {
      const timestamp = new Date();

      await tx.room.update({
        where: { id: roomId },
        data: { deletedAt: timestamp },
      });

      await tx.bed.updateMany({
        where: { roomId: room.id, deletedAt: null },
        data: { deletedAt: timestamp },
      });

      await this.writeAuditLog(
        tx,
        organizationId,
        userId,
        'ROOM_DELETED',
        'Room',
        roomId,
        { roomNumber: room.roomNumber }
      );
    });
  }

  // ==========================================================================
  // BEDS CRUD
  // ==========================================================================

  async createBed(
    organizationId: string,
    propertyId: string,
    userId: string,
    input: CreateBedDto
  ): Promise<BedDto> {
    await this.validatePgProperty(organizationId, propertyId);

    const room = await this.prisma.room.findFirst({
      where: { id: input.roomId, propertyId, deletedAt: null },
      include: {
        beds: {
          where: { deletedAt: null },
        },
      },
    });

    if (!room) {
      throw new NotFoundException('Room not found under this property');
    }

    if (room.beds.length >= room.capacity) {
      throw new BadRequestException(`Room capacity of ${room.capacity} is already fully allocated.`);
    }

    const existing = await this.prisma.bed.findFirst({
      where: {
        roomId: input.roomId,
        bedNumber: input.bedNumber.trim(),
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ConflictException(`Bed number ${input.bedNumber} already exists in this room.`);
    }

    const bed = await this.prisma.$transaction(async (tx) => {
      const created = await tx.bed.create({
        data: {
          roomId: input.roomId,
          bedNumber: input.bedNumber.trim(),
          monthlyRent: input.monthlyRent,
          status: input.status ?? BedStatus.AVAILABLE,
        },
      });

      await this.writeAuditLog(
        tx,
        organizationId,
        userId,
        'BED_CREATED',
        'Bed',
        created.id,
        { bedNumber: created.bedNumber, monthlyRent: created.monthlyRent }
      );

      return created;
    });

    return {
      id: bed.id,
      roomId: bed.roomId,
      bedNumber: bed.bedNumber,
      monthlyRent: bed.monthlyRent.toNumber(),
      status: bed.status as BedStatus,
      createdAt: bed.createdAt,
      updatedAt: bed.updatedAt,
      deletedAt: bed.deletedAt,
    };
  }

  async listBeds(
    organizationId: string,
    propertyId: string,
    roomId?: string,
    status?: BedStatus
  ): Promise<BedDto[]> {
    await this.validatePgProperty(organizationId, propertyId);

    const beds = await this.prisma.bed.findMany({
      where: {
        room: {
          propertyId,
          id: roomId || undefined,
          deletedAt: null,
        },
        status: status || undefined,
        deletedAt: null,
      },
      orderBy: {
        bedNumber: 'asc',
      },
    });

    return beds.map((b) => ({
      id: b.id,
      roomId: b.roomId,
      bedNumber: b.bedNumber,
      monthlyRent: b.monthlyRent.toNumber(),
      status: b.status as BedStatus,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      deletedAt: b.deletedAt,
    }));
  }

  async getBedById(organizationId: string, propertyId: string, bedId: string): Promise<BedDto> {
    await this.validatePgProperty(organizationId, propertyId);

    const bed = await this.prisma.bed.findFirst({
      where: {
        id: bedId,
        room: {
          propertyId,
          deletedAt: null,
        },
        deletedAt: null,
      },
    });

    if (!bed) {
      throw new NotFoundException('Bed not found');
    }

    return {
      id: bed.id,
      roomId: bed.roomId,
      bedNumber: bed.bedNumber,
      monthlyRent: bed.monthlyRent.toNumber(),
      status: bed.status as BedStatus,
      createdAt: bed.createdAt,
      updatedAt: bed.updatedAt,
      deletedAt: bed.deletedAt,
    };
  }

  async updateBed(
    organizationId: string,
    propertyId: string,
    bedId: string,
    userId: string,
    input: UpdateBedDto
  ): Promise<BedDto> {
    await this.validatePgProperty(organizationId, propertyId);

    const bed = await this.prisma.bed.findFirst({
      where: {
        id: bedId,
        room: {
          propertyId,
          deletedAt: null,
        },
        deletedAt: null,
      },
    });

    if (!bed) {
      throw new NotFoundException('Bed not found');
    }

    if (input.bedNumber !== undefined && input.bedNumber.trim() !== bed.bedNumber) {
      const existing = await this.prisma.bed.findFirst({
        where: {
          roomId: bed.roomId,
          bedNumber: input.bedNumber.trim(),
          deletedAt: null,
        },
      });
      if (existing) {
        throw new ConflictException(`Bed number ${input.bedNumber} already exists in this room.`);
      }
    }

    // Explicit validation on status transitions
    if (input.status !== undefined && (input.status as BedStatus) !== (bed.status as BedStatus)) {
      this.validateStatusTransition(bed.status as BedStatus, input.status as BedStatus);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.bed.update({
        where: { id: bedId },
        data: {
          bedNumber: input.bedNumber !== undefined ? input.bedNumber.trim() : undefined,
          monthlyRent: input.monthlyRent !== undefined ? input.monthlyRent : undefined,
          status: input.status !== undefined ? input.status : undefined,
        },
      });

      await this.writeAuditLog(tx, organizationId, userId, 'BED_UPDATED', 'Bed', bedId, input);
      return res;
    });

    return {
      id: updated.id,
      roomId: updated.roomId,
      bedNumber: updated.bedNumber,
      monthlyRent: updated.monthlyRent.toNumber(),
      status: updated.status as BedStatus,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      deletedAt: updated.deletedAt,
    };
  }

  async updateBedStatus(
    organizationId: string,
    propertyId: string,
    bedId: string,
    userId: string,
    status: BedStatus
  ): Promise<BedDto> {
    await this.validatePgProperty(organizationId, propertyId);

    const bed = await this.prisma.bed.findFirst({
      where: {
        id: bedId,
        room: {
          propertyId,
          deletedAt: null,
        },
        deletedAt: null,
      },
    });

    if (!bed) {
      throw new NotFoundException('Bed not found');
    }

    this.validateStatusTransition(bed.status as BedStatus, status);

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.bed.update({
        where: { id: bedId },
        data: { status },
      });

      await this.writeAuditLog(
        tx,
        organizationId,
        userId,
        'BED_STATUS_CHANGED',
        'Bed',
        bedId,
        { from: bed.status, to: status }
      );
      return res;
    });

    return {
      id: updated.id,
      roomId: updated.roomId,
      bedNumber: updated.bedNumber,
      monthlyRent: updated.monthlyRent.toNumber(),
      status: updated.status as BedStatus,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      deletedAt: updated.deletedAt,
    };
  }

  async deleteBed(
    organizationId: string,
    propertyId: string,
    bedId: string,
    userId: string
  ): Promise<void> {
    await this.validatePgProperty(organizationId, propertyId);

    const bed = await this.prisma.bed.findFirst({
      where: {
        id: bedId,
        room: {
          propertyId,
          deletedAt: null,
        },
        deletedAt: null,
      },
    });

    if (!bed) {
      throw new NotFoundException('Bed not found');
    }

    if ((bed.status as BedStatus) === BedStatus.OCCUPIED) {
      throw new BadRequestException('Cannot delete occupied bed.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.bed.update({
        where: { id: bedId },
        data: { deletedAt: new Date() },
      });

      await this.writeAuditLog(
        tx,
        organizationId,
        userId,
        'BED_DELETED',
        'Bed',
        bedId,
        { bedNumber: bed.bedNumber }
      );
    });
  }

  /**
   * Simple state machine helper validating transition state safety
   */
  private validateStatusTransition(from: BedStatus, to: BedStatus): void {
    if (from === BedStatus.OCCUPIED && to === BedStatus.AVAILABLE) {
      // In a real system, you would check checkout stays, but here we enforce strict transitions
      // Allow checkout explicitly, but warn if required
    }
    // Block transitions that bypass cleaning or maintenance if occupied
    if (from === BedStatus.OCCUPIED && to === BedStatus.MAINTENANCE) {
      throw new BadRequestException('Cannot set occupied bed to maintenance directly. Checkout tenant first.');
    }
  }
}
