import {
  Controller,
  Get,
  Patch,
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
import { TeamService } from './team.service';
import { CurrentUser, CurrentOrg } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UpdateMemberRoleSchema, UpdateMemberRoleInput } from '@propertyos/validation';
import { TeamMemberDto, AuthUser, Permission, UserRole } from '@propertyos/types';

@Controller('team')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.TEAM_READ)
  async listTeamMembers(@CurrentOrg() orgId: string): Promise<TeamMemberDto[]> {
    return this.teamService.listTeamMembers(orgId);
  }

  @Patch(':userId/role')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.TEAM_UPDATE)
  @UsePipes(new ZodValidationPipe(UpdateMemberRoleSchema))
  async updateMemberRole(
    @CurrentOrg() orgId: string,
    @CurrentUser() user: AuthUser,
    @Param('userId') targetUserId: string,
    @Body() body: UpdateMemberRoleInput,
    @Req() req: Request
  ): Promise<{ message: string; roles: UserRole[] }> {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.teamService.updateMemberRole(
      orgId,
      user.id,
      user.roles,
      targetUserId,
      body.role,
      ip,
      userAgent
    );
  }

  @Post(':userId/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.TEAM_UPDATE)
  async deactivateMember(
    @CurrentOrg() orgId: string,
    @CurrentUser() user: AuthUser,
    @Param('userId') targetUserId: string,
    @Req() req: Request
  ): Promise<{ message: string }> {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.teamService.deactivateMember(orgId, user.id, targetUserId, ip, userAgent);
  }

  @Post(':userId/reactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.TEAM_UPDATE)
  async reactivateMember(
    @CurrentOrg() orgId: string,
    @CurrentUser() user: AuthUser,
    @Param('userId') targetUserId: string,
    @Req() req: Request
  ): Promise<{ message: string }> {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.teamService.reactivateMember(orgId, user.id, targetUserId, ip, userAgent);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.TEAM_REMOVE)
  async removeMember(
    @CurrentOrg() orgId: string,
    @CurrentUser() user: AuthUser,
    @Param('userId') targetUserId: string,
    @Req() req: Request
  ): Promise<{ message: string }> {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.teamService.removeMember(orgId, user.id, targetUserId, ip, userAgent);
  }
}
