import { UserRole } from './auth';

export enum ServiceRequestCategory {
  PLUMBING = 'PLUMBING',
  ELECTRICAL = 'ELECTRICAL',
  HOUSEKEEPING = 'HOUSEKEEPING',
  CARPENTRY = 'CARPENTRY',
  APPLIANCE_REPAIR = 'APPLIANCE_REPAIR',
  PEST_CONTROL = 'PEST_CONTROL',
  PAINTING = 'PAINTING',
  LAUNDRY = 'LAUNDRY',
  PACKING_MOVING = 'PACKING_MOVING',
  OTHER = 'OTHER',
}

export enum ServiceRequestPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum ServiceRequestStatus {
  PENDING = 'PENDING',
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum ServiceRequestSlot {
  MORNING = 'MORNING',
  AFTERNOON = 'AFTERNOON',
  EVENING = 'EVENING',
  ANYTIME = 'ANYTIME',
}

export interface ServiceRequestDto {
  id: string;
  organizationId: string;
  propertyId: string;
  requesterId: string;
  tenantId?: string | null;
  serviceCategory: ServiceRequestCategory;
  priority: ServiceRequestPriority;
  status: ServiceRequestStatus;
  title: string;
  description: string;
  requesterName: string;
  requesterRole: UserRole;
  contactPhone: string;
  roomId?: string | null;
  rentalUnitId?: string | null;
  locationDetails?: string | null;
  preferredSlot: ServiceRequestSlot;
  preferredDate?: string | null;
  scheduledDate?: string | null;
  assignedStaffId?: string | null;
  assignedVendorName?: string | null;
  assignedVendorPhone?: string | null;
  estimatedCost?: string | null;
  actualCost?: string | null;
  isPaidByTenant: boolean;
  resolutionNotes?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  createdAt: string;
  updatedAt: string;

  // Hydrated relations
  property?: {
    id: string;
    name: string;
    code: string;
    propertyType: string;
  };
  room?: {
    id: string;
    roomNumber: string;
  } | null;
  rentalUnit?: {
    id: string;
    unitNumber: string;
  } | null;
  assignedStaff?: {
    id: string;
    name: string;
    roleTitle: string;
    phone: string;
  } | null;
}

export interface CreateServiceRequestDto {
  propertyId: string;
  serviceCategory: ServiceRequestCategory;
  priority?: ServiceRequestPriority;
  title: string;
  description: string;
  contactPhone?: string;
  roomId?: string;
  rentalUnitId?: string;
  locationDetails?: string;
  preferredSlot?: ServiceRequestSlot;
  preferredDate?: string;
  estimatedCost?: number;
  isPaidByTenant?: boolean;
}

export interface UpdateServiceRequestDto {
  title?: string;
  description?: string;
  serviceCategory?: ServiceRequestCategory;
  priority?: ServiceRequestPriority;
  contactPhone?: string;
  roomId?: string | null;
  rentalUnitId?: string | null;
  locationDetails?: string | null;
  preferredSlot?: ServiceRequestSlot;
  preferredDate?: string | null;
  estimatedCost?: number | null;
  actualCost?: number | null;
  isPaidByTenant?: boolean;
  resolutionNotes?: string | null;
}

export interface AssignServiceRequestDto {
  assignedStaffId?: string | null;
  assignedVendorName?: string | null;
  assignedVendorPhone?: string | null;
  scheduledDate?: string | null;
  notes?: string;
}

export interface UpdateServiceRequestStatusDto {
  status: ServiceRequestStatus;
  resolutionNotes?: string;
  actualCost?: number;
  isPaidByTenant?: boolean;
  cancellationReason?: string;
}

export interface ServiceRequestQueryDto {
  propertyId?: string;
  serviceCategory?: ServiceRequestCategory;
  priority?: ServiceRequestPriority;
  status?: ServiceRequestStatus;
  assignedStaffId?: string;
  requesterId?: string;
  tenantId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: 'NEWEST' | 'OLDEST' | 'PRIORITY_DESC' | 'SCHEDULED_ASC';
  page?: number;
  limit?: number;
}

export interface ServiceCategorySummaryDto {
  category: ServiceRequestCategory;
  count: number;
}

export interface ServiceRequestSummaryDto {
  totalRequests: number;
  pendingRequests: number;
  scheduledRequests: number;
  inProgressRequests: number;
  completedRequests: number;
  cancelledRequests: number;
  totalActualCost: string;
  totalEstimatedCost: string;
  categoryBreakdown: ServiceCategorySummaryDto[];
}
