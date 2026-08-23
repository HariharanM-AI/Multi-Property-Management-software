import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { BillingService } from './billing.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantOrgGuard } from '../../common/guards/tenant-org.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Permission } from '@propertyos/types';
import {
  CreateBillingChargeSchema,
  CreateBillingChargeInput,
  UpdateBillingChargeSchema,
  UpdateBillingChargeInput,
  CreateBillingScheduleSchema,
  CreateBillingScheduleInput,
  UpdateBillingScheduleSchema,
  UpdateBillingScheduleInput,
  BillingFilterSchema,
  BillingFilterInput,
} from '@propertyos/validation';

@Controller('')
@UseGuards(AuthGuard, TenantOrgGuard, PermissionsGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  // ----------------------------------------------------------------------------
  // CHARGES
  // ----------------------------------------------------------------------------

  @Post('billing/charges')
  @RequirePermissions(Permission.BILLING_CREATE)
  async createCharge(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(CreateBillingChargeSchema))
    dto: CreateBillingChargeInput
  ) {
    return this.billingService.createCharge(orgId, dto, userId);
  }

  @Get('billing/charges')
  @RequirePermissions(Permission.BILLING_READ)
  async listCharges(
    @CurrentUser('organizationId') orgId: string,
    @Query('activeOnly') activeOnly?: string
  ) {
    return this.billingService.listCharges(orgId, activeOnly === 'true');
  }

  @Get('billing/charges/:id')
  @RequirePermissions(Permission.BILLING_READ)
  async getCharge(
    @CurrentUser('organizationId') orgId: string,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.billingService.getCharge(orgId, id);
  }

  @Patch('billing/charges/:id')
  @RequirePermissions(Permission.BILLING_UPDATE)
  async updateCharge(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateBillingChargeSchema))
    dto: UpdateBillingChargeInput
  ) {
    return this.billingService.updateCharge(orgId, id, dto, userId);
  }

  @Post('billing/charges/:id/archive')
  @RequirePermissions(Permission.BILLING_UPDATE)
  async archiveCharge(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.billingService.archiveCharge(orgId, id, userId);
  }

  // ----------------------------------------------------------------------------
  // SCHEDULES
  // ----------------------------------------------------------------------------

  @Post('billing/schedules')
  @RequirePermissions(Permission.BILLING_CREATE)
  async createBillingSchedule(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(CreateBillingScheduleSchema))
    dto: CreateBillingScheduleInput
  ) {
    return this.billingService.createBillingSchedule(orgId, dto, userId);
  }

  @Get('billing/schedules')
  @RequirePermissions(Permission.BILLING_READ)
  async listBillingSchedules(
    @CurrentUser('organizationId') orgId: string,
    @Query(new ZodValidationPipe(BillingFilterSchema)) filters: BillingFilterInput
  ) {
    return this.billingService.listBillingSchedules(orgId, filters);
  }

  @Patch('billing/schedules/:id')
  @RequirePermissions(Permission.BILLING_UPDATE)
  async updateBillingSchedule(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateBillingScheduleSchema))
    dto: UpdateBillingScheduleInput
  ) {
    return this.billingService.updateBillingSchedule(orgId, id, dto, userId);
  }

  @Post('billing/schedules/:id/pause')
  @RequirePermissions(Permission.BILLING_UPDATE)
  async pauseBillingSchedule(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.billingService.pauseBillingSchedule(orgId, id, userId);
  }

  @Post('billing/schedules/:id/resume')
  @RequirePermissions(Permission.BILLING_UPDATE)
  async resumeBillingSchedule(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.billingService.resumeBillingSchedule(orgId, id, userId);
  }

  @Post('billing/generate-due')
  @RequirePermissions(Permission.BILLING_CREATE)
  async generateDueInvoices(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Body('asOfDate') asOfDate?: string
  ) {
    return this.billingService.generateDueInvoices(orgId, asOfDate, userId);
  }

  // ----------------------------------------------------------------------------
  // FINANCIAL SUMMARIES
  // ----------------------------------------------------------------------------

  @Get('financials/tenant/:tenantId')
  @RequirePermissions(Permission.BILLING_READ)
  async getTenantFinancialSummary(
    @CurrentUser('organizationId') orgId: string,
    @Param('tenantId', ParseUUIDPipe) tenantId: string
  ) {
    return this.billingService.getTenantFinancialSummary(orgId, tenantId);
  }

  @Get('financials/property/:propertyId')
  @RequirePermissions(Permission.BILLING_READ)
  async getPropertyFinancialSummary(
    @CurrentUser('organizationId') orgId: string,
    @Param('propertyId', ParseUUIDPipe) propertyId: string
  ) {
    return this.billingService.getPropertyFinancialSummary(orgId, propertyId);
  }

  @Get('financials/organization')
  @RequirePermissions(Permission.BILLING_READ)
  async getOrganizationFinancialSummary(
    @CurrentUser('organizationId') orgId: string
  ) {
    return this.billingService.getOrganizationFinancialSummary(orgId);
  }
}
