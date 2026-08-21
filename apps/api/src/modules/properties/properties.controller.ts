import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Ip,
  Headers,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PropertiesService } from './properties.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantOrgGuard } from '../../common/guards/tenant-org.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permission } from '@propertyos/types';
import {
  CreatePropertySchema,
  UpdatePropertySchema,
  PropertyFilterSchema,
  PropertyMediaCategorySchema,
  CreatePropertyInput,
  UpdatePropertyInput,
  PropertyFilterInput,
} from '@propertyos/validation';

@Controller('properties')
@UseGuards(AuthGuard, TenantOrgGuard, PermissionsGuard)
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get('amenities')
  @RequirePermissions(Permission.PROPERTY_READ)
  async getAmenitiesCatalog() {
    const data = await this.propertiesService.getAmenitiesCatalog();
    return {
      success: true,
      data,
    };
  }

  @Post()
  @RequirePermissions(Permission.PROPERTY_CREATE)
  async createProperty(
    @Req() req: any,
    @Body() body: any,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string
  ) {
    const parseResult = CreatePropertySchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Validation failed for property creation',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const organizationId = req.user.organizationId;
    const userId = req.user.id;

    const data = await this.propertiesService.createProperty(
      organizationId,
      userId,
      parseResult.data as CreatePropertyInput,
      ip,
      userAgent
    );

    return {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Get()
  @RequirePermissions(Permission.PROPERTY_READ)
  async listProperties(@Req() req: any, @Query() query: any) {
    const parseResult = PropertyFilterSchema.safeParse(query);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Invalid property query filters',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const organizationId = req.user.organizationId;
    const result = await this.propertiesService.listProperties(
      organizationId,
      parseResult.data as PropertyFilterInput
    );

    return {
      success: true,
      data: result.items,
      meta: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Get(':id')
  @RequirePermissions(Permission.PROPERTY_READ)
  async getPropertyById(@Req() req: any, @Param('id') id: string) {
    const organizationId = req.user.organizationId;
    const data = await this.propertiesService.getPropertyById(organizationId, id);

    return {
      success: true,
      data,
    };
  }

  @Patch(':id')
  @RequirePermissions(Permission.PROPERTY_UPDATE)
  async updateProperty(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string
  ) {
    const parseResult = UpdatePropertySchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Validation failed for property update',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const organizationId = req.user.organizationId;
    const userId = req.user.id;

    const data = await this.propertiesService.updateProperty(
      organizationId,
      userId,
      id,
      parseResult.data as UpdatePropertyInput,
      ip,
      userAgent
    );

    return {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Post(':id/archive')
  @RequirePermissions(Permission.PROPERTY_DELETE)
  async archiveProperty(
    @Req() req: any,
    @Param('id') id: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string
  ) {
    const organizationId = req.user.organizationId;
    const userId = req.user.id;

    const result = await this.propertiesService.archiveProperty(
      organizationId,
      userId,
      id,
      ip,
      userAgent
    );

    return {
      success: true,
      data: result,
    };
  }

  @Post(':id/restore')
  @RequirePermissions(Permission.PROPERTY_DELETE)
  async restoreProperty(
    @Req() req: any,
    @Param('id') id: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string
  ) {
    const organizationId = req.user.organizationId;
    const userId = req.user.id;

    const result = await this.propertiesService.restoreProperty(
      organizationId,
      userId,
      id,
      ip,
      userAgent
    );

    return {
      success: true,
      data: result,
    };
  }

  @Post(':id/media')
  @RequirePermissions(Permission.PROPERTY_UPDATE)
  @UseInterceptors(FileInterceptor('file'))
  async addPropertyMedia(
    @Req() req: any,
    @Param('id') propertyId: string,
    @UploadedFile() file: any,
    @Body('category') category: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string
  ) {
    if (!file) {
      throw new BadRequestException('No file provided for upload');
    }

    const categoryResult = PropertyMediaCategorySchema.safeParse(category || 'IMAGE');
    const validCategory = categoryResult.success ? categoryResult.data : 'IMAGE';

    const organizationId = req.user.organizationId;
    const userId = req.user.id;

    const data = await this.propertiesService.addPropertyMedia(
      organizationId,
      userId,
      propertyId,
      file,
      validCategory,
      ip,
      userAgent
    );

    return {
      success: true,
      data,
    };
  }

  @Delete(':id/media/:mediaId')
  @RequirePermissions(Permission.PROPERTY_UPDATE)
  async removePropertyMedia(
    @Req() req: any,
    @Param('id') propertyId: string,
    @Param('mediaId') mediaId: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string
  ) {
    const organizationId = req.user.organizationId;
    const userId = req.user.id;

    const result = await this.propertiesService.removePropertyMedia(
      organizationId,
      userId,
      propertyId,
      mediaId,
      ip,
      userAgent
    );

    return {
      success: true,
      data: result,
    };
  }
}
