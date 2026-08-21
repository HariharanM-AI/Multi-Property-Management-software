import { z } from 'zod';
import { PaymentMethod } from '@propertyos/types';

export const InvoiceItemSchema = z.object({
  description: z.string().trim().min(1).max(255),
  amount: z.number().positive('Item amount must be positive'),
  category: z.enum(['RENT', 'ELECTRICITY', 'MEALS', 'MAINTENANCE', 'LATE_FEE', 'OTHER']),
});

export const GenerateInvoiceSchema = z.object({
  propertyId: z.string().uuid(),
  tenantId: z.string().uuid(),
  billingPeriodStart: z.string().datetime(),
  billingPeriodEnd: z.string().datetime(),
  dueDate: z.string().datetime(),
  items: z.array(InvoiceItemSchema).min(1, 'Invoice must have at least one line item'),
  discountAmount: z.number().nonnegative().optional().default(0),
  lateFeeAmount: z.number().nonnegative().optional().default(0),
  notes: z.string().max(500).optional().nullable(),
});

export const RecordPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().positive('Payment amount must be greater than zero'),
  paymentMethod: z.nativeEnum(PaymentMethod),
  transactionReference: z.string().trim().min(1).max(100).optional().nullable(),
  paymentDate: z.string().datetime(),
  notes: z.string().max(500).optional().nullable(),
});

export const RecordMeterReadingSchema = z.object({
  meterId: z.string().uuid(),
  readingDate: z.string().datetime(),
  currentReading: z.number().nonnegative(),
  isResetOverride: z.boolean().optional().default(false),
  resetReason: z.string().max(255).optional().nullable(),
});

export type InvoiceItemInput = z.infer<typeof InvoiceItemSchema>;
export type GenerateInvoiceInput = z.infer<typeof GenerateInvoiceSchema>;
export type RecordPaymentInput = z.infer<typeof RecordPaymentSchema>;
export type RecordMeterReadingInput = z.infer<typeof RecordMeterReadingSchema>;
