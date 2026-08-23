import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import {
  ElectricityMeterDto,
  CreateElectricityMeterDto,
  UpdateElectricityMeterDto,
  ElectricityReadingDto,
  RecordElectricityReadingDto,
  ElectricityRateDto,
  CreateElectricityRateDto,
  ElectricityChargeDto,
  GenerateElectricityChargesDto,
  ElectricitySummaryDto,
  TenantElectricitySummaryDto,
  MeterType,
  MeterStatus,
  ElectricityRateStatus,
  ElectricityChargeStatus,
  ElectricityAllocationType,
  ChargeType,
  PropertyType,
  CheckInStatus,
  UserRole,
  Permission,
  hasPermission,
} from '@propertyos/types';
import { Prisma } from '@prisma/client';

@Injectable()
export class ElectricityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoicesService
  ) {}

  /**
   * Standardized audit log writer
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
   * Helper: Validate property exists in organization and is PG
   */
  async validateProperty(organizationId: string, propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: {
        id: propertyId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!property) {
      throw new NotFoundException(`Property ${propertyId} not found`);
    }

    if (property.propertyType !== PropertyType.PG) {
      throw new NotFoundException(`Electricity management is only available for PG properties`);
    }

    return property;
  }

  // ----------------------------------------------------------------------------
  // METERS
  // ----------------------------------------------------------------------------

  async createMeter(
    organizationId: string,
    propertyId: string,
    dto: CreateElectricityMeterDto,
    userId: string
  ): Promise<ElectricityMeterDto> {
    await this.validateProperty(organizationId, propertyId);

    // If roomId is provided, validate it belongs to the property and org
    if (dto.roomId) {
      const room = await this.prisma.room.findFirst({
        where: {
          id: dto.roomId,
          propertyId,
          deletedAt: null,
        },
      });
      if (!room) {
        throw new NotFoundException(`Room ${dto.roomId} not found in this property`);
      }
    }

    // Check meterNumber uniqueness within property
    const existing = await this.prisma.electricityMeter.findFirst({
      where: {
        propertyId,
        meterNumber: dto.meterNumber.trim(),
      },
    });
    if (existing) {
      throw new ConflictException(`Meter with number ${dto.meterNumber} already exists in this property`);
    }

    const initialReading = new Prisma.Decimal(dto.initialReading !== undefined ? dto.initialReading : 0);

    const meter = await this.prisma.$transaction(async (tx) => {
      const created = await tx.electricityMeter.create({
        data: {
          organizationId,
          propertyId,
          roomId: dto.roomId || null,
          rentalUnitId: dto.rentalUnitId || null,
          meterNumber: dto.meterNumber.trim(),
          meterType: dto.meterType || MeterType.ROOM,
          status: MeterStatus.ACTIVE,
          initialReading,
          installedAt: dto.installedAt ? new Date(dto.installedAt) : new Date(),
        },
        include: {
          room: { select: { id: true, roomNumber: true } },
          property: { select: { id: true, name: true, code: true } },
          _count: { select: { readings: true, charges: true } },
        },
      });

      await this.writeAuditLog(
        tx,
        organizationId,
        userId,
        'ELECTRICITY_METER_CREATED',
        'ElectricityMeter',
        created.id,
        { meterNumber: created.meterNumber, meterType: created.meterType, initialReading: initialReading.toString() }
      );

      return created;
    });

    return this.mapMeterToDto(meter);
  }

  async getMeters(
    organizationId: string,
    propertyId: string,
    roomId?: string,
    status?: MeterStatus
  ): Promise<ElectricityMeterDto[]> {
    await this.validateProperty(organizationId, propertyId);

    const where: Prisma.ElectricityMeterWhereInput = {
      organizationId,
      propertyId,
      ...(roomId ? { roomId } : {}),
      ...(status ? { status } : {}),
    };

    const meters = await this.prisma.electricityMeter.findMany({
      where,
      include: {
        room: { select: { id: true, roomNumber: true } },
        property: { select: { id: true, name: true, code: true } },
        _count: { select: { readings: true, charges: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return meters.map((m) => this.mapMeterToDto(m));
  }

  async getMeterById(
    organizationId: string,
    propertyId: string,
    meterId: string
  ): Promise<ElectricityMeterDto> {
    await this.validateProperty(organizationId, propertyId);

    const meter = await this.prisma.electricityMeter.findFirst({
      where: { id: meterId, propertyId, organizationId },
      include: {
        room: { select: { id: true, roomNumber: true } },
        property: { select: { id: true, name: true, code: true } },
        _count: { select: { readings: true, charges: true } },
      },
    });

    if (!meter) {
      throw new NotFoundException(`Meter ${meterId} not found`);
    }

    return this.mapMeterToDto(meter);
  }

  async updateMeter(
    organizationId: string,
    propertyId: string,
    meterId: string,
    dto: UpdateElectricityMeterDto,
    userId: string
  ): Promise<ElectricityMeterDto> {
    await this.validateProperty(organizationId, propertyId);

    const meter = await this.prisma.electricityMeter.findFirst({
      where: { id: meterId, propertyId, organizationId },
    });
    if (!meter) {
      throw new NotFoundException(`Meter ${meterId} not found`);
    }

    if (dto.roomId) {
      const room = await this.prisma.room.findFirst({
        where: { id: dto.roomId, propertyId, deletedAt: null },
      });
      if (!room) {
        throw new NotFoundException(`Room ${dto.roomId} not found`);
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.electricityMeter.update({
        where: { id: meterId },
        data: {
          ...(dto.meterNumber ? { meterNumber: dto.meterNumber.trim() } : {}),
          ...(dto.status ? { status: dto.status } : {}),
          ...(dto.roomId !== undefined ? { roomId: dto.roomId } : {}),
        },
        include: {
          room: { select: { id: true, roomNumber: true } },
          property: { select: { id: true, name: true, code: true } },
          _count: { select: { readings: true, charges: true } },
        },
      });

      await this.writeAuditLog(
        tx,
        organizationId,
        userId,
        'ELECTRICITY_METER_UPDATED',
        'ElectricityMeter',
        meterId,
        dto
      );

      return res;
    });

    return this.mapMeterToDto(updated);
  }

  // ----------------------------------------------------------------------------
  // READINGS
  // ----------------------------------------------------------------------------

  async recordReading(
    organizationId: string,
    propertyId: string,
    dto: RecordElectricityReadingDto,
    userId: string,
    userRoles?: UserRole[]
  ): Promise<ElectricityReadingDto> {
    await this.validateProperty(organizationId, propertyId);

    const meter = await this.prisma.electricityMeter.findFirst({
      where: { id: dto.meterId, propertyId, organizationId },
    });
    if (!meter) {
      throw new NotFoundException(`Meter ${dto.meterId} not found`);
    }

    if (dto.isResetOverride) {
      if (userRoles && !hasPermission(userRoles, Permission.ELECTRICITY_UPDATE)) {
        throw new ForbiddenException(
          'You do not have permission to perform a meter reset override. Permission ELECTRICITY_UPDATE is required.'
        );
      }
      if (!dto.resetReason || dto.resetReason.trim().length === 0) {
        throw new BadRequestException('Reset reason is mandatory for meter reset override');
      }
    }

    const readingDate = new Date(dto.readingDate);
    const currentReading = new Prisma.Decimal(dto.currentReading);

    // Duplicate check for meter on same date
    const existingReadingOnDate = await this.prisma.electricityReading.findFirst({
      where: {
        meterId: dto.meterId,
        readingDate,
      },
    });
    if (existingReadingOnDate) {
      throw new ConflictException(
        `A reading for meter ${meter.meterNumber} on ${readingDate.toISOString().split('T')[0]} already exists`
      );
    }

    // Find the latest previous reading for this meter before this reading date
    const latestPreviousReading = await this.prisma.electricityReading.findFirst({
      where: {
        meterId: dto.meterId,
        readingDate: { lt: readingDate },
      },
      orderBy: { readingDate: 'desc' },
    });

    const previousReading = latestPreviousReading
      ? latestPreviousReading.currentReading
      : meter.initialReading;

    let unitsConsumed: Prisma.Decimal;

    if (currentReading.lessThan(previousReading)) {
      if (!dto.isResetOverride) {
        throw new BadRequestException(
          `Current reading (${currentReading}) cannot be lower than previous reading (${previousReading}) without an authorized reset override`
        );
      }
      // On authorized reset, units consumed is the current reading (starting from 0 baseline on new cycle)
      unitsConsumed = currentReading;
    } else {
      unitsConsumed = currentReading.sub(previousReading);
    }

    try {
      const reading = await this.prisma.$transaction(async (tx) => {
        const created = await tx.electricityReading.create({
          data: {
            organizationId,
            propertyId,
            meterId: dto.meterId,
            readingDate,
            previousReading,
            currentReading,
            unitsConsumed,
            previousReadingId: latestPreviousReading?.id || null,
            isResetOverride: !!dto.isResetOverride,
            resetReason: dto.resetReason || null,
            recordedBy: userId,
            notes: dto.notes || null,
          },
          include: {
            meter: { select: { id: true, meterNumber: true, meterType: true, roomId: true } },
          },
        });

        // Update meter's lastReadingAt
        await tx.electricityMeter.update({
          where: { id: dto.meterId },
          data: { lastReadingAt: readingDate },
        });

        const auditAction = dto.isResetOverride
          ? 'ELECTRICITY_READING_RESET'
          : 'ELECTRICITY_READING_RECORDED';

        await this.writeAuditLog(
          tx,
          organizationId,
          userId,
          auditAction,
          'ElectricityReading',
          created.id,
          {
            meterNumber: meter.meterNumber,
            previousReading: previousReading.toString(),
            currentReading: currentReading.toString(),
            unitsConsumed: unitsConsumed.toString(),
            isResetOverride: dto.isResetOverride,
            resetReason: dto.resetReason,
          }
        );

        return created;
      });

      return this.mapReadingToDto(reading);
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(
          `A reading for meter ${meter.meterNumber} on ${readingDate.toISOString().split('T')[0]} already exists`
        );
      }
      throw err;
    }
  }

  async getReadings(
    organizationId: string,
    propertyId: string,
    meterId?: string
  ): Promise<ElectricityReadingDto[]> {
    await this.validateProperty(organizationId, propertyId);

    const where: Prisma.ElectricityReadingWhereInput = {
      organizationId,
      propertyId,
      ...(meterId ? { meterId } : {}),
    };

    const readings = await this.prisma.electricityReading.findMany({
      where,
      include: {
        meter: { select: { id: true, meterNumber: true, meterType: true, roomId: true } },
      },
      orderBy: { readingDate: 'desc' },
    });

    return readings.map((r) => this.mapReadingToDto(r));
  }

  // ----------------------------------------------------------------------------
  // RATES
  // ----------------------------------------------------------------------------

  async createRate(
    organizationId: string,
    propertyId: string,
    dto: CreateElectricityRateDto,
    userId: string
  ): Promise<ElectricityRateDto> {
    await this.validateProperty(organizationId, propertyId);

    const ratePerUnit = new Prisma.Decimal(dto.ratePerUnit);
    if (ratePerUnit.isNegative() || ratePerUnit.isZero()) {
      throw new BadRequestException('Rate per unit must be strictly greater than zero');
    }

    const effectiveFrom = new Date(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;

    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new BadRequestException('effectiveTo cannot be earlier than effectiveFrom');
    }

    const rate = await this.prisma.$transaction(async (tx) => {
      // Transaction-scoped advisory lock for this property to serialize concurrent rate creation
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('electricity_rate_' || ${propertyId}))`;

      // Check for overlapping ACTIVE rates for the property
      const overlappingRates = await tx.electricityRate.findMany({
        where: {
          organizationId,
          propertyId,
          status: ElectricityRateStatus.ACTIVE,
          AND: [
            {
              effectiveFrom: {
                lte: effectiveTo || new Date('9999-12-31T23:59:59.999Z'),
              },
            },
            {
              OR: [
                { effectiveTo: null },
                { effectiveTo: { gte: effectiveFrom } },
              ],
            },
          ],
        },
      });

      if (overlappingRates.length > 0) {
        throw new ConflictException(
          `An active electricity rate already exists for property ${propertyId} that overlaps with period ${effectiveFrom.toISOString().split('T')[0]} to ${effectiveTo ? effectiveTo.toISOString().split('T')[0] : 'indefinite'}. Conflicting Rate ID: ${overlappingRates[0].id}`
        );
      }

      const created = await tx.electricityRate.create({
        data: {
          organizationId,
          propertyId,
          ratePerUnit,
          effectiveFrom,
          effectiveTo,
          status: ElectricityRateStatus.ACTIVE,
        },
      });

      await this.writeAuditLog(
        tx,
        organizationId,
        userId,
        'ELECTRICITY_RATE_CREATED',
        'ElectricityRate',
        created.id,
        {
          ratePerUnit: ratePerUnit.toString(),
          effectiveFrom: effectiveFrom.toISOString(),
          effectiveTo: effectiveTo?.toISOString(),
        }
      );

      return created;
    });

    return this.mapRateToDto(rate);
  }

  async deactivateRate(
    organizationId: string,
    propertyId: string,
    rateId: string,
    userId: string
  ): Promise<ElectricityRateDto> {
    await this.validateProperty(organizationId, propertyId);

    const rate = await this.prisma.electricityRate.findFirst({
      where: { id: rateId, propertyId, organizationId },
    });

    if (!rate) {
      throw new NotFoundException(`Rate ${rateId} not found`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.electricityRate.update({
        where: { id: rateId },
        data: { status: ElectricityRateStatus.INACTIVE },
      });

      await this.writeAuditLog(
        tx,
        organizationId,
        userId,
        'ELECTRICITY_RATE_DEACTIVATED',
        'ElectricityRate',
        rateId,
        { previousStatus: rate.status }
      );

      return res;
    });

    return this.mapRateToDto(updated);
  }

  async getRates(
    organizationId: string,
    propertyId: string
  ): Promise<ElectricityRateDto[]> {
    await this.validateProperty(organizationId, propertyId);

    const rates = await this.prisma.electricityRate.findMany({
      where: { organizationId, propertyId },
      orderBy: { effectiveFrom: 'desc' },
    });

    return rates.map((r) => this.mapRateToDto(r));
  }

  /**
   * Helper: Find effective rate for a property on a specific reading date
   */
  async findEffectiveRate(
    organizationId: string,
    propertyId: string,
    readingDate: Date
  ): Promise<Prisma.ElectricityRateGetPayload<{}>> {
    const rate = await this.prisma.electricityRate.findFirst({
      where: {
        organizationId,
        propertyId,
        status: ElectricityRateStatus.ACTIVE,
        effectiveFrom: { lte: readingDate },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: readingDate } },
        ],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (!rate) {
      throw new BadRequestException(
        `No active electricity rate found for property ${propertyId} on date ${readingDate.toISOString().split('T')[0]}`
      );
    }

    return rate;
  }

  // ----------------------------------------------------------------------------
  // CHARGE GENERATION & INVOICING
  // ----------------------------------------------------------------------------

  async generateCharges(
    organizationId: string,
    propertyId: string,
    dto: GenerateElectricityChargesDto,
    userId: string
  ): Promise<ElectricityChargeDto[]> {
    await this.validateProperty(organizationId, propertyId);

    return this.prisma.$transaction(async (tx) => {
      // Transaction-scoped advisory lock for this reading to serialize concurrent charge generation
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('electricity_charge_' || ${dto.readingId}))`;

      // 1. Fetch reading with meter info
      const reading = await tx.electricityReading.findFirst({
        where: { id: dto.readingId, propertyId, organizationId },
        include: {
          meter: {
            include: {
              room: true,
            },
          },
        },
      });

      if (!reading) {
        throw new NotFoundException(`Reading ${dto.readingId} not found`);
      }

      // Check if charges were already generated for this reading (idempotency under lock)
      const existingCharges = await tx.electricityCharge.findMany({
        where: { readingId: dto.readingId, organizationId },
        include: {
          tenant: { select: { id: true, firstName: true, lastName: true, phone: true } },
          room: { select: { id: true, roomNumber: true } },
          meter: { select: { id: true, meterNumber: true, meterType: true } },
          invoice: { select: { id: true, invoiceNumber: true, status: true, totalAmount: true } },
        },
      });

      if (existingCharges.length > 0) {
        // Idempotent: return existing charges
        return existingCharges.map((c) => this.mapChargeToDto(c));
      }

      // 2. Lookup effective rate on reading date
      const rate = await this.findEffectiveRate(organizationId, propertyId, reading.readingDate);
      const ratePerUnit = rate.ratePerUnit;
      const totalAmount = reading.unitsConsumed.mul(ratePerUnit);

      const periodStart = reading.previousReadingId
        ? (await tx.electricityReading.findUnique({ where: { id: reading.previousReadingId } }))?.readingDate || reading.readingDate
        : reading.readingDate;
      const periodEnd = reading.readingDate;

      const createdCharges: any[] = [];

      if (reading.meter.meterType === MeterType.ROOM && reading.meter.roomId) {
        // Room Meter: Identify active occupants on reading date
        const activeCheckIns = await tx.checkIn.findMany({
          where: {
            organizationId,
            propertyId,
            status: CheckInStatus.CHECKED_IN,
            bed: { roomId: reading.meter.roomId },
          },
          include: {
            tenant: true,
          },
        });

        const occupantCount = activeCheckIns.length;

        if (occupantCount === 0) {
          // No active occupants in room: Allocate to PROPERTY_COMMON
          const charge = await tx.electricityCharge.create({
            data: {
              organizationId,
              propertyId,
              meterId: reading.meterId,
              readingId: reading.id,
              roomId: reading.meter.roomId,
              tenantId: null,
              chargePeriodStart: periodStart,
              chargePeriodEnd: periodEnd,
              unitsConsumed: reading.unitsConsumed,
              ratePerUnit,
              amount: totalAmount,
              allocationType: ElectricityAllocationType.PROPERTY_COMMON,
              status: ElectricityChargeStatus.PENDING,
            },
            include: {
              tenant: { select: { id: true, firstName: true, lastName: true, phone: true } },
              room: { select: { id: true, roomNumber: true } },
              meter: { select: { id: true, meterNumber: true, meterType: true } },
              invoice: { select: { id: true, invoiceNumber: true, status: true, totalAmount: true } },
            },
          });
          createdCharges.push(charge);
        } else {
          // Deterministic split among occupants with zero rounding loss
          const N = new Prisma.Decimal(occupantCount);
          const unitsPerTenant = reading.unitsConsumed.div(N);

          // Base amount per tenant rounded down to 2 decimal places
          const baseAmount = totalAmount.div(N).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
          const totalAllocated = baseAmount.mul(N);
          const remainder = totalAmount.sub(totalAllocated);
          const remainderCents = remainder.mul(100).toNumber(); // integer count of 0.01s to distribute

          for (let i = 0; i < occupantCount; i++) {
            const checkIn = activeCheckIns[i];
            let tenantAmount = baseAmount;
            if (i < remainderCents) {
              tenantAmount = tenantAmount.add(new Prisma.Decimal('0.01'));
            }

            const charge = await tx.electricityCharge.create({
              data: {
                organizationId,
                propertyId,
                meterId: reading.meterId,
                readingId: reading.id,
                roomId: reading.meter.roomId,
                tenantId: checkIn.tenantId,
                chargePeriodStart: periodStart,
                chargePeriodEnd: periodEnd,
                unitsConsumed: unitsPerTenant,
                ratePerUnit,
                amount: tenantAmount,
                allocationType: occupantCount === 1 ? ElectricityAllocationType.TENANT_SPECIFIC : ElectricityAllocationType.ROOM_SHARED,
                status: ElectricityChargeStatus.PENDING,
              },
              include: {
                tenant: { select: { id: true, firstName: true, lastName: true, phone: true } },
                room: { select: { id: true, roomNumber: true } },
                meter: { select: { id: true, meterNumber: true, meterType: true } },
                invoice: { select: { id: true, invoiceNumber: true, status: true, totalAmount: true } },
              },
            });
            createdCharges.push(charge);
          }
        }
      } else {
        // PROPERTY or COMMON_AREA meter
        const charge = await tx.electricityCharge.create({
          data: {
            organizationId,
            propertyId,
            meterId: reading.meterId,
            readingId: reading.id,
            roomId: null,
            tenantId: null,
            chargePeriodStart: periodStart,
            chargePeriodEnd: periodEnd,
            unitsConsumed: reading.unitsConsumed,
            ratePerUnit,
            amount: totalAmount,
            allocationType: ElectricityAllocationType.PROPERTY_COMMON,
            status: ElectricityChargeStatus.PENDING,
          },
          include: {
            tenant: { select: { id: true, firstName: true, lastName: true, phone: true } },
            room: { select: { id: true, roomNumber: true } },
            meter: { select: { id: true, meterNumber: true, meterType: true } },
            invoice: { select: { id: true, invoiceNumber: true, status: true, totalAmount: true } },
          },
        });
        createdCharges.push(charge);
      }

      // Auto-invoicing integration if requested: atomic within the SAME transaction tx
      if (dto.autoInvoice) {
        for (const charge of createdCharges) {
          if (charge.tenantId && charge.amount.greaterThan(0)) {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 7);

            const invoiceDto = await this.invoicesService.createInvoice(
              organizationId,
              {
                tenantId: charge.tenantId,
                propertyId,
                issueDate: new Date().toISOString(),
                dueDate: dueDate.toISOString(),
                lines: [
                  {
                    description: `Electricity Charge - Meter ${reading.meter.meterNumber} (${charge.unitsConsumed.toFixed(2)} units @ ₹${ratePerUnit}/unit)`,
                    chargeType: ChargeType.UTILITY,
                    quantity: 1,
                    unitAmount: charge.amount.toNumber(),
                  },
                ],
              },
              userId,
              tx
            );

            // Issue invoice to trigger balanced ledger entries inside the SAME transaction tx
            await this.invoicesService.issueInvoice(organizationId, invoiceDto.id, userId, tx);

            // Update charge with invoice link
            await tx.electricityCharge.update({
              where: { id: charge.id },
              data: {
                status: ElectricityChargeStatus.INVOICED,
                invoiceId: invoiceDto.id,
              },
            });

            charge.status = ElectricityChargeStatus.INVOICED;
            charge.invoiceId = invoiceDto.id;
          }
        }
      }

      await this.writeAuditLog(
        tx,
        organizationId,
        userId,
        'ELECTRICITY_CHARGE_GENERATED',
        'ElectricityReading',
        reading.id,
        {
          chargesCount: createdCharges.length,
          totalUnits: reading.unitsConsumed.toString(),
          totalAmount: totalAmount.toString(),
          autoInvoice: dto.autoInvoice,
        }
      );

      return createdCharges.map((c) => this.mapChargeToDto(c));
    });
  }

  async getCharges(
    organizationId: string,
    propertyId: string,
    tenantId?: string,
    status?: ElectricityChargeStatus
  ): Promise<ElectricityChargeDto[]> {
    await this.validateProperty(organizationId, propertyId);

    const where: Prisma.ElectricityChargeWhereInput = {
      organizationId,
      propertyId,
      ...(tenantId ? { tenantId } : {}),
      ...(status ? { status } : {}),
    };

    const charges = await this.prisma.electricityCharge.findMany({
      where,
      include: {
        tenant: { select: { id: true, firstName: true, lastName: true, phone: true } },
        room: { select: { id: true, roomNumber: true } },
        meter: { select: { id: true, meterNumber: true, meterType: true } },
        invoice: { select: { id: true, invoiceNumber: true, status: true, totalAmount: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return charges.map((c) => this.mapChargeToDto(c));
  }

  // ----------------------------------------------------------------------------
  // SUMMARY & TENANT SPECIFIC
  // ----------------------------------------------------------------------------

  async getSummary(
    organizationId: string,
    propertyId: string
  ): Promise<ElectricitySummaryDto> {
    await this.validateProperty(organizationId, propertyId);

    const totalMeters = await this.prisma.electricityMeter.count({
      where: { organizationId, propertyId },
    });

    const activeMeters = await this.prisma.electricityMeter.count({
      where: { organizationId, propertyId, status: MeterStatus.ACTIVE },
    });

    const readings = await this.prisma.electricityReading.findMany({
      where: { organizationId, propertyId },
      select: { unitsConsumed: true },
    });

    const currentPeriodConsumption = readings.reduce(
      (acc, r) => acc.add(r.unitsConsumed),
      new Prisma.Decimal(0)
    );

    const charges = await this.prisma.electricityCharge.findMany({
      where: { organizationId, propertyId },
      select: { amount: true, status: true },
    });

    const totalElectricityCharges = charges.reduce(
      (acc, c) => acc.add(c.amount),
      new Prisma.Decimal(0)
    );

    const pendingChargesCount = charges.filter((c) => c.status === ElectricityChargeStatus.PENDING).length;
    const invoicedChargesCount = charges.filter((c) => c.status === ElectricityChargeStatus.INVOICED).length;

    return {
      totalMeters,
      activeMeters,
      currentPeriodConsumption: currentPeriodConsumption.toNumber(),
      totalElectricityCharges: totalElectricityCharges.toNumber(),
      pendingChargesCount,
      invoicedChargesCount,
    };
  }

  async getTenantElectricitySummary(
    organizationId: string,
    tenantId: string
  ): Promise<TenantElectricitySummaryDto> {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId, organizationId, deletedAt: null },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    const charges = await this.prisma.electricityCharge.findMany({
      where: { tenantId, organizationId },
      include: {
        tenant: { select: { id: true, firstName: true, lastName: true, phone: true } },
        room: { select: { id: true, roomNumber: true } },
        meter: { select: { id: true, meterNumber: true, meterType: true } },
        invoice: { select: { id: true, invoiceNumber: true, status: true, totalAmount: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const totalUnits = charges.reduce((acc, c) => acc.add(c.unitsConsumed), new Prisma.Decimal(0));
    const totalAmount = charges.reduce((acc, c) => acc.add(c.amount), new Prisma.Decimal(0));

    // Find meter for tenant's active check-in
    const activeCheckIn = await this.prisma.checkIn.findFirst({
      where: { tenantId, organizationId, status: CheckInStatus.CHECKED_IN },
      include: { bed: { include: { room: true } } },
    });

    let meter: any = null;
    if (activeCheckIn?.bed?.roomId) {
      meter = await this.prisma.electricityMeter.findFirst({
        where: { roomId: activeCheckIn.bed.roomId, organizationId },
        include: { room: { select: { id: true, roomNumber: true } } },
      });
    }

    return {
      tenantId,
      currentPeriodUnits: totalUnits.toNumber(),
      allocatedAmount: totalAmount.toNumber(),
      recentCharges: charges.map((c) => this.mapChargeToDto(c)),
      meter: meter ? this.mapMeterToDto(meter) : null,
    };
  }

  // ----------------------------------------------------------------------------
  // DTO MAPPERS
  // ----------------------------------------------------------------------------

  private mapMeterToDto(meter: any): ElectricityMeterDto {
    return {
      id: meter.id,
      organizationId: meter.organizationId,
      propertyId: meter.propertyId,
      roomId: meter.roomId,
      rentalUnitId: meter.rentalUnitId,
      meterNumber: meter.meterNumber,
      meterType: meter.meterType,
      status: meter.status,
      initialReading: meter.initialReading instanceof Prisma.Decimal ? meter.initialReading.toNumber() : Number(meter.initialReading),
      installedAt: meter.installedAt.toISOString(),
      lastReadingAt: meter.lastReadingAt ? meter.lastReadingAt.toISOString() : null,
      createdAt: meter.createdAt.toISOString(),
      updatedAt: meter.updatedAt.toISOString(),
      room: meter.room ? { id: meter.room.id, roomNumber: meter.room.roomNumber } : null,
      property: meter.property ? { id: meter.property.id, name: meter.property.name, code: meter.property.code } : undefined,
      _count: meter._count,
    };
  }

  private mapReadingToDto(reading: any): ElectricityReadingDto {
    return {
      id: reading.id,
      organizationId: reading.organizationId,
      propertyId: reading.propertyId,
      meterId: reading.meterId,
      readingDate: reading.readingDate.toISOString(),
      previousReading: reading.previousReading instanceof Prisma.Decimal ? reading.previousReading.toNumber() : Number(reading.previousReading),
      currentReading: reading.currentReading instanceof Prisma.Decimal ? reading.currentReading.toNumber() : Number(reading.currentReading),
      unitsConsumed: reading.unitsConsumed instanceof Prisma.Decimal ? reading.unitsConsumed.toNumber() : Number(reading.unitsConsumed),
      previousReadingId: reading.previousReadingId,
      isResetOverride: reading.isResetOverride,
      resetReason: reading.resetReason,
      recordedBy: reading.recordedBy,
      notes: reading.notes,
      createdAt: reading.createdAt.toISOString(),
      updatedAt: reading.updatedAt.toISOString(),
      meter: reading.meter ? {
        id: reading.meter.id,
        meterNumber: reading.meter.meterNumber,
        meterType: reading.meter.meterType,
        roomId: reading.meter.roomId,
      } : undefined,
    };
  }

  private mapRateToDto(rate: any): ElectricityRateDto {
    return {
      id: rate.id,
      organizationId: rate.organizationId,
      propertyId: rate.propertyId,
      ratePerUnit: rate.ratePerUnit instanceof Prisma.Decimal ? rate.ratePerUnit.toNumber() : Number(rate.ratePerUnit),
      effectiveFrom: rate.effectiveFrom.toISOString(),
      effectiveTo: rate.effectiveTo ? rate.effectiveTo.toISOString() : null,
      status: rate.status,
      createdAt: rate.createdAt.toISOString(),
      updatedAt: rate.updatedAt.toISOString(),
    };
  }

  private mapChargeToDto(charge: any): ElectricityChargeDto {
    return {
      id: charge.id,
      organizationId: charge.organizationId,
      propertyId: charge.propertyId,
      meterId: charge.meterId,
      readingId: charge.readingId,
      tenantId: charge.tenantId,
      roomId: charge.roomId,
      chargePeriodStart: charge.chargePeriodStart.toISOString(),
      chargePeriodEnd: charge.chargePeriodEnd.toISOString(),
      unitsConsumed: charge.unitsConsumed instanceof Prisma.Decimal ? charge.unitsConsumed.toNumber() : Number(charge.unitsConsumed),
      ratePerUnit: charge.ratePerUnit instanceof Prisma.Decimal ? charge.ratePerUnit.toNumber() : Number(charge.ratePerUnit),
      amount: charge.amount instanceof Prisma.Decimal ? charge.amount.toNumber() : Number(charge.amount),
      allocationType: charge.allocationType,
      status: charge.status,
      invoiceId: charge.invoiceId,
      invoiceLineId: charge.invoiceLineId,
      createdAt: charge.createdAt.toISOString(),
      updatedAt: charge.updatedAt.toISOString(),
      tenant: charge.tenant ? {
        id: charge.tenant.id,
        firstName: charge.tenant.firstName,
        lastName: charge.tenant.lastName,
        phone: charge.tenant.phone,
      } : null,
      room: charge.room ? {
        id: charge.room.id,
        roomNumber: charge.room.roomNumber,
      } : null,
      meter: charge.meter ? {
        id: charge.meter.id,
        meterNumber: charge.meter.meterNumber,
        meterType: charge.meter.meterType,
      } : null,
      invoice: charge.invoice ? {
        id: charge.invoice.id,
        invoiceNumber: charge.invoice.invoiceNumber,
        status: charge.invoice.status,
        totalAmount: charge.invoice.totalAmount instanceof Prisma.Decimal ? charge.invoice.totalAmount.toNumber() : Number(charge.invoice.totalAmount),
      } : null,
    };
  }
}
