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
import { PgStructureService } from './pg-structure.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantOrgGuard } from '../../common/guards/tenant-org.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission, AuthenticatedUser, BedStatus } from '@propertyos/types';
import {
  CreateFloorSchema,
  UpdateFloorSchema,
  CreateRoomSchema,
  UpdateRoomSchema,
  CreateBedSchema,
  UpdateBedSchema,
  UpdateBedStatusSchema,
} from '@propertyos/validation';

@Controller('properties/:propertyId')
@UseGuards(AuthGuard, TenantOrgGuard, PermissionsGuard)
export class PgStructureController {
  constructor(private readonly pgService: PgStructureService) {}

  @Get('pg/summary')
  @RequirePermissions(Permission.PROPERTY_READ)
  async getPgSummary(
    @Param('propertyId') propertyId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const data = await this.pgService.getPgSummary(user.organizationId, propertyId);
    return { success: true, data };
  }

  // ==========================================================================
  // FLOORS
  // ==========================================================================

  @Post('floors')
  @RequirePermissions(Permission.PROPERTY_CREATE)
  async createFloor(
    @Param('propertyId') propertyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: any
  ) {
    const parse = CreateFloorSchema.safeParse(body);
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

    const data = await this.pgService.createFloor(
      user.organizationId,
      propertyId,
      user.id,
      parse.data
    );
    return { success: true, data };
  }

  @Get('floors')
  @RequirePermissions(Permission.PROPERTY_READ)
  async listFloors(
    @Param('propertyId') propertyId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const data = await this.pgService.listFloors(user.organizationId, propertyId);
    return { success: true, data };
  }

  @Get('floors/:floorId')
  @RequirePermissions(Permission.PROPERTY_READ)
  async getFloorById(
    @Param('propertyId') propertyId: string,
    @Param('floorId') floorId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const data = await this.pgService.getFloorById(
      user.organizationId,
      propertyId,
      floorId
    );
    return { success: true, data };
  }

  @Patch('floors/:floorId')
  @RequirePermissions(Permission.PROPERTY_UPDATE)
  async updateFloor(
    @Param('propertyId') propertyId: string,
    @Param('floorId') floorId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: any
  ) {
    const parse = UpdateFloorSchema.safeParse(body);
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

    const data = await this.pgService.updateFloor(
      user.organizationId,
      propertyId,
      floorId,
      user.id,
      parse.data
    );
    return { success: true, data };
  }

  @Delete('floors/:floorId')
  @RequirePermissions(Permission.PROPERTY_DELETE)
  async deleteFloor(
    @Param('propertyId') propertyId: string,
    @Param('floorId') floorId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    await this.pgService.deleteFloor(
      user.organizationId,
      propertyId,
      floorId,
      user.id
    );
    return { success: true, data: null };
  }

  // ==========================================================================
  // ROOMS
  // ==========================================================================

  @Post('rooms')
  @RequirePermissions(Permission.PROPERTY_CREATE)
  async createRoom(
    @Param('propertyId') propertyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: any
  ) {
    const parse = CreateRoomSchema.safeParse(body);
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

    const data = await this.pgService.createRoom(
      user.organizationId,
      propertyId,
      user.id,
      parse.data
    );
    return { success: true, data };
  }

  @Get('rooms')
  @RequirePermissions(Permission.PROPERTY_READ)
  async listRooms(
    @Param('propertyId') propertyId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const data = await this.pgService.listRooms(user.organizationId, propertyId);
    return { success: true, data };
  }

  @Get('rooms/:roomId')
  @RequirePermissions(Permission.PROPERTY_READ)
  async getRoomById(
    @Param('propertyId') propertyId: string,
    @Param('roomId') roomId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const data = await this.pgService.getRoomById(
      user.organizationId,
      propertyId,
      roomId
    );
    return { success: true, data };
  }

  @Patch('rooms/:roomId')
  @RequirePermissions(Permission.PROPERTY_UPDATE)
  async updateRoom(
    @Param('propertyId') propertyId: string,
    @Param('roomId') roomId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: any
  ) {
    const parse = UpdateRoomSchema.safeParse(body);
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

    const data = await this.pgService.updateRoom(
      user.organizationId,
      propertyId,
      roomId,
      user.id,
      parse.data
    );
    return { success: true, data };
  }

  @Delete('rooms/:roomId')
  @RequirePermissions(Permission.PROPERTY_DELETE)
  async deleteRoom(
    @Param('propertyId') propertyId: string,
    @Param('roomId') roomId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    await this.pgService.deleteRoom(
      user.organizationId,
      propertyId,
      roomId,
      user.id
    );
    return { success: true, data: null };
  }

  // ==========================================================================
  // BEDS
  // ==========================================================================

  @Post('beds')
  @RequirePermissions(Permission.PROPERTY_CREATE)
  async createBed(
    @Param('propertyId') propertyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: any
  ) {
    const parse = CreateBedSchema.safeParse(body);
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

    const data = await this.pgService.createBed(
      user.organizationId,
      propertyId,
      user.id,
      parse.data
    );
    return { success: true, data };
  }

  @Get('beds')
  @RequirePermissions(Permission.PROPERTY_READ)
  async listBeds(
    @Param('propertyId') propertyId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const data = await this.pgService.listBeds(user.organizationId, propertyId);
    return { success: true, data };
  }

  @Get('beds/:bedId')
  @RequirePermissions(Permission.PROPERTY_READ)
  async getBedById(
    @Param('propertyId') propertyId: string,
    @Param('bedId') bedId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const data = await this.pgService.getBedById(
      user.organizationId,
      propertyId,
      bedId
    );
    return { success: true, data };
  }

  @Patch('beds/:bedId')
  @RequirePermissions(Permission.PROPERTY_UPDATE)
  async updateBed(
    @Param('propertyId') propertyId: string,
    @Param('bedId') bedId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: any
  ) {
    const parse = UpdateBedSchema.safeParse(body);
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

    const data = await this.pgService.updateBed(
      user.organizationId,
      propertyId,
      bedId,
      user.id,
      parse.data
    );
    return { success: true, data };
  }

  @Patch('beds/:bedId/status')
  @RequirePermissions(Permission.PROPERTY_UPDATE)
  async updateBedStatus(
    @Param('propertyId') propertyId: string,
    @Param('bedId') bedId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: any
  ) {
    const parse = UpdateBedStatusSchema.safeParse(body);
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

    const data = await this.pgService.updateBedStatus(
      user.organizationId,
      propertyId,
      bedId,
      user.id,
      parse.data.status
    );
    return { success: true, data };
  }

  @Delete('beds/:bedId')
  @RequirePermissions(Permission.PROPERTY_DELETE)
  async deleteBed(
    @Param('propertyId') propertyId: string,
    @Param('bedId') bedId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    await this.pgService.deleteBed(
      user.organizationId,
      propertyId,
      bedId,
      user.id
    );
    return { success: true, data: null };
  }
}
