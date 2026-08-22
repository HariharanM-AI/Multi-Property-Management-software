import { z } from 'zod';
import { CheckoutStatus } from '@propertyos/types';

export const CreateCheckoutSchema = z.object({
  tenantId: z.string().uuid('Invalid tenant ID format'),
  checkInId: z.string().uuid('Invalid check-in ID format').optional(),
  checkoutDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid checkout date format' }),
  reason: z.string().max(500, 'Reason must not exceed 500 characters').optional(),
});

export type CreateCheckoutInput = z.infer<typeof CreateCheckoutSchema>;

export const UpdateSettlementSchema = z.object({
  outstandingRent: z
    .number()
    .min(0, 'Outstanding rent cannot be negative')
    .optional(),
  maintenanceCharges: z
    .number()
    .min(0, 'Maintenance charges cannot be negative')
    .optional(),
  deductions: z
    .number()
    .min(0, 'Deductions cannot be negative')
    .optional(),
  notes: z.string().max(1000, 'Notes must not exceed 1000 characters').optional(),
});

export type UpdateSettlementInput = z.infer<typeof UpdateSettlementSchema>;

export const FinalizeSettlementSchema = z.object({
  notes: z.string().max(1000, 'Notes must not exceed 1000 characters').optional(),
});

export type FinalizeSettlementInput = z.infer<typeof FinalizeSettlementSchema>;

export const CancelCheckoutSchema = z.object({
  reason: z.string().max(500, 'Reason must not exceed 500 characters').optional(),
});

export type CancelCheckoutInput = z.infer<typeof CancelCheckoutSchema>;

export const CheckoutFilterSchema = z.object({
  status: z.nativeEnum(CheckoutStatus).optional(),
  propertyId: z.string().uuid('Invalid property ID format').optional(),
  tenantId: z.string().uuid('Invalid tenant ID format').optional(),
  search: z.string().max(100).optional(),
});

export type CheckoutFilterInput = z.infer<typeof CheckoutFilterSchema>;
