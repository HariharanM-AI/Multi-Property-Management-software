import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationsService } from './organizations.service';
import { PrismaService } from '../../database/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('OrganizationsService (CORE-003)', () => {
  let service: OrganizationsService;

  const mockPrisma = {
    organization: {
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
        OrganizationsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<OrganizationsService>(OrganizationsService);
    jest.clearAllMocks();
  });

  describe('getOrganization', () => {
    it('should retrieve organization profile with member and property counts', async () => {
      const mockOrg = {
        id: 'org-1',
        name: 'Omkar Living Spaces',
        legalName: 'Omkar Living Spaces Pvt Ltd',
        taxIdGst: '29ABCDE1234F1Z5',
        phone: '9845012345',
        email: 'info@omkarliving.in',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        _count: {
          users: 5,
          properties: 2,
        },
      };

      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);

      const result = await service.getOrganization('org-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('org-1');
      expect(result.name).toBe('Omkar Living Spaces');
      expect(result.memberCount).toBe(5);
      expect(result.propertyCount).toBe(2);
    });

    it('should throw NotFoundException if organization does not exist', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await expect(service.getOrganization('non-existent-org')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('updateOrganization', () => {
    it('should atomically update organization details and record audit log', async () => {
      const mockExisting = {
        id: 'org-1',
        name: 'Old Name',
        deletedAt: null,
      };

      const mockUpdated = {
        id: 'org-1',
        name: 'New Name Pvt Ltd',
        legalName: 'New Name Legal Pvt Ltd',
        taxIdGst: '29ABCDE1234F1Z5',
        phone: '9845012345',
        email: 'contact@newname.in',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        _count: {
          users: 5,
          properties: 2,
        },
      };

      mockPrisma.organization.findUnique.mockResolvedValue(mockExisting);
      mockPrisma.$transaction.mockResolvedValue([mockUpdated, {}]);

      const result = await service.updateOrganization(
        'org-1',
        'user-1',
        {
          name: 'New Name Pvt Ltd',
          legalName: 'New Name Legal Pvt Ltd',
          taxIdGst: '29ABCDE1234F1Z5',
          phone: '9845012345',
          email: 'contact@newname.in',
        },
        '127.0.0.1',
        'Jest-Test'
      );

      expect(result).toBeDefined();
      expect(result.name).toBe('New Name Pvt Ltd');
      expect(result.taxIdGst).toBe('29ABCDE1234F1Z5');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });
});
