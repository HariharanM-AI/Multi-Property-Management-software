// ==============================================================================
// PropertyOS PG Meal Management Foundation Types (CORE-012)
// ==============================================================================

import { BillingFrequency } from './billing';

export enum MealType {
  BREAKFAST = 'BREAKFAST',
  LUNCH = 'LUNCH',
  DINNER = 'DINNER',
}

export enum MealPlanStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum MealSubscriptionStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum MealRecordStatus {
  CONSUMED = 'CONSUMED',
  SKIPPED = 'SKIPPED',
  NOT_AVAILABLE = 'NOT_AVAILABLE',
  EXCUSED = 'EXCUSED',
}

export enum MealChargeStatus {
  PENDING = 'PENDING',
  INVOICED = 'INVOICED',
  CANCELLED = 'CANCELLED',
}

export enum MealBillingMode {
  SUBSCRIPTION = 'SUBSCRIPTION',
  PER_MEAL = 'PER_MEAL',
}

export interface MealPlanDto {
  id: string;
  organizationId: string;
  propertyId: string;
  name: string;
  description?: string | null;
  price: number | string;
  billingFrequency: BillingFrequency;
  status: MealPlanStatus;
  hasBreakfast: boolean;
  hasLunch: boolean;
  hasDinner: boolean;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    subscriptions: number;
    charges: number;
  };
}

export interface CreateMealPlanDto {
  name: string;
  description?: string;
  price: number | string;
  billingFrequency?: BillingFrequency;
  hasBreakfast?: boolean;
  hasLunch?: boolean;
  hasDinner?: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
}

export interface UpdateMealPlanDto {
  name?: string;
  description?: string;
  price?: number | string;
  billingFrequency?: BillingFrequency;
  status?: MealPlanStatus;
  hasBreakfast?: boolean;
  hasLunch?: boolean;
  hasDinner?: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
}

export interface MealSubscriptionDto {
  id: string;
  organizationId: string;
  propertyId: string;
  tenantId: string;
  mealPlanId: string;
  startDate: string;
  endDate?: string | null;
  status: MealSubscriptionStatus;
  createdAt: string;
  updatedAt: string;
  tenant?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    status: string;
  };
  mealPlan?: {
    id: string;
    name: string;
    price: number | string;
    billingFrequency: BillingFrequency;
  };
}

export interface CreateMealSubscriptionDto {
  tenantId: string;
  mealPlanId: string;
  startDate: string;
  endDate?: string;
}

export interface UpdateMealSubscriptionDto {
  status?: MealSubscriptionStatus;
  endDate?: string | null;
}

export interface MealRecordDto {
  id: string;
  organizationId: string;
  propertyId: string;
  tenantId: string;
  mealDate: string;
  mealType: MealType;
  status: MealRecordStatus;
  recordedAt: string;
  recordedBy?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  tenant?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
}

export interface RecordMealAttendanceDto {
  tenantId: string;
  mealDate: string;
  mealType: MealType;
  status: MealRecordStatus;
  notes?: string;
}

export interface BulkMealRecordEntryDto {
  tenantId: string;
  status: MealRecordStatus;
  notes?: string;
}

export interface BulkRecordMealAttendanceDto {
  mealDate: string;
  mealType: MealType;
  records: BulkMealRecordEntryDto[];
}

export interface MealChargeDto {
  id: string;
  organizationId: string;
  propertyId: string;
  tenantId: string;
  mealPlanId?: string | null;
  mealRecordId?: string | null;
  periodStart: string;
  periodEnd: string;
  billingMode: MealBillingMode;
  amount: number | string;
  status: MealChargeStatus;
  invoiceId?: string | null;
  invoiceLineId?: string | null;
  createdAt: string;
  updatedAt: string;
  tenant?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
  mealPlan?: {
    id: string;
    name: string;
    price: number | string;
  } | null;
  invoice?: {
    id: string;
    invoiceNumber: string;
    status: string;
    totalAmount: number | string;
  } | null;
}

export interface GenerateMealChargesDto {
  periodStart: string;
  periodEnd: string;
  billingMode?: MealBillingMode;
  autoInvoice?: boolean;
}

export interface MealSummaryDto {
  activePlansCount: number;
  activeSubscriptionsCount: number;
  todayBreakfastCount: number;
  todayLunchCount: number;
  todayDinnerCount: number;
  currentMealRevenue: number | string;
}

export interface TenantMealSummaryDto {
  tenantId: string;
  activePlan?: MealPlanDto | null;
  subscription?: MealSubscriptionDto | null;
  todayRecords: MealRecordDto[];
  recentCharges: MealChargeDto[];
}

export interface DailyMealMatrixRowDto {
  tenantId: string;
  tenantName: string;
  phone: string;
  roomNumber?: string | null;
  floorNumber?: number | null;
  subscription?: {
    id: string;
    planName: string;
    status: MealSubscriptionStatus;
  } | null;
  breakfast?: MealRecordStatus | null;
  lunch?: MealRecordStatus | null;
  dinner?: MealRecordStatus | null;
}
