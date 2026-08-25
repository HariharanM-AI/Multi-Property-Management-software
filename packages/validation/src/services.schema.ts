import { z } from 'zod';
import {
  ServiceRequestCategory,
  ServiceRequestPriority,
  ServiceRequestStatus,
  ServiceRequestSlot,
} from '@propertyos/types';

export const CreateServiceRequestSchema = z.object({
  propertyId: z.string().uuid('Invalid property ID'),
  serviceCategory: z.nativeEnum(ServiceRequestCategory),
  priority: z.nativeEnum(ServiceRequestPriority).optional().default(ServiceRequestPriority.MEDIUM),
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(255, 'Title cannot exceed 255 characters'),
  description: z
    .string()
    .min(5, 'Description must be at least 5 characters')
    .max(2000, 'Description cannot exceed 2000 characters'),
  contactPhone: z
    .string()
    .min(10, 'Contact phone must be at least 10 digits')
    .max(15, 'Contact phone cannot exceed 15 digits')
    .optional(),
  roomId: z.string().uuid('Invalid room ID').optional().nullable(),
  rentalUnitId: z.string().uuid('Invalid rental unit ID').optional().nullable(),
  locationDetails: z.string().max(255, 'Location details cannot exceed 255 characters').optional().nullable(),
  preferredSlot: z.nativeEnum(ServiceRequestSlot).optional().default(ServiceRequestSlot.ANYTIME),
  preferredDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional().nullable(),
  estimatedCost: z.number().min(0, 'Estimated cost cannot be negative').max(1000000, 'Estimated cost cannot exceed 1,000,000').optional().nullable(),
  isPaidByTenant: z.boolean().optional().default(false),
});

export const UpdateServiceRequestSchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(255, 'Title cannot exceed 255 characters')
    .optional(),
  description: z
    .string()
    .min(5, 'Description must be at least 5 characters')
    .max(2000, 'Description cannot exceed 2000 characters')
    .optional(),
  serviceCategory: z.nativeEnum(ServiceRequestCategory).optional(),
  priority: z.nativeEnum(ServiceRequestPriority).optional(),
  contactPhone: z
    .string()
    .min(10, 'Contact phone must be at least 10 digits')
    .max(15, 'Contact phone cannot exceed 15 digits')
    .optional(),
  roomId: z.string().uuid('Invalid room ID').optional().nullable(),
  rentalUnitId: z.string().uuid('Invalid rental unit ID').optional().nullable(),
  locationDetails: z.string().max(255, 'Location details cannot exceed 255 characters').optional().nullable(),
  preferredSlot: z.nativeEnum(ServiceRequestSlot).optional(),
  preferredDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional().nullable(),
  estimatedCost: z.number().min(0, 'Estimated cost cannot be negative').max(1000000, 'Estimated cost cannot exceed 1,000,000').optional().nullable(),
  actualCost: z.number().min(0, 'Actual cost cannot be negative').max(1000000, 'Actual cost cannot exceed 1,000,000').optional().nullable(),
  isPaidByTenant: z.boolean().optional(),
  resolutionNotes: z.string().max(2000, 'Resolution notes cannot exceed 2000 characters').optional().nullable(),
});

export const AssignServiceRequestSchema = z.object({
  assignedStaffId: z.string().uuid('Invalid staff member ID').optional().nullable(),
  assignedVendorName: z.string().max(255, 'Vendor name cannot exceed 255 characters').optional().nullable(),
  assignedVendorPhone: z.string().max(20, 'Vendor phone cannot exceed 20 characters').optional().nullable(),
  scheduledDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional().nullable(),
  notes: z.string().max(1000, 'Notes cannot exceed 1000 characters').optional().nullable(),
});

export const UpdateServiceRequestStatusSchema = z.object({
  status: z.nativeEnum(ServiceRequestStatus),
  resolutionNotes: z.string().max(2000, 'Resolution notes cannot exceed 2000 characters').optional(),
  actualCost: z.number().min(0, 'Actual cost cannot be negative').max(1000000, 'Actual cost cannot exceed 1,000,000').optional(),
  isPaidByTenant: z.boolean().optional(),
  cancellationReason: z.string().max(500, 'Cancellation reason cannot exceed 500 characters').optional(),
});

export const ServiceRequestQuerySchema = z.object({
  propertyId: z.string().uuid('Invalid property ID').optional(),
  serviceCategory: z.nativeEnum(ServiceRequestCategory).optional(),
  priority: z.nativeEnum(ServiceRequestPriority).optional(),
  status: z.nativeEnum(ServiceRequestStatus).optional(),
  assignedStaffId: z.string().uuid('Invalid staff member ID').optional(),
  requesterId: z.string().uuid('Invalid requester ID').optional(),
  tenantId: z.string().uuid('Invalid tenant ID').optional(),
  search: z.string().optional(),
  startDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
  endDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
  sortBy: z.enum(['NEWEST', 'OLDEST', 'PRIORITY_DESC', 'SCHEDULED_ASC']).optional().default('NEWEST'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});
