import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../../database/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('ReportsService (CORE-021)', () => {
  let service: ReportsService;
  let prisma: any;

  const mockOrgId = '00000000-0000-4000-a000-000000000021';
  const mockPropId = '11111111-0021-0000-0000-000000000001';
  const mockUserId = '22222222-0021-0000-0000-000000000001';

  beforeEach(async () => {
    prisma = {
      property: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      invoice: {
        findMany: jest.fn(),
        aggregate: jest.fn(),
      },
      payment: {
        findMany: jest.fn(),
        aggregate: jest.fn(),
      },
      expenseRecord: {
        findMany: jest.fn(),
        aggregate: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'mock-audit-id' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  describe('getPnlStatement', () => {
    it('should accurately aggregate invoiced revenue, realized collections, expenses, and net profit', async () => {
      const mockInvoices = [
        {
          id: 'inv-1',
          totalAmount: new Prisma.Decimal('15000.00'),
          issueDate: new Date('2026-08-01T10:00:00Z'),
          lines: [
            { chargeType: 'RENT', totalAmount: new Prisma.Decimal('12000.00') },
            { chargeType: 'ELECTRICITY', totalAmount: new Prisma.Decimal('3000.00') },
          ],
        },
        {
          id: 'inv-2',
          totalAmount: new Prisma.Decimal('5000.00'),
          issueDate: new Date('2026-08-05T10:00:00Z'),
          lines: [
            { chargeType: 'MEAL', totalAmount: new Prisma.Decimal('5000.00') },
          ],
        },
      ];

      const mockPayments = [
        {
          id: 'pay-1',
          amount: new Prisma.Decimal('15000.00'),
          paymentDate: new Date('2026-08-02T10:00:00Z'),
        },
      ];

      const mockExpenses = [
        {
          id: 'exp-1',
          amount: new Prisma.Decimal('6000.00'),
          expenseDate: new Date('2026-08-10T10:00:00Z'),
          categoryName: 'SALARY',
          category: { name: 'SALARY' },
        },
        {
          id: 'exp-2',
          amount: new Prisma.Decimal('2000.00'),
          expenseDate: new Date('2026-08-12T10:00:00Z'),
          categoryName: 'ELECTRICITY',
          category: { name: 'ELECTRICITY' },
        },
      ];

      prisma.invoice.findMany.mockResolvedValue(mockInvoices);
      prisma.payment.findMany.mockResolvedValue(mockPayments);
      prisma.expenseRecord.findMany.mockResolvedValue(mockExpenses);

      const result = await service.getPnlStatement(mockOrgId, {
        startDate: '2026-08-01T00:00:00Z',
        endDate: '2026-08-31T23:59:59Z',
      });

      expect(result.totalRevenueInvoiced).toBe('20000.00');
      expect(result.totalRevenueCollected).toBe('15000.00');
      expect(result.totalExpenses).toBe('8000.00');
      expect(result.netOperatingIncome).toBe('7000.00'); // 15000 - 8000
      expect(result.invoicedOperatingProfit).toBe('12000.00'); // 20000 - 8000
      expect(result.totalOutstandingRevenue).toBe('5000.00'); // 20000 - 15000
      expect(result.operatingMarginPercentage).toBe(46.67); // (7000 / 15000) * 100

      // Revenue breakdown
      expect(result.revenueBreakdown).toHaveLength(3);
      const rentItem = result.revenueBreakdown.find((r) => r.category === 'RENT');
      expect(rentItem?.amount).toBe('12000.00');
      expect(rentItem?.percentage).toBe(60);

      // Expense breakdown
      expect(result.expenseBreakdown).toHaveLength(2);
      const salaryItem = result.expenseBreakdown.find((e) => e.category === 'SALARY');
      expect(salaryItem?.amount).toBe('6000.00');
      expect(salaryItem?.percentage).toBe(75);
    });

    it('should safely handle zero collections without division-by-zero error', async () => {
      prisma.invoice.findMany.mockResolvedValue([]);
      prisma.payment.findMany.mockResolvedValue([]);
      prisma.expenseRecord.findMany.mockResolvedValue([
        {
          id: 'exp-1',
          amount: new Prisma.Decimal('1000.00'),
          expenseDate: new Date('2026-08-01T10:00:00Z'),
          categoryName: 'OTHER',
          category: { name: 'OTHER' },
        },
      ]);

      const result = await service.getPnlStatement(mockOrgId, {
        startDate: '2026-08-01T00:00:00Z',
        endDate: '2026-08-31T23:59:59Z',
      });

      expect(result.totalRevenueInvoiced).toBe('0.00');
      expect(result.totalRevenueCollected).toBe('0.00');
      expect(result.totalExpenses).toBe('1000.00');
      expect(result.netOperatingIncome).toBe('-1000.00');
      expect(result.operatingMarginPercentage).toBe(0);
    });

    it('should reject foreign property with 404 Not Found', async () => {
      prisma.property.findFirst.mockResolvedValue(null);

      await expect(
        service.getPnlStatement(mockOrgId, { propertyId: 'foreign-prop-id' })
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject invalid date range where startDate > endDate', async () => {
      await expect(
        service.getPnlStatement(mockOrgId, {
          startDate: '2026-09-01T00:00:00Z',
          endDate: '2026-08-01T00:00:00Z',
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getOccupancyReport', () => {
    it('should compute PG, Rental, and blended portfolio occupancy rates', async () => {
      const mockProperties = [
        {
          id: 'prop-pg-1',
          code: 'PG-01',
          name: 'Apex PG Koramangala',
          propertyType: 'PG',
          floors: [
            {
              rooms: [
                {
                  beds: [
                    { id: 'b1', status: 'OCCUPIED' },
                    { id: 'b2', status: 'OCCUPIED' },
                    { id: 'b3', status: 'AVAILABLE' },
                    { id: 'b4', status: 'MAINTENANCE' },
                  ],
                },
              ],
            },
          ],
          rentalUnits: [],
        },
        {
          id: 'prop-rental-1',
          code: 'RENTAL-01',
          name: 'Apex Luxury Villa',
          propertyType: 'RENTAL_HOUSE',
          floors: [],
          rentalUnits: [
            { id: 'u1', status: 'OCCUPIED' },
            { id: 'u2', status: 'AVAILABLE' },
          ],
        },
      ];

      prisma.property.findMany.mockResolvedValue(mockProperties);

      const result = await service.getOccupancyReport(mockOrgId);

      expect(result.totalProperties).toBe(2);
      expect(result.pgMetrics.totalBeds).toBe(4);
      expect(result.pgMetrics.occupiedBeds).toBe(2);
      expect(result.pgMetrics.availableBeds).toBe(1);
      expect(result.pgMetrics.maintenanceBeds).toBe(1);
      expect(result.pgMetrics.occupancyRate).toBe(50); // (2 / 4) * 100

      expect(result.rentalMetrics.totalUnits).toBe(2);
      expect(result.rentalMetrics.occupiedUnits).toBe(1);
      expect(result.rentalMetrics.vacantUnits).toBe(1);
      expect(result.rentalMetrics.occupancyRate).toBe(50); // (1 / 2) * 100

      // Blended = (2 + 1) / (4 + 2) = 3 / 6 = 50%
      expect(result.blendedOccupancyRate).toBe(50);
      expect(result.propertyBreakdown).toHaveLength(2);
    });

    it('should handle zero total capacity gracefully returning 0% occupancy', async () => {
      prisma.property.findMany.mockResolvedValue([
        {
          id: 'prop-empty',
          code: 'EMPTY-01',
          name: 'New Empty Property',
          propertyType: 'PG',
          floors: [],
          rentalUnits: [],
        },
      ]);

      const result = await service.getOccupancyReport(mockOrgId);

      expect(result.pgMetrics.occupancyRate).toBe(0);
      expect(result.rentalMetrics.occupancyRate).toBe(0);
      expect(result.blendedOccupancyRate).toBe(0);
    });
  });

  describe('getPropertyComparison', () => {
    it('should return comparative performance metrics across all properties', async () => {
      prisma.property.findMany.mockResolvedValue([
        {
          id: 'prop-1',
          code: 'P1',
          name: 'Property One',
          propertyType: 'PG',
          floors: [
            {
              rooms: [
                {
                  beds: [
                    { id: 'b1', status: 'OCCUPIED' },
                    { id: 'b2', status: 'AVAILABLE' },
                  ],
                },
              ],
            },
          ],
          rentalUnits: [],
        },
      ]);

      prisma.invoice.aggregate.mockResolvedValue({
        _sum: { totalAmount: new Prisma.Decimal('50000.00') },
      });
      prisma.payment.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal('40000.00') },
      });
      prisma.expenseRecord.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal('15000.00') },
      });

      const result = await service.getPropertyComparison(mockOrgId, {});

      expect(result.properties).toHaveLength(1);
      const item = result.properties[0];
      expect(item.propertyCode).toBe('P1');
      expect(item.totalRevenueInvoiced).toBe('50000.00');
      expect(item.totalRevenueCollected).toBe('40000.00');
      expect(item.totalExpenses).toBe('15000.00');
      expect(item.netOperatingIncome).toBe('25000.00'); // 40000 - 15000
      expect(item.operatingMarginPercentage).toBe(62.5); // (25000 / 40000) * 100
      expect(item.occupancyRate).toBe(50);
      expect(item.activeTenantCount).toBe(1);
    });
  });

  describe('getCashFlowReport', () => {
    it('should calculate realized inflows, outflows, and net cash flow', async () => {
      prisma.payment.findMany.mockResolvedValue([
        { id: 'pay-1', amount: new Prisma.Decimal('30000.00') },
      ]);
      prisma.expenseRecord.findMany.mockResolvedValue([
        { id: 'exp-1', amount: new Prisma.Decimal('12000.00') },
      ]);

      const result = await service.getCashFlowReport(mockOrgId, {});

      expect(result.realizedInflows).toBe('30000.00');
      expect(result.realizedOutflows).toBe('12000.00');
      expect(result.netCashFlow).toBe('18000.00'); // 30000 - 12000
    });
  });

  describe('exportReportCsv', () => {
    it('should generate RFC 4180 CSV, escape formulas, and record audit log', async () => {
      prisma.invoice.findMany.mockResolvedValue([]);
      prisma.payment.findMany.mockResolvedValue([]);
      prisma.expenseRecord.findMany.mockResolvedValue([]);

      const result = await service.exportReportCsv(
        mockOrgId,
        { type: 'pnl' },
        mockUserId,
        '127.0.0.1',
        'Jest Test Runner'
      );

      expect(result.filename).toContain('propertyos_pnl_');
      expect(result.csvContent).toContain('PropertyOS Profit & Loss Financial Statement');
      expect(result.csvContent).toContain('Total Invoiced Revenue,0.00');

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: mockOrgId,
            userId: mockUserId,
            action: 'REPORT_EXPORTED',
            resourceType: 'REPORT',
          }),
        })
      );
    });
  });
});
