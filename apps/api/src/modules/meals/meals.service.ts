import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import {
  MealPlanDto,
  CreateMealPlanDto,
  UpdateMealPlanDto,
  MealSubscriptionDto,
  CreateMealSubscriptionDto,
  UpdateMealSubscriptionDto,
  MealRecordDto,
  RecordMealAttendanceDto,
  BulkRecordMealAttendanceDto,
  MealChargeDto,
  GenerateMealChargesDto,
  MealSummaryDto,
  TenantMealSummaryDto,
  DailyMealMatrixRowDto,
  MealType,
  MealPlanStatus,
  MealSubscriptionStatus,
  MealRecordStatus,
  MealChargeStatus,
  MealBillingMode,
  ChargeType,
  PropertyType,
  CheckInStatus,
  BillingFrequency,
} from '@propertyos/types';
import { Prisma } from '@prisma/client';

@Injectable()
export class MealsService {
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
      throw new NotFoundException(`Meal management is only available for PG properties`);
    }

    return property;
  }

  // ----------------------------------------------------------------------------
  // MEAL PLANS
  // ----------------------------------------------------------------------------

  async createPlan(
    organizationId: string,
    propertyId: string,
    dto: CreateMealPlanDto,
    userId: string
  ): Promise<MealPlanDto> {
    await this.validateProperty(organizationId, propertyId);

    const price = new Prisma.Decimal(dto.price);
    if (price.isNegative() || price.isZero()) {
      throw new BadRequestException('Meal plan price must be strictly greater than zero');
    }

    const hasBreakfast = dto.hasBreakfast !== undefined ? dto.hasBreakfast : true;
    const hasLunch = dto.hasLunch !== undefined ? dto.hasLunch : true;
    const hasDinner = dto.hasDinner !== undefined ? dto.hasDinner : true;

    if (!hasBreakfast && !hasLunch && !hasDinner) {
      throw new BadRequestException('At least one meal (Breakfast, Lunch, or Dinner) must be included in the meal plan');
    }

    const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : null;
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;

    if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) {
      throw new BadRequestException('effectiveTo cannot be earlier than effectiveFrom');
    }

    const plan = await this.prisma.$transaction(async (tx) => {
      // Transaction-level advisory lock to serialize plan creation by name in property
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'meal_plan_' + organizationId + '_' + propertyId + '_' + dto.name.trim().toLowerCase()}))`;

      const existing = await tx.mealPlan.findFirst({
        where: {
          organizationId,
          propertyId,
          name: { equals: dto.name.trim(), mode: 'insensitive' },
          status: { in: [MealPlanStatus.ACTIVE, MealPlanStatus.INACTIVE] },
        },
      });
      if (existing) {
        throw new ConflictException(`Meal plan with name "${dto.name.trim()}" already exists in this property`);
      }

      const created = await tx.mealPlan.create({
        data: {
          organizationId,
          propertyId,
          name: dto.name.trim(),
          description: dto.description || null,
          price,
          billingFrequency: dto.billingFrequency || BillingFrequency.MONTHLY,
          status: MealPlanStatus.ACTIVE,
          hasBreakfast,
          hasLunch,
          hasDinner,
          effectiveFrom,
          effectiveTo,
        },
        include: {
          _count: { select: { subscriptions: true, charges: true } },
        },
      });

      await this.writeAuditLog(
        tx,
        organizationId,
        userId,
        'MEAL_PLAN_CREATED',
        'MealPlan',
        created.id,
        { name: created.name, price: price.toString() }
      );

      return created;
    });

    return this.mapPlanToDto(plan);
  }

  async getPlans(
    organizationId: string,
    propertyId: string,
    status?: MealPlanStatus
  ): Promise<MealPlanDto[]> {
    await this.validateProperty(organizationId, propertyId);

    const where: Prisma.MealPlanWhereInput = {
      organizationId,
      propertyId,
      ...(status ? { status } : {}),
    };

    const plans = await this.prisma.mealPlan.findMany({
      where,
      include: {
        _count: { select: { subscriptions: true, charges: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return plans.map((p) => this.mapPlanToDto(p));
  }

  async getPlanById(
    organizationId: string,
    propertyId: string,
    planId: string
  ): Promise<MealPlanDto> {
    await this.validateProperty(organizationId, propertyId);

    const plan = await this.prisma.mealPlan.findFirst({
      where: { id: planId, propertyId, organizationId },
      include: {
        _count: { select: { subscriptions: true, charges: true } },
      },
    });

    if (!plan) {
      throw new NotFoundException(`Meal plan ${planId} not found`);
    }

    return this.mapPlanToDto(plan);
  }

  async updatePlan(
    organizationId: string,
    propertyId: string,
    planId: string,
    dto: UpdateMealPlanDto,
    userId: string
  ): Promise<MealPlanDto> {
    await this.validateProperty(organizationId, propertyId);

    const plan = await this.prisma.mealPlan.findFirst({
      where: { id: planId, propertyId, organizationId },
    });
    if (!plan) {
      throw new NotFoundException(`Meal plan ${planId} not found`);
    }

    let price: Prisma.Decimal | undefined;
    if (dto.price !== undefined) {
      price = new Prisma.Decimal(dto.price);
      if (price.isNegative() || price.isZero()) {
        throw new BadRequestException('Meal plan price must be strictly greater than zero');
      }
    }

    const newBreakfast = dto.hasBreakfast !== undefined ? dto.hasBreakfast : plan.hasBreakfast;
    const newLunch = dto.hasLunch !== undefined ? dto.hasLunch : plan.hasLunch;
    const newDinner = dto.hasDinner !== undefined ? dto.hasDinner : plan.hasDinner;

    if (!newBreakfast && !newLunch && !newDinner) {
      throw new BadRequestException('At least one meal (Breakfast, Lunch, or Dinner) must be included in the meal plan');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.mealPlan.update({
        where: { id: planId },
        data: {
          ...(dto.name ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(price !== undefined ? { price } : {}),
          ...(dto.billingFrequency ? { billingFrequency: dto.billingFrequency } : {}),
          ...(dto.status ? { status: dto.status } : {}),
          ...(dto.hasBreakfast !== undefined ? { hasBreakfast: dto.hasBreakfast } : {}),
          ...(dto.hasLunch !== undefined ? { hasLunch: dto.hasLunch } : {}),
          ...(dto.hasDinner !== undefined ? { hasDinner: dto.hasDinner } : {}),
          ...(dto.effectiveFrom !== undefined ? { effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : null } : {}),
          ...(dto.effectiveTo !== undefined ? { effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null } : {}),
        },
        include: {
          _count: { select: { subscriptions: true, charges: true } },
        },
      });

      await this.writeAuditLog(
        tx,
        organizationId,
        userId,
        'MEAL_PLAN_UPDATED',
        'MealPlan',
        planId,
        dto
      );

      return res;
    });

    return this.mapPlanToDto(updated);
  }

  // ----------------------------------------------------------------------------
  // MEAL SUBSCRIPTIONS
  // ----------------------------------------------------------------------------

  async createSubscription(
    organizationId: string,
    propertyId: string,
    dto: CreateMealSubscriptionDto,
    userId: string
  ): Promise<MealSubscriptionDto> {
    await this.validateProperty(organizationId, propertyId);

    // Validate tenant exists, belongs to org, and is currently checked into this PG property
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: dto.tenantId, organizationId, deletedAt: null },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${dto.tenantId} not found`);
    }

    const activeCheckIn = await this.prisma.checkIn.findFirst({
      where: {
        tenantId: dto.tenantId,
        propertyId,
        organizationId,
        status: CheckInStatus.CHECKED_IN,
      },
    });
    if (!activeCheckIn) {
      throw new BadRequestException(`Tenant ${dto.tenantId} is not actively checked into this PG property`);
    }

    // Validate meal plan exists, belongs to property, and is active (not ARCHIVED or INACTIVE)
    const plan = await this.prisma.mealPlan.findFirst({
      where: { id: dto.mealPlanId, propertyId, organizationId, status: MealPlanStatus.ACTIVE },
    });
    if (!plan) {
      throw new NotFoundException(`Active meal plan ${dto.mealPlanId} not found in this property`);
    }

    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : null;

    if (endDate && endDate < startDate) {
      throw new BadRequestException('Subscription endDate cannot be earlier than startDate');
    }

    const sub = await this.prisma.$transaction(async (tx) => {
      // Advisory lock to serialize subscription creations for this tenant in property
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'meal_sub_' + organizationId + '_' + propertyId + '_' + dto.tenantId}))`;

      // Prevent conflicting active subscriptions for the same tenant overlapping the date range
      const existingActiveSubs = await tx.mealSubscription.findMany({
        where: {
          tenantId: dto.tenantId,
          propertyId,
          organizationId,
          status: MealSubscriptionStatus.ACTIVE,
        },
      });

      for (const existing of existingActiveSubs) {
        const existingEnd = existing.endDate ? new Date(existing.endDate) : new Date('2099-12-31');
        const newEnd = endDate ? new Date(endDate) : new Date('2099-12-31');

        // Check if date ranges overlap: [startDate, newEnd] and [existing.startDate, existingEnd]
        if (startDate <= existingEnd && newEnd >= existing.startDate) {
          throw new ConflictException(
            `Tenant already has an active meal subscription (ID: ${existing.id}) overlapping this period.`
          );
        }
      }

      const created = await tx.mealSubscription.create({
        data: {
          organizationId,
          propertyId,
          tenantId: dto.tenantId,
          mealPlanId: dto.mealPlanId,
          startDate,
          endDate,
          status: MealSubscriptionStatus.ACTIVE,
        },
        include: {
          tenant: { select: { id: true, firstName: true, lastName: true, phone: true, status: true } },
          mealPlan: { select: { id: true, name: true, price: true, billingFrequency: true } },
        },
      });

      await this.writeAuditLog(
        tx,
        organizationId,
        userId,
        'MEAL_SUBSCRIPTION_CREATED',
        'MealSubscription',
        created.id,
        { tenantId: dto.tenantId, mealPlanId: dto.mealPlanId, startDate: startDate.toISOString() }
      );

      return created;
    });

    return this.mapSubscriptionToDto(sub);
  }

  async getSubscriptions(
    organizationId: string,
    propertyId: string,
    tenantId?: string,
    status?: MealSubscriptionStatus
  ): Promise<MealSubscriptionDto[]> {
    await this.validateProperty(organizationId, propertyId);

    const where: Prisma.MealSubscriptionWhereInput = {
      organizationId,
      propertyId,
      ...(tenantId ? { tenantId } : {}),
      ...(status ? { status } : {}),
    };

    const subs = await this.prisma.mealSubscription.findMany({
      where,
      include: {
        tenant: { select: { id: true, firstName: true, lastName: true, phone: true, status: true } },
        mealPlan: { select: { id: true, name: true, price: true, billingFrequency: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return subs.map((s) => this.mapSubscriptionToDto(s));
  }

  async updateSubscription(
    organizationId: string,
    propertyId: string,
    subscriptionId: string,
    dto: UpdateMealSubscriptionDto,
    userId: string
  ): Promise<MealSubscriptionDto> {
    await this.validateProperty(organizationId, propertyId);

    const sub = await this.prisma.mealSubscription.findFirst({
      where: { id: subscriptionId, propertyId, organizationId },
    });
    if (!sub) {
      throw new NotFoundException(`Meal subscription ${subscriptionId} not found`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.mealSubscription.update({
        where: { id: subscriptionId },
        data: {
          ...(dto.status ? { status: dto.status } : {}),
          ...(dto.endDate !== undefined ? { endDate: dto.endDate ? new Date(dto.endDate) : null } : {}),
        },
        include: {
          tenant: { select: { id: true, firstName: true, lastName: true, phone: true, status: true } },
          mealPlan: { select: { id: true, name: true, price: true, billingFrequency: true } },
        },
      });

      await this.writeAuditLog(
        tx,
        organizationId,
        userId,
        'MEAL_SUBSCRIPTION_UPDATED',
        'MealSubscription',
        subscriptionId,
        dto
      );

      return res;
    });

    return this.mapSubscriptionToDto(updated);
  }

  // ----------------------------------------------------------------------------
  // DAILY ATTENDANCE & MATRIX
  // ----------------------------------------------------------------------------

  async recordAttendance(
    organizationId: string,
    propertyId: string,
    dto: RecordMealAttendanceDto,
    userId: string
  ): Promise<MealRecordDto> {
    await this.validateProperty(organizationId, propertyId);

    const tenant = await this.prisma.tenant.findFirst({
      where: { id: dto.tenantId, organizationId, deletedAt: null },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${dto.tenantId} not found`);
    }

    const activeCheckIn = await this.prisma.checkIn.findFirst({
      where: {
        tenantId: dto.tenantId,
        propertyId,
        organizationId,
        status: CheckInStatus.CHECKED_IN,
      },
    });
    if (!activeCheckIn) {
      throw new BadRequestException(`Tenant ${dto.tenantId} is not actively checked into this PG property`);
    }

    const mealDate = new Date(dto.mealDate);
    const normalizedDate = new Date(Date.UTC(mealDate.getUTCFullYear(), mealDate.getUTCMonth(), mealDate.getUTCDate()));

    const record = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.mealRecord.findUnique({
        where: {
          tenantId_mealDate_mealType: {
            tenantId: dto.tenantId,
            mealDate: normalizedDate,
            mealType: dto.mealType,
          },
        },
      });

      let res: any;
      if (existing) {
        res = await tx.mealRecord.update({
          where: { id: existing.id },
          data: {
            status: dto.status,
            recordedBy: userId,
            notes: dto.notes !== undefined ? dto.notes : existing.notes,
          },
          include: {
            tenant: { select: { id: true, firstName: true, lastName: true, phone: true } },
          },
        });
      } else {
        res = await tx.mealRecord.create({
          data: {
            organizationId,
            propertyId,
            tenantId: dto.tenantId,
            mealDate: normalizedDate,
            mealType: dto.mealType,
            status: dto.status,
            recordedBy: userId,
            notes: dto.notes || null,
          },
          include: {
            tenant: { select: { id: true, firstName: true, lastName: true, phone: true } },
          },
        });
      }

      await this.writeAuditLog(
        tx,
        organizationId,
        userId,
        'MEAL_RECORD_CREATED',
        'MealRecord',
        res.id,
        {
          tenantId: dto.tenantId,
          mealDate: normalizedDate.toISOString().split('T')[0],
          mealType: dto.mealType,
          status: dto.status,
        }
      );

      return res;
    });

    return this.mapRecordToDto(record);
  }

  async bulkRecordAttendance(
    organizationId: string,
    propertyId: string,
    dto: BulkRecordMealAttendanceDto,
    userId: string
  ): Promise<{ count: number }> {
    await this.validateProperty(organizationId, propertyId);

    const mealDate = new Date(dto.mealDate);
    const normalizedDate = new Date(Date.UTC(mealDate.getUTCFullYear(), mealDate.getUTCMonth(), mealDate.getUTCDate()));

    await this.prisma.$transaction(async (tx) => {
      for (const entry of dto.records) {
        // Validate tenant is checked in
        const activeCheckIn = await tx.checkIn.findFirst({
          where: {
            tenantId: entry.tenantId,
            propertyId,
            organizationId,
            status: CheckInStatus.CHECKED_IN,
          },
        });
        if (!activeCheckIn) {
          throw new BadRequestException(`Tenant ${entry.tenantId} is not actively checked into this PG property`);
        }

        await tx.mealRecord.upsert({
          where: {
            tenantId_mealDate_mealType: {
              tenantId: entry.tenantId,
              mealDate: normalizedDate,
              mealType: dto.mealType,
            },
          },
          update: {
            status: entry.status,
            recordedBy: userId,
            notes: entry.notes || null,
          },
          create: {
            organizationId,
            propertyId,
            tenantId: entry.tenantId,
            mealDate: normalizedDate,
            mealType: dto.mealType,
            status: entry.status,
            recordedBy: userId,
            notes: entry.notes || null,
          },
        });
      }

      await this.writeAuditLog(
        tx,
        organizationId,
        userId,
        'MEAL_RECORD_BULK_RECORDED',
        'MealRecord',
        propertyId,
        {
          mealDate: normalizedDate.toISOString().split('T')[0],
          mealType: dto.mealType,
          count: dto.records.length,
        }
      );
    });

    return { count: dto.records.length };
  }

  async getDailyMatrix(
    organizationId: string,
    propertyId: string,
    dateString: string,
    floorId?: string,
    roomId?: string
  ): Promise<DailyMealMatrixRowDto[]> {
    await this.validateProperty(organizationId, propertyId);

    const targetDate = new Date(dateString);
    const normalizedDate = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate()));

    // Find all active check-ins in the PG property
    const activeCheckIns = await this.prisma.checkIn.findMany({
      where: {
        organizationId,
        propertyId,
        status: CheckInStatus.CHECKED_IN,
        ...(roomId ? { bed: { roomId } } : {}),
        ...(floorId ? { bed: { room: { floorId } } } : {}),
      },
      include: {
        tenant: true,
        bed: {
          include: {
            room: {
              include: {
                floor: true,
              },
            },
          },
        },
      },
      orderBy: [
        { bed: { room: { floor: { floorNumber: 'asc' } } } },
        { bed: { room: { roomNumber: 'asc' } } },
        { bed: { bedNumber: 'asc' } },
      ],
    });

    const tenantIds = activeCheckIns.map((c) => c.tenantId);

    // Fetch active meal subscriptions for these tenants
    const subscriptions = await this.prisma.mealSubscription.findMany({
      where: {
        tenantId: { in: tenantIds },
        organizationId,
        propertyId,
        status: MealSubscriptionStatus.ACTIVE,
      },
      include: {
        mealPlan: true,
      },
    });
    const subMap = new Map(subscriptions.map((s) => [s.tenantId, s]));

    // Fetch meal records for normalized date
    const records = await this.prisma.mealRecord.findMany({
      where: {
        tenantId: { in: tenantIds },
        propertyId,
        organizationId,
        mealDate: normalizedDate,
      },
    });

    const recordMap = new Map<string, { [key in MealType]?: MealRecordStatus }>();
    for (const r of records) {
      if (!recordMap.has(r.tenantId)) {
        recordMap.set(r.tenantId, {});
      }
      recordMap.get(r.tenantId)![r.mealType as unknown as MealType] = r.status as unknown as MealRecordStatus;
    }

    return activeCheckIns.map((c) => {
      const sub = subMap.get(c.tenantId);
      const tenantRecords = recordMap.get(c.tenantId) || {};

      return {
        tenantId: c.tenantId,
        tenantName: `${c.tenant.firstName} ${c.tenant.lastName}`,
        phone: c.tenant.phone,
        roomNumber: c.bed?.room?.roomNumber || null,
        floorNumber: c.bed?.room?.floor?.floorNumber || null,
        subscription: sub ? {
          id: sub.id,
          planName: sub.mealPlan.name,
          status: sub.status as unknown as MealSubscriptionStatus,
        } : null,
        breakfast: tenantRecords[MealType.BREAKFAST] || null,
        lunch: tenantRecords[MealType.LUNCH] || null,
        dinner: tenantRecords[MealType.DINNER] || null,
      };
    });
  }

  async getRecords(
    organizationId: string,
    propertyId: string,
    date?: string,
    mealType?: MealType,
    tenantId?: string
  ): Promise<MealRecordDto[]> {
    await this.validateProperty(organizationId, propertyId);

    let normalizedDate: Date | undefined;
    if (date) {
      const d = new Date(date);
      normalizedDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    }

    const where: Prisma.MealRecordWhereInput = {
      organizationId,
      propertyId,
      ...(normalizedDate ? { mealDate: normalizedDate } : {}),
      ...(mealType ? { mealType } : {}),
      ...(tenantId ? { tenantId } : {}),
    };

    const records = await this.prisma.mealRecord.findMany({
      where,
      include: {
        tenant: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
      orderBy: { mealDate: 'desc' },
    });

    return records.map((r) => this.mapRecordToDto(r));
  }

  // ----------------------------------------------------------------------------
  // MEAL CHARGES & INVOICING INTEGRATION
  // ----------------------------------------------------------------------------

  async generateCharges(
    organizationId: string,
    propertyId: string,
    dto: GenerateMealChargesDto,
    userId: string
  ): Promise<MealChargeDto[]> {
    await this.validateProperty(organizationId, propertyId);

    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);
    const billingMode = dto.billingMode || MealBillingMode.SUBSCRIPTION;

    return this.prisma.$transaction(async (tx) => {
      // 1. Transaction-level advisory lock to serialize charge generation runs for this property and period
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'meal_charge_' + organizationId + '_' + propertyId + '_' + periodStart.toISOString() + '_' + periodEnd.toISOString() + '_' + billingMode}))`;

      const createdCharges: any[] = [];

      if (billingMode === MealBillingMode.SUBSCRIPTION) {
        // Query active subscriptions in the property overlapping the billing period
        const activeSubs = await tx.mealSubscription.findMany({
          where: {
            organizationId,
            propertyId,
            status: MealSubscriptionStatus.ACTIVE,
            startDate: { lte: periodEnd },
            OR: [
              { endDate: null },
              { endDate: { gte: periodStart } },
            ],
          },
          include: {
            mealPlan: true,
            tenant: { select: { id: true, firstName: true, lastName: true, phone: true } },
          },
        });

        // 2. Check if all active subscriptions already have charges generated for this period (Idempotency)
        for (const sub of activeSubs) {
          const existing = await tx.mealCharge.findFirst({
            where: {
              organizationId,
              propertyId,
              tenantId: sub.tenantId,
              mealPlanId: sub.mealPlanId,
              periodStart,
              periodEnd,
            },
            include: {
              tenant: { select: { id: true, firstName: true, lastName: true, phone: true } },
              mealPlan: { select: { id: true, name: true, price: true } },
              invoice: { select: { id: true, invoiceNumber: true, status: true, totalAmount: true } },
            },
          });

          if (!existing) {
            const amount = sub.mealPlan.price;

            const charge = await tx.mealCharge.create({
              data: {
                organizationId,
                propertyId,
                tenantId: sub.tenantId,
                mealPlanId: sub.mealPlanId,
                mealRecordId: null,
                periodStart,
                periodEnd,
                billingMode: MealBillingMode.SUBSCRIPTION,
                amount,
                status: MealChargeStatus.PENDING,
              },
              include: {
                tenant: { select: { id: true, firstName: true, lastName: true, phone: true } },
                mealPlan: { select: { id: true, name: true, price: true } },
                invoice: { select: { id: true, invoiceNumber: true, status: true, totalAmount: true } },
              },
            });
            createdCharges.push(charge);
          } else {
            createdCharges.push(existing);
          }
        }
      }

      // 3. Auto-invoicing integration using single-transaction client propagation (tx)
      if (dto.autoInvoice) {
        for (const charge of createdCharges) {
          // Only create invoice if charge is still PENDING
          if (charge.status === MealChargeStatus.PENDING && charge.amount.greaterThan(0)) {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 7);

            const planName = charge.mealPlan?.name || 'Meal Plan';
            const invoiceDto = await this.invoicesService.createInvoice(
              organizationId,
              {
                tenantId: charge.tenantId,
                propertyId,
                issueDate: new Date().toISOString(),
                dueDate: dueDate.toISOString(),
                lines: [
                  {
                    description: `Meal Subscription - ${planName} (${periodStart.toISOString().split('T')[0]} to ${periodEnd.toISOString().split('T')[0]})`,
                    chargeType: ChargeType.OTHER,
                    quantity: 1,
                    unitAmount: charge.amount.toNumber(),
                  },
                ],
              },
              userId,
              tx
            );

            // Issue invoice to trigger double-entry balanced ledger entries on the SAME tx
            await this.invoicesService.issueInvoice(organizationId, invoiceDto.id, userId, tx);

            // Update charge with invoice link
            await tx.mealCharge.update({
              where: { id: charge.id },
              data: {
                status: MealChargeStatus.INVOICED,
                invoiceId: invoiceDto.id,
              },
            });

            charge.status = MealChargeStatus.INVOICED;
            charge.invoiceId = invoiceDto.id;
          }
        }
      }

      await this.writeAuditLog(
        tx,
        organizationId,
        userId,
        'MEAL_CHARGE_GENERATED',
        'MealPlan',
        propertyId,
        {
          chargesCount: createdCharges.length,
          billingMode,
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
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
    status?: MealChargeStatus
  ): Promise<MealChargeDto[]> {
    await this.validateProperty(organizationId, propertyId);

    const where: Prisma.MealChargeWhereInput = {
      organizationId,
      propertyId,
      ...(tenantId ? { tenantId } : {}),
      ...(status ? { status } : {}),
    };

    const charges = await this.prisma.mealCharge.findMany({
      where,
      include: {
        tenant: { select: { id: true, firstName: true, lastName: true, phone: true } },
        mealPlan: { select: { id: true, name: true, price: true } },
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
  ): Promise<MealSummaryDto> {
    await this.validateProperty(organizationId, propertyId);

    const activePlansCount = await this.prisma.mealPlan.count({
      where: { organizationId, propertyId, status: MealPlanStatus.ACTIVE },
    });

    const activeSubscriptionsCount = await this.prisma.mealSubscription.count({
      where: { organizationId, propertyId, status: MealSubscriptionStatus.ACTIVE },
    });

    const today = new Date();
    const normalizedToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    const todayBreakfastCount = await this.prisma.mealRecord.count({
      where: {
        organizationId,
        propertyId,
        mealDate: normalizedToday,
        mealType: MealType.BREAKFAST,
        status: MealRecordStatus.CONSUMED,
      },
    });

    const todayLunchCount = await this.prisma.mealRecord.count({
      where: {
        organizationId,
        propertyId,
        mealDate: normalizedToday,
        mealType: MealType.LUNCH,
        status: MealRecordStatus.CONSUMED,
      },
    });

    const todayDinnerCount = await this.prisma.mealRecord.count({
      where: {
        organizationId,
        propertyId,
        mealDate: normalizedToday,
        mealType: MealType.DINNER,
        status: MealRecordStatus.CONSUMED,
      },
    });

    const charges = await this.prisma.mealCharge.findMany({
      where: { organizationId, propertyId },
      select: { amount: true },
    });

    const currentMealRevenue = charges.reduce(
      (acc, c) => acc.add(c.amount),
      new Prisma.Decimal(0)
    );

    return {
      activePlansCount,
      activeSubscriptionsCount,
      todayBreakfastCount,
      todayLunchCount,
      todayDinnerCount,
      currentMealRevenue: currentMealRevenue.toNumber(),
    };
  }

  async getTenantMealSummary(
    organizationId: string,
    tenantId: string
  ): Promise<TenantMealSummaryDto> {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId, organizationId, deletedAt: null },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    const subscription = await this.prisma.mealSubscription.findFirst({
      where: { tenantId, organizationId, status: MealSubscriptionStatus.ACTIVE },
      include: {
        mealPlan: true,
        tenant: { select: { id: true, firstName: true, lastName: true, phone: true, status: true } },
      },
    });

    const today = new Date();
    const normalizedToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    const todayRecords = await this.prisma.mealRecord.findMany({
      where: { tenantId, organizationId, mealDate: normalizedToday },
      include: {
        tenant: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    });

    const recentCharges = await this.prisma.mealCharge.findMany({
      where: { tenantId, organizationId },
      include: {
        tenant: { select: { id: true, firstName: true, lastName: true, phone: true } },
        mealPlan: { select: { id: true, name: true, price: true } },
        invoice: { select: { id: true, invoiceNumber: true, status: true, totalAmount: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      tenantId,
      activePlan: subscription?.mealPlan ? this.mapPlanToDto(subscription.mealPlan) : null,
      subscription: subscription ? this.mapSubscriptionToDto(subscription) : null,
      todayRecords: todayRecords.map((r) => this.mapRecordToDto(r)),
      recentCharges: recentCharges.map((c) => this.mapChargeToDto(c)),
    };
  }

  // ----------------------------------------------------------------------------
  // DTO MAPPERS
  // ----------------------------------------------------------------------------

  private toIso(val: any): string {
    if (!val) return new Date().toISOString();
    if (typeof val === 'string') return val;
    if (val instanceof Date) return val.toISOString();
    return new Date(val).toISOString();
  }

  private toIsoOrNull(val: any): string | null {
    if (!val) return null;
    if (typeof val === 'string') return val;
    if (val instanceof Date) return val.toISOString();
    return new Date(val).toISOString();
  }

  private mapPlanToDto(plan: any): MealPlanDto {
    return {
      id: plan.id,
      organizationId: plan.organizationId,
      propertyId: plan.propertyId,
      name: plan.name,
      description: plan.description,
      price: plan.price instanceof Prisma.Decimal ? plan.price.toNumber() : Number(plan.price),
      billingFrequency: plan.billingFrequency,
      status: plan.status,
      hasBreakfast: plan.hasBreakfast,
      hasLunch: plan.hasLunch,
      hasDinner: plan.hasDinner,
      effectiveFrom: this.toIsoOrNull(plan.effectiveFrom),
      effectiveTo: this.toIsoOrNull(plan.effectiveTo),
      createdAt: this.toIso(plan.createdAt),
      updatedAt: this.toIso(plan.updatedAt),
      _count: plan._count,
    };
  }

  private mapSubscriptionToDto(sub: any): MealSubscriptionDto {
    return {
      id: sub.id,
      organizationId: sub.organizationId,
      propertyId: sub.propertyId,
      tenantId: sub.tenantId,
      mealPlanId: sub.mealPlanId,
      startDate: this.toIso(sub.startDate),
      endDate: this.toIsoOrNull(sub.endDate),
      status: sub.status,
      createdAt: this.toIso(sub.createdAt),
      updatedAt: this.toIso(sub.updatedAt),
      tenant: sub.tenant,
      mealPlan: sub.mealPlan ? {
        id: sub.mealPlan.id,
        name: sub.mealPlan.name,
        price: sub.mealPlan.price instanceof Prisma.Decimal ? sub.mealPlan.price.toNumber() : Number(sub.mealPlan.price),
        billingFrequency: sub.mealPlan.billingFrequency,
      } : undefined,
    };
  }

  private mapRecordToDto(record: any): MealRecordDto {
    return {
      id: record.id,
      organizationId: record.organizationId,
      propertyId: record.propertyId,
      tenantId: record.tenantId,
      mealDate: this.toIso(record.mealDate),
      mealType: record.mealType,
      status: record.status,
      recordedAt: this.toIso(record.recordedAt),
      recordedBy: record.recordedBy,
      notes: record.notes,
      createdAt: this.toIso(record.createdAt),
      updatedAt: this.toIso(record.updatedAt),
      tenant: record.tenant,
    };
  }

  private mapChargeToDto(charge: any): MealChargeDto {
    return {
      id: charge.id,
      organizationId: charge.organizationId,
      propertyId: charge.propertyId,
      tenantId: charge.tenantId,
      mealPlanId: charge.mealPlanId,
      mealRecordId: charge.mealRecordId,
      periodStart: this.toIso(charge.periodStart),
      periodEnd: this.toIso(charge.periodEnd),
      billingMode: charge.billingMode,
      amount: charge.amount instanceof Prisma.Decimal ? charge.amount.toNumber() : Number(charge.amount),
      status: charge.status,
      invoiceId: charge.invoiceId,
      invoiceLineId: charge.invoiceLineId,
      createdAt: this.toIso(charge.createdAt),
      updatedAt: this.toIso(charge.updatedAt),
      tenant: charge.tenant,
      mealPlan: charge.mealPlan ? {
        id: charge.mealPlan.id,
        name: charge.mealPlan.name,
        price: charge.mealPlan.price instanceof Prisma.Decimal ? charge.mealPlan.price.toNumber() : Number(charge.mealPlan.price),
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
