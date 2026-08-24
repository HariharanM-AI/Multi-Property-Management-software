export type InventoryCategory =
  | 'APPLIANCE'
  | 'FURNITURE'
  | 'LINEN'
  | 'ELECTRONIC'
  | 'OTHER';

export type InventoryCondition =
  | 'NEW'
  | 'GOOD'
  | 'FAIR'
  | 'POOR'
  | 'DAMAGED';

export type InventoryStatus =
  | 'AVAILABLE'
  | 'ASSIGNED'
  | 'UNDER_REPAIR'
  | 'DISPOSED';

export interface InventoryItemDto {
  id: string;
  propertyId: string;
  propertyName?: string;
  propertyType?: string;
  roomId?: string | null;
  roomNumber?: string | null;
  rentalUnitId?: string | null;
  unitNumber?: string | null;
  itemName: string;
  category: InventoryCategory | string;
  serialNumber?: string | null;
  condition: InventoryCondition | string;
  status: InventoryStatus | string;
  purchaseDate?: string | null;
  purchasePrice?: number | string | null;
  locationDisplay?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInventoryItemDto {
  propertyId: string;
  roomId?: string | null;
  rentalUnitId?: string | null;
  itemName: string;
  category: InventoryCategory | string;
  serialNumber?: string | null;
  condition?: InventoryCondition | string;
  status?: InventoryStatus | string;
  purchaseDate?: string | null;
  purchasePrice?: number | null;
}

export interface UpdateInventoryItemDto {
  itemName?: string;
  category?: InventoryCategory | string;
  serialNumber?: string | null;
  condition?: InventoryCondition | string;
  status?: InventoryStatus | string;
  purchaseDate?: string | null;
  purchasePrice?: number | null;
}

export interface AssignInventoryItemDto {
  roomId?: string | null;
  rentalUnitId?: string | null;
}

export interface InventorySummaryDto {
  totalItems: number;
  assignedItems: number;
  availableItems: number;
  underRepairItems: number;
  damagedItems: number;
  totalAssetValue: number | string;
}

export interface InventoryFilterQuery {
  propertyId?: string;
  roomId?: string;
  rentalUnitId?: string;
  category?: string;
  condition?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}
