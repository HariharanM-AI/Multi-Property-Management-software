import { z } from 'zod';

// ==============================================================================
// CORE-022: Dashboard Filter Validation Schemas
// ==============================================================================

export const dashboardFilterSchema = z.object({
  propertyType: z.enum(['ALL', 'PG', 'RENTAL_HOUSE']).optional(),
  city: z.string().trim().min(1).optional(),
  status: z.enum(['ALL', 'ACTIVE', 'INACTIVE']).optional(),
});

export type DashboardFilterSchemaInput = z.infer<typeof dashboardFilterSchema>;
