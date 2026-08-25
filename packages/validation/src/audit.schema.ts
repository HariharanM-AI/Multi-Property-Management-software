import { z } from 'zod';
import { AuditCategory } from '@propertyos/types';

// ==============================================================================
// Audit Trail & Event Logging Validation Schemas (CORE-028)
// ==============================================================================

export const AuditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(255).optional(),
  action: z.string().trim().max(100).optional(),
  resourceType: z.string().trim().max(100).optional(),
  resourceId: z.string().trim().max(100).optional(),
  userId: z.string().uuid().optional(),
  startDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  endDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  category: z.nativeEnum(AuditCategory).optional(),
  sortBy: z.enum(['NEWEST', 'OLDEST']).default('NEWEST'),
});

export const AuditExportQuerySchema = z.object({
  format: z.enum(['CSV', 'JSON']).default('CSV'),
  search: z.string().trim().max(255).optional(),
  action: z.string().trim().max(100).optional(),
  resourceType: z.string().trim().max(100).optional(),
  resourceId: z.string().trim().max(100).optional(),
  userId: z.string().uuid().optional(),
  startDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  endDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  category: z.nativeEnum(AuditCategory).optional(),
});

export type AuditLogQueryInput = z.infer<typeof AuditLogQuerySchema>;
export type AuditExportQueryInput = z.infer<typeof AuditExportQuerySchema>;
