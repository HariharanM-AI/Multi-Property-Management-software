import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { StaffService } from './staff.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantOrgGuard } from '../../common/guards/tenant-org.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission, AuthenticatedUser } from '@propertyos/types';
import {
  CreateStaffSchema,
  UpdateStaffSchema,
  StaffCheckInSchema,
  StaffCheckOutSchema,
  RecordAttendanceSchema,
  StaffFilterQuerySchema,
  AttendanceFilterQuerySchema,
} from '@propertyos/validation';

@Controller('staff')
@UseGuards(AuthGuard, TenantOrgGuard, PermissionsGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post()
  @RequirePermissions(Permission.STAFF_CREATE)
  async createStaff(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: any
  ) {
    const parseResult = CreateStaffSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: parseResult.error.errors,
      });
    }

    const staff = await this.staffService.createStaff(
      user.organizationId,
      parseResult.data,
      user.id
    );

    return {
      success: true,
      data: staff,
      message: 'Staff member registered successfully',
    };
  }

  @Get('summary')
  @RequirePermissions(Permission.STAFF_READ)
  async getStaffSummary(@CurrentUser() user: AuthenticatedUser) {
    const summary = await this.staffService.getStaffSummary(user.organizationId);
    return {
      success: true,
      data: summary,
    };
  }

  @Get('attendance/records')
  @RequirePermissions(Permission.ATTENDANCE_READ)
  async getAttendanceRecords(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: any
  ) {
    const parseResult = AttendanceFilterQuerySchema.safeParse(query);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Invalid query parameters',
        errors: parseResult.error.errors,
      });
    }

    const result = await this.staffService.getAttendanceRecords(
      user.organizationId,
      parseResult.data
    );

    return {
      success: true,
      data: result.data,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    };
  }

  @Post('attendance/check-in')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ATTENDANCE_RECORD)
  async checkInStaff(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: any
  ) {
    const parseResult = StaffCheckInSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: parseResult.error.errors,
      });
    }

    const attendance = await this.staffService.checkInStaff(
      user.organizationId,
      parseResult.data,
      user.id
    );

    return {
      success: true,
      data: attendance,
      message: 'Staff check-in recorded successfully',
    };
  }

  @Post('attendance/check-out')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ATTENDANCE_RECORD)
  async checkOutStaff(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: any
  ) {
    const parseResult = StaffCheckOutSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: parseResult.error.errors,
      });
    }

    const attendance = await this.staffService.checkOutStaff(
      user.organizationId,
      parseResult.data,
      user.id
    );

    return {
      success: true,
      data: attendance,
      message: 'Staff check-out recorded successfully',
    };
  }

  @Post('attendance/record')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ATTENDANCE_RECORD)
  async recordAttendance(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: any
  ) {
    const parseResult = RecordAttendanceSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: parseResult.error.errors,
      });
    }

    const attendance = await this.staffService.recordAttendance(
      user.organizationId,
      parseResult.data,
      user.id
    );

    return {
      success: true,
      data: attendance,
      message: 'Attendance record saved successfully',
    };
  }

  @Get()
  @RequirePermissions(Permission.STAFF_READ)
  async getStaff(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: any
  ) {
    const parseResult = StaffFilterQuerySchema.safeParse(query);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Invalid query parameters',
        errors: parseResult.error.errors,
      });
    }

    const result = await this.staffService.getStaff(
      user.organizationId,
      parseResult.data
    );

    return {
      success: true,
      data: result.data,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    };
  }

  @Get(':id')
  @RequirePermissions(Permission.STAFF_READ)
  async getStaffById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    const staff = await this.staffService.getStaffById(user.organizationId, id);
    return {
      success: true,
      data: staff,
    };
  }

  @Patch(':id')
  @RequirePermissions(Permission.STAFF_UPDATE)
  async updateStaff(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: any
  ) {
    const parseResult = UpdateStaffSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: parseResult.error.errors,
      });
    }

    const staff = await this.staffService.updateStaff(
      user.organizationId,
      id,
      parseResult.data,
      user.id
    );

    return {
      success: true,
      data: staff,
      message: 'Staff member updated successfully',
    };
  }

  @Delete(':id')
  @RequirePermissions(Permission.STAFF_DELETE)
  async deactivateStaff(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    const result = await this.staffService.deactivateStaff(
      user.organizationId,
      id,
      user.id
    );

    return {
      success: true,
      message: result.message,
    };
  }
}
