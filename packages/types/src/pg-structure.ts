import { RoomSharingType, BedStatus } from './index';

export interface BedDto {
  id: string;
  roomId: string;
  bedNumber: string;
  monthlyRent: number;
  status: BedStatus;
  createdAt: string | Date;
  updatedAt: string | Date;
  deletedAt?: string | Date | null;
}

export interface RoomDto {
  id: string;
  propertyId: string;
  floorId: string;
  roomNumber: string;
  sharingType: RoomSharingType;
  capacity: number;
  baseRent: number;
  amenities: string[];
  beds?: BedDto[];
  createdAt: string | Date;
  updatedAt: string | Date;
  deletedAt?: string | Date | null;

  // Aggregate / runtime fields
  bedsCount?: number;
  availableBedsCount?: number;
  occupiedBedsCount?: number;
}

export interface FloorDto {
  id: string;
  propertyId: string;
  floorNumber: number;
  name: string;
  rooms?: RoomDto[];
  createdAt: string | Date;
  updatedAt: string | Date;
  deletedAt?: string | Date | null;

  // Aggregate / runtime fields
  roomsCount?: number;
  bedsCount?: number;
  occupiedBedsCount?: number;
}

export interface CreateFloorDto {
  floorNumber: number;
  name: string;
}

export interface UpdateFloorDto {
  floorNumber?: number;
  name?: string;
}

export interface CreateRoomDto {
  floorId: string;
  roomNumber: string;
  sharingType: RoomSharingType;
  capacity?: number; // Optional: resolves automatically based on sharingType if omitted
  baseRent: number;
  amenities?: string[];
  autoGenerateBeds?: boolean;
}

export interface UpdateRoomDto {
  roomNumber?: string;
  sharingType?: RoomSharingType;
  capacity?: number;
  baseRent?: number;
  amenities?: string[];
}

export interface CreateBedDto {
  roomId: string;
  bedNumber: string;
  monthlyRent: number;
  status?: BedStatus;
}

export interface UpdateBedDto {
  bedNumber?: string;
  monthlyRent?: number;
  status?: BedStatus;
}

export interface BedStatusUpdateDto {
  status: BedStatus;
}

export interface PgPropertySummaryDto {
  propertyId: string;
  totalFloors: number;
  totalRooms: number;
  totalBeds: number;
  availableBeds: number;
  occupiedBeds: number;
  reservedBeds: number;
  maintenanceBeds: number;
  blockedBeds: number;
  cleaningBeds: number;
  noticeBeds: number;
  occupancyRate: number; // percentage (0 - 100)
}
