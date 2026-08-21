import {
  Controller,
  Get,
  Patch,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UsePipes,
} from '@nestjs/common';
import { Request } from 'express';
import { OrganizationsService } from './organizations.service';
import { CurrentUser, CurrentOrg } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UpdateOrganizationSchema, UpdateOrganizationInput } from '@propertyos/validation';
import { OrganizationDto, AuthUser, Permission } from '@propertyos/types';

@Controller('organization')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ORGANIZATION_READ)
  async getOrganization(@CurrentOrg() orgId: string): Promise<OrganizationDto> {
    return this.organizationsService.getOrganization(orgId);
  }

  @Patch()
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ORGANIZATION_UPDATE)
  @UsePipes(new ZodValidationPipe(UpdateOrganizationSchema))
  async updateOrganization(
    @CurrentOrg() orgId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: UpdateOrganizationInput,
    @Req() req: Request
  ): Promise<OrganizationDto> {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.organizationsService.updateOrganization(orgId, user.id, body, ip, userAgent);
  }
}
