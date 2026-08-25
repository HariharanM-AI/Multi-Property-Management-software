import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../database/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { NotificationType } from '@propertyos/types';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: any;

  const mockOrgId = 'org-111-uuid';
  const mockUserId = 'user-111-uuid';
  const mockOtherUserId = 'user-222-uuid';
  const mockOtherOrgId = 'org-999-uuid';
  const mockNotificationId = 'notif-111-uuid';
  const mockPropertyId = 'prop-111-uuid';

  const mockNotificationData = {
    id: mockNotificationId,
    organizationId: mockOrgId,
    userId: mockUserId,
    propertyId: mockPropertyId,
    type: NotificationType.RENT_DUE,
    title: 'Rent Due for August',
    message: 'Your rent of ₹15,000 is due on 05-Aug-2026.',
    link: '/invoices/inv-123',
    metadata: { invoiceId: 'inv-123', amount: '15000.00' },
    isRead: false,
    readAt: null,
    createdAt: new Date('2026-08-01T10:00:00Z'),
    updatedAt: new Date('2026-08-01T10:00:00Z'),
    property: {
      id: mockPropertyId,
      name: 'Sunrise PG',
      code: 'PROP-001',
    },
  };

  beforeEach(async () => {
    prisma = {
      notification: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
      },
      property: {
        findFirst: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('getNotifications', () => {
    it('should list notifications strictly scoped to caller organizationId and userId', async () => {
      prisma.notification.count.mockResolvedValue(1);
      prisma.notification.findMany.mockResolvedValue([mockNotificationData]);

      const result = await service.getNotifications(mockOrgId, mockUserId, {
        page: 1,
        limit: 10,
      });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: mockOrgId,
            userId: mockUserId,
          }),
          skip: 0,
          take: 10,
          orderBy: { createdAt: 'desc' },
        })
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(mockNotificationId);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by isRead, type, propertyId and search', async () => {
      prisma.notification.count.mockResolvedValue(1);
      prisma.notification.findMany.mockResolvedValue([mockNotificationData]);

      await service.getNotifications(mockOrgId, mockUserId, {
        isRead: false,
        type: NotificationType.RENT_DUE,
        propertyId: mockPropertyId,
        search: 'Rent',
      });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: mockOrgId,
            userId: mockUserId,
            isRead: false,
            type: NotificationType.RENT_DUE,
            propertyId: mockPropertyId,
            OR: [
              { title: { contains: 'Rent', mode: 'insensitive' } },
              { message: { contains: 'Rent', mode: 'insensitive' } },
            ],
          }),
        })
      );
    });
  });

  describe('getNotificationById', () => {
    it('should retrieve a single notification by id', async () => {
      prisma.notification.findFirst.mockResolvedValue(mockNotificationData);

      const result = await service.getNotificationById(mockOrgId, mockUserId, mockNotificationId);
      expect(result.id).toBe(mockNotificationId);
      expect(result.type).toBe(NotificationType.RENT_DUE);
    });

    it('should throw NotFoundException if notification belongs to another user or org', async () => {
      prisma.notification.findFirst.mockResolvedValue(null);

      await expect(
        service.getNotificationById(mockOrgId, mockOtherUserId, mockNotificationId)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUnreadCount', () => {
    it('should return exact unread count scoped to organization and user', async () => {
      prisma.notification.count.mockResolvedValue(4);

      const result = await service.getUnreadCount(mockOrgId, mockUserId);
      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: {
          organizationId: mockOrgId,
          userId: mockUserId,
          isRead: false,
        },
      });
      expect(result.unreadCount).toBe(4);
    });
  });

  describe('markAsRead', () => {
    it('should mark single unread notification as read', async () => {
      prisma.notification.findFirst.mockResolvedValue(mockNotificationData);
      prisma.notification.update.mockResolvedValue({
        ...mockNotificationData,
        isRead: true,
        readAt: new Date('2026-08-25T12:00:00Z'),
      });

      const result = await service.markAsRead(mockOrgId, mockUserId, mockNotificationId);
      expect(prisma.notification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockNotificationId },
          data: expect.objectContaining({
            isRead: true,
          }),
        })
      );
      expect(result.isRead).toBe(true);
    });

    it('should behave idempotently if already read', async () => {
      prisma.notification.findFirst.mockResolvedValue({
        ...mockNotificationData,
        isRead: true,
        readAt: new Date('2026-08-20T10:00:00Z'),
      });

      const result = await service.markAsRead(mockOrgId, mockUserId, mockNotificationId);
      expect(prisma.notification.update).not.toHaveBeenCalled();
      expect(result.isRead).toBe(true);
    });

    it('should fail-closed with 404 if notification not found or belongs to another user', async () => {
      prisma.notification.findFirst.mockResolvedValue(null);

      await expect(
        service.markAsRead(mockOrgId, mockOtherUserId, mockNotificationId)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAllAsRead', () => {
    it('should execute single atomic update for all unread items', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.markAllAsRead(mockOrgId, mockUserId);
      expect(prisma.notification.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: mockOrgId,
            userId: mockUserId,
            isRead: false,
          },
          data: expect.objectContaining({
            isRead: true,
          }),
        })
      );
      expect(result.success).toBe(true);
      expect(result.count).toBe(5);
    });
  });

  describe('createNotification', () => {
    it('should create notification and record audit log when recipient is valid', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: mockUserId });
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId });
      prisma.notification.create.mockResolvedValue(mockNotificationData);

      const result = await service.createNotification(mockOrgId, {
        userId: mockUserId,
        propertyId: mockPropertyId,
        type: NotificationType.RENT_DUE,
        title: 'Rent Due for August',
        message: 'Your rent of ₹15,000 is due on 05-Aug-2026.',
        link: '/invoices/inv-123',
        metadata: { invoiceId: 'inv-123', secret: 'hide-me' },
      });

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: mockUserId, organizationId: mockOrgId },
        select: { id: true },
      });
      expect(prisma.property.findFirst).toHaveBeenCalledWith({
        where: { id: mockPropertyId, organizationId: mockOrgId },
        select: { id: true },
      });
      expect(prisma.notification.create).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'NOTIFICATION_DISPATCHED',
            organizationId: mockOrgId,
            resourceId: mockNotificationId,
          }),
        })
      );
      expect(result.id).toBe(mockNotificationId);
    });

    it('should throw NotFoundException if recipient user is not found in organization', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.createNotification(mockOrgId, {
          userId: 'non-existent-user',
          type: NotificationType.GENERAL,
          title: 'Welcome',
          message: 'Welcome to PropertyOS',
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if propertyId does not belong to organization', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: mockUserId });
      prisma.property.findFirst.mockResolvedValue(null);

      await expect(
        service.createNotification(mockOrgId, {
          userId: mockUserId,
          propertyId: 'foreign-prop-id',
          type: NotificationType.MAINTENANCE_UPDATED,
          title: 'Ticket #101',
          message: 'Technician assigned',
        })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification and record audit log', async () => {
      prisma.notification.findFirst.mockResolvedValue(mockNotificationData);
      prisma.notification.delete.mockResolvedValue(mockNotificationData);

      const result = await service.deleteNotification(mockOrgId, mockUserId, mockNotificationId);
      expect(prisma.notification.delete).toHaveBeenCalledWith({
        where: { id: mockNotificationId },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'NOTIFICATION_DELETED',
            resourceId: mockNotificationId,
          }),
        })
      );
      expect(result.success).toBe(true);
    });

    it('should throw NotFoundException if trying to delete foreign notification', async () => {
      prisma.notification.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteNotification(mockOrgId, mockOtherUserId, mockNotificationId)
      ).rejects.toThrow(NotFoundException);
    });
  });
});
