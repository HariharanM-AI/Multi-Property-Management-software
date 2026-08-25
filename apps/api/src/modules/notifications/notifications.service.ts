import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '@prisma/client';
import {
  NotificationType,
  NotificationDto,
  CreateNotificationInput,
  NotificationListQuery,
  NotificationUnreadCountDto,
  MarkNotificationsReadDto,
} from '@propertyos/types';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to format Prisma Notification model into NotificationDto
   */
  private formatNotification(notification: any): NotificationDto {
    return {
      id: notification.id,
      organizationId: notification.organizationId,
      userId: notification.userId,
      propertyId: notification.propertyId ?? null,
      type: notification.type as NotificationType,
      title: notification.title,
      message: notification.message,
      link: notification.link ?? null,
      metadata: (notification.metadata as Record<string, unknown>) ?? null,
      isRead: notification.isRead,
      readAt: notification.readAt ? notification.readAt.toISOString() : null,
      createdAt: notification.createdAt.toISOString(),
      updatedAt: notification.updatedAt.toISOString(),
      property: notification.property
        ? {
            id: notification.property.id,
            name: notification.property.name,
            code: notification.property.code,
          }
        : null,
    };
  }

  /**
   * Dispatches/creates a single in-app notification.
   */
  async createNotification(
    organizationId: string,
    input: CreateNotificationInput,
    dispatchedByUserId?: string,
    prismaTx?: Prisma.TransactionClient
  ): Promise<NotificationDto> {
    const client = prismaTx || this.prisma;

    // Validate recipient user exists within organization
    const recipientUser = await client.user.findFirst({
      where: {
        id: input.userId,
        organizationId,
      },
      select: { id: true },
    });

    if (!recipientUser) {
      throw new NotFoundException('Recipient user not found in organization');
    }

    // Validate property if provided
    if (input.propertyId) {
      const property = await client.property.findFirst({
        where: {
          id: input.propertyId,
          organizationId,
        },
        select: { id: true },
      });

      if (!property) {
        throw new NotFoundException('Associated property not found in organization');
      }
    }

    // Sanitize metadata to ensure no sensitive credentials exist
    let sanitizedMetadata: Record<string, unknown> | null = null;
    if (input.metadata && typeof input.metadata === 'object') {
      sanitizedMetadata = { ...input.metadata };
      delete (sanitizedMetadata as any).password;
      delete (sanitizedMetadata as any).passwordHash;
      delete (sanitizedMetadata as any).token;
      delete (sanitizedMetadata as any).refreshToken;
      delete (sanitizedMetadata as any).accessToken;
      delete (sanitizedMetadata as any).secret;
    }

    const created = await client.notification.create({
      data: {
        organizationId,
        userId: input.userId,
        propertyId: input.propertyId || null,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link || null,
        metadata: sanitizedMetadata ? (sanitizedMetadata as Prisma.InputJsonValue) : Prisma.JsonNull,
        isRead: false,
      },
      include: {
        property: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    // Write AuditLog entry
    await client.auditLog.create({
      data: {
        organizationId,
        userId: dispatchedByUserId || input.userId,
        action: 'NOTIFICATION_DISPATCHED',
        resourceType: 'NOTIFICATION',
        resourceId: created.id,
        metadata: {
          recipientUserId: input.userId,
          notificationType: input.type,
          title: input.title,
          propertyId: input.propertyId || null,
        },
      },
    });

    return this.formatNotification(created);
  }

  /**
   * Helper to dispatch multiple notifications transactionally.
   */
  async createManyNotifications(
    organizationId: string,
    inputs: CreateNotificationInput[],
    dispatchedByUserId?: string,
    prismaTx?: Prisma.TransactionClient
  ): Promise<number> {
    const client = prismaTx || this.prisma;
    let count = 0;

    for (const input of inputs) {
      await this.createNotification(organizationId, input, dispatchedByUserId, client);
      count++;
    }

    return count;
  }

  /**
   * Lists notifications for a specific user, strictly scoped to their organizationId and userId.
   */
  async getNotifications(
    organizationId: string,
    userId: string,
    query: NotificationListQuery = {}
  ): Promise<{
    data: NotificationDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = {
      organizationId,
      userId,
    };

    if (query.isRead !== undefined) {
      where.isRead = query.isRead;
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.propertyId) {
      where.propertyId = query.propertyId;
    }

    if (query.search && query.search.trim().length > 0) {
      const search = query.search.trim();
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { message: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, notifications] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          property: {
            select: { id: true, name: true, code: true },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: notifications.map((n) => this.formatNotification(n)),
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Retrieves a single notification by ID, scoped to organizationId and userId.
   */
  async getNotificationById(
    organizationId: string,
    userId: string,
    id: string
  ): Promise<NotificationDto> {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id,
        organizationId,
        userId,
      },
      include: {
        property: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.formatNotification(notification);
  }

  /**
   * Fast unread notification counter for the caller.
   */
  async getUnreadCount(
    organizationId: string,
    userId: string
  ): Promise<NotificationUnreadCountDto> {
    const unreadCount = await this.prisma.notification.count({
      where: {
        organizationId,
        userId,
        isRead: false,
      },
    });

    return { unreadCount };
  }

  /**
   * Marks a single notification as read for the authenticated caller.
   */
  async markAsRead(
    organizationId: string,
    userId: string,
    id: string
  ): Promise<NotificationDto> {
    const existing = await this.prisma.notification.findFirst({
      where: {
        id,
        organizationId,
        userId,
      },
    });

    if (!existing) {
      throw new NotFoundException('Notification not found');
    }

    if (existing.isRead) {
      // Already read, return formatted existing
      return this.getNotificationById(organizationId, userId, id);
    }

    const updated = await this.prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
      include: {
        property: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    return this.formatNotification(updated);
  }

  /**
   * Bulk marks all unread notifications as read for the authenticated caller in a single atomic query.
   */
  async markAllAsRead(
    organizationId: string,
    userId: string
  ): Promise<MarkNotificationsReadDto> {
    const result = await this.prisma.notification.updateMany({
      where: {
        organizationId,
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return {
      success: true,
      count: result.count,
      markedAt: new Date().toISOString(),
    };
  }

  /**
   * Deletes / dismisses a notification belonging to the caller.
   */
  async deleteNotification(
    organizationId: string,
    userId: string,
    id: string
  ): Promise<{ success: boolean }> {
    const existing = await this.prisma.notification.findFirst({
      where: {
        id,
        organizationId,
        userId,
      },
    });

    if (!existing) {
      throw new NotFoundException('Notification not found');
    }

    await this.prisma.notification.delete({
      where: { id },
    });

    // Write AuditLog entry
    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action: 'NOTIFICATION_DELETED',
        resourceType: 'NOTIFICATION',
        resourceId: id,
        metadata: {
          notificationType: existing.type,
          title: existing.title,
        },
      },
    });

    return { success: true };
  }
}
