import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '@prisma/client';
import {
  StaffMemberDto,
  StaffAttendanceDto,
  StaffSummaryDto,
  StaffAttendanceStatus,
  StaffFilterQuery,
  AttendanceFilterQuery,
} from '@propertyos/types';
import {
  CreateStaffInput,
  UpdateStaffInput,
  StaffCheckInInput,
  StaffCheckOutInput,
  RecordAttendanceInput,
} from '@propertyos/validation';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  private async writeAuditLog(
    tx: Prisma.TransactionClient,
    organizationId: string,
    userId: string | null | undefined,
    action: string,
    resourceType: string,
    resourceId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        organizationId,
        userId: userId || null,
        action,
        resourceType,
        resourceId,
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
  }

  /**
   * Register a new staff member with concurrency protection
   */
  async createStaff(
    organizationId: string,
    input: CreateStaffInput,
    actorId?: string
  ): Promise<StaffMemberDto> {
    const normalizedPhone = input.phone.trim();
    const salary = new Prisma.Decimal(input.salaryMonthly);

    if (salary.isNegative()) {
      throw new BadRequestException('Salary must be non-negative');
    }

    const joinedDate = new Date(input.joinedDate);
    if (isNaN(joinedDate.getTime())) {
      throw new BadRequestException('Invalid joinedDate format');
    }

    return this.prisma.$transaction(async (tx) => {
      // Advisory lock scoped to organization + normalized phone to prevent race condition
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext('staff_create_' || ${organizationId} || '_' || ${normalizedPhone}))
      `;

      // Check property scoping if propertyId provided
      if (input.propertyId) {
        const property = await tx.property.findFirst({
          where: { id: input.propertyId, organizationId },
        });
        if (!property) {
          throw new NotFoundException('Property not found in this organization');
        }
      }

      // Check user scoping if userId provided
      if (input.userId) {
        const user = await tx.user.findFirst({
          where: { id: input.userId, organizationId },
        });
        if (!user) {
          throw new NotFoundException('User not found in this organization');
        }

        const existingStaffUser = await tx.staffMember.findUnique({
          where: { userId: input.userId },
        });
        if (existingStaffUser) {
          throw new ConflictException('User account is already linked to another staff member');
        }
      }

      // Check duplicate phone in organization among active staff
      const existingPhone = await tx.staffMember.findFirst({
        where: {
          organizationId,
          phone: normalizedPhone,
          isActive: true,
        },
      });

      if (existingPhone) {
        throw new ConflictException('An active staff member with this phone number already exists');
      }

      const staff = await tx.staffMember.create({
        data: {
          organizationId,
          propertyId: input.propertyId || null,
          userId: input.userId || null,
          name: input.name.trim(),
          roleTitle: input.roleTitle.trim(),
          phone: normalizedPhone,
          salaryMonthly: salary,
          joinedDate,
          isActive: input.isActive !== undefined ? input.isActive : true,
        },
        include: {
          property: { select: { id: true, name: true } },
          user: { select: { id: true, email: true } },
        },
      });

      await this.writeAuditLog(
        tx,
        organizationId,
        actorId,
        'STAFF_CREATED',
        'StaffMember',
        staff.id,
        {
          name: staff.name,
          roleTitle: staff.roleTitle,
          propertyId: staff.propertyId,
          salaryMonthly: staff.salaryMonthly.toString(),
        }
      );

      return this.mapToStaffDto(staff);
    });
  }

  /**
   * Query staff members in an organization
   */
  async getStaff(
    organizationId: string,
    filter: StaffFilterQuery
  ): Promise<{ data: StaffMemberDto[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filter.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.StaffMemberWhereInput = {
      organizationId,
    };

    if (filter.propertyId) {
      where.propertyId = filter.propertyId;
    }

    if (filter.isActive !== undefined) {
      where.isActive =
        filter.isActive === true ||
        filter.isActive === 'true' ||
        filter.isActive === '1';
    }

    if (filter.search) {
      const q = filter.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { roleTitle: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [staffList, total] = await Promise.all([
      this.prisma.staffMember.findMany({
        where,
        include: {
          property: { select: { id: true, name: true } },
          user: { select: { id: true, email: true } },
          _count: { select: { attendance: true } },
        },
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.staffMember.count({ where }),
    ]);

    return {
      data: staffList.map((s) => ({
        ...this.mapToStaffDto(s),
        attendanceCount: s._count?.attendance || 0,
      })),
      total,
      page,
      limit,
    };
  }

  /**
   * Get single staff member details
   */
  async getStaffById(organizationId: string, id: string): Promise<StaffMemberDto> {
    const staff = await this.prisma.staffMember.findFirst({
      where: { id, organizationId },
      include: {
        property: { select: { id: true, name: true } },
        user: { select: { id: true, email: true } },
        attendance: {
          orderBy: { date: 'desc' },
          take: 30,
        },
      },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    return this.mapToStaffDto(staff);
  }

  /**
   * Update staff member details
   */
  async updateStaff(
    organizationId: string,
    id: string,
    input: UpdateStaffInput,
    actorId?: string
  ): Promise<StaffMemberDto> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.staffMember.findFirst({
        where: { id, organizationId },
      });

      if (!existing) {
        throw new NotFoundException('Staff member not found');
      }

      const updateData: Prisma.StaffMemberUpdateInput = {};

      if (input.name !== undefined) updateData.name = input.name.trim();
      if (input.roleTitle !== undefined) updateData.roleTitle = input.roleTitle.trim();
      if (input.isActive !== undefined) updateData.isActive = input.isActive;

      if (input.salaryMonthly !== undefined) {
        const salary = new Prisma.Decimal(input.salaryMonthly);
        if (salary.isNegative()) {
          throw new BadRequestException('Salary must be non-negative');
        }
        updateData.salaryMonthly = salary;
      }

      if (input.joinedDate !== undefined) {
        const jd = new Date(input.joinedDate);
        if (isNaN(jd.getTime())) {
          throw new BadRequestException('Invalid joinedDate format');
        }
        updateData.joinedDate = jd;
      }

      if (input.phone !== undefined) {
        const normalizedPhone = input.phone.trim();
        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtext('staff_create_' || ${organizationId} || '_' || ${normalizedPhone}))
        `;

        const duplicatePhone = await tx.staffMember.findFirst({
          where: {
            organizationId,
            phone: normalizedPhone,
            isActive: true,
            id: { not: id },
          },
        });

        if (duplicatePhone) {
          throw new ConflictException('Another active staff member with this phone number already exists');
        }
        updateData.phone = normalizedPhone;
      }

      if (input.propertyId !== undefined) {
        if (input.propertyId === null || input.propertyId === '') {
          updateData.property = { disconnect: true };
        } else {
          const prop = await tx.property.findFirst({
            where: { id: input.propertyId, organizationId },
          });
          if (!prop) {
            throw new NotFoundException('Property not found in this organization');
          }
          updateData.property = { connect: { id: input.propertyId } };
        }
      }

      if (input.userId !== undefined) {
        if (input.userId === null || input.userId === '') {
          updateData.user = { disconnect: true };
        } else {
          const user = await tx.user.findFirst({
            where: { id: input.userId, organizationId },
          });
          if (!user) {
            throw new NotFoundException('User not found in this organization');
          }

          const existingLink = await tx.staffMember.findFirst({
            where: { userId: input.userId, id: { not: id } },
          });
          if (existingLink) {
            throw new ConflictException('User account is already linked to another staff member');
          }
          updateData.user = { connect: { id: input.userId } };
        }
      }

      const updated = await tx.staffMember.update({
        where: { id },
        data: updateData,
        include: {
          property: { select: { id: true, name: true } },
          user: { select: { id: true, email: true } },
        },
      });

      await this.writeAuditLog(
        tx,
        organizationId,
        actorId,
        'STAFF_UPDATED',
        'StaffMember',
        updated.id,
        {
          changes: input,
        }
      );

      return this.mapToStaffDto(updated);
    });
  }

  /**
   * Safe Deactivation of a staff member (preserves attendance history)
   */
  async deactivateStaff(
    organizationId: string,
    id: string,
    actorId?: string
  ): Promise<{ success: boolean; message: string }> {
    return this.prisma.$transaction(async (tx) => {
      const staff = await tx.staffMember.findFirst({
        where: { id, organizationId },
      });

      if (!staff) {
        throw new NotFoundException('Staff member not found');
      }

      await tx.staffMember.update({
        where: { id },
        data: { isActive: false },
      });

      await this.writeAuditLog(
        tx,
        organizationId,
        actorId,
        'STAFF_DELETED',
        'StaffMember',
        id,
        {
          previousState: 'ACTIVE',
          newState: 'INACTIVE',
          name: staff.name,
        }
      );

      return {
        success: true,
        message: 'Staff member deactivated successfully',
      };
    });
  }

  /**
   * Log Staff Daily Check-In with Advisory Locking
   */
  async checkInStaff(
    organizationId: string,
    input: StaffCheckInInput,
    actorId?: string
  ): Promise<StaffAttendanceDto> {
    const dateObj = new Date(input.date);
    if (isNaN(dateObj.getTime())) {
      throw new BadRequestException('Invalid date format');
    }
    dateObj.setUTCHours(0, 0, 0, 0);
    const dateKey = dateObj.toISOString().split('T')[0];

    return this.prisma.$transaction(async (tx) => {
      // Transaction advisory lock on staff member + date
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext('staff_att_' || ${input.staffMemberId} || '_' || ${dateKey}))
      `;

      const staff = await tx.staffMember.findFirst({
        where: { id: input.staffMemberId, organizationId },
        include: { property: { select: { id: true, name: true } } },
      });

      if (!staff) {
        throw new NotFoundException('Staff member not found in this organization');
      }

      if (!staff.isActive) {
        throw new BadRequestException('Cannot record attendance for inactive staff member');
      }

      // Check existing attendance record for this calendar date
      const existing = await tx.staffAttendance.findUnique({
        where: {
          staffMemberId_date: {
            staffMemberId: input.staffMemberId,
            date: dateObj,
          },
        },
      });

      if (existing) {
        throw new ConflictException('Attendance already recorded for this staff member on this date');
      }

      const checkInTime = input.checkInTime ? new Date(input.checkInTime) : new Date();
      const status = input.status || StaffAttendanceStatus.PRESENT;

      const attendance = await tx.staffAttendance.create({
        data: {
          staffMemberId: input.staffMemberId,
          date: dateObj,
          checkInTime,
          status,
        },
      });

      await this.writeAuditLog(
        tx,
        organizationId,
        actorId,
        'STAFF_CHECKED_IN',
        'StaffAttendance',
        attendance.id,
        {
          staffMemberId: staff.id,
          staffName: staff.name,
          date: dateKey,
          status,
        }
      );

      return {
        id: attendance.id,
        staffMemberId: staff.id,
        staffName: staff.name,
        roleTitle: staff.roleTitle,
        propertyName: staff.property?.name || null,
        date: attendance.date.toISOString(),
        checkInTime: attendance.checkInTime.toISOString(),
        checkOutTime: attendance.checkOutTime ? attendance.checkOutTime.toISOString() : null,
        status: attendance.status as StaffAttendanceStatus,
        createdAt: attendance.createdAt.toISOString(),
      };
    });
  }

  /**
   * Log Staff Daily Check-Out with Advisory Locking
   */
  async checkOutStaff(
    organizationId: string,
    input: StaffCheckOutInput,
    actorId?: string
  ): Promise<StaffAttendanceDto> {
    const dateObj = new Date(input.date);
    if (isNaN(dateObj.getTime())) {
      throw new BadRequestException('Invalid date format');
    }
    dateObj.setUTCHours(0, 0, 0, 0);
    const dateKey = dateObj.toISOString().split('T')[0];

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext('staff_att_' || ${input.staffMemberId} || '_' || ${dateKey}))
      `;

      const staff = await tx.staffMember.findFirst({
        where: { id: input.staffMemberId, organizationId },
        include: { property: { select: { id: true, name: true } } },
      });

      if (!staff) {
        throw new NotFoundException('Staff member not found in this organization');
      }

      const existing = await tx.staffAttendance.findUnique({
        where: {
          staffMemberId_date: {
            staffMemberId: input.staffMemberId,
            date: dateObj,
          },
        },
      });

      if (!existing) {
        throw new NotFoundException('No check-in record found for this staff member on this date');
      }

      const checkOutTime = input.checkOutTime ? new Date(input.checkOutTime) : new Date();

      const updated = await tx.staffAttendance.update({
        where: { id: existing.id },
        data: {
          checkOutTime,
        },
      });

      await this.writeAuditLog(
        tx,
        organizationId,
        actorId,
        'STAFF_CHECKED_OUT',
        'StaffAttendance',
        updated.id,
        {
          staffMemberId: staff.id,
          staffName: staff.name,
          date: dateKey,
          checkOutTime: checkOutTime.toISOString(),
        }
      );

      return {
        id: updated.id,
        staffMemberId: staff.id,
        staffName: staff.name,
        roleTitle: staff.roleTitle,
        propertyName: staff.property?.name || null,
        date: updated.date.toISOString(),
        checkInTime: updated.checkInTime.toISOString(),
        checkOutTime: updated.checkOutTime ? updated.checkOutTime.toISOString() : null,
        status: updated.status as StaffAttendanceStatus,
        createdAt: updated.createdAt.toISOString(),
      };
    });
  }

  /**
   * Manual / Upsert Daily Attendance Record
   */
  async recordAttendance(
    organizationId: string,
    input: RecordAttendanceInput,
    actorId?: string
  ): Promise<StaffAttendanceDto> {
    const dateObj = new Date(input.date);
    if (isNaN(dateObj.getTime())) {
      throw new BadRequestException('Invalid date format');
    }
    dateObj.setUTCHours(0, 0, 0, 0);
    const dateKey = dateObj.toISOString().split('T')[0];

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext('staff_att_' || ${input.staffMemberId} || '_' || ${dateKey}))
      `;

      const staff = await tx.staffMember.findFirst({
        where: { id: input.staffMemberId, organizationId },
        include: { property: { select: { id: true, name: true } } },
      });

      if (!staff) {
        throw new NotFoundException('Staff member not found in this organization');
      }

      const checkInTime = input.checkInTime ? new Date(input.checkInTime) : new Date();
      const checkOutTime = input.checkOutTime ? new Date(input.checkOutTime) : null;

      const record = await tx.staffAttendance.upsert({
        where: {
          staffMemberId_date: {
            staffMemberId: input.staffMemberId,
            date: dateObj,
          },
        },
        create: {
          staffMemberId: input.staffMemberId,
          date: dateObj,
          status: input.status,
          checkInTime,
          checkOutTime,
        },
        update: {
          status: input.status,
          checkInTime,
          checkOutTime,
        },
      });

      await this.writeAuditLog(
        tx,
        organizationId,
        actorId,
        'STAFF_ATTENDANCE_RECORDED',
        'StaffAttendance',
        record.id,
        {
          staffMemberId: staff.id,
          staffName: staff.name,
          date: dateKey,
          status: input.status,
        }
      );

      return {
        id: record.id,
        staffMemberId: staff.id,
        staffName: staff.name,
        roleTitle: staff.roleTitle,
        propertyName: staff.property?.name || null,
        date: record.date.toISOString(),
        checkInTime: record.checkInTime.toISOString(),
        checkOutTime: record.checkOutTime ? record.checkOutTime.toISOString() : null,
        status: record.status as StaffAttendanceStatus,
        createdAt: record.createdAt.toISOString(),
      };
    });
  }

  /**
   * Query Attendance Records across organization
   */
  async getAttendanceRecords(
    organizationId: string,
    filter: AttendanceFilterQuery
  ): Promise<{ data: StaffAttendanceDto[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filter.limit) || 30));
    const skip = (page - 1) * limit;

    const where: Prisma.StaffAttendanceWhereInput = {
      staffMember: {
        organizationId,
        ...(filter.propertyId ? { propertyId: filter.propertyId } : {}),
      },
    };

    if (filter.staffMemberId) {
      where.staffMemberId = filter.staffMemberId;
    }

    if (filter.status) {
      where.status = filter.status;
    }

    if (filter.date) {
      const d = new Date(filter.date);
      if (!isNaN(d.getTime())) {
        d.setUTCHours(0, 0, 0, 0);
        where.date = d;
      }
    } else if (filter.startDate || filter.endDate) {
      where.date = {};
      if (filter.startDate) {
        const sd = new Date(filter.startDate);
        if (!isNaN(sd.getTime())) {
          sd.setUTCHours(0, 0, 0, 0);
          where.date.gte = sd;
        }
      }
      if (filter.endDate) {
        const ed = new Date(filter.endDate);
        if (!isNaN(ed.getTime())) {
          ed.setUTCHours(23, 59, 59, 999);
          where.date.lte = ed;
        }
      }
    }

    const [records, total] = await Promise.all([
      this.prisma.staffAttendance.findMany({
        where,
        include: {
          staffMember: {
            select: {
              id: true,
              name: true,
              roleTitle: true,
              property: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.staffAttendance.count({ where }),
    ]);

    return {
      data: records.map((r) => ({
        id: r.id,
        staffMemberId: r.staffMemberId,
        staffName: r.staffMember.name,
        roleTitle: r.staffMember.roleTitle,
        propertyName: r.staffMember.property?.name || null,
        date: r.date.toISOString(),
        checkInTime: r.checkInTime.toISOString(),
        checkOutTime: r.checkOutTime ? r.checkOutTime.toISOString() : null,
        status: r.status as StaffAttendanceStatus,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
    };
  }

  /**
   * Aggregate Staff & Attendance KPIs (Total Staff, Present Today, Payroll)
   */
  async getStaffSummary(organizationId: string): Promise<StaffSummaryDto> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const [totalStaff, activeStaff, inactiveStaff, activeStaffMembers, todayAttendance] =
      await Promise.all([
        this.prisma.staffMember.count({ where: { organizationId } }),
        this.prisma.staffMember.count({ where: { organizationId, isActive: true } }),
        this.prisma.staffMember.count({ where: { organizationId, isActive: false } }),
        this.prisma.staffMember.findMany({
          where: { organizationId, isActive: true },
          select: { salaryMonthly: true },
        }),
        this.prisma.staffAttendance.findMany({
          where: {
            staffMember: { organizationId, isActive: true },
            date: today,
          },
          select: { status: true },
        }),
      ]);

    let presentToday = 0;
    let absentToday = 0;
    let onLeaveToday = 0;

    for (const record of todayAttendance) {
      if (record.status === StaffAttendanceStatus.PRESENT || record.status === StaffAttendanceStatus.HALF_DAY) {
        presentToday++;
      } else if (record.status === StaffAttendanceStatus.ABSENT) {
        absentToday++;
      } else if (record.status === StaffAttendanceStatus.LEAVE) {
        onLeaveToday++;
      }
    }

    // Authoritative Decimal payroll summation
    const totalPayroll = activeStaffMembers.reduce((acc, staff) => {
      return acc.plus(new Prisma.Decimal(staff.salaryMonthly));
    }, new Prisma.Decimal(0));

    return {
      totalStaff,
      activeStaff,
      inactiveStaff,
      presentToday,
      absentToday,
      onLeaveToday,
      totalMonthlyPayroll: totalPayroll.toFixed(2),
    };
  }

  /**
   * Helper mapping to StaffMemberDto
   */
  private mapToStaffDto(staff: any): StaffMemberDto {
    return {
      id: staff.id,
      organizationId: staff.organizationId,
      propertyId: staff.propertyId || null,
      propertyName: staff.property?.name || null,
      userId: staff.userId || null,
      userEmail: staff.user?.email || null,
      name: staff.name,
      roleTitle: staff.roleTitle,
      phone: staff.phone,
      salaryMonthly: staff.salaryMonthly instanceof Prisma.Decimal
        ? staff.salaryMonthly.toNumber()
        : Number(staff.salaryMonthly),
      joinedDate: staff.joinedDate instanceof Date
        ? staff.joinedDate.toISOString()
        : new Date(staff.joinedDate).toISOString(),
      isActive: staff.isActive,
      createdAt: staff.createdAt instanceof Date
        ? staff.createdAt.toISOString()
        : new Date(staff.createdAt).toISOString(),
      updatedAt: staff.updatedAt instanceof Date
        ? staff.updatedAt.toISOString()
        : new Date(staff.updatedAt).toISOString(),
    };
  }
}
