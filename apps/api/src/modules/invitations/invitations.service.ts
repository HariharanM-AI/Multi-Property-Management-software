import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CryptoUtil } from '../../common/crypto.util';
import {
  InviteTeamMemberInput,
  AcceptInvitationInput,
} from '@propertyos/validation';
import {
  TeamInvitationDto,
  InvitationStatus,
  UserRole,
  normalizeEmail,
} from '@propertyos/types';
import * as crypto from 'crypto';

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  private generateRawToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Creates a cryptographically secure team invitation (stores SHA-256 token hash only)
   */
  async createInvitation(
    organizationId: string,
    actorUserId: string,
    input: InviteTeamMemberInput,
    ip?: string,
    userAgent?: string
  ): Promise<{ message: string; invitationId: string; devInvitationToken?: string }> {
    const normalizedEmail = normalizeEmail(input.email);

    // 1. Check if user is already an active member in this organization
    const existingMember = await this.prisma.user.findFirst({
      where: {
        organizationId,
        email: normalizedEmail,
        deletedAt: null,
      },
    });

    if (existingMember) {
      throw new ConflictException('A member with this email address already belongs to this organization.');
    }

    // 2. Check for duplicate pending invitation
    const existingPending = await this.prisma.teamInvitation.findFirst({
      where: {
        organizationId,
        email: normalizedEmail,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    });

    if (existingPending) {
      throw new ConflictException('An active invitation has already been sent to this email address.');
    }

    // 3. Generate raw token and hash
    const rawToken = this.generateRawToken();
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const [invitation] = await this.prisma.$transaction([
      this.prisma.teamInvitation.create({
        data: {
          organizationId,
          invitedById: actorUserId,
          email: normalizedEmail,
          role: input.role as any,
          tokenHash,
          status: 'PENDING',
          expiresAt,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          organizationId,
          userId: actorUserId,
          action: 'TEAM_INVITATION_CREATED',
          resourceType: 'TeamInvitation',
          resourceId: normalizedEmail,
          ipAddress: ip || null,
          userAgent: userAgent || null,
          metadata: {
            email: normalizedEmail,
            role: input.role,
          },
        },
      }),
    ]);

    // Strictly fail-closed: dev token is NEVER exposed in production
    const isDevOrTest = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    const isDevTokensEnabled = process.env.ENABLE_DEV_AUTH_TOKENS === 'true';
    const devInvitationToken = isDevOrTest && isDevTokensEnabled ? rawToken : undefined;

    return {
      message: 'Team invitation created and sent successfully.',
      invitationId: invitation.id,
      ...(devInvitationToken ? { devInvitationToken } : {}),
    };
  }

  /**
   * Lists pending invitations for the authenticated organization
   */
  async listInvitations(organizationId: string): Promise<TeamInvitationDto[]> {
    const invitations = await this.prisma.teamInvitation.findMany({
      where: {
        organizationId,
        status: 'PENDING',
      },
      include: {
        invitedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return invitations.map((inv) => ({
      id: inv.id,
      organizationId: inv.organizationId,
      email: inv.email,
      role: inv.role as UserRole,
      status: inv.status as InvitationStatus,
      invitedBy: inv.invitedBy,
      expiresAt: inv.expiresAt,
      acceptedAt: inv.acceptedAt,
      createdAt: inv.createdAt,
    }));
  }

  /**
   * Accepts an invitation atomically (Creates or activates user, assigns role, updates status)
   */
  async acceptInvitation(
    input: AcceptInvitationInput,
    ip?: string,
    userAgent?: string
  ): Promise<{ message: string }> {
    const tokenHash = this.hashToken(input.token.trim());

    const invitation = await this.prisma.teamInvitation.findUnique({
      where: { tokenHash },
      include: { organization: true },
    });

    if (!invitation || invitation.status !== 'PENDING' || invitation.expiresAt < new Date()) {
      throw new BadRequestException('Invalid, expired, or already-processed invitation token.');
    }

    const email = normalizeEmail(invitation.email);

    await this.prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({
        where: { email },
        include: { userRoles: true },
      });

      if (user) {
        // Enforce strict multi-tenant boundary
        if (user.organizationId !== invitation.organizationId) {
          throw new ConflictException(
            'This email is already associated with another organization account. Multi-organization membership is restricted in Phase 1.'
          );
        }

        // Upsert target role
        const roleRecord = await tx.role.upsert({
          where: { name: invitation.role },
          update: {},
          create: {
            name: invitation.role,
            description: `Role: ${invitation.role}`,
          },
        });

        // Link role if not already assigned
        const hasRole = user.userRoles.some((ur) => ur.roleId === roleRecord.id);
        if (!hasRole) {
          await tx.userRole.create({
            data: {
              userId: user.id,
              roleId: roleRecord.id,
            },
          });
        }

        // Reactivate user if was inactive
        if (!user.isActive) {
          await tx.user.update({
            where: { id: user.id },
            data: { isActive: true },
          });
        }
      } else {
        // New user provisioning requires password, firstName, lastName
        if (!input.password || !input.firstName || !input.lastName) {
          throw new BadRequestException(
            'First name, last name, and password are required for new team member account creation.'
          );
        }

        const passwordHash = await CryptoUtil.hashPassword(input.password);

        user = await tx.user.create({
          data: {
            organizationId: invitation.organizationId,
            email,
            passwordHash,
            firstName: input.firstName.trim(),
            lastName: input.lastName.trim(),
            isActive: true,
          },
          include: { userRoles: true },
        });

        const roleRecord = await tx.role.upsert({
          where: { name: invitation.role },
          update: {},
          create: {
            name: invitation.role,
            description: `Role: ${invitation.role}`,
          },
        });

        await tx.userRole.create({
          data: {
            userId: user.id,
            roleId: roleRecord.id,
          },
        });
      }

      // Mark invitation accepted
      await tx.teamInvitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          organizationId: invitation.organizationId,
          userId: user.id,
          action: 'TEAM_INVITATION_ACCEPTED',
          resourceType: 'TeamInvitation',
          resourceId: invitation.id,
          ipAddress: ip || null,
          userAgent: userAgent || null,
          metadata: {
            email,
            role: invitation.role,
          },
        },
      });
    });

    return { message: 'Invitation accepted successfully. You may now sign in.' };
  }

  /**
   * Cancels a pending invitation
   */
  async cancelInvitation(
    organizationId: string,
    actorUserId: string,
    invitationId: string,
    ip?: string,
    userAgent?: string
  ): Promise<{ message: string }> {
    const invitation = await this.prisma.teamInvitation.findFirst({
      where: {
        id: invitationId,
        organizationId,
      },
    });

    if (!invitation || invitation.status !== 'PENDING') {
      throw new NotFoundException('Pending invitation not found or already processed.');
    }

    await this.prisma.$transaction([
      this.prisma.teamInvitation.update({
        where: { id: invitationId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        },
      }),
      this.prisma.auditLog.create({
        data: {
          organizationId,
          userId: actorUserId,
          action: 'TEAM_INVITATION_CANCELLED',
          resourceType: 'TeamInvitation',
          resourceId: invitationId,
          ipAddress: ip || null,
          userAgent: userAgent || null,
          metadata: {
            email: invitation.email,
          },
        },
      }),
    ]);

    return { message: 'Invitation cancelled successfully.' };
  }

  /**
   * Resends / Renews a pending invitation with a rotated token
   */
  async resendInvitation(
    organizationId: string,
    actorUserId: string,
    invitationId: string,
    ip?: string,
    userAgent?: string
  ): Promise<{ message: string; devInvitationToken?: string }> {
    const invitation = await this.prisma.teamInvitation.findFirst({
      where: {
        id: invitationId,
        organizationId,
      },
    });

    if (!invitation || invitation.status !== 'PENDING') {
      throw new NotFoundException('Pending invitation not found or already processed.');
    }

    const rawToken = this.generateRawToken();
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.$transaction([
      this.prisma.teamInvitation.update({
        where: { id: invitationId },
        data: {
          tokenHash,
          expiresAt,
          updatedAt: new Date(),
        },
      }),
      this.prisma.auditLog.create({
        data: {
          organizationId,
          userId: actorUserId,
          action: 'TEAM_INVITATION_RESENT',
          resourceType: 'TeamInvitation',
          resourceId: invitationId,
          ipAddress: ip || null,
          userAgent: userAgent || null,
          metadata: {
            email: invitation.email,
          },
        },
      }),
    ]);

    const isDevOrTest = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    const isDevTokensEnabled = process.env.ENABLE_DEV_AUTH_TOKENS === 'true';
    const devInvitationToken = isDevOrTest && isDevTokensEnabled ? rawToken : undefined;

    return {
      message: 'Invitation renewed and resent successfully.',
      ...(devInvitationToken ? { devInvitationToken } : {}),
    };
  }
}
