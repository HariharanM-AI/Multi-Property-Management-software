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
} from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantOrgGuard } from '../../common/guards/tenant-org.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission, AuthenticatedUser } from '@propertyos/types';
import {
  CreateMarketplaceListingSchema,
  UpdateMarketplaceListingSchema,
  UpdateMarketplaceStatusSchema,
  MarketplaceListingQuerySchema,
} from '@propertyos/validation';

@Controller('marketplace')
@UseGuards(AuthGuard, TenantOrgGuard, PermissionsGuard)
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  /**
   * List and search marketplace listings with multi-tenant filtering.
   */
  @Get('listings')
  @RequirePermissions(Permission.MARKETPLACE_READ)
  async getListings(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: any
  ) {
    const parseResult = MarketplaceListingQuerySchema.safeParse(query);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    return this.marketplaceService.getListings(
      user.organizationId,
      user,
      parseResult.data
    );
  }

  /**
   * Get property-scoped or portfolio summary metrics.
   */
  @Get('summary')
  @RequirePermissions(Permission.MARKETPLACE_READ)
  async getSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('propertyId') propertyId?: string
  ) {
    return this.marketplaceService.getSummary(
      user.organizationId,
      user,
      propertyId
    );
  }

  /**
   * Get single marketplace listing by ID.
   */
  @Get('listings/:id')
  @RequirePermissions(Permission.MARKETPLACE_READ)
  async getListingById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    return this.marketplaceService.getListingById(
      user.organizationId,
      user,
      id
    );
  }

  /**
   * Create a new marketplace listing.
   */
  @Post('listings')
  @RequirePermissions(Permission.MARKETPLACE_LISTING_CREATE)
  async createListing(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: any
  ) {
    const parseResult = CreateMarketplaceListingSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    return this.marketplaceService.createListing(
      user.organizationId,
      user,
      parseResult.data
    );
  }

  /**
   * Update marketplace listing details.
   */
  @Patch('listings/:id')
  @RequirePermissions(Permission.MARKETPLACE_LISTING_UPDATE)
  async updateListing(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: any
  ) {
    const parseResult = UpdateMarketplaceListingSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    return this.marketplaceService.updateListing(
      user.organizationId,
      user,
      id,
      parseResult.data
    );
  }

  /**
   * Update marketplace listing status (ACTIVE, RESERVED, SOLD).
   */
  @Patch('listings/:id/status')
  @RequirePermissions(Permission.MARKETPLACE_LISTING_UPDATE)
  async updateListingStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: any
  ) {
    const parseResult = UpdateMarketplaceStatusSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    return this.marketplaceService.updateListingStatus(
      user.organizationId,
      user,
      id,
      parseResult.data
    );
  }

  /**
   * Delete / Soft-delete marketplace listing.
   */
  @Delete('listings/:id')
  @RequirePermissions(Permission.MARKETPLACE_LISTING_DELETE)
  async deleteListing(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    return this.marketplaceService.deleteListing(
      user.organizationId,
      user,
      id
    );
  }
}
