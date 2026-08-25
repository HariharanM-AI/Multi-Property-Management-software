import { z } from 'zod';
import { NotificationType } from '@propertyos/types';

// ==============================================================================
// CORE-023: In-App Notification Validation Schemas
// ==============================================================================

/**
 * Safe internal relative URL validator (must start with / and cannot contain javascript:, http://, https://, data:)
 */
const internalLinkSchema = z
  .string()
  .trim()
  .max(500, 'Link cannot exceed 500 characters')
  .regex(/^\/[a-zA-Z0-9_\-/.?=&%#]*$/, 'Link must be a safe internal relative path starting with /')
  .refine((val) => !val.startsWith('//') && !val.includes('\\'), {
    message: 'Link cannot be protocol-relative or contain backslashes',
  });

/**
 * Zod schema for creating/dispatching an in-app notification
 */
export const createNotificationSchema = z.object({
  userId: z.string().uuid('Recipient User ID must be a valid UUID'),
  propertyId: z.string().uuid('Property ID must be a valid UUID').nullable().optional(),
  type: z.nativeEnum(NotificationType, {
    errorMap: () => ({ message: 'Invalid notification type' }),
  }),
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(255, 'Title cannot exceed 255 characters'),
  message: z
    .string()
    .trim()
    .min(1, 'Message is required')
    .max(2000, 'Message cannot exceed 2000 characters'),
  link: internalLinkSchema.nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

export type CreateNotificationSchemaInput = z.infer<typeof createNotificationSchema>;

/**
 * Zod schema for querying / filtering notifications
 */
export const notificationListQuerySchema = z.object({
  page: z
    .preprocess((val) => (val !== undefined ? Number(val) : undefined), z.number().int().min(1).default(1))
    .optional(),
  limit: z
    .preprocess((val) => (val !== undefined ? Number(val) : undefined), z.number().int().min(1).max(100).default(20))
    .optional(),
  isRead: z
    .preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return undefined;
    }, z.boolean().optional())
    .optional(),
  type: z
    .nativeEnum(NotificationType, {
      errorMap: () => ({ message: 'Invalid notification type' }),
    })
    .optional(),
  propertyId: z.string().uuid('Property ID must be a valid UUID').optional(),
  search: z.string().trim().max(100, 'Search query cannot exceed 100 characters').optional(),
});

export type NotificationListQuerySchemaInput = z.infer<typeof notificationListQuerySchema>;
