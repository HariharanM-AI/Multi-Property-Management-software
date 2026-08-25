import { NotificationType } from './domain.js';

export { NotificationType };

/**
 * Public Data Transfer Object representing an In-App Notification.
 */
export interface NotificationDto {
  id: string;
  organizationId: string;
  userId: string;
  propertyId: string | null;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  metadata: Record<string, unknown> | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
  property?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

/**
 * Input DTO for dispatching/creating a new in-app notification.
 */
export interface CreateNotificationInput {
  userId: string;
  propertyId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Query filter parameters for listing notifications.
 */
export interface NotificationListQuery {
  page?: number;
  limit?: number;
  isRead?: boolean;
  type?: NotificationType;
  propertyId?: string;
  search?: string;
}

/**
 * Fast response DTO for unread notification count.
 */
export interface NotificationUnreadCountDto {
  unreadCount: number;
}

/**
 * Response DTO for bulk mark-all-read operations.
 */
export interface MarkNotificationsReadDto {
  success: boolean;
  count: number;
  markedAt: string;
}
