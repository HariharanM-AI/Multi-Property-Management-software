import { PropertyStatus, PropertyType } from './domain.js';

// ==============================================================================
// CORE-022: Multi-Property Owner Dashboard DTOs & Interfaces
// ==============================================================================

export interface PortfolioCapacityDto {
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  totalUnits: number;
  occupiedUnits: number;
  availableUnits: number;
  blendedOccupancyRate: number; // e.g. 85.50
}

export interface DashboardFinancialsCurrentMonthDto {
  invoicedRevenue: string; // "125000.00"
  collectedRevenue: string; // "105000.00"
  operationalExpenses: string; // "45000.00"
  netOperatingIncome: string; // "60000.00" (collected - expenses)
  outstandingReceivables: string; // "20000.00"
  operatingMarginPercentage: number; // e.g. 57.14
}

export interface DashboardKpisDto {
  totalProperties: number;
  activeProperties: number;
  pgCount: number;
  rentalCount: number;
  capacity: PortfolioCapacityDto;
  financials: DashboardFinancialsCurrentMonthDto;
  activeTenantsCount: number;
  urgentActionItemsCount: number;
}

export type PropertyOccupancyBadge = 'FULL' | 'HIGH_OCCUPANCY' | 'NORMAL' | 'LOW_OCCUPANCY' | 'VACANT';

export interface PropertyCardCapacityDto {
  total: number;
  occupied: number;
  available: number;
  occupancyRate: number;
  statusBadge: PropertyOccupancyBadge;
}

export interface PropertyCardFinancialsDto {
  invoicedRevenue: string;
  collectedRevenue: string;
  operationalExpenses: string;
  netIncome: string;
}

export interface PropertyCardMaintenanceDto {
  openCount: number;
  inProgressCount: number;
  hasUrgent: boolean;
}

export interface PropertyCardDto {
  id: string;
  name: string;
  code: string;
  propertyType: PropertyType;
  status: PropertyStatus;
  city: string;
  address: string;
  capacity: PropertyCardCapacityDto;
  financials: PropertyCardFinancialsDto;
  maintenance: PropertyCardMaintenanceDto;
  pendingInvoicesCount: number;
  pendingInvoicesAmount: string;
}

export interface OverdueInvoiceItemDto {
  id: string;
  invoiceNumber: string;
  tenantId: string;
  tenantName: string;
  tenantPhone?: string;
  propertyId: string;
  propertyName: string;
  totalAmount: string;
  paidAmount: string;
  outstandingAmount: string;
  dueDate: string; // ISO string
  daysOverdue: number;
  status: string;
}

export interface UrgentMaintenanceItemDto {
  id: string;
  ticketNumber: string;
  title: string;
  priority: string;
  status: string;
  propertyId: string;
  propertyName: string;
  locationDisplay: string;
  createdAt: string;
  ageInDays: number;
}

export interface UpcomingRenewalItemDto {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantPhone?: string;
  propertyId: string;
  propertyName: string;
  unitId?: string;
  unitNumber?: string;
  monthlyRent: string;
  startDate: string;
  endDate: string;
  daysRemaining: number;
}

export interface DashboardActionItemsDto {
  overdueInvoices: OverdueInvoiceItemDto[];
  urgentMaintenance: UrgentMaintenanceItemDto[];
  upcomingRenewals: UpcomingRenewalItemDto[];
  totalActionItemsCount: number;
}

export type DashboardActivityType =
  | 'PAYMENT_RECEIVED'
  | 'MAINTENANCE_CREATED'
  | 'MAINTENANCE_COMPLETED'
  | 'TENANT_CHECKED_IN'
  | 'EXPENSE_RECORDED';

export interface DashboardActivityItemDto {
  id: string;
  type: DashboardActivityType;
  title: string;
  description: string;
  timestamp: string; // ISO string
  propertyId?: string;
  propertyName?: string;
  amount?: string;
}

export interface PortfolioDashboardDto {
  organizationId: string;
  kpis: DashboardKpisDto;
  propertyCards: PropertyCardDto[];
  actionItems: DashboardActionItemsDto;
  recentActivity: DashboardActivityItemDto[];
  generatedAt: string;
}

export interface DashboardFilterQuery {
  propertyType?: 'ALL' | 'PG' | 'RENTAL_HOUSE';
  city?: string;
  status?: 'ALL' | 'ACTIVE' | 'INACTIVE';
}
