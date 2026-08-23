import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { SecurityDepositsService } from './security-deposits.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantOrgGuard } from '../../common/guards/tenant-org.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Permission } from '@propertyos/types';
import {
  UpdateSecurityDepositSchema,
  UpdateSecurityDepositInput,
} from '@propertyos/validation';

@Controller('security-deposits')
@UseGuards(AuthGuard, TenantOrgGuard, PermissionsGuard)
export class SecurityDepositsController {
  constructor(
    private readonly securityDepositsService: SecurityDepositsService
  ) {}

  @Get()
  @RequirePermissions(Permission.SECURITY_DEPOSIT_READ)
  async listSecurityDeposits(
    @CurrentUser('organizationId') orgId: string,
    @Query('tenantId') tenantId?: string
  ) {
    return this.securityDepositsService.listSecurityDeposits(orgId, {
      tenantId,
    });
  }

  @Get('tenant/:tenantId')
  @RequirePermissions(Permission.SECURITY_DEPOSIT_READ)
  async getTenantDeposit(
    @CurrentUser('organizationId') orgId: string,
    @Param('tenantId', ParseUUIDPipe) tenantId: string
  ) {
    return this.securityDepositsService.getTenantDeposit(orgId, tenantId);
  }

  @Get(':id')
  @RequirePermissions(Permission.SECURITY_DEPOSIT_READ)
  async getSecurityDeposit(
    @CurrentUser('organizationId') orgId: string,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.securityDepositsService.getSecurityDeposit(orgId, id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.SECURITY_DEPOSIT_UPDATE)
  async updateDeposit(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateSecurityDepositSchema))
    dto: UpdateSecurityDepositInput
  ) {
    return this.securityDepositsService.updateDeposit(orgId, id, dto, userId);
  }
}
