import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import {
  TenantDto,
  CreateTenantDto,
  UpdateTenantDto,
  TenantDocumentDto,
  VerifyDocumentDto,
  TenantStayHistoryDto,
  TenantDetailsDto,
  TenantStatus,
  KycDocumentType,
  KycVerificationStatus,
  LeaseStatus,
} from '@propertyos/types';

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService
  ) {}

  /**
   * Helper to write standardized Audit Logs
   */
  private async writeAuditLog(
    tx: any,
    organizationId: string,
    userId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        organizationId,
        userId,
        action,
        resourceType,
        resourceId,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
  }

  /**
   * Helper to validate that a tenant exists in the organization and is not soft-deleted
   */
  async validateTenantAccess(organizationId: string, tenantId: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        id: tenantId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  /**
   * Create a new Tenant profile with duplicate phone check
   */
  async createTenant(
    organizationId: string,
    userId: string,
    input: CreateTenantDto
  ): Promise<TenantDto> {
    // Check duplicate phone in the same organization
    const existing = await this.prisma.tenant.findFirst({
      where: {
        organizationId,
        phone: input.phone,
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ConflictException('A tenant with this phone number already exists in this organization');
    }

    const tenant = await this.prisma.$transaction(async (tx) => {
      const created = await tx.tenant.create({
        data: {
          organizationId,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email || null,
          phone: input.phone,
          dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
          permanentAddress: input.permanentAddress,
          permanentCity: input.permanentCity,
          permanentState: input.permanentState,
          permanentPostalCode: input.permanentPostalCode,
          occupation: input.occupation || null,
          employerOrCollege: input.employerOrCollege || null,
          emergencyContactName: input.emergencyContactName,
          emergencyContactPhone: input.emergencyContactPhone,
          emergencyContactRelation: input.emergencyContactRelation,
          status: TenantStatus.PROSPECT,
        },
      });

      await this.writeAuditLog(tx, organizationId, userId, 'TENANT_CREATED', 'TENANT', created.id, {
        name: `${created.firstName} ${created.lastName}`,
        phone: created.phone,
      });

      return created;
    });

    return tenant as unknown as TenantDto;
  }

  /**
   * List all active tenants for an organization with optional search and status filtering
   */
  async listTenants(
    organizationId: string,
    query?: { status?: TenantStatus; search?: string }
  ): Promise<TenantDto[]> {
    const whereClause: any = {
      organizationId,
      deletedAt: null,
    };

    if (query?.status) {
      whereClause.status = query.status;
    }

    if (query?.search && query.search.trim()) {
      const s = query.search.trim();
      whereClause.OR = [
        { firstName: { contains: s, mode: 'insensitive' } },
        { lastName: { contains: s, mode: 'insensitive' } },
        { phone: { contains: s } },
        { email: { contains: s, mode: 'insensitive' } },
      ];
    }

    const tenants = await this.prisma.tenant.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    return tenants as unknown as TenantDto[];
  }

  /**
   * Get detailed profile including documents, PG stays, and whole-unit leases
   */
  async getTenantDetails(
    organizationId: string,
    tenantId: string
  ): Promise<TenantDetailsDto> {
    const tenant = await this.validateTenantAccess(organizationId, tenantId);

    const [documents, stays, leases] = await Promise.all([
      this.prisma.tenantDocument.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.tenantStayHistory.findMany({
        where: { tenantId },
        orderBy: { checkInDate: 'desc' },
      }),
      this.prisma.lease.findMany({
        where: { tenantId },
        include: {
          rentalUnit: {
            include: {
              property: true,
            },
          },
          escalations: true,
        },
        orderBy: { startDate: 'desc' },
      }),
    ]);

    return {
      tenant: tenant as unknown as TenantDto,
      documents: documents as unknown as TenantDocumentDto[],
      stays: stays.map((s) => ({
        ...s,
        monthlyRent: Number(s.monthlyRent),
      })) as unknown as TenantStayHistoryDto[],
      leases: leases.map((l) => ({
        ...l,
        monthlyRent: Number(l.monthlyRent),
        securityDeposit: Number(l.securityDeposit),
        escalations: l.escalations.map((e) => ({
          ...e,
          escalatedAmount: Number(e.escalatedAmount),
        })),
      })) as any,
    };
  }

  /**
   * Update tenant profile details with duplicate phone check
   */
  async updateTenant(
    organizationId: string,
    tenantId: string,
    userId: string,
    input: UpdateTenantDto
  ): Promise<TenantDto> {
    await this.validateTenantAccess(organizationId, tenantId);

    if (input.phone) {
      const duplicate = await this.prisma.tenant.findFirst({
        where: {
          organizationId,
          phone: input.phone,
          deletedAt: null,
          id: { not: tenantId },
        },
      });

      if (duplicate) {
        throw new ConflictException('A tenant with this phone number already exists in this organization');
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.tenant.update({
        where: { id: tenantId },
        data: {
          ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
          ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
          ...(input.email !== undefined ? { email: input.email } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(input.dateOfBirth !== undefined
            ? { dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null }
            : {}),
          ...(input.permanentAddress !== undefined ? { permanentAddress: input.permanentAddress } : {}),
          ...(input.permanentCity !== undefined ? { permanentCity: input.permanentCity } : {}),
          ...(input.permanentState !== undefined ? { permanentState: input.permanentState } : {}),
          ...(input.permanentPostalCode !== undefined ? { permanentPostalCode: input.permanentPostalCode } : {}),
          ...(input.occupation !== undefined ? { occupation: input.occupation } : {}),
          ...(input.employerOrCollege !== undefined ? { employerOrCollege: input.employerOrCollege } : {}),
          ...(input.emergencyContactName !== undefined ? { emergencyContactName: input.emergencyContactName } : {}),
          ...(input.emergencyContactPhone !== undefined ? { emergencyContactPhone: input.emergencyContactPhone } : {}),
          ...(input.emergencyContactRelation !== undefined ? { emergencyContactRelation: input.emergencyContactRelation } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        },
      });

      await this.writeAuditLog(tx, organizationId, userId, 'TENANT_UPDATED', 'TENANT', tenantId, {
        updatedFields: Object.keys(input),
      });

      return res;
    });

    return updated as unknown as TenantDto;
  }

  /**
   * Soft-delete/archive a tenant if no active leases or stays exist
   */
  async deleteTenant(
    organizationId: string,
    tenantId: string,
    userId: string
  ): Promise<{ message: string }> {
    await this.validateTenantAccess(organizationId, tenantId);

    // Check active whole-unit leases (ACTIVE or NOTICE)
    const activeLeases = await this.prisma.lease.findMany({
      where: {
        tenantId,
        status: { in: [LeaseStatus.ACTIVE, LeaseStatus.NOTICE] },
      },
    });

    if (activeLeases.length > 0) {
      throw new BadRequestException('Cannot delete/archive tenant with active or notice leases.');
    }

    // Check active PG stays (where checkOutDate is null)
    const activeStays = await this.prisma.tenantStayHistory.findMany({
      where: {
        tenantId,
        checkOutDate: null,
      },
    });

    if (activeStays.length > 0) {
      throw new BadRequestException('Cannot delete/archive tenant with active co-living stays.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          deletedAt: new Date(),
          status: TenantStatus.ARCHIVED,
        },
      });

      await this.writeAuditLog(tx, organizationId, userId, 'TENANT_DELETED', 'TENANT', tenantId);
    });

    return { message: 'Tenant successfully archived' };
  }

  /**
   * Upload and register a KYC document
   */
  async uploadDocument(
    organizationId: string,
    tenantId: string,
    userId: string,
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
    documentType: KycDocumentType,
    documentNumber?: string
  ): Promise<TenantDocumentDto> {
    await this.validateTenantAccess(organizationId, tenantId);

    if (!file) {
      throw new BadRequestException('No document file uploaded');
    }

    const uploadResult = await this.storage.uploadTenantFile(
      file,
      organizationId,
      tenantId,
      'DOCUMENT'
    );

    const doc = await this.prisma.$transaction(async (tx) => {
      const created = await tx.tenantDocument.create({
        data: {
          tenantId,
          documentType,
          documentNumber: documentNumber || null,
          storagePath: uploadResult.fileUrl,
          originalFileName: uploadResult.originalName,
          fileSize: uploadResult.fileSize,
          mimeType: uploadResult.mimeType,
          verificationStatus: KycVerificationStatus.PENDING,
        },
      });

      await this.writeAuditLog(tx, organizationId, userId, 'KYC_DOCUMENT_UPLOADED', 'TENANT_DOCUMENT', created.id, {
        tenantId,
        documentType,
        fileName: uploadResult.fileName,
      });

      return created;
    });

    return doc as unknown as TenantDocumentDto;
  }

  /**
   * Verify or reject an uploaded KYC document (Terminal states: PENDING -> VERIFIED or PENDING -> REJECTED)
   */
  async verifyDocument(
    organizationId: string,
    tenantId: string,
    docId: string,
    userId: string,
    input: VerifyDocumentDto
  ): Promise<TenantDocumentDto> {
    await this.validateTenantAccess(organizationId, tenantId);

    const doc = await this.prisma.tenantDocument.findFirst({
      where: {
        id: docId,
        tenantId,
      },
    });

    if (!doc) {
      throw new NotFoundException('Document not found');
    }

    if (doc.verificationStatus !== KycVerificationStatus.PENDING) {
      throw new BadRequestException(
        `Cannot transition document from ${doc.verificationStatus}. ${doc.verificationStatus} is a terminal state.`
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.tenantDocument.update({
        where: { id: docId },
        data: {
          verificationStatus: input.status,
          rejectionReason: input.status === KycVerificationStatus.REJECTED ? input.rejectionReason || null : null,
          verifiedAt: input.status === KycVerificationStatus.VERIFIED ? new Date() : null,
        },
      });

      await this.writeAuditLog(tx, organizationId, userId, 'KYC_DOCUMENT_VERIFIED', 'TENANT_DOCUMENT', docId, {
        tenantId,
        verificationStatus: input.status,
        rejectionReason: input.rejectionReason,
      });

      return res;
    });

    return updated as unknown as TenantDocumentDto;
  }

  /**
   * Delete an uploaded KYC document and remove physical file
   */
  async deleteDocument(
    organizationId: string,
    tenantId: string,
    docId: string,
    userId: string
  ): Promise<{ message: string }> {
    await this.validateTenantAccess(organizationId, tenantId);

    const doc = await this.prisma.tenantDocument.findFirst({
      where: {
        id: docId,
        tenantId,
      },
    });

    if (!doc) {
      throw new NotFoundException('Document not found');
    }

    await this.storage.deleteTenantFile(doc.storagePath, organizationId, tenantId);

    await this.prisma.$transaction(async (tx) => {
      await tx.tenantDocument.delete({
        where: { id: docId },
      });

      await this.writeAuditLog(tx, organizationId, userId, 'KYC_DOCUMENT_DELETED', 'TENANT_DOCUMENT', docId, {
        tenantId,
      });
    });

    return { message: 'Document successfully deleted' };
  }
}
