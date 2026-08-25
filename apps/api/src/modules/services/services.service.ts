import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  AuthUser,
  UserRole,
  ServiceRequestDto,
  CreateServiceRequestDto,
  UpdateServiceRequestDto,
  AssignServiceRequestDto,
  UpdateServiceRequestStatusDto,
  ServiceRequestQueryDto,
  ServiceRequestSummaryDto,
  ServiceCategorySummaryDto,
  ServiceRequestCategory,
  ServiceRequestPriority,
  ServiceRequestStatus,
  ServiceRequestSlot,
} from '@propertyos/types';
import { Prisma } from '@prisma/client';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper: Resolve tenant's active stay property IDs
   */
  async getTenantActiveStayPropertyIds(user: AuthUser, organizationId: string): Promise<{ propertyIds: string[]; tenantId?: string }> {
    const userRecords = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { phone: true, email: true },
    });

    const phone = userRecords?.phone || user.phone || '';
    const email = userRecords?.email || user.email || '';

    const tenant = await this.prisma.tenant.findFirst({
      where: {
        organizationId,
        deletedAt: null,
        OR: [
          ...(phone ? [{ phone }] : []),
          ...(email ? [{ email }] : []),
        ],
      },
      select: { id: true },
    });

    if (!tenant) {
      return { propertyIds: [] };
    }

    const [checkIns, leases] = await Promise.all([
      this.prisma.checkIn.findMany({
        where: {
          tenantId: tenant.id,
          organizationId,
          status: 'CHECKED_IN',
        },
        select: { propertyId: true },
      }),
      this.prisma.lease.findMany({
        where: {
          tenantId: tenant.id,
          status: 'ACTIVE',
        },
        include: {
          rentalUnit: {
            select: { propertyId: true },
          },
        },
      }),
    ]);

    const propertyIds = Array.from(
      new Set([
        ...checkIns.map((c) => c.propertyId),
        ...leases.map((l) => l.rentalUnit.propertyId),
      ])
    );

    return { propertyIds, tenantId: tenant.id };
  }

  /**
   * Create a new service request
   */
  async createServiceRequest(
    user: AuthUser,
    organizationId: string,
    dto: CreateServiceRequestDto,
    ip?: string,
    userAgent?: string
  ): Promise<ServiceRequestDto> {
    const property = await this.prisma.property.findFirst({
      where: {
        id: dto.propertyId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found in organization.');
    }

    const isTenant = user.roles.includes(UserRole.TENANT);
    let tenantId: string | undefined = undefined;

    if (isTenant) {
      const { propertyIds, tenantId: resolvedTenantId } = await this.getTenantActiveStayPropertyIds(user, organizationId);
      if (!propertyIds.includes(dto.propertyId)) {
        throw new ForbiddenException('Tenants can only create service requests for properties where they have an active stay.');
      }
      tenantId = resolvedTenantId;
    }

    // Location target validation
    if (dto.roomId) {
      if (property.propertyType !== 'PG') {
        throw new BadRequestException('Room targeting is only valid for PG properties.');
      }
      const room = await this.prisma.room.findFirst({
        where: { id: dto.roomId, propertyId: dto.propertyId, deletedAt: null },
      });
      if (!room) {
        throw new BadRequestException('Room does not exist on this property.');
      }
    }

    if (dto.rentalUnitId) {
      if (property.propertyType !== 'RENTAL_HOUSE') {
        throw new BadRequestException('Rental unit targeting is only valid for Rental House properties.');
      }
      const unit = await this.prisma.rentalUnit.findFirst({
        where: { id: dto.rentalUnitId, propertyId: dto.propertyId, deletedAt: null },
      });
      if (!unit) {
        throw new BadRequestException('Rental unit does not exist on this property.');
      }
    }

    const requesterName = `${user.firstName} ${user.lastName}`.trim();
    const requesterRole = user.roles[0] || UserRole.TENANT;
    const contactPhone = dto.contactPhone || user.phone || '';

    const created = await this.prisma.$transaction(async (tx) => {
      const request = await tx.serviceRequest.create({
        data: {
          organizationId,
          propertyId: dto.propertyId,
          requesterId: user.id,
          tenantId: tenantId || null,
          serviceCategory: dto.serviceCategory,
          priority: dto.priority || ServiceRequestPriority.MEDIUM,
          status: ServiceRequestStatus.PENDING,
          title: dto.title.trim(),
          description: dto.description.trim(),
          requesterName,
          requesterRole,
          contactPhone,
          roomId: dto.roomId || null,
          rentalUnitId: dto.rentalUnitId || null,
          locationDetails: dto.locationDetails?.trim() || null,
          preferredSlot: dto.preferredSlot || ServiceRequestSlot.ANYTIME,
          preferredDate: dto.preferredDate ? new Date(dto.preferredDate) : null,
          estimatedCost: dto.estimatedCost !== undefined && dto.estimatedCost !== null
            ? new Prisma.Decimal(dto.estimatedCost)
            : null,
          isPaidByTenant: dto.isPaidByTenant ?? false,
        },
        include: {
          property: { select: { id: true, name: true, code: true, propertyType: true } },
          room: { select: { id: true, roomNumber: true } },
          rentalUnit: { select: { id: true, unitNumber: true } },
          assignedStaff: { select: { id: true, name: true, roleTitle: true, phone: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          userId: user.id,
          action: 'SERVICE_REQUEST_CREATED',
          resourceType: 'ServiceRequest',
          resourceId: request.id,
          ipAddress: ip || null,
          userAgent: userAgent || null,
          metadata: {
            propertyId: dto.propertyId,
            serviceCategory: dto.serviceCategory,
            priority: request.priority,
            title: request.title,
            isPaidByTenant: request.isPaidByTenant,
          },
        },
      });

      return request;
    });

    return this.mapToDto(created);
  }

  /**
   * Query service requests with multi-tenant filtering, search, and pagination
   */
  async getServiceRequests(
    user: AuthUser,
    organizationId: string,
    query: ServiceRequestQueryDto
  ): Promise<{ data: ServiceRequestDto[]; total: number; page: number; limit: number; totalPages: number }> {
    const isTenant = user.roles.includes(UserRole.TENANT);
    const where: Prisma.ServiceRequestWhereInput = {
      organizationId,
      deletedAt: null,
    };

    if (isTenant) {
      const { propertyIds } = await this.getTenantActiveStayPropertyIds(user, organizationId);
      if (query.propertyId) {
        if (!propertyIds.includes(query.propertyId)) {
          throw new ForbiddenException('Access denied to unassigned property.');
        }
        where.propertyId = query.propertyId;
      } else {
        where.OR = [
          { propertyId: { in: propertyIds } },
          { requesterId: user.id },
        ];
      }
    } else {
      if (query.propertyId) {
        where.propertyId = query.propertyId;
      }
    }

    if (query.serviceCategory) {
      where.serviceCategory = query.serviceCategory;
    }

    if (query.priority) {
      where.priority = query.priority;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.assignedStaffId) {
      where.assignedStaffId = query.assignedStaffId;
    }

    if (query.requesterId) {
      where.requesterId = query.requesterId;
    }

    if (query.tenantId) {
      where.tenantId = query.tenantId;
    }

    if (query.search && query.search.trim()) {
      const s = query.search.trim();
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { title: { contains: s, mode: 'insensitive' } },
            { description: { contains: s, mode: 'insensitive' } },
            { locationDetails: { contains: s, mode: 'insensitive' } },
            { requesterName: { contains: s, mode: 'insensitive' } },
          ],
        },
      ];
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {
        ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
        ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
      };
    }

    let orderBy: Prisma.ServiceRequestOrderByWithRelationInput = { createdAt: 'desc' };
    if (query.sortBy === 'OLDEST') {
      orderBy = { createdAt: 'asc' };
    } else if (query.sortBy === 'SCHEDULED_ASC') {
      orderBy = { scheduledDate: 'asc' };
    } else if (query.sortBy === 'PRIORITY_DESC') {
      orderBy = { priority: 'desc' };
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      this.prisma.serviceRequest.count({ where }),
      this.prisma.serviceRequest.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          property: { select: { id: true, name: true, code: true, propertyType: true } },
          room: { select: { id: true, roomNumber: true } },
          rentalUnit: { select: { id: true, unitNumber: true } },
          assignedStaff: { select: { id: true, name: true, roleTitle: true, phone: true } },
        },
      }),
    ]);

    return {
      data: items.map((item) => this.mapToDto(item)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Get single service request by ID
   */
  async getServiceRequestById(
    user: AuthUser,
    organizationId: string,
    id: string
  ): Promise<ServiceRequestDto> {
    const request = await this.prisma.serviceRequest.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
      include: {
        property: { select: { id: true, name: true, code: true, propertyType: true } },
        room: { select: { id: true, roomNumber: true } },
        rentalUnit: { select: { id: true, unitNumber: true } },
        assignedStaff: { select: { id: true, name: true, roleTitle: true, phone: true } },
      },
    });

    if (!request) {
      throw new NotFoundException('Service request not found.');
    }

    const isTenant = user.roles.includes(UserRole.TENANT);
    if (isTenant && request.requesterId !== user.id) {
      const { propertyIds } = await this.getTenantActiveStayPropertyIds(user, organizationId);
      if (!propertyIds.includes(request.propertyId)) {
        throw new ForbiddenException('Access denied.');
      }
    }

    return this.mapToDto(request);
  }

  /**
   * Update service request details
   */
  async updateServiceRequest(
    user: AuthUser,
    organizationId: string,
    id: string,
    dto: UpdateServiceRequestDto,
    ip?: string,
    userAgent?: string
  ): Promise<ServiceRequestDto> {
    const existing = await this.prisma.serviceRequest.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: { property: true },
    });

    if (!existing) {
      throw new NotFoundException('Service request not found.');
    }

    const isAuthor = existing.requesterId === user.id;
    const isManager = user.roles.some((r) =>
      [UserRole.OWNER, UserRole.PROPERTY_MANAGER, UserRole.WARDEN, UserRole.MAINTENANCE_STAFF].includes(r)
    );

    if (!isAuthor && !isManager) {
      throw new ForbiddenException('You are not authorized to update this service request.');
    }

    if (isAuthor && !isManager && existing.status !== ServiceRequestStatus.PENDING && existing.status !== ServiceRequestStatus.SCHEDULED) {
      throw new ForbiddenException('Requesters can only edit requests in PENDING or SCHEDULED status.');
    }

    if (dto.roomId) {
      if (existing.property.propertyType !== 'PG') {
        throw new BadRequestException('Room targeting is only valid for PG properties.');
      }
      const room = await this.prisma.room.findFirst({
        where: { id: dto.roomId, propertyId: existing.propertyId, deletedAt: null },
      });
      if (!room) {
        throw new BadRequestException('Room does not exist on this property.');
      }
    }

    if (dto.rentalUnitId) {
      if (existing.property.propertyType !== 'RENTAL_HOUSE') {
        throw new BadRequestException('Rental unit targeting is only valid for Rental House properties.');
      }
      const unit = await this.prisma.rentalUnit.findFirst({
        where: { id: dto.rentalUnitId, propertyId: existing.propertyId, deletedAt: null },
      });
      if (!unit) {
        throw new BadRequestException('Rental unit does not exist on this property.');
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const req = await tx.serviceRequest.update({
        where: { id },
        data: {
          title: dto.title !== undefined ? dto.title.trim() : undefined,
          description: dto.description !== undefined ? dto.description.trim() : undefined,
          serviceCategory: dto.serviceCategory ?? undefined,
          priority: dto.priority ?? undefined,
          contactPhone: dto.contactPhone ?? undefined,
          roomId: dto.roomId !== undefined ? dto.roomId : undefined,
          rentalUnitId: dto.rentalUnitId !== undefined ? dto.rentalUnitId : undefined,
          locationDetails: dto.locationDetails !== undefined ? (dto.locationDetails?.trim() || null) : undefined,
          preferredSlot: dto.preferredSlot ?? undefined,
          preferredDate: dto.preferredDate !== undefined ? (dto.preferredDate ? new Date(dto.preferredDate) : null) : undefined,
          estimatedCost: dto.estimatedCost !== undefined
            ? (dto.estimatedCost !== null ? new Prisma.Decimal(dto.estimatedCost) : null)
            : undefined,
          actualCost: dto.actualCost !== undefined
            ? (dto.actualCost !== null ? new Prisma.Decimal(dto.actualCost) : null)
            : undefined,
          isPaidByTenant: dto.isPaidByTenant ?? undefined,
          resolutionNotes: dto.resolutionNotes !== undefined ? (dto.resolutionNotes?.trim() || null) : undefined,
        },
        include: {
          property: { select: { id: true, name: true, code: true, propertyType: true } },
          room: { select: { id: true, roomNumber: true } },
          rentalUnit: { select: { id: true, unitNumber: true } },
          assignedStaff: { select: { id: true, name: true, roleTitle: true, phone: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          userId: user.id,
          action: 'SERVICE_REQUEST_UPDATED',
          resourceType: 'ServiceRequest',
          resourceId: id,
          ipAddress: ip || null,
          userAgent: userAgent || null,
          metadata: {
            changes: {
              title: dto.title,
              serviceCategory: dto.serviceCategory,
              priority: dto.priority,
              actualCost: dto.actualCost,
              isPaidByTenant: dto.isPaidByTenant,
            },
          },
        },
      });

      return req;
    });

    return this.mapToDto(updated);
  }

  /**
   * Assign staff member or vendor to service request (with advisory locking)
   */
  async assignServiceRequest(
    user: AuthUser,
    organizationId: string,
    id: string,
    dto: AssignServiceRequestDto,
    ip?: string,
    userAgent?: string
  ): Promise<ServiceRequestDto> {
    const isManager = user.roles.some((r) =>
      [UserRole.OWNER, UserRole.PROPERTY_MANAGER, UserRole.WARDEN].includes(r)
    );

    if (!isManager) {
      throw new ForbiddenException('Only management can assign service requests.');
    }

    return await this.prisma.$transaction(async (tx) => {
      // Transaction-scoped PostgreSQL advisory lock
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('service_req_status_' || ${id}::text))`;

      const existing = await tx.serviceRequest.findFirst({
        where: { id, organizationId, deletedAt: null },
      });

      if (!existing) {
        throw new NotFoundException('Service request not found.');
      }

      if (dto.assignedStaffId) {
        const staff = await tx.staffMember.findFirst({
          where: { id: dto.assignedStaffId, organizationId, isActive: true },
        });
        if (!staff) {
          throw new BadRequestException('Assigned staff member not found or is inactive.');
        }
      }

      const nextStatus = existing.status === ServiceRequestStatus.PENDING
        ? ServiceRequestStatus.SCHEDULED
        : existing.status;

      const updated = await tx.serviceRequest.update({
        where: { id },
        data: {
          assignedStaffId: dto.assignedStaffId !== undefined ? dto.assignedStaffId : undefined,
          assignedVendorName: dto.assignedVendorName !== undefined ? (dto.assignedVendorName?.trim() || null) : undefined,
          assignedVendorPhone: dto.assignedVendorPhone !== undefined ? (dto.assignedVendorPhone?.trim() || null) : undefined,
          scheduledDate: dto.scheduledDate !== undefined ? (dto.scheduledDate ? new Date(dto.scheduledDate) : null) : undefined,
          status: nextStatus,
        },
        include: {
          property: { select: { id: true, name: true, code: true, propertyType: true } },
          room: { select: { id: true, roomNumber: true } },
          rentalUnit: { select: { id: true, unitNumber: true } },
          assignedStaff: { select: { id: true, name: true, roleTitle: true, phone: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          userId: user.id,
          action: 'SERVICE_REQUEST_ASSIGNED',
          resourceType: 'ServiceRequest',
          resourceId: id,
          ipAddress: ip || null,
          userAgent: userAgent || null,
          metadata: {
            assignedStaffId: dto.assignedStaffId,
            assignedVendorName: dto.assignedVendorName,
            scheduledDate: dto.scheduledDate,
            status: nextStatus,
          },
        },
      });

      return this.mapToDto(updated);
    });
  }

  /**
   * Update service request status (with advisory locking)
   */
  async updateServiceRequestStatus(
    user: AuthUser,
    organizationId: string,
    id: string,
    dto: UpdateServiceRequestStatusDto,
    ip?: string,
    userAgent?: string
  ): Promise<ServiceRequestDto> {
    return await this.prisma.$transaction(async (tx) => {
      // Transaction-scoped PostgreSQL advisory lock
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('service_req_status_' || ${id}::text))`;

      const existing = await tx.serviceRequest.findFirst({
        where: { id, organizationId, deletedAt: null },
      });

      if (!existing) {
        throw new NotFoundException('Service request not found.');
      }

      if (existing.status === ServiceRequestStatus.CANCELLED) {
        throw new ConflictException('Cancelled requests cannot transition status.');
      }

      const isAuthor = existing.requesterId === user.id;
      const isManager = user.roles.some((r) =>
        [UserRole.OWNER, UserRole.PROPERTY_MANAGER, UserRole.WARDEN, UserRole.MAINTENANCE_STAFF].includes(r)
      );

      if (!isManager) {
        if (!isAuthor) {
          throw new ForbiddenException('You are not authorized to update this service request status.');
        }
        if (dto.status !== ServiceRequestStatus.CANCELLED) {
          throw new ForbiddenException('Requesters can only cancel their service requests.');
        }
        if (existing.status !== ServiceRequestStatus.PENDING && existing.status !== ServiceRequestStatus.SCHEDULED) {
          throw new ForbiddenException('Requesters can only cancel PENDING or SCHEDULED requests.');
        }
      }

      const isCompleting = dto.status === ServiceRequestStatus.COMPLETED;
      const isCancelling = dto.status === ServiceRequestStatus.CANCELLED;

      const updated = await tx.serviceRequest.update({
        where: { id },
        data: {
          status: dto.status,
          resolutionNotes: dto.resolutionNotes !== undefined ? (dto.resolutionNotes?.trim() || null) : undefined,
          actualCost: dto.actualCost !== undefined ? new Prisma.Decimal(dto.actualCost) : undefined,
          isPaidByTenant: dto.isPaidByTenant !== undefined ? dto.isPaidByTenant : undefined,
          completedAt: isCompleting ? new Date() : undefined,
          cancelledAt: isCancelling ? new Date() : undefined,
          cancellationReason: isCancelling ? (dto.cancellationReason?.trim() || null) : undefined,
        },
        include: {
          property: { select: { id: true, name: true, code: true, propertyType: true } },
          room: { select: { id: true, roomNumber: true } },
          rentalUnit: { select: { id: true, unitNumber: true } },
          assignedStaff: { select: { id: true, name: true, roleTitle: true, phone: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          userId: user.id,
          action: isCancelling ? 'SERVICE_REQUEST_CANCELLED' : 'SERVICE_REQUEST_STATUS_CHANGED',
          resourceType: 'ServiceRequest',
          resourceId: id,
          ipAddress: ip || null,
          userAgent: userAgent || null,
          metadata: {
            fromStatus: existing.status,
            toStatus: dto.status,
            resolutionNotes: dto.resolutionNotes,
            actualCost: dto.actualCost,
            cancellationReason: dto.cancellationReason,
          },
        },
      });

      return this.mapToDto(updated);
    });
  }

  /**
   * Soft-delete service request (with advisory locking)
   */
  async deleteServiceRequest(
    user: AuthUser,
    organizationId: string,
    id: string,
    ip?: string,
    userAgent?: string
  ): Promise<{ success: boolean; message: string }> {
    const isManager = user.roles.some((r) =>
      [UserRole.OWNER, UserRole.PROPERTY_MANAGER].includes(r)
    );

    if (!isManager) {
      throw new ForbiddenException('Only owners and property managers can delete service requests.');
    }

    return await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('service_req_status_' || ${id}::text))`;

      const existing = await tx.serviceRequest.findFirst({
        where: { id, organizationId, deletedAt: null },
      });

      if (!existing) {
        throw new NotFoundException('Service request not found.');
      }

      await tx.serviceRequest.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          status: ServiceRequestStatus.CANCELLED,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          userId: user.id,
          action: 'SERVICE_REQUEST_DELETED',
          resourceType: 'ServiceRequest',
          resourceId: id,
          ipAddress: ip || null,
          userAgent: userAgent || null,
          metadata: {
            title: existing.title,
            serviceCategory: existing.serviceCategory,
          },
        },
      });

      return { success: true, message: 'Service request deleted successfully.' };
    });
  }

  /**
   * Get service requests summary KPIs with exact Decimal summation
   */
  async getSummary(
    user: AuthUser,
    organizationId: string,
    propertyId?: string
  ): Promise<ServiceRequestSummaryDto> {
    const isTenant = user.roles.includes(UserRole.TENANT);
    const where: Prisma.ServiceRequestWhereInput = {
      organizationId,
      deletedAt: null,
    };

    if (isTenant) {
      const { propertyIds } = await this.getTenantActiveStayPropertyIds(user, organizationId);
      if (propertyId) {
        if (!propertyIds.includes(propertyId)) {
          throw new ForbiddenException('Access denied to unassigned property.');
        }
        where.propertyId = propertyId;
      } else {
        where.OR = [
          { propertyId: { in: propertyIds } },
          { requesterId: user.id },
        ];
      }
    } else {
      if (propertyId) {
        const property = await this.prisma.property.findFirst({
          where: { id: propertyId, organizationId, deletedAt: null },
        });
        if (!property) {
          throw new NotFoundException('Property not found in organization.');
        }
        where.propertyId = propertyId;
      }
    }

    const [
      totalRequests,
      pendingRequests,
      scheduledRequests,
      inProgressRequests,
      completedRequests,
      cancelledRequests,
      allForSum,
      categoryGroups,
    ] = await Promise.all([
      this.prisma.serviceRequest.count({ where }),
      this.prisma.serviceRequest.count({ where: { ...where, status: ServiceRequestStatus.PENDING } }),
      this.prisma.serviceRequest.count({ where: { ...where, status: ServiceRequestStatus.SCHEDULED } }),
      this.prisma.serviceRequest.count({ where: { ...where, status: ServiceRequestStatus.IN_PROGRESS } }),
      this.prisma.serviceRequest.count({ where: { ...where, status: ServiceRequestStatus.COMPLETED } }),
      this.prisma.serviceRequest.count({ where: { ...where, status: ServiceRequestStatus.CANCELLED } }),
      this.prisma.serviceRequest.findMany({
        where,
        select: { actualCost: true, estimatedCost: true },
      }),
      this.prisma.serviceRequest.groupBy({
        by: ['serviceCategory'],
        where,
        _count: { id: true },
      }),
    ]);

    let sumActual = new Prisma.Decimal(0);
    let sumEstimated = new Prisma.Decimal(0);

    for (const item of allForSum) {
      if (item.actualCost) {
        sumActual = sumActual.add(item.actualCost);
      }
      if (item.estimatedCost) {
        sumEstimated = sumEstimated.add(item.estimatedCost);
      }
    }

    const categoryBreakdown: ServiceCategorySummaryDto[] = categoryGroups.map((g) => ({
      category: g.serviceCategory as ServiceRequestCategory,
      count: g._count.id,
    }));

    return {
      totalRequests,
      pendingRequests,
      scheduledRequests,
      inProgressRequests,
      completedRequests,
      cancelledRequests,
      totalActualCost: sumActual.toFixed(2),
      totalEstimatedCost: sumEstimated.toFixed(2),
      categoryBreakdown,
    };
  }

  /**
   * Helper: Map Prisma entity to DTO
   */
  private mapToDto(entity: any): ServiceRequestDto {
    return {
      id: entity.id,
      organizationId: entity.organizationId,
      propertyId: entity.propertyId,
      requesterId: entity.requesterId,
      tenantId: entity.tenantId || null,
      serviceCategory: entity.serviceCategory as ServiceRequestCategory,
      priority: entity.priority as ServiceRequestPriority,
      status: entity.status as ServiceRequestStatus,
      title: entity.title,
      description: entity.description,
      requesterName: entity.requesterName,
      requesterRole: entity.requesterRole as UserRole,
      contactPhone: entity.contactPhone,
      roomId: entity.roomId || null,
      rentalUnitId: entity.rentalUnitId || null,
      locationDetails: entity.locationDetails || null,
      preferredSlot: entity.preferredSlot as ServiceRequestSlot,
      preferredDate: entity.preferredDate ? entity.preferredDate.toISOString() : null,
      scheduledDate: entity.scheduledDate ? entity.scheduledDate.toISOString() : null,
      assignedStaffId: entity.assignedStaffId || null,
      assignedVendorName: entity.assignedVendorName || null,
      assignedVendorPhone: entity.assignedVendorPhone || null,
      estimatedCost: entity.estimatedCost ? new Prisma.Decimal(entity.estimatedCost).toFixed(2) : null,
      actualCost: entity.actualCost ? new Prisma.Decimal(entity.actualCost).toFixed(2) : null,
      isPaidByTenant: Boolean(entity.isPaidByTenant),
      resolutionNotes: entity.resolutionNotes || null,
      completedAt: entity.completedAt ? entity.completedAt.toISOString() : null,
      cancelledAt: entity.cancelledAt ? entity.cancelledAt.toISOString() : null,
      cancellationReason: entity.cancellationReason || null,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      property: entity.property
        ? {
            id: entity.property.id,
            name: entity.property.name,
            code: entity.property.code,
            propertyType: entity.property.propertyType,
          }
        : undefined,
      room: entity.room ? { id: entity.room.id, roomNumber: entity.room.roomNumber } : null,
      rentalUnit: entity.rentalUnit ? { id: entity.rentalUnit.id, unitNumber: entity.rentalUnit.unitNumber } : null,
      assignedStaff: entity.assignedStaff
        ? {
            id: entity.assignedStaff.id,
            name: entity.assignedStaff.name,
            roleTitle: entity.assignedStaff.roleTitle,
            phone: entity.assignedStaff.phone,
          }
        : null,
    };
  }
}
