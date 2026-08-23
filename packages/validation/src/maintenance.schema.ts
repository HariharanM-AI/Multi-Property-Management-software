import { z } from 'zod';
import {
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceStatus,
  MaintenanceAttachmentType,
  MaintenanceVendorStatus,
  MaintenanceTargetType,
} from '@propertyos/types';

const DecimalStringOrNumber = z
  .union([
    z.string().regex(/^\d+(\.\d{1,2})?$/, 'Value must be a valid decimal with up to 2 decimal places'),
    z.number().nonnegative('Value must be non-negative'),
  ])
  .refine(
    (val) => {
      const num = typeof val === 'number' ? val : parseFloat(val);
      return !isNaN(num) && num >= 0;
    },
    { message: 'Value must be a non-negative decimal' }
  );

export const CreateMaintenanceTicketSchema = z.object({
  propertyId: z.string().uuid('Invalid Property ID'),
  targetType: z.nativeEnum(MaintenanceTargetType).optional().default(MaintenanceTargetType.PROPERTY),
  floorId: z.string().uuid('Invalid Floor ID').optional().nullable(),
  roomId: z.string().uuid('Invalid Room ID').optional().nullable(),
  bedId: z.string().uuid('Invalid Bed ID').optional().nullable(),
  rentalUnitId: z.string().uuid('Invalid Rental Unit ID').optional().nullable(),
  tenantId: z.string().uuid('Invalid Tenant ID').optional().nullable(),
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200, 'Title cannot exceed 200 characters'),
  description: z.string().trim().min(5, 'Description must be at least 5 characters').max(2000, 'Description cannot exceed 2000 characters'),
  category: z.nativeEnum(MaintenanceCategory),
  priority: z.nativeEnum(MaintenancePriority).optional().default(MaintenancePriority.MEDIUM),
  locationDetails: z.string().trim().max(300).optional().nullable(),
  estimatedCost: DecimalStringOrNumber.optional().nullable(),
  scheduledAt: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional().nullable(),
});

export const UpdateMaintenanceTicketSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().min(5).max(2000).optional(),
  category: z.nativeEnum(MaintenanceCategory).optional(),
  priority: z.nativeEnum(MaintenancePriority).optional(),
  locationDetails: z.string().trim().max(300).optional().nullable(),
  estimatedCost: DecimalStringOrNumber.optional().nullable(),
  scheduledAt: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional().nullable(),
});

export const AssignMaintenanceTicketSchema = z.object({
  assignedToId: z.string().uuid('Invalid Assigned Staff ID'),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const ReassignMaintenanceTicketSchema = z.object({
  newAssignedToId: z.string().uuid('Invalid New Assigned Staff ID'),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const StartMaintenanceTicketSchema = z.object({
  notes: z.string().trim().max(500).optional().nullable(),
});

export const CompleteMaintenanceTicketSchema = z.object({
  actualCost: DecimalStringOrNumber.optional().nullable(),
  resolutionNotes: z.string().trim().max(1000).optional().nullable(),
  vendorId: z.string().uuid('Invalid Vendor ID').optional().nullable(),
});

export const VerifyMaintenanceTicketSchema = z.object({
  notes: z.string().trim().max(500).optional().nullable(),
});

export const CloseMaintenanceTicketSchema = z.object({
  notes: z.string().trim().max(500).optional().nullable(),
});

export const CancelMaintenanceTicketSchema = z.object({
  reason: z.string().trim().min(3, 'Cancellation reason is required').max(500),
});

export const CreateMaintenanceCommentSchema = z.object({
  body: z.string().trim().min(1, 'Comment cannot be empty').max(2000, 'Comment cannot exceed 2000 characters'),
});

export const CreateMaintenanceAttachmentSchema = z.object({
  type: z.nativeEnum(MaintenanceAttachmentType).optional().default(MaintenanceAttachmentType.OTHER),
  fileName: z.string().trim().min(1).max(255),
  storagePath: z.string().trim().min(1).max(1000),
  mimeType: z.string().trim().min(1).max(100),
  fileSize: z.number().int().positive().max(26214400, 'File size cannot exceed 25MB'),
});

export const UpdateMaintenanceCostSchema = z.object({
  estimatedCost: DecimalStringOrNumber.optional().nullable(),
  actualCost: DecimalStringOrNumber.optional().nullable(),
  vendorId: z.string().uuid('Invalid Vendor ID').optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const CreateMaintenanceVendorSchema = z.object({
  name: z.string().trim().min(2, 'Vendor name must be at least 2 characters').max(100),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian phone number starting with 6-9'),
  email: z.string().trim().email('Invalid email address').optional().nullable(),
  category: z.nativeEnum(MaintenanceCategory).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const UpdateMaintenanceVendorSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian phone number starting with 6-9').optional(),
  email: z.string().trim().email('Invalid email address').optional().nullable(),
  category: z.nativeEnum(MaintenanceCategory).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  status: z.nativeEnum(MaintenanceVendorStatus).optional(),
});

export const MaintenanceListQuerySchema = z.object({
  propertyId: z.string().uuid().optional(),
  status: z.nativeEnum(MaintenanceStatus).optional(),
  priority: z.nativeEnum(MaintenancePriority).optional(),
  category: z.nativeEnum(MaintenanceCategory).optional(),
  assignedToId: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
  targetType: z.nativeEnum(MaintenanceTargetType).optional(),
  search: z.string().trim().max(100).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'updatedAt', 'priority', 'status', 'scheduledAt', 'ticketNumber']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});
