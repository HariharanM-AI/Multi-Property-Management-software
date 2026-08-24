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
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantOrgGuard } from '../../common/guards/tenant-org.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission, ApiResponse } from '@propertyos/types';
import {
  createInventoryItemSchema,
  updateInventoryItemSchema,
  assignInventoryItemSchema,
  inventoryFilterSchema,
  CreateInventoryItemInput,
  UpdateInventoryItemInput,
  AssignInventoryItemInput,
  InventoryFilterInput,
} from '@propertyos/validation';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

@Controller('inventory')
@UseGuards(AuthGuard, TenantOrgGuard, PermissionsGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post()
  @RequirePermissions(Permission.INVENTORY_CREATE)
  @HttpCode(HttpStatus.CREATED)
  async createItem(
    @Req() req: any,
    @Body(new ZodValidationPipe(createInventoryItemSchema)) body: CreateInventoryItemInput
  ): Promise<ApiResponse<any>> {
    const data = await this.inventoryService.createItem(
      req.organizationId,
      body,
      req.user?.id
    );
    return {
      success: true,
      data,
    };
  }

  @Get('summary')
  @RequirePermissions(Permission.INVENTORY_READ)
  async getSummary(
    @Req() req: any,
    @Query('propertyId') propertyId?: string
  ): Promise<ApiResponse<any>> {
    const data = await this.inventoryService.getSummary(
      req.organizationId,
      propertyId
    );
    return {
      success: true,
      data,
    };
  }

  @Get()
  @RequirePermissions(Permission.INVENTORY_READ)
  async getItems(
    @Req() req: any,
    @Query(new ZodValidationPipe(inventoryFilterSchema)) query: InventoryFilterInput
  ): Promise<ApiResponse<any>> {
    const { items, total, page, limit, totalPages } =
      await this.inventoryService.getItems(req.organizationId, query);
    return {
      success: true,
      data: items,
      meta: {
        page,
        pageSize: limit,
        total,
        totalPages,
      },
    };
  }

  @Get(':id')
  @RequirePermissions(Permission.INVENTORY_READ)
  async getItemById(
    @Req() req: any,
    @Param('id') id: string
  ): Promise<ApiResponse<any>> {
    const data = await this.inventoryService.getItemById(req.organizationId, id);
    return {
      success: true,
      data,
    };
  }

  @Patch(':id')
  @RequirePermissions(Permission.INVENTORY_UPDATE)
  @HttpCode(HttpStatus.OK)
  async updateItem(
    @Req() req: any,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateInventoryItemSchema)) body: UpdateInventoryItemInput
  ): Promise<ApiResponse<any>> {
    const data = await this.inventoryService.updateItem(
      req.organizationId,
      id,
      body,
      req.user?.id
    );
    return {
      success: true,
      data,
    };
  }

  @Post(':id/assign')
  @RequirePermissions(Permission.INVENTORY_UPDATE)
  @HttpCode(HttpStatus.OK)
  async assignItem(
    @Req() req: any,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(assignInventoryItemSchema)) body: AssignInventoryItemInput
  ): Promise<ApiResponse<any>> {
    const data = await this.inventoryService.assignItem(
      req.organizationId,
      id,
      body,
      req.user?.id
    );
    return {
      success: true,
      data,
    };
  }

  @Post(':id/unassign')
  @RequirePermissions(Permission.INVENTORY_UPDATE)
  @HttpCode(HttpStatus.OK)
  async unassignItem(
    @Req() req: any,
    @Param('id') id: string
  ): Promise<ApiResponse<any>> {
    const data = await this.inventoryService.unassignItem(
      req.organizationId,
      id,
      req.user?.id
    );
    return {
      success: true,
      data,
    };
  }

  @Delete(':id')
  @RequirePermissions(Permission.INVENTORY_DELETE)
  @HttpCode(HttpStatus.OK)
  async deleteItem(
    @Req() req: any,
    @Param('id') id: string
  ): Promise<ApiResponse<any>> {
    const data = await this.inventoryService.deleteItem(
      req.organizationId,
      id,
      req.user?.id
    );
    return {
      success: true,
      data,
    };
  }
}
