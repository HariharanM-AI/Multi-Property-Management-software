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
import { MaintenanceService } from './maintenance.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantOrgGuard } from '../../common/guards/tenant-org.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  Permission,
  UserRole,
  MaintenanceVendorStatus,
  CreateMaintenanceTicketDto,
  UpdateMaintenanceTicketDto,
  AssignMaintenanceTicketDto,
  ReassignMaintenanceTicketDto,
  StartMaintenanceTicketDto,
  CompleteMaintenanceTicketDto,
  VerifyMaintenanceTicketDto,
  CloseMaintenanceTicketDto,
  CancelMaintenanceTicketDto,
  CreateMaintenanceCommentDto,
  CreateMaintenanceAttachmentDto,
  UpdateMaintenanceCostDto,
  CreateMaintenanceVendorDto,
  UpdateMaintenanceVendorDto,
  MaintenanceListQueryDto,
} from '@propertyos/types';
import {
  CreateMaintenanceTicketSchema,
  UpdateMaintenanceTicketSchema,
  AssignMaintenanceTicketSchema,
  ReassignMaintenanceTicketSchema,
  StartMaintenanceTicketSchema,
  CompleteMaintenanceTicketSchema,
  VerifyMaintenanceTicketSchema,
  CloseMaintenanceTicketSchema,
  CancelMaintenanceTicketSchema,
  CreateMaintenanceCommentSchema,
  CreateMaintenanceAttachmentSchema,
  UpdateMaintenanceCostSchema,
  CreateMaintenanceVendorSchema,
  UpdateMaintenanceVendorSchema,
  MaintenanceListQuerySchema,
} from '@propertyos/validation';

