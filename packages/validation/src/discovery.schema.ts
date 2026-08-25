import { z } from 'zod';
import { PropertyType, RoomSharingType, DiscoverySortBy } from '@propertyos/types';
import { indianPinCodeRegex } from './property.schema.js';

// ==============================================================================
// PropertyOS Discovery Query Validation Schemas (CORE-024)
// ==============================================================================

const transformCommaSeparated = (val: unknown): string[] | undefined => {
  if (Array.isArray(val)) return val.map((s) => String(s).trim()).filter(Boolean);
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return undefined;
    return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return undefined;
};

export const PropertyDiscoveryQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1, 'Page must be at least 1').default(1),
    limit: z.coerce.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(12),
    search: z.string().trim().max(100, 'Search query cannot exceed 100 characters').optional(),
    city: z.string().trim().max(100, 'City cannot exceed 100 characters').optional(),
    locality: z.string().trim().max(100, 'Locality cannot exceed 100 characters').optional(),
    state: z.string().trim().max(100, 'State cannot exceed 100 characters').optional(),
    postalCode: z.string().trim().regex(indianPinCodeRegex, 'Postal code must be a valid 6-digit Indian PIN code').optional(),
    propertyType: z.nativeEnum(PropertyType, {
      errorMap: () => ({ message: 'Operating model must be PG or RENTAL_HOUSE' }),
    }).optional(),
    minRent: z.coerce.number().min(0, 'minRent cannot be negative').optional(),
    maxRent: z.coerce.number().min(0, 'maxRent cannot be negative').optional(),
    sharingTypes: z
      .preprocess(transformCommaSeparated, z.array(z.nativeEnum(RoomSharingType)).optional())
      .optional(),
    unitTypes: z
      .preprocess(transformCommaSeparated, z.array(z.string().trim().min(1).max(50)).optional())
      .optional(),
    furnishingStatus: z.string().trim().max(50).optional(),
    amenities: z
      .preprocess(transformCommaSeparated, z.array(z.string().trim().min(1).max(100)).optional())
      .optional(),
    latitude: z.coerce.number().min(-90, 'Latitude must be between -90 and 90').max(90, 'Latitude must be between -90 and 90').optional(),
    longitude: z.coerce.number().min(-180, 'Longitude must be between -180 and 180').max(180, 'Longitude must be between -180 and 180').optional(),
    radiusKm: z.coerce.number().min(0.5, 'Radius must be at least 0.5 km').max(100, 'Radius cannot exceed 100 km').default(10).optional(),
    availableOnly: z
      .preprocess((val) => {
        if (typeof val === 'string') {
          if (val.toLowerCase() === 'true' || val === '1') return true;
          if (val.toLowerCase() === 'false' || val === '0') return false;
        }
        return val;
      }, z.boolean().optional())
      .optional(),
    sortBy: z.nativeEnum(DiscoverySortBy).default(DiscoverySortBy.NEWEST).optional(),
    organizationId: z.string().trim().uuid('Invalid organization ID').optional(),
  })
  .refine(
    (data) => {
      if (data.minRent !== undefined && data.maxRent !== undefined) {
        return data.minRent <= data.maxRent;
      }
      return true;
    },
    {
      message: 'minRent must be less than or equal to maxRent',
      path: ['minRent'],
    }
  )
  .refine(
    (data) => {
      if (data.sortBy === DiscoverySortBy.DISTANCE_ASC) {
        return data.latitude !== undefined && data.longitude !== undefined;
      }
      return true;
    },
    {
      message: 'Distance sorting requires both latitude and longitude parameters',
      path: ['sortBy'],
    }
  );

export type PropertyDiscoveryQueryInput = z.infer<typeof PropertyDiscoveryQuerySchema>;
