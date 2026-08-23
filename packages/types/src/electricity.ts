// ==============================================================================
// PropertyOS Electricity & Utilities Foundation Types (CORE-012)
// ==============================================================================

export enum MeterType {
  ROOM = 'ROOM',
  PROPERTY = 'PROPERTY',
  COMMON_AREA = 'COMMON_AREA',
}

export enum MeterStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  MAINTENANCE = 'MAINTENANCE',
}

export enum ElectricityRateStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum ElectricityChargeStatus {
  PENDING = 'PENDING',
  INVOICED = 'INVOICED',
  CANCELLED = 'CANCELLED',
}

export enum ElectricityAllocationType {
  TENANT_SPECIFIC = 'TENANT_SPECIFIC',
  ROOM_SHARED = 'ROOM_SHARED',
  PROPERTY_COMMON = 'PROPERTY_COMMON',
}

export interface ElectricityMeterDto {
  id: string;
  organizationId: string;
  propertyId: string;
  roomId?: string | null;
  rentalUnitId?: string | null;
  meterNumber: string;
  meterType: MeterType;
  status: MeterStatus;
  initialReading: number | string;
  installedAt: string;
  lastReadingAt?: string | null;
  createdAt: string;
  updatedAt: string;
  room?: {
    id: string;
    roomNumber: string;
  } | null;
  property?: {
    id: string;
    name: string;
    code: string;
  };
  _count?: {
    readings: number;
    charges: number;
  };
}

export interface CreateElectricityMeterDto {
  meterNumber: string;
  meterType?: MeterType;
  roomId?: string;
  rentalUnitId?: string;
  initialReading?: number | string;
  installedAt?: string;
}

export interface UpdateElectricityMeterDto {
  meterNumber?: string;
  status?: MeterStatus;
  roomId?: string | null;
}

export interface ElectricityReadingDto {
  id: string;
  organizationId: string;
  propertyId: string;
  meterId: string;
  readingDate: string;
  previousReading: number | string;
  currentReading: number | string;
  unitsConsumed: number | string;
  previousReadingId?: string | null;
  isResetOverride: boolean;
  resetReason?: string | null;
  recordedBy?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  meter?: {
    id: string;
    meterNumber: string;
    meterType: MeterType;
    roomId?: string | null;
  };
}

export interface RecordElectricityReadingDto {
  meterId: string;
  readingDate: string;
  currentReading: number | string;
  isResetOverride?: boolean;
  resetReason?: string;
  notes?: string;
}

export interface ElectricityRateDto {
  id: string;
  organizationId: string;
  propertyId: string;
  ratePerUnit: number | string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: ElectricityRateStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateElectricityRateDto {
  ratePerUnit: number | string;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export interface ElectricityChargeDto {
  id: string;
  organizationId: string;
  propertyId: string;
  meterId?: string | null;
  readingId: string;
  tenantId?: string | null;
  roomId?: string | null;
  chargePeriodStart: string;
  chargePeriodEnd: string;
  unitsConsumed: number | string;
  ratePerUnit: number | string;
  amount: number | string;
  allocationType: ElectricityAllocationType;
  status: ElectricityChargeStatus;
  invoiceId?: string | null;
  invoiceLineId?: string | null;
  createdAt: string;
  updatedAt: string;
  tenant?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  } | null;
  room?: {
    id: string;
    roomNumber: string;
  } | null;
  meter?: {
    id: string;
    meterNumber: string;
    meterType: MeterType;
  } | null;
  invoice?: {
    id: string;
    invoiceNumber: string;
    status: string;
    totalAmount: number | string;
  } | null;
}

export interface GenerateElectricityChargesDto {
  readingId: string;
  autoInvoice?: boolean;
}

export interface ElectricitySummaryDto {
  totalMeters: number;
  activeMeters: number;
  currentPeriodConsumption: number | string;
  totalElectricityCharges: number | string;
  pendingChargesCount: number;
  invoicedChargesCount: number;
}

export interface TenantElectricitySummaryDto {
  tenantId: string;
  currentPeriodUnits: number | string;
  allocatedAmount: number | string;
  recentCharges: ElectricityChargeDto[];
  meter?: ElectricityMeterDto | null;
}
