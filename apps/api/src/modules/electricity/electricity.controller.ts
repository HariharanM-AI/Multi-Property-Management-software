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
import { ElectricityService } from './electricity.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantOrgGuard } from '../../common/guards/tenant-org.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  Permission,
  UserRole,
  MeterStatus,
  ElectricityChargeStatus,
  CreateElectricityMeterDto,
  UpdateElectricityMeterDto,
  RecordElectricityReadingDto,
  CreateElectricityRateDto,
  GenerateElectricityChargesDto,
} from '@propertyos/types';
import {
  CreateElectricityMeterSchema,
  UpdateElectricityMeterSchema,
  RecordElectricityReadingSchema,
  CreateElectricityRateSchema,
  GenerateElectricityChargesSchema,
} from '@propertyos/validation';

@Controller('')
@UseGuards(AuthGuard, TenantOrgGuard, PermissionsGuard)
export class ElectricityController {
  constructor(private readonly electricityService: ElectricityService) {}

  // ----------------------------------------------------------------------------
  // METERS
  // ----------------------------------------------------------------------------

  @Post('properties/:propertyId/electricity/meters')
  @RequirePermissions(Permission.ELECTRICITY_CREATE)
  async createMeter(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body(new ZodValidationPipe(CreateElectricityMeterSchema))
    dto: CreateElectricityMeterDto
  ) {
    return this.electricityService.createMeter(orgId, propertyId, dto, userId);
  }

  @Get('properties/:propertyId/electricity/meters')
  @RequirePermissions(Permission.ELECTRICITY_READ)
  async getMeters(
    @CurrentUser('organizationId') orgId: string,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query('roomId') roomId?: string,
    @Query('status') status?: MeterStatus
  ) {
    return this.electricityService.getMeters(orgId, propertyId, roomId, status);
  }

  @Get('properties/:propertyId/electricity/meters/:meterId')
  @RequirePermissions(Permission.ELECTRICITY_READ)
  async getMeterById(
    @CurrentUser('organizationId') orgId: string,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('meterId', ParseUUIDPipe) meterId: string
  ) {
    return this.electricityService.getMeterById(orgId, propertyId, meterId);
  }

  @Patch('properties/:propertyId/electricity/meters/:meterId')
  @RequirePermissions(Permission.ELECTRICITY_UPDATE)
  async updateMeter(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('meterId', ParseUUIDPipe) meterId: string,
    @Body(new ZodValidationPipe(UpdateElectricityMeterSchema))
    dto: UpdateElectricityMeterDto
  ) {
    return this.electricityService.updateMeter(orgId, propertyId, meterId, dto, userId);
  }

  // ----------------------------------------------------------------------------
  // READINGS
  // ----------------------------------------------------------------------------

  @Post('properties/:propertyId/electricity/readings')
  @RequirePermissions(Permission.ELECTRICITY_CREATE)
  async recordReading(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') userRoles: UserRole[],
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body(new ZodValidationPipe(RecordElectricityReadingSchema))
    dto: RecordElectricityReadingDto
  ) {
    return this.electricityService.recordReading(orgId, propertyId, dto, userId, userRoles);
  }

  @Get('properties/:propertyId/electricity/readings')
  @RequirePermissions(Permission.ELECTRICITY_READ)
  async getReadings(
    @CurrentUser('organizationId') orgId: string,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query('meterId') meterId?: string
  ) {
    return this.electricityService.getReadings(orgId, propertyId, meterId);
  }

  // ----------------------------------------------------------------------------
  // RATES
  // ----------------------------------------------------------------------------

  @Post('properties/:propertyId/electricity/rates')
  @RequirePermissions(Permission.ELECTRICITY_CREATE)
  async createRate(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body(new ZodValidationPipe(CreateElectricityRateSchema))
    dto: CreateElectricityRateDto
  ) {
    return this.electricityService.createRate(orgId, propertyId, dto, userId);
  }

  @Patch('properties/:propertyId/electricity/rates/:rateId/deactivate')
  @RequirePermissions(Permission.ELECTRICITY_UPDATE)
  async deactivateRate(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('rateId', ParseUUIDPipe) rateId: string
  ) {
    return this.electricityService.deactivateRate(orgId, propertyId, rateId, userId);
  }

  @Get('properties/:propertyId/electricity/rates')
  @RequirePermissions(Permission.ELECTRICITY_READ)
  async getRates(
    @CurrentUser('organizationId') orgId: string,
    @Param('propertyId', ParseUUIDPipe) propertyId: string
  ) {
    return this.electricityService.getRates(orgId, propertyId);
  }

  // ----------------------------------------------------------------------------
  // CHARGES
  // ----------------------------------------------------------------------------

  @Post('properties/:propertyId/electricity/charges/generate')
  @RequirePermissions(Permission.ELECTRICITY_FINALIZE)
  async generateCharges(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body(new ZodValidationPipe(GenerateElectricityChargesSchema))
    dto: GenerateElectricityChargesDto
  ) {
    return this.electricityService.generateCharges(orgId, propertyId, dto, userId);
  }

  @Get('properties/:propertyId/electricity/charges')
  @RequirePermissions(Permission.ELECTRICITY_READ)
  async getCharges(
    @CurrentUser('organizationId') orgId: string,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query('tenantId') tenantId?: string,
    @Query('status') status?: ElectricityChargeStatus
  ) {
    return this.electricityService.getCharges(orgId, propertyId, tenantId, status);
  }

  // ----------------------------------------------------------------------------
  // SUMMARY & TENANT SPECIFIC
  // ----------------------------------------------------------------------------

  @Get('properties/:propertyId/electricity/summary')
  @RequirePermissions(Permission.ELECTRICITY_READ)
  async getSummary(
    @CurrentUser('organizationId') orgId: string,
    @Param('propertyId', ParseUUIDPipe) propertyId: string
  ) {
    return this.electricityService.getSummary(orgId, propertyId);
  }

  @Get('tenants/:tenantId/electricity/summary')
  @RequirePermissions(Permission.ELECTRICITY_READ)
  async getTenantElectricitySummary(
    @CurrentUser('organizationId') orgId: string,
    @Param('tenantId', ParseUUIDPipe) tenantId: string
  ) {
    return this.electricityService.getTenantElectricitySummary(orgId, tenantId);
  }
}
