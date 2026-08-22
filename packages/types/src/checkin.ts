// ==============================================================================
// PropertyOS — Check-In & Onboarding Domain Types & DTOs
// ==============================================================================

export enum CheckInStatus {
  INITIATED = 'INITIATED',
  READY = 'READY',
  CHECKED_IN = 'CHECKED_IN',
  CANCELLED = 'CANCELLED',
}

export interface CheckInDto {
  id: string;
  organizationId: string;
  tenantId: string;
  propertyId: string;
  bedId?: string | null;
  rentalUnitId?: string | null;
  leaseId?: string | null;
  stayHistoryId?: string | null;
  checkInDate: string | Date;
  expectedCheckoutDate?: string | Date | null;
  status: CheckInStatus;
  emergencyContactConfirmed: boolean;
  kycConfirmed: boolean;
  notes?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  completedAt?: string | Date | null;
  cancelledAt?: string | Date | null;

  tenant?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string | null;
  };
  property?: {
    id: string;
    name: string;
    code: string;
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
    startDate: string | Date;
    endDate: string | Date;
    monthlyRent: number;
    status: string;
  } | null;
}

export interface CreatePgCheckInDto {
  tenantId: string;
  bedId: string;
  checkInDate: string | Date;
  expectedCheckoutDate?: string | Date | null;
  emergencyContactConfirmed?: boolean;
  notes?: string | null;
}

export interface CreateRentalCheckInDto {
  tenantId: string;
  leaseId: string;
  checkInDate: string | Date;
  expectedCheckoutDate?: string | Date | null;
  emergencyContactConfirmed?: boolean;
  notes?: string | null;
}

export interface OnboardingStatusDto {
  tenantId: string;
  tenantProfileComplete: boolean;
  emergencyContactComplete: boolean;
  kycRequired: boolean;
  kycVerified: boolean;
  activePgStayPresent: boolean;
  activeLeasePresent: boolean;
  bedAssigned?: boolean;
  readyForCheckIn: boolean;
  missingItems: string[];
}

export interface CancelCheckInDto {
  reason?: string | null;
}
