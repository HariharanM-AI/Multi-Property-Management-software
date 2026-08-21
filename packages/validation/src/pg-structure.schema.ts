import { z } from 'zod';
import { RoomSharingType, BedStatus } from '@propertyos/types';

export const CreateFloorSchema = z.object({
  floorNumber: z.number().int().min(-5).max(100),
  name: z.string().min(1, 'Floor name is required').max(100),
});

export const UpdateFloorSchema = z.object({
  floorNumber: z.number().int().min(-5).max(100).optional(),
  name: z.string().min(1).max(100).optional(),
});

export const CreateRoomSchema = z.object({
  floorId: z.string().uuid('Invalid Floor ID'),
  roomNumber: z.string().min(1, 'Room number is required').max(50),
  sharingType: z.nativeEnum(RoomSharingType),
  capacity: z.number().int().min(1).max(50).optional(),
  baseRent: z.number().min(0, 'Rent must be positive').max(10000000),
  amenities: z.array(z.string()).optional().default([]),
  autoGenerateBeds: z.boolean().optional().default(true),
});

export const UpdateRoomSchema = z.object({
  roomNumber: z.string().min(1).max(50).optional(),
  sharingType: z.nativeEnum(RoomSharingType).optional(),
  capacity: z.number().int().min(1).max(50).optional(),
  baseRent: z.number().min(0).max(10000000).optional(),
  amenities: z.array(z.string()).optional(),
});

export const CreateBedSchema = z.object({
  roomId: z.string().uuid('Invalid Room ID'),
  bedNumber: z.string().min(1, 'Bed number is required').max(50),
  monthlyRent: z.number().min(0, 'Rent must be positive').max(10000000),
  status: z.nativeEnum(BedStatus).optional().default(BedStatus.AVAILABLE),
});

export const UpdateBedSchema = z.object({
  bedNumber: z.string().min(1).max(50).optional(),
  monthlyRent: z.number().min(0).max(10000000).optional(),
  status: z.nativeEnum(BedStatus).optional(),
});

export const UpdateBedStatusSchema = z.object({
  status: z.nativeEnum(BedStatus),
});

export const BedFilterSchema = z.object({
  roomId: z.string().uuid().optional(),
  status: z.nativeEnum(BedStatus).optional(),
});

export type CreateFloorInput = z.infer<typeof CreateFloorSchema>;
export type UpdateFloorInput = z.infer<typeof UpdateFloorSchema>;
export type CreateRoomInput = z.infer<typeof CreateRoomSchema>;
export type UpdateRoomInput = z.infer<typeof UpdateRoomSchema>;
export type CreateBedInput = z.infer<typeof CreateBedSchema>;
export type UpdateBedInput = z.infer<typeof UpdateBedSchema>;
export type UpdateBedStatusInput = z.infer<typeof UpdateBedStatusSchema>;
