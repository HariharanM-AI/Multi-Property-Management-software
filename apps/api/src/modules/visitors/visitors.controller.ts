import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { VisitorsService } from './visitors.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantOrgGuard } from '../../common/guards/tenant-org.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission, AuthenticatedUser, UserRole } from '@propertyos/types';
import {
  createVisitorSchema,
  updateVisitorSchema,
  checkInVisitorSchema,
  checkOutVisitorSchema,
  visitorFilterSchema,
} from '@propertyos/validation';

@Controller('visitors')
@UseGuards(AuthGuard, TenantOrgGuard, PermissionsGuard)
export class VisitorsController {
  constructor(private readonly visitorsService: VisitorsService) {}

  private async getCallerTenantId(user: AuthenticatedUser): Promise<string | undefined> {
    const isTenantOnly =
      user.roles.includes(UserRole.TENANT) &&
      !user.roles.includes(UserRole.OWNER) &&
      !user.roles.includes(UserRole.PROPERTY_MANAGER) &&
      !user.roles.includes(UserRole.WARDEN) &&
      !user.roles.includes(UserRole.SECURITY);

    if (!isTenantOnly) return undefined;
    const tenant = await this.visitorsService.findTenantForUser(
      user.organizationId,
      user.phone,
      user.email
    );
    return tenant ? tenant.id : 'no-matching-tenant';
  }

  @Post()
  @RequirePermissions(Permission.VISITOR_CREATE)
  async createVisitor(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: any
  ) {
    const parseResult = createVisitorSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: parseResult.error.errors,
      });
    }

    const callerTenantId = await this.getCallerTenantId(user);
    const visitor = await this.visitorsService.createVisitor(
      user.organizationId,
      parseResult.data,
      user.id,
      callerTenantId
    );

    return {
      success: true,
      data: visitor,
      message: 'Visitor registered successfully and gatepass generated',
    };
  }

  @Get()
  @RequirePermissions(Permission.VISITOR_READ)
  async getVisitors(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: any
  ) {
    const parseResult = visitorFilterSchema.safeParse(query);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Invalid filter parameters',
        errors: parseResult.error.errors,
      });
    }

    const callerTenantId = await this.getCallerTenantId(user);
    const result = await this.visitorsService.getVisitors(
      user.organizationId,
      parseResult.data as any,
      callerTenantId
    );

    return {
      success: true,
      ...result,
    };
  }

  @Get('summary')
  @RequirePermissions(Permission.VISITOR_READ)
  async getVisitorSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('propertyId') propertyId?: string
  ) {
    const callerTenantId = await this.getCallerTenantId(user);
    const summary = await this.visitorsService.getVisitorSummary(
      user.organizationId,
      propertyId,
      callerTenantId
    );

    return {
      success: true,
      data: summary,
    };
  }

  @Get('gatepass/:code')
  @RequirePermissions(Permission.VISITOR_READ)
  async getVisitorByGatePass(
    @CurrentUser() user: AuthenticatedUser,
    @Param('code') code: string
  ) {
    const visitor = await this.visitorsService.getVisitorByGatePass(
      user.organizationId,
      code
    );

    return {
      success: true,
      data: visitor,
    };
  }

  @Get(':id')
  @RequirePermissions(Permission.VISITOR_READ)
  async getVisitorById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    const callerTenantId = await this.getCallerTenantId(user);
    const visitor = await this.visitorsService.getVisitorById(
      user.organizationId,
      id,
      callerTenantId
    );

    return {
      success: true,
      data: visitor,
    };
  }

  @Post(':id/check-in')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.VISITOR_UPDATE)
  async checkInVisitor(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: any
  ) {
    const parseResult = checkInVisitorSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: parseResult.error.errors,
      });
    }

    const visitor = await this.visitorsService.checkInVisitor(
      user.organizationId,
      id,
      parseResult.data,
      user.id
    );

    return {
      success: true,
      data: visitor,
      message: 'Visitor physical entry recorded successfully',
    };
  }

  @Post(':id/check-out')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.VISITOR_UPDATE)
  async checkOutVisitor(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: any
  ) {
    const parseResult = checkOutVisitorSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: parseResult.error.errors,
      });
    }

    const visitor = await this.visitorsService.checkOutVisitor(
      user.organizationId,
      id,
      parseResult.data,
      user.id
    );

    return {
      success: true,
      data: visitor,
      message: 'Visitor physical exit recorded successfully',
    };
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.VISITOR_UPDATE)
  async approveVisitor(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    const callerTenantId = await this.getCallerTenantId(user);
    const visitor = await this.visitorsService.approveVisitor(
      user.organizationId,
      id,
      user.id,
      callerTenantId
    );

    return {
      success: true,
      data: visitor,
      message: 'Visitor approved successfully',
    };
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.VISITOR_UPDATE)
  async rejectVisitor(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    const callerTenantId = await this.getCallerTenantId(user);
    const visitor = await this.visitorsService.rejectVisitor(
      user.organizationId,
      id,
      user.id,
      callerTenantId
    );

    return {
      success: true,
      data: visitor,
      message: 'Visitor rejected successfully',
    };
  }

  @Delete(':id')
  @RequirePermissions(Permission.VISITOR_DELETE)
  async deleteVisitor(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    const result = await this.visitorsService.deleteVisitor(
      user.organizationId,
      id,
      user.id
    );

    return result;
  }
}
