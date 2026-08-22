import { Test, TestingModule } from '@nestjs/testing';
import { AgreementTemplateService } from './agreement-template.service';
import { PrismaService } from '../../database/prisma.service';
import { TemplateStatus, AgreementType } from '@propertyos/types';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('AgreementTemplateService', () => {
  let service: AgreementTemplateService;
  let prisma: any;

  const mockOrgId = 'org-template-test-123';
  const mockUserId = 'user-owner-123';

  beforeEach(async () => {
    prisma = {
      agreementTemplate: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgreementTemplateService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AgreementTemplateService>(AgreementTemplateService);
  });

  describe('createTemplate', () => {
    it('creates a new draft template with version 1', async () => {
      const mockCreated = {
        id: 'tmpl-1',
        organizationId: mockOrgId,
        name: 'Standard PG Lease',
        agreementType: AgreementType.PG_AGREEMENT,
        description: 'Standard double sharing lease',
        content: 'Agreement for {{TENANT_NAME}} at {{PROPERTY_NAME}}',
        version: 1,
        status: TemplateStatus.DRAFT,
      };

      prisma.agreementTemplate.create.mockResolvedValue(mockCreated);

      const result = await service.createTemplate(
        mockOrgId,
        {
          name: 'Standard PG Lease',
          agreementType: AgreementType.PG_AGREEMENT,
          description: 'Standard double sharing lease',
          content: 'Agreement for {{TENANT_NAME}} at {{PROPERTY_NAME}}',
        },
        mockUserId
      );

      expect(result.id).toBe('tmpl-1');
      expect(result.version).toBe(1);
      expect(result.status).toBe(TemplateStatus.DRAFT);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'AGREEMENT_TEMPLATE_CREATED',
            resourceType: 'AGREEMENT_TEMPLATE',
          }),
        })
      );
    });
  });

  describe('updateTemplate', () => {
    it('updates in-place if template is DRAFT and has 0 agreements', async () => {
      const existing = {
        id: 'tmpl-1',
        organizationId: mockOrgId,
        name: 'Draft Template',
        agreementType: AgreementType.RENTAL_AGREEMENT,
        description: 'Draft',
        content: 'Original Content',
        version: 1,
        status: TemplateStatus.DRAFT,
        _count: { agreements: 0 },
      };

      prisma.agreementTemplate.findFirst.mockResolvedValue(existing);
      prisma.agreementTemplate.update.mockResolvedValue({
        ...existing,
        name: 'Updated Draft Name',
        content: 'Updated Content',
      });

      const result = await service.updateTemplate(
        mockOrgId,
        'tmpl-1',
        { name: 'Updated Draft Name', content: 'Updated Content' },
        mockUserId
      );

      expect(prisma.agreementTemplate.update).toHaveBeenCalled();
      expect(result.name).toBe('Updated Draft Name');
    });

    it('creates a new version if template is ACTIVE to preserve historical immutability', async () => {
      const existing = {
        id: 'tmpl-1',
        organizationId: mockOrgId,
        name: 'Active Template',
        agreementType: AgreementType.RENTAL_AGREEMENT,
        description: 'Active',
        content: 'Active Content',
        version: 1,
        status: TemplateStatus.ACTIVE,
        _count: { agreements: 3 },
      };

      prisma.agreementTemplate.findFirst.mockResolvedValue(existing);
      prisma.agreementTemplate.create.mockResolvedValue({
        id: 'tmpl-2',
        organizationId: mockOrgId,
        name: 'Active Template',
        agreementType: AgreementType.RENTAL_AGREEMENT,
        description: 'Active',
        content: 'New Version Content',
        version: 2,
        status: TemplateStatus.DRAFT,
      });

      const result = await service.updateTemplate(
        mockOrgId,
        'tmpl-1',
        { content: 'New Version Content' },
        mockUserId
      );

      expect(prisma.agreementTemplate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            version: 2,
            content: 'New Version Content',
          }),
        })
      );
      expect(result.version).toBe(2);
    });

    it('rejects editing archived templates', async () => {
      prisma.agreementTemplate.findFirst.mockResolvedValue({
        id: 'tmpl-archived',
        organizationId: mockOrgId,
        status: TemplateStatus.ARCHIVED,
        _count: { agreements: 0 },
      });

      await expect(
        service.updateTemplate(mockOrgId, 'tmpl-archived', { name: 'Cannot Edit' })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('activateTemplate & archiveTemplate', () => {
    it('activates a draft template', async () => {
      prisma.agreementTemplate.findFirst.mockResolvedValue({
        id: 'tmpl-1',
        organizationId: mockOrgId,
        status: TemplateStatus.DRAFT,
      });
      prisma.agreementTemplate.update.mockResolvedValue({
        id: 'tmpl-1',
        organizationId: mockOrgId,
        status: TemplateStatus.ACTIVE,
      });

      const result = await service.activateTemplate(mockOrgId, 'tmpl-1', mockUserId);
      expect(result.status).toBe(TemplateStatus.ACTIVE);
    });

    it('archives an active template', async () => {
      prisma.agreementTemplate.findFirst.mockResolvedValue({
        id: 'tmpl-1',
        organizationId: mockOrgId,
        status: TemplateStatus.ACTIVE,
      });
      prisma.agreementTemplate.update.mockResolvedValue({
        id: 'tmpl-1',
        organizationId: mockOrgId,
        status: TemplateStatus.ARCHIVED,
      });

      const result = await service.archiveTemplate(mockOrgId, 'tmpl-1', mockUserId);
      expect(result.status).toBe(TemplateStatus.ARCHIVED);
    });
  });
});
