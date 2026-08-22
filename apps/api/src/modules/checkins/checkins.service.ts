import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CheckInDto,
  CreatePgCheckInDto,
  CreateRentalCheckInDto,
  OnboardingStatusDto,
  CancelCheckInDto,
  CheckInStatus,
  PropertyType,
  BedStatus,
  LeaseStatus,
  TenantStatus,
  KycVerificationStatus,
} from '@propertyos/types';

@Injectable()
export class CheckinsService {
  constructor(private readonly prisma: PrismaService) {}

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
    metadata?: Record<string, any>
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        organizationId,
        userId,
        action,
        resourceType,
        resourceId,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
  }

  /**
   * Helper to validate tenant access under the current organization
   */
  private async validateTenant(organizationId: string, tenantId: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        id: tenantId,
        organizationId,
        deletedAt: null,
      },
      include: {
        documents: true,
        stayHistories: {
          where: { checkOutDate: null },
        },
        leases: {
          where: { status: { in: [LeaseStatus.ACTIVE, LeaseStatus.NOTICE] } },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found under this organization');
    }

    if (tenant.status === TenantStatus.ARCHIVED) {
      throw new BadRequestException('Archived tenants cannot be checked in');
    }

    return tenant;
  }

  /**
   * Helper to validate property access under the current organization
   */
  private async validateProperty(organizationId: string, propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: {
        id: propertyId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found under this organization');
    }

    return property;
  }

  /**
   * Evaluates tenant onboarding and KYC readiness checklist
   */
  async getOnboardingStatus(
    organizationId: string,
    tenantId: string,
    propertyId?: string
  ): Promise<OnboardingStatusDto> {
    const tenant = await this.validateTenant(organizationId, tenantId);

    const missingItems: string[] = [];

    // 1. Profile completeness
    const tenantProfileComplete = Boolean(
      tenant.firstName &&
        tenant.lastName &&
        tenant.phone &&
        tenant.permanentAddress &&
        tenant.permanentCity &&
        tenant.permanentState &&
        tenant.permanentPostalCode
    );
    if (!tenantProfileComplete) {
      missingItems.push('Incomplete tenant profile information (address, city, state, postal code)');
    }

    // 2. Emergency contact completeness
    const emergencyContactComplete = Boolean(
      tenant.emergencyContactName &&
        tenant.emergencyContactPhone &&
        tenant.emergencyContactRelation
    );
    if (!emergencyContactComplete) {
      missingItems.push('Missing emergency contact information (name, phone, relation)');
    }

    // 3. KYC Verification Status
    const kycRequired = true;
    const verifiedDocs = tenant.documents.filter(
      (d) => d.verificationStatus === KycVerificationStatus.VERIFIED
    );
    const kycVerified = verifiedDocs.length > 0;
    if (!kycVerified) {
      missingItems.push('No verified KYC identity documents found for this tenant');
    }

    // 4. Current occupancy check
    const activePgStayPresent = tenant.stayHistories.length > 0;
    const activeLeasePresent = tenant.leases.length > 0;

    let bedAssigned = false;
    if (propertyId) {
      const property = await this.validateProperty(organizationId, propertyId);
      if (property.propertyType === PropertyType.PG) {
        // Bed will be assigned during check-in creation
        bedAssigned = false;
      } else {
        bedAssigned = activeLeasePresent;
      }
    }

    const readyForCheckIn =
      tenantProfileComplete &&
      emergencyContactComplete &&
      kycVerified &&
      !activePgStayPresent;

    return {
      tenantId: tenant.id,
      tenantProfileComplete,
      emergencyContactComplete,
      kycRequired,
      kycVerified,
      activePgStayPresent,
      activeLeasePresent,
      bedAssigned,
      readyForCheckIn,
      missingItems,
    };
  }

  /**
   * Initiate a Check-In for a PG property
   */
  async createPgCheckIn(
    organizationId: string,
    propertyId: string,
    userId: string,
    input: CreatePgCheckInDto
  ): Promise<CheckInDto> {
    const property = await this.validateProperty(organizationId, propertyId);
    if (property.propertyType !== PropertyType.PG) {
      throw new BadRequestException('Cannot use PG check-in workflow for a RENTAL_HOUSE property');
    }

    const tenant = await this.validateTenant(organizationId, input.tenantId);

    // Verify tenant has no active PG stay
    if (tenant.stayHistories.length > 0) {
      throw new ConflictException('Tenant already has an active PG stay');
    }

    // Verify tenant onboarding readiness
    const readiness = await this.getOnboardingStatus(organizationId, input.tenantId, propertyId);
    if (!readiness.tenantProfileComplete || !readiness.emergencyContactComplete || !readiness.kycVerified) {
      throw new BadRequestException(
        `Tenant is not ready for check-in: ${readiness.missingItems.join(', ')}`
      );
    }

    // Validate bed belongs to property
    const bed = await this.prisma.bed.findFirst({
      where: {
        id: input.bedId,
        room: {
          propertyId,
        },
        deletedAt: null,
      },
      include: {
        room: {
          include: {
            floor: true,
          },
        },
      },
    });

    if (!bed) {
      throw new NotFoundException('Bed not found in the specified property');
    }

    if (bed.status !== BedStatus.AVAILABLE) {
      throw new ConflictException(`Bed is not available for check-in (current status: ${bed.status})`);
    }

    const checkIn = await this.prisma.$transaction(async (tx) => {
      const created = await tx.checkIn.create({
        data: {
          organizationId,
          propertyId,
          tenantId: input.tenantId,
          bedId: input.bedId,
          checkInDate: new Date(input.checkInDate),
          expectedCheckoutDate: input.expectedCheckoutDate ? new Date(input.expectedCheckoutDate) : null,
          status: CheckInStatus.INITIATED,
          emergencyContactConfirmed: input.emergencyContactConfirmed ?? true,
          kycConfirmed: readiness.kycVerified,
          notes: input.notes ?? null,
        },
        include: {
          tenant: {
            select: { id: true, firstName: true, lastName: true, phone: true, email: true },
          },
          property: {
            select: { id: true, name: true, code: true, propertyType: true },
          },
          bed: {
            include: {
              room: {
                include: { floor: true },
              },
            },
          },
        },
      });

      await this.writeAuditLog(
        tx,
        organizationId,
        userId,
        'TENANT_CHECK_IN_INITIATED',
        'CheckIn',
        created.id,
        {
          tenantId: input.tenantId,
          propertyId,
          bedId: input.bedId,
          checkInDate: created.checkInDate,
        }
      );

      return created;
    });

    return checkIn as unknown as CheckInDto;
  }

  /**
   * Initiate a Check-In for a RENTAL_HOUSE property
   */
  async createRentalCheckIn(
    organizationId: string,
    propertyId: string,
    userId: string,
    input: CreateRentalCheckInDto
  ): Promise<CheckInDto> {
    const property = await this.validateProperty(organizationId, propertyId);
    if (property.propertyType !== PropertyType.RENTAL_HOUSE) {
      throw new BadRequestException('Cannot use Whole-Unit check-in workflow for a PG property');
    }

    const tenant = await this.validateTenant(organizationId, input.tenantId);

    // Verify lease belongs to property and tenant, and is ACTIVE
    const lease = await this.prisma.lease.findFirst({
      where: {
        id: input.leaseId,
        tenantId: input.tenantId,
        rentalUnit: {
          propertyId,
        },
        status: LeaseStatus.ACTIVE,
      },
      include: {
        rentalUnit: true,
      },
    });

    if (!lease) {
      throw new NotFoundException('Active lease not found for this tenant and property');
    }

    // Verify tenant onboarding readiness
    const readiness = await this.getOnboardingStatus(organizationId, input.tenantId, propertyId);
    if (!readiness.tenantProfileComplete || !readiness.emergencyContactComplete || !readiness.kycVerified) {
      throw new BadRequestException(
        `Tenant is not ready for check-in: ${readiness.missingItems.join(', ')}`
      );
    }

    const checkIn = await this.prisma.$transaction(async (tx) => {
      const created = await tx.checkIn.create({
        data: {
          organizationId,
          propertyId,
          tenantId: input.tenantId,
          rentalUnitId: lease.rentalUnitId,
          leaseId: lease.id,
          checkInDate: new Date(input.checkInDate),
          expectedCheckoutDate: input.expectedCheckoutDate ? new Date(input.expectedCheckoutDate) : lease.endDate,
          status: CheckInStatus.INITIATED,
          emergencyContactConfirmed: input.emergencyContactConfirmed ?? true,
          kycConfirmed: readiness.kycVerified,
          notes: input.notes ?? null,
        },
        include: {
          tenant: {
            select: { id: true, firstName: true, lastName: true, phone: true, email: true },
          },
          property: {
            select: { id: true, name: true, code: true, propertyType: true },
          },
          rentalUnit: {
            select: { id: true, unitNumber: true },
          },
          lease: {
            select: { id: true, startDate: true, endDate: true, monthlyRent: true, status: true },
          },
        },
      });

      await this.writeAuditLog(
        tx,
        organizationId,
        userId,
        'TENANT_CHECK_IN_INITIATED',
        'CheckIn',
        created.id,
        {
          tenantId: input.tenantId,
          propertyId,
          rentalUnitId: lease.rentalUnitId,
          leaseId: lease.id,
          checkInDate: created.checkInDate,
        }
      );

      return created;
    });

    return {
      ...checkIn,
      lease: checkIn.lease
        ? {
            ...checkIn.lease,
            monthlyRent: checkIn.lease.monthlyRent.toNumber(),
          }
        : null,
    } as unknown as CheckInDto;
  }

  /**
   * Transition check-in status: INITIATED -> READY
   */
  async markCheckInReady(
    organizationId: string,
    checkInId: string,
    userId: string
  ): Promise<CheckInDto> {
    const checkIn = await this.prisma.checkIn.findFirst({
      where: {
        id: checkInId,
        organizationId,
      },
      include: {
        property: true,
        tenant: true,
      },
    });

    if (!checkIn) {
      throw new NotFoundException('Check-in record not found');
    }

    if (checkIn.status === CheckInStatus.CHECKED_IN) {
      throw new BadRequestException('Check-in is already completed');
    }

    if (checkIn.status === CheckInStatus.CANCELLED) {
      throw new BadRequestException('Cannot mark a cancelled check-in as ready');
    }

    // Re-verify onboarding readiness
    const readiness = await this.getOnboardingStatus(organizationId, checkIn.tenantId, checkIn.propertyId);
    if (!readiness.tenantProfileComplete || !readiness.emergencyContactComplete || !readiness.kycVerified) {
      throw new BadRequestException(
        `Tenant is not ready for check-in: ${readiness.missingItems.join(', ')}`
      );
    }

    if (checkIn.property.propertyType === PropertyType.PG && checkIn.bedId) {
      const bed = await this.prisma.bed.findFirst({
        where: { id: checkIn.bedId, deletedAt: null },
      });
      if (!bed || bed.status !== BedStatus.AVAILABLE) {
        throw new ConflictException('Selected bed is no longer available');
      }
    } else if (checkIn.leaseId) {
      const lease = await this.prisma.lease.findFirst({
        where: { id: checkIn.leaseId, status: LeaseStatus.ACTIVE },
      });
      if (!lease) {
        throw new ConflictException('Lease is no longer active');
      }
    }

    const updated = await this.prisma.checkIn.update({
      where: { id: checkInId },
      data: {
        status: CheckInStatus.READY,
        kycConfirmed: readiness.kycVerified,
        emergencyContactConfirmed: readiness.emergencyContactComplete,
      },
      include: {
        tenant: {
          select: { id: true, firstName: true, lastName: true, phone: true, email: true },
        },
        property: {
          select: { id: true, name: true, code: true, propertyType: true },
        },
        bed: {
          include: {
            room: {
              include: { floor: true },
            },
          },
        },
        rentalUnit: {
          select: { id: true, unitNumber: true },
        },
        lease: {
          select: { id: true, startDate: true, endDate: true, monthlyRent: true, status: true },
        },
      },
    });

    return {
      ...updated,
      lease: updated.lease
        ? {
            ...updated.lease,
            monthlyRent: updated.lease.monthlyRent.toNumber(),
          }
        : null,
    } as unknown as CheckInDto;
  }

  /**
   * Finalize and complete check-in: READY/INITIATED -> CHECKED_IN
   * Executes transactional concurrency-safe PG bed lock and occupancy update.
   */
  async completeCheckIn(
    organizationId: string,
    checkInId: string,
    userId: string
  ): Promise<CheckInDto> {
    const checkIn = await this.prisma.checkIn.findFirst({
      where: {
        id: checkInId,
        organizationId,
      },
      include: {
        property: true,
        tenant: true,
      },
    });

    if (!checkIn) {
      throw new NotFoundException('Check-in record not found');
    }

    if (checkIn.status === CheckInStatus.CHECKED_IN) {
      throw new BadRequestException('Check-in is already completed');
    }

    if (checkIn.status === CheckInStatus.CANCELLED) {
      throw new BadRequestException('Cannot complete a cancelled check-in');
    }

    // Re-verify onboarding readiness
    const readiness = await this.getOnboardingStatus(organizationId, checkIn.tenantId, checkIn.propertyId);
    if (!readiness.tenantProfileComplete || !readiness.emergencyContactComplete || !readiness.kycVerified) {
      throw new BadRequestException(
        `Tenant onboarding is incomplete: ${readiness.missingItems.join(', ')}`
      );
    }

    const completed = await this.prisma.$transaction(async (tx) => {
      let stayHistoryId: string | null = null;

      if (checkIn.property.propertyType === PropertyType.PG) {
        if (!checkIn.bedId) {
          throw new BadRequestException('PG check-in must have a designated bedId');
        }

        // 1. PostgreSQL row-level lock on bed
        await tx.$queryRawUnsafe(
          'SELECT id FROM beds WHERE id = $1 FOR UPDATE',
          checkIn.bedId
        );

        // 2. Re-verify bed status
        const bed = await tx.bed.findFirst({
          where: { id: checkIn.bedId, deletedAt: null },
        });

        if (!bed) {
          throw new NotFoundException('Bed not found');
        }

        if (bed.status !== BedStatus.AVAILABLE) {
          throw new ConflictException(`Bed is not available (current status: ${bed.status})`);
        }

        // 3. Re-verify tenant has no active stay
        const existingStay = await tx.tenantStayHistory.findFirst({
          where: {
            tenantId: checkIn.tenantId,
            checkOutDate: null,
          },
        });

        if (existingStay) {
          throw new ConflictException('Tenant already has an active stay in another bed');
        }

        // 4. Create TenantStayHistory
        const stay = await tx.tenantStayHistory.create({
          data: {
            tenantId: checkIn.tenantId,
            bedId: checkIn.bedId,
            checkInDate: checkIn.checkInDate,
            monthlyRent: bed.monthlyRent,
          },
        });
        stayHistoryId = stay.id;

        // 5. Update Bed status: AVAILABLE -> OCCUPIED
        await tx.bed.update({
          where: { id: checkIn.bedId },
          data: { status: BedStatus.OCCUPIED },
        });
      } else {
        // Whole-unit check-in
        if (!checkIn.leaseId) {
          throw new BadRequestException('Whole-unit check-in must reference an active leaseId');
        }

        const lease = await tx.lease.findFirst({
          where: {
            id: checkIn.leaseId,
            tenantId: checkIn.tenantId,
            status: LeaseStatus.ACTIVE,
          },
        });

        if (!lease) {
          throw new ConflictException('Active lease is no longer valid');
        }
      }

      // 6. Update Tenant status from PROSPECT to ACTIVE if applicable
      const tenant = await tx.tenant.findUnique({
        where: { id: checkIn.tenantId },
      });
      if (tenant && tenant.status === TenantStatus.PROSPECT) {
        await tx.tenant.update({
          where: { id: checkIn.tenantId },
          data: { status: TenantStatus.ACTIVE },
        });
      }

      // 7. Update CheckIn record to CHECKED_IN
      const updatedCheckIn = await tx.checkIn.update({
        where: { id: checkInId },
        data: {
          status: CheckInStatus.CHECKED_IN,
          stayHistoryId,
          completedAt: new Date(),
        },
        include: {
          tenant: {
            select: { id: true, firstName: true, lastName: true, phone: true, email: true },
          },
          property: {
            select: { id: true, name: true, code: true, propertyType: true },
          },
          bed: {
            include: {
              room: {
                include: { floor: true },
              },
            },
          },
          rentalUnit: {
            select: { id: true, unitNumber: true },
          },
          lease: {
            select: { id: true, startDate: true, endDate: true, monthlyRent: true, status: true },
          },
        },
      });

      // 8. Record audit log
      await this.writeAuditLog(
        tx,
        organizationId,
        userId,
        'TENANT_CHECKED_IN',
        'CheckIn',
        updatedCheckIn.id,
        {
          tenantId: checkIn.tenantId,
          propertyId: checkIn.propertyId,
          bedId: checkIn.bedId,
          leaseId: checkIn.leaseId,
          stayHistoryId,
          completedAt: updatedCheckIn.completedAt,
        }
      );

      return updatedCheckIn;
    });

    return {
      ...completed,
      lease: completed.lease
        ? {
            ...completed.lease,
            monthlyRent: completed.lease.monthlyRent.toNumber(),
          }
        : null,
    } as unknown as CheckInDto;
  }

  /**
   * Cancel an INITIATED or READY check-in
   */
  async cancelCheckIn(
    organizationId: string,
    checkInId: string,
    userId: string,
    input?: CancelCheckInDto
  ): Promise<CheckInDto> {
    const checkIn = await this.prisma.checkIn.findFirst({
      where: {
        id: checkInId,
        organizationId,
      },
    });

    if (!checkIn) {
      throw new NotFoundException('Check-in record not found');
    }

    if (checkIn.status === CheckInStatus.CHECKED_IN) {
      throw new BadRequestException(
        'Completed check-ins cannot be cancelled. Use the checkout workflow to vacate a tenant.'
      );
    }

    if (checkIn.status === CheckInStatus.CANCELLED) {
      throw new BadRequestException('Check-in is already cancelled');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const cancelled = await tx.checkIn.update({
        where: { id: checkInId },
        data: {
          status: CheckInStatus.CANCELLED,
          cancelledAt: new Date(),
          notes: input?.reason
            ? checkIn.notes
              ? `${checkIn.notes}\nCancellation reason: ${input.reason}`
              : `Cancellation reason: ${input.reason}`
            : checkIn.notes,
        },
        include: {
          tenant: {
            select: { id: true, firstName: true, lastName: true, phone: true, email: true },
          },
          property: {
            select: { id: true, name: true, code: true, propertyType: true },
          },
          bed: {
            include: {
              room: {
                include: { floor: true },
              },
            },
          },
          rentalUnit: {
            select: { id: true, unitNumber: true },
          },
          lease: {
            select: { id: true, startDate: true, endDate: true, monthlyRent: true, status: true },
          },
        },
      });

      await this.writeAuditLog(
        tx,
        organizationId,
        userId,
        'CHECK_IN_CANCELLED',
        'CheckIn',
        cancelled.id,
        {
          tenantId: checkIn.tenantId,
          propertyId: checkIn.propertyId,
          reason: input?.reason ?? null,
          cancelledAt: cancelled.cancelledAt,
        }
      );

      return cancelled;
    });

    return {
      ...updated,
      lease: updated.lease
        ? {
            ...updated.lease,
            monthlyRent: updated.lease.monthlyRent.toNumber(),
          }
        : null,
    } as unknown as CheckInDto;
  }

  /**
   * List check-in records with multi-tenant scoping and filters
   */
  async listCheckIns(
    organizationId: string,
    filter?: {
      propertyId?: string;
      tenantId?: string;
      status?: CheckInStatus;
    }
  ): Promise<CheckInDto[]> {
    const where: any = {
      organizationId,
    };

    if (filter?.propertyId) {
      where.propertyId = filter.propertyId;
    }

    if (filter?.tenantId) {
      where.tenantId = filter.tenantId;
    }

    if (filter?.status) {
      where.status = filter.status;
    }

    const checkIns = await this.prisma.checkIn.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        tenant: {
          select: { id: true, firstName: true, lastName: true, phone: true, email: true },
        },
        property: {
          select: { id: true, name: true, code: true, propertyType: true },
        },
        bed: {
          include: {
            room: {
              include: { floor: true },
            },
          },
        },
        rentalUnit: {
          select: { id: true, unitNumber: true },
        },
        lease: {
          select: { id: true, startDate: true, endDate: true, monthlyRent: true, status: true },
        },
      },
    });

    return checkIns.map((c) => ({
      ...c,
      lease: c.lease
        ? {
            ...c.lease,
            monthlyRent: c.lease.monthlyRent.toNumber(),
          }
        : null,
    })) as unknown as CheckInDto[];
  }

  /**
   * Get single check-in details by ID
   */
  async getCheckInById(organizationId: string, checkInId: string): Promise<CheckInDto> {
    const checkIn = await this.prisma.checkIn.findFirst({
      where: {
        id: checkInId,
        organizationId,
      },
      include: {
        tenant: {
          select: { id: true, firstName: true, lastName: true, phone: true, email: true },
        },
        property: {
          select: { id: true, name: true, code: true, propertyType: true },
        },
        bed: {
          include: {
            room: {
              include: { floor: true },
            },
          },
        },
        rentalUnit: {
          select: { id: true, unitNumber: true },
        },
        lease: {
          select: { id: true, startDate: true, endDate: true, monthlyRent: true, status: true },
        },
      },
    });

    if (!checkIn) {
      throw new NotFoundException('Check-in record not found');
    }

    return {
      ...checkIn,
      lease: checkIn.lease
        ? {
            ...checkIn.lease,
            monthlyRent: checkIn.lease.monthlyRent.toNumber(),
          }
        : null,
    } as unknown as CheckInDto;
  }
}
