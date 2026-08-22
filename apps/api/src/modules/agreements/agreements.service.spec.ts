import { Test, TestingModule } from '@nestjs/testing';
import { AgreementsService } from './agreements.service';
import { AgreementRendererService } from './agreement-renderer.service';
import { AgreementPdfService } from './agreement-pdf.service';
import { PrismaService } from '../../database/prisma.service';
import {
  AgreementStatus,
  AgreementType,
  SignatureStatus,
  AgreementSignerType,
  UserRole,
} from '@propertyos/types';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';

describe('AgreementsService', () => {
  let service: AgreementsService;
  let prisma: any;
  let rendererService: AgreementRendererService;
  let pdfService: any;

  const mockOrgId = 'org-agreement-test-123';
  const mockUserId = 'user-owner-123';
  const mockPropertyId = 'prop-villa-101';
  const mockTenantId = 'tenant-ramesh-101';

  beforeEach(async () => {
    prisma = {
      property: { findFirst: jest.fn() },
      tenant: { findFirst: jest.fn() },
      lease: { findFirst: jest.fn() },
      checkIn: { findFirst: jest.fn() },
      agreementTemplate: { findFirst: jest.fn() },
      agreement: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      agreementSignature: {
        create: jest.fn(),
        createMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
      },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    pdfService = {
      generateAndSavePdf: jest.fn().mockResolvedValue({
        documentPath: '/uploads/org/agreements/agr-1/doc.pdf',
        fileName: 'doc.pdf',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgreementsService,
        AgreementRendererService,
        { provide: PrismaService, useValue: prisma },
        { provide: AgreementPdfService, useValue: pdfService },
      ],
    }).compile();

    service = module.get<AgreementsService>(AgreementsService);
    rendererService = module.get<AgreementRendererService>(AgreementRendererService);
  });

  describe('createAgreement', () => {
    it('creates a draft agreement with required initial signature placeholders', async () => {
      prisma.property.findFirst.mockResolvedValue({ id: mockPropertyId, organizationId: mockOrgId });
      prisma.tenant.findFirst.mockResolvedValue({
        id: mockTenantId,
        organizationId: mockOrgId,
        firstName: 'Ramesh',
        lastName: 'Kumar',
        email: 'ramesh@example.com',
      });

      const mockCreated = {
        id: 'agr-1',
        organizationId: mockOrgId,
        propertyId: mockPropertyId,
        tenantId: mockTenantId,
        agreementType: AgreementType.RENTAL_AGREEMENT,
        status: AgreementStatus.DRAFT,
        version: 1,
        renderedContent: '',
      };

      prisma.agreement.create.mockResolvedValue(mockCreated);
      prisma.agreement.findFirst.mockResolvedValue({
        ...mockCreated,
        tenant: { id: mockTenantId, firstName: 'Ramesh', lastName: 'Kumar' },
        property: { id: mockPropertyId, name: 'Villa' },
        signatures: [],
      });

      const result = await service.createAgreement(
        mockOrgId,
        mockPropertyId,
        {
          tenantId: mockTenantId,
          agreementType: AgreementType.RENTAL_AGREEMENT,
        },
        mockUserId
      );

      expect(result.id).toBe('agr-1');
      expect(prisma.agreementSignature.createMany).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'AGREEMENT_CREATED' }),
        })
      );
    });
  });

  describe('generateAgreement', () => {
    it('renders template, creates PDF, sets SHA-256 hash, and transitions to GENERATED', async () => {
      const existingAgreement = {
        id: 'agr-1',
        organizationId: mockOrgId,
        propertyId: mockPropertyId,
        tenantId: mockTenantId,
        agreementType: AgreementType.RENTAL_AGREEMENT,
        status: AgreementStatus.DRAFT,
        version: 1,
        tenant: {
          id: mockTenantId,
          firstName: 'Ramesh',
          lastName: 'Kumar',
          phone: '9845012345',
          permanentAddress: '12 Temple St',
          permanentCity: 'Bengaluru',
          permanentState: 'KA',
          permanentPostalCode: '560001',
        },
        property: {
          id: mockPropertyId,
          code: 'RH-01',
          name: 'Villa Royale',
          address: '200 Villa Lane',
          city: 'Bengaluru',
          state: 'KA',
          postalCode: '560002',
        },
        signatures: [],
      };

      prisma.agreement.findFirst.mockResolvedValue(existingAgreement);
      prisma.agreementTemplate.findFirst.mockResolvedValue({
        id: 'tmpl-1',
        version: 1,
        content: 'Rental agreement for {{TENANT_NAME}} at {{PROPERTY_NAME}}',
      });

      prisma.agreement.update.mockImplementation((args: any) => Promise.resolve(args.data));

      const result = await service.generateAgreement(
        mockOrgId,
        'agr-1',
        { templateId: 'tmpl-1' },
        mockUserId
      );

      expect(result.status).toBe(AgreementStatus.GENERATED);
      expect(result.contentHash).toBeDefined();
      expect(result.renderedContent).toContain('Rental agreement for Ramesh Kumar at Villa Royale');
      expect(pdfService.generateAndSavePdf).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'AGREEMENT_GENERATED' }),
        })
      );
    });
  });

  describe('digital signature workflow & hash verification', () => {
    it('signs agreement when signature hash matches contentHash', async () => {
      const mockHash = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      const existingAgreement = {
        id: 'agr-1',
        organizationId: mockOrgId,
        status: AgreementStatus.PENDING_SIGNATURE,
        contentHash: mockHash,
        tenant: {
          id: mockTenantId,
          email: 'ramesh@example.com',
        },
        signatures: [
          {
            id: 'sig-1',
            signerType: AgreementSignerType.TENANT,
            status: SignatureStatus.PENDING,
          },
          {
            id: 'sig-2',
            signerType: AgreementSignerType.PROPERTY_MANAGER,
            status: SignatureStatus.PENDING,
          },
        ],
      };

      prisma.agreement.findFirst.mockResolvedValue(existingAgreement);
      prisma.agreementSignature.findMany.mockResolvedValue([
        { id: 'sig-1', signerType: AgreementSignerType.TENANT, status: SignatureStatus.SIGNED },
        { id: 'sig-2', signerType: AgreementSignerType.PROPERTY_MANAGER, status: SignatureStatus.PENDING },
      ]);
      prisma.agreement.update.mockImplementation((args: any) =>
        Promise.resolve({ ...existingAgreement, ...args.data })
      );

      const result = await service.signAgreement(
        mockOrgId,
        'agr-1',
        {
          signerType: AgreementSignerType.TENANT,
          signerName: 'Ramesh Kumar',
          signatureData: 'DIGITALLY_ACCEPTED',
        },
        { id: 'user-tenant', role: UserRole.TENANT, email: 'ramesh@example.com' }
      );

      expect(result.status).toBe(AgreementStatus.PARTIALLY_SIGNED);
      expect(prisma.agreementSignature.update).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'AGREEMENT_SIGNED' }),
        })
      );
    });
  });

  describe('finalizeAgreement & immutability safeguards', () => {
    it('finalizes agreement when all required signatures are SIGNED', async () => {
      const mockHash = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      const signedAgreement = {
        id: 'agr-1',
        organizationId: mockOrgId,
        status: AgreementStatus.SIGNED,
        contentHash: mockHash,
        renderedContent: 'Authoritative text',
        documentPath: '/uploads/org/agreements/agr-1/doc.pdf',
        signatures: [
          { id: 'sig-1', signerType: AgreementSignerType.TENANT, status: SignatureStatus.SIGNED, contentHash: mockHash },
          { id: 'sig-2', signerType: AgreementSignerType.PROPERTY_MANAGER, status: SignatureStatus.SIGNED, contentHash: mockHash },
        ],
      };

      prisma.agreement.findFirst.mockResolvedValue(signedAgreement);
      prisma.agreement.update.mockImplementation((args: any) =>
        Promise.resolve({ ...signedAgreement, ...args.data })
      );

      const result = await service.finalizeAgreement(mockOrgId, 'agr-1', {}, mockUserId);

      expect(result.status).toBe(AgreementStatus.FINALIZED);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'AGREEMENT_FINALIZED' }),
        })
      );
    });

    it('rejects cancellation of a SIGNED or FINALIZED agreement', async () => {
      prisma.agreement.findFirst.mockResolvedValue({
        id: 'agr-1',
        organizationId: mockOrgId,
        status: AgreementStatus.FINALIZED,
      });

      await expect(
        service.cancelAgreement(mockOrgId, 'agr-1', { reason: 'Test' }, mockUserId)
      ).rejects.toThrow(BadRequestException);
    });
  });
});
