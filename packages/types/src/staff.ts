// ==============================================================================
// PropertyOS Staff & Attendance Management Types (CORE-017)
// ==============================================================================

export enum StaffAttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  HALF_DAY = 'HALF_DAY',
  LEAVE = 'LEAVE',
}

export interface StaffMemberDto {
  id: string;
  organizationId: string;
  propertyId?: string | null;
  propertyName?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  name: string;
  roleTitle: string;
  phone: string;
  salaryMonthly: string | number;
  joinedDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  attendanceCount?: number;
}

export interface CreateStaffDto {
  name: string;
  roleTitle: string;
  phone: string;
  salaryMonthly: number | string;
  joinedDate: string;
  propertyId?: string | null;
  userId?: string | null;
  isActive?: boolean;
}

export interface UpdateStaffDto {
  name?: string;
  roleTitle?: string;
  phone?: string;
  salaryMonthly?: number | string;
  joinedDate?: string;
  propertyId?: string | null;
  userId?: string | null;
  isActive?: boolean;
}

export interface StaffAttendanceDto {
  id: string;
  staffMemberId: string;
  staffName?: string;
  roleTitle?: string;
  propertyName?: string | null;
  date: string;
  checkInTime: string;
  checkOutTime?: string | null;
  status: StaffAttendanceStatus | string;
  createdAt: string;
}

export interface StaffCheckInDto {
  staffMemberId: string;
  date: string;
  checkInTime?: string;
  status?: StaffAttendanceStatus;
}

export interface StaffCheckOutDto {
  staffMemberId: string;
  date: string;
  checkOutTime?: string;
}

export interface RecordAttendanceDto {
  staffMemberId: string;
  date: string;
  status: StaffAttendanceStatus;
  checkInTime?: string;
  checkOutTime?: string;
}

export interface StaffSummaryDto {
  totalStaff: number;
  activeStaff: number;
  inactiveStaff: number;
  presentToday: number;
  absentToday: number;
  onLeaveToday: number;
  totalMonthlyPayroll: string;
}

export interface StaffFilterQuery {
  propertyId?: string;
  isActive?: boolean | string;
  search?: string;
  page?: number | string;
  limit?: number | string;
}

export interface AttendanceFilterQuery {
  propertyId?: string;
  staffMemberId?: string;
  startDate?: string;
  endDate?: string;
  date?: string;
  status?: StaffAttendanceStatus;
  page?: number | string;
  limit?: number | string;
}
