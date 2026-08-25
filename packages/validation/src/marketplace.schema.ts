import { z } from 'zod';
import {
  MarketplaceCategory,
  MarketplaceItemCondition,
  MarketplaceListingStatus,
  MarketplaceSortBy,
} from '@propertyos/types';

export const CreateMarketplaceListingSchema = z.object({
  propertyId: z.string().uuid({ message: 'Property ID must be a valid UUID' }),
  title: z
    .string()
    .min(3, { message: 'Title must be at least 3 characters' })
    .max(255, { message: 'Title cannot exceed 255 characters' })
    .trim(),
  description: z
    .string()
    .min(5, { message: 'Description must be at least 5 characters' })
    .max(2000, { message: 'Description cannot exceed 2000 characters' })
    .trim(),
  price: z
    .union([z.number(), z.string()])
    .refine((val) => {
      const num = typeof val === 'string' ? parseFloat(val) : val;
      return !isNaN(num) && num > 0 && num <= 10000000;
    }, { message: 'Price must be greater than 0 and up to 10,000,000' }),
  isNegotiable: z.boolean().optional().default(false),
  category: z.nativeEnum(MarketplaceCategory, {
    errorMap: () => ({ message: 'Invalid marketplace category' }),
  }),
  condition: z.nativeEnum(MarketplaceItemCondition, {
    errorMap: () => ({ message: 'Invalid item condition' }),
  }),
  images: z
    .array(z.string().url({ message: 'Image must be a valid URL' }))
    .max(5, { message: 'Maximum 5 images allowed' })
    .optional()
    .default([]),
  locationNote: z
    .string()
    .max(100, { message: 'Location note cannot exceed 100 characters' })
    .trim()
    .optional(),
  contactPhone: z
    .string()
    .regex(/^[6-9]\d{9}$/, { message: 'Invalid 10-digit Indian phone number' })
    .optional(),
});

export const UpdateMarketplaceListingSchema = z.object({
  title: z
    .string()
    .min(3, { message: 'Title must be at least 3 characters' })
    .max(255, { message: 'Title cannot exceed 255 characters' })
    .trim()
    .optional(),
  description: z
    .string()
    .min(5, { message: 'Description must be at least 5 characters' })
    .max(2000, { message: 'Description cannot exceed 2000 characters' })
    .trim()
    .optional(),
  price: z
    .union([z.number(), z.string()])
    .refine((val) => {
      const num = typeof val === 'string' ? parseFloat(val) : val;
      return !isNaN(num) && num > 0 && num <= 10000000;
    }, { message: 'Price must be greater than 0 and up to 10,000,000' })
    .optional(),
  isNegotiable: z.boolean().optional(),
  category: z.nativeEnum(MarketplaceCategory, {
    errorMap: () => ({ message: 'Invalid marketplace category' }),
  }).optional(),
  condition: z.nativeEnum(MarketplaceItemCondition, {
    errorMap: () => ({ message: 'Invalid item condition' }),
  }).optional(),
  images: z
    .array(z.string().url({ message: 'Image must be a valid URL' }))
    .max(5, { message: 'Maximum 5 images allowed' })
    .optional(),
  locationNote: z
    .string()
    .max(100, { message: 'Location note cannot exceed 100 characters' })
    .trim()
    .optional(),
  contactPhone: z
    .string()
    .regex(/^[6-9]\d{9}$/, { message: 'Invalid 10-digit Indian phone number' })
    .optional(),
});

export const UpdateMarketplaceStatusSchema = z.object({
  status: z.enum([
    MarketplaceListingStatus.ACTIVE,
    MarketplaceListingStatus.RESERVED,
    MarketplaceListingStatus.SOLD,
  ], {
    errorMap: () => ({ message: 'Status must be ACTIVE, RESERVED, or SOLD' }),
  }),
});

export const MarketplaceListingQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    propertyId: z.string().uuid().optional(),
    category: z.nativeEnum(MarketplaceCategory).optional(),
    condition: z.nativeEnum(MarketplaceItemCondition).optional(),
    status: z.nativeEnum(MarketplaceListingStatus).optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    isNegotiable: z
      .preprocess((val) => {
        if (val === 'true' || val === true) return true;
        if (val === 'false' || val === false) return false;
        return val;
      }, z.boolean())
      .optional(),
    search: z.string().max(100).trim().optional(),
    sellerId: z.string().uuid().optional(),
    sortBy: z.nativeEnum(MarketplaceSortBy).optional().default(MarketplaceSortBy.NEWEST),
  })
  .refine(
    (data) => {
      if (data.minPrice !== undefined && data.maxPrice !== undefined) {
        return data.minPrice <= data.maxPrice;
      }
      return true;
    },
    {
      message: 'minPrice cannot be greater than maxPrice',
      path: ['minPrice'],
    }
  );

export type CreateMarketplaceListingInput = z.infer<typeof CreateMarketplaceListingSchema>;
export type UpdateMarketplaceListingInput = z.infer<typeof UpdateMarketplaceListingSchema>;
export type UpdateMarketplaceStatusInput = z.infer<typeof UpdateMarketplaceStatusSchema>;
export type MarketplaceListingQueryInput = z.infer<typeof MarketplaceListingQuerySchema>;
