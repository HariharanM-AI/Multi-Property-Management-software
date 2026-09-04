import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AgreementRendererService, AgreementRenderingContext } from './agreement-renderer.service';
import { AgreementPdfService } from './agreement-pdf.service';
import {
  DEFAULT_PG_AGREEMENT_TEMPLATE,
  DEFAULT_RESIDENTIAL_RENT_AGREEMENT_TEMPLATE,
} from './default-agreements.constants';
import {
  AgreementDto,
  AgreementDetailsDto,
  AgreementSummaryDto,
  CreateAgreementDto,
  GenerateAgreementDto,
  SignAgreementDto,
  FinalizeAgreementDto,
  CancelAgreementDto,
  AgreementStatus,
  AgreementType,
  SignatureStatus,
  AgreementSignerType,
  TemplateStatus,
  UserRole,
} from '@propertyos/types';

@Injectable()
export class AgreementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rendererService: AgreementRendererService,
    private readonly pdfService: AgreementPdfService
  ) {}

  /**
   * Creates a new Agreement in DRAFT state.
   */
  async createAgreement(
    organizationId: string,
    propertyId: string,
    dto: CreateAgreementDto,
    userId?: string
  ): Promise<AgreementDto> {
    // 1. Validate property belongs to organization
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, organizationId, deletedAt: null },
    });
    if (!property) {
      throw new NotFoundException(`Property ${propertyId} not found`);
    }

    // 2. Validate tenant belongs to organization
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: dto.tenantId, organizationId, deletedAt: null },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${dto.tenantId} not found`);
    }

    // 3. Validate lease if provided
    if (dto.leaseId) {
      const lease = await this.prisma.lease.findFirst({
        where: { id: dto.leaseId, tenantId: dto.tenantId },
        include: { rentalUnit: true },
      });
      if (!lease || lease.rentalUnit.propertyId !== propertyId) {
        throw new BadRequestException(`Lease ${dto.leaseId} does not belong to the specified tenant and property`);
      }
    }

    // 4. Validate check-in if provided
    if (dto.checkInId) {
      const checkIn = await this.prisma.checkIn.findFirst({
        where: { id: dto.checkInId, organizationId, tenantId: dto.tenantId, propertyId },
      });
      if (!checkIn) {
        throw new BadRequestException(`CheckIn ${dto.checkInId} does not match the specified tenant and property`);
      }
    }

    // 5. Create agreement inside transaction with required initial signatures
    const agreement = await this.prisma.$transaction(async (tx) => {
      const newAgreement = await tx.agreement.create({
        data: {
          organizationId,
          propertyId,
          tenantId: dto.tenantId,
          agreementType: dto.agreementType,
          templateId: dto.templateId || null,
          leaseId: dto.leaseId || null,
          checkInId: dto.checkInId || null,
          status: AgreementStatus.DRAFT,
          version: 1,
          renderedContent: '',
        },
      });

      // Initialize required signature placeholders: TENANT and PROPERTY_MANAGER
      await tx.agreementSignature.createMany({
        data: [
          {
            agreementId: newAgreement.id,
            signerType: AgreementSignerType.TENANT,
            signerName: `${tenant.firstName} ${tenant.lastName}`,
            signerEmail: tenant.email || null,
            status: SignatureStatus.PENDING,
          },
          {
            agreementId: newAgreement.id,
            signerType: AgreementSignerType.PROPERTY_MANAGER,
            signerName: 'Property Manager',
            status: SignatureStatus.PENDING,
          },
        ],
      });

      if (userId) {
        await tx.auditLog.create({
          data: {
            organizationId,
            userId,
            action: 'AGREEMENT_CREATED',
            resourceType: 'AGREEMENT',
            resourceId: newAgreement.id,
            metadata: {
              tenantId: dto.tenantId,
              propertyId,
              agreementType: dto.agreementType,
              version: 1,
            },
          },
        });
      }

      return newAgreement;
    });

    return this.getAgreement(organizationId, agreement.id).then((d) => d.agreement);
  }

  /**
   * Lists agreements for an organization / property.
   */
  async listAgreements(
    organizationId: string,
    query: {
      propertyId?: string;
      tenantId?: string;
      status?: AgreementStatus;
      agreementType?: AgreementType;
      search?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<{ agreements: AgreementDto[]; total: number; page: number; limit: number }> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const where: any = { organizationId };
    if (query.propertyId) where.propertyId = query.propertyId;
    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.status) where.status = query.status;
    if (query.agreementType) where.agreementType = query.agreementType;
    if (query.search) {
      where.OR = [
        { tenant: { firstName: { contains: query.search, mode: 'insensitive' } } },
        { tenant: { lastName: { contains: query.search, mode: 'insensitive' } } },
        { property: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [agreements, total] = await Promise.all([
      this.prisma.agreement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { signatures: true },
      }),
      this.prisma.agreement.count({ where }),
    ]);

    return {
      agreements: agreements as unknown as AgreementDto[],
      total,
      page,
      limit,
    };
  }

  /**
   * Retrieves single agreement details including metadata, signatures, and version lineage.
   */
  async getAgreement(organizationId: string, agreementId: string): Promise<AgreementDetailsDto> {
    const agreement = await this.prisma.agreement.findFirst({
      where: { id: agreementId, organizationId },
      include: {
        template: true,
        signatures: true,
        tenant: true,
        property: true,
        lease: {
          include: {
            rentalUnit: true,
          },
        },
        checkIn: {
          include: {
            bed: {
              include: {
                room: {
                  include: {
                    floor: true,
                  },
                },
              },
            },
          },
        },
        previousAgreement: true,
      },
    });

    if (!agreement) {
      throw new NotFoundException(`Agreement ${agreementId} not found`);
    }

    return {
      agreement: agreement as unknown as AgreementDto,
      template: agreement.template as any,
      signatures: agreement.signatures as any,
      tenant: {
        id: agreement.tenant.id,
        firstName: agreement.tenant.firstName,
        lastName: agreement.tenant.lastName,
        email: agreement.tenant.email,
        phone: agreement.tenant.phone,
        status: agreement.tenant.status,
      },
      property: {
        id: agreement.property.id,
        code: agreement.property.code,
        name: agreement.property.name,
        propertyType: agreement.property.propertyType,
        address: agreement.property.address,
        city: agreement.property.city,
        state: agreement.property.state,
      },
      lease: agreement.lease
        ? {
            id: agreement.lease.id,
            startDate: agreement.lease.startDate,
            endDate: agreement.lease.endDate,
            monthlyRent: Number(agreement.lease.monthlyRent),
            securityDeposit: Number(agreement.lease.securityDeposit),
            status: agreement.lease.status,
            rentalUnit: agreement.lease.rentalUnit
              ? {
                  id: agreement.lease.rentalUnit.id,
                  unitNumber: agreement.lease.rentalUnit.unitNumber,
                }
              : undefined,
          }
        : null,
      checkIn: agreement.checkIn
        ? {
            id: agreement.checkIn.id,
            checkInDate: agreement.checkIn.checkInDate,
            status: agreement.checkIn.status,
            bed: agreement.checkIn.bed
              ? {
                  id: agreement.checkIn.bed.id,
                  bedNumber: agreement.checkIn.bed.bedNumber,
                  room: agreement.checkIn.bed.room
                    ? {
                        roomNumber: agreement.checkIn.bed.room.roomNumber,
                        floor: agreement.checkIn.bed.room.floor
                          ? {
                              floorNumber: agreement.checkIn.bed.room.floor.floorNumber,
                            }
                          : undefined,
                      }
                    : undefined,
                }
              : undefined,
          }
        : null,
    };
  }

  /**
   * Generates renderedContent, calculates SHA-256 hash, creates PDF, and transitions to GENERATED.
   */
  async generateAgreement(
    organizationId: string,
    agreementId: string,
    dto: GenerateAgreementDto,
    userId?: string
  ): Promise<AgreementDto> {
    const agreement = await this.prisma.agreement.findFirst({
      where: { id: agreementId, organizationId },
      include: {
        tenant: true,
        property: true,
        lease: { include: { rentalUnit: true } },
        checkIn: {
          include: {
            bed: {
              include: {
                room: {
                  include: {
                    floor: true,
                  },
                },
              },
            },
          },
        },
        signatures: true,
      },
    });

    if (!agreement) {
      throw new NotFoundException(`Agreement ${agreementId} not found`);
    }

    if (
      agreement.status === AgreementStatus.SIGNED ||
      agreement.status === AgreementStatus.FINALIZED ||
      agreement.status === AgreementStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot regenerate agreement in status ${agreement.status}. Signed or finalized agreements are immutable.`
      );
    }

    // 1. Resolve template
    const templateId = dto.templateId || agreement.templateId;
    let templateContent = '';
    let templateVersion = 1;
    let resolvedTemplateId: string | null = null;

    if (templateId) {
      const template = await this.prisma.agreementTemplate.findFirst({
        where: { id: templateId, organizationId },
      });
      if (!template) {
        throw new NotFoundException(`Template ${templateId} not found`);
      }
      templateContent = template.content;
      templateVersion = template.version;
      resolvedTemplateId = template.id;
    } else {
      // Find active default template for this agreement type
      const activeTemplate = await this.prisma.agreementTemplate.findFirst({
        where: {
          organizationId,
          agreementType: agreement.agreementType,
          status: TemplateStatus.ACTIVE,
        },
        orderBy: { version: 'desc' },
      });

      if (activeTemplate) {
        templateContent = activeTemplate.content;
        templateVersion = activeTemplate.version;
        resolvedTemplateId = activeTemplate.id;
      } else {
        // Default legal template matching uploaded models
        templateContent = this.getDefaultTemplateContent(agreement.agreementType as unknown as AgreementType);
      }
    }

    // Extract owner/landlord metadata and property terms from property
    let ownerName = agreement.property.name;
    let ownerAddress = agreement.property.address;
    let ownerPhone = agreement.property.contactPhone || '';
    let ownerSignature: string | null = null;
    let propNoticePeriodDays = '30';
    let propLockInPeriodValue = '1';
    let propLockInPeriodUnit = 'MONTHS';
    let propLockInMonths = '1';

    if (agreement.property.description && agreement.property.description.startsWith('{')) {
      try {
        const meta = JSON.parse(agreement.property.description);
        if (meta.ownerName) ownerName = meta.ownerName;
        if (meta.ownerAddress) ownerAddress = meta.ownerAddress;
        if (meta.ownerPhone) ownerPhone = meta.ownerPhone;
        if (meta.ownerSignature) ownerSignature = meta.ownerSignature;
        if (meta.noticePeriodDays !== undefined) propNoticePeriodDays = String(meta.noticePeriodDays);
        if (meta.lockInPeriodValue !== undefined) propLockInPeriodValue = String(meta.lockInPeriodValue);
        if (meta.lockInPeriodUnit) propLockInPeriodUnit = meta.lockInPeriodUnit;
        if (meta.lockInMonths !== undefined) propLockInMonths = String(meta.lockInMonths);
      } catch {}
    }

    const today = new Date();
    const formattedPermanentAddress = `${agreement.tenant.permanentAddress}, ${agreement.tenant.permanentCity}, ${agreement.tenant.permanentState} ${agreement.tenant.permanentPostalCode}`;
    const formattedPropertyAddress = `${agreement.property.address}, ${agreement.property.city}, ${agreement.property.state} ${agreement.property.postalCode}`;

    const startDateStr = agreement.checkIn?.checkInDate
      ? agreement.checkIn.checkInDate.toISOString().split('T')[0]
      : (agreement.lease?.startDate ? agreement.lease.startDate.toISOString().split('T')[0] : today.toISOString().split('T')[0]);

    const endDateStr = agreement.lease?.endDate
      ? agreement.lease.endDate.toISOString().split('T')[0]
      : '';

    const monthlyRentVal = agreement.lease
      ? String(agreement.lease.monthlyRent)
      : (agreement.checkIn?.bed ? String(agreement.checkIn.bed.monthlyRent) : '0');

    const depositVal = agreement.lease
      ? String(agreement.lease.securityDeposit)
      : (agreement.checkIn?.bed ? String(Number(agreement.checkIn.bed.monthlyRent) * 2) : '0');

    const allocatedSpace = agreement.checkIn?.bed
      ? `Bed ${agreement.checkIn.bed.bedNumber} (Room ${agreement.checkIn.bed.room?.roomNumber || '—'})`
      : (agreement.lease?.rentalUnit ? `Flat ${agreement.lease.rentalUnit.unitNumber}` : (agreement.property.name));

    const sharingTypeStr = agreement.checkIn?.bed?.room?.sharingType
      ? `${agreement.checkIn.bed.room.sharingType} Sharing`
      : 'Standard Occupancy';

    // 2. Build rendering context from authoritative database state
    const context: AgreementRenderingContext = {
      OWNER_NAME: ownerName,
      LANDLORD_NAME: ownerName,
      OWNER_ADDRESS: ownerAddress,
      LANDLORD_ADDRESS: ownerAddress,
      OWNER_PHONE: ownerPhone,
      LANDLORD_PHONE: ownerPhone,

      RESIDENT_NAME: `${agreement.tenant.firstName} ${agreement.tenant.lastName}`,
      TENANT_NAME: `${agreement.tenant.firstName} ${agreement.tenant.lastName}`,
      TENANT_FIRST_NAME: agreement.tenant.firstName,
      TENANT_LAST_NAME: agreement.tenant.lastName,
      TENANT_PHONE: agreement.tenant.phone,
      TENANT_EMAIL: agreement.tenant.email || '',
      RESIDENT_PERMANENT_ADDRESS: formattedPermanentAddress,
      TENANT_PERMANENT_ADDRESS: formattedPermanentAddress,
      TENANT_ADDRESS: formattedPermanentAddress,
      TENANT_CITY: agreement.tenant.permanentCity,
      TENANT_STATE: agreement.tenant.permanentState,
      TENANT_POSTAL_CODE: agreement.tenant.permanentPostalCode,

      PG_PROPERTY_ADDRESS: formattedPropertyAddress,
      RENTED_PROPERTY_ADDRESS: formattedPropertyAddress,
      PROPERTY_NAME: agreement.property.name,
      PROPERTY_CODE: agreement.property.code,
      PROPERTY_ADDRESS: formattedPropertyAddress,
      PROPERTY_CITY: agreement.property.city,
      PROPERTY_STATE: agreement.property.state,
      PROPERTY_POSTAL_CODE: agreement.property.postalCode,

      ALLOCATED_ROOM_BED_NO: allocatedSpace,
      SHARING_TYPE: sharingTypeStr,
      UNIT_NUMBER: agreement.lease?.rentalUnit ? agreement.lease.rentalUnit.unitNumber : '',
      FLOOR_NUMBER: agreement.checkIn?.bed?.room?.floor ? String(agreement.checkIn.bed.room.floor.floorNumber) : '',
      ROOM_NUMBER: agreement.checkIn?.bed?.room ? agreement.checkIn.bed.room.roomNumber : '',
      BED_NUMBER: agreement.checkIn?.bed ? agreement.checkIn.bed.bedNumber : '',

      ID_PROOF_TYPE: 'Government Photo ID (Aadhaar / Passport / Voter ID)',
      ID_PROOF_NUMBER: 'Verified by Management upon Onboarding',

      MONTHLY_PG_RENT: monthlyRentVal,
      MONTHLY_RENT: monthlyRentVal,
      RENT_PAYMENT_DUE_DAY: '5th',
      SECURITY_DEPOSIT_AMOUNT: depositVal,
      SECURITY_DEPOSIT: `₹${depositVal}`,

      LEASE_START_DATE: startDateStr,
      LEASE_END_DATE: endDateStr,
      AGREEMENT_START_DATE: startDateStr,
      AGREEMENT_END_DATE: endDateStr || '11 Months',
      TENANCY_PERIOD: '11 Months',
      NOTICE_PERIOD_DAYS: agreement.lease?.noticePeriodDays ? String(agreement.lease.noticePeriodDays) : propNoticePeriodDays,
      LOCK_IN_MONTHS: agreement.lease?.lockInMonths ? String(agreement.lease.lockInMonths) : propLockInMonths,
      LOCK_IN_PERIOD_VALUE: propLockInPeriodValue,
      LOCK_IN_PERIOD_UNIT: propLockInPeriodUnit?.toUpperCase() === 'DAYS' ? 'Days' : propLockInPeriodUnit?.toUpperCase() === 'YEARS' ? 'Years' : 'Months',

      AGREEMENT_DAY: String(today.getDate()),
      AGREEMENT_MONTH: today.toLocaleString('en-US', { month: 'long' }),
      AGREEMENT_YEAR: String(today.getFullYear()),
      AGREEMENT_DATE: today.toISOString().split('T')[0],
      CHECK_IN_DATE: startDateStr,

      EMERGENCY_CONTACT_NAME: agreement.tenant.emergencyContactName,
      EMERGENCY_CONTACT_PHONE: agreement.tenant.emergencyContactPhone,
      EMERGENCY_CONTACT_RELATION: agreement.tenant.emergencyContactRelation,
      ...(dto.customData || {}),
    };

    // 3. Render template and compute SHA-256 hash
    const { renderedContent, contentHash } = this.rendererService.renderTemplate(templateContent, context);

    const generatedAt = new Date();

    // 4. Generate PDF and upload to organization-scoped path
    const pdfResult = await this.pdfService.generateAndSavePdf({
      organizationId,
      agreementId: agreement.id,
      agreementType: agreement.agreementType as unknown as AgreementType,
      version: agreement.version,
      renderedContent,
      contentHash,
      generatedAt,
      tenantName: `${agreement.tenant.firstName} ${agreement.tenant.lastName}`,
      propertyName: agreement.property.name,
      ownerSignatureImage: ownerSignature,
      signatures: agreement.signatures as any,
    });

    // 5. Update agreement and signatures inside transaction
    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedAgreement = await tx.agreement.update({
        where: { id: agreementId },
        data: {
          templateId: resolvedTemplateId,
          templateVersion,
          renderedContent,
          contentHash,
          documentPath: pdfResult.documentPath,
          generatedAt,
          status: AgreementStatus.GENERATED,
        },
      });

      // Update signature records with agreement content hash
      await tx.agreementSignature.updateMany({
        where: { agreementId },
        data: { contentHash },
      });

      if (userId) {
        await tx.auditLog.create({
          data: {
            organizationId,
            userId,
            action: 'AGREEMENT_GENERATED',
            resourceType: 'AGREEMENT',
            resourceId: agreementId,
            metadata: {
              contentHash,
              templateVersion,
              documentPath: pdfResult.documentPath,
            },
          },
        });
      }

      return updatedAgreement;
    });

    return updated as unknown as AgreementDto;
  }

  /**
   * Transitions agreement from GENERATED to PENDING_SIGNATURE.
   */
  async sendForSignature(
    organizationId: string,
    agreementId: string,
    userId?: string
  ): Promise<AgreementDto> {
    const agreement = await this.prisma.agreement.findFirst({
      where: { id: agreementId, organizationId },
    });

    if (!agreement) {
      throw new NotFoundException(`Agreement ${agreementId} not found`);
    }

    if (agreement.status !== AgreementStatus.GENERATED) {
      throw new BadRequestException(
        `Agreement must be in GENERATED status to send for signature (current status: ${agreement.status})`
      );
    }

    const updated = await this.prisma.agreement.update({
      where: { id: agreementId },
      data: { status: AgreementStatus.PENDING_SIGNATURE },
    });

    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          organizationId,
          userId,
          action: 'AGREEMENT_SENT_FOR_SIGNATURE',
          resourceType: 'AGREEMENT',
          resourceId: agreementId,
        },
      });
    }

    return updated as unknown as AgreementDto;
  }

  /**
   * Records digital signature/acceptance from authorized tenant, manager, or owner.
   */
  async signAgreement(
    organizationId: string,
    agreementId: string,
    dto: SignAgreementDto,
    authUser: { id: string; role?: UserRole; roles?: UserRole[]; email?: string }
  ): Promise<AgreementDto> {
    const agreement = await this.prisma.agreement.findFirst({
      where: { id: agreementId, organizationId },
      include: {
        tenant: true,
        signatures: true,
      },
    });

    if (!agreement) {
      throw new NotFoundException(`Agreement ${agreementId} not found`);
    }

    if (
      agreement.status !== AgreementStatus.PENDING_SIGNATURE &&
      agreement.status !== AgreementStatus.PARTIALLY_SIGNED
    ) {
      throw new BadRequestException(
        `Agreement is not currently open for signature (current status: ${agreement.status})`
      );
    }

    if (!agreement.contentHash) {
      throw new BadRequestException('Agreement has not been generated or hashed yet.');
    }

    const userRoles = authUser.roles || (authUser.role ? [authUser.role] : []);
    const isOwnerOrManager =
      userRoles.includes(UserRole.OWNER) ||
      userRoles.includes(UserRole.PROPERTY_MANAGER) ||
      userRoles.includes(UserRole.WARDEN);

    // Verify signer authorization
    if (dto.signerType === AgreementSignerType.TENANT) {
      // Signer must match tenant record or have tenant/manager/owner role
      const isMatchingTenant =
        authUser.email?.toLowerCase() === agreement.tenant.email?.toLowerCase() ||
        userRoles.includes(UserRole.TENANT) ||
        isOwnerOrManager;

      if (!isMatchingTenant) {
        throw new ForbiddenException('You are not authorized to sign as this tenant');
      }
    } else if (
      dto.signerType === AgreementSignerType.PROPERTY_MANAGER ||
      dto.signerType === AgreementSignerType.OWNER
    ) {
      if (userRoles.length > 0 && !isOwnerOrManager) {
        throw new ForbiddenException('You are not authorized to execute management signature');
      }
    }

    // Update signature inside transaction
    const updated = await this.prisma.$transaction(async (tx) => {
      // Find existing signature record or create one
      const existingSig = agreement.signatures.find((s) => s.signerType === dto.signerType);

      if (existingSig && existingSig.status === SignatureStatus.SIGNED) {
        // Idempotent: already signed
        return agreement;
      }

      if (existingSig) {
        await tx.agreementSignature.update({
          where: { id: existingSig.id },
          data: {
            signerName: dto.signerName.trim(),
            signerEmail: dto.signerEmail || existingSig.signerEmail,
            status: SignatureStatus.SIGNED,
            signedAt: new Date(),
            signatureData: dto.signatureData || 'ACCEPTED_DIGITALLY',
            ipAddress: dto.ipAddress || null,
            userAgent: dto.userAgent || null,
            contentHash: agreement.contentHash,
          },
        });
      } else {
        await tx.agreementSignature.create({
          data: {
            agreementId,
            signerType: dto.signerType,
            signerName: dto.signerName.trim(),
            signerEmail: dto.signerEmail || null,
            status: SignatureStatus.SIGNED,
            signedAt: new Date(),
            signatureData: dto.signatureData || 'ACCEPTED_DIGITALLY',
            ipAddress: dto.ipAddress || null,
            userAgent: dto.userAgent || null,
            contentHash: agreement.contentHash,
          },
        });
      }

      // Re-query all signatures to check completion
      const allSigs = await tx.agreementSignature.findMany({
        where: { agreementId },
      });

      const allSigned = allSigs.length >= 2 && allSigs.every((s) => s.status === SignatureStatus.SIGNED);
      const someSigned = allSigs.some((s) => s.status === SignatureStatus.SIGNED);

      let newStatus = agreement.status;
      let signedAt = agreement.signedAt;

      if (allSigned) {
        newStatus = AgreementStatus.SIGNED;
        signedAt = new Date();
      } else if (someSigned) {
        newStatus = AgreementStatus.PARTIALLY_SIGNED;
      }

      const updatedAgreement = await tx.agreement.update({
        where: { id: agreementId },
        data: {
          status: newStatus,
          signedAt,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          userId: authUser.id,
          action: 'AGREEMENT_SIGNED',
          resourceType: 'AGREEMENT',
          resourceId: agreementId,
          metadata: {
            signerType: dto.signerType,
            signerName: dto.signerName,
            status: newStatus,
            contentHash: agreement.contentHash,
          },
        },
      });

      return updatedAgreement;
    });

    return updated as unknown as AgreementDto;
  }

  /**
   * Finalizes an agreement when all signatures are SIGNED and verified.
   */
  async finalizeAgreement(
    organizationId: string,
    agreementId: string,
    _dto: FinalizeAgreementDto,
    userId?: string
  ): Promise<AgreementDto> {
    const agreement = await this.prisma.agreement.findFirst({
      where: { id: agreementId, organizationId },
      include: { signatures: true },
    });

    if (!agreement) {
      throw new NotFoundException(`Agreement ${agreementId} not found`);
    }

    // Idempotency: if already FINALIZED, return safely without duplicate side-effects
    if (agreement.status === AgreementStatus.FINALIZED) {
      return agreement as unknown as AgreementDto;
    }

    if (agreement.status !== AgreementStatus.SIGNED) {
      throw new BadRequestException(
        `Agreement cannot be finalized until it is SIGNED by all required parties (current status: ${agreement.status})`
      );
    }

    // Verify all signatures are signed and hashes match
    const requiredSigs = agreement.signatures;
    if (requiredSigs.length < 2 || !requiredSigs.every((s) => s.status === SignatureStatus.SIGNED)) {
      throw new BadRequestException('Not all required parties have completed their signature.');
    }

    for (const sig of requiredSigs) {
      if (sig.contentHash !== agreement.contentHash) {
        throw new BadRequestException(
          `Signature hash mismatch for signer ${sig.signerType}. Document integrity cannot be confirmed.`
        );
      }
    }

    // Execute atomic finalization
    const finalized = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.agreement.update({
        where: { id: agreementId },
        data: {
          status: AgreementStatus.FINALIZED,
          finalizedAt: new Date(),
        },
      });

      // Auto-save executed agreement PDF to Tenant Profile Documents
      if (agreement.documentPath) {
        const existingDoc = await tx.tenantDocument.findFirst({
          where: { tenantId: agreement.tenantId, documentNumber: agreement.id },
        });

        if (!existingDoc) {
          await tx.tenantDocument.create({
            data: {
              tenantId: agreement.tenantId,
              documentType: 'RENTAL_AGREEMENT' as any,
              documentNumber: agreement.id,
              storagePath: agreement.documentPath,
              originalFileName: `${agreement.agreementType === 'RENTAL_AGREEMENT' ? 'Residential_Rent_Agreement' : 'PG_Stay_Agreement'}_${agreement.id.slice(0, 8)}.pdf`,
              fileSize: 120000,
              mimeType: 'application/pdf',
              verificationStatus: 'VERIFIED' as any,
              verifiedAt: new Date(),
            },
          });
        }
      }

      if (userId) {
        await tx.auditLog.create({
          data: {
            organizationId,
            userId,
            action: 'AGREEMENT_FINALIZED',
            resourceType: 'AGREEMENT',
            resourceId: agreementId,
            metadata: {
              contentHash: agreement.contentHash,
              finalizedAt: updated.finalizedAt,
            },
          },
        });
      }

      return updated;
    });

    return finalized as unknown as AgreementDto;
  }

  /**
   * Cancels an agreement before finalization.
   */
  async cancelAgreement(
    organizationId: string,
    agreementId: string,
    dto: CancelAgreementDto,
    userId?: string
  ): Promise<AgreementDto> {
    const agreement = await this.prisma.agreement.findFirst({
      where: { id: agreementId, organizationId },
    });

    if (!agreement) {
      throw new NotFoundException(`Agreement ${agreementId} not found`);
    }

    if (
      agreement.status === AgreementStatus.SIGNED ||
      agreement.status === AgreementStatus.FINALIZED ||
      agreement.status === AgreementStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot cancel agreement in status ${agreement.status}. Signed/Finalized agreements are immutable.`
      );
    }

    const updated = await this.prisma.agreement.update({
      where: { id: agreementId },
      data: {
        status: AgreementStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });

    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          organizationId,
          userId,
          action: 'AGREEMENT_CANCELLED',
          resourceType: 'AGREEMENT',
          resourceId: agreementId,
          metadata: { reason: dto.reason || null },
        },
      });
    }

    return updated as unknown as AgreementDto;
  }

  /**
   * Creates a new version branching from a previous agreement.
   */
  async createNewVersion(
    organizationId: string,
    agreementId: string,
    _input: any,
    userId?: string
  ): Promise<AgreementDto> {
    const previous = await this.prisma.agreement.findFirst({
      where: { id: agreementId, organizationId },
      include: { tenant: true },
    });

    if (!previous) {
      throw new NotFoundException(`Agreement ${agreementId} not found`);
    }

    const nextVersionNumber = previous.version + 1;

    const newAgreement = await this.prisma.$transaction(async (tx) => {
      const created = await tx.agreement.create({
        data: {
          organizationId,
          propertyId: previous.propertyId,
          tenantId: previous.tenantId,
          agreementType: previous.agreementType,
          templateId: previous.templateId,
          leaseId: previous.leaseId,
          checkInId: previous.checkInId,
          status: AgreementStatus.DRAFT,
          version: nextVersionNumber,
          previousAgreementId: previous.id,
          renderedContent: '',
        },
      });

      // Initialize required signatures
      await tx.agreementSignature.createMany({
        data: [
          {
            agreementId: created.id,
            signerType: AgreementSignerType.TENANT,
            signerName: `${previous.tenant.firstName} ${previous.tenant.lastName}`,
            signerEmail: previous.tenant.email || null,
            status: SignatureStatus.PENDING,
          },
          {
            agreementId: created.id,
            signerType: AgreementSignerType.PROPERTY_MANAGER,
            signerName: 'Property Manager',
            status: SignatureStatus.PENDING,
          },
        ],
      });

      if (userId) {
        await tx.auditLog.create({
          data: {
            organizationId,
            userId,
            action: 'AGREEMENT_VERSION_CREATED',
            resourceType: 'AGREEMENT',
            resourceId: created.id,
            metadata: {
              previousAgreementId: previous.id,
              version: nextVersionNumber,
            },
          },
        });
      }

      return created;
    });

    return newAgreement as unknown as AgreementDto;
  }

  /**
   * Returns signatures for an agreement.
   */
  async getSignatures(organizationId: string, agreementId: string) {
    const agreement = await this.prisma.agreement.findFirst({
      where: { id: agreementId, organizationId },
      include: { signatures: true },
    });

    if (!agreement) {
      throw new NotFoundException(`Agreement ${agreementId} not found`);
    }

    return agreement.signatures;
  }

  /**
   * Returns document download path.
   */
  async getDocument(organizationId: string, agreementId: string) {
    const agreement = await this.prisma.agreement.findFirst({
      where: { id: agreementId, organizationId },
    });

    if (!agreement) {
      throw new NotFoundException(`Agreement ${agreementId} not found`);
    }

    if (!agreement.documentPath) {
      throw new NotFoundException(`PDF document has not been generated for agreement ${agreementId}`);
    }

    return {
      documentPath: agreement.documentPath,
      contentHash: agreement.contentHash,
      status: agreement.status,
    };
  }

  /**
   * Retrieves summary counts for the dashboard.
   */
  async getSummary(organizationId: string, propertyId?: string): Promise<AgreementSummaryDto> {
    const where: any = { organizationId };
    if (propertyId) where.propertyId = propertyId;

    const [total, draft, pendingSignature, partiallySigned, signed, finalized, cancelled] = await Promise.all([
      this.prisma.agreement.count({ where }),
      this.prisma.agreement.count({ where: { ...where, status: AgreementStatus.DRAFT } }),
      this.prisma.agreement.count({ where: { ...where, status: AgreementStatus.PENDING_SIGNATURE } }),
      this.prisma.agreement.count({ where: { ...where, status: AgreementStatus.PARTIALLY_SIGNED } }),
      this.prisma.agreement.count({ where: { ...where, status: AgreementStatus.SIGNED } }),
      this.prisma.agreement.count({ where: { ...where, status: AgreementStatus.FINALIZED } }),
      this.prisma.agreement.count({ where: { ...where, status: AgreementStatus.CANCELLED } }),
    ]);

    return {
      total,
      draft,
      pendingSignature,
      partiallySigned,
      signed,
      finalized,
      cancelled,
    };
  }

  private getDefaultTemplateContent(type: AgreementType): string {
    if (type === AgreementType.PG_AGREEMENT) {
      return DEFAULT_PG_AGREEMENT_TEMPLATE;
    }
    if (type === AgreementType.RENTAL_AGREEMENT) {
      return DEFAULT_RESIDENTIAL_RENT_AGREEMENT_TEMPLATE;
    }
    return DEFAULT_PG_AGREEMENT_TEMPLATE;
  }
}
