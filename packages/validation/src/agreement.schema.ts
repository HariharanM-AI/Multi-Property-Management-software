import { z } from 'zod';
import {
  AgreementType,
  TemplateStatus,
  AgreementStatus,
  SignatureStatus,
  AgreementSignerType,
} from '@propertyos/types';

export const CreateAgreementTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Template name is required').max(200, 'Template name too long'),
  agreementType: z.nativeEnum(AgreementType, {
    errorMap: () => ({ message: 'Invalid agreement type' }),
  }),
  description: z.string().trim().max(1000, 'Description too long').optional(),
  content: z.string().min(1, 'Template content is required').max(100000, 'Template content exceeds 100KB limit'),
});

export const UpdateAgreementTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Template name is required').max(200, 'Template name too long').optional(),
  description: z.string().trim().max(1000, 'Description too long').optional().nullable(),
  content: z.string().min(1, 'Template content is required').max(100000, 'Template content exceeds 100KB limit').optional(),
});

export const CreateAgreementSchema = z.object({
  tenantId: z.string().uuid('Valid tenantId UUID is required'),
  agreementType: z.nativeEnum(AgreementType, {
    errorMap: () => ({ message: 'Invalid agreement type' }),
  }),
  templateId: z.string().uuid('Valid templateId UUID is required').optional(),
  leaseId: z.string().uuid('Valid leaseId UUID is required').optional(),
  checkInId: z.string().uuid('Valid checkInId UUID is required').optional(),
});

export const GenerateAgreementSchema = z.object({
  templateId: z.string().uuid('Valid templateId UUID is required').optional(),
  customData: z.record(z.string()).optional(),
});

export const SignAgreementSchema = z.object({
  signerType: z.nativeEnum(AgreementSignerType, {
    errorMap: () => ({ message: 'Invalid signer type' }),
  }),
  signerName: z.string().trim().min(1, 'Signer name is required').max(150, 'Signer name too long'),
  signerEmail: z.string().email('Invalid email address').optional().nullable(),
  signatureData: z.string().max(100000, 'Signature payload too large').optional().nullable(),
  ipAddress: z.string().max(100).optional().nullable(),
  userAgent: z.string().max(500).optional().nullable(),
});

export const FinalizeAgreementSchema = z.object({
  notes: z.string().trim().max(1000, 'Notes too long').optional(),
});

export const CancelAgreementSchema = z.object({
  reason: z.string().trim().max(500, 'Reason must not exceed 500 characters').optional(),
});

export const AgreementFilterSchema = z.object({
  status: z.nativeEnum(AgreementStatus).optional(),
  agreementType: z.nativeEnum(AgreementType).optional(),
  tenantId: z.string().uuid().optional(),
  propertyId: z.string().uuid().optional(),
  leaseId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
});

export type CreateAgreementTemplateInput = z.infer<typeof CreateAgreementTemplateSchema>;
export type UpdateAgreementTemplateInput = z.infer<typeof UpdateAgreementTemplateSchema>;
export type CreateAgreementInput = z.infer<typeof CreateAgreementSchema>;
export type GenerateAgreementInput = z.infer<typeof GenerateAgreementSchema>;
export type SignAgreementInput = z.infer<typeof SignAgreementSchema>;
export type FinalizeAgreementInput = z.infer<typeof FinalizeAgreementSchema>;
export type CancelAgreementInput = z.infer<typeof CancelAgreementSchema>;
export type AgreementFilterInput = z.infer<typeof AgreementFilterSchema>;
