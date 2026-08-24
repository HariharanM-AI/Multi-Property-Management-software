/**
 * ==============================================================================
 * PROPERTYOS CORE-022 MULTI-PROPERTY OWNER DASHBOARD REAL POSTGRESQL E2E SUITE
 * ==============================================================================
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const argon2 = require('@node-rs/argon2');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://postgres:postgrespassword@localhost:5432/propertyos?schema=public',
    },
  },
});

const API_BASE = process.env.API_BASE || 'http://localhost:4000/api/v1';

let passedAssertions = 0;
let failedAssertions = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passedAssertions++;
  } else {
    console.error(`  ❌ FAILED: ${message}`);
    failedAssertions++;
  }
}

async function apiRequest(endpoint, method = 'GET', body = null, cookie = null, maxRetries = 3) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (cookie) headers['Cookie'] = cookie;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(`${API_BASE}${endpoint}`, options);
    let text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = text;
    }

    const isThrottled =
      res.status === 429 ||
      (data && data.error && String(data.error.message).includes('ThrottlerException')) ||
      (data && String(JSON.stringify(data)).includes('ThrottlerException'));

    if (isThrottled && attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }

    return { status: res.status, headers: res.headers, body: data, rawText: text };
  }
}

async function createTestSession(userId) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId,
      sessionToken: tokenHash,
      expiresAt,
    },
  });

  return `propertyos_session=${rawToken}`;
}

async function runDashboardVerification() {
  console.log('\n============================================================');
  console.log('🚀 STARTING CORE-022 MULTI-PROPERTY OWNER DASHBOARD E2E SUITE');
  console.log('============================================================\n');

  // --------------------------------------------------------------------------
  // STEP 1: Multi-Tenant Organizations Setup
  // --------------------------------------------------------------------------
  console.log('--- Step 1: Setting up Multi-Tenant Organizations ---');
  const orgA = await prisma.organization.upsert({
    where: { id: '00000000-0000-4000-a000-000000000022' },
    create: {
      id: '00000000-0000-4000-a000-000000000022',
      name: 'Apex Multi-Property Group',
      legalName: 'Apex Multi-Property Group Pvt Ltd',
    },
    update: {},
  });

  const orgB = await prisma.organization.upsert({
    where: { id: '00000000-0000-4000-b000-000000000022' },
    create: {
      id: '00000000-0000-4000-b000-000000000022',
      name: 'Zenith Estates Isolation Target',
      legalName: 'Zenith Estates LLP',
    },
    update: {},
  });

  assert(orgA.id && orgB.id, 'Created Multi-Tenant Organizations Org A and Org B');

  // --------------------------------------------------------------------------
  // STEP 2: Creating Test Users across 7 User Roles
  // --------------------------------------------------------------------------
  console.log('\n--- Step 2: Creating Test Users across 7 User Roles ---');
  const timestamp = Date.now();
  const passwordHash = await argon2.hash('Password@123');
  const roles = ['OWNER', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'WARDEN', 'MAINTENANCE_STAFF', 'SECURITY', 'TENANT'];

  const roleMap = {};
  for (const r of roles) {
    const dbRole = await prisma.role.upsert({
      where: { name: r },
      create: { name: r, description: `${r} role` },
      update: {},
    });
    roleMap[r] = dbRole.id;
  }

  async function setupUser(id, orgId, email, firstName, lastName, roleName) {
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        id,
        organizationId: orgId,
        email,
        passwordHash,
        firstName,
        lastName,
        isActive: true,
      },
      update: {
        organizationId: orgId,
        passwordHash,
        isActive: true,
      },
    });

    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: roleMap[roleName],
      },
    });

    const cookie = await createTestSession(user.id);
    return { user, cookie };
  }

  const sessions = {};
  const ownerA = await setupUser('11111111-0022-0000-0000-000000000001', orgA.id, 'owner-dash@apex.test', 'Aarav', 'Sharma', 'OWNER');
  const managerA = await setupUser('11111111-0022-0000-0000-000000000002', orgA.id, 'manager-dash@apex.test', 'Pooja', 'Iyer', 'PROPERTY_MANAGER');
  const accountantA = await setupUser('11111111-0022-0000-0000-000000000003', orgA.id, 'accountant-dash@apex.test', 'Rohan', 'Verma', 'ACCOUNTANT');
  const wardenA = await setupUser('11111111-0022-0000-0000-000000000004', orgA.id, 'warden-dash@apex.test', 'Vikram', 'Singh', 'WARDEN');
  const securityA = await setupUser('11111111-0022-0000-0000-000000000005', orgA.id, 'security-dash@apex.test', 'Ramesh', 'Kumar', 'SECURITY');
  const maintA = await setupUser('11111111-0022-0000-0000-000000000006', orgA.id, 'maint-dash@apex.test', 'Sunil', 'Gavaskar', 'MAINTENANCE_STAFF');
  const tenantUserA = await setupUser('11111111-0022-0000-0000-000000000007', orgA.id, 'tenant-dash@apex.test', 'Rohan', 'Verma', 'TENANT');
  const ownerB = await setupUser('11111111-0022-0000-0000-000000000008', orgB.id, 'owner-dash@zenith.test', 'Vikramaditya', 'Zenith', 'OWNER');

  sessions['OWNER'] = ownerA.cookie;
  sessions['PROPERTY_MANAGER'] = managerA.cookie;
  sessions['ACCOUNTANT'] = accountantA.cookie;
  sessions['WARDEN'] = wardenA.cookie;
  sessions['SECURITY'] = securityA.cookie;
  sessions['MAINTENANCE_STAFF'] = maintA.cookie;
  sessions['TENANT'] = tenantUserA.cookie;
  sessions['ORG_B_OWNER'] = ownerB.cookie;

  assert(Object.keys(sessions).length === 8, 'Created 7 role personas in Org A + 1 in Org B');

  // Clean up any prior data for orgA & orgB
  await prisma.paymentAllocation.deleteMany({ where: { invoice: { organizationId: { in: [orgA.id, orgB.id] } } } });
  await prisma.payment.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
  await prisma.invoiceLine.deleteMany({ where: { invoice: { organizationId: { in: [orgA.id, orgB.id] } } } });
  await prisma.invoice.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
  await prisma.expenseRecord.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
  await prisma.maintenanceTicket.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
  await prisma.lease.deleteMany({ where: { rentalUnit: { property: { organizationId: { in: [orgA.id, orgB.id] } } } } });
  await prisma.bed.deleteMany({ where: { room: { property: { organizationId: { in: [orgA.id, orgB.id] } } } } });
  await prisma.room.deleteMany({ where: { property: { organizationId: { in: [orgA.id, orgB.id] } } } });
  await prisma.floor.deleteMany({ where: { property: { organizationId: { in: [orgA.id, orgB.id] } } } });
  await prisma.rentalUnit.deleteMany({ where: { property: { organizationId: { in: [orgA.id, orgB.id] } } } });
  await prisma.tenant.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
  await prisma.property.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });

  // --------------------------------------------------------------------------
  // STEP 3: Seeding PG & Rental Properties with Capacity
  // --------------------------------------------------------------------------
  console.log('\n--- Step 3: Seeding PG & Rental Properties with Capacity ---');
  // 1. Org A Property 1 (PG): Apex Co-Living Residency
  const propPg = await prisma.property.create({
    data: {
      organizationId: orgA.id,
      name: 'Apex Co-Living Residency',
      code: `PG-DASH-${timestamp}`,
      propertyType: 'PG',
      status: 'ACTIVE',
      address: '100 Feet Road, Indiranagar',
      city: 'Bangalore',
      state: 'Karnataka',
      postalCode: '560038',
      country: 'India',
    },
  });

  const floor1 = await prisma.floor.create({
    data: {
      propertyId: propPg.id,
      floorNumber: 1,
      name: '1st Floor',
    },
  });

  const room1 = await prisma.room.create({
    data: {
      propertyId: propPg.id,
      floorId: floor1.id,
      roomNumber: '101',
      sharingType: 'DOUBLE',
      capacity: 2,
      baseRent: 10000.0,
    },
  });

  await prisma.bed.createMany({
    data: [
      { roomId: room1.id, bedNumber: '101-A', monthlyRent: 10000.0, status: 'OCCUPIED' },
      { roomId: room1.id, bedNumber: '101-B', monthlyRent: 10000.0, status: 'AVAILABLE' },
    ],
  });

  // 2. Org A Property 2 (Rental): Apex Green Villas
  const propRental = await prisma.property.create({
    data: {
      organizationId: orgA.id,
      name: 'Apex Green Villas',
      code: `RENTAL-DASH-${timestamp}`,
      propertyType: 'RENTAL_HOUSE',
      status: 'ACTIVE',
      address: 'Outer Ring Road, Bellandur',
      city: 'Bangalore',
      state: 'Karnataka',
      postalCode: '560103',
      country: 'India',
    },
  });

  const unitA1 = await prisma.rentalUnit.create({
    data: {
      propertyId: propRental.id,
      unitNumber: `Villa-1-${timestamp}`,
      unitType: '3BHK',
      monthlyRent: 40000.0,
      securityDeposit: 80000.0,
      status: 'OCCUPIED',
    },
  });

  const unitA2 = await prisma.rentalUnit.create({
    data: {
      propertyId: propRental.id,
      unitNumber: `Villa-2-${timestamp}`,
      unitType: '3BHK',
      monthlyRent: 40000.0,
      securityDeposit: 80000.0,
      status: 'AVAILABLE',
    },
  });

  // 3. Org B Property (Isolation target)
  const propOrgB = await prisma.property.create({
    data: {
      organizationId: orgB.id,
      name: 'Zenith Residency Whitefield',
      code: `ZB-DASH-${timestamp}`,
      propertyType: 'RENTAL_HOUSE',
      status: 'ACTIVE',
      address: 'ITPL Main Road',
      city: 'Bangalore',
      state: 'Karnataka',
      postalCode: '560066',
      country: 'India',
    },
  });

  await prisma.rentalUnit.create({
    data: {
      propertyId: propOrgB.id,
      unitNumber: `Flat-B1-${timestamp}`,
      unitType: '2BHK',
      monthlyRent: 35000.0,
      securityDeposit: 70000.0,
      status: 'OCCUPIED',
    },
  });

  assert(propPg.id && propRental.id && propOrgB.id, 'Seeded PG, Rental, and Isolation properties with capacities');

  // --------------------------------------------------------------------------
  // STEP 4: Seeding Tenants, Leases, Invoices, Payments, Expenses & Tickets
  // --------------------------------------------------------------------------
  console.log('\n--- Step 4: Seeding Financials, Maintenance & Leases ---');
  const tenantA = await prisma.tenant.create({
    data: {
      organizationId: orgA.id,
      firstName: 'Rohan',
      lastName: 'Verma',
      email: `rohan_tenant_${timestamp}@apex.test`,
      phone: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
      permanentAddress: 'Koramangala 4th Block',
      permanentCity: 'Bangalore',
      permanentState: 'Karnataka',
      permanentPostalCode: '560034',
      emergencyContactName: 'Ramesh Verma',
      emergencyContactPhone: '+919988776600',
      emergencyContactRelation: 'Father',
      status: 'ACTIVE',
    },
  });

  const now = new Date();

  // Active Lease inside 15-day renewal window
  const lease1 = await prisma.lease.create({
    data: {
      rentalUnitId: unitA1.id,
      tenantId: tenantA.id,
      startDate: new Date(now.getFullYear() - 1, now.getMonth(), 1),
      endDate: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000), // 15 days remaining
      monthlyRent: 40000.0,
      securityDeposit: 80000.0,
      status: 'ACTIVE',
    },
  });

  // Invoice 1: PG (Total = 20,000.00, Paid = 20,000.00, Outstanding = 0.00, Status = PAID)
  const inv1 = await prisma.invoice.create({
    data: {
      organizationId: orgA.id,
      tenantId: tenantA.id,
      propertyId: propPg.id,
      invoiceNumber: `INV-PG-${timestamp}`,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      subtotal: 20000.0,
      totalAmount: 20000.0,
      paidAmount: 20000.0,
      outstandingAmount: 0.0,
      status: 'PAID',
      lines: {
        create: [
          { description: 'Bed Rent', chargeType: 'RENT', unitAmount: 15000.0, totalAmount: 15000.0, quantity: 1 },
          { description: 'Utility Charge', chargeType: 'UTILITY', unitAmount: 5000.0, totalAmount: 5000.0, quantity: 1 },
        ],
      },
    },
  });

  // Invoice 2: Rental Unit (Total = 40,000.00, Paid = 20,000.00, Outstanding = 20,000.00, Due 5 days ago -> OVERDUE!)
  const inv2 = await prisma.invoice.create({
    data: {
      organizationId: orgA.id,
      tenantId: tenantA.id,
      propertyId: propRental.id,
      invoiceNumber: `INV-RENT-OD-${timestamp}`,
      issueDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days overdue
      subtotal: 40000.0,
      totalAmount: 40000.0,
      paidAmount: 20000.0,
      outstandingAmount: 20000.0,
      status: 'PARTIALLY_PAID',
      lines: {
        create: [
          { description: 'Villa Monthly Rent', chargeType: 'RENT', unitAmount: 35000.0, totalAmount: 35000.0, quantity: 1 },
          { description: 'Maintenance Surcharge', chargeType: 'MAINTENANCE', unitAmount: 5000.0, totalAmount: 5000.0, quantity: 1 },
        ],
      },
    },
  });

  // Payments in Org A (Total = 40,000.00)
  await prisma.payment.create({
    data: {
      organizationId: orgA.id,
      tenantId: tenantA.id,
      amount: 20000.0,
      paymentMethod: 'UPI',
      paymentDate: new Date(),
      status: 'RECORDED',
      allocations: {
        create: { invoiceId: inv1.id, amount: 20000.0 },
      },
    },
  });

  await prisma.payment.create({
    data: {
      organizationId: orgA.id,
      tenantId: tenantA.id,
      amount: 20000.0,
      paymentMethod: 'BANK_TRANSFER',
      paymentDate: new Date(),
      status: 'RECORDED',
      allocations: {
        create: { invoiceId: inv2.id, amount: 20000.0 },
      },
    },
  });

  // Expenses in Org A (Total = 15,000.00)
  const salaryCat = await prisma.expenseCategory.findFirst({ where: { name: 'SALARY' } });
  const maintCat = await prisma.expenseCategory.findFirst({ where: { name: 'MAINTENANCE' } });

  await prisma.expenseRecord.create({
    data: {
      organizationId: orgA.id,
      propertyId: propPg.id,
      categoryId: salaryCat.id,
      title: 'Hostel Caretaker Salary',
      amount: 10000.0,
      expenseDate: new Date(),
    },
  });

  await prisma.expenseRecord.create({
    data: {
      organizationId: orgA.id,
      propertyId: propRental.id,
      categoryId: maintCat.id,
      title: 'Villa Garden & Pool Service',
      amount: 5000.0,
      expenseDate: new Date(),
    },
  });

  // Maintenance Tickets in Org A
  const tkt1 = await prisma.maintenanceTicket.create({
    data: {
      organizationId: orgA.id,
      propertyId: propPg.id,
      createdById: ownerA.user.id,
      ticketNumber: `TKT-URG-${timestamp}`,
      title: 'Major Overhead Water Tank Leak',
      description: 'Main pipe burst on roof',
      priority: 'URGENT',
      status: 'OPEN',
      category: 'PLUMBING',
    },
  });

  const tkt2 = await prisma.maintenanceTicket.create({
    data: {
      organizationId: orgA.id,
      propertyId: propRental.id,
      createdById: ownerA.user.id,
      ticketNumber: `TKT-NRM-${timestamp}`,
      title: 'Driveway Paver Light Replacement',
      description: 'Minor bulb replacement',
      priority: 'LOW',
      status: 'IN_PROGRESS',
      category: 'ELECTRICAL',
    },
  });

  assert(inv1.id && inv2.id && tkt1.id && tkt2.id && lease1.id, 'Seeded Invoices, Payments, Expenses, Tickets, and Leases');

  // --------------------------------------------------------------------------
  // STEP 5: Testing GET /api/v1/dashboard/summary Calculations
  // --------------------------------------------------------------------------
  console.log('\n--- Step 5: Testing GET /api/v1/dashboard/summary Portfolio Calculations ---');
  const sumRes = await apiRequest('/dashboard/summary', 'GET', null, sessions['OWNER']);
  assert(sumRes.status === 200, `GET /dashboard/summary returned 200 OK (got ${sumRes.status})`);

  const dash = sumRes.body.data;
  assert(dash.organizationId === orgA.id, `Dashboard scoped to Org A (${dash.organizationId})`);

  // KPI Assertions
  const kpis = dash.kpis;
  assert(kpis.totalProperties === 2, `totalProperties is 2 (got ${kpis.totalProperties})`);
  assert(kpis.activeProperties === 2, `activeProperties is 2 (got ${kpis.activeProperties})`);
  assert(kpis.pgCount === 1, `pgCount is 1 (got ${kpis.pgCount})`);
  assert(kpis.rentalCount === 1, `rentalCount is 1 (got ${kpis.rentalCount})`);

  // Capacity & Occupancy (2 beds with 1 occupied + 2 units with 1 occupied = 4 total, 2 occupied = 50.00%)
  assert(kpis.capacity.totalBeds === 2, `totalBeds is 2 (got ${kpis.capacity.totalBeds})`);
  assert(kpis.capacity.occupiedBeds === 1, `occupiedBeds is 1 (got ${kpis.capacity.occupiedBeds})`);
  assert(kpis.capacity.totalUnits === 2, `totalUnits is 2 (got ${kpis.capacity.totalUnits})`);
  assert(kpis.capacity.occupiedUnits === 1, `occupiedUnits is 1 (got ${kpis.capacity.occupiedUnits})`);
  assert(kpis.capacity.blendedOccupancyRate === 50, `blendedOccupancyRate is 50.00% (got ${kpis.capacity.blendedOccupancyRate}%)`);

  // Current Month Financials (Invoiced = 60,000.00, Collected = 40,000.00, Expenses = 15,000.00, Cash NOI = 25,000.00)
  assert(kpis.financials.invoicedRevenue === '60000.00', `invoicedRevenue is 60,000.00 (got ${kpis.financials.invoicedRevenue})`);
  assert(kpis.financials.collectedRevenue === '40000.00', `collectedRevenue is 40,000.00 (got ${kpis.financials.collectedRevenue})`);
  assert(kpis.financials.operationalExpenses === '15000.00', `operationalExpenses is 15,000.00 (got ${kpis.financials.operationalExpenses})`);
  assert(kpis.financials.netOperatingIncome === '25000.00', `netOperatingIncome (Cash NOI) is 25,000.00 (got ${kpis.financials.netOperatingIncome})`);
  assert(kpis.financials.outstandingReceivables === '20000.00', `outstandingReceivables is 20,000.00 (got ${kpis.financials.outstandingReceivables})`);
  assert(kpis.financials.operatingMarginPercentage === 62.5, `operatingMarginPercentage is 62.5% (got ${kpis.financials.operatingMarginPercentage}%)`);

  // Property Cards Assertions
  assert(dash.propertyCards.length === 2, `propertyCards has 2 properties (got ${dash.propertyCards.length})`);
  const pgCard = dash.propertyCards.find((p) => p.id === propPg.id);
  assert(pgCard && pgCard.maintenance.hasUrgent === true, 'PG Property Card flags hasUrgent maintenance ticket');
  assert(pgCard && pgCard.capacity.occupied === 1 && pgCard.capacity.total === 2, 'PG Property Card capacity is 1/2 occupied');

  const rentalCard = dash.propertyCards.find((p) => p.id === propRental.id);
  assert(rentalCard && rentalCard.pendingInvoicesCount === 1, 'Rental Property Card reports 1 pending invoice');
  assert(rentalCard && rentalCard.pendingInvoicesAmount === '20000.00', 'Rental Property Card reports 20,000.00 pending amount');

  // --------------------------------------------------------------------------
  // STEP 6: Testing GET /api/v1/dashboard/action-items
  // --------------------------------------------------------------------------
  console.log('\n--- Step 6: Testing GET /api/v1/dashboard/action-items Triage ---');
  const actionRes = await apiRequest('/dashboard/action-items', 'GET', null, sessions['OWNER']);
  assert(actionRes.status === 200, `GET /dashboard/action-items returned 200 OK (got ${actionRes.status})`);

  const actions = actionRes.body.data;
  assert(actions.overdueInvoices.length >= 1, `Found overdue invoices (got ${actions.overdueInvoices.length})`);
  const odInv = actions.overdueInvoices.find((i) => i.id === inv2.id);
  assert(odInv && odInv.daysOverdue >= 4, `Invoice 2 flagged as 4+ days overdue (got ${odInv?.daysOverdue} days)`);
  assert(odInv && odInv.outstandingAmount === '20000.00', `Invoice 2 outstanding is 20,000.00`);

  assert(actions.urgentMaintenance.length >= 1, `Found urgent maintenance tickets (got ${actions.urgentMaintenance.length})`);
  const urgTkt = actions.urgentMaintenance.find((t) => t.id === tkt1.id);
  assert(urgTkt && urgTkt.priority === 'URGENT', 'Ticket 1 prioritized as URGENT');

  assert(actions.upcomingRenewals.length >= 1, `Found upcoming lease renewals (got ${actions.upcomingRenewals.length})`);
  const upRen = actions.upcomingRenewals.find((l) => l.id === lease1.id);
  assert(upRen && upRen.daysRemaining >= 14 && upRen.daysRemaining <= 16, `Lease 1 flagged with 14-16 days remaining (got ${upRen?.daysRemaining})`);
  assert(actions.totalActionItemsCount >= 3, `totalActionItemsCount is >= 3 (got ${actions.totalActionItemsCount})`);

  // --------------------------------------------------------------------------
  // STEP 7: Testing GET /api/v1/dashboard/activity Stream
  // --------------------------------------------------------------------------
  console.log('\n--- Step 7: Testing GET /api/v1/dashboard/activity Feed ---');
  const actRes = await apiRequest('/dashboard/activity', 'GET', null, sessions['OWNER']);
  assert(actRes.status === 200, `GET /dashboard/activity returned 200 OK (got ${actRes.status})`);

  const activity = actRes.body.data;
  assert(Array.isArray(activity), 'Activity stream returned as array');
  assert(activity.length <= 10, `Activity stream limited to max 10 records (got ${activity.length})`);
  assert(activity.some((a) => a.type === 'PAYMENT_RECEIVED'), 'Activity includes PAYMENT_RECEIVED event');
  assert(activity.some((a) => a.type === 'MAINTENANCE_CREATED'), 'Activity includes MAINTENANCE_CREATED event');
  assert(activity.some((a) => a.type === 'EXPENSE_RECORDED'), 'Activity includes EXPENSE_RECORDED event');

  // --------------------------------------------------------------------------
  // STEP 8: Testing Property Filters (?propertyType=PG / RENTAL_HOUSE)
  // --------------------------------------------------------------------------
  console.log('\n--- Step 8: Testing Property Operating Model Filtering ---');
  const pgOnlyRes = await apiRequest('/dashboard/summary?propertyType=PG', 'GET', null, sessions['OWNER']);
  assert(pgOnlyRes.status === 200, `GET /dashboard/summary?propertyType=PG returned 200 OK`);
  assert(pgOnlyRes.body.data.propertyCards.length === 1, 'Filtered propertyCards returns 1 PG property');
  assert(pgOnlyRes.body.data.propertyCards[0].propertyType === 'PG', 'Returned card is PG type');

  const rentalOnlyRes = await apiRequest('/dashboard/summary?propertyType=RENTAL_HOUSE', 'GET', null, sessions['OWNER']);
  assert(rentalOnlyRes.status === 200, `GET /dashboard/summary?propertyType=RENTAL_HOUSE returned 200 OK`);
  assert(rentalOnlyRes.body.data.propertyCards.length === 1, 'Filtered propertyCards returns 1 Rental property');
  assert(rentalOnlyRes.body.data.propertyCards[0].propertyType === 'RENTAL_HOUSE', 'Returned card is RENTAL_HOUSE type');

  // --------------------------------------------------------------------------
  // STEP 9: Testing Multi-Tenant Isolation (Org B Fail-Closed)
  // --------------------------------------------------------------------------
  console.log('\n--- Step 9: Testing Multi-Tenant Isolation ---');
  const orgBSummary = await apiRequest('/dashboard/summary', 'GET', null, sessions['ORG_B_OWNER']);
  assert(orgBSummary.status === 200, 'Org B GET /dashboard/summary returned 200 OK');
  assert(orgBSummary.body.data.organizationId === orgB.id, `Dashboard scoped to Org B (${orgB.id})`);

  // Org B has 1 rental property, 0 PG properties, 0 invoices from Org A
  const orgBKpis = orgBSummary.body.data.kpis;
  assert(orgBKpis.totalProperties === 1, `Org B totalProperties is 1 (Org A was 2)`);
  assert(orgBKpis.pgCount === 0, `Org B pgCount is 0 (Org A was 1)`);
  assert(orgBKpis.financials.invoicedRevenue === '0.00', `Org B has 0.00 invoiced (Org A was 60,000.00)`);
  assert(orgBSummary.body.data.actionItems.overdueInvoices.length === 0, 'Org B has 0 overdue invoices from Org A');

  // --------------------------------------------------------------------------
  // STEP 10: Testing RBAC Matrix Boundaries across all 7 Roles
  // --------------------------------------------------------------------------
  console.log('\n--- Step 10: Testing RBAC Matrix Boundaries across all 7 Roles ---');
  const rbacRoles = [
    { role: 'OWNER', expected: 200 },
    { role: 'PROPERTY_MANAGER', expected: 200 },
    { role: 'ACCOUNTANT', expected: 200 },
    { role: 'WARDEN', expected: 200 },
    { role: 'SECURITY', expected: 403 },
    { role: 'MAINTENANCE_STAFF', expected: 403 },
    { role: 'TENANT', expected: 403 },
  ];

  for (const r of rbacRoles) {
    const res = await apiRequest('/dashboard/summary', 'GET', null, sessions[r.role]);
    assert(
      res.status === r.expected,
      `${r.role} access to /dashboard/summary returned ${res.status} (expected ${r.expected})`
    );
  }

  // Unauthenticated
  const unauthRes = await apiRequest('/dashboard/summary');
  assert(unauthRes.status === 401, `Unauthenticated request is rejected (401 Unauthorized, got ${unauthRes.status})`);

  console.log('\n============================================================');
  console.log(`E2E ASSERTIONS COMPLETED: ${passedAssertions} PASSED, ${failedAssertions} FAILED`);
  console.log('============================================================\n');

  if (failedAssertions > 0) {
    process.exit(1);
  }
}

runDashboardVerification()
  .catch((err) => {
    console.error('Fatal E2E error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
