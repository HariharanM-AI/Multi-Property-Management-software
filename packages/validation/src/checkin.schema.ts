import { z } from 'zod';
import { CheckInStatus } from '@propertyos/types';

export const CreatePgCheckInSchema = z
  .object({
    tenantId: z.string().uuid('Invalid tenant ID format'),
    bedId: z.string().uuid('Invalid bed ID format'),
    checkInDate: z.coerce.date({ required_error: 'Check-in date is required' }),
    expectedCheckoutDate: z.coerce.date().optional().nullable(),
    emergencyContactConfirmed: z.boolean().default(true),
    notes: z.string().trim().max(1000, 'Notes cannot exceed 1000 characters').optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.expectedCheckoutDate && data.checkInDate) {
        return new Date(data.expectedCheckoutDate) >= new Date(data.checkInDate);
      }
      return true;
    },
    {
      message: 'Expected checkout date must be on or after check-in date',
      path: ['expectedCheckoutDate'],
    }
  );

export const CreateRentalCheckInSchema = z
  .object({
    tenantId: z.string().uuid('Invalid tenant ID format'),
    leaseId: z.string().uuid('Invalid lease ID format'),
    checkInDate: z.coerce.date({ required_error: 'Check-in date is required' }),
    expectedCheckoutDate: z.coerce.date().optional().nullable(),
    emergencyContactConfirmed: z.boolean().default(true),
    notes: z.string().trim().max(1000, 'Notes cannot exceed 1000 characters').optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.expectedCheckoutDate && data.checkInDate) {
        return new Date(data.expectedCheckoutDate) >= new Date(data.checkInDate);
      }
      return true;
    },
    {
      message: 'Expected checkout date must be on or after check-in date',
      path: ['expectedCheckoutDate'],
    }
  );

export const CancelCheckInSchema = z.object({
  reason: z.string().trim().max(500, 'Cancellation reason cannot exceed 500 characters').optional().nullable(),
});

export const CheckInFilterSchema = z.object({
  status: z.nativeEnum(CheckInStatus).optional(),
  propertyId: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
});
