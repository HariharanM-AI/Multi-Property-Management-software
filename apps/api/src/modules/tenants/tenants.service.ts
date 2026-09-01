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
  BedStatus,
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
      const updated = await this.prisma.tenant.update({
        where: { id: existing.id },
        data: {
          firstName: input.firstName || existing.firstName,
          lastName: input.lastName || existing.lastName,
          email: input.email !== undefined ? input.email : existing.email,
          permanentAddress: input.permanentAddress || existing.permanentAddress,
          permanentCity: input.permanentCity || existing.permanentCity,
          permanentState: input.permanentState || existing.permanentState,
          permanentPostalCode: input.permanentPostalCode || existing.permanentPostalCode,
          occupation: input.occupation || existing.occupation,
          employerOrCollege: input.employerOrCollege || existing.employerOrCollege,
          emergencyContactName: input.emergencyContactName || existing.emergencyContactName,
          emergencyContactPhone: input.emergencyContactPhone || existing.emergencyContactPhone,
          emergencyContactRelation: input.emergencyContactRelation || existing.emergencyContactRelation,
        },
      });

      if (input.documentNumber || input.documentType) {
        const docTypeStr = (input.documentType || 'AADHAAR').toUpperCase().replace(/[\s\-_]+/g, '_');
        let mappedType: KycDocumentType = KycDocumentType.AADHAAR;
        if (docTypeStr.includes('PAN')) mappedType = KycDocumentType.PAN;
        else if (docTypeStr.includes('PASSPORT')) mappedType = KycDocumentType.PASSPORT;
        else if (docTypeStr.includes('DRIV')) mappedType = KycDocumentType.DRIVING_LICENSE;
        else if (docTypeStr.includes('EMPLOY') || docTypeStr.includes('CORP')) mappedType = KycDocumentType.EMPLOYMENT_ID;
        else if (docTypeStr.includes('STUDENT')) mappedType = KycDocumentType.STUDENT_ID;
        else if (docTypeStr.includes('VOTER')) mappedType = KycDocumentType.OTHER;

        const existingDoc = await this.prisma.tenantDocument.findFirst({
          where: { tenantId: existing.id },
          orderBy: { createdAt: 'desc' },
        });

        if (existingDoc) {
          await this.prisma.tenantDocument.update({
            where: { id: existingDoc.id },
            data: {
              ...(input.documentNumber ? { documentNumber: input.documentNumber.trim() } : {}),
              ...(input.documentType ? { documentType: mappedType } : {}),
            },
          });
        } else if (input.documentNumber) {
          await this.prisma.tenantDocument.create({
            data: {
              tenantId: existing.id,
              documentType: mappedType,
              documentNumber: input.documentNumber.trim(),
              storagePath: '',
              originalFileName: 'Official_ID_Proof',
              fileSize: 0,
              mimeType: 'text/plain',
              verificationStatus: KycVerificationStatus.VERIFIED,
              verifiedAt: new Date(),
            },
          });
        }
      }

      return updated as unknown as TenantDto;
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
          permanentAddress: input.permanentAddress || 'Not Provided',
          permanentCity: input.permanentCity || 'Bengaluru',
          permanentState: input.permanentState || 'Karnataka',
          permanentPostalCode: input.permanentPostalCode || '560001',
          occupation: input.occupation || null,
          employerOrCollege: input.employerOrCollege || null,
          emergencyContactName: input.emergencyContactName || `${input.firstName} (Self)`,
          emergencyContactPhone: input.emergencyContactPhone || input.phone,
          emergencyContactRelation: input.emergencyContactRelation || 'Self',
          status: TenantStatus.PROSPECT,
        },
      });

      if (input.documentNumber || input.documentType) {
        const docTypeStr = (input.documentType || 'AADHAAR').toUpperCase().replace(/[\s\-_]+/g, '_');
        let mappedType: KycDocumentType = KycDocumentType.AADHAAR;
        if (docTypeStr.includes('PAN')) mappedType = KycDocumentType.PAN;
        else if (docTypeStr.includes('PASSPORT')) mappedType = KycDocumentType.PASSPORT;
        else if (docTypeStr.includes('DRIV')) mappedType = KycDocumentType.DRIVING_LICENSE;
        else if (docTypeStr.includes('EMPLOY') || docTypeStr.includes('CORP')) mappedType = KycDocumentType.EMPLOYMENT_ID;
        else if (docTypeStr.includes('STUDENT')) mappedType = KycDocumentType.STUDENT_ID;
        else if (docTypeStr.includes('VOTER')) mappedType = KycDocumentType.OTHER;

        await tx.tenantDocument.create({
          data: {
            tenantId: created.id,
            documentType: mappedType,
            documentNumber: input.documentNumber ? input.documentNumber.trim() : null,
            storagePath: '',
            originalFileName: 'Official_ID_Proof',
            fileSize: 0,
            mimeType: 'text/plain',
            verificationStatus: KycVerificationStatus.VERIFIED,
            verifiedAt: new Date(),
          },
        });
      }

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
  ): Promise<any[]> {
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
      include: {
        documents: {
          select: {
            id: true,
            documentType: true,
            verificationStatus: true,
            documentNumber: true,
            storagePath: true,
            rejectionReason: true,
            verifiedAt: true,
            createdAt: true,
          },
        },
        stayHistories: {
          orderBy: { createdAt: 'desc' },
          include: {
            bed: {
              include: {
                room: {
                  include: {
                    floor: true,
                    property: {
                      select: { id: true, name: true, code: true, propertyType: true },
                    },
                  },
                },
              },
            },
          },
        },
        leases: {
          orderBy: { createdAt: 'desc' },
          include: {
            rentalUnit: {
              include: {
                property: {
                  select: { id: true, name: true, code: true, propertyType: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return (tenants as any[]).map((t) => {
      const activeStay = (t.stayHistories || []).find((s: any) => !s.checkOutDate);
      const pastStays = (t.stayHistories || []).filter((s: any) => Boolean(s.checkOutDate));
      const activeLease = (t.leases || []).find(
        (l: any) => l.status === LeaseStatus.ACTIVE || l.status === LeaseStatus.NOTICE
      );

      let kycStatus: string = 'NOT_SUBMITTED';
      if (t.documents && t.documents.length > 0) {
        if (t.documents.some((d: any) => d.verificationStatus === KycVerificationStatus.VERIFIED)) {
          kycStatus = 'VERIFIED';
        } else if (t.documents.some((d: any) => d.verificationStatus === KycVerificationStatus.PENDING)) {
          kycStatus = 'PENDING';
        } else if (t.documents.some((d: any) => d.verificationStatus === KycVerificationStatus.REJECTED)) {
          kycStatus = 'REJECTED';
        }
      }

      const assignedProperty = activeStay?.bed?.room?.property || activeLease?.rentalUnit?.property || null;
      const assignedRoom = activeStay?.bed?.room || null;
      const assignedFloor = activeStay?.bed?.room?.floor || null;
      const assignedBed = activeStay?.bed || null;
      const assignedUnit = activeLease?.rentalUnit || null;

      return {
        id: t.id,
        organizationId: t.organizationId,
        firstName: t.firstName,
        lastName: t.lastName,
        email: t.email,
        phone: t.phone,
        dateOfBirth: t.dateOfBirth,
        gender: (t as any).gender,
        permanentAddress: t.permanentAddress,
        permanentCity: t.permanentCity,
        permanentState: t.permanentState,
        permanentPostalCode: t.permanentPostalCode,
        occupation: t.occupation,
        employerOrCollege: t.employerOrCollege,
        emergencyContactName: t.emergencyContactName,
        emergencyContactPhone: t.emergencyContactPhone,
        emergencyContactRelation: t.emergencyContactRelation,
        status: t.status,
        kycStatus,
        documents: t.documents,
        currentStay: activeStay
          ? {
              id: activeStay.id,
              checkInDate: activeStay.checkInDate,
              monthlyRent: Number(activeStay.monthlyRent),
              bedId: activeStay.bedId,
              bedNumber: assignedBed?.bedNumber || '',
              roomId: assignedRoom?.id || '',
              roomNumber: assignedRoom?.roomNumber || '',
              floorName: assignedFloor?.name || '',
              propertyId: assignedProperty?.id || '',
              propertyName: assignedProperty?.name || '',
            }
          : null,
        currentLease: activeLease
          ? {
              id: activeLease.id,
              startDate: activeLease.startDate,
              endDate: activeLease.endDate,
              monthlyRent: Number(activeLease.monthlyRent),
              unitNumber: assignedUnit?.unitNumber || '',
              propertyId: assignedProperty?.id || '',
              propertyName: assignedProperty?.name || '',
            }
          : null,
        leases: (t.leases || []).map((l: any) => ({
          id: l.id,
          status: l.status,
          startDate: l.startDate,
          endDate: l.endDate,
          monthlyRent: Number(l.monthlyRent),
          rentalUnitId: l.rentalUnitId,
          unitNumber: l.rentalUnit?.unitNumber || '',
          propertyId: l.rentalUnit?.property?.id || l.rentalUnit?.propertyId || '',
          propertyName: l.rentalUnit?.property?.name || '',
          createdAt: l.createdAt,
          updatedAt: l.updatedAt,
        })),
        stayHistories: (t.stayHistories || []).map((s: any) => ({
          id: s.id,
          checkInDate: s.checkInDate,
          checkOutDate: s.checkOutDate,
          monthlyRent: Number(s.monthlyRent),
          bedId: s.bedId,
          bedNumber: s.bed?.bedNumber || '',
          roomId: s.bed?.room?.id || '',
          roomNumber: s.bed?.room?.roomNumber || '',
          propertyId: s.bed?.room?.property?.id || s.bed?.room?.floor?.propertyId || '',
          propertyName: s.bed?.room?.property?.name || '',
          createdAt: s.createdAt,
        })),
        stayHistoriesCount: (t.stayHistories || []).length,
        pastStaysCount: pastStays.length,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      };
    });
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
        } as any,
      });

      if (input.documentNumber !== undefined || input.documentType !== undefined) {
        const docTypeStr = ((input.documentType as string) || 'AADHAAR').toUpperCase().replace(/[\s\-_]+/g, '_');
        let mappedType: KycDocumentType = KycDocumentType.AADHAAR;
        if (docTypeStr.includes('PAN')) mappedType = KycDocumentType.PAN;
        else if (docTypeStr.includes('PASSPORT')) mappedType = KycDocumentType.PASSPORT;
        else if (docTypeStr.includes('DRIV')) mappedType = KycDocumentType.DRIVING_LICENSE;
        else if (docTypeStr.includes('EMPLOY') || docTypeStr.includes('CORP')) mappedType = KycDocumentType.EMPLOYMENT_ID;
        else if (docTypeStr.includes('STUDENT')) mappedType = KycDocumentType.STUDENT_ID;
        else if (docTypeStr.includes('VOTER')) mappedType = KycDocumentType.OTHER;

        const existingDoc = await tx.tenantDocument.findFirst({
          where: { tenantId },
          orderBy: { createdAt: 'desc' },
        });

        if (existingDoc) {
          await tx.tenantDocument.update({
            where: { id: existingDoc.id },
            data: {
              ...(input.documentNumber !== undefined ? { documentNumber: (input.documentNumber as string)?.trim() || null } : {}),
              ...(input.documentType !== undefined ? { documentType: mappedType } : {}),
            },
          });
        } else if (input.documentNumber) {
          await tx.tenantDocument.create({
            data: {
              tenantId,
              documentType: mappedType,
              documentNumber: (input.documentNumber as string).trim(),
              storagePath: '',
              originalFileName: 'Official_ID_Proof',
              fileSize: 0,
              mimeType: 'text/plain',
              verificationStatus: KycVerificationStatus.VERIFIED,
              verifiedAt: new Date(),
            },
          });
        }
      }

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

  /**
   * Assign or Check-in a tenant into a specific PG bed
   */
  async assignBed(
    organizationId: string,
    tenantId: string,
    userId: string,
    input: {
      propertyId: string;
      bedId: string;
      monthlyRent?: number;
      securityDeposit?: number;
      checkInDate?: string;
    }
  ) {
    const tenant = await this.validateTenantAccess(organizationId, tenantId);

    const bed = await this.prisma.bed.findFirst({
      where: {
        id: input.bedId,
        room: { propertyId: input.propertyId },
        deletedAt: null,
      },
      include: {
        room: {
          include: {
            floor: true,
            property: true,
          },
        },
      },
    });

    if (!bed) {
      throw new NotFoundException('Target bed not found in property');
    }

    const rent = input.monthlyRent !== undefined ? input.monthlyRent : Number(bed.monthlyRent);

    const now = new Date();
    let checkInTimestamp = now;
    if (input.checkInDate) {
      if (input.checkInDate.length <= 10) {
        const [y, m, d] = input.checkInDate.split('-').map(Number);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          checkInTimestamp = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
        }
      } else {
        const parsed = new Date(input.checkInDate);
        if (!isNaN(parsed.getTime())) {
          if (parsed.getUTCHours() === 0 && parsed.getUTCMinutes() === 0) {
            parsed.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
          }
          checkInTimestamp = parsed;
        }
      }
    }

    return await this.prisma.$transaction(async (tx) => {
      // 1. Close any existing open stays for this tenant
      await tx.tenantStayHistory.updateMany({
        where: {
          tenantId,
          checkOutDate: null,
        },
        data: {
          checkOutDate: new Date(),
        },
      });

      // 2. Create new active stay history
      const stay = await tx.tenantStayHistory.create({
        data: {
          tenantId,
          bedId: input.bedId,
          checkInDate: checkInTimestamp,
          monthlyRent: rent,
        },
      });

      // 3. Mark bed as OCCUPIED
      await tx.bed.update({
        where: { id: input.bedId },
        data: {
          status: BedStatus.OCCUPIED,
          monthlyRent: rent,
        },
      });

      // 4. Mark tenant as ACTIVE
      const updatedTenant = await tx.tenant.update({
        where: { id: tenantId },
        data: {
          status: TenantStatus.ACTIVE,
        },
      });

      await this.writeAuditLog(tx, organizationId, userId, 'TENANT_BED_ASSIGNED', 'TENANT', tenantId, {
        propertyId: input.propertyId,
        bedId: input.bedId,
        bedNumber: bed.bedNumber,
        roomNumber: bed.room.roomNumber,
        monthlyRent: rent,
      });

      return {
        tenant: updatedTenant,
        stay,
        bed,
      };
    });
  }

  /**
   * Vacate / Check-out a tenant from a bed
   */
  async vacateBed(
    organizationId: string,
    tenantId: string,
    userId: string,
    input?: {
      bedId?: string;
      checkoutDate?: string;
    }
  ) {
    const tenant = await this.validateTenantAccess(organizationId, tenantId);

    const now = new Date();
    let checkOutTimestamp = now;
    if (input?.checkoutDate) {
      if (input.checkoutDate.length <= 10) {
        const [y, m, d] = input.checkoutDate.split('-').map(Number);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          checkOutTimestamp = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
        }
      } else {
        const parsed = new Date(input.checkoutDate);
        if (!isNaN(parsed.getTime())) {
          if (parsed.getUTCHours() === 0 && parsed.getUTCMinutes() === 0) {
            parsed.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
          }
          checkOutTimestamp = parsed;
        }
      }
    }

    return await this.prisma.$transaction(async (tx) => {
      // 1. Close open stay history
      const openStays = await tx.tenantStayHistory.findMany({
        where: {
          tenantId,
          checkOutDate: null,
          ...(input?.bedId ? { bedId: input.bedId } : {}),
        },
      });

      for (const stay of openStays) {
        await tx.tenantStayHistory.update({
          where: { id: stay.id },
          data: { checkOutDate: checkOutTimestamp },
        });

        // Set bed back to AVAILABLE
        await tx.bed.update({
          where: { id: stay.bedId },
          data: { status: BedStatus.AVAILABLE },
        });
      }

      // Also if specific bedId was passed, ensure that bed is marked AVAILABLE
      if (input?.bedId) {
        await tx.bed.update({
          where: { id: input.bedId },
          data: { status: BedStatus.AVAILABLE },
        });
      }

      // 2. Mark tenant status as CHECKED_OUT
      const updatedTenant = await tx.tenant.update({
        where: { id: tenantId },
        data: { status: TenantStatus.CHECKED_OUT },
      });

      await this.writeAuditLog(tx, organizationId, userId, 'TENANT_BED_VACATED', 'TENANT', tenantId, {
        checkOutDate: checkOutTimestamp,
        bedId: input?.bedId,
      });

      return {
        tenant: updatedTenant,
        vacatedStaysCount: openStays.length,
      };
    });
  }

  /**
   * Vacate / Check-out whichever tenant is occupying a specific bedId
   */
  async vacateBedByBedId(
    organizationId: string,
    bedId: string,
    userId: string,
    checkoutDate?: string
  ) {
    const bed = await this.prisma.bed.findFirst({
      where: { id: bedId, room: { property: { organizationId } } },
      include: { room: { include: { property: true } } },
    });
    if (!bed) throw new NotFoundException('Bed not found');

    const now = new Date();
    let checkOutTimestamp = now;
    if (checkoutDate) {
      const parsed = new Date(checkoutDate);
      if (!isNaN(parsed.getTime())) checkOutTimestamp = parsed;
    }

    return await this.prisma.$transaction(async (tx) => {
      const openStays = await tx.tenantStayHistory.findMany({
        where: { bedId, checkOutDate: null },
      });

      for (const stay of openStays) {
        await tx.tenantStayHistory.update({
          where: { id: stay.id },
          data: { checkOutDate: checkOutTimestamp },
        });

        // Check if tenant has other active stays or leases
        const otherStays = await tx.tenantStayHistory.findFirst({
          where: { tenantId: stay.tenantId, checkOutDate: null, id: { not: stay.id } },
        });
        const otherLeases = await tx.lease.findFirst({
          where: { tenantId: stay.tenantId, status: { in: [LeaseStatus.ACTIVE, LeaseStatus.NOTICE] } },
        });
        if (!otherStays && !otherLeases) {
          await tx.tenant.update({
            where: { id: stay.tenantId },
            data: { status: TenantStatus.CHECKED_OUT },
          });
        }
      }

      await tx.bed.update({
        where: { id: bedId },
        data: { status: BedStatus.AVAILABLE },
      });

      return { success: true, vacatedStaysCount: openStays.length };
    });
  }

  /**
   * Quick verify KYC for a tenant
   */
  async quickVerifyKyc(
    organizationId: string,
    tenantId: string,
    userId: string,
    input?: { note?: string }
  ) {
    await this.validateTenantAccess(organizationId, tenantId);

    return await this.prisma.$transaction(async (tx) => {
      const docs = await tx.tenantDocument.findMany({
        where: { tenantId },
      });

      if (docs.length > 0) {
        await tx.tenantDocument.updateMany({
          where: { tenantId },
          data: {
            verificationStatus: KycVerificationStatus.VERIFIED,
            verifiedAt: new Date(),
            rejectionReason: null,
          },
        });
      }

      await this.writeAuditLog(tx, organizationId, userId, 'TENANT_KYC_QUICK_VERIFIED', 'TENANT', tenantId, {
        note: input?.note,
      });

      return { success: true, message: 'KYC verified successfully' };
    });
  }

  /**
   * Quick reject KYC for a tenant
   */
  async quickRejectKyc(
    organizationId: string,
    tenantId: string,
    userId: string,
    input: { reason: string }
  ) {
    await this.validateTenantAccess(organizationId, tenantId);

    return await this.prisma.$transaction(async (tx) => {
      await tx.tenantDocument.updateMany({
        where: { tenantId },
        data: {
          verificationStatus: KycVerificationStatus.REJECTED,
          rejectionReason: input.reason || 'Document verification failed',
        },
      });

      await this.writeAuditLog(tx, organizationId, userId, 'TENANT_KYC_QUICK_REJECTED', 'TENANT', tenantId, {
        reason: input.reason,
      });

      return { success: true, message: 'KYC marked as rejected' };
    });
  }
}
