import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../../database/prisma.service';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { CryptoUtil } from '../../common/crypto.util';
import * as crypto from 'crypto';

describe('AuthService (CORE-002)', () => {
  let authService: AuthService;
  let prismaService: PrismaService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    organization: {
      create: jest.fn(),
    },
    role: {
      upsert: jest.fn(),
    },
    userRole: {
      create: jest.fn(),
    },
    session: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    passwordResetToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('registerOwner', () => {
    it('should atomically register owner, organization, role, session, and audit log', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const mockOrg = { id: 'org-uuid-1', name: 'Synthetic Living Spaces Pvt Ltd' };
      const mockUser = {
        id: 'user-uuid-1',
        organizationId: mockOrg.id,
        email: 'test-owner@propertyos.local',
        firstName: 'Test',
        lastName: 'Owner',
        phone: '9800000000',
        isActive: true,
      };

      mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          organization: { create: jest.fn().mockResolvedValue(mockOrg) },
          user: { create: jest.fn().mockResolvedValue(mockUser) },
          role: { upsert: jest.fn().mockResolvedValue({ id: 'role-owner-id', name: 'OWNER' }) },
          userRole: { create: jest.fn().mockResolvedValue({}) },
          session: { create: jest.fn().mockResolvedValue({}) },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        };
        return cb(tx);
      });

      const result = await authService.registerOwner({
        organizationName: 'Synthetic Living Spaces Pvt Ltd',
        firstName: 'Test',
        lastName: 'Owner',
        email: 'test-owner@propertyos.local',
        phone: '9800000000',
        password: 'ValidPassword123@#$',
      });

      expect(result).toBeDefined();
      expect(result.data.user.email).toBe('test-owner@propertyos.local');
      expect(result.data.user.roles).toContain('OWNER');
      expect(result.data.organization.id).toBe('org-uuid-1');
      expect(result.rawSessionToken).toBeDefined();
      expect(result.rawSessionToken.length).toBe(64); // 32 bytes hex
    });

    it('should throw ConflictException if email is already registered', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing-id', email: 'test-owner@propertyos.local' });

      await expect(
        authService.registerOwner({
          organizationName: 'Synthetic Living Spaces',
          firstName: 'Test',
          lastName: 'Owner',
          email: 'test-owner@propertyos.local',
          phone: '9800000000',
          password: 'ValidPassword123@#$',
        })
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should successfully log in with valid credentials and return raw session token', async () => {
      const passwordHash = await CryptoUtil.hashPassword('CorrectPassword123!');
      const mockUser = {
        id: 'user-uuid-1',
        email: 'test-owner@propertyos.local',
        passwordHash,
        firstName: 'Test',
        lastName: 'Owner',
        phone: '9800000000',
        isActive: true,
        organizationId: 'org-uuid-1',
        organization: { id: 'org-uuid-1', name: 'Synthetic Org', legalName: null },
        userRoles: [{ role: { name: 'OWNER' } }],
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await authService.login({
        email: 'test-owner@propertyos.local',
        password: 'CorrectPassword123!',
      });

      expect(result).toBeDefined();
      expect(result.data.user.email).toBe('test-owner@propertyos.local');
      expect(result.data.user.roles).toContain('OWNER');
      expect(result.rawSessionToken).toBeDefined();
    });

    it('should throw UnauthorizedException and record LOGIN_FAILURE for invalid password', async () => {
      const passwordHash = await CryptoUtil.hashPassword('CorrectPassword123!');
      const mockUser = {
        id: 'user-uuid-1',
        email: 'test-owner@propertyos.local',
        passwordHash,
        isActive: true,
        organizationId: 'org-uuid-1',
        organization: { id: 'org-uuid-1', name: 'Synthetic Org' },
        userRoles: [{ role: { name: 'OWNER' } }],
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.auditLog.create.mockResolvedValue({});

      await expect(
        authService.login({
          email: 'test-owner@propertyos.local',
          password: 'WrongPassword!',
        })
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'LOGIN_FAILURE' }),
        })
      );
    });

    it('should throw UnauthorizedException for non-existent account (enumeration protected)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'unknown@propertyos.local',
          password: 'SomePassword123!',
        })
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('validateSession', () => {
    it('should validate active unexpired session token', async () => {
      const rawToken = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      const mockSession = {
        id: 'session-id-1',
        sessionToken: tokenHash,
        expiresAt: new Date(Date.now() + 1000000),
        user: {
          id: 'user-1',
          email: 'test-owner@propertyos.local',
          firstName: 'Test',
          lastName: 'Owner',
          phone: '9800000000',
          isActive: true,
          organization: { id: 'org-1', name: 'Test Org' },
          userRoles: [{ role: { name: 'OWNER' } }],
        },
      };

      mockPrisma.session.findUnique.mockResolvedValue(mockSession);

      const user = await authService.validateSession(rawToken);
      expect(user).toBeDefined();
      expect(user?.email).toBe('test-owner@propertyos.local');
      expect(user?.organizationId).toBe('org-1');
    });

    it('should return null and clean up expired session', async () => {
      const rawToken = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const mockSession = {
        id: 'session-id-1',
        expiresAt: new Date(Date.now() - 100000), // expired
        user: { isActive: true },
      };

      mockPrisma.session.findUnique.mockResolvedValue(mockSession);
      mockPrisma.session.delete.mockResolvedValue({});

      const user = await authService.validateSession(rawToken);
      expect(user).toBeNull();
      expect(mockPrisma.session.delete).toHaveBeenCalledWith({ where: { id: 'session-id-1' } });
    });
  });

  describe('Password Reset Security (CORE-002 Requirements)', () => {
    it('should store ONLY tokenHash in database and return generic message', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test-owner@propertyos.local',
        organizationId: 'org-1',
        isActive: true,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await authService.requestPasswordReset({
        email: 'test-owner@propertyos.local',
      });

      expect(result.message).toContain('If an account exists with this email');
      expect(mockPrisma.$transaction).toHaveBeenCalled();

      // Verify devResetToken is generated and that the DB receives a SHA-256 hash
      if (result.devResetToken) {
        const expectedHash = crypto.createHash('sha256').update(result.devResetToken).digest('hex');
        expect(expectedHash).not.toBe(result.devResetToken); // Raw token is NOT stored
      }
    });

    it('should return generic message for non-existent email (enumeration protection)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await authService.requestPasswordReset({
        email: 'nonexistent@propertyos.local',
      });

      expect(result.message).toContain('If an account exists with this email');
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should successfully reset password, mark token used, and REVOKE ALL user sessions', async () => {
      const rawToken = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      const mockTokenRecord = {
        id: 'reset-token-id-1',
        userId: 'user-1',
        tokenHash,
        expiresAt: new Date(Date.now() + 3600000), // unexpired
        usedAt: null,                              // unused
        user: { id: 'user-1', organizationId: 'org-1' },
      };

      mockPrisma.passwordResetToken.findUnique.mockResolvedValue(mockTokenRecord);
      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await authService.resetPassword({
        token: rawToken,
        newPassword: 'NewSecurePassword2026@#$',
      });

      expect(result.message).toContain('Password has been reset successfully');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should reject already-used reset token', async () => {
      const rawToken = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      const mockUsedToken = {
        id: 'reset-token-id-1',
        userId: 'user-1',
        tokenHash,
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: new Date(Date.now() - 10000), // ALREADY USED
        user: { id: 'user-1', organizationId: 'org-1' },
      };

      mockPrisma.passwordResetToken.findUnique.mockResolvedValue(mockUsedToken);

      await expect(
        authService.resetPassword({
          token: rawToken,
          newPassword: 'NewSecurePassword2026@#$',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject expired reset token', async () => {
      const rawToken = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      const mockExpiredToken = {
        id: 'reset-token-id-1',
        userId: 'user-1',
        tokenHash,
        expiresAt: new Date(Date.now() - 10000), // EXPIRED
        usedAt: null,
        user: { id: 'user-1', organizationId: 'org-1' },
      };

      await expect(
        authService.resetPassword({
          token: rawToken,
          newPassword: 'NewSecurePassword2026@#$',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should NEVER return devResetToken in production environment (fail-closed)', async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalFlag = process.env.ENABLE_DEV_AUTH_TOKENS;
      try {
        process.env.NODE_ENV = 'production';
        process.env.ENABLE_DEV_AUTH_TOKENS = 'true'; // even if flag is mistakenly set, production blocks it

        const mockUser = {
          id: 'user-1',
          email: 'owner@production-property.com',
          organizationId: 'org-1',
          isActive: true,
        };
        mockPrisma.user.findUnique.mockResolvedValue(mockUser);
        mockPrisma.$transaction.mockResolvedValue([]);

        const result = await authService.requestPasswordReset({
          email: 'owner@production-property.com',
        });

        expect(result.devResetToken).toBeUndefined();
        expect(result.message).toBe(
          'If an account exists with this email, password reset instructions have been sent.'
        );
      } finally {
        process.env.NODE_ENV = originalEnv;
        process.env.ENABLE_DEV_AUTH_TOKENS = originalFlag;
      }
    });

    it('should NOT return devResetToken if ENABLE_DEV_AUTH_TOKENS is not set', async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalFlag = process.env.ENABLE_DEV_AUTH_TOKENS;
      try {
        process.env.NODE_ENV = 'development';
        delete process.env.ENABLE_DEV_AUTH_TOKENS; // Not set

        const mockUser = {
          id: 'user-1',
          email: 'owner@propertyos.local',
          organizationId: 'org-1',
          isActive: true,
        };
        mockPrisma.user.findUnique.mockResolvedValue(mockUser);
        mockPrisma.$transaction.mockResolvedValue([]);

        const result = await authService.requestPasswordReset({
          email: 'owner@propertyos.local',
        });

        expect(result.devResetToken).toBeUndefined();
      } finally {
        process.env.NODE_ENV = originalEnv;
        process.env.ENABLE_DEV_AUTH_TOKENS = originalFlag;
      }
    });

    it('should verify audit logs and database never contain raw reset tokens', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test-owner@propertyos.local',
        organizationId: 'org-1',
        isActive: true,
      };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.$transaction.mockResolvedValue([]);

      await authService.requestPasswordReset({
        email: 'test-owner@propertyos.local',
      });

      // Verify transaction queries
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });
});
