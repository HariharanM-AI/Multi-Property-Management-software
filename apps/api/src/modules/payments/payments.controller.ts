import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantOrgGuard } from '../../common/guards/tenant-org.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Permission } from '@propertyos/types';
import {
  CreatePaymentSchema,
  CreatePaymentInput,
  AllocatePaymentSchema,
  AllocatePaymentInput,
  PaymentFilterSchema,
  PaymentFilterInput,
} from '@propertyos/validation';

@Controller('payments')
@UseGuards(AuthGuard, TenantOrgGuard, PermissionsGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @RequirePermissions(Permission.PAYMENT_CREATE)
  async recordPayment(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(CreatePaymentSchema)) dto: CreatePaymentInput
  ) {
    return this.paymentsService.recordPayment(orgId, dto, userId);
  }

  @Get()
  @RequirePermissions(Permission.PAYMENT_READ)
  async listPayments(
    @CurrentUser('organizationId') orgId: string,
    @Query(new ZodValidationPipe(PaymentFilterSchema)) filters: PaymentFilterInput
  ) {
    return this.paymentsService.listPayments(orgId, filters);
  }

  @Get(':id')
  @RequirePermissions(Permission.PAYMENT_READ)
  async getPayment(
    @CurrentUser('organizationId') orgId: string,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.paymentsService.getPayment(orgId, id);
  }

  @Post(':id/allocate')
  @RequirePermissions(Permission.PAYMENT_ALLOCATE)
  async allocatePayment(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AllocatePaymentSchema)) dto: AllocatePaymentInput
  ) {
    return this.paymentsService.allocatePayment(orgId, id, dto, userId);
  }

  @Post(':id/reverse-allocation/:allocationId')
  @RequirePermissions(Permission.PAYMENT_ALLOCATE)
  async reverseAllocation(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('allocationId', ParseUUIDPipe) allocationId: string
  ) {
    return this.paymentsService.reverseAllocation(orgId, id, allocationId, userId);
  }
}
