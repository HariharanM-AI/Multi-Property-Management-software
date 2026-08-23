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
import { MealsService } from './meals.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantOrgGuard } from '../../common/guards/tenant-org.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  Permission,
  MealPlanStatus,
  MealSubscriptionStatus,
  MealType,
  MealChargeStatus,
  CreateMealPlanDto,
  UpdateMealPlanDto,
  CreateMealSubscriptionDto,
  UpdateMealSubscriptionDto,
  RecordMealAttendanceDto,
  BulkRecordMealAttendanceDto,
  GenerateMealChargesDto,
} from '@propertyos/types';
import {
  CreateMealPlanSchema,
  UpdateMealPlanSchema,
  CreateMealSubscriptionSchema,
  UpdateMealSubscriptionSchema,
  RecordMealAttendanceSchema,
  BulkRecordMealAttendanceSchema,
  GenerateMealChargesSchema,
} from '@propertyos/validation';

@Controller('')
@UseGuards(AuthGuard, TenantOrgGuard, PermissionsGuard)
export class MealsController {
  constructor(private readonly mealsService: MealsService) {}

  // ----------------------------------------------------------------------------
  // MEAL PLANS
  // ----------------------------------------------------------------------------

  @Post('properties/:propertyId/meals/plans')
  @RequirePermissions(Permission.MEAL_CREATE)
  async createPlan(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body(new ZodValidationPipe(CreateMealPlanSchema))
    dto: CreateMealPlanDto
  ) {
    return this.mealsService.createPlan(orgId, propertyId, dto, userId);
  }

  @Get('properties/:propertyId/meals/plans')
  @RequirePermissions(Permission.MEAL_READ)
  async getPlans(
    @CurrentUser('organizationId') orgId: string,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query('status') status?: MealPlanStatus
  ) {
    return this.mealsService.getPlans(orgId, propertyId, status);
  }

  @Get('properties/:propertyId/meals/plans/:planId')
  @RequirePermissions(Permission.MEAL_READ)
  async getPlanById(
    @CurrentUser('organizationId') orgId: string,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('planId', ParseUUIDPipe) planId: string
  ) {
    return this.mealsService.getPlanById(orgId, propertyId, planId);
  }

  @Patch('properties/:propertyId/meals/plans/:planId')
  @RequirePermissions(Permission.MEAL_UPDATE)
  async updatePlan(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body(new ZodValidationPipe(UpdateMealPlanSchema))
    dto: UpdateMealPlanDto
  ) {
    return this.mealsService.updatePlan(orgId, propertyId, planId, dto, userId);
  }

  // ----------------------------------------------------------------------------
  // MEAL SUBSCRIPTIONS
  // ----------------------------------------------------------------------------

  @Post('properties/:propertyId/meals/subscriptions')
  @RequirePermissions(Permission.MEAL_MANAGE_SUBSCRIPTIONS)
  async createSubscription(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body(new ZodValidationPipe(CreateMealSubscriptionSchema))
    dto: CreateMealSubscriptionDto
  ) {
    return this.mealsService.createSubscription(orgId, propertyId, dto, userId);
  }

  @Get('properties/:propertyId/meals/subscriptions')
  @RequirePermissions(Permission.MEAL_READ)
  async getSubscriptions(
    @CurrentUser('organizationId') orgId: string,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query('tenantId') tenantId?: string,
    @Query('status') status?: MealSubscriptionStatus
  ) {
    return this.mealsService.getSubscriptions(orgId, propertyId, tenantId, status);
  }

  @Patch('properties/:propertyId/meals/subscriptions/:subscriptionId')
  @RequirePermissions(Permission.MEAL_MANAGE_SUBSCRIPTIONS)
  async updateSubscription(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('subscriptionId', ParseUUIDPipe) subscriptionId: string,
    @Body(new ZodValidationPipe(UpdateMealSubscriptionSchema))
    dto: UpdateMealSubscriptionDto
  ) {
    return this.mealsService.updateSubscription(orgId, propertyId, subscriptionId, dto, userId);
  }

  // ----------------------------------------------------------------------------
  // DAILY ATTENDANCE & MATRIX
  // ----------------------------------------------------------------------------

  @Post('properties/:propertyId/meals/records')
  @RequirePermissions(Permission.MEAL_RECORD)
  async recordAttendance(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body(new ZodValidationPipe(RecordMealAttendanceSchema))
    dto: RecordMealAttendanceDto
  ) {
    return this.mealsService.recordAttendance(orgId, propertyId, dto, userId);
  }

  @Post('properties/:propertyId/meals/records/bulk')
  @RequirePermissions(Permission.MEAL_RECORD)
  async bulkRecordAttendance(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body(new ZodValidationPipe(BulkRecordMealAttendanceSchema))
    dto: BulkRecordMealAttendanceDto
  ) {
    return this.mealsService.bulkRecordAttendance(orgId, propertyId, dto, userId);
  }

  @Get('properties/:propertyId/meals/matrix')
  @RequirePermissions(Permission.MEAL_READ)
  async getDailyMatrix(
    @CurrentUser('organizationId') orgId: string,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query('date') date: string,
    @Query('floorId') floorId?: string,
    @Query('roomId') roomId?: string
  ) {
    return this.mealsService.getDailyMatrix(orgId, propertyId, date || new Date().toISOString(), floorId, roomId);
  }

  @Get('properties/:propertyId/meals/records')
  @RequirePermissions(Permission.MEAL_READ)
  async getRecords(
    @CurrentUser('organizationId') orgId: string,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query('date') date?: string,
    @Query('mealType') mealType?: MealType,
    @Query('tenantId') tenantId?: string
  ) {
    return this.mealsService.getRecords(orgId, propertyId, date, mealType, tenantId);
  }

  // ----------------------------------------------------------------------------
  // MEAL CHARGES
  // ----------------------------------------------------------------------------

  @Post('properties/:propertyId/meals/charges/generate')
  @RequirePermissions(Permission.MEAL_FINALIZE)
  async generateCharges(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body(new ZodValidationPipe(GenerateMealChargesSchema))
    dto: GenerateMealChargesDto
  ) {
    return this.mealsService.generateCharges(orgId, propertyId, dto, userId);
  }

  @Get('properties/:propertyId/meals/charges')
  @RequirePermissions(Permission.MEAL_READ)
  async getCharges(
    @CurrentUser('organizationId') orgId: string,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query('tenantId') tenantId?: string,
    @Query('status') status?: MealChargeStatus
  ) {
    return this.mealsService.getCharges(orgId, propertyId, tenantId, status);
  }

  // ----------------------------------------------------------------------------
  // SUMMARY & TENANT SPECIFIC
  // ----------------------------------------------------------------------------

  @Get('properties/:propertyId/meals/summary')
  @RequirePermissions(Permission.MEAL_READ)
  async getSummary(
    @CurrentUser('organizationId') orgId: string,
    @Param('propertyId', ParseUUIDPipe) propertyId: string
  ) {
    return this.mealsService.getSummary(orgId, propertyId);
  }

  @Get('tenants/:tenantId/meals/summary')
  @RequirePermissions(Permission.MEAL_READ)
  async getTenantMealSummary(
    @CurrentUser('organizationId') orgId: string,
    @Param('tenantId', ParseUUIDPipe) tenantId: string
  ) {
    return this.mealsService.getTenantMealSummary(orgId, tenantId);
  }
}
