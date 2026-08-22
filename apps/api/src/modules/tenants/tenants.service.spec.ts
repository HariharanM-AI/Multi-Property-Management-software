import { Test, TestingModule } from '@nestjs/testing';
import { TenantsService } from './tenants.service';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  TenantStatus,
  KycDocumentType,
  KycVerificationStatus,
  LeaseStatus,
} from '@propertyos/types';

describe('TenantsService', () => {
  let service: TenantsService;
  let prisma: any;
  let storage: any;

  const mockOrgId = 'org-uuid-1';
  const mockUserId = 'user-uuid-1';
  const mockTenantId = 'tenant-uuid-1';

  const mockTenant = {
    id: mockTenantId,
    organizationId: mockOrgId,
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '9876543210',
    dateOfBirth: new Date('1995-05-15'),
    permanentAddress: '123 Main Street',
    permanentCity: 'Bengaluru',
    permanentState: 'Karnataka',
    permanentPostalCode: '560001',
    occupation: 'Software Engineer',
    employerOrCollege: 'Tech Corp',
    emergencyContactName: 'Jane Doe',
    emergencyContactPhone: '9876543211',
    emergencyContactRelation: 'Spouse',
    status: TenantStatus.PROSPECT,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    prisma = {
      tenant: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      tenantDocument: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      tenantStayHistory: {
        findMany: jest.fn(),
      },
      lease: {
        findMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    };

    storage = {
      uploadTenantFile: jest.fn(),
      deleteTenantFile: jest.fn(),
      validateFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
  });

  describe('createTenant', () => {
    it('should create a tenant profile if phone is unique', async () => {
      prisma.tenant.findFirst.mockResolvedValue(null);
      prisma.tenant.create.mockResolvedValue(mockTenant);

      const result = await service.createTenant(mockOrgId, mockUserId, {
        firstName: 'John',
        lastName: 'Doe',
        phone: '9876543210',
        permanentAddress: '123 Main Street',
        permanentCity: 'Bengaluru',
        permanentState: 'Karnataka',
        permanentPostalCode: '560001',
        emergencyContactName: 'Jane Doe',
        emergencyContactPhone: '9876543211',
        emergencyContactRelation: 'Spouse',
      });

      expect(result).toBeDefined();
      expect(result.firstName).toBe('John');
      expect(prisma.tenant.findFirst).toHaveBeenCalledWith({
        where: {
          organizationId: mockOrgId,
          phone: '9876543210',
          deletedAt: null,
        },
      });
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('should reject tenant creation with 409 Conflict if duplicate phone in org', async () => {
      prisma.tenant.findFirst.mockResolvedValue(mockTenant);

      await expect(
        service.createTenant(mockOrgId, mockUserId, {
          firstName: 'Another',
          lastName: 'User',
          phone: '9876543210',
          permanentAddress: '456 Side Street',
          permanentCity: 'Bengaluru',
          permanentState: 'Karnataka',
          permanentPostalCode: '560001',
          emergencyContactName: 'Jane Doe',
          emergencyContactPhone: '9876543211',
          emergencyContactRelation: 'Friend',
        })
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('listTenants & getTenantDetails', () => {
    it('should list tenants scoped to organization', async () => {
      prisma.tenant.findMany.mockResolvedValue([mockTenant]);

      const list = await service.listTenants(mockOrgId, { search: 'John' });
      expect(list).toHaveLength(1);
      expect(prisma.tenant.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: mockOrgId,
          deletedAt: null,
          OR: [
            { firstName: { contains: 'John', mode: 'insensitive' } },
            { lastName: { contains: 'John', mode: 'insensitive' } },
            { phone: { contains: 'John' } },
            { email: { contains: 'John', mode: 'insensitive' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should throw NotFoundException if tenant not in organization', async () => {
      prisma.tenant.findFirst.mockResolvedValue(null);

      await expect(
        service.getTenantDetails(mockOrgId, 'invalid-tenant')
      ).rejects.toThrow(NotFoundException);
    });

    it('should return aggregated details including documents, stays, and leases', async () => {
      prisma.tenant.findFirst.mockResolvedValue(mockTenant);
      prisma.tenantDocument.findMany.mockResolvedValue([]);
      prisma.tenantStayHistory.findMany.mockResolvedValue([]);
      prisma.lease.findMany.mockResolvedValue([]);

      const details = await service.getTenantDetails(mockOrgId, mockTenantId);
      expect(details.tenant.id).toBe(mockTenantId);
      expect(details.documents).toEqual([]);
      expect(details.stays).toEqual([]);
      expect(details.leases).toEqual([]);
    });
  });

  describe('updateTenant', () => {
    it('should update tenant details when phone is unchanged or unique', async () => {
      prisma.tenant.findFirst
        .mockResolvedValueOnce(mockTenant) // validateTenantAccess
        .mockResolvedValueOnce(null); // duplicate check
      prisma.tenant.update.mockResolvedValue({
        ...mockTenant,
        firstName: 'Johnny',
      });

      const updated = await service.updateTenant(mockOrgId, mockTenantId, mockUserId, {
        firstName: 'Johnny',
        phone: '9876543299',
      });

      expect(updated.firstName).toBe('Johnny');
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if updated phone collides with another tenant', async () => {
      prisma.tenant.findFirst
        .mockResolvedValueOnce(mockTenant) // validateTenantAccess
        .mockResolvedValueOnce({ id: 'other-tenant-id' }); // duplicate check

      await expect(
        service.updateTenant(mockOrgId, mockTenantId, mockUserId, {
          phone: '9876543299',
        })
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('deleteTenant', () => {
    it('should block deletion if active lease exists', async () => {
      prisma.tenant.findFirst.mockResolvedValue(mockTenant);
      prisma.lease.findMany.mockResolvedValue([{ id: 'lease-1', status: LeaseStatus.ACTIVE }]);

      await expect(
        service.deleteTenant(mockOrgId, mockTenantId, mockUserId)
      ).rejects.toThrow(BadRequestException);
    });

    it('should block deletion if active PG stay exists', async () => {
      prisma.tenant.findFirst.mockResolvedValue(mockTenant);
      prisma.lease.findMany.mockResolvedValue([]);
      prisma.tenantStayHistory.findMany.mockResolvedValue([{ id: 'stay-1', checkOutDate: null }]);

      await expect(
        service.deleteTenant(mockOrgId, mockTenantId, mockUserId)
      ).rejects.toThrow(BadRequestException);
    });

    it('should soft delete tenant if no active lease or stay exists', async () => {
      prisma.tenant.findFirst.mockResolvedValue(mockTenant);
      prisma.lease.findMany.mockResolvedValue([]);
      prisma.tenantStayHistory.findMany.mockResolvedValue([]);
      prisma.tenant.update.mockResolvedValue({
        ...mockTenant,
        deletedAt: new Date(),
        status: TenantStatus.ARCHIVED,
      });

      const res = await service.deleteTenant(mockOrgId, mockTenantId, mockUserId);
      expect(res.message).toBe('Tenant successfully archived');
      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: mockTenantId },
        data: expect.objectContaining({
          status: TenantStatus.ARCHIVED,
        }),
      });
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('KYC Documents Management', () => {
    const mockFile = {
      originalname: 'aadhaar.pdf',
      mimetype: 'application/pdf',
      size: 1024 * 100,
      buffer: Buffer.from('mock content'),
    };

    const mockDoc = {
      id: 'doc-uuid-1',
      tenantId: mockTenantId,
      documentType: KycDocumentType.AADHAAR,
      documentNumber: '1234-5678-9012',
      storagePath: `/uploads/${mockOrgId}/tenants/${mockTenantId}/random-doc.pdf`,
      originalFileName: 'aadhaar.pdf',
      fileSize: 1024 * 100,
      mimeType: 'application/pdf',
      verificationStatus: KycVerificationStatus.PENDING,
      rejectionReason: null,
      verifiedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should upload a document and save record with PENDING status', async () => {
      prisma.tenant.findFirst.mockResolvedValue(mockTenant);
      storage.uploadTenantFile.mockResolvedValue({
        fileName: 'random-doc.pdf',
        originalName: 'aadhaar.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024 * 100,
        fileUrl: `/uploads/${mockOrgId}/tenants/${mockTenantId}/random-doc.pdf`,
        category: 'DOCUMENT',
      });
      prisma.tenantDocument.create.mockResolvedValue(mockDoc);

      const doc = await service.uploadDocument(
        mockOrgId,
        mockTenantId,
        mockUserId,
        mockFile,
        KycDocumentType.AADHAAR,
        '1234-5678-9012'
      );

      expect(doc).toBeDefined();
      expect(doc.verificationStatus).toBe(KycVerificationStatus.PENDING);
      expect(storage.uploadTenantFile).toHaveBeenCalledWith(
        mockFile,
        mockOrgId,
        mockTenantId,
        'DOCUMENT'
      );
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('should transition PENDING -> VERIFIED successfully', async () => {
      prisma.tenant.findFirst.mockResolvedValue(mockTenant);
      prisma.tenantDocument.findFirst.mockResolvedValue(mockDoc);
      prisma.tenantDocument.update.mockResolvedValue({
        ...mockDoc,
        verificationStatus: KycVerificationStatus.VERIFIED,
        verifiedAt: new Date(),
      });

      const res = await service.verifyDocument(
        mockOrgId,
        mockTenantId,
        mockDoc.id,
        mockUserId,
        { status: KycVerificationStatus.VERIFIED }
      );

      expect(res.verificationStatus).toBe(KycVerificationStatus.VERIFIED);
      expect(prisma.tenantDocument.update).toHaveBeenCalledWith({
        where: { id: mockDoc.id },
        data: {
          verificationStatus: KycVerificationStatus.VERIFIED,
          rejectionReason: null,
          verifiedAt: expect.any(Date),
        },
      });
    });

    it('should transition PENDING -> REJECTED successfully', async () => {
      prisma.tenant.findFirst.mockResolvedValue(mockTenant);
      prisma.tenantDocument.findFirst.mockResolvedValue(mockDoc);
      prisma.tenantDocument.update.mockResolvedValue({
        ...mockDoc,
        verificationStatus: KycVerificationStatus.REJECTED,
        rejectionReason: 'Blurry photo',
      });

      const res = await service.verifyDocument(
        mockOrgId,
        mockTenantId,
        mockDoc.id,
        mockUserId,
        {
          status: KycVerificationStatus.REJECTED,
          rejectionReason: 'Blurry photo',
        }
      );

      expect(res.verificationStatus).toBe(KycVerificationStatus.REJECTED);
      expect(prisma.tenantDocument.update).toHaveBeenCalledWith({
        where: { id: mockDoc.id },
        data: {
          verificationStatus: KycVerificationStatus.REJECTED,
          rejectionReason: 'Blurry photo',
          verifiedAt: null,
        },
      });
    });

    it('should reject status changes from terminal state VERIFIED', async () => {
      prisma.tenant.findFirst.mockResolvedValue(mockTenant);
      prisma.tenantDocument.findFirst.mockResolvedValue({
        ...mockDoc,
        verificationStatus: KycVerificationStatus.VERIFIED,
      });

      await expect(
        service.verifyDocument(
          mockOrgId,
          mockTenantId,
          mockDoc.id,
          mockUserId,
          { status: KycVerificationStatus.REJECTED, rejectionReason: 'Changed mind' }
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject status changes from terminal state REJECTED', async () => {
      prisma.tenant.findFirst.mockResolvedValue(mockTenant);
      prisma.tenantDocument.findFirst.mockResolvedValue({
        ...mockDoc,
        verificationStatus: KycVerificationStatus.REJECTED,
      });

      await expect(
        service.verifyDocument(
          mockOrgId,
          mockTenantId,
          mockDoc.id,
          mockUserId,
          { status: KycVerificationStatus.VERIFIED }
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should delete a document and unlink file from storage', async () => {
      prisma.tenant.findFirst.mockResolvedValue(mockTenant);
      prisma.tenantDocument.findFirst.mockResolvedValue(mockDoc);
      storage.deleteTenantFile.mockResolvedValue(true);
      prisma.tenantDocument.delete.mockResolvedValue(mockDoc);

      const res = await service.deleteDocument(
        mockOrgId,
        mockTenantId,
        mockDoc.id,
        mockUserId
      );

      expect(res.message).toBe('Document successfully deleted');
      expect(storage.deleteTenantFile).toHaveBeenCalledWith(
        mockDoc.storagePath,
        mockOrgId,
        mockTenantId
      );
      expect(prisma.tenantDocument.delete).toHaveBeenCalledWith({
        where: { id: mockDoc.id },
      });
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });
  });
});
