import { z } from 'zod';
import { RentalUnitStatus, LeaseStatus } from '@propertyos/types';

export const CreateRentalUnitSchema = z.object({
  unitNumber: z.string().trim().min(1, 'Unit number is required').max(50),
  unitType: z.string().trim().min(1, 'Unit type is required'),
  floorNumber: z.number().int().nullable().optional(),
  superBuiltupAreaSqFt: z.number().positive('Super built-up area must be positive').nullable().optional(),
  carpetAreaSqFt: z.number().positive('Carpet area must be positive').nullable().optional(),
  furnishingStatus: z.enum(['UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED']).default('SEMI_FURNISHED'),
  monthlyRent: z.number().positive('Monthly rent must be positive'),
  securityDeposit: z.number().positive('Security deposit must be positive'),
  maintenanceCharges: z.number().nonnegative('Maintenance charges cannot be negative').default(0),
});

export const UpdateRentalUnitSchema = CreateRentalUnitSchema.partial().extend({
  status: z.nativeEnum(RentalUnitStatus).optional(),
});

export const LeaseBaseSchema = z.object({
  rentalUnitId: z.string().uuid('Invalid rental unit ID'),
  tenantId: z.string().uuid('Invalid tenant ID'),
  startDate: z.string().min(1, 'Invalid start date format'),
  endDate: z.string().min(1, 'Invalid end date format'),
  monthlyRent: z.number().positive('Monthly rent must be positive'),
  securityDeposit: z.number().positive('Security deposit must be positive'),
  noticePeriodDays: z.number().int().nonnegative().default(30),
  lockInMonths: z.number().int().nonnegative().default(6),
  terms: z.string().trim().max(1000).nullable().optional(),
});

export const CreateLeaseSchema = LeaseBaseSchema.refine(data => new Date(data.startDate) < new Date(data.endDate), {
  message: 'End date must be strictly after start date',
  path: ['endDate'],
});

export const UpdateLeaseSchema = LeaseBaseSchema.partial().extend({
  status: z.nativeEnum(LeaseStatus).optional(),
});

export const CreateRentEscalationSchema = z.object({
  effectiveDate: z.string().datetime({ message: 'Invalid effective date format' }),
  percentage: z.number().min(0, 'Percentage cannot be negative').max(100, 'Percentage cannot exceed 100%'),
  notes: z.string().trim().max(200).nullable().optional(),
});
