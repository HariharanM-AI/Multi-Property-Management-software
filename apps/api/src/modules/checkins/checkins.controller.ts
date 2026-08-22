import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { CheckinsService } from './checkins.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantOrgGuard } from '../../common/guards/tenant-org.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission, CheckInStatus, AuthenticatedUser } from '@propertyos/types';
import {
  CreatePgCheckInSchema,
  CreateRentalCheckInSchema,
  CancelCheckInSchema,
} from '@propertyos/validation';

@Controller()
@UseGuards(AuthGuard, TenantOrgGuard, PermissionsGuard)
export class CheckinsController {
  constructor(private readonly checkinsService: CheckinsService) {}

  /**
   * Evaluates tenant onboarding readiness checklist
   */
  @Get('tenants/:tenantId/onboarding-status')
  @RequirePermissions(Permission.CHECKIN_READ)
  async getOnboardingStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tenantId') tenantId: string,
    @Query('propertyId') propertyId?: string
  ) {
    const status = await this.checkinsService.getOnboardingStatus(
      user.organizationId,
      tenantId,
      propertyId
    );

    return {
      success: true,
      data: status,
    };
  }

  /**
   * Lists check-ins for a tenant
   */
  @Get('tenants/:tenantId/check-ins')
  @RequirePermissions(Permission.CHECKIN_READ)
  async getTenantCheckIns(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tenantId') tenantId: string
  ) {
    const checkIns = await this.checkinsService.listCheckIns(user.organizationId, {
      tenantId,
    });

    return {
      success: true,
      data: checkIns,
    };
  }

  /**
   * Initiate a Check-In for a property (supports PG bed or Whole-Unit lease)
   */
  @Post('properties/:propertyId/check-ins')
  @RequirePermissions(Permission.CHECKIN_CREATE)
  async createCheckIn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Body() body: any
  ) {
    let result;

    if (body.bedId) {
      const parseResult = CreatePgCheckInSchema.safeParse(body);
      if (!parseResult.success) {
        throw new BadRequestException({
          message: 'Validation failed for PG check-in',
          errors: parseResult.error.errors,
        });
      }
      result = await this.checkinsService.createPgCheckIn(
        user.organizationId,
        propertyId,
        user.id,
        parseResult.data
      );
    } else if (body.leaseId) {
      const parseResult = CreateRentalCheckInSchema.safeParse(body);
      if (!parseResult.success) {
        throw new BadRequestException({
          message: 'Validation failed for whole-unit check-in',
          errors: parseResult.error.errors,
        });
      }
      result = await this.checkinsService.createRentalCheckIn(
        user.organizationId,
        propertyId,
        user.id,
        parseResult.data
      );
    } else {
      throw new BadRequestException(
        'Check-in request must include either bedId (for PG) or leaseId (for Whole-Unit)'
      );
    }

    return {
      success: true,
      data: result,
    };
  }

  /**
   * List check-in records for a property
   */
  @Get('properties/:propertyId/check-ins')
  @RequirePermissions(Permission.CHECKIN_READ)
  async listPropertyCheckIns(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Query('status') status?: CheckInStatus
  ) {
    const checkIns = await this.checkinsService.listCheckIns(user.organizationId, {
      propertyId,
      status,
    });

    return {
      success: true,
      data: checkIns,
    };
  }

  /**
   * List all check-ins across the organization with optional filtering
   */
  @Get('check-ins')
  @RequirePermissions(Permission.CHECKIN_READ)
  async listAllCheckIns(
    @CurrentUser() user: AuthenticatedUser,
    @Query('propertyId') propertyId?: string,
    @Query('tenantId') tenantId?: string,
    @Query('status') status?: CheckInStatus
  ) {
    const checkIns = await this.checkinsService.listCheckIns(user.organizationId, {
      propertyId,
      tenantId,
      status,
    });

    return {
      success: true,
      data: checkIns,
    };
  }

  /**
   * Get single check-in details by ID
   */
  @Get('check-ins/:checkInId')
  @RequirePermissions(Permission.CHECKIN_READ)
  async getCheckInById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('checkInId') checkInId: string
  ) {
    const checkIn = await this.checkinsService.getCheckInById(
      user.organizationId,
      checkInId
    );

    return {
      success: true,
      data: checkIn,
    };
  }

  /**
   * Transition Check-In from INITIATED -> READY
   */
  @Post('check-ins/:checkInId/ready')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.CHECKIN_CREATE)
  async markCheckInReady(
    @CurrentUser() user: AuthenticatedUser,
    @Param('checkInId') checkInId: string
  ) {
    const checkIn = await this.checkinsService.markCheckInReady(
      user.organizationId,
      checkInId,
      user.id
    );

    return {
      success: true,
      data: checkIn,
    };
  }

  /**
   * Complete and finalize Check-In: READY -> CHECKED_IN
   */
  @Post('check-ins/:checkInId/complete')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.CHECKIN_CREATE)
  async completeCheckIn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('checkInId') checkInId: string
  ) {
    const checkIn = await this.checkinsService.completeCheckIn(
      user.organizationId,
      checkInId,
      user.id
    );

    return {
      success: true,
      data: checkIn,
    };
  }

  /**
   * Cancel an active INITIATED or READY Check-In
   */
  @Post('check-ins/:checkInId/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.CHECKIN_CANCEL)
  async cancelCheckIn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('checkInId') checkInId: string,
    @Body() body: any
  ) {
    const parseResult = CancelCheckInSchema.safeParse(body || {});
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Validation failed for check-in cancellation',
        errors: parseResult.error.errors,
      });
    }

    const checkIn = await this.checkinsService.cancelCheckIn(
      user.organizationId,
      checkInId,
      user.id,
      parseResult.data
    );

    return {
      success: true,
      data: checkIn,
    };
  }
}
