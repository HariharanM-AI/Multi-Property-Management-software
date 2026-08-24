import { z } from 'zod';

export const expenseCategoryEnum = z.enum([
  'SALARY',
  'ELECTRICITY',
  'WATER',
  'FOOD',
  'MAINTENANCE',
  'CLEANING',
  'INTERNET',
  'SUPPLIES',
  'PROPERTY_TAX',
  'OTHER',
]);

export const createExpenseSchema = z
  .object({
    propertyId: z.string().uuid('Invalid property ID format'),
    categoryId: z.string().uuid('Invalid category ID format').optional().nullable(),
    categoryName: expenseCategoryEnum.optional().nullable(),
    title: z
      .string()
      .min(2, 'Title must be at least 2 characters')
      .max(150, 'Title cannot exceed 150 characters'),
    amount: z.number().positive('Expense amount must be strictly greater than zero'),
    expenseDate: z.string().datetime({ message: 'Expense date must be a valid ISO datetime' }),
    vendorName: z.string().max(150, 'Vendor name cannot exceed 150 characters').optional().nullable(),
    receiptUrl: z.string().max(1000, 'Receipt URL cannot exceed 1000 characters').optional().nullable(),
    notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional().nullable(),
  })
  .refine((data) => data.categoryId || data.categoryName, {
    message: 'Either categoryId or categoryName must be provided',
    path: ['categoryId'],
  });

export const updateExpenseSchema = z.object({
  propertyId: z.string().uuid('Invalid property ID format').optional(),
  categoryId: z.string().uuid('Invalid category ID format').optional().nullable(),
  categoryName: expenseCategoryEnum.optional().nullable(),
  title: z
    .string()
    .min(2, 'Title must be at least 2 characters')
    .max(150, 'Title cannot exceed 150 characters')
    .optional(),
  amount: z.number().positive('Expense amount must be strictly greater than zero').optional(),
  expenseDate: z.string().datetime({ message: 'Expense date must be a valid ISO datetime' }).optional(),
  vendorName: z.string().max(150, 'Vendor name cannot exceed 150 characters').optional().nullable(),
  receiptUrl: z.string().max(1000, 'Receipt URL cannot exceed 1000 characters').optional().nullable(),
  notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional().nullable(),
});

export const expenseFilterSchema = z.object({
  propertyId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  categoryName: expenseCategoryEnum.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  search: z.string().optional(),
  minAmount: z.coerce.number().positive().optional(),
  maxAmount: z.coerce.number().positive().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type ExpenseFilterInput = z.infer<typeof expenseFilterSchema>;
