import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UsePipes,
} from '@nestjs/common';
import { Request } from 'express';
import { InvitationsService } from './invitations.service';
import { CurrentUser, CurrentOrg } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  InviteTeamMemberSchema,
  AcceptInvitationSchema,
  InviteTeamMemberInput,
  AcceptInvitationInput,
} from '@propertyos/validation';
import { TeamInvitationDto, AuthUser, Permission } from '@propertyos/types';
import { Throttle } from '@nestjs/throttler';

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.TEAM_INVITE)
  @Throttle({ default: { limit: 10, ttl: 900000 } })
  @UsePipes(new ZodValidationPipe(InviteTeamMemberSchema))
  async createInvitation(
    @CurrentOrg() orgId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: InviteTeamMemberInput,
    @Req() req: Request
  ): Promise<{ message: string; invitationId: string; devInvitationToken?: string }> {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.invitationsService.createInvitation(orgId, user.id, body, ip, userAgent);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.TEAM_READ)
  async listInvitations(@CurrentOrg() orgId: string): Promise<TeamInvitationDto[]> {
    return this.invitationsService.listInvitations(orgId);
  }

  @Public()
  @Post('accept')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @UsePipes(new ZodValidationPipe(AcceptInvitationSchema))
  async acceptInvitation(
    @Body() body: AcceptInvitationInput,
    @Req() req: Request
  ): Promise<{ message: string }> {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.invitationsService.acceptInvitation(body, ip, userAgent);
  }

  @Post(':id/resend')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.TEAM_INVITE)
  @Throttle({ default: { limit: 10, ttl: 900000 } })
  async resendInvitation(
    @CurrentOrg() orgId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') invitationId: string,
    @Req() req: Request
  ): Promise<{ message: string; devInvitationToken?: string }> {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.invitationsService.resendInvitation(orgId, user.id, invitationId, ip, userAgent);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.TEAM_INVITE)
  async cancelInvitation(
    @CurrentOrg() orgId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') invitationId: string,
    @Req() req: Request
  ): Promise<{ message: string }> {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.invitationsService.cancelInvitation(orgId, user.id, invitationId, ip, userAgent);
  }
}
