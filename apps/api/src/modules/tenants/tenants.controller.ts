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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TenantsService } from './tenants.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantOrgGuard } from '../../common/guards/tenant-org.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission, TenantStatus, KycDocumentType, AuthenticatedUser } from '@propertyos/types';
import {
  CreateTenantSchema,
  UpdateTenantSchema,
  VerifyDocumentSchema,
} from '@propertyos/validation';

@Controller('tenants')
@UseGuards(AuthGuard, TenantOrgGuard, PermissionsGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @RequirePermissions(Permission.TENANT_CREATE)
  async createTenant(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: any
  ) {
    const parseResult = CreateTenantSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: parseResult.error.errors,
      });
    }

    const tenant = await this.tenantsService.createTenant(
      user.organizationId,
      user.id,
      parseResult.data
    );

    return {
      success: true,
      data: tenant,
    };
  }

  @Get()
  @RequirePermissions(Permission.TENANT_READ)
  async listTenants(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: TenantStatus,
    @Query('search') search?: string
  ) {
    const tenants = await this.tenantsService.listTenants(user.organizationId, {
      status,
      search,
    });

    return {
      success: true,
      data: tenants,
    };
  }

  @Get(':id')
  @RequirePermissions(Permission.TENANT_READ)
  async getTenantDetails(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') tenantId: string
  ) {
    const details = await this.tenantsService.getTenantDetails(
      user.organizationId,
      tenantId
    );

    return {
      success: true,
      data: details,
    };
  }

  @Patch(':id')
  @RequirePermissions(Permission.TENANT_UPDATE)
  async updateTenant(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') tenantId: string,
    @Body() body: any
  ) {
    const parseResult = UpdateTenantSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: parseResult.error.errors,
      });
    }

    const updated = await this.tenantsService.updateTenant(
      user.organizationId,
      tenantId,
      user.id,
      parseResult.data
    );

    return {
      success: true,
      data: updated,
    };
  }

  @Delete(':id')
  @RequirePermissions(Permission.TENANT_DELETE)
  async deleteTenant(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') tenantId: string
  ) {
    const result = await this.tenantsService.deleteTenant(
      user.organizationId,
      tenantId,
      user.id
    );

    return {
      success: true,
      data: result,
    };
  }

  @Post(':id/documents')
  @RequirePermissions(Permission.TENANT_KYC_UPLOAD)
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') tenantId: string,
    @UploadedFile() file: any,
    @Body('documentType') documentType: KycDocumentType,
    @Body('documentNumber') documentNumber?: string
  ) {
    if (!documentType || !Object.values(KycDocumentType).includes(documentType)) {
      throw new BadRequestException('Invalid or missing documentType');
    }

    const doc = await this.tenantsService.uploadDocument(
      user.organizationId,
      tenantId,
      user.id,
      file,
      documentType,
      documentNumber
    );

    return {
      success: true,
      data: doc,
    };
  }

  @Post(':id/documents/:docId/verify')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.TENANT_KYC_VERIFY)
  async verifyDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') tenantId: string,
    @Param('docId') docId: string,
    @Body() body: any
  ) {
    const parseResult = VerifyDocumentSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: parseResult.error.errors,
      });
    }

    const verified = await this.tenantsService.verifyDocument(
      user.organizationId,
      tenantId,
      docId,
      user.id,
      parseResult.data
    );

    return {
      success: true,
      data: verified,
    };
  }

  @Post(':id/assign-bed')
  @RequirePermissions(Permission.TENANT_UPDATE)
  async assignBed(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') tenantId: string,
    @Body() body: any
  ) {
    if (!body.propertyId || !body.bedId) {
      throw new BadRequestException('propertyId and bedId are required');
    }

    const result = await this.tenantsService.assignBed(
      user.organizationId,
      tenantId,
      user.id,
      {
        propertyId: body.propertyId,
        bedId: body.bedId,
        monthlyRent: body.monthlyRent !== undefined ? Number(body.monthlyRent) : undefined,
        securityDeposit: body.securityDeposit !== undefined ? Number(body.securityDeposit) : undefined,
        checkInDate: body.checkInDate,
      }
    );

    return {
      success: true,
      data: result,
    };
  }

  @Post(':id/vacate-bed')
  @RequirePermissions(Permission.TENANT_UPDATE)
  async vacateBed(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') tenantId: string,
    @Body() body: any
  ) {
    const result = await this.tenantsService.vacateBed(
      user.organizationId,
      tenantId,
      user.id,
      {
        bedId: body?.bedId,
        checkoutDate: body?.checkoutDate,
      }
    );

    return {
      success: true,
      data: result,
    };
  }

  @Post('vacate-bed-by-bed/:bedId')
  @RequirePermissions(Permission.TENANT_UPDATE)
  async vacateBedByBedId(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bedId') bedId: string,
    @Body() body: any
  ) {
    const result = await this.tenantsService.vacateBedByBedId(
      user.organizationId,
      bedId,
      user.id,
      body?.checkoutDate
    );

    return {
      success: true,
      data: result,
    };
  }

  @Post(':id/quick-verify-kyc')
  @RequirePermissions(Permission.TENANT_KYC_VERIFY)
  async quickVerifyKyc(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') tenantId: string,
    @Body() body: any
  ) {
    const result = await this.tenantsService.quickVerifyKyc(
      user.organizationId,
      tenantId,
      user.id,
      {
        note: body?.note,
      }
    );

    return {
      success: true,
      data: result,
    };
  }

  @Post(':id/quick-reject-kyc')
  @RequirePermissions(Permission.TENANT_KYC_VERIFY)
  async quickRejectKyc(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') tenantId: string,
    @Body() body: any
  ) {
    if (!body.reason) {
      throw new BadRequestException('Rejection reason is required');
    }

    const result = await this.tenantsService.quickRejectKyc(
      user.organizationId,
      tenantId,
      user.id,
      {
        reason: body.reason,
      }
    );

    return {
      success: true,
      data: result,
    };
  }

  @Delete(':id/documents/:docId')
  @RequirePermissions(Permission.TENANT_KYC_DELETE)
  async deleteDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') tenantId: string,
    @Param('docId') docId: string
  ) {
    const result = await this.tenantsService.deleteDocument(
      user.organizationId,
      tenantId,
      docId,
      user.id
    );

    return {
      success: true,
      data: result,
    };
  }
}
