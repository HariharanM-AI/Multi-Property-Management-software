import { RentalUnitStatus, LeaseStatus } from './domain.js';

export interface RentalUnitDto {
  id: string;
  propertyId: string;
  unitNumber: string;
  unitType: string;
  floorNumber: number | null;
  superBuiltupAreaSqFt: number | null;
  carpetAreaSqFt: number | null;
  furnishingStatus: string;
  monthlyRent: number;
  securityDeposit: number;
  maintenanceCharges: number;
  status: RentalUnitStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  activeLease?: LeaseDto | null;
}

export interface CreateRentalUnitDto {
  unitNumber: string;
  unitType: string;
  floorNumber?: number | null;
  superBuiltupAreaSqFt?: number | null;
  carpetAreaSqFt?: number | null;
  furnishingStatus?: string;
  monthlyRent: number;
  securityDeposit: number;
  maintenanceCharges?: number;
}

export interface UpdateRentalUnitDto {
  unitNumber?: string;
  unitType?: string;
  floorNumber?: number | null;
  superBuiltupAreaSqFt?: number | null;
  carpetAreaSqFt?: number | null;
  furnishingStatus?: string;
  monthlyRent?: number;
  securityDeposit?: number;
  maintenanceCharges?: number;
  status?: RentalUnitStatus;
}

export interface LeaseDto {
  id: string;
  rentalUnitId: string;
  tenantId: string;
  startDate: Date;
  endDate: Date;
  monthlyRent: number;
  securityDeposit: number;
  noticePeriodDays: number;
  lockInMonths: number;
  status: LeaseStatus;
  terms: string | null;
  createdAt: Date;
  updatedAt: Date;
  escalations?: RentEscalationDto[];
  tenant?: any;
}

export interface CreateLeaseDto {
  rentalUnitId: string;
  tenantId: string;
  startDate: string; // ISO String
  endDate: string; // ISO String
  monthlyRent: number;
  securityDeposit: number;
  noticePeriodDays?: number;
  lockInMonths?: number;
  terms?: string | null;
}

export interface UpdateLeaseDto {
  startDate?: string;
  endDate?: string;
  monthlyRent?: number;
  securityDeposit?: number;
  noticePeriodDays?: number;
  lockInMonths?: number;
  status?: LeaseStatus;
  terms?: string | null;
}

export interface RentEscalationDto {
  id: string;
  leaseId: string;
  effectiveDate: Date;
  percentage: number;
  escalatedAmount: number;
  notes: string | null;
  createdAt: Date;
}

export interface CreateRentEscalationDto {
  effectiveDate: string; // ISO String
  percentage: number;
  notes?: string | null;
}

export interface RentalPropertySummaryDto {
  totalUnits: number;
  occupiedUnits: number;
  availableUnits: number;
  maintenanceUnits: number;
  activeLeasesCount: number;
  projectedMonthlyRevenue: number;
}
