// ==============================================================================
// PropertyOS Checkout & Settlement Domain Types
// ==============================================================================

export enum CheckoutStatus {
  INITIATED = 'INITIATED',
  SETTLEMENT_PENDING = 'SETTLEMENT_PENDING',
  READY = 'READY',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum SettlementStatus {
  DRAFT = 'DRAFT',
  FINALIZED = 'FINALIZED',
  VOID = 'VOID',
}

export interface SettlementDto {
  id: string;
  organizationId: string;
  tenantId: string;
  checkoutId: string;
  securityDeposit: number;
  outstandingRent: number;
  maintenanceCharges: number;
  deductions: number;
  refundableAmount: number;
  amountDue: number;
  amountRefundable: number;
  status: SettlementStatus;
  notes?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CheckoutDto {
  id: string;
  organizationId: string;
  tenantId: string;
  propertyId: string;
  checkInId?: string | null;
  stayHistoryId?: string | null;
  leaseId?: string | null;
  rentalUnitId?: string | null;
  bedId?: string | null;
  checkoutDate: Date | string;
  status: CheckoutStatus;
  reason?: string | null;
  completedAt?: Date | string | null;
  cancelledAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;

  settlement?: SettlementDto | null;
  tenant?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string | null;
    status: string;
  };
  property?: {
    id: string;
    code: string;
    name: string;
    propertyType: string;
  };
  bed?: {
    id: string;
    bedNumber: string;
    room?: {
      id: string;
      roomNumber: string;
      floor?: {
        id: string;
        floorNumber: number;
      };
    };
  } | null;
  rentalUnit?: {
    id: string;
    unitNumber: string;
  } | null;
  lease?: {
    id: string;
    startDate: Date | string;
    endDate: Date | string;
    monthlyRent: number;
    securityDeposit: number;
    status: string;
  } | null;
}

export interface CreateCheckoutDto {
  tenantId: string;
  checkInId?: string;
  checkoutDate: string;
  reason?: string;
}

export interface UpdateSettlementDto {
  outstandingRent?: number;
  maintenanceCharges?: number;
  deductions?: number;
  notes?: string;
}

export interface FinalizeSettlementDto {
  notes?: string;
}

export interface CancelCheckoutDto {
  reason?: string;
}

export interface CheckoutSummaryDto {
  id: string;
  tenantName: string;
  tenantPhone: string;
  propertyName: string;
  propertyType: 'PG' | 'RENTAL_HOUSE';
  occupancyDescription: string;
  checkInDate: string;
  checkoutDate: string;
  status: CheckoutStatus;
  settlementStatus?: SettlementStatus;
  amountDue: number;
  amountRefundable: number;
}
