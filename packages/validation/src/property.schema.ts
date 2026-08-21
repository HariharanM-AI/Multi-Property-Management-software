import { z } from 'zod';
import { PropertyType, PropertyStatus, RoomSharingType, BedStatus, RentalUnitStatus } from '@propertyos/types';
import { indianPhoneRegex } from './auth.schema.js';

// Indian PIN code regex: 6 digits, first digit 1-9
export const indianPinCodeRegex = /^[1-9][0-9]{5}$/;

export const CreatePropertySchema = z.object({
  name: z.string().trim().min(2, 'Property name must be at least 2 characters').max(150, 'Property name cannot exceed 150 characters'),
  propertyType: z.nativeEnum(PropertyType, {
    errorMap: () => ({ message: 'Operating model must be either PG or RENTAL_HOUSE' }),
  }),
  description: z.string().trim().max(1000, 'Description cannot exceed 1000 characters').optional().nullable(),
  address: z.string().trim().min(3, 'Address is required').max(255),
  addressLine1: z.string().trim().max(255).optional().nullable(),
  addressLine2: z.string().trim().max(255).optional().nullable(),
  locality: z.string().trim().max(100).optional().nullable(),
  city: z.string().trim().min(2, 'City is required').max(100),
  district: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().min(2, 'State is required').max(100),
  country: z.string().trim().max(100).default('India'),
  postalCode: z.string().trim().regex(indianPinCodeRegex, 'Must be a valid 6-digit Indian PIN code (e.g. 560102)'),
  latitude: z.number().min(-90, 'Latitude must be between -90 and 90').max(90, 'Latitude must be between -90 and 90').optional().nullable(),
  longitude: z.number().min(-180, 'Longitude must be between -180 and 180').max(180, 'Longitude must be between -180 and 180').optional().nullable(),
  contactPhone: z.string().trim().regex(indianPhoneRegex, 'Must be a valid 10-digit Indian mobile number').optional().nullable(),
  contactEmail: z.string().trim().email('Invalid email address format').optional().nullable(),
  amenityIds: z.array(z.string().trim()).optional().default([]),
});

// Notice: propertyType is STRICTLY OMITTED in UpdatePropertySchema to enforce immutability of operating model
export const UpdatePropertySchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  status: z.nativeEnum(PropertyStatus).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  address: z.string().trim().min(3).max(255).optional(),
  addressLine1: z.string().trim().max(255).optional().nullable(),
  addressLine2: z.string().trim().max(255).optional().nullable(),
  locality: z.string().trim().max(100).optional().nullable(),
  city: z.string().trim().min(2).max(100).optional(),
  district: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().min(2).max(100).optional(),
  country: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().regex(indianPinCodeRegex, 'Must be a valid 6-digit Indian PIN code').optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  contactPhone: z.string().trim().regex(indianPhoneRegex, 'Must be a valid 10-digit Indian mobile number').optional().nullable(),
  contactEmail: z.string().trim().email().optional().nullable(),
  amenityIds: z.array(z.string().trim()).optional(),
});

export const PropertyFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  propertyType: z.nativeEnum(PropertyType).optional(),
  status: z.nativeEnum(PropertyStatus).optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  search: z.string().trim().optional(),
});

export const PropertyMediaCategorySchema = z.enum(['IMAGE', 'DOCUMENT', 'FLOOR_PLAN']).default('IMAGE');

// PG Structure Schemas (Foundation for future milestones)
export const CreateFloorSchema = z.object({
  propertyId: z.string().uuid(),
  floorNumber: z.number().int().min(-2).max(100),
  name: z.string().trim().min(1).max(50),
});

export const CreateRoomSchema = z.object({
  propertyId: z.string().uuid(),
  floorId: z.string().uuid(),
  roomNumber: z.string().trim().min(1).max(20),
  sharingType: z.nativeEnum(RoomSharingType),
  capacity: z.number().int().min(1).max(20),
  baseRent: z.number().positive('Rent must be a positive number'),
  amenities: z.array(z.string()).optional().default([]),
});

export const CreateBedSchema = z.object({
  roomId: z.string().uuid(),
  bedNumber: z.string().trim().min(1).max(20),
  monthlyRent: z.number().positive('Rent must be a positive number'),
  status: z.nativeEnum(BedStatus).optional().default(BedStatus.AVAILABLE),
});

// Rental Unit Schemas (Foundation for future milestones)
export const CreateRentalUnitSchema = z.object({
  propertyId: z.string().uuid(),
  unitNumber: z.string().trim().min(1).max(30),
  unitType: z.string().trim().min(1).max(50),
  floorNumber: z.number().int().optional().nullable(),
  superBuiltupAreaSqFt: z.number().positive().optional().nullable(),
  carpetAreaSqFt: z.number().positive().optional().nullable(),
  furnishingStatus: z.enum(['UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED']).default('SEMI_FURNISHED'),
  monthlyRent: z.number().positive('Rent must be positive'),
  securityDeposit: z.number().nonnegative('Deposit must be 0 or positive'),
  maintenanceCharges: z.number().nonnegative().optional().default(0),
  status: z.nativeEnum(RentalUnitStatus).optional().default(RentalUnitStatus.AVAILABLE),
});

export type CreatePropertyInput = z.infer<typeof CreatePropertySchema>;
export type UpdatePropertyInput = z.infer<typeof UpdatePropertySchema>;
export type PropertyFilterInput = z.infer<typeof PropertyFilterSchema>;
export type CreateFloorInput = z.infer<typeof CreateFloorSchema>;
export type CreateRoomInput = z.infer<typeof CreateRoomSchema>;
export type CreateBedInput = z.infer<typeof CreateBedSchema>;
export type CreateRentalUnitInput = z.infer<typeof CreateRentalUnitSchema>;
