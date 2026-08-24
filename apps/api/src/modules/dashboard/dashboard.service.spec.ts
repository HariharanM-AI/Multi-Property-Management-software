import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../database/prisma.service';
import { PropertyType, PropertyStatus } from '@propertyos/types';
import { Prisma } from '@prisma/client';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: any;

  const mockOrgId = '00000000-0000-4000-a000-000000000022';

  beforeEach(async () => {
    prisma = {
      property: {
        findMany: jest.fn(),
      },
      invoice: {
        findMany: jest.fn(),
      },
      payment: {
        findMany: jest.fn(),
      },
      expenseRecord: {
        findMany: jest.fn(),
      },
      tenantStayHistory: {
        findMany: jest.fn(),
      },
      lease: {
        findMany: jest.fn(),
      },
      maintenanceTicket: {
        findMany: jest.fn(),
      },
      checkIn: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPortfolioSummary', () => {
    it('should aggregate hybrid PG + Rental portfolio metrics with exact decimal arithmetic', async () => {
      const now = new Date();

      // Mock properties: 1 PG with 4 beds (3 occupied), 1 Rental with 2 units (1 occupied)
      const mockProperties = [
        {
          id: 'prop-pg-1',
          name: 'Apex PG Hostel',
          code: 'PG-01',
          propertyType: PropertyType.PG,
          status: PropertyStatus.ACTIVE,
          city: 'Bangalore',
          address: 'Koramangala 4th Block',
          floors: [
            {
              id: 'fl-1',
              rooms: [
                {
                  id: 'rm-1',
                  beds: [
                    { id: 'b-1', status: 'OCCUPIED' },
                    { id: 'b-2', status: 'OCCUPIED' },
                    { id: 'b-3', status: 'OCCUPIED' },
                    { id: 'b-4', status: 'AVAILABLE' },
                  ],
                },
              ],
            },
          ],
          rentalUnits: [],
        },
        {
          id: 'prop-rental-1',
          name: 'Apex Luxury Villa',
          code: 'RENTAL-01',
          propertyType: PropertyType.RENTAL_HOUSE,
          status: PropertyStatus.ACTIVE,
          city: 'Bangalore',
          address: 'Indiranagar 100ft Rd',
          floors: [],
          rentalUnits: [
            { id: 'u-1', unitNumber: 'Villa-A', status: 'OCCUPIED' },
            { id: 'u-2', unitNumber: 'Villa-B', status: 'AVAILABLE' },
          ],
        },
      ];

      // 1. Properties query
      prisma.property.findMany
        .mockResolvedValueOnce(mockProperties) // filtered properties
        .mockResolvedValueOnce(mockProperties); // allOrgProperties count

      // 2. Invoices query
      prisma.invoice.findMany
        .mockResolvedValueOnce([
          {
            id: 'inv-1',
            propertyId: 'prop-pg-1',
            totalAmount: new Prisma.Decimal('30000.00'),
            lines: [{ totalAmount: new Prisma.Decimal('30000.00') }],
          },
          {
            id: 'inv-2',
            propertyId: 'prop-rental-1',
            totalAmount: new Prisma.Decimal('50000.00'),
            lines: [{ totalAmount: new Prisma.Decimal('50000.00') }],
          },
        ]) // currentMonthInvoices
        .mockResolvedValueOnce([
          {
            id: 'inv-1',
            propertyId: 'prop-pg-1',
            invoiceNumber: 'INV-001',
            tenantId: 't-1',
            totalAmount: new Prisma.Decimal('30000.00'),
            paidAmount: new Prisma.Decimal('20000.00'),
            outstandingAmount: new Prisma.Decimal('10000.00'),
            dueDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days overdue
            status: 'PARTIALLY_PAID',
            tenant: { firstName: 'Rahul', lastName: 'Sharma', phone: '9876543210' },
            property: { name: 'Apex PG Hostel' },
          },
        ]) // allUnpaidInvoices
        .mockResolvedValueOnce([
          {
            id: 'inv-1',
            propertyId: 'prop-pg-1',
            invoiceNumber: 'INV-001',
            tenantId: 't-1',
            totalAmount: new Prisma.Decimal('30000.00'),
            paidAmount: new Prisma.Decimal('20000.00'),
            outstandingAmount: new Prisma.Decimal('10000.00'),
            dueDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
            status: 'PARTIALLY_PAID',
            tenant: { firstName: 'Rahul', lastName: 'Sharma', phone: '9876543210' },
            property: { name: 'Apex PG Hostel' },
          },
        ]); // getActionItems overdue invoices

      // 3. Payments query
      prisma.payment.findMany
        .mockResolvedValueOnce([
          {
            id: 'pay-1',
            amount: new Prisma.Decimal('20000.00'),
            paymentDate: now,
            paymentMethod: 'UPI',
            tenant: { firstName: 'Rahul', lastName: 'Sharma' },
            allocations: [{ invoice: { propertyId: 'prop-pg-1' }, amount: new Prisma.Decimal('20000.00') }],
          },
          {
            id: 'pay-2',
            amount: new Prisma.Decimal('50000.00'),
            paymentDate: now,
            paymentMethod: 'BANK_TRANSFER',
            tenant: { firstName: 'Priya', lastName: 'Nair' },
            allocations: [{ invoice: { propertyId: 'prop-rental-1' }, amount: new Prisma.Decimal('50000.00') }],
          },
        ]) // currentMonthPayments
        .mockResolvedValueOnce([
          {
            id: 'pay-1',
            amount: new Prisma.Decimal('20000.00'),
            paymentDate: now,
            paymentMethod: 'UPI',
            tenant: { firstName: 'Rahul', lastName: 'Sharma' },
            allocations: [{ invoice: { property: { id: 'prop-pg-1', name: 'Apex PG Hostel' } } }],
          },
        ]); // getRecentActivity payments

      // 4. Expenses query
      prisma.expenseRecord.findMany
        .mockResolvedValueOnce([
          {
            id: 'exp-1',
            amount: new Prisma.Decimal('20000.00'),
            propertyId: 'prop-pg-1',
          },
          {
            id: 'exp-2',
            amount: new Prisma.Decimal('10000.00'),
            propertyId: 'prop-rental-1',
          },
        ]) // currentMonthExpenses
        .mockResolvedValueOnce([
          {
            id: 'exp-1',
            amount: new Prisma.Decimal('20000.00'),
            title: 'Warden Salary',
            category: { name: 'SALARY' },
            createdAt: now,
            propertyId: 'prop-pg-1',
            property: { name: 'Apex PG Hostel' },
          },
        ]); // getRecentActivity expenses

      // 5. Active Tenants query
      prisma.tenantStayHistory.findMany.mockResolvedValueOnce([{ tenantId: 't-1' }, { tenantId: 't-2' }]);
      prisma.lease.findMany
        .mockResolvedValueOnce([{ tenantId: 't-3' }]) // active leases
        .mockResolvedValueOnce([
          {
            id: 'l-1',
            tenantId: 't-3',
            monthlyRent: new Prisma.Decimal('50000.00'),
            startDate: new Date(now.getFullYear() - 1, now.getMonth(), 1),
            endDate: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000), // 15 days remaining
            tenant: { firstName: 'Priya', lastName: 'Nair', phone: '9876543211' },
            rentalUnit: {
              id: 'u-1',
              unitNumber: 'Villa-A',
              property: { id: 'prop-rental-1', name: 'Apex Luxury Villa' },
            },
          },
        ]); // getActionItems expiring leases

      // 6. Maintenance Tickets query
      prisma.maintenanceTicket.findMany
        .mockResolvedValueOnce([
          {
            id: 'tkt-1',
            ticketNumber: 'TKT-001',
            title: 'Water Leak',
            priority: 'URGENT',
            status: 'OPEN',
            propertyId: 'prop-pg-1',
            createdAt: now,
            room: { roomNumber: '101' },
            rentalUnit: null,
            property: { name: 'Apex PG Hostel' },
          },
        ]) // activeTickets for property cards
        .mockResolvedValueOnce([
          {
            id: 'tkt-1',
            ticketNumber: 'TKT-001',
            title: 'Water Leak',
            priority: 'URGENT',
            status: 'OPEN',
            propertyId: 'prop-pg-1',
            createdAt: now,
            room: { roomNumber: '101' },
            rentalUnit: null,
            property: { name: 'Apex PG Hostel' },
          },
        ]) // getActionItems urgent tickets
        .mockResolvedValueOnce([
          {
            id: 'tkt-1',
            ticketNumber: 'TKT-001',
            title: 'Water Leak',
            status: 'OPEN',
            updatedAt: now,
            propertyId: 'prop-pg-1',
            property: { id: 'prop-pg-1', name: 'Apex PG Hostel' },
          },
        ]); // getRecentActivity tickets

      // 7. Check-ins for activity
      prisma.checkIn.findMany.mockResolvedValueOnce([
        {
          id: 'cin-1',
          checkInDate: now,
          tenant: { firstName: 'Rahul', lastName: 'Sharma' },
          property: { id: 'prop-pg-1', name: 'Apex PG Hostel' },
          propertyId: 'prop-pg-1',
        },
      ]);

      const result = await service.getPortfolioSummary(mockOrgId);

      expect(result).toBeDefined();
      expect(result.organizationId).toBe(mockOrgId);

      // Property Counts
      expect(result.kpis.totalProperties).toBe(2);
      expect(result.kpis.activeProperties).toBe(2);
      expect(result.kpis.pgCount).toBe(1);
      expect(result.kpis.rentalCount).toBe(1);

      // Capacity & Occupancy: 4 beds (3 occupied) + 2 units (1 occupied) = 6 total capacity, 4 occupied = 66.67%
      expect(result.kpis.capacity.totalBeds).toBe(4);
      expect(result.kpis.capacity.occupiedBeds).toBe(3);
      expect(result.kpis.capacity.availableBeds).toBe(1);
      expect(result.kpis.capacity.totalUnits).toBe(2);
      expect(result.kpis.capacity.occupiedUnits).toBe(1);
      expect(result.kpis.capacity.availableUnits).toBe(1);
      expect(result.kpis.capacity.blendedOccupancyRate).toBe(66.67);

      // Current Month Financials: Invoiced = 80k (30k+50k), Collected = 70k (20k+50k), Expenses = 30k (20k+10k), Cash NOI = 40k (70k-30k)
      expect(result.kpis.financials.invoicedRevenue).toBe('80000.00');
      expect(result.kpis.financials.collectedRevenue).toBe('70000.00');
      expect(result.kpis.financials.operationalExpenses).toBe('30000.00');
      expect(result.kpis.financials.netOperatingIncome).toBe('40000.00');
      expect(result.kpis.financials.outstandingReceivables).toBe('10000.00');
      expect(result.kpis.financials.operatingMarginPercentage).toBe(57.14);

      // Active Tenants Count (2 PG stays + 1 Rental lease = 3)
      expect(result.kpis.activeTenantsCount).toBe(3);

      // Property Cards
      expect(result.propertyCards).toHaveLength(2);
      const pgCard = result.propertyCards.find((p) => p.id === 'prop-pg-1');
      expect(pgCard).toBeDefined();
      expect(pgCard?.capacity.total).toBe(4);
      expect(pgCard?.capacity.occupied).toBe(3);
      expect(pgCard?.capacity.occupancyRate).toBe(75);
      expect(pgCard?.maintenance.hasUrgent).toBe(true);

      // Action Items
      expect(result.actionItems.overdueInvoices).toHaveLength(1);
      expect(result.actionItems.overdueInvoices[0].invoiceNumber).toBe('INV-001');
      expect(result.actionItems.overdueInvoices[0].daysOverdue).toBe(5);

      expect(result.actionItems.urgentMaintenance).toHaveLength(1);
      expect(result.actionItems.urgentMaintenance[0].ticketNumber).toBe('TKT-001');

      expect(result.actionItems.upcomingRenewals).toHaveLength(1);
      expect(result.actionItems.upcomingRenewals[0].unitNumber).toBe('Villa-A');
      expect(result.actionItems.upcomingRenewals[0].daysRemaining).toBe(15);
    });

    it('should handle zero-property empty organization cleanly without errors', async () => {
      prisma.property.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      prisma.invoice.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      prisma.payment.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      prisma.expenseRecord.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      prisma.tenantStayHistory.findMany.mockResolvedValueOnce([]);
      prisma.lease.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      prisma.maintenanceTicket.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      prisma.checkIn.findMany.mockResolvedValueOnce([]);

      const result = await service.getPortfolioSummary(mockOrgId);

      expect(result).toBeDefined();
      expect(result.kpis.totalProperties).toBe(0);
      expect(result.kpis.capacity.blendedOccupancyRate).toBe(0);
      expect(result.kpis.financials.invoicedRevenue).toBe('0.00');
      expect(result.kpis.financials.collectedRevenue).toBe('0.00');
      expect(result.kpis.financials.netOperatingIncome).toBe('0.00');
      expect(result.kpis.financials.operatingMarginPercentage).toBe(0);
      expect(result.propertyCards).toEqual([]);
      expect(result.actionItems.totalActionItemsCount).toBe(0);
      expect(result.recentActivity).toEqual([]);
    });
  });

  describe('getActionItems', () => {
    it('should sort overdue invoices descending by days overdue', async () => {
      const now = new Date();
      prisma.invoice.findMany.mockResolvedValueOnce([
        {
          id: 'inv-1',
          invoiceNumber: 'INV-10',
          tenantId: 't-1',
          totalAmount: new Prisma.Decimal('10000.00'),
          paidAmount: new Prisma.Decimal('0.00'),
          outstandingAmount: new Prisma.Decimal('10000.00'),
          dueDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days overdue
          status: 'ISSUED',
          tenant: { firstName: 'Amit', lastName: 'Kumar', phone: '9876500001' },
          property: { name: 'PG 1' },
        },
        {
          id: 'inv-2',
          invoiceNumber: 'INV-20',
          tenantId: 't-2',
          totalAmount: new Prisma.Decimal('20000.00'),
          paidAmount: new Prisma.Decimal('0.00'),
          outstandingAmount: new Prisma.Decimal('20000.00'),
          dueDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // 10 days overdue
          status: 'OVERDUE',
          tenant: { firstName: 'Vikram', lastName: 'Singh', phone: '9876500002' },
          property: { name: 'PG 2' },
        },
      ]);

      prisma.maintenanceTicket.findMany.mockResolvedValueOnce([]);
      prisma.lease.findMany.mockResolvedValueOnce([]);

      const result = await service.getActionItems(mockOrgId);

      expect(result.overdueInvoices).toHaveLength(2);
      expect(result.overdueInvoices[0].invoiceNumber).toBe('INV-20'); // 10 days overdue first
      expect(result.overdueInvoices[1].invoiceNumber).toBe('INV-10'); // 2 days overdue second
    });
  });
});
