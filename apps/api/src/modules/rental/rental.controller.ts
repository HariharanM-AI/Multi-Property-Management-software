import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { RentalService } from './rental.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantOrgGuard } from '../../common/guards/tenant-org.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission, AuthenticatedUser } from '@propertyos/types';
import {
  CreateRentalUnitSchema,
  UpdateRentalUnitSchema,
  CreateLeaseSchema,
  UpdateLeaseSchema,
  CreateRentEscalationSchema,
} from '@propertyos/validation';

@Controller('properties/:propertyId')
@UseGuards(AuthGuard, TenantOrgGuard, PermissionsGuard)
export class RentalController {
  constructor(private readonly rentalService: RentalService) {}

  @Get('rental/summary')
  @RequirePermissions(Permission.PROPERTY_READ)
  async getRentalSummary(
    @Param('propertyId') propertyId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const data = await this.rentalService.getRentalSummary(user.organizationId, propertyId);
    return { success: true, data };
  }

  // ==========================================================================
  // RENTAL UNITS CRUD
  // ==========================================================================

  @Post('units')
  @RequirePermissions(Permission.PROPERTY_CREATE)
  async createRentalUnit(
    @Param('propertyId') propertyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: any
  ) {
    const parse = CreateRentalUnitSchema.safeParse(body);
    if (!parse.success) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'ValidationError',
          message: 'Invalid input data',
          details: parse.error.errors,
        },
      });
    }

    const data = await this.rentalService.createRentalUnit(
      user.organizationId,
      propertyId,
      user.id,
      parse.data
    );
    return { success: true, data };
  }

  @Get('units')
  @RequirePermissions(Permission.PROPERTY_READ)
  async listRentalUnits(
    @Param('propertyId') propertyId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const data = await this.rentalService.listRentalUnits(user.organizationId, propertyId);
    return { success: true, data };
  }

  @Get('units/:unitId')
  @RequirePermissions(Permission.PROPERTY_READ)
  async getRentalUnitById(
    @Param('propertyId') propertyId: string,
    @Param('unitId') unitId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const data = await this.rentalService.getRentalUnitById(user.organizationId, propertyId, unitId);
    return { success: true, data };
  }

  @Patch('units/:unitId')
  @RequirePermissions(Permission.PROPERTY_UPDATE)
  async updateRentalUnit(
    @Param('propertyId') propertyId: string,
    @Param('unitId') unitId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: any
  ) {
    const parse = UpdateRentalUnitSchema.safeParse(body);
    if (!parse.success) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'ValidationError',
          message: 'Invalid input data',
          details: parse.error.errors,
        },
      });
    }

    const data = await this.rentalService.updateRentalUnit(
      user.organizationId,
      propertyId,
      unitId,
      user.id,
      parse.data
    );
    return { success: true, data };
  }

  @Delete('units/:unitId')
  @RequirePermissions(Permission.PROPERTY_DELETE)
  async deleteRentalUnit(
    @Param('propertyId') propertyId: string,
    @Param('unitId') unitId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    await this.rentalService.deleteRentalUnit(user.organizationId, propertyId, unitId, user.id);
    return { success: true, message: 'Rental unit deleted successfully' };
  }

  // ==========================================================================
  // LEASES CRUD
  // ==========================================================================

  @Post('leases')
  @RequirePermissions(Permission.LEASE_CREATE)
  async createLease(
    @Param('propertyId') propertyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: any
  ) {
    const parse = CreateLeaseSchema.safeParse(body);
    if (!parse.success) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'ValidationError',
          message: 'Invalid input data',
          details: parse.error.errors,
        },
      });
    }

    const data = await this.rentalService.createLease(
      user.organizationId,
      propertyId,
      user.id,
      parse.data
    );
    return { success: true, data };
  }

  @Get('leases')
  @RequirePermissions(Permission.LEASE_READ)
  async listLeases(
    @Param('propertyId') propertyId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const data = await this.rentalService.listLeases(user.organizationId, propertyId);
    return { success: true, data };
  }

  @Get('leases/:leaseId')
  @RequirePermissions(Permission.LEASE_READ)
  async getLeaseById(
    @Param('propertyId') propertyId: string,
    @Param('leaseId') leaseId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const data = await this.rentalService.getLeaseById(user.organizationId, propertyId, leaseId);
    return { success: true, data };
  }

  @Patch('leases/:leaseId')
  @RequirePermissions(Permission.LEASE_UPDATE)
  async updateLease(
    @Param('propertyId') propertyId: string,
    @Param('leaseId') leaseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: any
  ) {
    const parse = UpdateLeaseSchema.safeParse(body);
    if (!parse.success) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'ValidationError',
          message: 'Invalid input data',
          details: parse.error.errors,
        },
      });
    }

    const data = await this.rentalService.updateLease(
      user.organizationId,
      propertyId,
      leaseId,
      user.id,
      parse.data
    );
    return { success: true, data };
  }

  @Post('leases/:leaseId/terminate')
  @RequirePermissions(Permission.LEASE_TERMINATE)
  async terminateLease(
    @Param('propertyId') propertyId: string,
    @Param('leaseId') leaseId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const data = await this.rentalService.terminateLease(
      user.organizationId,
      propertyId,
      leaseId,
      user.id
    );
    return { success: true, data };
  }

  // ==========================================================================
  // RENT ESCALATIONS
  // ==========================================================================

  @Post('leases/:leaseId/escalations')
  @RequirePermissions(Permission.LEASE_UPDATE)
  async addRentEscalation(
    @Param('propertyId') propertyId: string,
    @Param('leaseId') leaseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: any
  ) {
    const parse = CreateRentEscalationSchema.safeParse(body);
    if (!parse.success) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'ValidationError',
          message: 'Invalid input data',
          details: parse.error.errors,
        },
      });
    }

    const data = await this.rentalService.addRentEscalation(
      user.organizationId,
      propertyId,
      leaseId,
      user.id,
      parse.data
    );
    return { success: true, data };
  }

  @Delete('leases/:leaseId/escalations/:escId')
  @RequirePermissions(Permission.LEASE_UPDATE)
  async deleteRentEscalation(
    @Param('propertyId') propertyId: string,
    @Param('leaseId') leaseId: string,
    @Param('escId') escId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    await this.rentalService.deleteRentEscalation(
      user.organizationId,
      propertyId,
      leaseId,
      escId,
      user.id
    );
    return { success: true, message: 'Rent escalation deleted successfully' };
  }
}
