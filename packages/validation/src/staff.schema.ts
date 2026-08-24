import { z } from 'zod';
import { StaffAttendanceStatus } from '@propertyos/types';

export const CreateStaffSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  roleTitle: z.string().trim().min(2, 'Role title must be at least 2 characters').max(100),
  phone: z.string().trim().min(7, 'Phone number must be at least 7 digits').max(15, 'Phone number too long'),
  salaryMonthly: z.union([z.number(), z.string()]).refine(
    (val) => {
      const num = typeof val === 'string' ? parseFloat(val) : val;
      return !isNaN(num) && num >= 0;
    },
    { message: 'Salary must be a non-negative number' }
  ),
  joinedDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid joinedDate format',
  }),
  propertyId: z.string().uuid('Invalid property ID format').nullable().optional(),
  userId: z.string().uuid('Invalid user ID format').nullable().optional(),
  isActive: z.boolean().optional(),
});

export const UpdateStaffSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100).optional(),
  roleTitle: z.string().trim().min(2, 'Role title must be at least 2 characters').max(100).optional(),
  phone: z.string().trim().min(7, 'Phone number must be at least 7 digits').max(15, 'Phone number too long').optional(),
  salaryMonthly: z
    .union([z.number(), z.string()])
    .refine(
      (val) => {
        const num = typeof val === 'string' ? parseFloat(val) : val;
        return !isNaN(num) && num >= 0;
      },
      { message: 'Salary must be a non-negative number' }
    )
    .optional(),
  joinedDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid joinedDate format',
    })
    .optional(),
  propertyId: z.string().uuid('Invalid property ID format').nullable().optional(),
  userId: z.string().uuid('Invalid user ID format').nullable().optional(),
  isActive: z.boolean().optional(),
});

export const StaffCheckInSchema = z.object({
  staffMemberId: z.string().uuid('Invalid staff member ID'),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }),
  checkInTime: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid checkInTime format',
    })
    .optional(),
  status: z.nativeEnum(StaffAttendanceStatus).optional(),
});

export const StaffCheckOutSchema = z.object({
  staffMemberId: z.string().uuid('Invalid staff member ID'),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }),
  checkOutTime: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid checkOutTime format',
    })
    .optional(),
});

export const RecordAttendanceSchema = z.object({
  staffMemberId: z.string().uuid('Invalid staff member ID'),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }),
  status: z.nativeEnum(StaffAttendanceStatus),
  checkInTime: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid checkInTime format',
    })
    .optional(),
  checkOutTime: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid checkOutTime format',
    })
    .optional(),
});

export const StaffFilterQuerySchema = z.object({
  propertyId: z.string().uuid().optional(),
  isActive: z.union([z.boolean(), z.string()]).optional(),
  search: z.string().optional(),
  page: z.union([z.number(), z.string()]).optional(),
  limit: z.union([z.number(), z.string()]).optional(),
});

export const AttendanceFilterQuerySchema = z.object({
  propertyId: z.string().uuid().optional(),
  staffMemberId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  date: z.string().optional(),
  status: z.nativeEnum(StaffAttendanceStatus).optional(),
  page: z.union([z.number(), z.string()]).optional(),
  limit: z.union([z.number(), z.string()]).optional(),
});

export type CreateStaffInput = z.infer<typeof CreateStaffSchema>;
export type UpdateStaffInput = z.infer<typeof UpdateStaffSchema>;
export type StaffCheckInInput = z.infer<typeof StaffCheckInSchema>;
export type StaffCheckOutInput = z.infer<typeof StaffCheckOutSchema>;
export type RecordAttendanceInput = z.infer<typeof RecordAttendanceSchema>;
