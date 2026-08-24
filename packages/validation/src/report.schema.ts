import { z } from 'zod';

// ==============================================================================
// PropertyOS — Reports & Financial Analytics Validation Schemas (CORE-021)
// ==============================================================================

export const reportFilterSchema = z
  .object({
    propertyId: z.string().uuid({ message: 'propertyId must be a valid UUID' }).optional(),
    startDate: z.string().datetime({ message: 'startDate must be a valid ISO 8601 datetime' }).optional(),
    endDate: z.string().datetime({ message: 'endDate must be a valid ISO 8601 datetime' }).optional(),
    period: z.enum(['monthly', 'quarterly', 'yearly', 'custom']).optional().default('monthly'),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
      }
      return true;
    },
    {
      message: 'startDate must be before or equal to endDate',
      path: ['endDate'],
    }
  );

export const reportExportSchema = z
  .object({
    propertyId: z.string().uuid({ message: 'propertyId must be a valid UUID' }).optional(),
    startDate: z.string().datetime({ message: 'startDate must be a valid ISO 8601 datetime' }).optional(),
    endDate: z.string().datetime({ message: 'endDate must be a valid ISO 8601 datetime' }).optional(),
    period: z.enum(['monthly', 'quarterly', 'yearly', 'custom']).optional().default('monthly'),
    type: z.enum(['pnl', 'occupancy', 'property-comparison', 'cash-flow']).optional().default('pnl'),
    format: z.enum(['csv']).optional().default('csv'),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
      }
      return true;
    },
    {
      message: 'startDate must be before or equal to endDate',
      path: ['endDate'],
    }
  );

export type ReportFilterInput = z.infer<typeof reportFilterSchema>;
export type ReportExportInput = z.infer<typeof reportExportSchema>;
