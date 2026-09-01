import { TenantStatus, KycDocumentType, KycVerificationStatus } from './domain.js';
import { LeaseDto } from './rental.js';

export interface TenantDto {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  dateOfBirth: Date | null;
  permanentAddress: string;
  permanentCity: string;
  permanentState: string;
  permanentPostalCode: string;
  occupation: string | null;
  employerOrCollege: string | null;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  gender?: string | null;
  status: TenantStatus;
  propertyId?: string | null;
  currentStay?: any;
  currentLease?: any;
  stayHistories?: any[];
  leases?: any[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateTenantDto {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone: string;
  dateOfBirth?: string | null; // ISO Date String
  gender?: string;
  documentType?: string | null;
  documentNumber?: string | null;
  permanentAddress?: string | null;
  permanentCity?: string | null;
  permanentState?: string | null;
  permanentPostalCode?: string | null;
  occupation?: string | null;
  employerOrCollege?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
}

export interface UpdateTenantDto {
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phone?: string;
  dateOfBirth?: string | null;
  gender?: string;
  documentType?: string | null;
  documentNumber?: string | null;
  permanentAddress?: string | null;
  permanentCity?: string | null;
  permanentState?: string | null;
  permanentPostalCode?: string | null;
  occupation?: string | null;
  employerOrCollege?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  status?: TenantStatus;
}

export interface TenantDocumentDto {
  id: string;
  tenantId: string;
  documentType: KycDocumentType;
  documentNumber: string | null;
  storagePath: string;
  originalFileName: string;
  fileSize: number;
  mimeType: string;
  verificationStatus: KycVerificationStatus;
  rejectionReason: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VerifyDocumentDto {
  status: KycVerificationStatus;
  rejectionReason?: string | null;
}

export interface TenantStayHistoryDto {
  id: string;
  tenantId: string;
  bedId: string;
  checkInDate: Date;
  checkOutDate: Date | null;
  monthlyRent: number;
  createdAt: Date;
}

export interface TenantDetailsDto {
  tenant: TenantDto;
  documents: TenantDocumentDto[];
  stays: TenantStayHistoryDto[];
  leases: LeaseDto[];
}
