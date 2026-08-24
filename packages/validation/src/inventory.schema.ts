import { z } from 'zod';

export const inventoryCategoryEnum = z.enum([
  'APPLIANCE',
  'FURNITURE',
  'LINEN',
  'ELECTRONIC',
  'OTHER',
]);

export const inventoryConditionEnum = z.enum([
  'NEW',
  'GOOD',
  'FAIR',
  'POOR',
  'DAMAGED',
]);

export const inventoryStatusEnum = z.enum([
  'AVAILABLE',
  'ASSIGNED',
  'UNDER_REPAIR',
  'DISPOSED',
]);

export const createInventoryItemSchema = z.object({
  propertyId: z.string().uuid('Invalid property ID format'),
  roomId: z.string().uuid('Invalid room ID format').optional().nullable(),
  rentalUnitId: z.string().uuid('Invalid rental unit ID format').optional().nullable(),
  itemName: z
    .string()
    .min(2, 'Item name must be at least 2 characters')
    .max(150, 'Item name cannot exceed 150 characters'),
  category: inventoryCategoryEnum,
  serialNumber: z.string().max(100, 'Serial number cannot exceed 100 characters').optional().nullable(),
  condition: inventoryConditionEnum.optional(),
  status: inventoryStatusEnum.optional(),
  purchaseDate: z.string().datetime().optional().nullable(),
  purchasePrice: z.number().min(0, 'Purchase price cannot be negative').optional().nullable(),
});

export const updateInventoryItemSchema = z.object({
  itemName: z
    .string()
    .min(2, 'Item name must be at least 2 characters')
    .max(150, 'Item name cannot exceed 150 characters')
    .optional(),
  category: inventoryCategoryEnum.optional(),
  serialNumber: z.string().max(100, 'Serial number cannot exceed 100 characters').optional().nullable(),
  condition: inventoryConditionEnum.optional(),
  status: inventoryStatusEnum.optional(),
  purchaseDate: z.string().datetime().optional().nullable(),
  purchasePrice: z.number().min(0, 'Purchase price cannot be negative').optional().nullable(),
});

export const assignInventoryItemSchema = z.object({
  roomId: z.string().uuid('Invalid room ID format').optional().nullable(),
  rentalUnitId: z.string().uuid('Invalid rental unit ID format').optional().nullable(),
});

export const inventoryFilterSchema = z.object({
  propertyId: z.string().uuid().optional(),
  roomId: z.string().uuid().optional(),
  rentalUnitId: z.string().uuid().optional(),
  category: z.string().optional(),
  condition: z.string().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>;
export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>;
export type AssignInventoryItemInput = z.infer<typeof assignInventoryItemSchema>;
export type InventoryFilterInput = z.infer<typeof inventoryFilterSchema>;
