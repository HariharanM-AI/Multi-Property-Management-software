import { z } from 'zod';
import {
  BillingFrequency,
  ChargeType,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
} from '@propertyos/types';

// Helper: validate monetary decimal input
const DecimalStringOrNumber = z
  .union([
    z.string().regex(/^\d+(\.\d{1,2})?$/, 'Amount must be a valid monetary decimal with up to 2 decimal places'),
    z.number().nonnegative('Amount must be non-negative'),
  ])
  .refine(
    (val) => {
      const num = typeof val === 'number' ? val : parseFloat(val);
      return !isNaN(num) && num >= 0;
    },
    { message: 'Amount must be a non-negative decimal' }
  );

const PositiveDecimalStringOrNumber = z
  .union([
    z.string().regex(/^\d+(\.\d{1,2})?$/, 'Amount must be a valid monetary decimal with up to 2 decimal places'),
    z.number().positive('Amount must be strictly greater than zero'),
  ])
  .refine(
    (val) => {
      const num = typeof val === 'number' ? val : parseFloat(val);
      return !isNaN(num) && num > 0;
    },
    { message: 'Amount must be strictly greater than zero' }
  );

// ------------------------------------------------------------------------------
// Billing Charges Schemas
// ------------------------------------------------------------------------------

export const CreateBillingChargeSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  chargeType: z.nativeEnum(ChargeType),
  description: z.string().trim().max(500).optional().nullable(),
  amount: DecimalStringOrNumber,
  frequency: z.nativeEnum(BillingFrequency),
  isActive: z.boolean().optional().default(true),
});

export const UpdateBillingChargeSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  amount: DecimalStringOrNumber.optional(),
  frequency: z.nativeEnum(BillingFrequency).optional(),
  isActive: z.boolean().optional(),
});

// ------------------------------------------------------------------------------
// Billing Schedules Schemas
// ------------------------------------------------------------------------------

export const CreateBillingScheduleSchema = z
  .object({
    tenantId: z.string().uuid('Invalid tenantId'),
    propertyId: z.string().uuid('Invalid propertyId').optional().nullable(),
    leaseId: z.string().uuid('Invalid leaseId').optional().nullable(),
    checkInId: z.string().uuid('Invalid checkInId').optional().nullable(),
    chargeId: z.string().uuid('Invalid chargeId'),
    startDate: z.string().datetime({ message: 'startDate must be a valid ISO datetime' }),
    endDate: z.string().datetime({ message: 'endDate must be a valid ISO datetime' }).optional().nullable(),
    frequency: z.nativeEnum(BillingFrequency),
    amount: DecimalStringOrNumber.optional(),
    active: z.boolean().optional().default(true),
  })
  .refine(
    (data) => {
      if (data.endDate && new Date(data.endDate) < new Date(data.startDate)) {
        return false;
      }
      return true;
    },
    {
      message: 'endDate must not be before startDate',
      path: ['endDate'],
    }
  );

export const UpdateBillingScheduleSchema = z.object({
  endDate: z.string().datetime().optional().nullable(),
  amount: DecimalStringOrNumber.optional(),
  frequency: z.nativeEnum(BillingFrequency).optional(),
  nextBillingDate: z.string().datetime().optional().nullable(),
  active: z.boolean().optional(),
});

// ------------------------------------------------------------------------------
// Invoices Schemas
// ------------------------------------------------------------------------------

export const CreateInvoiceLineSchema = z.object({
  chargeId: z.string().uuid().optional().nullable(),
  description: z.string().trim().min(1, 'Description is required').max(255),
  chargeType: z.nativeEnum(ChargeType),
  quantity: z
    .union([z.string().regex(/^\d+(\.\d{1,2})?$/), z.number().positive()])
    .optional()
    .default(1),
  unitAmount: DecimalStringOrNumber,
});

export const CreateInvoiceSchema = z
  .object({
    tenantId: z.string().uuid('Invalid tenantId'),
    propertyId: z.string().uuid('Invalid propertyId').optional().nullable(),
    leaseId: z.string().uuid('Invalid leaseId').optional().nullable(),
    checkInId: z.string().uuid('Invalid checkInId').optional().nullable(),
    issueDate: z.string().datetime({ message: 'issueDate must be a valid ISO datetime' }),
    dueDate: z.string().datetime({ message: 'dueDate must be a valid ISO datetime' }),
    lines: z.array(CreateInvoiceLineSchema).min(1, 'Invoice must have at least one line item'),
    adjustments: DecimalStringOrNumber.optional().default(0),
    notes: z.string().trim().max(1000).optional().nullable(),
  })
  .refine(
    (data) => {
      if (new Date(data.dueDate) < new Date(data.issueDate)) {
        return false;
      }
      return true;
    },
    {
      message: 'dueDate must not be before issueDate',
      path: ['dueDate'],
    }
  );

