import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  Ip,
  Headers,
} from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantOrgGuard } from '../../common/guards/tenant-org.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AgreementTemplateService } from './agreement-template.service';
import { AgreementsService } from './agreements.service';
import {
  Permission,
  CreateAgreementTemplateDto,
  UpdateAgreementTemplateDto,
  CreateAgreementDto,
  GenerateAgreementDto,
  SignAgreementDto,
  FinalizeAgreementDto,
  CancelAgreementDto,
  AgreementStatus,
  AgreementType,
  TemplateStatus,
} from '@propertyos/types';
import {
  CreateAgreementTemplateSchema,
  UpdateAgreementTemplateSchema,
  CreateAgreementSchema,
  GenerateAgreementSchema,
  SignAgreementSchema,
  FinalizeAgreementSchema,
  CancelAgreementSchema,
  AgreementFilterSchema,
} from '@propertyos/validation';

@Controller('')
@UseGuards(AuthGuard, TenantOrgGuard, PermissionsGuard)
export class AgreementsController {
  constructor(
    private readonly templateService: AgreementTemplateService,
    private readonly agreementsService: AgreementsService
  ) {}

  // --------------------------------------------------------------------------
  // TEMPLATE ENDPOINTS
  // --------------------------------------------------------------------------

  @Post('agreement-templates')
  @RequirePermissions(Permission.AGREEMENT_TEMPLATE_CREATE)
  async createTemplate(@Req() req: any, @Body() body: any) {
    const validated = CreateAgreementTemplateSchema.parse(body);
    const result = await this.templateService.createTemplate(
      req.organizationId,
      validated as CreateAgreementTemplateDto,
      req.user?.id
    );
    return { success: true, data: result };
  }

