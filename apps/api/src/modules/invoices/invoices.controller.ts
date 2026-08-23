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
import { InvoicesService } from './invoices.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantOrgGuard } from '../../common/guards/tenant-org.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  Permission,
  InvoiceStatus,
} from '@propertyos/types';
import {
  CreateInvoiceSchema,
  CreateInvoiceInput,
  UpdateInvoiceSchema,
  UpdateInvoiceInput,
  InvoiceFilterSchema,
  InvoiceFilterInput,
} from '@propertyos/validation';

@Controller('invoices')
@UseGuards(AuthGuard, TenantOrgGuard, PermissionsGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  @RequirePermissions(Permission.INVOICE_CREATE)
  async createInvoice(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(CreateInvoiceSchema)) dto: CreateInvoiceInput
  ) {
    return this.invoicesService.createInvoice(orgId, dto, userId);
  }

  @Get('summary')
  @RequirePermissions(Permission.INVOICE_READ)
  async getInvoiceSummary(@CurrentUser('organizationId') orgId: string) {
    return this.invoicesService.getInvoiceSummary(orgId);
  }

  @Get()
  @RequirePermissions(Permission.INVOICE_READ)
  async listInvoices(
    @CurrentUser('organizationId') orgId: string,
    @Query(new ZodValidationPipe(InvoiceFilterSchema)) filters: InvoiceFilterInput
  ) {
    return this.invoicesService.listInvoices(orgId, filters);
  }

  @Get(':id')
  @RequirePermissions(Permission.INVOICE_READ)
  async getInvoice(
    @CurrentUser('organizationId') orgId: string,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.invoicesService.getInvoice(orgId, id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.INVOICE_UPDATE)
  async updateDraftInvoice(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateInvoiceSchema)) dto: UpdateInvoiceInput
  ) {
    return this.invoicesService.updateDraftInvoice(orgId, id, dto, userId);
  }

  @Post(':id/issue')
  @RequirePermissions(Permission.INVOICE_ISSUE)
  async issueInvoice(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.invoicesService.issueInvoice(orgId, id, userId);
  }

  @Post(':id/void')
  @RequirePermissions(Permission.INVOICE_VOID)
  async voidInvoice(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.invoicesService.voidInvoice(orgId, id, userId);
  }
}
