import { z } from 'zod';
import { TenantStatus, KycDocumentType } from '@propertyos/types';
import { indianPhoneRegex } from './auth.schema.js';

export const CreateTenantProfileSchema = z.object({
  organizationId: z.string().uuid(),
  firstName: z.string().trim().min(1, 'First name is required').max(50),
  lastName: z.string().trim().min(1, 'Last name is required').max(50),
  email: z.string().trim().email('Invalid email').toLowerCase().optional().nullable(),
  phone: z.string().trim().regex(indianPhoneRegex, 'Must be a valid 10-digit Indian phone number'),
  dateOfBirth: z.string().datetime().optional().nullable(),
  permanentAddress: z.string().trim().min(5).max(255),
  permanentCity: z.string().trim().min(2).max(100),
  permanentState: z.string().trim().min(2).max(100),
  permanentPostalCode: z.string().trim().min(6).max(10),
  occupation: z.string().trim().max(100).optional().nullable(),
  employerOrCollege: z.string().trim().max(100).optional().nullable(),
  emergencyContactName: z.string().trim().min(1).max(100),
  emergencyContactPhone: z.string().trim().regex(indianPhoneRegex),
  emergencyContactRelation: z.string().trim().min(1).max(50),
  status: z.nativeEnum(TenantStatus).optional().default(TenantStatus.PROSPECT),
});

export const UploadKycDocumentMetadataSchema = z.object({
  tenantId: z.string().uuid(),
  documentType: z.nativeEnum(KycDocumentType),
  documentNumber: z.string().trim().min(1).max(50).optional().nullable(),
  fileName: z.string().min(1),
  fileSize: z.number().int().positive().max(26214400, 'File exceeds 25MB max size'),
  mimeType: z.enum([
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
  ]),
});

export const CheckInTenantSchema = z.object({
  tenantId: z.string().uuid(),
  propertyId: z.string().uuid(),
  propertyType: z.enum(['PG', 'RENTAL_HOUSE']),
  bedId: z.string().uuid().optional().nullable(),
  rentalUnitId: z.string().uuid().optional().nullable(),
  startDate: z.string().datetime(),
  monthlyRent: z.number().positive(),
  securityDeposit: z.number().nonnegative(),
  agreementTemplateId: z.string().uuid().optional().nullable(),
}).refine(
  (data) => {
    if (data.propertyType === 'PG') return !!data.bedId;
    if (data.propertyType === 'RENTAL_HOUSE') return !!data.rentalUnitId;
    return false;
  },
  {
    message: 'Must provide bedId for PG properties or rentalUnitId for Whole-Unit Rental properties',
  }
);

export type CreateTenantProfileInput = z.infer<typeof CreateTenantProfileSchema>;
export type UploadKycDocumentMetadataInput = z.infer<typeof UploadKycDocumentMetadataSchema>;
export type CheckInTenantInput = z.infer<typeof CheckInTenantSchema>;
