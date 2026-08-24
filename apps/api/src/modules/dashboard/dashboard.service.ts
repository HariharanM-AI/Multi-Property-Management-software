import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  PortfolioDashboardDto,
  DashboardKpisDto,
  PortfolioCapacityDto,
  DashboardFinancialsCurrentMonthDto,
  PropertyCardDto,
  PropertyOccupancyBadge,
  DashboardActionItemsDto,
  OverdueInvoiceItemDto,
  UrgentMaintenanceItemDto,
  UpcomingRenewalItemDto,
  DashboardActivityItemDto,
  DashboardFilterQuery,
  PropertyType,
  PropertyStatus,
} from '@propertyos/types';
import { Prisma } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 1. GET /api/v1/dashboard/summary
   * Authoritative Portfolio Executive Summary, KPI StatCards, Property Performance Cards, Action Items & Activity.
   */
  async getPortfolioSummary(
    organizationId: string,
    filter?: DashboardFilterQuery
  ): Promise<PortfolioDashboardDto> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // --------------------------------------------------------------------------
    // 1. Properties Query with Filters & Scoping
    // --------------------------------------------------------------------------
    const whereProperty: Prisma.PropertyWhereInput = {
      organizationId,
      deletedAt: null,
    };

    if (filter?.propertyType && filter.propertyType !== 'ALL') {
      whereProperty.propertyType = filter.propertyType;
    }
    if (filter?.city) {
      whereProperty.city = { contains: filter.city, mode: 'insensitive' };
    }
    if (filter?.status && filter.status !== 'ALL') {
      whereProperty.status = filter.status as PropertyStatus;
    }

    const properties = await this.prisma.property.findMany({
      where: whereProperty,
      orderBy: { createdAt: 'desc' },
      include: {
        floors: {
          where: { deletedAt: null },
          include: {
            rooms: {
              where: { deletedAt: null },
              include: {
                beds: {
                  where: { deletedAt: null },
                },
              },
            },
          },
        },
        rentalUnits: {
          where: { deletedAt: null },
        },
      },
    });

    // Counts across all organization properties (unfiltered for total stats)
    const allOrgProperties = await this.prisma.property.findMany({
      where: { organizationId, deletedAt: null },
      select: { id: true, status: true, propertyType: true },
    });

    const totalProperties = allOrgProperties.length;
    const activeProperties = allOrgProperties.filter((p) => p.status === 'ACTIVE').length;
    const pgCount = allOrgProperties.filter((p) => p.propertyType === PropertyType.PG && p.status === 'ACTIVE').length;
    const rentalCount = allOrgProperties.filter(
      (p) => p.propertyType === PropertyType.RENTAL_HOUSE && p.status === 'ACTIVE'
    ).length;

    // --------------------------------------------------------------------------
    // 2. Capacity & Occupancy Aggregations
    // --------------------------------------------------------------------------
    let totalBeds = 0;
    let occupiedBeds = 0;
    let availableBeds = 0;

    let totalUnits = 0;
    let occupiedUnits = 0;
    let availableUnits = 0;

    for (const prop of properties) {
      if (prop.propertyType === PropertyType.PG) {
        for (const floor of prop.floors) {
          for (const room of floor.rooms) {
            for (const bed of room.beds) {
              totalBeds++;
              if (bed.status === 'OCCUPIED') {
                occupiedBeds++;
              } else if (bed.status === 'AVAILABLE') {
                availableBeds++;
              }
            }
          }
        }
      } else if (prop.propertyType === PropertyType.RENTAL_HOUSE) {
        for (const unit of prop.rentalUnits) {
          totalUnits++;
          if (unit.status === 'OCCUPIED') {
            occupiedUnits++;
          } else if (unit.status === 'AVAILABLE') {
            availableUnits++;
          }
        }
      }
    }

    const totalCapacityUnits = totalBeds + totalUnits;
    const totalOccupiedUnits = occupiedBeds + occupiedUnits;
    let blendedOccupancyRate = 0;
    if (totalCapacityUnits > 0) {
      blendedOccupancyRate = Number(((totalOccupiedUnits / totalCapacityUnits) * 100).toFixed(2));
    }

    const capacityDto: PortfolioCapacityDto = {
      totalBeds,
      occupiedBeds,
      availableBeds,
      totalUnits,
      occupiedUnits,
      availableUnits,
      blendedOccupancyRate,
    };

    // --------------------------------------------------------------------------
    // 3. Current Calendar Month Financials (Deterministic Decimal Arithmetic)
    // --------------------------------------------------------------------------
    // A. Current Month Invoices & Lines
    const currentMonthInvoices = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        issueDate: { gte: startOfMonth, lte: endOfMonth },
        status: { notIn: ['VOID', 'CANCELLED', 'DRAFT'] },
      },
      include: {
        lines: true,
      },
    });

    let monthlyInvoicedDecimal = new Prisma.Decimal(0);
    const propertyInvoicedMap = new Map<string, Prisma.Decimal>();

    for (const inv of currentMonthInvoices) {
      let invSum = new Prisma.Decimal(0);
      for (const line of inv.lines) {
        const lineAmt = new Prisma.Decimal(line.totalAmount);
        monthlyInvoicedDecimal = monthlyInvoicedDecimal.plus(lineAmt);
        invSum = invSum.plus(lineAmt);
      }
      if (inv.propertyId) {
        const existing = propertyInvoicedMap.get(inv.propertyId) || new Prisma.Decimal(0);
        propertyInvoicedMap.set(inv.propertyId, existing.plus(invSum));
      }
    }

    // B. Current Month Payments
    const currentMonthPayments = await this.prisma.payment.findMany({
      where: {
        organizationId,
        status: 'RECORDED',
        paymentDate: { gte: startOfMonth, lte: endOfMonth },
      },
      include: {
        allocations: {
          include: {
            invoice: {
              select: { propertyId: true },
            },
          },
        },
      },
    });

    let monthlyCollectedDecimal = new Prisma.Decimal(0);
    const propertyCollectedMap = new Map<string, Prisma.Decimal>();

    for (const pay of currentMonthPayments) {
      const payAmt = new Prisma.Decimal(pay.amount);
      monthlyCollectedDecimal = monthlyCollectedDecimal.plus(payAmt);

      if (pay.allocations.length > 0) {
        for (const alloc of pay.allocations) {
          const propId = alloc.invoice?.propertyId;
          if (propId) {
            const existing = propertyCollectedMap.get(propId) || new Prisma.Decimal(0);
            propertyCollectedMap.set(propId, existing.plus(new Prisma.Decimal(alloc.amount)));
          }
        }
      }
    }

    // C. Current Month Operational Expenses
    const currentMonthExpenses = await this.prisma.expenseRecord.findMany({
      where: {
        organizationId,
        expenseDate: { gte: startOfMonth, lte: endOfMonth },
      },
      select: {
        amount: true,
        propertyId: true,
      },
    });

    let monthlyExpensesDecimal = new Prisma.Decimal(0);
    const propertyExpensesMap = new Map<string, Prisma.Decimal>();

    for (const exp of currentMonthExpenses) {
      const expAmt = new Prisma.Decimal(exp.amount);
      monthlyExpensesDecimal = monthlyExpensesDecimal.plus(expAmt);
      if (exp.propertyId) {
        const existing = propertyExpensesMap.get(exp.propertyId) || new Prisma.Decimal(0);
        propertyExpensesMap.set(exp.propertyId, existing.plus(expAmt));
      }
    }

    // D. Cash NOI & Receivables
    const monthlyNoiDecimal = monthlyCollectedDecimal.minus(monthlyExpensesDecimal);

    const allUnpaidInvoices = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
      },
      include: {
        tenant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        property: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    let totalOutstandingDecimal = new Prisma.Decimal(0);
    const propertyPendingInvoicesMap = new Map<string, { count: number; amount: Prisma.Decimal }>();

    for (const inv of allUnpaidInvoices) {
      const outAmt = new Prisma.Decimal(inv.outstandingAmount);
      totalOutstandingDecimal = totalOutstandingDecimal.plus(outAmt);

      if (inv.propertyId) {
        const existing = propertyPendingInvoicesMap.get(inv.propertyId) || {
          count: 0,
          amount: new Prisma.Decimal(0),
        };
        propertyPendingInvoicesMap.set(inv.propertyId, {
          count: existing.count + 1,
          amount: existing.amount.plus(outAmt),
        });
      }
    }

    let operatingMarginPercentage = 0;
    if (monthlyCollectedDecimal.gt(0)) {
      operatingMarginPercentage = Number(
        monthlyNoiDecimal
          .div(monthlyCollectedDecimal)
          .mul(100)
          .toFixed(2)
      );
    }

    const financialsDto: DashboardFinancialsCurrentMonthDto = {
      invoicedRevenue: monthlyInvoicedDecimal.toFixed(2),
      collectedRevenue: monthlyCollectedDecimal.toFixed(2),
      operationalExpenses: monthlyExpensesDecimal.toFixed(2),
      netOperatingIncome: monthlyNoiDecimal.toFixed(2),
      outstandingReceivables: totalOutstandingDecimal.toFixed(2),
      operatingMarginPercentage,
    };

    // --------------------------------------------------------------------------
    // 4. Active Tenants Count
    // --------------------------------------------------------------------------
    const activeStays = await this.prisma.tenantStayHistory.findMany({
      where: {
        tenant: { organizationId },
        checkOutDate: null,
      },
      select: { tenantId: true },
    });

    const activeLeases = await this.prisma.lease.findMany({
      where: {
        tenant: { organizationId },
        status: 'ACTIVE',
      },
      select: { tenantId: true },
    });

    const tenantIdSet = new Set<string>();
    activeStays.forEach((s) => tenantIdSet.add(s.tenantId));
    activeLeases.forEach((l) => tenantIdSet.add(l.tenantId));
    const activeTenantsCount = tenantIdSet.size;

    // --------------------------------------------------------------------------
    // 5. Maintenance Tickets Aggregations per Property
    // --------------------------------------------------------------------------
    const activeTickets = await this.prisma.maintenanceTicket.findMany({
      where: {
        organizationId,
        status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] },
      },
      select: {
        id: true,
        ticketNumber: true,
        title: true,
        priority: true,
        status: true,
        propertyId: true,
        createdAt: true,
        room: { select: { roomNumber: true } },
        rentalUnit: { select: { unitNumber: true } },
        property: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const propertyMaintenanceMap = new Map<string, { openCount: number; inProgressCount: number; hasUrgent: boolean }>();
    for (const t of activeTickets) {
      const existing = propertyMaintenanceMap.get(t.propertyId) || {
        openCount: 0,
        inProgressCount: 0,
        hasUrgent: false,
      };

      if (t.status === 'OPEN' || t.status === 'ASSIGNED') {
        existing.openCount++;
      } else if (t.status === 'IN_PROGRESS') {
        existing.inProgressCount++;
      }

      if (t.priority === 'HIGH' || t.priority === 'URGENT') {
        existing.hasUrgent = true;
      }

      propertyMaintenanceMap.set(t.propertyId, existing);
    }

    // --------------------------------------------------------------------------
    // 6. Property Cards Assembly
    // --------------------------------------------------------------------------
    const propertyCards: PropertyCardDto[] = properties.map((prop) => {
      let pTotal = 0;
      let pOccupied = 0;
      let pAvailable = 0;

      if (prop.propertyType === PropertyType.PG) {
        for (const floor of prop.floors) {
          for (const room of floor.rooms) {
            for (const bed of room.beds) {
              pTotal++;
              if (bed.status === 'OCCUPIED') pOccupied++;
              else if (bed.status === 'AVAILABLE') pAvailable++;
            }
          }
        }
      } else if (prop.propertyType === PropertyType.RENTAL_HOUSE) {
        for (const unit of prop.rentalUnits) {
          pTotal++;
          if (unit.status === 'OCCUPIED') pOccupied++;
          else if (unit.status === 'AVAILABLE') pAvailable++;
        }
      }

      let pOccupancyRate = 0;
      if (pTotal > 0) {
        pOccupancyRate = Number(((pOccupied / pTotal) * 100).toFixed(2));
      }

      let statusBadge: PropertyOccupancyBadge = 'NORMAL';
      if (pTotal === 0 || pOccupancyRate === 0) {
        statusBadge = 'VACANT';
      } else if (pOccupancyRate >= 100) {
        statusBadge = 'FULL';
      } else if (pOccupancyRate >= 80) {
        statusBadge = 'HIGH_OCCUPANCY';
      } else if (pOccupancyRate <= 30) {
        statusBadge = 'LOW_OCCUPANCY';
      }

      const pInvoiced = propertyInvoicedMap.get(prop.id) || new Prisma.Decimal(0);
      const pCollected = propertyCollectedMap.get(prop.id) || new Prisma.Decimal(0);
      const pExpenses = propertyExpensesMap.get(prop.id) || new Prisma.Decimal(0);
      const pNetIncome = pCollected.minus(pExpenses);

      const pMaint = propertyMaintenanceMap.get(prop.id) || {
        openCount: 0,
        inProgressCount: 0,
        hasUrgent: false,
      };

      const pPending = propertyPendingInvoicesMap.get(prop.id) || {
        count: 0,
        amount: new Prisma.Decimal(0),
      };

      return {
        id: prop.id,
        name: prop.name,
        code: prop.code,
        propertyType: prop.propertyType as PropertyType,
        status: prop.status as PropertyStatus,
        city: prop.city,
        address: prop.address,
        capacity: {
          total: pTotal,
          occupied: pOccupied,
          available: pAvailable,
          occupancyRate: pOccupancyRate,
          statusBadge,
        },
        financials: {
          invoicedRevenue: pInvoiced.toFixed(2),
          collectedRevenue: pCollected.toFixed(2),
          operationalExpenses: pExpenses.toFixed(2),
          netIncome: pNetIncome.toFixed(2),
        },
        maintenance: {
          openCount: pMaint.openCount,
          inProgressCount: pMaint.inProgressCount,
          hasUrgent: pMaint.hasUrgent,
        },
        pendingInvoicesCount: pPending.count,
        pendingInvoicesAmount: pPending.amount.toFixed(2),
      };
    });

    // --------------------------------------------------------------------------
    // 7. Action Items Triage
    // --------------------------------------------------------------------------
    const actionItems = await this.getActionItems(organizationId);

    // --------------------------------------------------------------------------
    // 8. Recent Activity Stream
    // --------------------------------------------------------------------------
    const recentActivity = await this.getRecentActivity(organizationId);

    const kpis: DashboardKpisDto = {
      totalProperties,
      activeProperties,
      pgCount,
      rentalCount,
      capacity: capacityDto,
      financials: financialsDto,
      activeTenantsCount,
      urgentActionItemsCount: actionItems.totalActionItemsCount,
    };

    return {
      organizationId,
      kpis,
      propertyCards,
      actionItems,
      recentActivity,
      generatedAt: now.toISOString(),
    };
  }

  /**
   * 2. GET /api/v1/dashboard/action-items
   * Fetches triage operational alerts: Overdue Invoices, Urgent Tickets, and Expiring Leases.
   */
  async getActionItems(organizationId: string): Promise<DashboardActionItemsDto> {
    const now = new Date();

    // A. Overdue Invoices (dueDate < now && outstandingAmount > 0)
    const overdueInvoicesRaw = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        dueDate: { lt: now },
        status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
      },
      include: {
        tenant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        property: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    const overdueInvoices: OverdueInvoiceItemDto[] = overdueInvoicesRaw
      .filter((inv) => new Prisma.Decimal(inv.outstandingAmount).gt(0))
      .map((inv) => {
        const daysOverdue = Math.max(
          1,
          Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24))
        );
        return {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          tenantId: inv.tenantId,
          tenantName: `${inv.tenant.firstName} ${inv.tenant.lastName}`.trim(),
          tenantPhone: inv.tenant.phone,
          propertyId: inv.propertyId || '',
          propertyName: inv.property?.name || 'General Portfolio',
          totalAmount: new Prisma.Decimal(inv.totalAmount).toFixed(2),
          paidAmount: new Prisma.Decimal(inv.paidAmount).toFixed(2),
          outstandingAmount: new Prisma.Decimal(inv.outstandingAmount).toFixed(2),
          dueDate: inv.dueDate.toISOString(),
          daysOverdue,
          status: inv.status,
        };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue);

    // B. Urgent Maintenance Tickets (status IN ('OPEN', 'IN_PROGRESS') && priority IN ('HIGH', 'URGENT'))
    const urgentTicketsRaw = await this.prisma.maintenanceTicket.findMany({
      where: {
        organizationId,
        status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] },
        priority: { in: ['HIGH', 'URGENT'] },
      },
      include: {
        property: { select: { name: true } },
        room: { select: { roomNumber: true } },
        rentalUnit: { select: { unitNumber: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const urgentMaintenance: UrgentMaintenanceItemDto[] = urgentTicketsRaw.map((ticket) => {
      const ageInDays = Math.floor((now.getTime() - new Date(ticket.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      let locationDisplay = 'Common Area';
      if (ticket.room) {
        locationDisplay = `Room ${ticket.room.roomNumber}`;
      } else if (ticket.rentalUnit) {
        locationDisplay = `Unit ${ticket.rentalUnit.unitNumber}`;
      }

      return {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        priority: ticket.priority,
        status: ticket.status,
        propertyId: ticket.propertyId,
        propertyName: ticket.property.name,
        locationDisplay,
        createdAt: ticket.createdAt.toISOString(),
        ageInDays,
      };
    });

    // C. Upcoming Lease Renewals (active leases ending in 0-60 days)
    const sixtyDaysAhead = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const expiringLeasesRaw = await this.prisma.lease.findMany({
      where: {
        rentalUnit: {
          property: { organizationId },
        },
        status: 'ACTIVE',
        endDate: { gte: now, lte: sixtyDaysAhead },
      },
      include: {
        tenant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        rentalUnit: {
          select: {
            id: true,
            unitNumber: true,
            property: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { endDate: 'asc' },
    });

    const upcomingRenewals: UpcomingRenewalItemDto[] = expiringLeasesRaw.map((lease) => {
      const daysRemaining = Math.max(
        0,
        Math.ceil((new Date(lease.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      );
      return {
        id: lease.id,
        tenantId: lease.tenantId,
        tenantName: `${lease.tenant.firstName} ${lease.tenant.lastName}`.trim(),
        tenantPhone: lease.tenant.phone,
        propertyId: lease.rentalUnit.property.id,
        propertyName: lease.rentalUnit.property.name,
        unitId: lease.rentalUnit.id,
        unitNumber: lease.rentalUnit.unitNumber,
        monthlyRent: new Prisma.Decimal(lease.monthlyRent).toFixed(2),
        startDate: lease.startDate.toISOString(),
        endDate: lease.endDate.toISOString(),
        daysRemaining,
      };
    });

    const totalActionItemsCount = overdueInvoices.length + urgentMaintenance.length + upcomingRenewals.length;

    return {
      overdueInvoices,
      urgentMaintenance,
      upcomingRenewals,
      totalActionItemsCount,
    };
  }

  /**
   * 3. GET /api/v1/dashboard/activity
   * Fetches chronological stream of 10 most recent operational events.
   */
  async getRecentActivity(organizationId: string): Promise<DashboardActivityItemDto[]> {
    const activities: DashboardActivityItemDto[] = [];

    // 1. Recent Payments
    const recentPayments = await this.prisma.payment.findMany({
      where: {
        organizationId,
        status: 'RECORDED',
      },
      orderBy: { paymentDate: 'desc' },
      take: 5,
      include: {
        tenant: { select: { firstName: true, lastName: true } },
        allocations: {
          include: {
            invoice: { select: { property: { select: { id: true, name: true } } } },
          },
        },
      },
    });

    for (const pay of recentPayments) {
      const tenantName = pay.tenant ? `${pay.tenant.firstName} ${pay.tenant.lastName}`.trim() : 'Tenant';
      const prop = pay.allocations[0]?.invoice?.property;
      activities.push({
        id: `pay-${pay.id}`,
        type: 'PAYMENT_RECEIVED',
        title: 'Payment Received',
        description: `₹${new Prisma.Decimal(pay.amount).toFixed(2)} received from ${tenantName} via ${pay.paymentMethod}`,
        timestamp: pay.paymentDate.toISOString(),
        propertyId: prop?.id,
        propertyName: prop?.name,
        amount: new Prisma.Decimal(pay.amount).toFixed(2),
      });
    }

    // 2. Recent Maintenance Tickets (Created or Completed)
    const recentTickets = await this.prisma.maintenanceTicket.findMany({
      where: { organizationId },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      include: {
        property: { select: { id: true, name: true } },
      },
    });

    for (const t of recentTickets) {
      const isCompleted = t.status === 'COMPLETED' || t.status === 'VERIFIED' || t.status === 'CLOSED';
      activities.push({
        id: `ticket-${t.id}`,
        type: isCompleted ? 'MAINTENANCE_COMPLETED' : 'MAINTENANCE_CREATED',
        title: isCompleted ? 'Maintenance Completed' : 'Maintenance Request Logged',
        description: `${t.ticketNumber}: ${t.title} (${t.status})`,
        timestamp: t.updatedAt.toISOString(),
        propertyId: t.propertyId,
        propertyName: t.property?.name,
        amount: t.actualCost ? new Prisma.Decimal(t.actualCost).toFixed(2) : undefined,
      });
    }

    // 3. Recent Check-Ins
    const recentCheckIns = await this.prisma.checkIn.findMany({
      where: {
        property: { organizationId },
      },
      orderBy: { checkInDate: 'desc' },
      take: 5,
      include: {
        tenant: { select: { firstName: true, lastName: true } },
        property: { select: { id: true, name: true } },
      },
    });

    for (const cin of recentCheckIns) {
      const tenantName = cin.tenant ? `${cin.tenant.firstName} ${cin.tenant.lastName}`.trim() : 'Resident';
      activities.push({
        id: `checkin-${cin.id}`,
        type: 'TENANT_CHECKED_IN',
        title: 'Resident Checked In',
        description: `${tenantName} completed digital check-in at ${cin.property.name}`,
        timestamp: cin.checkInDate.toISOString(),
        propertyId: cin.propertyId,
        propertyName: cin.property.name,
      });
    }

    // 4. Recent Expenses
    const recentExpenses = await this.prisma.expenseRecord.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        property: { select: { id: true, name: true } },
        category: { select: { name: true } },
      },
    });

    for (const exp of recentExpenses) {
      activities.push({
        id: `exp-${exp.id}`,
        type: 'EXPENSE_RECORDED',
        title: 'Operational Expense Logged',
        description: `₹${new Prisma.Decimal(exp.amount).toFixed(2)} logged for ${exp.title} (${exp.category.name})`,
        timestamp: exp.createdAt.toISOString(),
        propertyId: exp.propertyId || undefined,
        propertyName: exp.property?.name,
        amount: new Prisma.Decimal(exp.amount).toFixed(2),
      });
    }

    // Sort all combined activities descending by timestamp and take top 10
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return activities.slice(0, 10);
  }
}
