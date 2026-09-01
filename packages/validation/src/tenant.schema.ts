import { z } from 'zod';
import { TenantStatus, KycDocumentType, KycVerificationStatus } from '@propertyos/types';

export const CreateTenantSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(50),
  lastName: z.string().trim().min(1, 'Last name is required').max(50),
  email: z.string().trim().email('Invalid email address').nullable().optional().or(z.literal('')),
  phone: z.string().trim().min(7, 'Phone number must be at least 7 digits').max(15, 'Phone number too long'),
  dateOfBirth: z.string().nullable().optional(),
  gender: z.string().optional(),
  documentType: z.string().optional().nullable(),
  documentNumber: z.string().trim().max(100).optional().nullable().or(z.literal('')),
  permanentAddress: z.string().trim().max(255).optional().nullable().or(z.literal('')),
  permanentCity: z.string().trim().max(100).optional().nullable().or(z.literal('')),
  permanentState: z.string().trim().max(100).optional().nullable().or(z.literal('')),
  permanentPostalCode: z.string().trim().max(20).optional().nullable().or(z.literal('')),
  occupation: z.string().trim().max(100).nullable().optional().or(z.literal('')),
  employerOrCollege: z.string().trim().max(100).nullable().optional().or(z.literal('')),
  emergencyContactName: z.string().trim().max(100).optional().nullable().or(z.literal('')),
  emergencyContactPhone: z.string().trim().max(20).optional().nullable().or(z.literal('')),
  emergencyContactRelation: z.string().trim().max(50).optional().nullable().or(z.literal('')),
}).passthrough();

export const UpdateTenantSchema = CreateTenantSchema.partial().extend({
  status: z.nativeEnum(TenantStatus).optional(),
});

export const UploadTenantDocumentSchema = z.object({
  documentType: z.nativeEnum(KycDocumentType),
  documentNumber: z.string().trim().max(100).nullable().optional(),
});

export const VerifyDocumentSchema = z.object({
  status: z.enum([KycVerificationStatus.VERIFIED, KycVerificationStatus.REJECTED]),
  rejectionReason: z.string().trim().max(500).nullable().optional(),
}).refine(
  (data) => {
    if (data.status === KycVerificationStatus.REJECTED && (!data.rejectionReason || data.rejectionReason.trim().length === 0)) {
      return false;
    }
    return true;
  },
  {
    message: 'Rejection reason is required when rejecting a document',
    path: ['rejectionReason'],
  }
);

export type CreateTenantInput = z.infer<typeof CreateTenantSchema>;
export type UpdateTenantInput = z.infer<typeof UpdateTenantSchema>;
export type UploadTenantDocumentInput = z.infer<typeof UploadTenantDocumentSchema>;
export type VerifyDocumentInput = z.infer<typeof VerifyDocumentSchema>;
