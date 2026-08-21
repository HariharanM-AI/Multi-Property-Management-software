import { Test, TestingModule } from '@nestjs/testing';
import { TeamService } from './team.service';
import { PrismaService } from '../../database/prisma.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@propertyos/types';

describe('TeamService (CORE-003)', () => {
  let service: TeamService;

  const mockPrisma = {
    user: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    userRole: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
    role: {
      upsert: jest.fn(),
    },
    session: {
      deleteMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<TeamService>(TeamService);
    jest.clearAllMocks();
  });

  describe('listTeamMembers', () => {
    it('should return team members with their assigned roles', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          email: 'owner@property.local',
          firstName: 'Rajesh',
          lastName: 'Sharma',
          phone: '9845012345',
          isActive: true,
          lastLoginAt: new Date(),
          createdAt: new Date(),
          userRoles: [{ role: { name: 'OWNER' } }],
        },
        {
          id: 'user-2',
          email: 'manager@property.local',
          firstName: 'Amit',
          lastName: 'Verma',
          phone: '9845012346',
          isActive: true,
          lastLoginAt: null,
          createdAt: new Date(),
          userRoles: [{ role: { name: 'PROPERTY_MANAGER' } }],
        },
      ];

      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await service.listTeamMembers('org-1');
      expect(result).toHaveLength(2);
      expect(result[0].roles).toContain(UserRole.OWNER);
      expect(result[1].roles).toContain(UserRole.PROPERTY_MANAGER);
    });
  });

  describe('updateMemberRole — Owner Safeguards & Privilege Escalation', () => {
    it('should throw BadRequestException if actor attempts to modify their own role', async () => {
      await expect(
        service.updateMemberRole(
          'org-1',
          'user-1',
          [UserRole.OWNER],
          'user-1', // same user
          UserRole.PROPERTY_MANAGER
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException if non-owner attempts to assign OWNER role', async () => {
      await expect(
        service.updateMemberRole(
          'org-1',
          'user-2',
          [UserRole.PROPERTY_MANAGER], // not owner
          'user-3',
          UserRole.OWNER
        )
      ).rejects.toThrow(ForbiddenException);
    });

    it('should prevent demoting the last active OWNER of the organization', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        organizationId: 'org-1',
        userRoles: [{ role: { name: 'OWNER' } }],
      });

      // Only 1 owner exists in org
      mockPrisma.userRole.findMany.mockResolvedValue([{ id: 'ur-1' }]);

      await expect(
        service.updateMemberRole(
          'org-1',
          'user-super-actor',
          [UserRole.OWNER],
          'user-1',
          UserRole.PROPERTY_MANAGER
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully update member role when constraints are satisfied', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-3',
        organizationId: 'org-1',
        userRoles: [{ role: { name: 'WARDEN' } }],
      });
      mockPrisma.role.upsert.mockResolvedValue({ id: 'role-accountant', name: 'ACCOUNTANT' });
      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await service.updateMemberRole(
        'org-1',
        'user-1',
        [UserRole.OWNER],
        'user-3',
        UserRole.ACCOUNTANT
      );

      expect(result.roles).toContain(UserRole.ACCOUNTANT);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('deactivateMember & Session Invalidation', () => {
    it('should throw BadRequestException if actor attempts to deactivate own account', async () => {
      await expect(
        service.deactivateMember('org-1', 'user-1', 'user-1')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if attempting to deactivate the last active OWNER', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-target-owner',
        organizationId: 'org-1',
        userRoles: [{ role: { name: 'OWNER' } }],
      });
      mockPrisma.userRole.findMany.mockResolvedValue([{ id: 'ur-1' }]); // only 1 owner

      await expect(
        service.deactivateMember('org-1', 'actor-id', 'user-target-owner')
      ).rejects.toThrow(BadRequestException);
    });

    it('should deactivate member and REVOKE all their active sessions', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-manager',
        organizationId: 'org-1',
        userRoles: [{ role: { name: 'PROPERTY_MANAGER' } }],
      });
      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await service.deactivateMember('org-1', 'actor-owner', 'user-manager');

      expect(result.message).toContain('deactivated');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('reactivateMember', () => {
    it('should reactivate a deactivated member', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-manager',
        organizationId: 'org-1',
      });
      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await service.reactivateMember('org-1', 'actor-owner', 'user-manager');
      expect(result.message).toContain('reactivated');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });
});
