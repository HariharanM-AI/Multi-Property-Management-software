import { z } from 'zod';
import {
  MeterType,
  MeterStatus,
  ElectricityRateStatus,
  ElectricityAllocationType,
} from '@propertyos/types';

const DecimalStringOrNumber = z
  .union([
    z.string().regex(/^\d+(\.\d{1,2})?$/, 'Value must be a valid decimal with up to 2 decimal places'),
    z.number().nonnegative('Value must be non-negative'),
  ])
  .refine(
    (val) => {
      const num = typeof val === 'number' ? val : parseFloat(val);
      return !isNaN(num) && num >= 0;
    },
    { message: 'Value must be a non-negative decimal' }
  );

const PositiveDecimalStringOrNumber = z
  .union([
    z.string().regex(/^\d+(\.\d{1,2})?$/, 'Value must be a valid decimal with up to 2 decimal places'),
    z.number().positive('Value must be strictly greater than zero'),
  ])
  .refine(
    (val) => {
      const num = typeof val === 'number' ? val : parseFloat(val);
      return !isNaN(num) && num > 0;
    },
    { message: 'Value must be strictly greater than zero' }
  );

export const CreateElectricityMeterSchema = z.object({
  meterNumber: z.string().trim().min(1, 'Meter number is required').max(50),
  meterType: z.nativeEnum(MeterType).optional().default(MeterType.ROOM),
  roomId: z.string().uuid('Invalid Room ID').optional().nullable(),
  rentalUnitId: z.string().uuid('Invalid Rental Unit ID').optional().nullable(),
  initialReading: DecimalStringOrNumber.optional().default(0),
  installedAt: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
});

export const UpdateElectricityMeterSchema = z.object({
  meterNumber: z.string().trim().min(1).max(50).optional(),
  status: z.nativeEnum(MeterStatus).optional(),
  roomId: z.string().uuid('Invalid Room ID').optional().nullable(),
});

export const RecordElectricityReadingSchema = z.object({
  meterId: z.string().uuid('Invalid Meter ID'),
  readingDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  currentReading: DecimalStringOrNumber,
  isResetOverride: z.boolean().optional().default(false),
  resetReason: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
}).refine(
  (data) => {
    if (data.isResetOverride && (!data.resetReason || data.resetReason.trim().length === 0)) {
      return false;
    }
    return true;
  },
  {
    message: 'Reset reason is mandatory when performing a meter reset override',
    path: ['resetReason'],
  }
);

export const CreateElectricityRateSchema = z.object({
  ratePerUnit: PositiveDecimalStringOrNumber,
  effectiveFrom: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  effectiveTo: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional().nullable(),
});

export const GenerateElectricityChargesSchema = z.object({
  readingId: z.string().uuid('Invalid Reading ID'),
  autoInvoice: z.boolean().optional().default(false),
});
