import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import {
  VisitorRecordDto,
  VisitorStatus,
  VisitorSummaryDto,
  VisitorFilterQuery,
} from '@propertyos/types';
import {
  CreateVisitorInput,
  UpdateVisitorInput,
  CheckInVisitorInput,
  CheckOutVisitorInput,
} from '@propertyos/validation';

@Injectable()
export class VisitorsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to resolve tenant record for user (by phone or email)
   */
  async findTenantForUser(
    organizationId: string,
    phone?: string | null,
    email?: string | null
  ): Promise<{ id: string } | null> {
    const orConditions: Prisma.TenantWhereInput[] = [];
    if (phone) orConditions.push({ phone });
    if (email) orConditions.push({ email });
    if (orConditions.length === 0) return null;

    return this.prisma.tenant.findFirst({
      where: {
        organizationId,
        OR: orConditions,
        deletedAt: null,
      },
      select: { id: true },
    });
  }

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

  private computeStatus(visitor: {
    isApproved: boolean;
    entryTime: Date;
    exitTime: Date | null;
  }): VisitorStatus {
    if (!visitor.isApproved) {
      return 'REJECTED';
    }
    if (visitor.exitTime !== null) {
      return 'CHECKED_OUT';
    }
    return 'CHECKED_IN';
  }

  private mapToDto(visitor: any): VisitorRecordDto {
    const status = this.computeStatus(visitor);
    let roomOrUnitNumber: string | undefined = undefined;

    if (visitor.tenant?.checkIns && visitor.tenant.checkIns.length > 0) {
      const checkIn = visitor.tenant.checkIns[0];
      if (checkIn.rentalUnit?.unitNumber) {
        roomOrUnitNumber = checkIn.rentalUnit.unitNumber;
      } else if (checkIn.bed?.room?.roomNumber) {
        roomOrUnitNumber = `Room ${checkIn.bed.room.roomNumber}${checkIn.bed.bedNumber ? ` (Bed ${checkIn.bed.bedNumber})` : ''}`;
      }
    } else if (visitor.tenant?.leases && visitor.tenant.leases.length > 0) {
      const lease = visitor.tenant.leases[0];
      if (lease.rentalUnit?.unitNumber) {
        roomOrUnitNumber = lease.rentalUnit.unitNumber;
      }
    }

    return {
      id: visitor.id,
      propertyId: visitor.propertyId,
      propertyName: visitor.property?.name,
      tenantId: visitor.tenantId,
      tenantName: visitor.tenant
        ? `${visitor.tenant.firstName} ${visitor.tenant.lastName}`.trim()
        : undefined,
      tenantPhone: visitor.tenant?.phone,
      roomOrUnitNumber,
      visitorName: visitor.visitorName,
      visitorPhone: visitor.visitorPhone,
      purpose: visitor.purpose,
      gatePassCode: visitor.gatePassCode,
      entryTime: visitor.entryTime instanceof Date ? visitor.entryTime.toISOString() : visitor.entryTime,
      exitTime: visitor.exitTime instanceof Date ? visitor.exitTime.toISOString() : visitor.exitTime || null,
      isApproved: visitor.isApproved,
      status,
      createdAt: visitor.createdAt instanceof Date ? visitor.createdAt.toISOString() : visitor.createdAt,
    };
  }

  private generateGatePassCode(): string {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomHex = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `GP-${dateStr}-${randomHex}`;
  }

  /**
   * Register a new visitor & generate digital gatepass
   */
  async createVisitor(
    organizationId: string,
    input: CreateVisitorInput,
    actorId?: string,
    callerTenantId?: string
  ): Promise<VisitorRecordDto> {
    if (callerTenantId && input.tenantId !== callerTenantId) {
      throw new ForbiddenException('You can only pre-register visitors for your own stay');
    }

    const normalizedPhone = input.visitorPhone.trim();
    const entryTime = input.entryTime ? new Date(input.entryTime) : new Date();

    if (isNaN(entryTime.getTime())) {
      throw new BadRequestException('Invalid entryTime format');
    }

    return this.prisma.$transaction(async (tx) => {
      // Verify property belongs to organization
      const property = await tx.property.findFirst({
        where: { id: input.propertyId, organizationId },
      });
      if (!property) {
        throw new NotFoundException('Property not found in this organization');
      }

      // Verify host tenant belongs to organization
      const tenant = await tx.tenant.findFirst({
        where: { id: input.tenantId, organizationId },
        include: {
          leases: {
            where: { status: 'ACTIVE' },
            include: { rentalUnit: true },
          },
          checkIns: {
            where: { propertyId: input.propertyId, status: 'CHECKED_IN' },
            include: { rentalUnit: true, bed: { include: { room: true } } },
          },
        },
      });

      if (!tenant) {
        throw new NotFoundException('Host tenant not found in this organization');
      }

      // Generate unique gatepass code with retry
      let gatePassCode = this.generateGatePassCode();
      let attempts = 0;
      while (attempts < 5) {
        const existing = await tx.visitorRecord.findUnique({
          where: { gatePassCode },
        });
        if (!existing) break;
        gatePassCode = this.generateGatePassCode();
        attempts++;
      }

      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext('visitor_gp_' || ${gatePassCode}))
      `;

      const isApproved = input.isApproved !== undefined ? input.isApproved : true;

      const record = await tx.visitorRecord.create({
        data: {
          propertyId: input.propertyId,
          tenantId: input.tenantId,
          visitorName: input.visitorName.trim(),
          visitorPhone: normalizedPhone,
          purpose: input.purpose.trim(),
          gatePassCode,
          entryTime,
          isApproved,
        },
        include: {
          property: true,
          tenant: {
            include: {
              leases: {
                where: { status: 'ACTIVE' },
                include: { rentalUnit: true },
              },
              checkIns: {
                where: { propertyId: input.propertyId, status: 'CHECKED_IN' },
                include: { rentalUnit: true, bed: { include: { room: true } } },
              },
            },
          },
        },
      });

      await this.writeAuditLog(
        tx,
        organizationId,
        actorId,
        'VISITOR_REGISTERED',
        'VISITOR',
        record.id,
        {
          visitorName: record.visitorName,
          visitorPhone: record.visitorPhone,
          gatePassCode: record.gatePassCode,
          propertyId: record.propertyId,
          tenantId: record.tenantId,
          isApproved: record.isApproved,
        }
      );

      return this.mapToDto(record);
    });
  }

  /**
   * List visitors with filtering and pagination
   */
  async getVisitors(
    organizationId: string,
    query: VisitorFilterQuery,
    callerTenantId?: string
  ): Promise<{ data: VisitorRecordDto[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.VisitorRecordWhereInput = {
      property: { organizationId },
    };

    if (callerTenantId) {
      where.tenantId = callerTenantId;
    } else if (query.tenantId) {
      where.tenantId = query.tenantId;
    }

    if (query.propertyId) {
      where.propertyId = query.propertyId;
    }

    if (query.status) {
      if (query.status === 'CHECKED_IN') {
        where.isApproved = true;
        where.exitTime = null;
      } else if (query.status === 'CHECKED_OUT') {
        where.exitTime = { not: null };
      } else if (query.status === 'REJECTED') {
        where.isApproved = false;
      } else if (query.status === 'PENDING') {
        where.isApproved = false;
        where.exitTime = null;
      } else if (query.status === 'APPROVED') {
        where.isApproved = true;
        where.exitTime = null;
      }
    }

    if (query.search) {
      const s = query.search.trim();
      where.OR = [
        { visitorName: { contains: s, mode: 'insensitive' } },
        { visitorPhone: { contains: s } },
        { gatePassCode: { contains: s, mode: 'insensitive' } },
        { purpose: { contains: s, mode: 'insensitive' } },
      ];
    }

    if (query.startDate || query.endDate) {
      where.entryTime = {};
      if (query.startDate) {
        where.entryTime.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.entryTime.lte = new Date(query.endDate);
      }
    }

    const [total, records] = await Promise.all([
      this.prisma.visitorRecord.count({ where }),
      this.prisma.visitorRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { entryTime: 'desc' },
        include: {
          property: true,
          tenant: {
            include: {
              leases: {
                where: { status: 'ACTIVE' },
                include: { rentalUnit: true },
              },
              checkIns: {
                where: { status: 'CHECKED_IN' },
                include: { rentalUnit: true, bed: { include: { room: true } } },
              },
            },
          },
        },
      }),
    ]);

    return {
      data: records.map((r) => this.mapToDto(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Get single visitor record by ID
   */
  async getVisitorById(
    organizationId: string,
    id: string,
    callerTenantId?: string
  ): Promise<VisitorRecordDto> {
    const record = await this.prisma.visitorRecord.findFirst({
      where: {
        id,
        property: { organizationId },
      },
      include: {
        property: true,
        tenant: {
          include: {
            leases: {
              where: { status: 'ACTIVE' },
              include: { rentalUnit: true },
            },
            checkIns: {
              where: { status: 'CHECKED_IN' },
              include: { rentalUnit: true, bed: { include: { room: true } } },
            },
          },
        },
      },
    });

    if (!record) {
      throw new NotFoundException('Visitor record not found');
    }

    if (callerTenantId && record.tenantId !== callerTenantId) {
      throw new ForbiddenException('Access denied to this visitor record');
    }

    return this.mapToDto(record);
  }

  /**
   * Instant gatepass lookup by Gatepass Reference Code (Guard console)
   */
  async getVisitorByGatePass(
    organizationId: string,
    gatePassCode: string
  ): Promise<VisitorRecordDto> {
    const record = await this.prisma.visitorRecord.findFirst({
      where: {
        gatePassCode: gatePassCode.trim().toUpperCase(),
        property: { organizationId },
      },
      include: {
        property: true,
        tenant: {
          include: {
            leases: {
              where: { status: 'ACTIVE' },
              include: { rentalUnit: true },
            },
            checkIns: {
              where: { status: 'CHECKED_IN' },
              include: { rentalUnit: true, bed: { include: { room: true } } },
            },
          },
        },
      },
    });

    if (!record) {
      throw new NotFoundException('Gatepass not found in this organization');
    }

    return this.mapToDto(record);
  }

  /**
   * Security guard check-in (record physical entry)
   */
  async checkInVisitor(
    organizationId: string,
    id: string,
    input?: CheckInVisitorInput,
    actorId?: string
  ): Promise<VisitorRecordDto> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext('visitor_checkin_' || ${id}))
      `;

      const visitor = await tx.visitorRecord.findFirst({
        where: { id, property: { organizationId } },
        include: { property: true, tenant: true },
      });

      if (!visitor) {
        throw new NotFoundException('Visitor record not found');
      }

      if (!visitor.isApproved) {
        throw new ForbiddenException('Visitor is not approved for entry');
      }

      if (visitor.exitTime !== null) {
        throw new ConflictException('Visitor has already completed their visit and checked out');
      }

      const entryTime = input?.entryTime ? new Date(input.entryTime) : new Date();

      const updated = await tx.visitorRecord.update({
        where: { id },
        data: { entryTime },
        include: {
          property: true,
          tenant: {
            include: {
              leases: {
                where: { status: 'ACTIVE' },
                include: { rentalUnit: true },
              },
              checkIns: {
                where: { status: 'CHECKED_IN' },
                include: { rentalUnit: true, bed: { include: { room: true } } },
              },
            },
          },
        },
      });

      await this.writeAuditLog(
        tx,
        organizationId,
        actorId,
        'VISITOR_CHECKED_IN',
        'VISITOR',
        id,
        {
          visitorName: updated.visitorName,
          gatePassCode: updated.gatePassCode,
          entryTime: updated.entryTime,
          notes: input?.notes,
        }
      );

      return this.mapToDto(updated);
    });
  }

  /**
   * Security guard check-out (record physical exit)
   */
  async checkOutVisitor(
    organizationId: string,
    id: string,
    input?: CheckOutVisitorInput,
    actorId?: string
  ): Promise<VisitorRecordDto> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext('visitor_checkout_' || ${id}))
      `;

      const visitor = await tx.visitorRecord.findFirst({
        where: { id, property: { organizationId } },
        include: { property: true, tenant: true },
      });

      if (!visitor) {
        throw new NotFoundException('Visitor record not found');
      }

      if (visitor.exitTime !== null) {
        throw new ConflictException('Visitor has already been checked out');
      }

      const exitTime = input?.exitTime ? new Date(input.exitTime) : new Date();

      if (exitTime.getTime() < visitor.entryTime.getTime()) {
        throw new BadRequestException('Exit time cannot be earlier than entry time');
      }

      const updated = await tx.visitorRecord.update({
        where: { id },
        data: { exitTime },
        include: {
          property: true,
          tenant: {
            include: {
              leases: {
                where: { status: 'ACTIVE' },
                include: { rentalUnit: true },
              },
              checkIns: {
                where: { status: 'CHECKED_IN' },
                include: { rentalUnit: true, bed: { include: { room: true } } },
              },
            },
          },
        },
      });

      await this.writeAuditLog(
        tx,
        organizationId,
        actorId,
        'VISITOR_CHECKED_OUT',
        'VISITOR',
        id,
        {
          visitorName: updated.visitorName,
          gatePassCode: updated.gatePassCode,
          exitTime: updated.exitTime,
          notes: input?.notes,
        }
      );

      return this.mapToDto(updated);
    });
  }

  /**
   * Host tenant or manager approves visitor
   */
  async approveVisitor(
    organizationId: string,
    id: string,
    actorId?: string,
    callerTenantId?: string
  ): Promise<VisitorRecordDto> {
    return this.prisma.$transaction(async (tx) => {
      const visitor = await tx.visitorRecord.findFirst({
        where: { id, property: { organizationId } },
        include: { property: true, tenant: true },
      });

      if (!visitor) {
        throw new NotFoundException('Visitor record not found');
      }

      if (callerTenantId && visitor.tenantId !== callerTenantId) {
        throw new ForbiddenException('You can only approve visitors invited for your own stay');
      }

      if (visitor.exitTime !== null) {
        throw new ConflictException('Cannot modify approval for visitor who already checked out');
      }

      const updated = await tx.visitorRecord.update({
        where: { id },
        data: { isApproved: true },
        include: {
          property: true,
          tenant: {
            include: {
              leases: {
                where: { status: 'ACTIVE' },
                include: { rentalUnit: true },
              },
              checkIns: {
                where: { status: 'CHECKED_IN' },
                include: { rentalUnit: true, bed: { include: { room: true } } },
              },
            },
          },
        },
      });

      await this.writeAuditLog(
        tx,
        organizationId,
        actorId,
        'VISITOR_APPROVED',
        'VISITOR',
        id,
        {
          visitorName: updated.visitorName,
          gatePassCode: updated.gatePassCode,
        }
      );

      return this.mapToDto(updated);
    });
  }

  /**
   * Host tenant or manager rejects visitor
   */
  async rejectVisitor(
    organizationId: string,
    id: string,
    actorId?: string,
    callerTenantId?: string
  ): Promise<VisitorRecordDto> {
    return this.prisma.$transaction(async (tx) => {
      const visitor = await tx.visitorRecord.findFirst({
        where: { id, property: { organizationId } },
        include: { property: true, tenant: true },
      });

      if (!visitor) {
        throw new NotFoundException('Visitor record not found');
      }

      if (callerTenantId && visitor.tenantId !== callerTenantId) {
        throw new ForbiddenException('You can only reject visitors for your own stay');
      }

      if (visitor.exitTime !== null) {
        throw new ConflictException('Cannot reject visitor who already checked out');
      }

      const updated = await tx.visitorRecord.update({
        where: { id },
        data: { isApproved: false },
        include: {
          property: true,
          tenant: {
            include: {
              leases: {
                where: { status: 'ACTIVE' },
                include: { rentalUnit: true },
              },
              checkIns: {
                where: { status: 'CHECKED_IN' },
                include: { rentalUnit: true, bed: { include: { room: true } } },
              },
            },
          },
        },
      });

      await this.writeAuditLog(
        tx,
        organizationId,
        actorId,
        'VISITOR_REJECTED',
        'VISITOR',
        id,
        {
          visitorName: updated.visitorName,
          gatePassCode: updated.gatePassCode,
        }
      );

      return this.mapToDto(updated);
    });
  }

  /**
   * Delete visitor record (Owner/Manager only)
   */
  async deleteVisitor(
    organizationId: string,
    id: string,
    actorId?: string
  ): Promise<{ success: boolean; message: string }> {
    return this.prisma.$transaction(async (tx) => {
      const visitor = await tx.visitorRecord.findFirst({
        where: { id, property: { organizationId } },
      });

      if (!visitor) {
        throw new NotFoundException('Visitor record not found');
      }

      await this.writeAuditLog(
        tx,
        organizationId,
        actorId,
        'VISITOR_DELETED',
        'VISITOR',
        id,
        {
          visitorName: visitor.visitorName,
          visitorPhone: visitor.visitorPhone,
          gatePassCode: visitor.gatePassCode,
          propertyId: visitor.propertyId,
          tenantId: visitor.tenantId,
        }
      );

      await tx.visitorRecord.delete({
        where: { id },
      });

      return { success: true, message: 'Visitor record deleted successfully' };
    });
  }

  /**
   * Real-time visitor dashboard summary KPIs
   */
  async getVisitorSummary(
    organizationId: string,
    propertyId?: string,
    callerTenantId?: string
  ): Promise<VisitorSummaryDto> {
    const where: Prisma.VisitorRecordWhereInput = {
      property: { organizationId },
    };

    if (callerTenantId) {
      where.tenantId = callerTenantId;
    }

    if (propertyId) {
      where.propertyId = propertyId;
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    const [totalToday, activeInside, expected, totalThisMonth] = await Promise.all([
      this.prisma.visitorRecord.count({
        where: {
          ...where,
          entryTime: { gte: startOfToday, lte: endOfToday },
        },
      }),
      this.prisma.visitorRecord.count({
        where: {
          ...where,
          isApproved: true,
          exitTime: null,
          entryTime: { lte: now },
        },
      }),
      this.prisma.visitorRecord.count({
        where: {
          ...where,
          isApproved: true,
          exitTime: null,
          entryTime: { gt: now },
        },
      }),
      this.prisma.visitorRecord.count({
        where: {
          ...where,
          entryTime: { gte: startOfMonth },
        },
      }),
    ]);

    return {
      totalVisitorsToday: totalToday,
      activeVisitorsInside: activeInside,
      expectedVisitors: expected,
      totalVisitorsThisMonth: totalThisMonth,
    };
  }
}
