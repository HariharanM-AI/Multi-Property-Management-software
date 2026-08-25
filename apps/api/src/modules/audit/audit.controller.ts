import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Res,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { AuditService } from './audit.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantOrgGuard } from '../../common/guards/tenant-org.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  AuditLogQuerySchema,
  AuditExportQuerySchema,
  AuditLogQueryInput,
  AuditExportQueryInput,
} from '@propertyos/validation';
import { AuthUser, Permission } from '@propertyos/types';

@Controller('audit')
@UseGuards(AuthGuard, TenantOrgGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * List and search audit logs with multi-tenant filtering and pagination
   */
  @Get('logs')
  @RequirePermissions(Permission.AUDIT_READ)
  async getAuditLogs(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(AuditLogQuerySchema)) query: AuditLogQueryInput,
  ) {
    return this.auditService.getAuditLogs(user.organizationId, user, query);
  }

  /**
   * Aggregate KPI summary and distributions for audit console
   */
  @Get('summary')
  @RequirePermissions(Permission.AUDIT_READ)
  async getAuditSummary(
    @CurrentUser() user: AuthUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.auditService.getAuditSummary(user.organizationId, user, { startDate, endDate });
  }

  /**
   * Export audit trail in CSV or JSON format with formula-injection protection
   */
  @Get('export')
  @RequirePermissions(Permission.AUDIT_EXPORT)
  async exportAuditLogs(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(AuditExportQuerySchema)) query: AuditExportQueryInput,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;

    const result = await this.auditService.exportAuditLogs(
      user.organizationId,
      user,
      query,
      ipAddress,
      userAgent,
    );

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.status(200).send(result.data);
  }

  /**
   * Get single audit log record by ID with sanitized metadata
   */
  @Get('logs/:id')
  @RequirePermissions(Permission.AUDIT_READ)
  async getAuditLogById(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.auditService.getAuditLogById(user.organizationId, user, id);
  }
}
