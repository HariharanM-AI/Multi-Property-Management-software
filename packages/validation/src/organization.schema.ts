import { z } from 'zod';
import { UserRole } from '@propertyos/types';
import { indianPhoneRegex } from './auth.schema';

// GSTIN format: 2 digits state code + 10 chars PAN + 1 digit entity number + 1 char Z + 1 check digit
export const GstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export const UpdateOrganizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Organization name must be at least 2 characters.')
    .max(100, 'Organization name must not exceed 100 characters.')
    .optional(),
  legalName: z
    .string()
    .trim()
    .max(150, 'Legal name must not exceed 150 characters.')
    .nullable()
    .optional(),
  taxIdGst: z
    .string()
    .trim()
    .regex(GstinRegex, 'Invalid GSTIN format (e.g. 29ABCDE1234F1Z5).')
    .nullable()
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .trim()
    .regex(indianPhoneRegex, 'Enter a valid 10-digit Indian mobile number.')
    .nullable()
    .optional()
    .or(z.literal('')),
  email: z
    .string()
    .trim()
    .email('Invalid email address format.')
    .toLowerCase()
    .nullable()
    .optional()
    .or(z.literal('')),
});

export const InviteTeamMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Please provide a valid email address for the invitation.')
    .toLowerCase(),
  role: z
    .nativeEnum(UserRole, {
      errorMap: () => ({ message: 'Please select a valid role.' }),
    })
    .refine((role) => role !== UserRole.TENANT, {
      message: 'Tenants cannot be invited via staff team invitations.',
    }),
});

export const AcceptInvitationSchema = z.object({
  token: z
    .string()
    .trim()
    .min(32, 'Invalid or malformed invitation token.'),
  firstName: z
    .string()
    .trim()
    .min(1, 'First name is required.')
    .max(50, 'First name must not exceed 50 characters.')
    .optional(),
  lastName: z
    .string()
    .trim()
    .min(1, 'Last name is required.')
    .max(50, 'Last name must not exceed 50 characters.')
    .optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long.')
    .max(100, 'Password must not exceed 100 characters.')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter.')
    .regex(/[0-9]/, 'Password must contain at least one numeric digit.')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character.')
    .optional(),
});

export const UpdateMemberRoleSchema = z.object({
  role: z.nativeEnum(UserRole, {
    errorMap: () => ({ message: 'Please select a valid role.' }),
  }),
});

export type UpdateOrganizationInput = z.infer<typeof UpdateOrganizationSchema>;
export type InviteTeamMemberInput = z.infer<typeof InviteTeamMemberSchema>;
export type AcceptInvitationInput = z.infer<typeof AcceptInvitationSchema>;
export type UpdateMemberRoleInput = z.infer<typeof UpdateMemberRoleSchema>;
