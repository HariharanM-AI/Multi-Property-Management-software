import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SettlementService } from './settlement.service';
import {
  CheckoutStatus,
  SettlementStatus,
  CreateCheckoutDto,
  UpdateSettlementDto,
  CancelCheckoutDto,
  PropertyType,
  BedStatus,
  RentalUnitStatus,
  LeaseStatus,
  TenantStatus,
} from '@propertyos/types';
import { Prisma } from '@prisma/client';

@Injectable()
export class CheckoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settlementService: SettlementService
  ) {}

  /**
   * Helper to format Prisma Checkout entity into DTO
   */
  private formatCheckout(checkout: any) {
    return {
      id: checkout.id,
      organizationId: checkout.organizationId,
      tenantId: checkout.tenantId,
      propertyId: checkout.propertyId,
      checkInId: checkout.checkInId,
      stayHistoryId: checkout.stayHistoryId,
      leaseId: checkout.leaseId,
      rentalUnitId: checkout.rentalUnitId,
      bedId: checkout.bedId,
      checkoutDate: checkout.checkoutDate,
      status: checkout.status,
      reason: checkout.reason,
      completedAt: checkout.completedAt,
      cancelledAt: checkout.cancelledAt,
      createdAt: checkout.createdAt,
      updatedAt: checkout.updatedAt,
      settlement: checkout.settlement
        ? {
            id: checkout.settlement.id,
            organizationId: checkout.settlement.organizationId,
            tenantId: checkout.settlement.tenantId,
            checkoutId: checkout.settlement.checkoutId,
            securityDeposit: Number(checkout.settlement.securityDeposit),
            outstandingRent: Number(checkout.settlement.outstandingRent),
            maintenanceCharges: Number(checkout.settlement.maintenanceCharges),
            deductions: Number(checkout.settlement.deductions),
            refundableAmount: Number(checkout.settlement.refundableAmount),
            amountDue: Number(checkout.settlement.amountDue),
            amountRefundable: Number(checkout.settlement.amountRefundable),
            status: checkout.settlement.status,
            notes: checkout.settlement.notes,
            createdAt: checkout.settlement.createdAt,
            updatedAt: checkout.settlement.updatedAt,
          }
        : null,
      tenant: checkout.tenant
        ? {
            id: checkout.tenant.id,
            firstName: checkout.tenant.firstName,
            lastName: checkout.tenant.lastName,
            phone: checkout.tenant.phone,
            email: checkout.tenant.email,
            status: checkout.tenant.status,
          }
        : undefined,
      property: checkout.property
        ? {
            id: checkout.property.id,
            code: checkout.property.code,
            name: checkout.property.name,
            propertyType: checkout.property.propertyType,
          }
        : undefined,
      bed: checkout.bed
        ? {
            id: checkout.bed.id,
            bedNumber: checkout.bed.bedNumber,
            room: checkout.bed.room
              ? {
                  id: checkout.bed.room.id,
                  roomNumber: checkout.bed.room.roomNumber,
                  floor: checkout.bed.room.floor
                    ? {
                        id: checkout.bed.room.floor.id,
                        floorNumber: checkout.bed.room.floor.floorNumber,
                      }
                    : undefined,
                }
              : undefined,
          }
        : null,
      rentalUnit: checkout.rentalUnit
        ? {
            id: checkout.rentalUnit.id,
            unitNumber: checkout.rentalUnit.unitNumber,
          }
        : null,
      lease: checkout.lease
        ? {
            id: checkout.lease.id,
            startDate: checkout.lease.startDate,
            endDate: checkout.lease.endDate,
            monthlyRent: Number(checkout.lease.monthlyRent),
            securityDeposit: Number(checkout.lease.securityDeposit),
            status: checkout.lease.status,
          }
        : null,
    };
  }

  /**
   * Initiates a Checkout and creates initial Draft Settlement
   */
  async createCheckout(
    organizationId: string,
    propertyId: string,
    dto: CreateCheckoutDto,
    userId?: string
  ) {
    // 1. Verify property exists and belongs to organization
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, organizationId, deletedAt: null },
    });
    if (!property) {
      throw new NotFoundException('Property not found in organization');
    }

    // 2. Verify tenant exists and belongs to organization
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: dto.tenantId, organizationId, deletedAt: null },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found in organization');
    }

    const checkoutDate = new Date(dto.checkoutDate);
    if (isNaN(checkoutDate.getTime())) {
      throw new BadRequestException('Invalid checkout date format');
    }

    let activeStayHistoryId: string | null = null;
    let activeBedId: string | null = null;
    let activeLeaseId: string | null = null;
    let activeRentalUnitId: string | null = null;
    let activeCheckInId: string | null = dto.checkInId || null;
    let initialSecurityDeposit = new Prisma.Decimal(0);
    let originalCheckInDate: Date | null = null;

    if (property.propertyType === PropertyType.PG) {
      // Find active stay history for this tenant
      const activeStay = await this.prisma.tenantStayHistory.findFirst({
        where: {
          tenantId: tenant.id,
          checkOutDate: null,
          bed: { room: { propertyId } },
        },
        include: { bed: true },
        orderBy: { checkInDate: 'desc' },
      });

      if (!activeStay) {
        throw new BadRequestException('Tenant has no active PG stay in this property');
      }

      if (activeStay.bed.status !== BedStatus.OCCUPIED) {
        throw new BadRequestException('Bed is not currently marked as occupied');
      }

      activeStayHistoryId = activeStay.id;
      activeBedId = activeStay.bedId;
      originalCheckInDate = activeStay.checkInDate;

      // Check for matching CheckIn record
      if (!activeCheckInId) {
        const checkIn = await this.prisma.checkIn.findFirst({
          where: {
            organizationId,
            propertyId,
            tenantId: tenant.id,
            bedId: activeBedId,
            status: 'CHECKED_IN',
          },
          orderBy: { createdAt: 'desc' },
        });
        if (checkIn) {
          activeCheckInId = checkIn.id;
        }
      }
    } else if (property.propertyType === PropertyType.RENTAL_HOUSE) {
      // Find active lease for whole-unit rental
      const activeLease = await this.prisma.lease.findFirst({
        where: {
          tenantId: tenant.id,
          status: LeaseStatus.ACTIVE,
          rentalUnit: { propertyId },
        },
        include: { rentalUnit: true },
        orderBy: { startDate: 'desc' },
      });

      if (!activeLease) {
        throw new BadRequestException('Tenant has no active lease in this property');
      }

      if (activeLease.rentalUnit.status !== RentalUnitStatus.OCCUPIED) {
        throw new BadRequestException('Rental unit is not currently marked as occupied');
      }

      activeLeaseId = activeLease.id;
      activeRentalUnitId = activeLease.rentalUnitId;
      initialSecurityDeposit = activeLease.securityDeposit;
      originalCheckInDate = activeLease.startDate;

      if (!activeCheckInId) {
        const checkIn = await this.prisma.checkIn.findFirst({
          where: {
            organizationId,
            propertyId,
            tenantId: tenant.id,
            rentalUnitId: activeRentalUnitId,
            status: 'CHECKED_IN',
          },
          orderBy: { createdAt: 'desc' },
        });
        if (checkIn) {
          activeCheckInId = checkIn.id;
        }
      }
    }

    // Directive 12: checkoutDate must not be earlier than the original check-in date
    if (originalCheckInDate && checkoutDate < originalCheckInDate) {
      throw new BadRequestException('Checkout date cannot be earlier than check-in date');
    }

    // Check for existing pending checkout (idempotency / duplicate check)
    const existingCheckout = await this.prisma.checkout.findFirst({
      where: {
        organizationId,
        tenantId: tenant.id,
        propertyId,
        status: { in: [CheckoutStatus.INITIATED, CheckoutStatus.SETTLEMENT_PENDING, CheckoutStatus.READY] },
      },
    });

    if (existingCheckout) {
      throw new ConflictException('An active checkout process is already pending for this tenant');
    }

    // Calculate initial settlement
    const settlementCalc = this.settlementService.calculateSettlement({
      securityDeposit: initialSecurityDeposit,
      outstandingRent: 0,
      maintenanceCharges: 0,
      deductions: 0,
    });

    // Create Checkout + Draft Settlement atomically
    const created = await this.prisma.$transaction(async (tx) => {
      const checkout = await tx.checkout.create({
        data: {
          organizationId,
          tenantId: tenant.id,
          propertyId,
          checkInId: activeCheckInId,
          stayHistoryId: activeStayHistoryId,
          leaseId: activeLeaseId,
          rentalUnitId: activeRentalUnitId,
          bedId: activeBedId,
          checkoutDate,
          status: CheckoutStatus.INITIATED,
          reason: dto.reason || null,
        },
      });

      const settlement = await tx.settlement.create({
        data: {
          organizationId,
          tenantId: tenant.id,
          checkoutId: checkout.id,
          securityDeposit: settlementCalc.securityDeposit,
          outstandingRent: settlementCalc.outstandingRent,
          maintenanceCharges: settlementCalc.maintenanceCharges,
          deductions: settlementCalc.deductions,
          refundableAmount: settlementCalc.refundableAmount,
          amountDue: settlementCalc.amountDue,
          amountRefundable: settlementCalc.amountRefundable,
          status: SettlementStatus.DRAFT,
        },
      });

      // Audit logs
      await tx.auditLog.create({
        data: {
          organizationId,
          userId: userId || null,
          action: 'CHECKOUT_CREATED',
          resourceType: 'CHECKOUT',
          resourceId: checkout.id,
          metadata: {
            tenantId: tenant.id,
            propertyId,
            checkoutDate: checkoutDate.toISOString(),
            settlementId: settlement.id,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          userId: userId || null,
          action: 'SETTLEMENT_CREATED',
          resourceType: 'SETTLEMENT',
          resourceId: settlement.id,
          metadata: {
            checkoutId: checkout.id,
            securityDeposit: Number(settlementCalc.securityDeposit),
            amountRefundable: Number(settlementCalc.amountRefundable),
          },
        },
      });

      return tx.checkout.findUnique({
        where: { id: checkout.id },
        include: {
          settlement: true,
          tenant: true,
          property: true,
          bed: { include: { room: { include: { floor: true } } } },
          rentalUnit: true,
          lease: true,
        },
      });
    });

    return this.formatCheckout(created);
  }

  /**
   * Updates settlement deductions and outstanding amounts before finalization
   */
  async updateSettlement(
    organizationId: string,
    checkoutId: string,
    dto: UpdateSettlementDto,
    userId?: string
  ) {
    const checkout = await this.prisma.checkout.findFirst({
      where: { id: checkoutId, organizationId },
      include: { settlement: true },
    });

    if (!checkout) {
      throw new NotFoundException('Checkout not found');
    }

    if (checkout.status === CheckoutStatus.COMPLETED) {
      throw new BadRequestException('Cannot update settlement for a completed checkout');
    }

    if (checkout.status === CheckoutStatus.CANCELLED) {
      throw new BadRequestException('Cannot update settlement for a cancelled checkout');
    }

    const currentSettlement = checkout.settlement;
    if (!currentSettlement) {
      throw new NotFoundException('Settlement record not found for checkout');
    }

    const outstandingRent =
      dto.outstandingRent !== undefined ? dto.outstandingRent : currentSettlement.outstandingRent;
    const maintenanceCharges =
      dto.maintenanceCharges !== undefined
        ? dto.maintenanceCharges
        : currentSettlement.maintenanceCharges;
    const deductions =
      dto.deductions !== undefined ? dto.deductions : currentSettlement.deductions;

    const recalculated = this.settlementService.calculateSettlement({
      securityDeposit: currentSettlement.securityDeposit,
      outstandingRent,
      maintenanceCharges,
      deductions,
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const settlement = await tx.settlement.update({
        where: { id: currentSettlement.id },
        data: {
          outstandingRent: recalculated.outstandingRent,
          maintenanceCharges: recalculated.maintenanceCharges,
          deductions: recalculated.deductions,
          refundableAmount: recalculated.refundableAmount,
          amountDue: recalculated.amountDue,
          amountRefundable: recalculated.amountRefundable,
          notes: dto.notes !== undefined ? dto.notes : currentSettlement.notes,
        },
      });

      // Update checkout status to SETTLEMENT_PENDING if currently INITIATED
      if (checkout.status === CheckoutStatus.INITIATED) {
        await tx.checkout.update({
          where: { id: checkout.id },
          data: { status: CheckoutStatus.SETTLEMENT_PENDING },
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId,
          userId: userId || null,
          action: 'SETTLEMENT_UPDATED',
          resourceType: 'SETTLEMENT',
          resourceId: settlement.id,
          metadata: {
            checkoutId: checkout.id,
            outstandingRent: Number(recalculated.outstandingRent),
            deductions: Number(recalculated.deductions),
            amountDue: Number(recalculated.amountDue),
            amountRefundable: Number(recalculated.amountRefundable),
          },
        },
      });

      return tx.checkout.findUnique({
        where: { id: checkout.id },
        include: {
          settlement: true,
          tenant: true,
          property: true,
          bed: { include: { room: { include: { floor: true } } } },
          rentalUnit: true,
          lease: true,
        },
      });
    });

    return this.formatCheckout(updated);
  }

  /**
   * Transitions checkout status to READY
   */
  async markCheckoutReady(organizationId: string, checkoutId: string, userId?: string) {
    const checkout = await this.prisma.checkout.findFirst({
      where: { id: checkoutId, organizationId },
      include: { settlement: true },
    });

    if (!checkout) {
      throw new NotFoundException('Checkout not found');
    }

    if (checkout.status === CheckoutStatus.COMPLETED) {
      throw new BadRequestException('Checkout is already completed');
    }

    if (checkout.status === CheckoutStatus.CANCELLED) {
      throw new BadRequestException('Cannot mark a cancelled checkout as ready');
    }

    if (checkout.status === CheckoutStatus.READY) {
      return this.formatCheckout(checkout);
    }

    const updated = await this.prisma.checkout.update({
      where: { id: checkout.id },
      data: { status: CheckoutStatus.READY },
      include: {
        settlement: true,
        tenant: true,
        property: true,
        bed: { include: { room: { include: { floor: true } } } },
        rentalUnit: true,
        lease: true,
      },
    });

    return this.formatCheckout(updated);
  }

  /**
   * Completes checkout, releases inventory, closes stay, and finalizes settlement
   * Uses PostgreSQL SELECT ... FOR UPDATE row-level locking inside an atomic transaction.
   */
  async completeCheckout(organizationId: string, checkoutId: string, userId?: string) {
    const checkout = await this.prisma.checkout.findFirst({
      where: { id: checkoutId, organizationId },
      include: {
        settlement: true,
        tenant: true,
        property: true,
        bed: true,
        rentalUnit: true,
        lease: true,
        stayHistory: true,
      },
    });

    if (!checkout) {
      throw new NotFoundException('Checkout not found');
    }

    // Idempotency: If already completed, return completed result safely
    if (checkout.status === CheckoutStatus.COMPLETED) {
      return this.formatCheckout(checkout);
    }

    if (checkout.status === CheckoutStatus.CANCELLED) {
      throw new BadRequestException('Cannot complete a cancelled checkout');
    }

    // Execute atomic occupancy release inside PostgreSQL transaction with row locks
    const completed = await this.prisma.$transaction(
      async (tx) => {
        // Re-read and lock checkout inside transaction
        const lockedCheckout = await tx.checkout.findUnique({
          where: { id: checkout.id },
          include: { settlement: true },
        });

        if (!lockedCheckout || lockedCheckout.status === CheckoutStatus.COMPLETED) {
          throw new ConflictException('Checkout was already completed by another transaction');
        }

        if (lockedCheckout.status === CheckoutStatus.CANCELLED) {
          throw new BadRequestException('Checkout has been cancelled');
        }

        if (checkout.property.propertyType === PropertyType.PG) {
          if (!checkout.bedId) {
            throw new BadRequestException('PG checkout requires an associated bedId');
          }

          // PostgreSQL row-level lock on bed
          await tx.$executeRawUnsafe('SELECT id FROM beds WHERE id = $1 FOR UPDATE', checkout.bedId);

          // Re-verify bed status after lock
          const lockedBed = await tx.bed.findUnique({
            where: { id: checkout.bedId },
          });

          if (!lockedBed || lockedBed.status !== BedStatus.OCCUPIED) {
            throw new ConflictException(
              'Bed is not currently occupied or checkout was already completed by another transaction'
            );
          }

          // Close active stay history
          if (checkout.stayHistoryId) {
            await tx.tenantStayHistory.update({
              where: { id: checkout.stayHistoryId },
              data: { checkOutDate: checkout.checkoutDate },
            });
          } else {
            // Find and close any open stay history for this tenant & bed
            const openStay = await tx.tenantStayHistory.findFirst({
              where: { tenantId: checkout.tenantId, bedId: checkout.bedId, checkOutDate: null },
            });
            if (openStay) {
              await tx.tenantStayHistory.update({
                where: { id: openStay.id },
                data: { checkOutDate: checkout.checkoutDate },
              });
            }
          }

          // Release bed inventory
          await tx.bed.update({
            where: { id: checkout.bedId },
            data: { status: BedStatus.AVAILABLE },
          });
        } else if (checkout.property.propertyType === PropertyType.RENTAL_HOUSE) {
          if (!checkout.rentalUnitId) {
            throw new BadRequestException('Whole-unit checkout requires an associated rentalUnitId');
          }

          // PostgreSQL row-level lock on rental unit
          await tx.$executeRawUnsafe(
            'SELECT id FROM rental_units WHERE id = $1 FOR UPDATE',
            checkout.rentalUnitId
          );

          // Re-verify rental unit status after lock
          const lockedUnit = await tx.rentalUnit.findUnique({
            where: { id: checkout.rentalUnitId },
          });

          if (!lockedUnit || lockedUnit.status !== RentalUnitStatus.OCCUPIED) {
            throw new ConflictException(
              'Rental unit is not currently occupied or checkout was already completed by another transaction'
            );
          }

          // Transition lease status
          if (checkout.leaseId) {
            const lease = await tx.lease.findUnique({
              where: { id: checkout.leaseId },
            });

            if (lease && lease.status === LeaseStatus.ACTIVE) {
              // Directives 13 & 14: Use EXPIRED if natural lease end reached, else TERMINATED
              const isNaturalCompletion = checkout.checkoutDate >= lease.endDate;
              const nextLeaseStatus = isNaturalCompletion ? LeaseStatus.EXPIRED : LeaseStatus.TERMINATED;

              await tx.lease.update({
                where: { id: lease.id },
                data: { status: nextLeaseStatus },
              });
            }
          }

          // Release rental unit inventory
          await tx.rentalUnit.update({
            where: { id: checkout.rentalUnitId },
            data: { status: RentalUnitStatus.AVAILABLE },
          });
        }

        // Update Tenant status to CHECKED_OUT
        await tx.tenant.update({
          where: { id: checkout.tenantId },
          data: { status: TenantStatus.CHECKED_OUT },
        });

        // Finalize settlement
        if (checkout.settlement) {
          await tx.settlement.update({
            where: { id: checkout.settlement.id },
            data: { status: SettlementStatus.FINALIZED },
          });
        }

        // Transition checkout to COMPLETED
        const completedRecord = await tx.checkout.update({
          where: { id: checkout.id },
          data: {
            status: CheckoutStatus.COMPLETED,
            completedAt: new Date(),
          },
          include: {
            settlement: true,
            tenant: true,
            property: true,
            bed: { include: { room: { include: { floor: true } } } },
            rentalUnit: true,
            lease: true,
          },
        });

        // Standardized Audit logs
        await tx.auditLog.create({
          data: {
            organizationId,
            userId: userId || null,
            action: 'TENANT_CHECKED_OUT',
            resourceType: 'CHECKOUT',
            resourceId: checkout.id,
            metadata: {
              tenantId: checkout.tenantId,
              propertyId: checkout.propertyId,
              propertyType: checkout.property.propertyType,
              bedId: checkout.bedId,
              rentalUnitId: checkout.rentalUnitId,
              completedAt: completedRecord.completedAt,
            },
          },
        });

        await tx.auditLog.create({
          data: {
            organizationId,
            userId: userId || null,
            action: 'SETTLEMENT_FINALIZED',
            resourceType: 'SETTLEMENT',
            resourceId: checkout.settlement?.id || checkout.id,
            metadata: {
              checkoutId: checkout.id,
              amountDue: Number(checkout.settlement?.amountDue || 0),
              amountRefundable: Number(checkout.settlement?.amountRefundable || 0),
            },
          },
        });

        return completedRecord;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10000,
      }
    );

    return this.formatCheckout(completed);
  }

  /**
   * Cancels a checkout in INITIATED or SETTLEMENT_PENDING or READY state
   */
  async cancelCheckout(
    organizationId: string,
    checkoutId: string,
    dto: CancelCheckoutDto,
    userId?: string
  ) {
    const checkout = await this.prisma.checkout.findFirst({
      where: { id: checkoutId, organizationId },
      include: { settlement: true },
    });

    if (!checkout) {
      throw new NotFoundException('Checkout not found');
    }

    if (checkout.status === CheckoutStatus.COMPLETED) {
      throw new BadRequestException('Completed checkouts cannot be cancelled.');
    }

    if (checkout.status === CheckoutStatus.CANCELLED) {
      throw new BadRequestException('Checkout is already cancelled.');
    }

    const cancelled = await this.prisma.$transaction(async (tx) => {
      const updatedCheckout = await tx.checkout.update({
        where: { id: checkout.id },
        data: {
          status: CheckoutStatus.CANCELLED,
          cancelledAt: new Date(),
          reason: dto.reason ? `${checkout.reason ? checkout.reason + ' | ' : ''}Cancelled: ${dto.reason}` : checkout.reason,
        },
        include: {
          settlement: true,
          tenant: true,
          property: true,
          bed: { include: { room: { include: { floor: true } } } },
          rentalUnit: true,
          lease: true,
        },
      });

      if (checkout.settlement) {
        await tx.settlement.update({
          where: { id: checkout.settlement.id },
          data: { status: SettlementStatus.VOID },
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId,
          userId: userId || null,
          action: 'CHECKOUT_CANCELLED',
          resourceType: 'CHECKOUT',
          resourceId: checkout.id,
          metadata: {
            reason: dto.reason,
          },
        },
      });

      return updatedCheckout;
    });

    return this.formatCheckout(cancelled);
  }

  /**
   * Lists checkouts for a property or organization
   */
  async listCheckouts(
    organizationId: string,
    filters?: {
      propertyId?: string;
      tenantId?: string;
      status?: CheckoutStatus;
      search?: string;
    }
  ) {
    const where: any = {
      organizationId,
    };

    if (filters?.propertyId) {
      where.propertyId = filters.propertyId;
    }

    if (filters?.tenantId) {
      where.tenantId = filters.tenantId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.search) {
      const q = filters.search.trim();
      where.OR = [
        { tenant: { firstName: { contains: q, mode: 'insensitive' } } },
        { tenant: { lastName: { contains: q, mode: 'insensitive' } } },
        { tenant: { phone: { contains: q, mode: 'insensitive' } } },
        { property: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const checkouts = await this.prisma.checkout.findMany({
      where,
      include: {
        settlement: true,
        tenant: true,
        property: true,
        bed: { include: { room: { include: { floor: true } } } },
        rentalUnit: true,
        lease: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return checkouts.map((c) => this.formatCheckout(c));
  }

  /**
   * Retrieves single checkout details
   */
  async getCheckoutById(organizationId: string, checkoutId: string) {
    const checkout = await this.prisma.checkout.findFirst({
      where: { id: checkoutId, organizationId },
      include: {
        settlement: true,
        tenant: true,
        property: true,
        bed: { include: { room: { include: { floor: true } } } },
        rentalUnit: true,
        lease: true,
      },
    });

    if (!checkout) {
      throw new NotFoundException('Checkout not found');
    }

    return this.formatCheckout(checkout);
  }

  /**
   * Retrieves settlement details for a checkout
   */
  async getSettlementByCheckoutId(organizationId: string, checkoutId: string) {
    const checkout = await this.prisma.checkout.findFirst({
      where: { id: checkoutId, organizationId },
      include: { settlement: true },
    });

    if (!checkout || !checkout.settlement) {
      throw new NotFoundException('Settlement not found');
    }

    return {
      id: checkout.settlement.id,
      organizationId: checkout.settlement.organizationId,
      tenantId: checkout.settlement.tenantId,
      checkoutId: checkout.settlement.checkoutId,
      securityDeposit: Number(checkout.settlement.securityDeposit),
      outstandingRent: Number(checkout.settlement.outstandingRent),
      maintenanceCharges: Number(checkout.settlement.maintenanceCharges),
      deductions: Number(checkout.settlement.deductions),
      refundableAmount: Number(checkout.settlement.refundableAmount),
      amountDue: Number(checkout.settlement.amountDue),
      amountRefundable: Number(checkout.settlement.amountRefundable),
      status: checkout.settlement.status,
      notes: checkout.settlement.notes,
      createdAt: checkout.settlement.createdAt,
      updatedAt: checkout.settlement.updatedAt,
    };
  }

  /**
   * Retrieves checkout history for a specific tenant
   */
  async getTenantCheckouts(organizationId: string, tenantId: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId, organizationId, deletedAt: null },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return this.listCheckouts(organizationId, { tenantId });
  }
}
