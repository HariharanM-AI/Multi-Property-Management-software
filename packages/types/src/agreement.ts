export enum AgreementType {
  RENTAL_AGREEMENT = 'RENTAL_AGREEMENT',
  PG_AGREEMENT = 'PG_AGREEMENT',
  HOUSE_RULES = 'HOUSE_RULES',
  ADDENDUM = 'ADDENDUM',
  OTHER = 'OTHER',
}

export enum TemplateStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum AgreementStatus {
  DRAFT = 'DRAFT',
  GENERATED = 'GENERATED',
  PENDING_SIGNATURE = 'PENDING_SIGNATURE',
  PARTIALLY_SIGNED = 'PARTIALLY_SIGNED',
  SIGNED = 'SIGNED',
  FINALIZED = 'FINALIZED',
  CANCELLED = 'CANCELLED',
}

export enum SignatureStatus {
  PENDING = 'PENDING',
  SIGNED = 'SIGNED',
  DECLINED = 'DECLINED',
}

export enum AgreementSignerType {
  TENANT = 'TENANT',
  PROPERTY_MANAGER = 'PROPERTY_MANAGER',
  OWNER = 'OWNER',
}

export interface AgreementTemplateDto {
  id: string;
  organizationId: string;
  name: string;
  agreementType: AgreementType;
  description: string | null;
  content: string;
  version: number;
  status: TemplateStatus;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateAgreementTemplateDto {
  name: string;
  agreementType: AgreementType;
  description?: string;
  content: string;
}

export interface UpdateAgreementTemplateDto {
  name?: string;
  description?: string;
  content?: string;
}

export interface AgreementSignatureDto {
  id: string;
  agreementId: string;
  signerType: AgreementSignerType;
  signerName: string;
  signerEmail: string | null;
  status: SignatureStatus;
  signedAt: Date | string | null;
  signatureData: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  contentHash: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface AgreementDto {
  id: string;
  organizationId: string;
  tenantId: string;
  propertyId: string;
  templateId: string | null;
  leaseId: string | null;
  checkInId: string | null;
  agreementType: AgreementType;
  status: AgreementStatus;
  version: number;
  previousAgreementId: string | null;
  templateVersion: number | null;
  renderedContent: string;
  documentPath: string | null;
  contentHash: string | null;
  generatedAt: Date | string | null;
  signedAt: Date | string | null;
  finalizedAt: Date | string | null;
  cancelledAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  signatures?: AgreementSignatureDto[];
}

export interface CreateAgreementDto {
  tenantId: string;
  agreementType: AgreementType;
  templateId?: string;
  leaseId?: string;
  checkInId?: string;
}

export interface GenerateAgreementDto {
  templateId?: string;
  customData?: Record<string, string>;
}

export interface SignAgreementDto {
  signerType: AgreementSignerType;
  signerName: string;
  signerEmail?: string;
  signatureData?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface FinalizeAgreementDto {
  notes?: string;
}

export interface CancelAgreementDto {
  reason?: string;
}

export interface AgreementDetailsDto {
  agreement: AgreementDto;
  template?: AgreementTemplateDto | null;
  signatures: AgreementSignatureDto[];
  tenant: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string;
    status: string;
  };
  property: {
    id: string;
    code: string;
    name: string;
    propertyType: string;
    address: string;
    city: string;
    state: string;
  };
  lease?: {
    id: string;
    startDate: Date | string;
    endDate: Date | string;
    monthlyRent: number | string;
    securityDeposit: number | string;
    status: string;
    rentalUnit?: {
      id: string;
      unitNumber: string;
    };
  } | null;
  checkIn?: {
    id: string;
    checkInDate: Date | string;
    status: string;
    bed?: {
      id: string;
      bedNumber: string;
      room?: {
        roomNumber: string;
        floor?: {
          floorNumber: number;
        };
      };
    };
  } | null;
  previousVersions?: AgreementDto[];
}

export interface AgreementSummaryDto {
  total: number;
  draft: number;
  pendingSignature: number;
  partiallySigned: number;
  signed: number;
  finalized: number;
  cancelled: number;
}
