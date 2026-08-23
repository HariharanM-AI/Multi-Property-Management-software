// ==============================================================================
// PropertyOS — Maintenance & Work Order Management Types (CORE-013)
// ==============================================================================

export enum MaintenanceCategory {
  PLUMBING = 'PLUMBING',
  ELECTRICAL = 'ELECTRICAL',
  CLEANING = 'CLEANING',
  FURNITURE = 'FURNITURE',
  APPLIANCE = 'APPLIANCE',
  INTERNET = 'INTERNET',
  CARPENTRY = 'CARPENTRY',
  PAINTING = 'PAINTING',
  AC_SERVICE = 'AC_SERVICE',
  WATER = 'WATER',
  SECURITY = 'SECURITY',
  OTHER = 'OTHER',
}

export enum MaintenancePriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum MaintenanceStatus {
  OPEN = 'OPEN',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  VERIFIED = 'VERIFIED',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
}

export enum MaintenanceAttachmentType {
  BEFORE = 'BEFORE',
  AFTER = 'AFTER',
  RECEIPT = 'RECEIPT',
  INVOICE = 'INVOICE',
  OTHER = 'OTHER',
}

export enum MaintenanceVendorStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum MaintenanceTargetType {
  PROPERTY = 'PROPERTY',
  FLOOR = 'FLOOR',
  ROOM = 'ROOM',
  BED = 'BED',
  RENTAL_UNIT = 'RENTAL_UNIT',
  COMMON_AREA = 'COMMON_AREA',
}

// ------------------------------------------------------------------------------
// DTOs & Models
// ------------------------------------------------------------------------------

export interface MaintenanceVendorDto {
  id: string;
  organizationId: string;
  name: string;
  phone: string;
  email: string | null;
  category: MaintenanceCategory | null;
  address: string | null;
  notes: string | null;
  status: MaintenanceVendorStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceCommentDto {
  id: string;
  organizationId: string;
  ticketId: string;
  authorId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface MaintenanceAttachmentDto {
  id: string;
  organizationId: string;
  ticketId: string;
  uploadedById: string;
  type: MaintenanceAttachmentType;
  fileName: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  uploadedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface MaintenanceAssignmentDto {
  id: string;
  organizationId: string;
  ticketId: string;
  assignedToId: string;
  assignedById: string;
  notes: string | null;
  assignedAt: string;
  unassignedAt: string | null;
  assignedTo?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  assignedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface MaintenanceStatusHistoryDto {
  id: string;
  organizationId: string;
  ticketId: string;
  fromStatus: MaintenanceStatus;
  toStatus: MaintenanceStatus;
  changedById: string;
  reason: string | null;
  createdAt: string;
  changedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface MaintenanceTicketDto {
  id: string;
  organizationId: string;
  propertyId: string;
  floorId: string | null;
  roomId: string | null;
  bedId: string | null;
  rentalUnitId: string | null;
  tenantId: string | null;
  createdById: string;
  assignedToId: string | null;
  vendorId: string | null;
  ticketNumber: string;
  title: string;
  description: string;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  targetType: MaintenanceTargetType;
  locationDetails: string | null;
  estimatedCost: string | null;
  actualCost: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  verifiedAt: string | null;
  closedAt: string | null;
  cancelledAt: string | null;
  resolutionNotes: string | null;
  tenantConfirmedAt: string | null;
  createdAt: string;
  updatedAt: string;

  property?: {
    id: string;
    name: string;
    propertyType: string;
  };
  floor?: {
    id: string;
    floorNumber: number;
    name: string;
  } | null;
  room?: {
    id: string;
    roomNumber: string;
  } | null;
  bed?: {
    id: string;
    bedNumber: string;
  } | null;
  rentalUnit?: {
    id: string;
    unitNumber: string;
  } | null;
  tenant?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  } | null;
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  assignedTo?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  vendor?: MaintenanceVendorDto | null;
  comments?: MaintenanceCommentDto[];
  attachments?: MaintenanceAttachmentDto[];
  assignments?: MaintenanceAssignmentDto[];
  statusHistory?: MaintenanceStatusHistoryDto[];
}

// ------------------------------------------------------------------------------
// Request / Creation Payloads
// ------------------------------------------------------------------------------

export interface CreateMaintenanceTicketDto {
  propertyId: string;
  targetType?: MaintenanceTargetType;
  floorId?: string | null;
  roomId?: string | null;
  bedId?: string | null;
  rentalUnitId?: string | null;
  tenantId?: string | null;
  title: string;
  description: string;
  category: MaintenanceCategory;
  priority?: MaintenancePriority;
  locationDetails?: string | null;
  estimatedCost?: string | number | null;
  scheduledAt?: string | null;
}

export interface UpdateMaintenanceTicketDto {
  title?: string;
  description?: string;
  category?: MaintenanceCategory;
  priority?: MaintenancePriority;
  locationDetails?: string | null;
  estimatedCost?: string | number | null;
  scheduledAt?: string | null;
}

export interface AssignMaintenanceTicketDto {
  assignedToId: string;
  notes?: string | null;
}

export interface ReassignMaintenanceTicketDto {
  newAssignedToId: string;
  notes?: string | null;
}

export interface StartMaintenanceTicketDto {
  notes?: string | null;
}

export interface CompleteMaintenanceTicketDto {
  actualCost?: string | number | null;
  resolutionNotes?: string | null;
  vendorId?: string | null;
}

export interface VerifyMaintenanceTicketDto {
  notes?: string | null;
}

export interface CloseMaintenanceTicketDto {
  notes?: string | null;
}

export interface CancelMaintenanceTicketDto {
  reason: string;
}

export interface CreateMaintenanceCommentDto {
  body: string;
}

export interface CreateMaintenanceAttachmentDto {
  type: MaintenanceAttachmentType;
  fileName: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
}

export interface UpdateMaintenanceCostDto {
  estimatedCost?: string | number | null;
  actualCost?: string | number | null;
  vendorId?: string | null;
  notes?: string | null;
}

export interface CreateMaintenanceVendorDto {
  name: string;
  phone: string;
  email?: string | null;
  category?: MaintenanceCategory | null;
  address?: string | null;
  notes?: string | null;
}

export interface UpdateMaintenanceVendorDto {
  name?: string;
  phone?: string;
  email?: string | null;
  category?: MaintenanceCategory | null;
  address?: string | null;
  notes?: string | null;
  status?: MaintenanceVendorStatus;
}

export interface MaintenanceListQueryDto {
  propertyId?: string;
  status?: MaintenanceStatus;
  priority?: MaintenancePriority;
  category?: MaintenanceCategory;
  assignedToId?: string;
  tenantId?: string;
  targetType?: MaintenanceTargetType;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface MaintenanceSummaryDto {
  totalTickets: number;
  openTickets: number;
  assignedTickets: number;
  inProgressTickets: number;
  urgentTickets: number;
  awaitingVerificationTickets: number;
  completedTodayTickets: number;
  closedTickets: number;
  avgResolutionHours: number;
  totalEstimatedCost: string;
  totalActualCost: string;
}
