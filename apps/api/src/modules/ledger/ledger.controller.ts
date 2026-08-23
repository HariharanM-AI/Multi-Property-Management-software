import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantOrgGuard } from '../../common/guards/tenant-org.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  Permission,
  LedgerAccountType,
  LedgerEntryType,
} from '@propertyos/types';

@Controller('ledger')
@UseGuards(AuthGuard, TenantOrgGuard, PermissionsGuard)
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Get()
  @RequirePermissions(Permission.LEDGER_READ)
  async listLedger(
    @CurrentUser('organizationId') orgId: string,
    @Query('tenantId') tenantId?: string,
    @Query('invoiceId') invoiceId?: string,
    @Query('paymentId') paymentId?: string,
    @Query('accountType') accountType?: LedgerAccountType,
    @Query('entryType') entryType?: LedgerEntryType
  ) {
    return this.ledgerService.listLedgerEntries(orgId, {
      tenantId,
      invoiceId,
      paymentId,
      accountType,
      entryType,
    });
  }

  @Get('tenant/:tenantId')
  @RequirePermissions(Permission.LEDGER_READ)
  async getTenantLedger(
    @CurrentUser('organizationId') orgId: string,
    @Param('tenantId', ParseUUIDPipe) tenantId: string
  ) {
    return this.ledgerService.getTenantLedger(orgId, tenantId);
  }

  @Get('invoice/:invoiceId')
  @RequirePermissions(Permission.LEDGER_READ)
  async getInvoiceLedger(
    @CurrentUser('organizationId') orgId: string,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string
  ) {
    return this.ledgerService.getInvoiceLedger(orgId, invoiceId);
  }
}
