import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  PnlStatementDto,
  RevenueBreakdownItemDto,
  ExpenseBreakdownItemDto,
  MonthlyTrendDto,
  OccupancyReportDto,
  PropertyOccupancyItemDto,
  PropertyComparisonReportDto,
  PropertyComparisonItemDto,
  CashFlowReportDto,
  ReportFilterQuery,
  ExpenseCategoryType,
  PropertyType,
} from '@propertyos/types';
import { ReportExportInput } from '@propertyos/validation';
import { Prisma } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to validate property ownership within caller organization.
   * Throws 404 Not Found if property does not belong to organization.
   */
  private async validatePropertyOwnership(organizationId: string, propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, organizationId },
    });
    if (!property) {
      throw new NotFoundException(`Property ${propertyId} not found in this organization`);
    }
    return property;
  }

  /**
   * Helper to normalize date ranges.
   * Defaults to trailing 12 months (or current year) if not specified.
   */
  private normalizeDateRange(startDate?: string, endDate?: string): { start: Date; end: Date } {
    let start: Date;
    let end: Date;

    if (endDate) {
      end = new Date(endDate);
    } else {
      end = new Date();
    }

    if (startDate) {
      start = new Date(startDate);
    } else {
      // Default to 12 months before end date
      start = new Date(end.getFullYear() - 1, end.getMonth(), 1, 0, 0, 0, 0);
    }

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format provided');
    }

    if (start > end) {
      throw new BadRequestException('startDate must be before or equal to endDate');
    }

    return { start, end };
  }

  /**
   * 1. Generates Profit & Loss Statement (P&L) with Real-Time Revenue, Expense & Trend Aggregations.
   */
  async getPnlStatement(organizationId: string, query: ReportFilterQuery): Promise<PnlStatementDto> {
    let propertyName: string | null = null;
    if (query.propertyId) {
      const prop = await this.validatePropertyOwnership(organizationId, query.propertyId);
      propertyName = prop.name;
    }

    const { start, end } = this.normalizeDateRange(query.startDate, query.endDate);

    // --- A. INVOICED REVENUE AGGREGATION ---
    const invoiceWhere: Prisma.InvoiceWhereInput = {
      organizationId,
      status: { not: 'VOID' },
      issueDate: { gte: start, lte: end },
    };
    if (query.propertyId) {
      invoiceWhere.propertyId = query.propertyId;
    }

    const invoices = await this.prisma.invoice.findMany({
      where: invoiceWhere,
      include: {
        lines: true,
      },
    });

    let totalRevenueInvoiced = new Prisma.Decimal(0);
    const revenueCategoryMap: Record<string, { amount: Prisma.Decimal; count: number }> = {};

    for (const inv of invoices) {
      totalRevenueInvoiced = totalRevenueInvoiced.plus(inv.totalAmount);
      for (const line of inv.lines) {
        const cat = line.chargeType || 'OTHER';
        if (!revenueCategoryMap[cat]) {
          revenueCategoryMap[cat] = { amount: new Prisma.Decimal(0), count: 0 };
        }
        revenueCategoryMap[cat].amount = revenueCategoryMap[cat].amount.plus(line.totalAmount);
        revenueCategoryMap[cat].count += 1;
      }
    }

    // --- B. REALIZED CASH COLLECTIONS AGGREGATION ---
    const paymentWhere: Prisma.PaymentWhereInput = {
      organizationId,
      status: 'RECORDED',
      paymentDate: { gte: start, lte: end },
    };
    if (query.propertyId) {
      paymentWhere.allocations = {
        some: {
          invoice: {
            propertyId: query.propertyId,
          },
        },
      };
    }

    const payments = await this.prisma.payment.findMany({
      where: paymentWhere,
    });

    let totalRevenueCollected = new Prisma.Decimal(0);
    for (const p of payments) {
      totalRevenueCollected = totalRevenueCollected.plus(p.amount);
    }

    // --- C. OPERATIONAL EXPENSES AGGREGATION ---
    const expenseWhere: Prisma.ExpenseRecordWhereInput = {
      organizationId,
      expenseDate: { gte: start, lte: end },
    };
    if (query.propertyId) {
      expenseWhere.propertyId = query.propertyId;
    }

    const expenses = await this.prisma.expenseRecord.findMany({
      where: expenseWhere,
      include: {
        category: true,
      },
    });

    let totalExpenses = new Prisma.Decimal(0);
    const expenseCategoryMap: Record<string, { amount: Prisma.Decimal; count: number }> = {};

    for (const exp of expenses) {
      totalExpenses = totalExpenses.plus(exp.amount);
      const catName = exp.category?.name || 'OTHER';
      if (!expenseCategoryMap[catName]) {
        expenseCategoryMap[catName] = { amount: new Prisma.Decimal(0), count: 0 };
      }
      expenseCategoryMap[catName].amount = expenseCategoryMap[catName].amount.plus(exp.amount);
      expenseCategoryMap[catName].count += 1;
    }

    // --- D. NET PROFIT & MARGIN INVARIANTS ---
    const netOperatingIncome = totalRevenueCollected.minus(totalExpenses); // Realized Cash NOI
    const invoicedOperatingProfit = totalRevenueInvoiced.minus(totalExpenses); // Accrual NOI
    const totalOutstandingRevenue = totalRevenueInvoiced.minus(totalRevenueCollected).isNegative()
      ? new Prisma.Decimal(0)
      : totalRevenueInvoiced.minus(totalRevenueCollected);

    let operatingMarginPercentage = 0;
    if (!totalRevenueCollected.isZero()) {
      operatingMarginPercentage = Number(
        netOperatingIncome.dividedBy(totalRevenueCollected).times(100).toFixed(2)
      );
    }

    // --- E. FORMAT CATEGORY BREAKDOWNS ---
    const revenueBreakdown: RevenueBreakdownItemDto[] = Object.entries(revenueCategoryMap).map(
      ([category, val]) => ({
        category,
        amount: val.amount.toFixed(2),
        count: val.count,
        percentage: totalRevenueInvoiced.isZero()
          ? 0
          : Number(val.amount.dividedBy(totalRevenueInvoiced).times(100).toFixed(2)),
      })
    );

    const expenseBreakdown: ExpenseBreakdownItemDto[] = Object.entries(expenseCategoryMap).map(
      ([category, val]) => ({
        category: category as ExpenseCategoryType,
        amount: val.amount.toFixed(2),
        count: val.count,
        percentage: totalExpenses.isZero()
          ? 0
          : Number(val.amount.dividedBy(totalExpenses).times(100).toFixed(2)),
      })
    );

    // --- F. MONTHLY TIME SERIES TRENDS ---
    const trends = this.computeMonthlyTrends(invoices, payments, expenses, start, end);

    return {
      organizationId,
      propertyId: query.propertyId || null,
      propertyName,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      totalRevenueInvoiced: totalRevenueInvoiced.toFixed(2),
      totalRevenueCollected: totalRevenueCollected.toFixed(2),
      totalExpenses: totalExpenses.toFixed(2),
      netOperatingIncome: netOperatingIncome.toFixed(2),
      invoicedOperatingProfit: invoicedOperatingProfit.toFixed(2),
      operatingMarginPercentage,
      totalOutstandingRevenue: totalOutstandingRevenue.toFixed(2),
      revenueBreakdown,
      expenseBreakdown,
      trends,
    };
  }

  /**
   * Helper to compute monthly financial trends across invoices, payments, and expenses.
   */
  private computeMonthlyTrends(
    invoices: any[],
    payments: any[],
    expenses: any[],
    start: Date,
    end: Date
  ): MonthlyTrendDto[] {
    const monthlyMap: Record<
      string,
      { invoiced: Prisma.Decimal; collected: Prisma.Decimal; expense: Prisma.Decimal }
    > = {};

    // Initialize all months between start and end
    const current = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(end.getFullYear(), end.getMonth(), 1);

    while (current <= last) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const key = `${year}-${month}`;
      monthlyMap[key] = {
        invoiced: new Prisma.Decimal(0),
        collected: new Prisma.Decimal(0),
        expense: new Prisma.Decimal(0),
      };
      current.setMonth(current.getMonth() + 1);
    }

    // Populate invoiced
    for (const inv of invoices) {
      const d = new Date(inv.issueDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyMap[key]) {
        monthlyMap[key].invoiced = monthlyMap[key].invoiced.plus(inv.totalAmount);
      }
    }

    // Populate collected
    for (const p of payments) {
      const d = new Date(p.paymentDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyMap[key]) {
        monthlyMap[key].collected = monthlyMap[key].collected.plus(p.amount);
      }
    }

    // Populate expenses
    for (const exp of expenses) {
      const d = new Date(exp.expenseDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyMap[key]) {
        monthlyMap[key].expense = monthlyMap[key].expense.plus(exp.amount);
      }
    }

    return Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, data]) => {
        const netOperatingIncome = data.collected.minus(data.expense);
        let profitMarginPercentage = 0;
        if (!data.collected.isZero()) {
          profitMarginPercentage = Number(
            netOperatingIncome.dividedBy(data.collected).times(100).toFixed(2)
          );
        }
        return {
          period,
          invoicedRevenue: data.invoiced.toFixed(2),
          collectedRevenue: data.collected.toFixed(2),
          expenses: data.expense.toFixed(2),
          netOperatingIncome: netOperatingIncome.toFixed(2),
          profitMarginPercentage,
        };
      });
  }

  /**
   * 2. Generates Portfolio & Property Occupancy Analytics.
   */
  async getOccupancyReport(organizationId: string, propertyId?: string): Promise<OccupancyReportDto> {
    if (propertyId) {
      await this.validatePropertyOwnership(organizationId, propertyId);
    }

    const propWhere: Prisma.PropertyWhereInput = {
      organizationId,
      status: 'ACTIVE',
    };
    if (propertyId) {
      propWhere.id = propertyId;
    }

    const properties = await this.prisma.property.findMany({
      where: propWhere,
      include: {
        floors: {
          include: {
            rooms: {
              include: {
                beds: true,
              },
            },
          },
        },
        rentalUnits: true,
      },
    });

    let totalPgBeds = 0;
    let occupiedPgBeds = 0;
    let availablePgBeds = 0;
    let maintenancePgBeds = 0;

    let totalRentalUnits = 0;
    let occupiedRentalUnits = 0;
    let vacantRentalUnits = 0;

    const propertyBreakdown: PropertyOccupancyItemDto[] = [];

    for (const prop of properties) {
      let propTotal = 0;
      let propOccupied = 0;
      let propAvailable = 0;

      if (prop.propertyType === 'PG') {
        let pBeds = 0;
        let pOccupied = 0;
        let pAvailable = 0;
        let pMaintenance = 0;

        for (const floor of prop.floors) {
          for (const room of floor.rooms) {
            for (const bed of room.beds) {
              pBeds += 1;
              if (bed.status === 'OCCUPIED') pOccupied += 1;
              else if (bed.status === 'AVAILABLE') pAvailable += 1;
              else if (bed.status === 'MAINTENANCE') pMaintenance += 1;
            }
          }
        }

        totalPgBeds += pBeds;
        occupiedPgBeds += pOccupied;
        availablePgBeds += pAvailable;
        maintenancePgBeds += pMaintenance;

        propTotal = pBeds;
        propOccupied = pOccupied;
        propAvailable = pAvailable;
      } else {
        let pUnits = 0;
        let pOccupied = 0;
        let pVacant = 0;

        for (const unit of prop.rentalUnits) {
          pUnits += 1;
          if (unit.status === 'OCCUPIED') pOccupied += 1;
          else pVacant += 1;
        }

        totalRentalUnits += pUnits;
        occupiedRentalUnits += pOccupied;
        vacantRentalUnits += pVacant;

        propTotal = pUnits;
        propOccupied = pOccupied;
        propAvailable = pVacant;
      }

      const occRate = propTotal > 0 ? Number(((propOccupied / propTotal) * 100).toFixed(2)) : 0;

      propertyBreakdown.push({
        propertyId: prop.id,
        propertyCode: prop.code,
        propertyName: prop.name,
        propertyType: prop.propertyType as PropertyType,
        totalCapacity: propTotal,
        occupiedCapacity: propOccupied,
        availableCapacity: propAvailable,
        occupancyRate: occRate,
      });
    }

    const pgOccupancyRate =
      totalPgBeds > 0 ? Number(((occupiedPgBeds / totalPgBeds) * 100).toFixed(2)) : 0;
    const rentalOccupancyRate =
      totalRentalUnits > 0
        ? Number(((occupiedRentalUnits / totalRentalUnits) * 100).toFixed(2))
        : 0;

    const totalCapacity = totalPgBeds + totalRentalUnits;
    const totalOccupied = occupiedPgBeds + occupiedRentalUnits;
    const blendedOccupancyRate =
      totalCapacity > 0 ? Number(((totalOccupied / totalCapacity) * 100).toFixed(2)) : 0;

    return {
      organizationId,
      propertyId: propertyId || null,
      totalProperties: properties.length,
      pgMetrics: {
        totalBeds: totalPgBeds,
        occupiedBeds: occupiedPgBeds,
        availableBeds: availablePgBeds,
        maintenanceBeds: maintenancePgBeds,
        occupancyRate: pgOccupancyRate,
      },
      rentalMetrics: {
        totalUnits: totalRentalUnits,
        occupiedUnits: occupiedRentalUnits,
        vacantUnits: vacantRentalUnits,
        occupancyRate: rentalOccupancyRate,
      },
      blendedOccupancyRate,
      propertyBreakdown,
    };
  }

  /**
   * 3. Generates Cross-Property Financial & Operational Comparison Report.
   */
  async getPropertyComparison(
    organizationId: string,
    query: ReportFilterQuery
  ): Promise<PropertyComparisonReportDto> {
    const { start, end } = this.normalizeDateRange(query.startDate, query.endDate);

    const properties = await this.prisma.property.findMany({
      where: { organizationId, status: 'ACTIVE' },
      include: {
        floors: {
          include: {
            rooms: {
              include: {
                beds: true,
              },
            },
          },
        },
        rentalUnits: true,
      },
    });

    const propertyItems: PropertyComparisonItemDto[] = [];

    for (const prop of properties) {
      // Invoiced revenue
      const invAgg = await this.prisma.invoice.aggregate({
        where: {
          organizationId,
          propertyId: prop.id,
          status: { not: 'VOID' },
          issueDate: { gte: start, lte: end },
        },
        _sum: {
          totalAmount: true,
        },
      });
      const invoiced = invAgg._sum?.totalAmount || new Prisma.Decimal(0);

      // Collected revenue
      const payAgg = await this.prisma.payment.aggregate({
        where: {
          organizationId,
          status: 'RECORDED',
          paymentDate: { gte: start, lte: end },
          allocations: {
            some: {
              invoice: {
                propertyId: prop.id,
              },
            },
          },
        },
        _sum: {
          amount: true,
        },
      });
      const collected = payAgg._sum?.amount || new Prisma.Decimal(0);

      // Expenses
      const expAgg = await this.prisma.expenseRecord.aggregate({
        where: {
          organizationId,
          propertyId: prop.id,
          expenseDate: { gte: start, lte: end },
        },
        _sum: {
          amount: true,
        },
      });
      const expense = expAgg._sum?.amount || new Prisma.Decimal(0);

      const netOperatingIncome = collected.minus(expense);
      let operatingMarginPercentage = 0;
      if (!collected.isZero()) {
        operatingMarginPercentage = Number(
          netOperatingIncome.dividedBy(collected).times(100).toFixed(2)
        );
      }

      // Occupancy & Active Tenants
      let totalCap = 0;
      let occCap = 0;
      let activeTenants = 0;

      if (prop.propertyType === 'PG') {
        for (const floor of prop.floors) {
          for (const room of floor.rooms) {
            for (const bed of room.beds) {
              totalCap += 1;
              if (bed.status === 'OCCUPIED') {
                occCap += 1;
                activeTenants += 1;
              }
            }
          }
        }
      } else {
        for (const unit of prop.rentalUnits) {
          totalCap += 1;
          if (unit.status === 'OCCUPIED') {
            occCap += 1;
            activeTenants += 1;
          }
        }
      }

      const occupancyRate = totalCap > 0 ? Number(((occCap / totalCap) * 100).toFixed(2)) : 0;

      propertyItems.push({
        propertyId: prop.id,
        propertyCode: prop.code,
        propertyName: prop.name,
        propertyType: prop.propertyType as PropertyType,
        totalRevenueInvoiced: invoiced.toFixed(2),
        totalRevenueCollected: collected.toFixed(2),
        totalExpenses: expense.toFixed(2),
        netOperatingIncome: netOperatingIncome.toFixed(2),
        operatingMarginPercentage,
        occupancyRate,
        activeTenantCount: activeTenants,
      });
    }

    return {
      organizationId,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      properties: propertyItems,
    };
  }

  /**
   * 4. Generates Cash Flow Statement (Realized Inflows vs Outflows).
   */
  async getCashFlowReport(organizationId: string, query: ReportFilterQuery): Promise<CashFlowReportDto> {
    if (query.propertyId) {
      await this.validatePropertyOwnership(organizationId, query.propertyId);
    }

    const { start, end } = this.normalizeDateRange(query.startDate, query.endDate);

    const payWhere: Prisma.PaymentWhereInput = {
      organizationId,
      status: 'RECORDED',
      paymentDate: { gte: start, lte: end },
    };
    if (query.propertyId) {
      payWhere.allocations = {
        some: {
          invoice: {
            propertyId: query.propertyId,
          },
        },
      };
    }

    const payments = await this.prisma.payment.findMany({
      where: payWhere,
    });

    let realizedInflows = new Prisma.Decimal(0);
    for (const p of payments) {
      realizedInflows = realizedInflows.plus(p.amount);
    }

    const expWhere: Prisma.ExpenseRecordWhereInput = {
      organizationId,
      expenseDate: { gte: start, lte: end },
    };
    if (query.propertyId) {
      expWhere.propertyId = query.propertyId;
    }

    const expenses = await this.prisma.expenseRecord.findMany({
      where: expWhere,
    });

    let realizedOutflows = new Prisma.Decimal(0);
    for (const e of expenses) {
      realizedOutflows = realizedOutflows.plus(e.amount);
    }

    const netCashFlow = realizedInflows.minus(realizedOutflows);

    return {
      organizationId,
      propertyId: query.propertyId || null,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      realizedInflows: realizedInflows.toFixed(2),
      realizedOutflows: realizedOutflows.toFixed(2),
      netCashFlow: netCashFlow.toFixed(2),
      operatingInflows: realizedInflows.toFixed(2),
      depositInflows: '0.00',
      depositRefunds: '0.00',
    };
  }

  /**
   * 5. Generates RFC 4180-compliant CSV Export with Formula-Injection Safeguards.
   */
  async exportReportCsv(
    organizationId: string,
    query: Partial<ReportExportInput>,
    actorUserId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ csvContent: string; filename: string }> {
    const reportType = query.type || 'pnl';
    const timestamp = new Date().toISOString().split('T')[0];
    let csvContent = '';
    let filename = `propertyos_report_${reportType}_${timestamp}.csv`;

    if (reportType === 'pnl') {
      const pnl = await this.getPnlStatement(organizationId, query);
      filename = `propertyos_pnl_${timestamp}.csv`;

      const lines: string[] = [];
      lines.push('PropertyOS Profit & Loss Financial Statement');
      lines.push(`Organization ID,${this.sanitizeCsv(organizationId)}`);
      if (pnl.propertyName) lines.push(`Property,${this.sanitizeCsv(pnl.propertyName)}`);
      lines.push(`Period Start,${this.sanitizeCsv(pnl.startDate)}`);
      lines.push(`Period End,${this.sanitizeCsv(pnl.endDate)}`);
      lines.push('');
      lines.push('EXECUTIVE SUMMARY METRIC,AMOUNT (INR)');
      lines.push(`Total Invoiced Revenue,${pnl.totalRevenueInvoiced}`);
      lines.push(`Total Realized Collections,${pnl.totalRevenueCollected}`);
      lines.push(`Total Operational Expenses,${pnl.totalExpenses}`);
      lines.push(`Net Operating Income (Cash NOI),${pnl.netOperatingIncome}`);
      lines.push(`Accrual Operating Profit,${pnl.invoicedOperatingProfit}`);
      lines.push(`Operating Profit Margin (%),${pnl.operatingMarginPercentage}%`);
      lines.push(`Total Outstanding Revenue,${pnl.totalOutstandingRevenue}`);
      lines.push('');

      lines.push('REVENUE BREAKDOWN BY SOURCE,AMOUNT (INR),LINE ITEM COUNT,PERCENTAGE (%)');
      for (const rev of pnl.revenueBreakdown) {
        lines.push(
          `${this.sanitizeCsv(rev.category)},${rev.amount},${rev.count},${rev.percentage}%`
        );
      }
      lines.push('');

      lines.push('EXPENSE BREAKDOWN BY CATEGORY,AMOUNT (INR),TRANSACTION COUNT,PERCENTAGE (%)');
      for (const exp of pnl.expenseBreakdown) {
        lines.push(
          `${this.sanitizeCsv(exp.category)},${exp.amount},${exp.count},${exp.percentage}%`
        );
      }
      lines.push('');

      lines.push('MONTHLY FINANCIAL TREND,INVOICED REVENUE,COLLECTED REVENUE,OPERATING EXPENSES,NET PROFIT,MARGIN (%)');
      for (const t of pnl.trends) {
        lines.push(
          `${this.sanitizeCsv(t.period)},${t.invoicedRevenue},${t.collectedRevenue},${t.expenses},${t.netOperatingIncome},${t.profitMarginPercentage}%`
        );
      }

      csvContent = lines.join('\r\n');
    } else if (reportType === 'occupancy') {
      const occ = await this.getOccupancyReport(organizationId, query.propertyId);
      filename = `propertyos_occupancy_${timestamp}.csv`;

      const lines: string[] = [];
      lines.push('PropertyOS Occupancy & Capacity Analytics');
      lines.push(`Organization ID,${this.sanitizeCsv(organizationId)}`);
      lines.push(`Blended Portfolio Occupancy Rate,${occ.blendedOccupancyRate}%`);
      lines.push(`PG Bed Occupancy Rate,${occ.pgMetrics.occupancyRate}% (${occ.pgMetrics.occupiedBeds}/${occ.pgMetrics.totalBeds})`);
      lines.push(`Rental Unit Occupancy Rate,${occ.rentalMetrics.occupancyRate}% (${occ.rentalMetrics.occupiedUnits}/${occ.rentalMetrics.totalUnits})`);
      lines.push('');
      lines.push('PROPERTY CODE,PROPERTY NAME,TYPE,TOTAL CAPACITY,OCCUPIED,AVAILABLE,OCCUPANCY RATE (%)');
      for (const p of occ.propertyBreakdown) {
        lines.push(
          `${this.sanitizeCsv(p.propertyCode)},${this.sanitizeCsv(p.propertyName)},${this.sanitizeCsv(p.propertyType)},${p.totalCapacity},${p.occupiedCapacity},${p.availableCapacity},${p.occupancyRate}%`
        );
      }
      csvContent = lines.join('\r\n');
    } else if (reportType === 'property-comparison') {
      const comp = await this.getPropertyComparison(organizationId, query);
      filename = `propertyos_property_comparison_${timestamp}.csv`;

      const lines: string[] = [];
      lines.push('PropertyOS Multi-Property Comparative Performance');
      lines.push(`Organization ID,${this.sanitizeCsv(organizationId)}`);
      lines.push('');
      lines.push('PROPERTY CODE,PROPERTY NAME,TYPE,INVOICED (INR),COLLECTED (INR),EXPENSES (INR),NET INCOME (INR),MARGIN (%),OCCUPANCY (%),ACTIVE TENANTS');
      for (const p of comp.properties) {
        lines.push(
          `${this.sanitizeCsv(p.propertyCode)},${this.sanitizeCsv(p.propertyName)},${this.sanitizeCsv(p.propertyType)},${p.totalRevenueInvoiced},${p.totalRevenueCollected},${p.totalExpenses},${p.netOperatingIncome},${p.operatingMarginPercentage}%,${p.occupancyRate}%,${p.activeTenantCount}`
        );
      }
      csvContent = lines.join('\r\n');
    } else {
      const cash = await this.getCashFlowReport(organizationId, query);
      filename = `propertyos_cash_flow_${timestamp}.csv`;

      const lines: string[] = [];
      lines.push('PropertyOS Realized Cash Flow Statement');
      lines.push(`Organization ID,${this.sanitizeCsv(organizationId)}`);
      lines.push('');
      lines.push('CASH FLOW ITEM,AMOUNT (INR)');
      lines.push(`Realized Inflows (Tenant Payments),${cash.realizedInflows}`);
      lines.push(`Realized Outflows (Expenses),${cash.realizedOutflows}`);
      lines.push(`Net Cash Flow,${cash.netCashFlow}`);
      csvContent = lines.join('\r\n');
    }

    // Write audit log
    if (actorUserId) {
      await this.prisma.auditLog.create({
        data: {
          organizationId,
          userId: actorUserId,
          action: 'REPORT_EXPORTED',
          resourceType: 'REPORT',
          resourceId: organizationId,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          metadata: {
            reportType,
            propertyId: query.propertyId || null,
            startDate: query.startDate || null,
            endDate: query.endDate || null,
            filename,
          },
        },
      });
    }

    return { csvContent, filename };
  }

  /**
   * Sanitizes strings for CSV export:
   * 1. Escapes formula characters (=, +, -, @) with a leading single quote to prevent spreadsheet injection.
   * 2. Wraps fields with double quotes if they contain commas, quotes, or newlines.
   */
  private sanitizeCsv(val: any): string {
    if (val === null || val === undefined) return '';
    let str = String(val).trim();

    // Prevent formula injection in spreadsheet applications (Excel, Google Sheets, LibreOffice)
    if (/^[=+\-@]/.test(str)) {
      str = `'${str}`;
    }

    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      str = `"${str.replace(/"/g, '""')}"`;
    }

    return str;
  }
}
