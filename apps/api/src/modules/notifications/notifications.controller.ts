import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantOrgGuard } from '../../common/guards/tenant-org.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission, AuthenticatedUser } from '@propertyos/types';
import {
  createNotificationSchema,
  notificationListQuerySchema,
} from '@propertyos/validation';

@Controller('notifications')
@UseGuards(AuthGuard, TenantOrgGuard, PermissionsGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * List notifications for the authenticated user (scoped strictly to organization and user).
   */
  @Get()
  @RequirePermissions(Permission.NOTIFICATION_READ)
  async getNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: any
  ) {
    const parseResult = notificationListQuerySchema.safeParse(query);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    return this.notificationsService.getNotifications(
      user.organizationId,
      user.id,
      parseResult.data
    );
  }

  /**
   * Fast unread notification counter for the caller.
   */
  @Get('unread-count')
  @RequirePermissions(Permission.NOTIFICATION_READ)
  async getUnreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.getUnreadCount(
      user.organizationId,
      user.id
    );
  }

  /**
   * Retrieves a single notification by ID (fail-closed if foreign).
   */
  @Get(':id')
  @RequirePermissions(Permission.NOTIFICATION_READ)
  async getNotificationById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    return this.notificationsService.getNotificationById(
      user.organizationId,
      user.id,
      id
    );
  }

  /**
   * Marks a single notification as read.
   */
  @Patch(':id/read')
  @RequirePermissions(Permission.NOTIFICATION_UPDATE)
  async markAsRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    return this.notificationsService.markAsRead(
      user.organizationId,
      user.id,
      id
    );
  }

  /**
   * Atomically marks all unread notifications as read for the authenticated caller.
   */
  @Post('mark-all-read')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.NOTIFICATION_UPDATE)
  async markAllAsRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllAsRead(
      user.organizationId,
      user.id
    );
  }

  /**
   * Administratively dispatches a new notification to a user within the caller's organization.
   */
  @Post()
  @RequirePermissions(Permission.NOTIFICATION_CREATE)
  async createNotification(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: any
  ) {
    const parseResult = createNotificationSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    return this.notificationsService.createNotification(
      user.organizationId,
      parseResult.data,
      user.id
    );
  }

  /**
   * Deletes / dismisses a notification belonging to the caller.
   */
  @Delete(':id')
  @RequirePermissions(Permission.NOTIFICATION_DELETE)
  async deleteNotification(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    return this.notificationsService.deleteNotification(
      user.organizationId,
      user.id,
      id
    );
  }
}
