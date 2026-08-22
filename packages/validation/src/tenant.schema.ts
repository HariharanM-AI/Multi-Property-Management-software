import { z } from 'zod';
import { TenantStatus, KycDocumentType, KycVerificationStatus } from '@propertyos/types';

export const CreateTenantSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(50),
  lastName: z.string().trim().min(1, 'Last name is required').max(50),
  email: z.string().trim().email('Invalid email address').nullable().optional(),
  phone: z.string().trim().min(7, 'Phone number must be at least 7 digits').max(15, 'Phone number too long'),
  dateOfBirth: z.string().datetime({ message: 'Invalid date of birth format' }).nullable().optional(),
  permanentAddress: z.string().trim().min(1, 'Permanent address is required').max(255),
  permanentCity: z.string().trim().min(1, 'City is required').max(100),
  permanentState: z.string().trim().min(1, 'State is required').max(100),
  permanentPostalCode: z.string().trim().min(1, 'Postal code is required').max(20),
  occupation: z.string().trim().max(100).nullable().optional(),
  employerOrCollege: z.string().trim().max(100).nullable().optional(),
  emergencyContactName: z.string().trim().min(1, 'Emergency contact name is required').max(100),
  emergencyContactPhone: z.string().trim().min(1, 'Emergency contact phone is required').max(20),
  emergencyContactRelation: z.string().trim().min(1, 'Emergency contact relation is required').max(50),
});

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
