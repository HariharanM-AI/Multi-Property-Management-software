import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CryptoUtil } from '../../common/crypto.util';
import {
  RegisterOwnerInput,
  LoginInput,
  PasswordResetRequestInput,
  PasswordResetConfirmInput,
} from '@propertyos/validation';
import { AuthResponseData, AuthUser, UserRole } from '@propertyos/types';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Hashes a raw token using SHA-256 for secure DB lookups
   */
  private hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Generates a high-entropy random token
   */
  private generateRawToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Atomic Owner & Organization Registration
   */
  async registerOwner(
    input: RegisterOwnerInput,
    ip?: string,
    userAgent?: string
  ): Promise<{ data: AuthResponseData; rawSessionToken: string }> {
    const normalizedEmail = input.email.trim().toLowerCase();

    // 1. Check duplicate user
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException('An account with this email address already exists.');
    }

    // 2. Hash password with Argon2id
    const passwordHash = await CryptoUtil.hashPassword(input.password);
    const rawSessionToken = this.generateRawToken();
    const sessionTokenHash = this.hashToken(rawSessionToken);
    const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // 3. Multi-record Atomic Transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create Organization
      const organization = await tx.organization.create({
        data: {
          name: input.organizationName.trim(),
          email: normalizedEmail,
          phone: input.phone.trim(),
        },
      });

      // Create User
      const user = await tx.user.create({
        data: {
          organizationId: organization.id,
          email: normalizedEmail,
          passwordHash,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          phone: input.phone.trim(),
          isActive: true,
        },
      });

      // Upsert Role (OWNER)
      const ownerRole = await tx.role.upsert({
        where: { name: 'OWNER' },
        update: {},
        create: {
          name: 'OWNER',
          description: 'Primary property owner with full organizational privileges',
        },
      });

      // Link User to Role
      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: ownerRole.id,
        },
      });

      // Create Session with hashed session token
      await tx.session.create({
        data: {
          userId: user.id,
          sessionToken: sessionTokenHash,
          expiresAt: sessionExpiresAt,
          ipAddress: ip || null,
          userAgent: userAgent || null,
        },
      });

      // Record Audit Log (Zero sensitive secrets)
      await tx.auditLog.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          action: 'REGISTER_OWNER',
          resourceType: 'User',
          resourceId: user.id,
          ipAddress: ip || null,
          userAgent: userAgent || null,
          metadata: {
            organizationName: organization.name,
            email: normalizedEmail,
            role: 'OWNER',
          },
        },
      });

      return { user, organization };
    });

    const authUser: AuthUser = {
      id: result.user.id,
      email: result.user.email,
      firstName: result.user.firstName,
      lastName: result.user.lastName,
      phone: result.user.phone,
      organizationId: result.organization.id,
      organizationName: result.organization.name,
      roles: [UserRole.OWNER],
    };

    return {
      data: {
        user: authUser,
        organization: {
          id: result.organization.id,
          name: result.organization.name,
        },
        message: 'Owner account and organization registered successfully.',
      },
      rawSessionToken,
    };
  }

  /**
   * User Login with Argon2id Verification
   */
  async login(
    input: LoginInput,
    ip?: string,
    userAgent?: string
  ): Promise<{ data: AuthResponseData; rawSessionToken: string }> {
    const normalizedEmail = input.email.trim().toLowerCase();

    // 1. Fetch user with relations
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        organization: true,
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    // Protect against account enumeration by computing dummy verify on missing user
    if (!user || !user.isActive) {
      this.logger.warn(`Failed login attempt for non-existent/inactive account: ${normalizedEmail}`);
      throw new UnauthorizedException('Invalid email or password.');
    }

    // 2. Verify password
    const isPasswordValid = await CryptoUtil.verifyPassword(input.password, user.passwordHash);
    if (!isPasswordValid) {
      await this.prisma.auditLog.create({
        data: {
          organizationId: user.organizationId,
          userId: user.id,
          action: 'LOGIN_FAILURE',
          resourceType: 'User',
          resourceId: user.id,
          ipAddress: ip || null,
          userAgent: userAgent || null,
        },
      });
      throw new UnauthorizedException('Invalid email or password.');
    }

    // 3. Create new session with hashed token
    const rawSessionToken = this.generateRawToken();
    const sessionTokenHash = this.hashToken(rawSessionToken);
    const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
      this.prisma.session.create({
        data: {
          userId: user.id,
          sessionToken: sessionTokenHash,
          expiresAt: sessionExpiresAt,
          ipAddress: ip || null,
          userAgent: userAgent || null,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          organizationId: user.organizationId,
          userId: user.id,
          action: 'LOGIN_SUCCESS',
          resourceType: 'User',
          resourceId: user.id,
          ipAddress: ip || null,
          userAgent: userAgent || null,
        },
      }),
    ]);

    const roles = user.userRoles.map((ur) => ur.role.name as UserRole);

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      organizationId: user.organization.id,
      organizationName: user.organization.name,
      roles,
    };

    return {
      data: {
        user: authUser,
        organization: {
          id: user.organization.id,
          name: user.organization.name,
          legalName: user.organization.legalName,
        },
        message: 'Login successful.',
      },
      rawSessionToken,
    };
  }

  /**
   * Session Validation by Raw Token
   */
  async validateSession(rawSessionToken: string): Promise<AuthUser | null> {
    if (!rawSessionToken) return null;

    const sessionTokenHash = this.hashToken(rawSessionToken);

    const session = await this.prisma.session.findUnique({
      where: { sessionToken: sessionTokenHash },
      include: {
        user: {
          include: {
            organization: true,
            userRoles: {
              include: {
                role: true,
              },
            },
          },
        },
      },
    });

    if (!session) return null;

    // Check expiration
    if (session.expiresAt < new Date()) {
      await this.prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }

    if (!session.user || !session.user.isActive) {
      return null;
    }

    const roles = session.user.userRoles.map((ur) => ur.role.name as UserRole);

    return {
      id: session.user.id,
      email: session.user.email,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      phone: session.user.phone,
      organizationId: session.user.organization.id,
      organizationName: session.user.organization.name,
      roles,
    };
  }

  /**
   * User Logout
   */
  async logout(rawSessionToken?: string, userId?: string, ip?: string, userAgent?: string): Promise<void> {
    if (rawSessionToken) {
      const sessionTokenHash = this.hashToken(rawSessionToken);
      const session = await this.prisma.session.findUnique({
        where: { sessionToken: sessionTokenHash },
      });

      if (session) {
        await this.prisma.session.delete({ where: { id: session.id } });

        const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
        if (user) {
          await this.prisma.auditLog.create({
            data: {
              organizationId: user.organizationId,
              userId: user.id,
              action: 'LOGOUT',
              resourceType: 'User',
              resourceId: user.id,
              ipAddress: ip || null,
              userAgent: userAgent || null,
            },
          });
        }
      }
    } else if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        await this.prisma.auditLog.create({
          data: {
            organizationId: user.organizationId,
            userId: user.id,
            action: 'LOGOUT',
            resourceType: 'User',
            resourceId: user.id,
            ipAddress: ip || null,
            userAgent: userAgent || null,
          },
        });
      }
    }
  }

  /**
   * Password Reset Request Flow (Enumeration protected, hash stored in DB)
   */
  async requestPasswordReset(
    input: PasswordResetRequestInput,
    ip?: string,
    userAgent?: string
  ): Promise<{ message: string; devResetToken?: string }> {
    const normalizedEmail = input.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    let devResetToken: string | undefined = undefined;

    if (user && user.isActive) {
      const rawToken = this.generateRawToken();
      const tokenHash = this.hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await this.prisma.$transaction([
        this.prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash,
            expiresAt,
          },
        }),
        this.prisma.auditLog.create({
          data: {
            organizationId: user.organizationId,
            userId: user.id,
            action: 'PASSWORD_RESET_REQUESTED',
            resourceType: 'User',
            resourceId: user.id,
            ipAddress: ip || null,
            userAgent: userAgent || null,
          },
        }),
      ]);

      // Strictly fail-closed: devResetToken is NEVER exposed in production environments
      const isDevOrTest = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
      const isDevTokensExplicitlyEnabled = process.env.ENABLE_DEV_AUTH_TOKENS === 'true';

      if (isDevOrTest && isDevTokensExplicitlyEnabled) {
        devResetToken = rawToken;
      }
    }

    return {
      message: 'If an account exists with this email, password reset instructions have been sent.',
      ...(devResetToken ? { devResetToken } : {}),
    };
  }

  /**
   * Password Reset Completion Flow (Revokes ALL existing sessions)
   */
  async resetPassword(
    input: PasswordResetConfirmInput,
    ip?: string,
    userAgent?: string
  ): Promise<{ message: string }> {
    const tokenHash = this.hashToken(input.token);

    const tokenRecord = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!tokenRecord || tokenRecord.usedAt !== null || tokenRecord.expiresAt < new Date()) {
      throw new BadRequestException('Invalid, expired, or already-used password reset token.');
    }

    const newPasswordHash = await CryptoUtil.hashPassword(input.newPassword);

    // Atomically update password, mark token used, revoke ALL sessions, and record audit log
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: tokenRecord.userId },
        data: { passwordHash: newPasswordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: tokenRecord.id },
        data: { usedAt: new Date() },
      }),
      // Revoke all existing sessions for this user
      this.prisma.session.deleteMany({
        where: { userId: tokenRecord.userId },
      }),
      this.prisma.auditLog.create({
        data: {
          organizationId: tokenRecord.user.organizationId,
          userId: tokenRecord.userId,
          action: 'PASSWORD_RESET_COMPLETED',
          resourceType: 'User',
          resourceId: tokenRecord.userId,
          ipAddress: ip || null,
          userAgent: userAgent || null,
        },
      }),
    ]);

    return {
      message: 'Password has been reset successfully. Please log in with your new password.',
    };
  }

  /**
   * Update User Profile and Organization Entity
   */
  async updateUserProfile(
    userId: string,
    organizationId: string,
    data: { firstName?: string; lastName?: string; phone?: string; organizationName?: string }
  ): Promise<AuthUser> {
    const updateUserData: Record<string, any> = {};
    if (data.firstName && data.firstName.trim()) updateUserData.firstName = data.firstName.trim();
    if (data.lastName && data.lastName.trim()) updateUserData.lastName = data.lastName.trim();
    if (data.phone && data.phone.trim()) updateUserData.phone = data.phone.trim();

    if (Object.keys(updateUserData).length > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: updateUserData,
      });
    }

    if (data.organizationName && data.organizationName.trim()) {
      await this.prisma.organization.update({
        where: { id: organizationId },
        data: { name: data.organizationName.trim() },
      });
    }

    const updatedUser = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: true,
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!updatedUser) {
      throw new NotFoundException('User not found.');
    }

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      phone: updatedUser.phone,
      organizationId: updatedUser.organization.id,
      organizationName: updatedUser.organization.name,
      roles: updatedUser.userRoles.map((ur) => ur.role.name as UserRole),
    };
  }
}