export const UpdateInvoiceSchema = z.object({
  dueDate: z.string().datetime().optional(),
  adjustments: DecimalStringOrNumber.optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
  lines: z.array(CreateInvoiceLineSchema).min(1).optional(),
});

// ------------------------------------------------------------------------------
// Payments & Allocations Schemas
// ------------------------------------------------------------------------------

export const AllocatePaymentSchema = z.object({
  invoiceId: z.string().uuid('Invalid invoiceId'),
  amount: PositiveDecimalStringOrNumber,
});

export const CreatePaymentSchema = z.object({
  tenantId: z.string().uuid('Invalid tenantId'),
  amount: PositiveDecimalStringOrNumber,
  paymentMethod: z.nativeEnum(PaymentMethod),
  referenceNumber: z.string().trim().min(1).max(100).optional().nullable(),
  paymentDate: z.string().datetime({ message: 'paymentDate must be a valid ISO datetime' }),
  notes: z.string().trim().max(1000).optional().nullable(),
  allocations: z.array(AllocatePaymentSchema).optional(),
});

// ------------------------------------------------------------------------------
// Credits Schemas
// ------------------------------------------------------------------------------

export const CreateCreditSchema = z.object({
  tenantId: z.string().uuid('Invalid tenantId'),
  amount: PositiveDecimalStringOrNumber,
  reason: z.string().trim().min(1, 'Reason is required').max(255),
  sourceInvoiceId: z.string().uuid().optional().nullable(),
});

// ------------------------------------------------------------------------------
// Security Deposit Schemas
// ------------------------------------------------------------------------------

export const UpdateSecurityDepositSchema = z.object({
  amountHeld: DecimalStringOrNumber.optional(),
  deductionAmount: DecimalStringOrNumber.optional(),
  refundAmount: DecimalStringOrNumber.optional(),
  reason: z.string().trim().max(500).optional(),
});

// ------------------------------------------------------------------------------
// Filter Schemas
// ------------------------------------------------------------------------------

export const InvoiceFilterSchema = z.object({
  tenantId: z.string().uuid().optional(),
  propertyId: z.string().uuid().optional(),
  status: z.nativeEnum(InvoiceStatus).optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  search: z.string().trim().optional(),
});

export const PaymentFilterSchema = z.object({
  tenantId: z.string().uuid().optional(),
  status: z.nativeEnum(PaymentStatus).optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
});

export const BillingFilterSchema = z.object({
  tenantId: z.string().uuid().optional(),
  propertyId: z.string().uuid().optional(),
  active: z
    .union([z.boolean(), z.string().transform((v) => v === 'true')])
    .optional(),
});

// ------------------------------------------------------------------------------
// Inferred TypeScript Types
// ------------------------------------------------------------------------------

export type CreateBillingChargeInput = z.infer<typeof CreateBillingChargeSchema>;
export type UpdateBillingChargeInput = z.infer<typeof UpdateBillingChargeSchema>;

export type CreateBillingScheduleInput = z.infer<typeof CreateBillingScheduleSchema>;
export type UpdateBillingScheduleInput = z.infer<typeof UpdateBillingScheduleSchema>;

export type CreateInvoiceLineInput = z.infer<typeof CreateInvoiceLineSchema>;
export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof UpdateInvoiceSchema>;

export type AllocatePaymentInput = z.infer<typeof AllocatePaymentSchema>;
export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;

export type CreateCreditInput = z.infer<typeof CreateCreditSchema>;
export type UpdateSecurityDepositInput = z.infer<typeof UpdateSecurityDepositSchema>;

export type InvoiceFilterInput = z.infer<typeof InvoiceFilterSchema>;
export type PaymentFilterInput = z.infer<typeof PaymentFilterSchema>;
export type BillingFilterInput = z.infer<typeof BillingFilterSchema>;
