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
  Req,
  Ip,
  Headers,
} from '@nestjs/common';
import { ServicesService } from './services.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantOrgGuard } from '../../common/guards/tenant-org.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthenticatedRequest } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  AuthUser,
  Permission,
  ServiceRequestDto,
  ServiceRequestSummaryDto,
} from '@propertyos/types';
import {
  CreateServiceRequestSchema,
  UpdateServiceRequestSchema,
  AssignServiceRequestSchema,
  UpdateServiceRequestStatusSchema,
  ServiceRequestQuerySchema,
} from '@propertyos/validation';

@Controller('services')
@UseGuards(AuthGuard, TenantOrgGuard, PermissionsGuard)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post('requests')
  @RequirePermissions(Permission.SERVICE_REQUEST_CREATE)
  async createServiceRequest(
    @CurrentUser() user: AuthUser,
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(CreateServiceRequestSchema)) body: any,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string
  ): Promise<ServiceRequestDto> {
    return this.servicesService.createServiceRequest(user, req.organizationId!, body, ip, userAgent);
  }

  @Get('requests')
  @RequirePermissions(Permission.SERVICE_REQUEST_READ)
  async getServiceRequests(
    @CurrentUser() user: AuthUser,
    @Req() req: AuthenticatedRequest,
    @Query(new ZodValidationPipe(ServiceRequestQuerySchema)) query: any
  ): Promise<{ data: ServiceRequestDto[]; total: number; page: number; limit: number; totalPages: number }> {
    return this.servicesService.getServiceRequests(user, req.organizationId!, query);
  }

  @Get('summary')
  @RequirePermissions(Permission.SERVICE_REQUEST_READ)
  async getSummary(
    @CurrentUser() user: AuthUser,
    @Req() req: AuthenticatedRequest,
    @Query('propertyId') propertyId?: string
  ): Promise<ServiceRequestSummaryDto> {
    return this.servicesService.getSummary(user, req.organizationId!, propertyId);
  }

  @Get('requests/:id')
  @RequirePermissions(Permission.SERVICE_REQUEST_READ)
  async getServiceRequestById(
    @CurrentUser() user: AuthUser,
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string
  ): Promise<ServiceRequestDto> {
    return this.servicesService.getServiceRequestById(user, req.organizationId!, id);
  }

  @Patch('requests/:id')
  @RequirePermissions(Permission.SERVICE_REQUEST_UPDATE)
  async updateServiceRequest(
    @CurrentUser() user: AuthUser,
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateServiceRequestSchema)) body: any,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string
  ): Promise<ServiceRequestDto> {
    return this.servicesService.updateServiceRequest(user, req.organizationId!, id, body, ip, userAgent);
  }

  @Patch('requests/:id/assign')
  @RequirePermissions(Permission.SERVICE_REQUEST_ASSIGN)
  async assignServiceRequest(
    @CurrentUser() user: AuthUser,
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AssignServiceRequestSchema)) body: any,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string
  ): Promise<ServiceRequestDto> {
    return this.servicesService.assignServiceRequest(user, req.organizationId!, id, body, ip, userAgent);
  }

  @Patch('requests/:id/status')
  async updateServiceRequestStatus(
    @CurrentUser() user: AuthUser,
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateServiceRequestStatusSchema)) body: any,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string
  ): Promise<ServiceRequestDto> {
    return this.servicesService.updateServiceRequestStatus(user, req.organizationId!, id, body, ip, userAgent);
  }

  @Delete('requests/:id')
  @RequirePermissions(Permission.SERVICE_REQUEST_DELETE)
  async deleteServiceRequest(
    @CurrentUser() user: AuthUser,
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string
  ): Promise<{ success: boolean; message: string }> {
    return this.servicesService.deleteServiceRequest(user, req.organizationId!, id, ip, userAgent);
  }
}
