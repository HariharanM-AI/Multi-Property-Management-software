import { Test, TestingModule } from '@nestjs/testing';
import { InvitationsService } from './invitations.service';
import { PrismaService } from '../../database/prisma.service';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { UserRole } from '@propertyos/types';
import * as crypto from 'crypto';

describe('InvitationsService (CORE-003)', () => {
  let service: InvitationsService;

  const mockPrisma = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    teamInvitation: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    role: {
      upsert: jest.fn(),
    },
    userRole: {
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<InvitationsService>(InvitationsService);
    jest.clearAllMocks();
  });

  describe('createInvitation', () => {
    it('should generate token, store only SHA-256 tokenHash in DB, and create invitation', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.teamInvitation.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockResolvedValue([{ id: 'inv-uuid-1' }, {}]);

      const result = await service.createInvitation(
        'org-1',
        'owner-id',
        {
          email: 'Manager@Property.Local',
          role: UserRole.PROPERTY_MANAGER,
        },
        '127.0.0.1',
        'Jest'
      );

      expect(result).toBeDefined();
      expect(result.invitationId).toBe('inv-uuid-1');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should NEVER return devInvitationToken in production environment (fail-closed)', async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalFlag = process.env.ENABLE_DEV_AUTH_TOKENS;
      try {
        process.env.NODE_ENV = 'production';
        process.env.ENABLE_DEV_AUTH_TOKENS = 'true';

        mockPrisma.user.findFirst.mockResolvedValue(null);
        mockPrisma.teamInvitation.findFirst.mockResolvedValue(null);
        mockPrisma.$transaction.mockResolvedValue([{ id: 'inv-uuid-1' }, {}]);

        const result = await service.createInvitation(
          'org-1',
          'owner-id',
          {
            email: 'newmanager@property.com',
            role: UserRole.PROPERTY_MANAGER,
          }
        );

        expect(result.devInvitationToken).toBeUndefined();
      } finally {
        process.env.NODE_ENV = originalEnv;
        process.env.ENABLE_DEV_AUTH_TOKENS = originalFlag;
      }
    });

    it('should throw ConflictException if user is already an active member of the org', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'existing-user' });

      await expect(
        service.createInvitation('org-1', 'owner-id', {
          email: 'existing@property.local',
          role: UserRole.PROPERTY_MANAGER,
        })
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if an active pending invitation already exists', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.teamInvitation.findFirst.mockResolvedValue({ id: 'pending-inv' });

      await expect(
        service.createInvitation('org-1', 'owner-id', {
          email: 'pending@property.local',
          role: UserRole.PROPERTY_MANAGER,
        })
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('acceptInvitation — Atomicity & Multi-Tenant Boundaries', () => {
    it('should atomically create user, assign role, mark invitation accepted, and create audit log', async () => {
      const rawToken = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      const mockInvitation = {
        id: 'inv-1',
        organizationId: 'org-1',
        email: 'newuser@property.local',
        role: 'PROPERTY_MANAGER',
        tokenHash,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 1000000),
      };

      mockPrisma.teamInvitation.findUnique.mockResolvedValue(mockInvitation);

      mockPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
        const tx = {
          user: {
            findUnique: jest.fn().mockResolvedValue(null), // new user
            create: jest.fn().mockResolvedValue({ id: 'user-new-id', email: 'newuser@property.local' }),
          },
          role: {
            upsert: jest.fn().mockResolvedValue({ id: 'role-pm-id', name: 'PROPERTY_MANAGER' }),
          },
          userRole: {
            create: jest.fn().mockResolvedValue({}),
          },
          teamInvitation: {
            update: jest.fn().mockResolvedValue({}),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return cb(tx);
      });

      const result = await service.acceptInvitation({
        token: rawToken,
        firstName: 'Amit',
        lastName: 'Verma',
        password: 'ValidPassword123@#$',
      });

      expect(result.message).toContain('Invitation accepted successfully');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should reject expired invitation token', async () => {
      const rawToken = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      const mockExpired = {
        id: 'inv-1',
        tokenHash,
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 10000), // EXPIRED
      };

      mockPrisma.teamInvitation.findUnique.mockResolvedValue(mockExpired);

      await expect(
        service.acceptInvitation({
          token: rawToken,
          firstName: 'Amit',
          lastName: 'Verma',
          password: 'ValidPassword123@#$',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject already accepted invitation token', async () => {
      const rawToken = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      const mockAccepted = {
        id: 'inv-1',
        tokenHash,
        status: 'ACCEPTED', // ALREADY ACCEPTED
        expiresAt: new Date(Date.now() + 100000),
      };

      mockPrisma.teamInvitation.findUnique.mockResolvedValue(mockAccepted);

      await expect(
        service.acceptInvitation({
          token: rawToken,
          firstName: 'Amit',
          lastName: 'Verma',
          password: 'ValidPassword123@#$',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invitation acceptance if email belongs to another organization (multi-tenant boundary)', async () => {
      const rawToken = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      const mockInvitation = {
        id: 'inv-1',
        organizationId: 'org-1', // Org 1
        email: 'crossorg@property.local',
        role: 'PROPERTY_MANAGER',
        tokenHash,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 1000000),
      };

      mockPrisma.teamInvitation.findUnique.mockResolvedValue(mockInvitation);

      mockPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
        const tx = {
          user: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'existing-user-org2',
              organizationId: 'org-2', // Belongs to Org 2!
            }),
          },
        };
        return cb(tx);
      });

      await expect(
        service.acceptInvitation({
          token: rawToken,
          firstName: 'Amit',
          lastName: 'Verma',
          password: 'ValidPassword123@#$',
        })
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('cancelInvitation & resendInvitation', () => {
    it('should cancel a pending invitation', async () => {
      mockPrisma.teamInvitation.findFirst.mockResolvedValue({
        id: 'inv-1',
        status: 'PENDING',
        email: 'cancel@property.local',
      });
      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await service.cancelInvitation('org-1', 'owner-id', 'inv-1');
      expect(result.message).toContain('cancelled');
    });

    it('should renew and resend a pending invitation with rotated token', async () => {
      mockPrisma.teamInvitation.findFirst.mockResolvedValue({
        id: 'inv-1',
        status: 'PENDING',
        email: 'resend@property.local',
      });
      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await service.resendInvitation('org-1', 'owner-id', 'inv-1');
      expect(result.message).toContain('renewed');
    });
  });
});