  @Get('agreement-templates')
  @RequirePermissions(Permission.AGREEMENT_TEMPLATE_READ)
  async listTemplates(
    @Req() req: any,
    @Query('status') status?: TemplateStatus,
    @Query('agreementType') agreementType?: AgreementType,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    const result = await this.templateService.listTemplates(req.organizationId, {
      status,
      agreementType,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return { success: true, ...result };
  }

  @Get('agreement-templates/:templateId')
  @RequirePermissions(Permission.AGREEMENT_TEMPLATE_READ)
  async getTemplate(@Req() req: any, @Param('templateId') templateId: string) {
    const result = await this.templateService.getTemplate(req.organizationId, templateId);
    return { success: true, data: result };
  }

  @Patch('agreement-templates/:templateId')
  @RequirePermissions(Permission.AGREEMENT_TEMPLATE_UPDATE)
  async updateTemplate(
    @Req() req: any,
    @Param('templateId') templateId: string,
    @Body() body: any
  ) {
    const validated = UpdateAgreementTemplateSchema.parse(body);
    const result = await this.templateService.updateTemplate(
      req.organizationId,
      templateId,
      validated as UpdateAgreementTemplateDto,
      req.user?.id
    );
    return { success: true, data: result };
  }

  @Post('agreement-templates/:templateId/activate')
  @RequirePermissions(Permission.AGREEMENT_TEMPLATE_UPDATE)
  async activateTemplate(@Req() req: any, @Param('templateId') templateId: string) {
    const result = await this.templateService.activateTemplate(
      req.organizationId,
      templateId,
      req.user?.id
    );
    return { success: true, data: result };
  }

  @Post('agreement-templates/:templateId/archive')
  @RequirePermissions(Permission.AGREEMENT_TEMPLATE_ARCHIVE)
  async archiveTemplate(@Req() req: any, @Param('templateId') templateId: string) {
    const result = await this.templateService.archiveTemplate(
      req.organizationId,
      templateId,
      req.user?.id
    );
    return { success: true, data: result };
  }

  // --------------------------------------------------------------------------
  // AGREEMENT ENDPOINTS
  // --------------------------------------------------------------------------

  @Post('properties/:propertyId/agreements')
  @RequirePermissions(Permission.AGREEMENT_CREATE)
  async createAgreement(
    @Req() req: any,
    @Param('propertyId') propertyId: string,
    @Body() body: any
  ) {
    const validated = CreateAgreementSchema.parse(body);
    const result = await this.agreementsService.createAgreement(
      req.organizationId,
      propertyId,
      validated as CreateAgreementDto,
      req.user?.id
    );
    return { success: true, data: result };
  }

  @Get('properties/:propertyId/agreements')
  @RequirePermissions(Permission.AGREEMENT_READ)
  async listPropertyAgreements(
    @Req() req: any,
    @Param('propertyId') propertyId: string,
    @Query() query: any
  ) {
    const validated = AgreementFilterSchema.parse(query);
    const result = await this.agreementsService.listAgreements(req.organizationId, {
      ...validated,
      propertyId,
    });
    return { success: true, ...result };
  }

  @Get('agreements')
  @RequirePermissions(Permission.AGREEMENT_READ)
  async listAgreements(@Req() req: any, @Query() query: any) {
    const validated = AgreementFilterSchema.parse(query);
    const result = await this.agreementsService.listAgreements(req.organizationId, validated);
    return { success: true, ...result };
  }

  @Get('agreements/summary')
  @RequirePermissions(Permission.AGREEMENT_READ)
  async getSummary(@Req() req: any, @Query('propertyId') propertyId?: string) {
    const result = await this.agreementsService.getSummary(req.organizationId, propertyId);
    return { success: true, data: result };
  }

  @Get('agreements/:agreementId')
  @RequirePermissions(Permission.AGREEMENT_READ)
  async getAgreement(@Req() req: any, @Param('agreementId') agreementId: string) {
    const result = await this.agreementsService.getAgreement(req.organizationId, agreementId);
    return { success: true, data: result };
  }

  @Post('agreements/:agreementId/generate')
  @RequirePermissions(Permission.AGREEMENT_GENERATE)
  async generateAgreement(
    @Req() req: any,
    @Param('agreementId') agreementId: string,
    @Body() body: any
  ) {
    const validated = GenerateAgreementSchema.parse(body);
    const result = await this.agreementsService.generateAgreement(
      req.organizationId,
      agreementId,
      validated as GenerateAgreementDto,
      req.user?.id
    );
    return { success: true, data: result };
  }

  @Post('agreements/:agreementId/send-for-signature')
  @RequirePermissions(Permission.AGREEMENT_UPDATE)
  async sendForSignature(@Req() req: any, @Param('agreementId') agreementId: string) {
    const result = await this.agreementsService.sendForSignature(
      req.organizationId,
      agreementId,
      req.user?.id
    );
    return { success: true, data: result };
  }

  @Post('agreements/:agreementId/sign')
  @RequirePermissions(Permission.AGREEMENT_SIGN)
  async signAgreement(
    @Req() req: any,
    @Param('agreementId') agreementId: string,
    @Body() body: any,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string
  ) {
    const validated = SignAgreementSchema.parse(body);
    const result = await this.agreementsService.signAgreement(
      req.organizationId,
      agreementId,
      {
        ...(validated as SignAgreementDto),
        ipAddress: validated.ipAddress || ipAddress,
        userAgent: validated.userAgent || userAgent,
      },
      req.user
    );
    return { success: true, data: result };
  }

  @Post('agreements/:agreementId/finalize')
  @RequirePermissions(Permission.AGREEMENT_FINALIZE)
  async finalizeAgreement(
    @Req() req: any,
    @Param('agreementId') agreementId: string,
    @Body() body: any
  ) {
    const validated = FinalizeAgreementSchema.parse(body);
    const result = await this.agreementsService.finalizeAgreement(
      req.organizationId,
      agreementId,
      validated as FinalizeAgreementDto,
      req.user?.id
    );
    return { success: true, data: result };
  }

  @Post('agreements/:agreementId/cancel')
  @RequirePermissions(Permission.AGREEMENT_CANCEL)
  async cancelAgreement(
    @Req() req: any,
    @Param('agreementId') agreementId: string,
    @Body() body: any
  ) {
    const validated = CancelAgreementSchema.parse(body);
    const result = await this.agreementsService.cancelAgreement(
      req.organizationId,
      agreementId,
      validated as CancelAgreementDto,
      req.user?.id
    );
    return { success: true, data: result };
  }

  @Post('agreements/:agreementId/new-version')
  @RequirePermissions(Permission.AGREEMENT_CREATE)
  async createNewVersion(@Req() req: any, @Param('agreementId') agreementId: string, @Body() body: any) {
    const result = await this.agreementsService.createNewVersion(
      req.organizationId,
      agreementId,
      body,
      req.user?.id
    );
    return { success: true, data: result };
  }

  @Get('agreements/:agreementId/signatures')
  @RequirePermissions(Permission.AGREEMENT_READ)
  async getSignatures(@Req() req: any, @Param('agreementId') agreementId: string) {
    const result = await this.agreementsService.getSignatures(req.organizationId, agreementId);
    return { success: true, data: result };
  }

  @Get('agreements/:agreementId/document')
  @RequirePermissions(Permission.AGREEMENT_READ)
  async getDocument(@Req() req: any, @Param('agreementId') agreementId: string) {
    const result = await this.agreementsService.getDocument(req.organizationId, agreementId);
    return { success: true, data: result };
  }

  @Get('tenants/:tenantId/agreements')
  @RequirePermissions(Permission.AGREEMENT_READ)
  async listTenantAgreements(
    @Req() req: any,
    @Param('tenantId') tenantId: string,
    @Query() query: any
  ) {
    const validated = AgreementFilterSchema.parse(query);
    const result = await this.agreementsService.listAgreements(req.organizationId, {
      ...validated,
      tenantId,
    });
    return { success: true, ...result };
  }
}
