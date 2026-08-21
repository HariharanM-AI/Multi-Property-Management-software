import { z } from 'zod';
import { UserRole } from '@propertyos/types';

// Strict Indian phone number regex: 10 digits starting with 6-9, optional +91 prefix
export const indianPhoneRegex = /^(?:\+91)?[6-9]\d{9}$/;

export const RegisterOwnerSchema = z.object({
  organizationName: z.string().trim().min(2, 'Organization name must be at least 2 characters').max(100),
  firstName: z.string().trim().min(1, 'First name is required').max(50),
  lastName: z.string().trim().min(1, 'Last name is required').max(50),
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  phone: z.string().trim().regex(indianPhoneRegex, 'Must be a valid 10-digit Indian mobile number (+91 optional)'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be under 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

export const LoginSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const PasswordResetRequestSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
});

export const PasswordResetConfirmSchema = z.object({
  token: z.string().min(10, 'Invalid or expired token'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
});

export type RegisterOwnerInput = z.infer<typeof RegisterOwnerSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type PasswordResetRequestInput = z.infer<typeof PasswordResetRequestSchema>;
export type PasswordResetConfirmInput = z.infer<typeof PasswordResetConfirmSchema>;
