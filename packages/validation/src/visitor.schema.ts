import { z } from 'zod';
import { indianPhoneRegex } from './auth.schema.js';

export const createVisitorSchema = z.object({
  propertyId: z.string().uuid('Invalid property ID format'),
  tenantId: z.string().uuid('Invalid tenant ID format'),
  visitorName: z.string().min(2, 'Visitor name must be at least 2 characters').max(100, 'Visitor name cannot exceed 100 characters'),
  visitorPhone: z.string().regex(indianPhoneRegex, 'Must be a valid 10-digit Indian mobile number'),
  purpose: z.string().min(2, 'Purpose must be at least 2 characters').max(200, 'Purpose cannot exceed 200 characters'),
  entryTime: z.string().datetime().optional(),
  isApproved: z.boolean().optional(),
});

export const updateVisitorSchema = z.object({
  visitorName: z.string().min(2, 'Visitor name must be at least 2 characters').max(100).optional(),
  visitorPhone: z.string().regex(indianPhoneRegex, 'Must be a valid 10-digit Indian mobile number').optional(),
  purpose: z.string().min(2, 'Purpose must be at least 2 characters').max(200).optional(),
  isApproved: z.boolean().optional(),
});

export const checkInVisitorSchema = z.object({
  entryTime: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
});

export const checkOutVisitorSchema = z.object({
  exitTime: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
});

export const visitorFilterSchema = z.object({
  propertyId: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'CHECKED_IN', 'CHECKED_OUT', 'REJECTED']).optional(),
  search: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export type CreateVisitorInput = z.infer<typeof createVisitorSchema>;
export type UpdateVisitorInput = z.infer<typeof updateVisitorSchema>;
export type CheckInVisitorInput = z.infer<typeof checkInVisitorSchema>;
export type CheckOutVisitorInput = z.infer<typeof checkOutVisitorSchema>;
export type VisitorFilterInput = z.infer<typeof visitorFilterSchema>;
