import { PropertyType, PropertyStatus, RoomSharingType } from './index';
import { AmenityDto, PropertyMediaDto } from './property';

// ==============================================================================
// PropertyOS Discovery Domain Types (CORE-024)
// ==============================================================================

export enum DiscoverySortBy {
  RENT_ASC = 'RENT_ASC',
  RENT_DESC = 'RENT_DESC',
  DISTANCE_ASC = 'DISTANCE_ASC',
  NAME_ASC = 'NAME_ASC',
  NEWEST = 'NEWEST',
}

export interface PropertyDiscoveryDto {
  id: string;
  organizationId: string;
  organizationName: string;
  code: string;
  name: string;
  propertyType: PropertyType;
  status: PropertyStatus;
  description?: string | null;
  address: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  locality?: string | null;
  city: string;
  district?: string | null;
  state: string;
  country: string;
  postalCode: string;
  latitude?: number | null;
  longitude?: number | null;
  distanceKm?: number | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  images: string[];
  startingRent: number;
  maxRent: number;
  totalCapacity: number;
  availableCapacity: number;
  hasAvailability: boolean;
  availableSharingTypes: RoomSharingType[];
  availableUnitTypes: string[];
  amenities: AmenityDto[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface PropertyDiscoveryRoomSummary {
  id: string;
  roomNumber: string;
  floorNumber?: number | null;
  sharingType: RoomSharingType;
  capacity: number;
  baseRent: number;
  availableBedsCount: number;
  amenities: string[];
  beds: Array<{
    id: string;
    bedNumber: string;
    monthlyRent: number;
    status: string;
  }>;
}

export interface PropertyDiscoveryUnitSummary {
  id: string;
  unitNumber: string;
  unitType: string;
  floorNumber?: number | null;
  superBuiltupAreaSqFt?: number | null;
  carpetAreaSqFt?: number | null;
  furnishingStatus: string;
  monthlyRent: number;
  securityDeposit: number;
  maintenanceCharges: number;
  status: string;
}

export interface PropertyDiscoveryDetailDto extends PropertyDiscoveryDto {
  media: PropertyMediaDto[];
  availableRooms?: PropertyDiscoveryRoomSummary[];
  availableUnits?: PropertyDiscoveryUnitSummary[];
}

export interface PropertyDiscoveryQuery {
  page?: number;
  limit?: number;
  search?: string;
  city?: string;
  locality?: string;
  state?: string;
  postalCode?: string;
  propertyType?: PropertyType;
  minRent?: number;
  maxRent?: number;
  sharingTypes?: RoomSharingType[];
  unitTypes?: string[];
  furnishingStatus?: string;
  amenities?: string[];
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  availableOnly?: boolean;
  sortBy?: DiscoverySortBy;
  organizationId?: string;
}

export interface PaginatedDiscoveryDto {
  items: PropertyDiscoveryDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DiscoveryCitySummaryDto {
  city: string;
  state: string;
  activePropertiesCount: number;
  pgCount: number;
  rentalCount: number;
  localities: string[];
}
