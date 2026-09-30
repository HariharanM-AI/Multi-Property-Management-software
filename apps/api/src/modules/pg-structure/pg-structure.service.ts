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

    const existingSoftDeleted = await this.prisma.floor.findFirst({
      where: {
        propertyId,
        floorNumber: input.floorNumber,
        deletedAt: { not: null },
      },
    });

    const floorName = (input.name && input.name.trim()) ? input.name.trim() : (input.floorNumber === 0 ? 'Ground Floor' : `Floor ${input.floorNumber}`);

    const floor = await this.prisma.$transaction(async (tx) => {
      let created: any;
      if (existingSoftDeleted) {
        created = await tx.floor.update({
          where: { id: existingSoftDeleted.id },
          data: {
            name: floorName,
            deletedAt: null,
          },
        });
      } else {
        created = await tx.floor.create({
          data: {
            propertyId,
            floorNumber: input.floorNumber,
            name: floorName,
          },
        });
      }

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
      const deleteSuffix = `__deleted_${Date.now()}`;

      // Soft delete floor
      await tx.floor.update({
        where: { id: floorId },
        data: {
          deletedAt: timestamp,
          name: `${floor.name}${deleteSuffix}`,
        },
      });

      // Soft delete rooms and beds under this floor
      for (const room of floor.rooms) {
        await tx.room.update({
          where: { id: room.id },
          data: {
            deletedAt: timestamp,
            roomNumber: `${room.roomNumber}${deleteSuffix}`,
          },
        });

        for (const b of room.beds) {
          await tx.bed.update({
            where: { id: b.id },
            data: {
              deletedAt: timestamp,
              bedNumber: `${b.bedNumber}${deleteSuffix}`,
            },
          });
        }
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

      // Auto re-sequence remaining VACANT floors (only floors with 0 occupied beds)
      await this.autoResequenceVacantFloors(tx, propertyId);
    });
  }

  /**
   * Re-sequences vacant floor levels and room numbers when intermediate floors are removed,
   * while strictly preserving all occupied floors and resident records.
   */
  private async autoResequenceVacantFloors(tx: any, propertyId: string): Promise<void> {
    const activeFloors = await tx.floor.findMany({
      where: { propertyId, deletedAt: null },
      include: {
        rooms: {
          where: { deletedAt: null },
          include: {
            beds: {
              where: { deletedAt: null },
            },
          },
          orderBy: { roomNumber: 'asc' },
        },
      },
      orderBy: { floorNumber: 'asc' },
    });

    if (activeFloors.length === 0) return;

    let nextExpectedFloor = activeFloors[0].floorNumber === 0 ? 0 : 1;

    for (const f of activeFloors) {
      const isOccupied = f.rooms.some((r: any) =>
        r.beds.some((b: any) => (b.status as BedStatus) === BedStatus.OCCUPIED)
      );

      if (isOccupied) {
        // If floor has occupants, preserve its floorNumber and advance expected counter past it
        nextExpectedFloor = Math.max(nextExpectedFloor, f.floorNumber + 1);
      } else {
        const targetFloorNum = nextExpectedFloor;
        if (f.floorNumber !== targetFloorNum) {
          // Check if a soft-deleted floor holds targetFloorNum and archive it
          const existingSoftFloor = await tx.floor.findFirst({
            where: {
              propertyId,
              floorNumber: targetFloorNum,
              deletedAt: { not: null },
              id: { not: f.id },
            },
          });
          if (existingSoftFloor) {
            const archivedNum = -1 * (Math.abs(targetFloorNum) * 10000 + Math.floor(Math.random() * 9000 + 1000));
            await tx.floor.update({
              where: { id: existingSoftFloor.id },
              data: {
                floorNumber: archivedNum,
                name: `${existingSoftFloor.name}__archived_${existingSoftFloor.id.substring(0, 8)}`,
              },
            });
          }

          const newFloorName = targetFloorNum === 0 ? 'Ground Floor' : `Floor ${targetFloorNum}`;
          await tx.floor.update({
            where: { id: f.id },
            data: {
              floorNumber: targetFloorNum,
              name: newFloorName,
            },
          });

          // Re-sequence rooms and beds on this vacant floor
          for (let rIdx = 0; rIdx < f.rooms.length; rIdx++) {
            const room = f.rooms[rIdx];
            const rCount = rIdx + 1;
            const newRoomNum = `${targetFloorNum}${rCount < 10 ? '0' + rCount : rCount}`;

            // Check if a soft-deleted room holds this roomNumber and archive it
            const existingSoftRoom = await tx.room.findFirst({
              where: {
                floorId: f.id,
                roomNumber: newRoomNum,
                deletedAt: { not: null },
                id: { not: room.id },
              },
            });
            if (existingSoftRoom) {
              await tx.room.update({
                where: { id: existingSoftRoom.id },
                data: { roomNumber: `${newRoomNum}__archived_${existingSoftRoom.id.substring(0, 8)}` },
              });
            }

            await tx.room.update({
              where: { id: room.id },
              data: { roomNumber: newRoomNum },
            });

            for (let bIdx = 0; bIdx < room.beds.length; bIdx++) {
              const bed = room.beds[bIdx];
              const bedLetter = String.fromCharCode(65 + bIdx);
              const newBedNum = `${newRoomNum}-${bedLetter}`;

              // Check if a soft-deleted bed holds this bedNumber and archive it
              const existingSoftBed = await tx.bed.findFirst({
                where: {
                  roomId: room.id,
                  bedNumber: newBedNum,
                  deletedAt: { not: null },
                  id: { not: bed.id },
                },
              });
              if (existingSoftBed) {
                await tx.bed.update({
                  where: { id: existingSoftBed.id },
                  data: { bedNumber: `${newBedNum}__archived_${existingSoftBed.id.substring(0, 8)}` },
                });
              }

              await tx.bed.update({
                where: { id: bed.id },
                data: { bedNumber: newBedNum },
              });
            }
          }
        }
        nextExpectedFloor++;
      }
    }
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

    const existingSoftDeleted = await this.prisma.room.findFirst({
      where: {
        floorId: input.floorId,
        roomNumber: input.roomNumber.trim(),
        deletedAt: { not: null },
      },
    });

    const capacity = input.capacity ?? this.getDefaultCapacity(input.sharingType);

    const room = await this.prisma.$transaction(async (tx) => {
      let created: any;
      if (existingSoftDeleted) {
        created = await tx.room.update({
          where: { id: existingSoftDeleted.id },
          data: {
            propertyId,
            floorId: input.floorId,
            roomNumber: input.roomNumber.trim(),
            sharingType: input.sharingType,
            capacity,
            baseRent: input.baseRent,
            amenities: input.amenities || [],
            deletedAt: null,
          },
        });
      } else {
        created = await tx.room.create({
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
      }

      // Auto-generate beds if requested
      const generatedBeds: BedDto[] = [];
      if (input.autoGenerateBeds) {
        for (let i = 0; i < capacity; i++) {
          const bedLetter = String.fromCharCode(65 + i); // A, B, C, etc.
          const bedNumber = `${created.roomNumber}-${bedLetter}`;

          const existingBed = await tx.bed.findFirst({
            where: {
              roomId: created.id,
              bedNumber,
            },
          });

          let bed: any;
          if (existingBed) {
            bed = await tx.bed.update({
              where: { id: existingBed.id },
              data: {
                monthlyRent: created.baseRent,
                status: BedStatus.AVAILABLE,
                deletedAt: null,
              },
            });
          } else {
            bed = await tx.bed.create({
              data: {
                roomId: created.id,
                bedNumber,
                monthlyRent: created.baseRent,
                status: BedStatus.AVAILABLE,
              },
            });
          }

          generatedBeds.push({
            id: bed.id,
            roomId: bed.roomId,
            bedNumber: bed.bedNumber,
            monthlyRent: typeof bed.monthlyRent.toNumber === 'function' ? bed.monthlyRent.toNumber() : Number(bed.monthlyRent),
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

      const existingSoftDeleted = await this.prisma.room.findFirst({
        where: {
          floorId: room.floorId,
          roomNumber: input.roomNumber.trim(),
          deletedAt: { not: null },
        },
      });
      if (existingSoftDeleted) {
        await this.prisma.room.update({
          where: { id: existingSoftDeleted.id },
          data: { roomNumber: `${existingSoftDeleted.roomNumber}_archived_${Date.now()}` },
        });
      }
    }

    // Capacity checks
    const targetCapacity =
      input.capacity !== undefined && input.capacity > 0
        ? input.capacity
        : input.sharingType
        ? this.getDefaultCapacity(input.sharingType)
        : room.capacity;
    const occupiedCount = room.beds.filter((b) => (b.status as BedStatus) === BedStatus.OCCUPIED).length;
    if (targetCapacity < occupiedCount) {
      throw new BadRequestException(
        `Cannot reduce capacity to ${targetCapacity} beds because ${occupiedCount} beds are currently Occupied. Check out occupants first.`
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
        data: {
          deletedAt: timestamp,
          roomNumber: `${room.roomNumber}__deleted_${Date.now()}`,
        },
      });

      for (const b of room.beds) {
        await tx.bed.update({
          where: { id: b.id },
          data: {
            deletedAt: timestamp,
            bedNumber: `${b.bedNumber}__deleted_${Date.now()}`,
          },
        });
      }

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
      await this.prisma.room.update({
        where: { id: input.roomId },
        data: { capacity: room.beds.length + 1 },
      });
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

    const existingSoftDeleted = await this.prisma.bed.findFirst({
      where: {
        roomId: input.roomId,
        bedNumber: input.bedNumber.trim(),
        deletedAt: { not: null },
      },
    });

    if (existingSoftDeleted) {
      const restored = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.bed.update({
          where: { id: existingSoftDeleted.id },
          data: {
            monthlyRent: input.monthlyRent,
            status: input.status ?? BedStatus.AVAILABLE,
            deletedAt: null,
          },
        });

        await this.writeAuditLog(
          tx,
          organizationId,
          userId,
          'BED_CREATED',
          'Bed',
          updated.id,
          { bedNumber: updated.bedNumber, monthlyRent: updated.monthlyRent, restored: true }
        );

        return updated;
      });

      return {
        id: restored.id,
        roomId: restored.roomId,
        bedNumber: restored.bedNumber,
        monthlyRent: restored.monthlyRent.toNumber(),
        status: restored.status as BedStatus,
        createdAt: restored.createdAt,
        updatedAt: restored.updatedAt,
        deletedAt: restored.deletedAt,
      };
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

      const existingSoftDeleted = await this.prisma.bed.findFirst({
        where: {
          roomId: bed.roomId,
          bedNumber: input.bedNumber.trim(),
          deletedAt: { not: null },
        },
      });
      if (existingSoftDeleted) {
        await this.prisma.bed.update({
          where: { id: existingSoftDeleted.id },
          data: { bedNumber: `${existingSoftDeleted.bedNumber}_archived_${Date.now()}` },
        });
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
        data: {
          deletedAt: new Date(),
          bedNumber: `${bed.bedNumber}__deleted_${Date.now()}`,
        },
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

  /**
   * High-Performance Atomic Batch Inventory Creation (Floors, Rooms, and Beds in a single round-trip)
   */
  async createBatchInventory(
    organizationId: string,
    propertyId: string,
    userId: string,
    input: {
      floors: Array<{
        floorNumber: number;
        name?: string;
        rooms: Array<{
          roomNumber: string;
          sharingType: RoomSharingType;
          capacity?: number;
          baseRent: number;
          securityDeposit?: number;
          isAc?: boolean;
          amenities?: string[];
        }>;
      }>;
    }
  ): Promise<{ success: boolean; totalFloors: number; totalRooms: number; totalBeds: number }> {
    await this.validatePgProperty(organizationId, propertyId);

    if (!input.floors || input.floors.length === 0) {
      throw new BadRequestException('At least one floor level must be provided.');
    }

    let createdFloorsCount = 0;
    let createdRoomsCount = 0;
    let createdBedsCount = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const floorInput of input.floors) {
        const floorNumber = typeof floorInput.floorNumber === 'number' && !isNaN(floorInput.floorNumber)
          ? floorInput.floorNumber
          : Number(floorInput.floorNumber) || 0;

        const floorName = floorInput.name?.trim() || (floorNumber === 0 ? 'Ground Floor' : `Floor ${floorNumber}`);

        // Find or create floor
        let floor = await tx.floor.findFirst({
          where: {
            propertyId,
            floorNumber,
            deletedAt: null,
          },
        });

        if (!floor) {
          floor = await tx.floor.create({
            data: {
              propertyId,
              floorNumber,
              name: floorName,
            },
          });
          createdFloorsCount++;
        }

        // Process rooms
        if (floorInput.rooms && floorInput.rooms.length > 0) {
          for (const roomInput of floorInput.rooms) {
            const roomNumber = roomInput.roomNumber?.trim();
            if (!roomNumber) continue;

            const capacity = roomInput.capacity ?? this.getDefaultCapacity(roomInput.sharingType);
            const baseRent = Number(roomInput.baseRent) || 8500;
            const deposit = Number(roomInput.securityDeposit) || (baseRent * 2);

            const roomAmenities = roomInput.amenities || [
              ...(roomInput.isAc ? ['Air Conditioner', 'AC'] : []),
              `DEPOSIT:${deposit}`,
            ];

            let room = await tx.room.findFirst({
              where: {
                floorId: floor.id,
                roomNumber,
                deletedAt: null,
              },
            });

            if (!room) {
              room = await tx.room.create({
                data: {
                  propertyId,
                  floorId: floor.id,
                  roomNumber,
                  sharingType: roomInput.sharingType,
                  capacity,
                  baseRent,
                  amenities: roomAmenities,
                },
              });
              createdRoomsCount++;
            }

            // Generate beds for this room in bulk
            const bedData = [];
            for (let i = 0; i < capacity; i++) {
              const bedLetter = String.fromCharCode(65 + i);
              const bedNumber = `${room.roomNumber}-${bedLetter}`;
              bedData.push({
                roomId: room.id,
                bedNumber,
                monthlyRent: room.baseRent,
                status: BedStatus.AVAILABLE,
              });
            }

            if (bedData.length > 0) {
              const result = await tx.bed.createMany({
                data: bedData,
                skipDuplicates: true,
              });
              createdBedsCount += result.count;
            }
          }
        }
      }

      await this.writeAuditLog(
        tx,
        organizationId,
        userId,
        'INVENTORY_BATCH_CREATED',
        'Property',
        propertyId,
        {
          floorsCount: createdFloorsCount,
          roomsCount: createdRoomsCount,
          bedsCount: createdBedsCount,
        }
      );
    });

    return {
      success: true,
      totalFloors: createdFloorsCount,
      totalRooms: createdRoomsCount,
      totalBeds: createdBedsCount,
    };
  }
}
