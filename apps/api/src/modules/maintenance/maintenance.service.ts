import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '@prisma/client';
import {
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceStatus,
  MaintenanceTargetType,
  MaintenanceAttachmentType,
  MaintenanceVendorStatus,
  UserRole,
  CreateMaintenanceTicketDto,
  UpdateMaintenanceTicketDto,
  AssignMaintenanceTicketDto,
  ReassignMaintenanceTicketDto,
  StartMaintenanceTicketDto,
  CompleteMaintenanceTicketDto,
  VerifyMaintenanceTicketDto,
  CloseMaintenanceTicketDto,
  CancelMaintenanceTicketDto,
  CreateMaintenanceCommentDto,
  CreateMaintenanceAttachmentDto,
  UpdateMaintenanceCostDto,
  CreateMaintenanceVendorDto,
  UpdateMaintenanceVendorDto,
  MaintenanceListQueryDto,
  MaintenanceSummaryDto,
} from '@propertyos/types';

@Injectable()
export class MaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // DATE / DECIMAL SERIALIZATION HELPERS
  // ============================================================================

  private toIso(val: Date | string): string {
    if (val instanceof Date) return val.toISOString();
    if (typeof val === 'string') {
      const d = new Date(val);
      return isNaN(d.getTime()) ? val : d.toISOString();
    }
    return new Date().toISOString();
  }

  private toIsoOrNull(val: Date | string | null | undefined): string | null {
    if (!val) return null;
    if (val instanceof Date) return val.toISOString();
    if (typeof val === 'string') {
      const d = new Date(val);
      return isNaN(d.getTime()) ? val : d.toISOString();
    }
    return null;
  }

  // ============================================================================
  // AUDIT LOGGING HELPER
  // ============================================================================

  private async writeAuditLog(
    tx: Prisma.TransactionClient,
    organizationId: string,
    userId: string | null,
    action: string,
    resourceId: string,
    metadata?: Record<string, any>
  ) {
    try {
      await tx.auditLog.create({
        data: {
          organizationId,
          userId,
          action,
          resourceType: 'MAINTENANCE_TICKET',
          resourceId,
          metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
        },
      });
    } catch {
      // Non-blocking audit log creation
    }
  }

  // ============================================================================
  // TICKET NUMBER GENERATOR (CONCURRENCY HARDENED)
  // ============================================================================

  private async generateTicketNumber(
    tx: Prisma.TransactionClient,
    organizationId: string
  ): Promise<string> {
    const year = new Date().getFullYear();
    const count = await tx.maintenanceTicket.count({
      where: { organizationId },
    });
    let seq = count + 1;
    let ticketNum = `TKT-${year}-${seq.toString().padStart(6, '0')}`;
    while (await tx.maintenanceTicket.findUnique({ where: { ticketNumber: ticketNum } })) {
      seq++;
      ticketNum = `TKT-${year}-${seq.toString().padStart(6, '0')}`;
    }
    return ticketNum;
  }

  // ============================================================================
  // TICKETS: CREATE & TARGET VALIDATION
  // ============================================================================

  async createTicket(
    organizationId: string,
    userId: string,
    userRoles: UserRole[],
    dto: CreateMaintenanceTicketDto
  ) {
    // 1. Verify Property
    const property = await this.prisma.property.findFirst({
      where: { id: dto.propertyId, organizationId, deletedAt: null },
    });
    if (!property) {
      throw new NotFoundException(`Property with ID ${dto.propertyId} not found in organization`);
    }

    const isTenant =
      userRoles.includes(UserRole.TENANT) &&
      !userRoles.includes(UserRole.OWNER) &&
      !userRoles.includes(UserRole.PROPERTY_MANAGER);
    let resolvedTenantId = dto.tenantId || null;

    if (isTenant) {
      const tenantRecord = await this.prisma.tenant.findFirst({
        where: { organizationId, id: dto.tenantId || undefined, deletedAt: null },
      });
      if (tenantRecord) {
        resolvedTenantId = tenantRecord.id;
      }
    }

    // 2. Validate Target according to Property Operating Model (PG vs RENTAL_HOUSE)
    const targetType = dto.targetType || MaintenanceTargetType.PROPERTY;

    if (property.propertyType === 'PG') {
      if (dto.rentalUnitId) {
        throw new BadRequestException('PG properties do not have rental units. Use floor, room, or bed targeting.');
      }
      if (dto.floorId) {
        const floor = await this.prisma.floor.findFirst({
          where: { id: dto.floorId, propertyId: property.id, deletedAt: null },
        });
        if (!floor) {
          throw new NotFoundException(`Floor with ID ${dto.floorId} does not belong to PG property`);
        }
      }
      if (dto.roomId) {
        const room = await this.prisma.room.findFirst({
          where: { id: dto.roomId, propertyId: property.id, deletedAt: null },
        });
        if (!room) {
          throw new NotFoundException(`Room with ID ${dto.roomId} does not belong to PG property`);
        }
      }
      if (dto.bedId) {
        const bed = await this.prisma.bed.findFirst({
          where: { id: dto.bedId, room: { propertyId: property.id }, deletedAt: null },
        });
        if (!bed) {
          throw new NotFoundException(`Bed with ID ${dto.bedId} does not belong to PG property`);
        }
      }
    } else if (property.propertyType === 'RENTAL_HOUSE') {
      if (dto.floorId || dto.roomId || dto.bedId) {
        throw new BadRequestException('Rental house properties do not support floor, room, or bed targeting. Use rental unit targeting.');
      }
      if (dto.rentalUnitId) {
        const unit = await this.prisma.rentalUnit.findFirst({
          where: { id: dto.rentalUnitId, propertyId: property.id, deletedAt: null },
        });
        if (!unit) {
          throw new NotFoundException(`Rental unit with ID ${dto.rentalUnitId} does not belong to rental property`);
        }
      }
    }

    // 3. Handle Cost permissions and validation
    let estimatedCostDecimal: Prisma.Decimal | null = null;
    if (dto.estimatedCost !== undefined && dto.estimatedCost !== null && dto.estimatedCost !== '') {
      if (
        !userRoles.includes(UserRole.OWNER) &&
        !userRoles.includes(UserRole.PROPERTY_MANAGER) &&
        !userRoles.includes(UserRole.ACCOUNTANT)
      ) {
        throw new ForbiddenException('You do not have permission to set maintenance estimated costs');
      }
      const numCost = Number(dto.estimatedCost);
      if (isNaN(numCost) || numCost < 0) {
        throw new BadRequestException('Estimated cost must be a non-negative number');
      }
      estimatedCostDecimal = new Prisma.Decimal(dto.estimatedCost.toString());
    }

    // 4. Atomic Ticket Creation in Transaction with Advisory Locking
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('ticket_seq_' || ${organizationId}))`;
      const ticketNumber = await this.generateTicketNumber(tx, organizationId);

      const ticket = await tx.maintenanceTicket.create({
        data: {
          organizationId,
          propertyId: property.id,
          targetType: targetType as any,
          floorId: dto.floorId || null,
          roomId: dto.roomId || null,
          bedId: dto.bedId || null,
          rentalUnitId: dto.rentalUnitId || null,
          tenantId: resolvedTenantId,
          createdById: userId,
          ticketNumber,
          title: dto.title.trim(),
          description: dto.description.trim(),
          category: dto.category as any,
          priority: (dto.priority || MaintenancePriority.MEDIUM) as any,
          status: MaintenanceStatus.OPEN as any,
          locationDetails: dto.locationDetails?.trim() || null,
          estimatedCost: estimatedCostDecimal,
          scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        },
        include: {
          property: { select: { id: true, name: true, propertyType: true } },
          floor: { select: { id: true, floorNumber: true, name: true } },
          room: { select: { id: true, roomNumber: true } },
          bed: { select: { id: true, bedNumber: true } },
          rentalUnit: { select: { id: true, unitNumber: true } },
          tenant: { select: { id: true, firstName: true, lastName: true, phone: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      // Record Initial Status History
      await tx.maintenanceStatusHistory.create({
        data: {
          organizationId,
          ticketId: ticket.id,
          fromStatus: MaintenanceStatus.OPEN as any,
          toStatus: MaintenanceStatus.OPEN as any,
          changedById: userId,
          reason: 'Initial ticket creation',
        },
      });

      // Record Audit Log
      await this.writeAuditLog(tx, organizationId, userId, 'MAINTENANCE_CREATED', ticket.id, {
        ticketNumber: ticket.ticketNumber,
        propertyId: property.id,
        category: ticket.category,
        priority: ticket.priority,
      });

      return ticket;
    });
  }

  // ============================================================================
  // TICKETS: LIST & SEARCH
  // ============================================================================

  async getTickets(
    organizationId: string,
    userId: string,
    userRoles: UserRole[],
    query: MaintenanceListQueryDto
  ) {
    const isTenant =
      userRoles.includes(UserRole.TENANT) &&
      !userRoles.includes(UserRole.OWNER) &&
      !userRoles.includes(UserRole.PROPERTY_MANAGER);
    const isMaintenanceStaff =
      userRoles.includes(UserRole.MAINTENANCE_STAFF) &&
      !userRoles.includes(UserRole.OWNER) &&
      !userRoles.includes(UserRole.PROPERTY_MANAGER);

    const whereClause: Prisma.MaintenanceTicketWhereInput = {
      organizationId,
    };

    if (query.propertyId) {
      whereClause.propertyId = query.propertyId;
    }
    if (query.status) {
      whereClause.status = query.status as any;
    }
    if (query.priority) {
      whereClause.priority = query.priority as any;
    }
    if (query.category) {
      whereClause.category = query.category as any;
    }
    if (query.assignedToId) {
      whereClause.assignedToId = query.assignedToId;
    }
    if (query.tenantId) {
      whereClause.tenantId = query.tenantId;
    }
    if (query.targetType) {
      whereClause.targetType = query.targetType as any;
    }

    if (isTenant) {
      whereClause.OR = [
        { createdById: userId },
        { tenant: { organizationId, id: query.tenantId || undefined } },
      ];
    } else if (isMaintenanceStaff) {
      // Maintenance staff see tickets assigned to them or open tickets in their properties
      whereClause.OR = [
        { assignedToId: userId },
        { status: MaintenanceStatus.OPEN as any },
      ];
    }

    if (query.search && query.search.trim().length > 0) {
      const search = query.search.trim();
      whereClause.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { ticketNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (query.startDate || query.endDate) {
      whereClause.createdAt = {};
      if (query.startDate) whereClause.createdAt.gte = new Date(query.startDate);
      if (query.endDate) whereClause.createdAt.lte = new Date(query.endDate);
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const [total, data] = await Promise.all([
      this.prisma.maintenanceTicket.count({ where: whereClause }),
      this.prisma.maintenanceTicket.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { [query.sortBy || 'createdAt']: query.sortOrder || 'desc' },
        include: {
          property: { select: { id: true, name: true, propertyType: true } },
          floor: { select: { id: true, floorNumber: true, name: true } },
          room: { select: { id: true, roomNumber: true } },
          bed: { select: { id: true, bedNumber: true } },
          rentalUnit: { select: { id: true, unitNumber: true } },
          tenant: { select: { id: true, firstName: true, lastName: true, phone: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
          vendor: true,
          _count: {
            select: { comments: true, attachments: true },
          },
        },
      }),
    ]);

    // Role-based field sanitization (Tenants should not view internal costs)
    const sanitizedData = isTenant
      ? data.map((t) => ({
          ...t,
          estimatedCost: null,
          actualCost: null,
        }))
      : data;

    return {
      data: sanitizedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================================================
  // TICKETS: GET BY ID
  // ============================================================================

  async getTicketById(
    organizationId: string,
    userId: string,
    userRoles: UserRole[],
    ticketId: string
  ) {
    const isTenant =
      userRoles.includes(UserRole.TENANT) &&
      !userRoles.includes(UserRole.OWNER) &&
      !userRoles.includes(UserRole.PROPERTY_MANAGER);

    const ticket = await this.prisma.maintenanceTicket.findFirst({
      where: { id: ticketId, organizationId },
      include: {
        property: { select: { id: true, name: true, propertyType: true } },
        floor: { select: { id: true, floorNumber: true, name: true } },
        room: { select: { id: true, roomNumber: true } },
        bed: { select: { id: true, bedNumber: true } },
        rentalUnit: { select: { id: true, unitNumber: true } },
        tenant: { select: { id: true, firstName: true, lastName: true, phone: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        vendor: true,
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        attachments: {
          orderBy: { createdAt: 'asc' },
          include: {
            uploadedBy: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        assignments: {
          orderBy: { assignedAt: 'desc' },
          include: {
            assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
            assignedBy: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          include: {
            changedBy: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Maintenance ticket with ID ${ticketId} not found in organization`);
    }

    if (isTenant && ticket.createdById !== userId && ticket.tenantId !== userId) {
      throw new NotFoundException(`Maintenance ticket with ID ${ticketId} not found`);
    }

    if (isTenant) {
      return {
        ...ticket,
        estimatedCost: null,
        actualCost: null,
      };
    }

    return ticket;
  }

  // ============================================================================
  // TICKETS: UPDATE
  // ============================================================================

  async updateTicket(
    organizationId: string,
    userId: string,
    userRoles: UserRole[],
    ticketId: string,
    dto: UpdateMaintenanceTicketDto
  ) {
    const ticket = await this.prisma.maintenanceTicket.findFirst({
      where: { id: ticketId, organizationId },
    });
    if (!ticket) {
      throw new NotFoundException(`Maintenance ticket with ID ${ticketId} not found in organization`);
    }

    if (ticket.status === MaintenanceStatus.CLOSED || ticket.status === MaintenanceStatus.CANCELLED) {
      throw new BadRequestException(`Cannot update ticket in ${ticket.status} status`);
    }

    let estimatedCostDecimal: Prisma.Decimal | undefined = undefined;
    if (dto.estimatedCost !== undefined) {
      if (dto.estimatedCost !== null && dto.estimatedCost !== '') {
        if (
          !userRoles.includes(UserRole.OWNER) &&
          !userRoles.includes(UserRole.PROPERTY_MANAGER) &&
          !userRoles.includes(UserRole.ACCOUNTANT)
        ) {
          throw new ForbiddenException('You do not have permission to modify maintenance estimated costs');
        }
        const numCost = Number(dto.estimatedCost);
        if (isNaN(numCost) || numCost < 0) {
          throw new BadRequestException('Estimated cost must be a non-negative number');
        }
        estimatedCostDecimal = new Prisma.Decimal(dto.estimatedCost.toString());
      } else {
        estimatedCostDecimal = undefined;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('ticket_transition_' || ${ticketId}))`;

      const updated = await tx.maintenanceTicket.update({
        where: { id: ticket.id },
        data: {
          title: dto.title?.trim(),
          description: dto.description?.trim(),
          category: dto.category as any,
          priority: dto.priority as any,
          locationDetails: dto.locationDetails?.trim(),
          estimatedCost: estimatedCostDecimal,
          scheduledAt:
            dto.scheduledAt !== undefined
              ? dto.scheduledAt
                ? new Date(dto.scheduledAt)
                : null
              : undefined,
        },
      });

      await this.writeAuditLog(tx, organizationId, userId, 'MAINTENANCE_UPDATED', ticket.id, {
        fields: Object.keys(dto),
      });

      return updated;
    });
  }

  // ============================================================================
  // TICKETS: ASSIGN & REASSIGN
  // ============================================================================

  async assignTicket(
    organizationId: string,
    userId: string,
    userRoles: UserRole[],
    ticketId: string,
    dto: AssignMaintenanceTicketDto
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('ticket_transition_' || ${ticketId}))`;

      const ticket = await tx.maintenanceTicket.findFirst({
        where: { id: ticketId, organizationId },
      });
      if (!ticket) {
        throw new NotFoundException(`Maintenance ticket with ID ${ticketId} not found in organization`);
      }

      if (ticket.status === MaintenanceStatus.CLOSED || ticket.status === MaintenanceStatus.CANCELLED) {
        throw new ConflictException(`Cannot assign staff to a ticket that is ${ticket.status}`);
      }

      // Verify staff user belongs to organization
      const staffUser = await tx.user.findFirst({
        where: { id: dto.assignedToId, organizationId, isActive: true },
      });
      if (!staffUser) {
        throw new NotFoundException(`Staff user with ID ${dto.assignedToId} not found in organization`);
      }

      const fromStatus = ticket.status as MaintenanceStatus;
      const newStatus = ticket.status === MaintenanceStatus.OPEN ? MaintenanceStatus.ASSIGNED : ticket.status;

      // 1. Close existing active assignments
      await tx.maintenanceAssignment.updateMany({
        where: { ticketId: ticket.id, unassignedAt: null },
        data: { unassignedAt: new Date() },
      });

      // 2. Create new assignment
      await tx.maintenanceAssignment.create({
        data: {
          organizationId,
          ticketId: ticket.id,
          assignedToId: dto.assignedToId,
          assignedById: userId,
          notes: dto.notes?.trim() || null,
        },
      });

      // 3. Update ticket
      const updated = await tx.maintenanceTicket.update({
        where: { id: ticket.id },
        data: {
          assignedToId: dto.assignedToId,
          status: newStatus as any,
        },
        include: {
          assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      // 4. Record status history if changed
      if (fromStatus !== newStatus) {
        await tx.maintenanceStatusHistory.create({
          data: {
            organizationId,
            ticketId: ticket.id,
            fromStatus: fromStatus as any,
            toStatus: newStatus as any,
            changedById: userId,
            reason: `Assigned to ${staffUser.firstName} ${staffUser.lastName}`,
          },
        });
      }

      await this.writeAuditLog(tx, organizationId, userId, 'MAINTENANCE_ASSIGNED', ticket.id, {
        assignedToId: dto.assignedToId,
        staffName: `${staffUser.firstName} ${staffUser.lastName}`,
      });

      return updated;
    });
  }

  async reassignTicket(
    organizationId: string,
    userId: string,
    userRoles: UserRole[],
    ticketId: string,
    dto: ReassignMaintenanceTicketDto
  ) {
    return this.assignTicket(organizationId, userId, userRoles, ticketId, {
      assignedToId: dto.newAssignedToId,
      notes: dto.notes,
    });
  }

  async unassignTicket(
    organizationId: string,
    userId: string,
    ticketId: string
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('ticket_transition_' || ${ticketId}))`;

      const ticket = await tx.maintenanceTicket.findFirst({
        where: { id: ticketId, organizationId },
      });
      if (!ticket) {
        throw new NotFoundException(`Maintenance ticket with ID ${ticketId} not found in organization`);
      }

      if (ticket.status === MaintenanceStatus.CLOSED || ticket.status === MaintenanceStatus.CANCELLED) {
        throw new ConflictException(`Cannot unassign staff from a ticket that is ${ticket.status}`);
      }

      await tx.maintenanceAssignment.updateMany({
        where: { ticketId: ticket.id, unassignedAt: null },
        data: { unassignedAt: new Date() },
      });

      const updated = await tx.maintenanceTicket.update({
        where: { id: ticket.id },
        data: {
          assignedToId: null,
          status: ticket.status === MaintenanceStatus.ASSIGNED ? (MaintenanceStatus.OPEN as any) : ticket.status,
        },
      });

      if (ticket.status === MaintenanceStatus.ASSIGNED) {
        await tx.maintenanceStatusHistory.create({
          data: {
            organizationId,
            ticketId: ticket.id,
            fromStatus: MaintenanceStatus.ASSIGNED as any,
            toStatus: MaintenanceStatus.OPEN as any,
            changedById: userId,
            reason: 'Staff unassigned from ticket',
          },
        });
      }

      await this.writeAuditLog(tx, organizationId, userId, 'MAINTENANCE_UNASSIGNED', ticket.id);

      return updated;
    });
  }

  // ============================================================================
  // TICKETS: STATUS LIFECYCLE (START, COMPLETE, VERIFY, CLOSE, CANCEL)
  // ============================================================================

  async startTicket(
    organizationId: string,
    userId: string,
    ticketId: string,
    dto?: StartMaintenanceTicketDto
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('ticket_transition_' || ${ticketId}))`;

      const ticket = await tx.maintenanceTicket.findFirst({
        where: { id: ticketId, organizationId },
      });
      if (!ticket) {
        throw new NotFoundException(`Maintenance ticket with ID ${ticketId} not found in organization`);
      }

      // State machine: Can start only from OPEN or ASSIGNED
      if (ticket.status !== MaintenanceStatus.OPEN && ticket.status !== MaintenanceStatus.ASSIGNED) {
        throw new ConflictException(
          `Cannot transition ticket from ${ticket.status} to IN_PROGRESS. Valid initial statuses: OPEN, ASSIGNED.`
        );
      }

      const fromStatus = ticket.status as MaintenanceStatus;
      const startedAt = ticket.startedAt || new Date();

      const updated = await tx.maintenanceTicket.update({
        where: { id: ticket.id },
        data: {
          status: MaintenanceStatus.IN_PROGRESS as any,
          startedAt,
        },
      });

      await tx.maintenanceStatusHistory.create({
        data: {
          organizationId,
          ticketId: ticket.id,
          fromStatus: fromStatus as any,
          toStatus: MaintenanceStatus.IN_PROGRESS as any,
          changedById: userId,
          reason: dto?.notes?.trim() || 'Work started on ticket',
        },
      });

      await this.writeAuditLog(tx, organizationId, userId, 'MAINTENANCE_STARTED', ticket.id);

      return updated;
    });
  }

  async completeTicket(
    organizationId: string,
    userId: string,
    userRoles: UserRole[],
    ticketId: string,
    dto: CompleteMaintenanceTicketDto
  ) {
    let actualCostDecimal: Prisma.Decimal | undefined = undefined;
    if (dto.actualCost !== undefined && dto.actualCost !== null && dto.actualCost !== '') {
      if (userRoles.includes(UserRole.TENANT)) {
        throw new ForbiddenException('Tenants cannot record maintenance actual costs');
      }
      const numCost = Number(dto.actualCost);
      if (isNaN(numCost) || numCost < 0) {
        throw new BadRequestException('Actual cost must be a non-negative number');
      }
      actualCostDecimal = new Prisma.Decimal(dto.actualCost.toString());
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('ticket_transition_' || ${ticketId}))`;

      const ticket = await tx.maintenanceTicket.findFirst({
        where: { id: ticketId, organizationId },
      });
      if (!ticket) {
        throw new NotFoundException(`Maintenance ticket with ID ${ticketId} not found in organization`);
      }

      // State machine: Can complete only from IN_PROGRESS or ASSIGNED
      if (ticket.status !== MaintenanceStatus.IN_PROGRESS && ticket.status !== MaintenanceStatus.ASSIGNED) {
        throw new ConflictException(
          `Cannot transition ticket from ${ticket.status} to COMPLETED. Ticket must be IN_PROGRESS or ASSIGNED.`
        );
      }

      const fromStatus = ticket.status as MaintenanceStatus;
      const completedAt = new Date();

      const updated = await tx.maintenanceTicket.update({
        where: { id: ticket.id },
        data: {
          status: MaintenanceStatus.COMPLETED as any,
          completedAt,
          actualCost: actualCostDecimal !== undefined ? actualCostDecimal : ticket.actualCost,
          resolutionNotes: dto.resolutionNotes?.trim() || ticket.resolutionNotes,
          vendorId: dto.vendorId || ticket.vendorId,
        },
      });

      await tx.maintenanceStatusHistory.create({
        data: {
          organizationId,
          ticketId: ticket.id,
          fromStatus: fromStatus as any,
          toStatus: MaintenanceStatus.COMPLETED as any,
          changedById: userId,
          reason: dto.resolutionNotes?.trim() || 'Maintenance work completed',
        },
      });

      await this.writeAuditLog(tx, organizationId, userId, 'MAINTENANCE_COMPLETED', ticket.id, {
        actualCost: actualCostDecimal?.toString(),
      });

      return updated;
    });
  }

  async verifyTicket(
    organizationId: string,
    userId: string,
    ticketId: string,
    dto?: VerifyMaintenanceTicketDto
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('ticket_transition_' || ${ticketId}))`;

      const ticket = await tx.maintenanceTicket.findFirst({
        where: { id: ticketId, organizationId },
      });
      if (!ticket) {
        throw new NotFoundException(`Maintenance ticket with ID ${ticketId} not found in organization`);
      }

      // State machine: Can verify only from COMPLETED
      if (ticket.status !== MaintenanceStatus.COMPLETED) {
        throw new ConflictException(
          `Cannot transition ticket from ${ticket.status} to VERIFIED. Ticket must be COMPLETED.`
        );
      }

      const fromStatus = ticket.status as MaintenanceStatus;
      const verifiedAt = new Date();

      const updated = await tx.maintenanceTicket.update({
        where: { id: ticket.id },
        data: {
          status: MaintenanceStatus.VERIFIED as any,
          verifiedAt,
        },
      });

      await tx.maintenanceStatusHistory.create({
        data: {
          organizationId,
          ticketId: ticket.id,
          fromStatus: fromStatus as any,
          toStatus: MaintenanceStatus.VERIFIED as any,
          changedById: userId,
          reason: dto?.notes?.trim() || 'Maintenance work verified by authorized manager',
        },
      });

      await this.writeAuditLog(tx, organizationId, userId, 'MAINTENANCE_VERIFIED', ticket.id);

      return updated;
    });
  }

  async closeTicket(
    organizationId: string,
    userId: string,
    ticketId: string,
    dto?: CloseMaintenanceTicketDto
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('ticket_transition_' || ${ticketId}))`;

      const ticket = await tx.maintenanceTicket.findFirst({
        where: { id: ticketId, organizationId },
      });
      if (!ticket) {
        throw new NotFoundException(`Maintenance ticket with ID ${ticketId} not found in organization`);
      }

      // State machine: Can close only from VERIFIED or COMPLETED
      if (ticket.status !== MaintenanceStatus.VERIFIED && ticket.status !== MaintenanceStatus.COMPLETED) {
        throw new ConflictException(
          `Cannot transition ticket from ${ticket.status} to CLOSED. Ticket must be VERIFIED or COMPLETED.`
        );
      }

      const fromStatus = ticket.status as MaintenanceStatus;
      const closedAt = new Date();

      const updated = await tx.maintenanceTicket.update({
        where: { id: ticket.id },
        data: {
          status: MaintenanceStatus.CLOSED as any,
          closedAt,
        },
      });

      await tx.maintenanceStatusHistory.create({
        data: {
          organizationId,
          ticketId: ticket.id,
          fromStatus: fromStatus as any,
          toStatus: MaintenanceStatus.CLOSED as any,
          changedById: userId,
          reason: dto?.notes?.trim() || 'Maintenance ticket closed',
        },
      });

      await this.writeAuditLog(tx, organizationId, userId, 'MAINTENANCE_CLOSED', ticket.id);

      return updated;
    });
  }

  async cancelTicket(
    organizationId: string,
    userId: string,
    ticketId: string,
    dto: CancelMaintenanceTicketDto
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('ticket_transition_' || ${ticketId}))`;

      const ticket = await tx.maintenanceTicket.findFirst({
        where: { id: ticketId, organizationId },
      });
      if (!ticket) {
        throw new NotFoundException(`Maintenance ticket with ID ${ticketId} not found in organization`);
      }

      // State machine: Can cancel only from OPEN, ASSIGNED, or IN_PROGRESS
      if (
        ticket.status === MaintenanceStatus.COMPLETED ||
        ticket.status === MaintenanceStatus.VERIFIED ||
        ticket.status === MaintenanceStatus.CLOSED ||
        ticket.status === MaintenanceStatus.CANCELLED
      ) {
        throw new ConflictException(`Cannot cancel ticket in ${ticket.status} status.`);
      }

      const fromStatus = ticket.status as MaintenanceStatus;
      const cancelledAt = new Date();

      const updated = await tx.maintenanceTicket.update({
        where: { id: ticket.id },
        data: {
          status: MaintenanceStatus.CANCELLED as any,
          cancelledAt,
          resolutionNotes: dto.reason.trim(),
        },
      });

      await tx.maintenanceStatusHistory.create({
        data: {
          organizationId,
          ticketId: ticket.id,
          fromStatus: fromStatus as any,
          toStatus: MaintenanceStatus.CANCELLED as any,
          changedById: userId,
          reason: dto.reason.trim(),
        },
      });

      await this.writeAuditLog(tx, organizationId, userId, 'MAINTENANCE_CANCELLED', ticket.id, {
        reason: dto.reason.trim(),
      });

      return updated;
    });
  }

  // ============================================================================
  // COMMENTS
  // ============================================================================

  async addComment(
    organizationId: string,
    userId: string,
    ticketId: string,
    dto: CreateMaintenanceCommentDto
  ) {
    const ticket = await this.prisma.maintenanceTicket.findFirst({
      where: { id: ticketId, organizationId },
    });
    if (!ticket) {
      throw new NotFoundException(`Maintenance ticket with ID ${ticketId} not found in organization`);
    }

    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.maintenanceComment.create({
        data: {
          organizationId,
          ticketId: ticket.id,
          authorId: userId,
          body: dto.body.trim(),
        },
        include: {
          author: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      await this.writeAuditLog(tx, organizationId, userId, 'MAINTENANCE_COMMENT_ADDED', ticket.id, {
        commentId: comment.id,
      });

      return comment;
    });
  }

  async getComments(organizationId: string, ticketId: string) {
    const ticket = await this.prisma.maintenanceTicket.findFirst({
      where: { id: ticketId, organizationId },
    });
    if (!ticket) {
      throw new NotFoundException(`Maintenance ticket with ID ${ticketId} not found in organization`);
    }

    return this.prisma.maintenanceComment.findMany({
      where: { ticketId: ticket.id, organizationId },
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  // ============================================================================
  // ATTACHMENTS
  // ============================================================================

  async addAttachment(
    organizationId: string,
    userId: string,
    ticketId: string,
    dto: CreateMaintenanceAttachmentDto
  ) {
    const ticket = await this.prisma.maintenanceTicket.findFirst({
      where: { id: ticketId, organizationId },
    });
    if (!ticket) {
      throw new NotFoundException(`Maintenance ticket with ID ${ticketId} not found in organization`);
    }

    return this.prisma.$transaction(async (tx) => {
      const attachment = await tx.maintenanceAttachment.create({
        data: {
          organizationId,
          ticketId: ticket.id,
          uploadedById: userId,
          type: dto.type as any,
          fileName: dto.fileName.trim(),
          storagePath: dto.storagePath.trim(),
          mimeType: dto.mimeType.trim(),
          fileSize: dto.fileSize,
        },
        include: {
          uploadedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      await this.writeAuditLog(tx, organizationId, userId, 'MAINTENANCE_ATTACHMENT_UPLOADED', ticket.id, {
        attachmentId: attachment.id,
        type: attachment.type,
      });

      return attachment;
    });
  }

  async getAttachments(organizationId: string, ticketId: string) {
    const ticket = await this.prisma.maintenanceTicket.findFirst({
      where: { id: ticketId, organizationId },
    });
    if (!ticket) {
      throw new NotFoundException(`Maintenance ticket with ID ${ticketId} not found in organization`);
    }

    return this.prisma.maintenanceAttachment.findMany({
      where: { ticketId: ticket.id, organizationId },
      orderBy: { createdAt: 'asc' },
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  // ============================================================================
  // COST MANAGEMENT
  // ============================================================================

  async updateCost(
    organizationId: string,
    userId: string,
    ticketId: string,
    dto: UpdateMaintenanceCostDto,
    userRoles?: UserRole[]
  ) {
    const isTenant =
      userRoles &&
      userRoles.includes(UserRole.TENANT) &&
      !userRoles.includes(UserRole.OWNER) &&
      !userRoles.includes(UserRole.PROPERTY_MANAGER);
    if (isTenant) {
      throw new ForbiddenException('Tenants cannot modify maintenance costs');
    }

    const ticket = await this.prisma.maintenanceTicket.findFirst({
      where: { id: ticketId, organizationId },
    });
    if (!ticket) {
      throw new NotFoundException(`Maintenance ticket with ID ${ticketId} not found in organization`);
    }

    let estimatedCostDecimal = ticket.estimatedCost;
    if (dto.estimatedCost !== undefined) {
      if (dto.estimatedCost !== null && dto.estimatedCost !== '') {
        const numEst = Number(dto.estimatedCost);
        if (isNaN(numEst) || numEst < 0) {
          throw new BadRequestException('Estimated cost must be a non-negative number');
        }
        estimatedCostDecimal = new Prisma.Decimal(dto.estimatedCost.toString());
      } else {
        estimatedCostDecimal = null;
      }
    }

    let actualCostDecimal = ticket.actualCost;
    if (dto.actualCost !== undefined) {
      if (dto.actualCost !== null && dto.actualCost !== '') {
        const numAct = Number(dto.actualCost);
        if (isNaN(numAct) || numAct < 0) {
          throw new BadRequestException('Actual cost must be a non-negative number');
        }
        actualCostDecimal = new Prisma.Decimal(dto.actualCost.toString());
      } else {
        actualCostDecimal = null;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('ticket_transition_' || ${ticketId}))`;

      const updated = await tx.maintenanceTicket.update({
        where: { id: ticket.id },
        data: {
          estimatedCost: estimatedCostDecimal,
          actualCost: actualCostDecimal,
          vendorId: dto.vendorId !== undefined ? dto.vendorId : ticket.vendorId,
        },
      });

      await this.writeAuditLog(tx, organizationId, userId, 'MAINTENANCE_COST_UPDATED', ticket.id, {
        estimatedCost: estimatedCostDecimal?.toString(),
        actualCost: actualCostDecimal?.toString(),
        vendorId: dto.vendorId,
      });

      return updated;
    });
  }

  // ============================================================================
  // VENDORS CRUD (CONCURRENCY HARDENED)
  // ============================================================================

  async createVendor(
    organizationId: string,
    userId: string,
    dto: CreateMaintenanceVendorDto
  ) {
    const normalizedName = dto.name.trim().toLowerCase();

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('vendor_' || ${organizationId} || '_' || ${normalizedName}))`;

      const existing = await tx.maintenanceVendor.findFirst({
        where: {
          organizationId,
          name: { equals: dto.name.trim(), mode: 'insensitive' },
        },
      });
      if (existing) {
        throw new ConflictException(`Vendor with name '${dto.name.trim()}' already exists in this organization`);
      }

      const vendor = await tx.maintenanceVendor.create({
        data: {
          organizationId,
          name: dto.name.trim(),
          phone: dto.phone.trim(),
          email: dto.email?.trim() || null,
          category: dto.category ? (dto.category as any) : null,
          address: dto.address?.trim() || null,
          notes: dto.notes?.trim() || null,
          status: MaintenanceVendorStatus.ACTIVE as any,
        },
      });

      await this.writeAuditLog(tx, organizationId, userId, 'MAINTENANCE_VENDOR_CREATED', vendor.id, {
        name: vendor.name,
      });

      return vendor;
    });
  }

  async getVendors(organizationId: string, status?: MaintenanceVendorStatus) {
    return this.prisma.maintenanceVendor.findMany({
      where: {
        organizationId,
        status: status ? (status as any) : undefined,
      },
      orderBy: { name: 'asc' },
    });
  }

  async getVendorById(organizationId: string, vendorId: string) {
    const vendor = await this.prisma.maintenanceVendor.findFirst({
      where: { id: vendorId, organizationId },
    });
    if (!vendor) {
      throw new NotFoundException(`Vendor with ID ${vendorId} not found in organization`);
    }
    return vendor;
  }

  async updateVendor(
    organizationId: string,
    userId: string,
    vendorId: string,
    dto: UpdateMaintenanceVendorDto
  ) {
    const vendor = await this.prisma.maintenanceVendor.findFirst({
      where: { id: vendorId, organizationId },
    });
    if (!vendor) {
      throw new NotFoundException(`Vendor with ID ${vendorId} not found in organization`);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.maintenanceVendor.update({
        where: { id: vendor.id },
        data: {
          name: dto.name?.trim(),
          phone: dto.phone?.trim(),
          email: dto.email !== undefined ? (dto.email?.trim() || null) : undefined,
          category: dto.category !== undefined ? (dto.category as any) : undefined,
          address: dto.address !== undefined ? (dto.address?.trim() || null) : undefined,
          notes: dto.notes !== undefined ? (dto.notes?.trim() || null) : undefined,
          status: dto.status ? (dto.status as any) : undefined,
        },
      });

      await this.writeAuditLog(tx, organizationId, userId, 'MAINTENANCE_VENDOR_UPDATED', vendor.id);

      return updated;
    });
  }

  // ============================================================================
  // SUMMARY & KPIS
  // ============================================================================

  async getSummary(organizationId: string, propertyId?: string): Promise<MaintenanceSummaryDto> {
    const where: Prisma.MaintenanceTicketWhereInput = {
      organizationId,
    };
    if (propertyId) {
      where.propertyId = propertyId;
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalTickets,
      openTickets,
      assignedTickets,
      inProgressTickets,
      urgentTickets,
      awaitingVerificationTickets,
      completedTodayTickets,
      closedTickets,
      completedTicketsWithTimestamps,
      costAggregates,
    ] = await Promise.all([
      this.prisma.maintenanceTicket.count({ where }),
      this.prisma.maintenanceTicket.count({ where: { ...where, status: MaintenanceStatus.OPEN as any } }),
      this.prisma.maintenanceTicket.count({ where: { ...where, status: MaintenanceStatus.ASSIGNED as any } }),
      this.prisma.maintenanceTicket.count({ where: { ...where, status: MaintenanceStatus.IN_PROGRESS as any } }),
      this.prisma.maintenanceTicket.count({
        where: {
          ...where,
          priority: MaintenancePriority.URGENT as any,
          status: {
            in: [
              MaintenanceStatus.OPEN as any,
              MaintenanceStatus.ASSIGNED as any,
              MaintenanceStatus.IN_PROGRESS as any,
            ],
          },
        },
      }),
      this.prisma.maintenanceTicket.count({ where: { ...where, status: MaintenanceStatus.COMPLETED as any } }),
      this.prisma.maintenanceTicket.count({
        where: {
          ...where,
          completedAt: { gte: todayStart },
        },
      }),
      this.prisma.maintenanceTicket.count({ where: { ...where, status: MaintenanceStatus.CLOSED as any } }),
      this.prisma.maintenanceTicket.findMany({
        where: {
          ...where,
          completedAt: { not: null },
        },
        select: { createdAt: true, completedAt: true },
      }),
      this.prisma.maintenanceTicket.aggregate({
        where,
        _sum: {
          estimatedCost: true,
          actualCost: true,
        },
      }),
    ]);

    let avgResolutionHours = 0;
    if (completedTicketsWithTimestamps.length > 0) {
      const totalHours = completedTicketsWithTimestamps.reduce((acc, t) => {
        if (t.completedAt) {
          const diffMs = t.completedAt.getTime() - t.createdAt.getTime();
          return acc + diffMs / (1000 * 60 * 60);
        }
        return acc;
      }, 0);
      avgResolutionHours = parseFloat((totalHours / completedTicketsWithTimestamps.length).toFixed(1));
    }

    return {
      totalTickets,
      openTickets,
      assignedTickets,
      inProgressTickets,
      urgentTickets,
      awaitingVerificationTickets,
      completedTodayTickets,
      closedTickets,
      avgResolutionHours,
      totalEstimatedCost: (costAggregates._sum.estimatedCost || new Prisma.Decimal(0)).toString(),
      totalActualCost: (costAggregates._sum.actualCost || new Prisma.Decimal(0)).toString(),
    };
  }

  async getTenantSummary(organizationId: string, tenantId: string) {
    const where: Prisma.MaintenanceTicketWhereInput = {
      organizationId,
      tenantId,
    };

    const [total, active, completed, latest] = await Promise.all([
      this.prisma.maintenanceTicket.count({ where }),
      this.prisma.maintenanceTicket.count({
        where: {
          ...where,
          status: {
            in: [
              MaintenanceStatus.OPEN as any,
              MaintenanceStatus.ASSIGNED as any,
              MaintenanceStatus.IN_PROGRESS as any,
            ],
          },
        },
      }),
      this.prisma.maintenanceTicket.count({
        where: {
          ...where,
          status: {
            in: [
              MaintenanceStatus.COMPLETED as any,
              MaintenanceStatus.VERIFIED as any,
              MaintenanceStatus.CLOSED as any,
            ],
          },
        },
      }),
      this.prisma.maintenanceTicket.findFirst({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          property: { select: { id: true, name: true } },
        },
      }),
    ]);

    return {
      totalTickets: total,
      activeTickets: active,
      completedTickets: completed,
      latestTicket: latest,
    };
  }
}
