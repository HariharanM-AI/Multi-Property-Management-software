import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CheckoutsService } from './checkouts.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantOrgGuard } from '../../common/guards/tenant-org.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  Permission,
  CheckoutStatus,
} from '@propertyos/types';
import {
  CreateCheckoutSchema,
  CreateCheckoutInput,
  UpdateSettlementSchema,
  UpdateSettlementInput,
  CancelCheckoutSchema,
  CancelCheckoutInput,
  CheckoutFilterSchema,
  CheckoutFilterInput,
} from '@propertyos/validation';

@Controller('')
@UseGuards(AuthGuard, TenantOrgGuard, PermissionsGuard)
export class CheckoutsController {
  constructor(private readonly checkoutsService: CheckoutsService) {}

  /**
   * Initiates a Checkout for a tenant in a property
   */
  @Post('properties/:propertyId/checkouts')
  @RequirePermissions(Permission.CHECKOUT_CREATE)
  @HttpCode(HttpStatus.CREATED)
  async createCheckout(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
    @Param('propertyId') propertyId: string,
    @Body(new ZodValidationPipe(CreateCheckoutSchema)) dto: CreateCheckoutInput
  ) {
    const data = await this.checkoutsService.createCheckout(
      organizationId,
      propertyId,
      dto,
      userId
    );
    return {
      success: true,
      data,
      message: 'Checkout process initiated successfully',
    };
  }

  /**
   * Lists checkouts for a property
   */
  @Get('properties/:propertyId/checkouts')
  @RequirePermissions(Permission.CHECKOUT_READ)
  async listPropertyCheckouts(
    @CurrentUser('organizationId') organizationId: string,
    @Param('propertyId') propertyId: string,
    @Query(new ZodValidationPipe(CheckoutFilterSchema)) query: CheckoutFilterInput
  ) {
    const data = await this.checkoutsService.listCheckouts(organizationId, {
      ...query,
      propertyId,
    });
    return {
      success: true,
      data,
    };
  }

  /**
   * Organization-wide checkout list
   */
  @Get('checkouts')
  @RequirePermissions(Permission.CHECKOUT_READ)
  async listCheckouts(
    @CurrentUser('organizationId') organizationId: string,
    @Query(new ZodValidationPipe(CheckoutFilterSchema)) query: CheckoutFilterInput
  ) {
    const data = await this.checkoutsService.listCheckouts(organizationId, query);
    return {
      success: true,
      data,
    };
  }

  /**
   * Retrieves single checkout record details
   */
  @Get('checkouts/:checkoutId')
  @RequirePermissions(Permission.CHECKOUT_READ)
  async getCheckoutById(
    @CurrentUser('organizationId') organizationId: string,
    @Param('checkoutId') checkoutId: string
  ) {
    const data = await this.checkoutsService.getCheckoutById(organizationId, checkoutId);
    return {
      success: true,
      data,
    };
  }

  /**
   * Retrieves settlement details for a checkout
   */
  @Get('checkouts/:checkoutId/settlement')
  @RequirePermissions(Permission.CHECKOUT_READ)
  async getSettlementByCheckoutId(
    @CurrentUser('organizationId') organizationId: string,
    @Param('checkoutId') checkoutId: string
  ) {
    const data = await this.checkoutsService.getSettlementByCheckoutId(organizationId, checkoutId);
    return {
      success: true,
      data,
    };
  }

  /**
   * Moves checkout state to READY
   */
  @Post('checkouts/:checkoutId/ready')
  @RequirePermissions(Permission.CHECKOUT_UPDATE)
  @HttpCode(HttpStatus.OK)
  async markCheckoutReady(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
    @Param('checkoutId') checkoutId: string
  ) {
    const data = await this.checkoutsService.markCheckoutReady(organizationId, checkoutId, userId);
    return {
      success: true,
      data,
      message: 'Checkout marked as ready for completion',
    };
  }

  /**
   * Updates settlement charges/deductions
   */
  @Patch('checkouts/:checkoutId/settlement')
  @RequirePermissions(Permission.CHECKOUT_UPDATE)
  async updateSettlement(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
    @Param('checkoutId') checkoutId: string,
    @Body(new ZodValidationPipe(UpdateSettlementSchema)) dto: UpdateSettlementInput
  ) {
    const data = await this.checkoutsService.updateSettlement(
      organizationId,
      checkoutId,
      dto,
      userId
    );
    return {
      success: true,
      data,
      message: 'Settlement updated successfully',
    };
  }

  /**
   * Completes checkout and releases occupancy
   */
  @Post('checkouts/:checkoutId/complete')
  @RequirePermissions(Permission.CHECKOUT_COMPLETE)
  @HttpCode(HttpStatus.OK)
  async completeCheckout(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
    @Param('checkoutId') checkoutId: string
  ) {
    const data = await this.checkoutsService.completeCheckout(organizationId, checkoutId, userId);
    return {
      success: true,
      data,
      message: 'Checkout completed successfully and occupancy released',
    };
  }

  /**
   * Cancels a pending checkout
   */
  @Post('checkouts/:checkoutId/cancel')
  @RequirePermissions(Permission.CHECKOUT_CANCEL)
  @HttpCode(HttpStatus.OK)
  async cancelCheckout(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
    @Param('checkoutId') checkoutId: string,
    @Body(new ZodValidationPipe(CancelCheckoutSchema)) dto: CancelCheckoutInput
  ) {
    const data = await this.checkoutsService.cancelCheckout(organizationId, checkoutId, dto, userId);
    return {
      success: true,
      data,
      message: 'Checkout cancelled successfully',
    };
  }

  /**
   * Retrieves checkout history for a specific tenant
   */
  @Get('tenants/:tenantId/checkouts')
  @RequirePermissions(Permission.CHECKOUT_READ)
  async getTenantCheckouts(
    @CurrentUser('organizationId') organizationId: string,
    @Param('tenantId') tenantId: string
  ) {
    const data = await this.checkoutsService.getTenantCheckouts(organizationId, tenantId);
    return {
      success: true,
      data,
    };
  }
}
