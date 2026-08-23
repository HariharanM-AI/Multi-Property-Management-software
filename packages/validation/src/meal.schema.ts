import { z } from 'zod';
import {
  MealType,
  MealPlanStatus,
  MealSubscriptionStatus,
  MealRecordStatus,
  MealBillingMode,
  BillingFrequency,
} from '@propertyos/types';

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

export const CreateMealPlanSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  description: z.string().trim().max(500).optional().nullable(),
  price: PositiveDecimalStringOrNumber,
  billingFrequency: z.nativeEnum(BillingFrequency).optional().default(BillingFrequency.MONTHLY),
  hasBreakfast: z.boolean().optional().default(true),
  hasLunch: z.boolean().optional().default(true),
  hasDinner: z.boolean().optional().default(true),
  effectiveFrom: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional().nullable(),
  effectiveTo: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional().nullable(),
});

export const UpdateMealPlanSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  price: PositiveDecimalStringOrNumber.optional(),
  billingFrequency: z.nativeEnum(BillingFrequency).optional(),
  status: z.nativeEnum(MealPlanStatus).optional(),
  hasBreakfast: z.boolean().optional(),
  hasLunch: z.boolean().optional(),
  hasDinner: z.boolean().optional(),
  effectiveFrom: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional().nullable(),
  effectiveTo: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional().nullable(),
});

export const CreateMealSubscriptionSchema = z.object({
  tenantId: z.string().uuid('Invalid Tenant ID'),
  mealPlanId: z.string().uuid('Invalid Meal Plan ID'),
  startDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  endDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional().nullable(),
});

export const UpdateMealSubscriptionSchema = z.object({
  status: z.nativeEnum(MealSubscriptionStatus).optional(),
  endDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional().nullable(),
});

export const RecordMealAttendanceSchema = z.object({
  tenantId: z.string().uuid('Invalid Tenant ID'),
  mealDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  mealType: z.nativeEnum(MealType),
  status: z.nativeEnum(MealRecordStatus),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const BulkMealRecordEntrySchema = z.object({
  tenantId: z.string().uuid('Invalid Tenant ID'),
  status: z.nativeEnum(MealRecordStatus),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const BulkRecordMealAttendanceSchema = z.object({
  mealDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  mealType: z.nativeEnum(MealType),
  records: z.array(BulkMealRecordEntrySchema).min(1, 'At least one record is required'),
});

export const GenerateMealChargesSchema = z.object({
  periodStart: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  periodEnd: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  billingMode: z.nativeEnum(MealBillingMode).optional().default(MealBillingMode.SUBSCRIPTION),
  autoInvoice: z.boolean().optional().default(false),
});
