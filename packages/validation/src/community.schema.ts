// ==============================================================================
// PropertyOS — Community & Notice Board Validation Schemas (CORE-025)
// ==============================================================================

import { z } from 'zod';
import { CommunityPostCategory } from '@propertyos/types';

export const CreateCommunityPostSchema = z.object({
  propertyId: z.string().uuid('Invalid property ID format'),
  title: z
    .string()
    .trim()
    .min(3, 'Post title must be at least 3 characters')
    .max(255, 'Post title cannot exceed 255 characters'),
  content: z
    .string()
    .trim()
    .min(5, 'Post content must be at least 5 characters')
    .max(5000, 'Post content cannot exceed 5000 characters'),
  category: z.nativeEnum(CommunityPostCategory).optional().default(CommunityPostCategory.GENERAL),
  isPinned: z.boolean().optional().default(false),
  images: z.array(z.string().trim().max(1000)).max(10, 'Cannot attach more than 10 images').optional().default([]),
});

export type CreateCommunityPostInput = z.infer<typeof CreateCommunityPostSchema>;

export const UpdateCommunityPostSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Post title must be at least 3 characters')
    .max(255, 'Post title cannot exceed 255 characters')
    .optional(),
  content: z
    .string()
    .trim()
    .min(5, 'Post content must be at least 5 characters')
    .max(5000, 'Post content cannot exceed 5000 characters')
    .optional(),
  category: z.nativeEnum(CommunityPostCategory).optional(),
  isPinned: z.boolean().optional(),
  images: z.array(z.string().trim().max(1000)).max(10, 'Cannot attach more than 10 images').optional(),
});

export type UpdateCommunityPostInput = z.infer<typeof UpdateCommunityPostSchema>;

export const TogglePinSchema = z.object({
  isPinned: z.boolean(),
});

export type TogglePinInput = z.infer<typeof TogglePinSchema>;

export const CreateCommunityCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Comment cannot be empty')
    .max(1000, 'Comment cannot exceed 1000 characters'),
});

export type CreateCommunityCommentInput = z.infer<typeof CreateCommunityCommentSchema>;

export const CommunityPostQuerySchema = z.object({
  propertyId: z.string().uuid('Invalid property ID').optional(),
  category: z.nativeEnum(CommunityPostCategory).optional(),
  isPinned: z
    .preprocess((val) => {
      if (typeof val === 'string') {
        if (val.toLowerCase() === 'true') return true;
        if (val.toLowerCase() === 'false') return false;
      }
      return val;
    }, z.boolean().optional())
    .optional(),
  search: z.string().trim().max(100).optional(),
  page: z
    .preprocess((val) => (val !== undefined && val !== null && val !== '' ? Number(val) : 1), z.number().int().min(1))
    .optional()
    .default(1),
  limit: z
    .preprocess((val) => (val !== undefined && val !== null && val !== '' ? Number(val) : 20), z.number().int().min(1).max(50))
    .optional()
    .default(20),
});

export type CommunityPostQueryInput = z.infer<typeof CommunityPostQuerySchema>;