@Controller('')
@UseGuards(AuthGuard, TenantOrgGuard, PermissionsGuard)
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  // ----------------------------------------------------------------------------
  // TICKETS
  // ----------------------------------------------------------------------------

  @Post('maintenance/tickets')
  @RequirePermissions(Permission.MAINTENANCE_CREATE)
  async createTicket(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: UserRole[],
    @Body(new ZodValidationPipe(CreateMaintenanceTicketSchema))
    dto: CreateMaintenanceTicketDto
  ) {
    return this.maintenanceService.createTicket(orgId, userId, roles, dto);
  }

  @Get('maintenance/tickets')
  @RequirePermissions(Permission.MAINTENANCE_READ)
  async getTickets(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: UserRole[],
    @Query(new ZodValidationPipe(MaintenanceListQuerySchema))
    query: MaintenanceListQueryDto
  ) {
    return this.maintenanceService.getTickets(orgId, userId, roles, query);
  }

  @Get('maintenance/tickets/:id')
  @RequirePermissions(Permission.MAINTENANCE_READ)
  async getTicketById(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: UserRole[],
    @Param('id', ParseUUIDPipe) ticketId: string
  ) {
    return this.maintenanceService.getTicketById(orgId, userId, roles, ticketId);
  }

  @Patch('maintenance/tickets/:id')
  @RequirePermissions(Permission.MAINTENANCE_UPDATE)
  async updateTicket(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: UserRole[],
    @Param('id', ParseUUIDPipe) ticketId: string,
    @Body(new ZodValidationPipe(UpdateMaintenanceTicketSchema))
    dto: UpdateMaintenanceTicketDto
  ) {
    return this.maintenanceService.updateTicket(orgId, userId, roles, ticketId, dto);
  }

  // ----------------------------------------------------------------------------
  // ASSIGNMENTS
  // ----------------------------------------------------------------------------

  @Post('maintenance/tickets/:id/assign')
  @RequirePermissions(Permission.MAINTENANCE_ASSIGN)
  async assignTicket(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: UserRole[],
    @Param('id', ParseUUIDPipe) ticketId: string,
    @Body(new ZodValidationPipe(AssignMaintenanceTicketSchema))
    dto: AssignMaintenanceTicketDto
  ) {
    return this.maintenanceService.assignTicket(orgId, userId, roles, ticketId, dto);
  }

  @Post('maintenance/tickets/:id/reassign')
  @RequirePermissions(Permission.MAINTENANCE_ASSIGN)
  async reassignTicket(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: UserRole[],
    @Param('id', ParseUUIDPipe) ticketId: string,
    @Body(new ZodValidationPipe(ReassignMaintenanceTicketSchema))
    dto: ReassignMaintenanceTicketDto
  ) {
    return this.maintenanceService.reassignTicket(orgId, userId, roles, ticketId, dto);
  }

  @Post('maintenance/tickets/:id/unassign')
  @RequirePermissions(Permission.MAINTENANCE_ASSIGN)
  async unassignTicket(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) ticketId: string
  ) {
    return this.maintenanceService.unassignTicket(orgId, userId, ticketId);
  }

  // ----------------------------------------------------------------------------
  // STATUS TRANSITIONS
  // ----------------------------------------------------------------------------

  @Post('maintenance/tickets/:id/start')
  @RequirePermissions(Permission.MAINTENANCE_UPDATE)
  async startTicket(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) ticketId: string,
    @Body(new ZodValidationPipe(StartMaintenanceTicketSchema))
    dto: StartMaintenanceTicketDto
  ) {
    return this.maintenanceService.startTicket(orgId, userId, ticketId, dto);
  }

  @Post('maintenance/tickets/:id/complete')
  @RequirePermissions(Permission.MAINTENANCE_COMPLETE)
  async completeTicket(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: UserRole[],
    @Param('id', ParseUUIDPipe) ticketId: string,
    @Body(new ZodValidationPipe(CompleteMaintenanceTicketSchema))
    dto: CompleteMaintenanceTicketDto
  ) {
    return this.maintenanceService.completeTicket(orgId, userId, roles, ticketId, dto);
  }

  @Post('maintenance/tickets/:id/verify')
  @RequirePermissions(Permission.MAINTENANCE_VERIFY)
  async verifyTicket(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: UserRole[],
    @Param('id', ParseUUIDPipe) ticketId: string,
    @Body(new ZodValidationPipe(VerifyMaintenanceTicketSchema))
    dto: VerifyMaintenanceTicketDto
  ) {
    return this.maintenanceService.verifyTicket(orgId, userId, ticketId, dto);
  }

  @Post('maintenance/tickets/:id/close')
  @RequirePermissions(Permission.MAINTENANCE_CLOSE)
  async closeTicket(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: UserRole[],
    @Param('id', ParseUUIDPipe) ticketId: string,
    @Body(new ZodValidationPipe(CloseMaintenanceTicketSchema))
    dto: CloseMaintenanceTicketDto
  ) {
    return this.maintenanceService.closeTicket(orgId, userId, ticketId, dto);
  }

  @Post('maintenance/tickets/:id/cancel')
  @RequirePermissions(Permission.MAINTENANCE_CANCEL)
  async cancelTicket(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: UserRole[],
    @Param('id', ParseUUIDPipe) ticketId: string,
    @Body(new ZodValidationPipe(CancelMaintenanceTicketSchema))
    dto: CancelMaintenanceTicketDto
  ) {
    return this.maintenanceService.cancelTicket(orgId, userId, ticketId, dto);
  }

  // ----------------------------------------------------------------------------
  // COMMENTS
  // ----------------------------------------------------------------------------

  @Post('maintenance/tickets/:id/comments')
  @RequirePermissions(Permission.MAINTENANCE_COMMENT)
  async addComment(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) ticketId: string,
    @Body(new ZodValidationPipe(CreateMaintenanceCommentSchema))
    dto: CreateMaintenanceCommentDto
  ) {
    return this.maintenanceService.addComment(orgId, userId, ticketId, dto);
  }

  @Get('maintenance/tickets/:id/comments')
  @RequirePermissions(Permission.MAINTENANCE_READ)
  async getComments(
    @CurrentUser('organizationId') orgId: string,
    @Param('id', ParseUUIDPipe) ticketId: string
  ) {
    return this.maintenanceService.getComments(orgId, ticketId);
  }

  // ----------------------------------------------------------------------------
  // ATTACHMENTS
  // ----------------------------------------------------------------------------

  @Post('maintenance/tickets/:id/attachments')
  @RequirePermissions(Permission.MAINTENANCE_CREATE)
  async addAttachment(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) ticketId: string,
    @Body(new ZodValidationPipe(CreateMaintenanceAttachmentSchema))
    dto: CreateMaintenanceAttachmentDto
  ) {
    return this.maintenanceService.addAttachment(orgId, userId, ticketId, dto);
  }

  @Get('maintenance/tickets/:id/attachments')
  @RequirePermissions(Permission.MAINTENANCE_READ)
  async getAttachments(
    @CurrentUser('organizationId') orgId: string,
    @Param('id', ParseUUIDPipe) ticketId: string
  ) {
    return this.maintenanceService.getAttachments(orgId, ticketId);
  }

  // ----------------------------------------------------------------------------
  // COST MANAGEMENT
  // ----------------------------------------------------------------------------

  @Patch('maintenance/tickets/:id/cost')
  @RequirePermissions(Permission.MAINTENANCE_MANAGE_COST)
  async updateCost(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) ticketId: string,
    @Body(new ZodValidationPipe(UpdateMaintenanceCostSchema))
    dto: UpdateMaintenanceCostDto
  ) {
    return this.maintenanceService.updateCost(orgId, userId, ticketId, dto);
  }

  // ----------------------------------------------------------------------------
  // VENDORS
  // ----------------------------------------------------------------------------

  @Post('maintenance/vendors')
  @RequirePermissions(Permission.MAINTENANCE_MANAGE_VENDOR)
  async createVendor(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(CreateMaintenanceVendorSchema))
    dto: CreateMaintenanceVendorDto
  ) {
    return this.maintenanceService.createVendor(orgId, userId, dto);
  }

  @Get('maintenance/vendors')
  @RequirePermissions(Permission.MAINTENANCE_READ)
  async getVendors(
    @CurrentUser('organizationId') orgId: string,
    @Query('status') status?: MaintenanceVendorStatus
  ) {
    return this.maintenanceService.getVendors(orgId, status);
  }

  @Get('maintenance/vendors/:id')
  @RequirePermissions(Permission.MAINTENANCE_READ)
  async getVendorById(
    @CurrentUser('organizationId') orgId: string,
    @Param('id', ParseUUIDPipe) vendorId: string
  ) {
    return this.maintenanceService.getVendorById(orgId, vendorId);
  }

  @Patch('maintenance/vendors/:id')
  @RequirePermissions(Permission.MAINTENANCE_MANAGE_VENDOR)
  async updateVendor(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) vendorId: string,
    @Body(new ZodValidationPipe(UpdateMaintenanceVendorSchema))
    dto: UpdateMaintenanceVendorDto
  ) {
    return this.maintenanceService.updateVendor(orgId, userId, vendorId, dto);
  }

  // ----------------------------------------------------------------------------
  // SUMMARIES & KPIS
  // ----------------------------------------------------------------------------

  @Get('properties/:propertyId/maintenance/summary')
  @RequirePermissions(Permission.MAINTENANCE_READ)
  async getPropertySummary(
    @CurrentUser('organizationId') orgId: string,
    @Param('propertyId', ParseUUIDPipe) propertyId: string
  ) {
    return this.maintenanceService.getSummary(orgId, propertyId);
  }

  @Get('maintenance/summary')
  @RequirePermissions(Permission.MAINTENANCE_READ)
  async getOrganizationSummary(
    @CurrentUser('organizationId') orgId: string
  ) {
    return this.maintenanceService.getSummary(orgId);
  }

  @Get('tenants/:tenantId/maintenance/summary')
  @RequirePermissions(Permission.MAINTENANCE_READ)
  async getTenantSummary(
    @CurrentUser('organizationId') orgId: string,
    @Param('tenantId', ParseUUIDPipe) tenantId: string
  ) {
    return this.maintenanceService.getTenantSummary(orgId, tenantId);
  }
}
