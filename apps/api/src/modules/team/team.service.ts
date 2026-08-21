import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TeamMemberDto, UserRole } from '@propertyos/types';

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lists all team members of the authenticated organization
   */
  async listTeamMembers(organizationId: string): Promise<TeamMemberDto[]> {
    const users = await this.prisma.user.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      phone: u.phone,
      isActive: u.isActive,
      roles: u.userRoles.map((ur) => ur.role.name as UserRole),
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    }));
  }

  /**
   * Helper: Count active owners in an organization
   */
  private async countActiveOwners(organizationId: string): Promise<number> {
    const owners = await this.prisma.userRole.findMany({
      where: {
        role: { name: 'OWNER' },
        user: {
          organizationId,
          isActive: true,
          deletedAt: null,
        },
      },
    });
    return owners.length;
  }

  /**
   * Updates a team member's role with strict Owner protection & privilege escalation safeguards
   */
  async updateMemberRole(
    organizationId: string,
    actorUserId: string,
    actorRoles: UserRole[],
    targetUserId: string,
    newRole: UserRole,
    ip?: string,
    userAgent?: string
  ): Promise<{ message: string; roles: UserRole[] }> {
    if (actorUserId === targetUserId) {
      throw new BadRequestException('You cannot modify your own role.');
    }

    // Only OWNER can assign or promote to OWNER role
    if (newRole === UserRole.OWNER && !actorRoles.includes(UserRole.OWNER)) {
      throw new ForbiddenException('Only existing Owners can assign the Owner role.');
    }

    const targetUser = await this.prisma.user.findFirst({
      where: {
        id: targetUserId,
        organizationId,
        deletedAt: null,
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!targetUser) {
      throw new NotFoundException('Team member not found in this organization.');
    }

    const isTargetOwner = targetUser.userRoles.some((ur) => ur.role.name === 'OWNER');

    // If target is currently an Owner and we are changing to a non-Owner role, verify owner count
    if (isTargetOwner && newRole !== UserRole.OWNER) {
      const activeOwnerCount = await this.countActiveOwners(organizationId);
      if (activeOwnerCount <= 1) {
        throw new BadRequestException(
          'Cannot change the role of the last active Owner. An organization must always retain at least one active Owner.'
        );
      }
    }

    // Upsert the target role
    const roleRecord = await this.prisma.role.upsert({
      where: { name: newRole as any },
      update: {},
      create: {
        name: newRole as any,
        description: `Team member role: ${newRole}`,
      },
    });

    await this.prisma.$transaction([
      // Remove previous role assignments
      this.prisma.userRole.deleteMany({
        where: { userId: targetUserId },
      }),
      // Assign new role
      this.prisma.userRole.create({
        data: {
          userId: targetUserId,
          roleId: roleRecord.id,
        },
      }),
      // Audit log
      this.prisma.auditLog.create({
        data: {
          organizationId,
          userId: actorUserId,
          action: 'ROLE_CHANGED',
          resourceType: 'User',
          resourceId: targetUserId,
          ipAddress: ip || null,
          userAgent: userAgent || null,
          metadata: {
            previousRoles: targetUser.userRoles.map((ur) => ur.role.name),
            newRole,
          },
        },
      }),
    ]);

    return {
      message: `Team member role updated to ${newRole} successfully.`,
      roles: [newRole],
    };
  }

  /**
   * Deactivates a team member and terminates their active sessions (Cannot deactivate last Owner)
   */
  async deactivateMember(
    organizationId: string,
    actorUserId: string,
    targetUserId: string,
    ip?: string,
    userAgent?: string
  ): Promise<{ message: string }> {
    if (actorUserId === targetUserId) {
      throw new BadRequestException('You cannot deactivate your own account.');
    }

    const targetUser = await this.prisma.user.findFirst({
      where: {
        id: targetUserId,
        organizationId,
        deletedAt: null,
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!targetUser) {
      throw new NotFoundException('Team member not found in this organization.');
    }

    const isTargetOwner = targetUser.userRoles.some((ur) => ur.role.name === 'OWNER');
    if (isTargetOwner) {
      const activeOwnerCount = await this.countActiveOwners(organizationId);
      if (activeOwnerCount <= 1) {
        throw new BadRequestException(
          'Cannot deactivate the last active Owner of the organization.'
        );
      }
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: targetUserId },
        data: { isActive: false },
      }),
      // Revoke all active sessions for this deactivated member
      this.prisma.session.deleteMany({
        where: { userId: targetUserId },
      }),
      this.prisma.auditLog.create({
        data: {
          organizationId,
          userId: actorUserId,
          action: 'TEAM_MEMBER_DEACTIVATED',
          resourceType: 'User',
          resourceId: targetUserId,
          ipAddress: ip || null,
          userAgent: userAgent || null,
        },
      }),
    ]);

    return { message: 'Team member has been deactivated and active sessions revoked.' };
  }

  /**
   * Reactivates a previously deactivated team member
   */
  async reactivateMember(
    organizationId: string,
    actorUserId: string,
    targetUserId: string,
    ip?: string,
    userAgent?: string
  ): Promise<{ message: string }> {
    const targetUser = await this.prisma.user.findFirst({
      where: {
        id: targetUserId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!targetUser) {
      throw new NotFoundException('Team member not found in this organization.');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: targetUserId },
        data: { isActive: true },
      }),
      this.prisma.auditLog.create({
        data: {
          organizationId,
          userId: actorUserId,
          action: 'TEAM_MEMBER_REACTIVATED',
          resourceType: 'User',
          resourceId: targetUserId,
          ipAddress: ip || null,
          userAgent: userAgent || null,
        },
      }),
    ]);

    return { message: 'Team member has been reactivated successfully.' };
  }

  /**
   * Removes a team member from the organization (soft delete & session invalidation)
   */
  async removeMember(
    organizationId: string,
    actorUserId: string,
    targetUserId: string,
    ip?: string,
    userAgent?: string
  ): Promise<{ message: string }> {
    if (actorUserId === targetUserId) {
      throw new BadRequestException('You cannot remove yourself from the organization.');
    }

    const targetUser = await this.prisma.user.findFirst({
      where: {
        id: targetUserId,
        organizationId,
        deletedAt: null,
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!targetUser) {
      throw new NotFoundException('Team member not found in this organization.');
    }

    const isTargetOwner = targetUser.userRoles.some((ur) => ur.role.name === 'OWNER');
    if (isTargetOwner) {
      const activeOwnerCount = await this.countActiveOwners(organizationId);
      if (activeOwnerCount <= 1) {
        throw new BadRequestException(
          'Cannot remove the last active Owner of the organization.'
        );
      }
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: targetUserId },
        data: {
          isActive: false,
          deletedAt: new Date(),
        },
      }),
      this.prisma.session.deleteMany({
        where: { userId: targetUserId },
      }),
      this.prisma.auditLog.create({
        data: {
          organizationId,
          userId: actorUserId,
          action: 'TEAM_MEMBER_REMOVED',
          resourceType: 'User',
          resourceId: targetUserId,
          ipAddress: ip || null,
          userAgent: userAgent || null,
        },
      }),
    ]);

    return { message: 'Team member removed from organization successfully.' };
  }
}
