import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantOrgGuard } from '../../common/guards/tenant-org.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser, Permission } from '@propertyos/types';
import {
  dashboardFilterSchema,
  DashboardFilterSchemaInput,
} from '@propertyos/validation';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

@Controller('dashboard')
@UseGuards(AuthGuard, TenantOrgGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * 1. GET /api/v1/dashboard/summary
   * Portfolio Summary KPIs, Capacity, Monthly Financials, Property Cards, Action Items & Activity.
   */
  @Get('summary')
  @RequirePermissions(Permission.DASHBOARD_READ)
  async getPortfolioSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(dashboardFilterSchema)) query: DashboardFilterSchemaInput
  ) {
    const data = await this.dashboardService.getPortfolioSummary(user.organizationId, query);
    return {
      success: true,
      data,
    };
  }

  /**
   * 2. GET /api/v1/dashboard/action-items
   * Urgent operational triage: Overdue Invoices, Urgent Tickets, Upcoming Renewals.
   */
  @Get('action-items')
  @RequirePermissions(Permission.DASHBOARD_READ)
  async getActionItems(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.dashboardService.getActionItems(user.organizationId);
    return {
      success: true,
      data,
    };
  }

  /**
   * 3. GET /api/v1/dashboard/activity
   * Chronological activity stream of recent payments, tickets, and check-ins.
   */
  @Get('activity')
  @RequirePermissions(Permission.DASHBOARD_READ)
  async getRecentActivity(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.dashboardService.getRecentActivity(user.organizationId);
    return {
      success: true,
      data,
    };
  }
}
