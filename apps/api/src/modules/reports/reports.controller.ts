import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
  Req,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ReportsService } from './reports.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantOrgGuard } from '../../common/guards/tenant-org.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser, Permission } from '@propertyos/types';
import {
  reportFilterSchema,
  reportExportSchema,
  ReportFilterInput,
  ReportExportInput,
} from '@propertyos/validation';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

@Controller('reports')
@UseGuards(AuthGuard, TenantOrgGuard, PermissionsGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * 1. Profit & Loss Statement (P&L) with revenue, expense & monthly trends
   */
  @Get('pnl')
  @RequirePermissions(Permission.REPORTS_READ)
  async getPnlStatement(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(reportFilterSchema)) query: ReportFilterInput
  ) {
    const data = await this.reportsService.getPnlStatement(user.organizationId, query);
    return {
      success: true,
      data,
    };
  }

  /**
   * 2. Occupancy & Capacity Analytics across PG & Rental properties
   */
  @Get('occupancy')
  @RequirePermissions(Permission.REPORTS_READ)
  async getOccupancyReport(
    @CurrentUser() user: AuthenticatedUser,
    @Query('propertyId') propertyId?: string
  ) {
    const data = await this.reportsService.getOccupancyReport(user.organizationId, propertyId);
    return {
      success: true,
      data,
    };
  }

  /**
   * 3. Multi-Property Comparative Performance Report
   */
  @Get('property-comparison')
  @RequirePermissions(Permission.REPORTS_READ)
  async getPropertyComparison(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(reportFilterSchema)) query: ReportFilterInput
  ) {
    const data = await this.reportsService.getPropertyComparison(user.organizationId, query);
    return {
      success: true,
      data,
    };
  }

  /**
   * 4. Realized Cash Flow Statement
   */
  @Get('cash-flow')
  @RequirePermissions(Permission.REPORTS_READ)
  async getCashFlowReport(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(reportFilterSchema)) query: ReportFilterInput
  ) {
    const data = await this.reportsService.getCashFlowReport(user.organizationId, query);
    return {
      success: true,
      data,
    };
  }

  /**
   * 5. Downloadable RFC 4180-compliant CSV Report Export
   */
  @Get('export')
  @RequirePermissions(Permission.REPORTS_READ)
  async exportReport(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(reportExportSchema)) query: ReportExportInput,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const { csvContent, filename } = await this.reportsService.exportReportCsv(
      user.organizationId,
      query,
      user.id,
      ipAddress,
      userAgent
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  }
}
