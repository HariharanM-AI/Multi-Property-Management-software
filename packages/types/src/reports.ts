import { PropertyType, ExpenseCategoryType } from './domain.js';

// ==============================================================================
// PropertyOS — Reports & Financial Analytics Domain Types (CORE-021)
// ==============================================================================

export type ReportPeriod = 'monthly' | 'quarterly' | 'yearly' | 'custom';

export interface RevenueBreakdownItemDto {
  category: string;
  amount: string; // Decimal representation in INR
  count: number;
  percentage: number;
}

export interface ExpenseBreakdownItemDto {
  category: ExpenseCategoryType;
  amount: string; // Decimal representation in INR
  count: number;
  percentage: number;
}

export interface MonthlyTrendDto {
  period: string; // e.g. "2026-08" or "2026-Q3"
  invoicedRevenue: string;
  collectedRevenue: string;
  expenses: string;
  netOperatingIncome: string;
  profitMarginPercentage: number;
}

export interface PnlStatementDto {
  organizationId: string;
  propertyId: string | null;
  propertyName: string | null;
  startDate: string;
  endDate: string;
  totalRevenueInvoiced: string;
  totalRevenueCollected: string;
  totalExpenses: string;
  netOperatingIncome: string; // Realized Cash NOI = totalRevenueCollected - totalExpenses
  invoicedOperatingProfit: string; // Accrual NOI = totalRevenueInvoiced - totalExpenses
  operatingMarginPercentage: number;
  totalOutstandingRevenue: string; // totalRevenueInvoiced - totalRevenueCollected
  revenueBreakdown: RevenueBreakdownItemDto[];
  expenseBreakdown: ExpenseBreakdownItemDto[];
  trends: MonthlyTrendDto[];
}

export interface PropertyOccupancyItemDto {
  propertyId: string;
  propertyCode: string;
  propertyName: string;
  propertyType: PropertyType;
  totalCapacity: number; // beds for PG, units for RENTAL_HOUSE
  occupiedCapacity: number;
  availableCapacity: number;
  occupancyRate: number;
}

export interface OccupancyReportDto {
  organizationId: string;
  propertyId: string | null;
  totalProperties: number;
  pgMetrics: {
    totalBeds: number;
    occupiedBeds: number;
    availableBeds: number;
    maintenanceBeds: number;
    occupancyRate: number;
  };
  rentalMetrics: {
    totalUnits: number;
    occupiedUnits: number;
    vacantUnits: number;
    occupancyRate: number;
  };
  blendedOccupancyRate: number;
  propertyBreakdown: PropertyOccupancyItemDto[];
}

export interface PropertyComparisonItemDto {
  propertyId: string;
  propertyCode: string;
  propertyName: string;
  propertyType: PropertyType;
  totalRevenueInvoiced: string;
  totalRevenueCollected: string;
  totalExpenses: string;
  netOperatingIncome: string;
  operatingMarginPercentage: number;
  occupancyRate: number;
  activeTenantCount: number;
}

export interface PropertyComparisonReportDto {
  organizationId: string;
  startDate: string;
  endDate: string;
  properties: PropertyComparisonItemDto[];
}

export interface CashFlowReportDto {
  organizationId: string;
  propertyId: string | null;
  startDate: string;
  endDate: string;
  realizedInflows: string;
  realizedOutflows: string;
  netCashFlow: string;
  operatingInflows: string;
  depositInflows: string;
  depositRefunds: string;
}

export interface ReportFilterQuery {
  propertyId?: string;
  startDate?: string;
  endDate?: string;
  period?: ReportPeriod;
}
