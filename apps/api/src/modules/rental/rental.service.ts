import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  RentalUnitDto,
  CreateRentalUnitDto,
  UpdateRentalUnitDto,
  LeaseDto,
  CreateLeaseDto,
  UpdateLeaseDto,
  RentEscalationDto,
  CreateRentEscalationDto,
  RentalPropertySummaryDto,
  PropertyType,
  RentalUnitStatus,
  LeaseStatus,
} from '@propertyos/types';

@Injectable()
export class RentalService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to validate property belongs to the organization and is of type RENTAL_HOUSE
   */
  async validateRentalProperty(organizationId: string, propertyId: string): Promise<void> {
    const property = await this.prisma.property.findFirst({
      where: {
        id: propertyId,
        organizationId,
        deletedAt: null,
      },
      select: {
        propertyType: true,
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (property.propertyType !== PropertyType.RENTAL_HOUSE) {
      throw new BadRequestException('This operation is only available for Whole-Unit Rental properties.');
    }
  }

  /**
   * Helper to write standardized Audit Logs
   */
  private async writeAuditLog(
    tx: any,
    organizationId: string,
    userId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    metadata: any
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        organizationId,
        userId,
        action,
        resourceType,
        resourceId,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
      },
    });
  }

  // ==========================================================================
  // RENTAL SUMMARY
  // ==========================================================================

  async getRentalSummary(organizationId: string, propertyId: string): Promise<RentalPropertySummaryDto> {
    await this.validateRentalProperty(organizationId, propertyId);

    const units = await this.prisma.rentalUnit.findMany({
      where: { propertyId, deletedAt: null },
      select: { id: true, status: true, monthlyRent: true },
    });

    const activeLeasesCount = await this.prisma.lease.count({
      where: {
        rentalUnit: { propertyId, deletedAt: null },
        status: { in: [LeaseStatus.ACTIVE, LeaseStatus.NOTICE] },
      },
    });

    const totalUnits = units.length;
    const occupiedUnits = units.filter((u) => u.status === RentalUnitStatus.OCCUPIED).length;
    const availableUnits = units.filter((u) => u.status === RentalUnitStatus.AVAILABLE).length;
    const maintenanceUnits = units.filter((u) => u.status === RentalUnitStatus.MAINTENANCE).length;

    // Projected monthly revenue is sum of rents for occupied units
    const projectedMonthlyRevenue = units
      .filter((u) => u.status === RentalUnitStatus.OCCUPIED)
      .reduce((sum, u) => sum + u.monthlyRent.toNumber(), 0);

    return {
      totalUnits,
      occupiedUnits,
      availableUnits,
      maintenanceUnits,
      activeLeasesCount,
      projectedMonthlyRevenue,
    };
  }

  // ==========================================================================
  // RENTAL UNITS CRUD
  // ==========================================================================

  async createRentalUnit(
    organizationId: string,
    propertyId: string,
    userId: string,
    input: CreateRentalUnitDto
  ): Promise<RentalUnitDto> {
    await this.validateRentalProperty(organizationId, propertyId);

    // Check unique unitNumber
    const existing = await this.prisma.rentalUnit.findFirst({
      where: {
        propertyId,
        unitNumber: input.unitNumber.trim(),
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ConflictException(`Unit number ${input.unitNumber} already exists in this property.`);
    }

    const unit = await this.prisma.$transaction(async (tx) => {
      const created = await tx.rentalUnit.create({
        data: {
          propertyId,
          unitNumber: input.unitNumber.trim(),
          unitType: input.unitType.trim(),
          floorNumber: input.floorNumber ?? null,
          superBuiltupAreaSqFt: input.superBuiltupAreaSqFt ?? null,
          carpetAreaSqFt: input.carpetAreaSqFt ?? null,
          furnishingStatus: input.furnishingStatus ?? 'SEMI_FURNISHED',
          monthlyRent: input.monthlyRent,
          securityDeposit: input.securityDeposit,
          maintenanceCharges: input.maintenanceCharges ?? 0,
          status: RentalUnitStatus.AVAILABLE,
        },
      });

      await this.writeAuditLog(
        tx,
        organizationId,
        userId,
        'UNIT_CREATED',
        'RentalUnit',
        created.id,
        { unitNumber: created.unitNumber, monthlyRent: created.monthlyRent }
      );

      return created;
    });

    return {
      ...unit,
      monthlyRent: unit.monthlyRent.toNumber(),
      securityDeposit: unit.securityDeposit.toNumber(),
      maintenanceCharges: unit.maintenanceCharges.toNumber(),
      status: unit.status as RentalUnitStatus,
    };
  }

  async listRentalUnits(organizationId: string, propertyId: string): Promise<RentalUnitDto[]> {
    await this.validateRentalProperty(organizationId, propertyId);

    const units = await this.prisma.rentalUnit.findMany({
      where: { propertyId, deletedAt: null },
      include: {
        leases: {
          where: { status: { in: [LeaseStatus.ACTIVE, LeaseStatus.NOTICE] } },
        },
      },
      orderBy: { unitNumber: 'asc' },
    });

    return units.map((u) => {
      const activeLease = u.leases[0] ? {
        id: u.leases[0].id,
        rentalUnitId: u.leases[0].rentalUnitId,
        tenantId: u.leases[0].tenantId,
        startDate: u.leases[0].startDate,
        endDate: u.leases[0].endDate,
        monthlyRent: u.leases[0].monthlyRent.toNumber(),
        securityDeposit: u.leases[0].securityDeposit.toNumber(),
        noticePeriodDays: u.leases[0].noticePeriodDays,
        lockInMonths: u.leases[0].lockInMonths,
        status: u.leases[0].status as LeaseStatus,
        terms: u.leases[0].terms,
        createdAt: u.leases[0].createdAt,
        updatedAt: u.leases[0].updatedAt,
      } : null;

      return {
        id: u.id,
        propertyId: u.propertyId,
        unitNumber: u.unitNumber,
        unitType: u.unitType,
        floorNumber: u.floorNumber,
        superBuiltupAreaSqFt: u.superBuiltupAreaSqFt,
        carpetAreaSqFt: u.carpetAreaSqFt,
        furnishingStatus: u.furnishingStatus,
        monthlyRent: u.monthlyRent.toNumber(),
        securityDeposit: u.securityDeposit.toNumber(),
        maintenanceCharges: u.maintenanceCharges.toNumber(),
        status: u.status as RentalUnitStatus,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        deletedAt: u.deletedAt,
        activeLease,
      };
    });
  }

  async getRentalUnitById(organizationId: string, propertyId: string, unitId: string): Promise<RentalUnitDto> {
    await this.validateRentalProperty(organizationId, propertyId);

    const u = await this.prisma.rentalUnit.findFirst({
      where: { id: unitId, propertyId, deletedAt: null },
      include: {
        leases: {
          where: { status: { in: [LeaseStatus.ACTIVE, LeaseStatus.NOTICE] } },
        },
      },
    });

    if (!u) {
      throw new NotFoundException('Rental unit not found');
    }

    const activeLease = u.leases[0] ? {
      id: u.leases[0].id,
      rentalUnitId: u.leases[0].rentalUnitId,
      tenantId: u.leases[0].tenantId,
      startDate: u.leases[0].startDate,
      endDate: u.leases[0].endDate,
      monthlyRent: u.leases[0].monthlyRent.toNumber(),
      securityDeposit: u.leases[0].securityDeposit.toNumber(),
      noticePeriodDays: u.leases[0].noticePeriodDays,
      lockInMonths: u.leases[0].lockInMonths,
      status: u.leases[0].status as LeaseStatus,
      terms: u.leases[0].terms,
      createdAt: u.leases[0].createdAt,
      updatedAt: u.leases[0].updatedAt,
    } : null;

    return {
      id: u.id,
      propertyId: u.propertyId,
      unitNumber: u.unitNumber,
      unitType: u.unitType,
      floorNumber: u.floorNumber,
      superBuiltupAreaSqFt: u.superBuiltupAreaSqFt,
      carpetAreaSqFt: u.carpetAreaSqFt,
      furnishingStatus: u.furnishingStatus,
      monthlyRent: u.monthlyRent.toNumber(),
      securityDeposit: u.securityDeposit.toNumber(),
      maintenanceCharges: u.maintenanceCharges.toNumber(),
      status: u.status as RentalUnitStatus,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      deletedAt: u.deletedAt,
      activeLease,
    };
  }

  async updateRentalUnit(
    organizationId: string,
    propertyId: string,
    unitId: string,
    userId: string,
    input: UpdateRentalUnitDto
  ): Promise<RentalUnitDto> {
    await this.validateRentalProperty(organizationId, propertyId);

    const unit = await this.prisma.rentalUnit.findFirst({
      where: { id: unitId, propertyId, deletedAt: null },
    });

    if (!unit) {
      throw new NotFoundException('Rental unit not found');
    }

    if (input.unitNumber !== undefined && input.unitNumber.trim() !== unit.unitNumber) {
      const existing = await this.prisma.rentalUnit.findFirst({
        where: {
          propertyId,
          unitNumber: input.unitNumber.trim(),
          deletedAt: null,
        },
      });
      if (existing) {
        throw new ConflictException(`Unit number ${input.unitNumber} already exists in this property.`);
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.rentalUnit.update({
        where: { id: unitId },
        data: {
          unitNumber: input.unitNumber !== undefined ? input.unitNumber.trim() : undefined,
          unitType: input.unitType !== undefined ? input.unitType.trim() : undefined,
          floorNumber: input.floorNumber !== undefined ? input.floorNumber : undefined,
          superBuiltupAreaSqFt: input.superBuiltupAreaSqFt !== undefined ? input.superBuiltupAreaSqFt : undefined,
          carpetAreaSqFt: input.carpetAreaSqFt !== undefined ? input.carpetAreaSqFt : undefined,
          furnishingStatus: input.furnishingStatus !== undefined ? input.furnishingStatus : undefined,
          monthlyRent: input.monthlyRent !== undefined ? input.monthlyRent : undefined,
          securityDeposit: input.securityDeposit !== undefined ? input.securityDeposit : undefined,
          maintenanceCharges: input.maintenanceCharges !== undefined ? input.maintenanceCharges : undefined,
          status: input.status !== undefined ? input.status : undefined,
        },
      });

      await this.writeAuditLog(
        tx,
        organizationId,
        userId,
        'UNIT_UPDATED',
        'RentalUnit',
        unitId,
        input
      );

      return res;
    });

    return {
      ...updated,
      monthlyRent: updated.monthlyRent.toNumber(),
      securityDeposit: updated.securityDeposit.toNumber(),
      maintenanceCharges: updated.maintenanceCharges.toNumber(),
      status: updated.status as RentalUnitStatus,
    };
  }

  async deleteRentalUnit(
    organizationId: string,
    propertyId: string,
    unitId: string,
    userId: string
  ): Promise<void> {
    await this.validateRentalProperty(organizationId, propertyId);

    const unit = await this.prisma.rentalUnit.findFirst({
      where: { id: unitId, propertyId, deletedAt: null },
      include: {
        leases: {
          where: { status: { in: [LeaseStatus.ACTIVE, LeaseStatus.NOTICE] } },
        },
      },
    });

    if (!unit) {
      throw new NotFoundException('Rental unit not found');
    }

    // Safeguard: Block deletion of occupied or active leased units
    if (unit.leases.length > 0) {
      throw new BadRequestException('Cannot delete rental unit containing active or notice leases.');
    }

    await this.prisma.$transaction(async (tx) => {
      const timestamp = new Date();

      await tx.rentalUnit.update({
        where: { id: unitId },
        data: { deletedAt: timestamp },
      });

      await this.writeAuditLog(
        tx,
        organizationId,
        userId,
        'UNIT_DELETED',
        'RentalUnit',
        unitId,
        { unitNumber: unit.unitNumber }
      );
    });
  }

  // ==========================================================================
  // LEASES CRUD
  // ==========================================================================

  async createLease(
    organizationId: string,
    propertyId: string,
    userId: string,
    input: CreateLeaseDto
  ): Promise<LeaseDto> {
    await this.validateRentalProperty(organizationId, propertyId);

    // Validate dates
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    if (start >= end) {
      throw new BadRequestException('End date must be strictly after start date.');
    }

    // Perform database pessimistic locks and validation inside transaction
    const lease = await this.prisma.$transaction(async (tx) => {
      // 1. Pessimistic Lock the Rental Unit Row to block concurrent overlapping requests
      const lockedUnits = await tx.$queryRaw<any[]>`
        SELECT id, "propertyId", "status"
        FROM rental_units
        WHERE id = ${input.rentalUnitId}
        FOR UPDATE
      `;

      if (!lockedUnits || lockedUnits.length === 0) {
        throw new NotFoundException('Rental unit not found.');
      }

      const unit = lockedUnits[0];

      // Verify unit property scope match
      if (unit.propertyId !== propertyId) {
        throw new BadRequestException('Rental unit does not belong to this property.');
      }

      // 2. Validate Tenant exists in the same organization
      const tenant = await tx.tenant.findFirst({
        where: { id: input.tenantId, organizationId, deletedAt: null },
      });
      if (!tenant) {
        throw new NotFoundException('Tenant not found under this organization.');
      }

      // 3. Overlap collision checks
      const overlapping = await tx.lease.findFirst({
        where: {
          rentalUnitId: input.rentalUnitId,
          status: { in: [LeaseStatus.ACTIVE, LeaseStatus.NOTICE] },
          startDate: { lte: end },
          endDate: { gte: start },
        },
      });

      if (overlapping) {
        throw new ConflictException('Lease duration overlaps with an active lease on this unit.');
      }

      // 4. Create the Lease
      const created = await tx.lease.create({
        data: {
          rentalUnitId: input.rentalUnitId,
          tenantId: input.tenantId,
          startDate: start,
          endDate: end,
          monthlyRent: input.monthlyRent,
          securityDeposit: input.securityDeposit,
          noticePeriodDays: input.noticePeriodDays ?? 30,
          lockInMonths: input.lockInMonths ?? 6,
          status: LeaseStatus.ACTIVE, // Created directly as ACTIVE per specifications
          terms: input.terms ?? null,
        },
      });

      // 5. Automatically transition Unit status to OCCUPIED
      await tx.rentalUnit.update({
        where: { id: input.rentalUnitId },
        data: { status: RentalUnitStatus.OCCUPIED },
      });

      // 6. Audit Trail
      await this.writeAuditLog(
        tx,
        organizationId,
        userId,
        'LEASE_CREATED',
        'Lease',
        created.id,
        {
          startDate: created.startDate,
          endDate: created.endDate,
          monthlyRent: created.monthlyRent,
          unitId: created.rentalUnitId,
        }
      );

      return created;
    });

    return {
      ...lease,
      monthlyRent: lease.monthlyRent.toNumber(),
      securityDeposit: lease.securityDeposit.toNumber(),
      status: lease.status as LeaseStatus,
    };
  }

  async listLeases(organizationId: string, propertyId: string, unitId?: string): Promise<LeaseDto[]> {
    await this.validateRentalProperty(organizationId, propertyId);

    const leases = await this.prisma.lease.findMany({
      where: {
        rentalUnit: {
          propertyId,
          id: unitId || undefined,
          deletedAt: null,
        },
      },
      include: {
        escalations: {
          orderBy: { effectiveDate: 'asc' },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    return leases.map((l) => ({
      ...l,
      monthlyRent: l.monthlyRent.toNumber(),
      securityDeposit: l.securityDeposit.toNumber(),
      status: l.status as LeaseStatus,
      escalations: l.escalations.map((e) => ({
        ...e,
        escalatedAmount: e.escalatedAmount.toNumber(),
      })),
    }));
  }

  async getLeaseById(organizationId: string, propertyId: string, leaseId: string): Promise<LeaseDto> {
    await this.validateRentalProperty(organizationId, propertyId);

    const l = await this.prisma.lease.findFirst({
      where: {
        id: leaseId,
        rentalUnit: {
          propertyId,
          deletedAt: null,
        },
      },
      include: {
        escalations: {
          orderBy: { effectiveDate: 'asc' },
        },
      },
    });

    if (!l) {
      throw new NotFoundException('Lease not found');
    }

    return {
      ...l,
      monthlyRent: l.monthlyRent.toNumber(),
      securityDeposit: l.securityDeposit.toNumber(),
      status: l.status as LeaseStatus,
      escalations: l.escalations.map((e) => ({
        ...e,
        escalatedAmount: e.escalatedAmount.toNumber(),
      })),
    };
  }

  async updateLease(
    organizationId: string,
    propertyId: string,
    leaseId: string,
    userId: string,
    input: UpdateLeaseDto
  ): Promise<LeaseDto> {
    await this.validateRentalProperty(organizationId, propertyId);

    const lease = await this.prisma.lease.findFirst({
      where: {
        id: leaseId,
        rentalUnit: { propertyId, deletedAt: null },
      },
    });

    if (!lease) {
      throw new NotFoundException('Lease not found');
    }

    const currentStatus = lease.status as LeaseStatus;

    // Enforce state transitions server-side
    if (input.status !== undefined && input.status !== currentStatus) {
      const targetStatus = input.status;

      // Terminal state protection
      if (currentStatus === LeaseStatus.TERMINATED || currentStatus === LeaseStatus.EXPIRED) {
        throw new BadRequestException('Cannot modify status of a terminated or expired lease.');
      }

      // Check transition rules
      const valid =
        (currentStatus === LeaseStatus.DRAFT && (targetStatus === LeaseStatus.ACTIVE || targetStatus === LeaseStatus.TERMINATED)) ||
        (currentStatus === LeaseStatus.ACTIVE && (targetStatus === LeaseStatus.NOTICE || targetStatus === LeaseStatus.TERMINATED)) ||
        (currentStatus === LeaseStatus.NOTICE && (targetStatus === LeaseStatus.TERMINATED || targetStatus === LeaseStatus.EXPIRED));

      if (!valid) {
        throw new BadRequestException(`Invalid lifecycle transition from ${currentStatus} to ${targetStatus}`);
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.lease.update({
        where: { id: leaseId },
        data: {
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          monthlyRent: input.monthlyRent !== undefined ? input.monthlyRent : undefined,
          securityDeposit: input.securityDeposit !== undefined ? input.securityDeposit : undefined,
          noticePeriodDays: input.noticePeriodDays !== undefined ? input.noticePeriodDays : undefined,
          lockInMonths: input.lockInMonths !== undefined ? input.lockInMonths : undefined,
          status: input.status !== undefined ? input.status : undefined,
          terms: input.terms !== undefined ? input.terms : undefined,
        },
      });

      // Recalculate RentalUnit status if lease transitions to TERMINATED or EXPIRED
      if (input.status === LeaseStatus.TERMINATED || input.status === LeaseStatus.EXPIRED) {
        // Double-check if there are any other active/notice leases currently running
        const otherActive = await tx.lease.findFirst({
          where: {
            rentalUnitId: lease.rentalUnitId,
            id: { not: leaseId },
            status: { in: [LeaseStatus.ACTIVE, LeaseStatus.NOTICE] },
          },
        });

        if (!otherActive) {
          await tx.rentalUnit.update({
            where: { id: lease.rentalUnitId },
            data: { status: RentalUnitStatus.AVAILABLE },
          });
        }
      } else if (input.status === LeaseStatus.ACTIVE) {
        await tx.rentalUnit.update({
          where: { id: lease.rentalUnitId },
          data: { status: RentalUnitStatus.OCCUPIED },
        });
      }

      await this.writeAuditLog(
        tx,
        organizationId,
        userId,
        input.status === LeaseStatus.TERMINATED ? 'LEASE_TERMINATED' : 'LEASE_UPDATED',
        'Lease',
        leaseId,
        input
      );

      return res;
    });

    return {
      ...updated,
      monthlyRent: updated.monthlyRent.toNumber(),
      securityDeposit: updated.securityDeposit.toNumber(),
      status: updated.status as LeaseStatus,
    };
  }

  async terminateLease(
    organizationId: string,
    propertyId: string,
    leaseId: string,
    userId: string
  ): Promise<LeaseDto> {
    return this.updateLease(organizationId, propertyId, leaseId, userId, {
      status: LeaseStatus.TERMINATED,
    });
  }

  // ==========================================================================
  // RENT ESCALATIONS
  // ==========================================================================

  async addRentEscalation(
    organizationId: string,
    propertyId: string,
    leaseId: string,
    userId: string,
    input: CreateRentEscalationDto
  ): Promise<RentEscalationDto> {
    await this.validateRentalProperty(organizationId, propertyId);

    const lease = await this.prisma.lease.findFirst({
      where: {
        id: leaseId,
        rentalUnit: { propertyId, deletedAt: null },
      },
    });

    if (!lease) {
      throw new NotFoundException('Lease not found');
    }

    // Protection: Block escalations on terminated/expired leases
    if (lease.status === LeaseStatus.TERMINATED || lease.status === LeaseStatus.EXPIRED) {
      throw new BadRequestException('Cannot add rent escalation schedule to a terminated or expired lease.');
    }

    const escalation = await this.prisma.$transaction(async (tx) => {
      const rent = lease.monthlyRent.toNumber();
      const escalatedAmount = rent * (1 + input.percentage / 100);

      const created = await tx.rentEscalation.create({
        data: {
          leaseId,
          effectiveDate: new Date(input.effectiveDate),
          percentage: input.percentage,
          escalatedAmount,
          notes: input.notes ?? null,
        },
      });

      await this.writeAuditLog(
        tx,
        organizationId,
        userId,
        'ESCALATION_ADDED',
        'RentEscalation',
        created.id,
        { percentage: created.percentage, escalatedAmount: created.escalatedAmount }
      );

      return created;
    });

    return {
      ...escalation,
      escalatedAmount: escalation.escalatedAmount.toNumber(),
    };
  }

  async deleteRentEscalation(
    organizationId: string,
    propertyId: string,
    leaseId: string,
    escalationId: string,
    userId: string
  ): Promise<void> {
    await this.validateRentalProperty(organizationId, propertyId);

    const escalation = await this.prisma.rentEscalation.findFirst({
      where: {
        id: escalationId,
        leaseId,
        lease: {
          rentalUnit: { propertyId, deletedAt: null },
        },
      },
    });

    if (!escalation) {
      throw new NotFoundException('Rent escalation not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.rentEscalation.delete({
        where: { id: escalationId },
      });

      await this.writeAuditLog(
        tx,
        organizationId,
        userId,
        'ESCALATION_DELETED',
        'RentEscalation',
        escalationId,
        { percentage: escalation.percentage }
      );
    });
  }
}
