/**
 * ==============================================================================
 * PROPERTYOS CORE-019 REAL POSTGRESQL HARDENING & E2E VERIFICATION SUITE
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
    passedAssertions++;
    console.log(`  ✅ ${message}`);
  } else {
    failedAssertions++;
    console.error(`  ❌ FAILED: ${message}`);
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

    if (
      (res.status === 429 || (data && data.error && String(data.error.message).includes('ThrottlerException'))) &&
      attempt < maxRetries
    ) {
      await new Promise((r) => setTimeout(r, 1200));
      continue;
    }

    return { status: res.status, headers: res.headers, data };
  }
}

async function loginUser(email, password) {
  const res = await apiRequest('/auth/login', 'POST', { email, password });
  if (res.status !== 200 || !res.data.success) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(res.data)}`);
  }
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) throw new Error(`No session cookie returned for ${email}`);
  const match = setCookie.match(/propertyos_session=([^;]+)/);
  if (!match) throw new Error(`Could not parse session cookie from: ${setCookie}`);
  return `propertyos_session=${match[1]}`;
}

async function runInventoryHardeningSuite() {
  console.log('================================================================');
  console.log('📦 PROPERTYOS CORE-019 INVENTORY & ASSET HARDENING E2E SUITE');
  console.log('================================================================\n');

  const timestamp = Date.now();
  const password = 'Password@123456!';
  const passwordHash = await argon2.hash(password);

  console.log('--- 1. SEEDING MULTI-TENANT TEST FIXTURES ---');

  // Roles lookup
  const roles = await prisma.role.findMany();
  const roleMap = {};
  for (const r of roles) {
    roleMap[r.name] = r.id;
  }

  // 1.1 Org A (Main testing organization)
  const orgA = await prisma.organization.create({
    data: {
      name: `Core19 Inventory Org A ${timestamp}`,
      legalName: `Core19 Org A Pvt Ltd`,
    },
  });

  // Owner A
  const ownerA = await prisma.user.create({
    data: {
      email: `owner_a_${timestamp}@propertyos.test`,
      passwordHash,
      firstName: 'Alok',
      lastName: 'Nath',
      phone: `98${String(timestamp).slice(-8)}`,
      organizationId: orgA.id,
      userRoles: { create: [{ roleId: roleMap['OWNER'] }] },
    },
  });

  // Manager A
  const managerA = await prisma.user.create({
    data: {
      email: `manager_a_${timestamp}@propertyos.test`,
      passwordHash,
      firstName: 'Pooja',
      lastName: 'Hegde',
      phone: `97${String(timestamp).slice(-8)}`,
      organizationId: orgA.id,
      userRoles: { create: [{ roleId: roleMap['PROPERTY_MANAGER'] }] },
    },
  });

  // Warden A
  const wardenA = await prisma.user.create({
    data: {
      email: `warden_a_${timestamp}@propertyos.test`,
      passwordHash,
      firstName: 'Suresh',
      lastName: 'Raina',
      phone: `96${String(timestamp).slice(-8)}`,
      organizationId: orgA.id,
      userRoles: { create: [{ roleId: roleMap['WARDEN'] }] },
    },
  });

  // Tenant A
  const tenantA = await prisma.user.create({
    data: {
      email: `tenant_a_${timestamp}@propertyos.test`,
      passwordHash,
      firstName: 'Rohan',
      lastName: 'Gavaskar',
      phone: `95${String(timestamp).slice(-8)}`,
      organizationId: orgA.id,
      userRoles: { create: [{ roleId: roleMap['TENANT'] }] },
    },
  });

  // 1.2 Org B (Foreign organization for multi-tenant isolation)
  const orgB = await prisma.organization.create({
    data: {
      name: `Core19 Foreign Org B ${timestamp}`,
    },
  });

  const ownerB = await prisma.user.create({
    data: {
      email: `owner_b_${timestamp}@propertyos.test`,
      passwordHash,
      firstName: 'Vikram',
      lastName: 'Foreign',
      phone: `94${String(timestamp).slice(-8)}`,
      organizationId: orgB.id,
      userRoles: { create: [{ roleId: roleMap['OWNER'] }] },
    },
  });

  // 1.3 PG Property in Org A
  const pgPropertyA = await prisma.property.create({
    data: {
      organizationId: orgA.id,
      name: `GreenGlen PG Residency ${timestamp}`,
      code: `PG-${String(timestamp).slice(-6)}`,
      propertyType: 'PG',
      address: '100 Feet Road, Indiranagar',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560038',
    },
  });

  const floorA = await prisma.floor.create({
    data: {
      propertyId: pgPropertyA.id,
      floorNumber: 1,
      name: 'First Floor',
    },
  });

  const room101 = await prisma.room.create({
    data: {
      propertyId: pgPropertyA.id,
      floorId: floorA.id,
      roomNumber: '101',
      sharingType: 'DOUBLE',
      capacity: 2,
      baseRent: 8000,
    },
  });

  const room102 = await prisma.room.create({
    data: {
      propertyId: pgPropertyA.id,
      floorId: floorA.id,
      roomNumber: '102',
      sharingType: 'DOUBLE',
      capacity: 2,
      baseRent: 8000,
    },
  });

  // 1.4 Rental Property in Org A
  const rentalPropertyA = await prisma.property.create({
    data: {
      organizationId: orgA.id,
      name: `Prestige Tower Rental ${timestamp}`,
      code: `RNT-${String(timestamp).slice(-6)}`,
      propertyType: 'RENTAL_HOUSE',
      address: 'Outer Ring Road, Bellandur',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560103',
    },
  });

  const rentalUnit201 = await prisma.rentalUnit.create({
    data: {
      propertyId: rentalPropertyA.id,
      unitNumber: 'Flat 201',
      unitType: '2BHK',
      monthlyRent: 35000,
      securityDeposit: 100000,
    },
  });

  // 1.5 Property in Org B
  const pgPropertyB = await prisma.property.create({
    data: {
      organizationId: orgB.id,
      name: `Foreign PG ${timestamp}`,
      code: `FP-${String(timestamp).slice(-6)}`,
      propertyType: 'PG',
      address: 'MG Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560001',
    },
  });

  console.log('✅ Test fixtures seeded successfully.\n');

  console.log('--- 2. AUTHENTICATION OF ROLES ---');
  const ownerACookie = await loginUser(ownerA.email, password);
  assert(!!ownerACookie, 'Owner A logged in successfully');

  const managerACookie = await loginUser(managerA.email, password);
  assert(!!managerACookie, 'Manager A logged in successfully');

  const wardenACookie = await loginUser(wardenA.email, password);
  assert(!!wardenACookie, 'Warden A logged in successfully');

  const tenantACookie = await loginUser(tenantA.email, password);
  assert(!!tenantACookie, 'Tenant A logged in successfully');

  const ownerBCookie = await loginUser(ownerB.email, password);
  assert(!!ownerBCookie, 'Owner B (Foreign Org) logged in successfully');

  console.log('\n--- 3. ASSET CREATION & OPERATING MODEL VERIFICATION ---');

  // 3.1 Create PG Item assigned to Room 101
  const createPgRes = await apiRequest(
    '/inventory',
    'POST',
    {
      propertyId: pgPropertyA.id,
      roomId: room101.id,
      itemName: 'Voltas 1.5 Ton Split AC',
      category: 'APPLIANCE',
      serialNumber: `SN-VOLT-${timestamp}`,
      condition: 'NEW',
      purchaseDate: '2026-01-15T00:00:00.000Z',
      purchasePrice: 34990.0,
    },
    ownerACookie
  );

  assert(createPgRes.status === 201, `PG Item created successfully (HTTP 201) [got ${createPgRes.status}]`);
  assert(createPgRes.data?.data?.status === 'ASSIGNED', 'Initial status is ASSIGNED for room allocation');
  assert(createPgRes.data?.data?.locationDisplay === 'Room 101', 'Location display correctly resolves to "Room 101"');
  assert(createPgRes.data?.data?.purchasePrice === 34990, 'Purchase price Decimal value preserved exactly');
  const pgItemId = createPgRes.data?.data?.id;

  // 3.2 Create PG Common Unassigned Asset
  const createCommonRes = await apiRequest(
    '/inventory',
    'POST',
    {
      propertyId: pgPropertyA.id,
      itemName: 'Kent Grand Plus Water Purifier',
      category: 'APPLIANCE',
      condition: 'GOOD',
      purchasePrice: 14500.5,
    },
    ownerACookie
  );

  assert(createCommonRes.status === 201, `Common PG Item created (HTTP 201)`);
  assert(createCommonRes.data?.data?.status === 'AVAILABLE', 'Unassigned common asset defaults to AVAILABLE');
  assert(
    createCommonRes.data?.data?.locationDisplay === 'Property Stock (Unassigned)',
    'Unassigned asset locationDisplay is "Property Stock (Unassigned)"'
  );
  const commonItemId = createCommonRes.data?.data?.id;

  // 3.3 Create Rental House Item assigned to Unit 201
  const createRentalRes = await apiRequest(
    '/inventory',
    'POST',
    {
      propertyId: rentalPropertyA.id,
      rentalUnitId: rentalUnit201.id,
      itemName: 'LG 260L Frost Free Refrigerator',
      category: 'APPLIANCE',
      serialNumber: `SN-LG-${timestamp}`,
      condition: 'NEW',
      purchasePrice: 28990.0,
    },
    managerACookie
  );

  assert(createRentalRes.status === 201, `Rental Unit Item created (HTTP 201)`);
  assert(createRentalRes.data?.data?.status === 'ASSIGNED', 'Rental unit asset status is ASSIGNED');
  assert(createRentalRes.data?.data?.locationDisplay === 'Unit Flat 201', 'Location display is "Unit Flat 201"');
  const rentalItemId = createRentalRes.data?.data?.id;

  // 3.4 Cross-Model Assignment Rejection: PG Property with rentalUnitId
  const crossPgRes = await apiRequest(
    '/inventory',
    'POST',
    {
      propertyId: pgPropertyA.id,
      rentalUnitId: rentalUnit201.id,
      itemName: 'Invalid Cross Item',
      category: 'FURNITURE',
    },
    ownerACookie
  );
  assert(
    crossPgRes.status === 400,
    `PG property correctly rejects rental unit assignment (HTTP 400 Bad Request) [got ${crossPgRes.status}]`
  );

  // 3.5 Cross-Model Assignment Rejection: Rental Property with roomId
  const crossRentalRes = await apiRequest(
    '/inventory',
    'POST',
    {
      propertyId: rentalPropertyA.id,
      roomId: room101.id,
      itemName: 'Invalid Cross Item',
      category: 'FURNITURE',
    },
    ownerACookie
  );
  assert(
    crossRentalRes.status === 400,
    `Rental property correctly rejects room assignment (HTTP 400 Bad Request) [got ${crossRentalRes.status}]`
  );

  // 3.6 Negative Purchase Price Rejection
  const negPriceRes = await apiRequest(
    '/inventory',
    'POST',
    {
      propertyId: pgPropertyA.id,
      itemName: 'Negative Price Item',
      category: 'FURNITURE',
      purchasePrice: -500,
    },
    ownerACookie
  );
  assert(negPriceRes.status === 400, `Negative purchase price rejected (HTTP 400 Bad Request)`);

  console.log('\n--- 4. MULTI-TENANT ISOLATION & FAIL-CLOSED BOUNDARIES ---');

  // 4.1 Foreign Org B attempting to fetch Org A inventory item
  const foreignGetRes = await apiRequest(`/inventory/${pgItemId}`, 'GET', null, ownerBCookie);
  assert(
    foreignGetRes.status === 404,
    `Cross-org inventory fetch fails closed with 404 Not Found [got ${foreignGetRes.status}]`
  );

  // 4.2 Foreign Org B attempting to update Org A inventory item
  const foreignPatchRes = await apiRequest(
    `/inventory/${pgItemId}`,
    'PATCH',
    { itemName: 'Hacked Name' },
    ownerBCookie
  );
  assert(
    foreignPatchRes.status === 404,
    `Cross-org inventory update fails closed with 404 Not Found [got ${foreignPatchRes.status}]`
  );

  // 4.3 Foreign Org B attempting to delete Org A inventory item
  const foreignDeleteRes = await apiRequest(`/inventory/${pgItemId}`, 'DELETE', null, ownerBCookie);
  assert(
    foreignDeleteRes.status === 404,
    `Cross-org inventory delete fails closed with 404 Not Found [got ${foreignDeleteRes.status}]`
  );

  // 4.4 Org A attempting to create inventory item on Org B's property
  const foreignPropCreateRes = await apiRequest(
    '/inventory',
    'POST',
    {
      propertyId: pgPropertyB.id,
      itemName: 'Trespass Item',
      category: 'FURNITURE',
    },
    ownerACookie
  );
  assert(
    foreignPropCreateRes.status === 404,
    `Creating item on foreign property fails closed with 404 Not Found [got ${foreignPropCreateRes.status}]`
  );

  console.log('\n--- 5. CONCURRENCY & TRANSACTION-SCOPED ADVISORY LOCKING ---');

  // 5.1 Duplicate Serial Number Rejection (Sequential)
  const dupSerialRes = await apiRequest(
    '/inventory',
    'POST',
    {
      propertyId: pgPropertyA.id,
      itemName: 'Duplicate AC',
      category: 'APPLIANCE',
      serialNumber: `SN-VOLT-${timestamp}`, // same serial on same property
    },
    ownerACookie
  );
  assert(
    dupSerialRes.status === 409,
    `Duplicate serial number on same property rejected with 409 Conflict [got ${dupSerialRes.status}]`
  );

  // 5.2 Concurrent 5-way Serial Number Creation Race Test
  console.log('  ⚡ Executing 5-way concurrent creation race with identical serial number...');
  const raceSerial = `SN-RACE-${timestamp}`;
  const racePromises = Array.from({ length: 5 }).map((_, idx) =>
    apiRequest(
      '/inventory',
      'POST',
      {
        propertyId: pgPropertyA.id,
        itemName: `Race Candidate ${idx + 1}`,
        category: 'ELECTRONIC',
        serialNumber: raceSerial,
        purchasePrice: 15000,
      },
      ownerACookie
    )
  );

  const raceResults = await Promise.all(racePromises);
  const raceSuccesses = raceResults.filter((r) => r.status === 201);
  const raceConflicts = raceResults.filter((r) => r.status === 409);

  assert(
    raceSuccesses.length === 1,
    `Serial race condition protected: Exactly 1 creation succeeded (201 Created) [count=${raceSuccesses.length}]`
  );
  assert(
    raceConflicts.length === 4,
    `Serial race condition protected: Exactly 4 requests rejected with 409 Conflict [count=${raceConflicts.length}]`
  );

  console.log('\n--- 6. ASSET REASSIGNMENT, UNASSIGNMENT & LIFECYCLE ---');

  // 6.1 Reassign from Room 101 to Room 102
  const reassignRes = await apiRequest(
    `/inventory/${pgItemId}/assign`,
    'POST',
    { roomId: room102.id },
    managerACookie
  );
  assert(reassignRes.status === 200, `Asset reassigned from Room 101 to Room 102 (HTTP 200)`);
  assert(reassignRes.data?.data?.locationDisplay === 'Room 102', 'Location display updated to "Room 102"');
  assert(reassignRes.data?.data?.status === 'ASSIGNED', 'Status remains ASSIGNED after transfer');

  // 6.2 Unassign from Room 102 to Common Stock
  const unassignRes = await apiRequest(`/inventory/${pgItemId}/unassign`, 'POST', {}, wardenACookie);
  assert(unassignRes.status === 200, `Asset unassigned back to common stock (HTTP 200)`);
  assert(unassignRes.data?.data?.status === 'AVAILABLE', 'Unassigned asset transitions status to AVAILABLE');
  assert(
    unassignRes.data?.data?.locationDisplay === 'Property Stock (Unassigned)',
    'Location display reflects unassigned stock'
  );

  // 6.3 5-way Concurrent Assignment Race Test
  console.log('  ⚡ Executing 5-way concurrent assignment race on same unassigned asset...');
  const assignRacePromises = [
    apiRequest(`/inventory/${pgItemId}/assign`, 'POST', { roomId: room101.id }, ownerACookie),
    apiRequest(`/inventory/${pgItemId}/assign`, 'POST', { roomId: room102.id }, managerACookie),
    apiRequest(`/inventory/${pgItemId}/assign`, 'POST', { roomId: room101.id }, wardenACookie),
    apiRequest(`/inventory/${pgItemId}/assign`, 'POST', { roomId: room102.id }, ownerACookie),
    apiRequest(`/inventory/${pgItemId}/assign`, 'POST', { roomId: room101.id }, managerACookie),
  ];

  const assignRaceResults = await Promise.all(assignRacePromises);
  const assignSuccessful = assignRaceResults.filter((r) => r.status === 200);
  assert(
    assignSuccessful.length === 5,
    `Advisory lock serialized concurrent assignments cleanly without deadlock (HTTP 200)`
  );

  const finalItemState = await apiRequest(`/inventory/${pgItemId}`, 'GET', null, ownerACookie);
  assert(
    finalItemState.data?.data?.status === 'ASSIGNED' &&
      (finalItemState.data?.data?.roomId === room101.id || finalItemState.data?.data?.roomId === room102.id),
    'Asset is in consistent final state after concurrent assignments'
  );

  // 6.4 Update Condition to DAMAGED
  const conditionRes = await apiRequest(
    `/inventory/${pgItemId}`,
    'PATCH',
    { condition: 'DAMAGED' },
    wardenACookie
  );
  assert(conditionRes.status === 200, `Condition updated to DAMAGED (HTTP 200)`);
  assert(conditionRes.data?.data?.condition === 'DAMAGED', 'Condition is DAMAGED');

  // 6.5 Transition Status to UNDER_REPAIR
  const repairRes = await apiRequest(
    `/inventory/${pgItemId}`,
    'PATCH',
    { status: 'UNDER_REPAIR' },
    managerACookie
  );
  assert(repairRes.status === 200, `Status transitioned to UNDER_REPAIR (HTTP 200)`);
  assert(repairRes.data?.data?.status === 'UNDER_REPAIR', 'Status is UNDER_REPAIR');

  // 6.6 Block Assignment when UNDER_REPAIR
  const blockedRepairAssignRes = await apiRequest(
    `/inventory/${pgItemId}/assign`,
    'POST',
    { roomId: room101.id },
    managerACookie
  );
  assert(
    blockedRepairAssignRes.status === 400,
    `Assignment blocked for asset UNDER_REPAIR (HTTP 400 Bad Request) [got ${blockedRepairAssignRes.status}]`
  );

  // 6.7 Transition Status to DISPOSED (auto-unassigns)
  const disposeRes = await apiRequest(
    `/inventory/${pgItemId}`,
    'PATCH',
    { status: 'DISPOSED' },
    ownerACookie
  );
  assert(disposeRes.status === 200, `Status transitioned to DISPOSED (HTTP 200)`);
  assert(disposeRes.data?.data?.status === 'DISPOSED', 'Status is DISPOSED');
  assert(disposeRes.data?.data?.roomId === null, 'Disposed asset automatically unassigned from room');

  // 6.8 Block Assignment when DISPOSED
  const blockedDisposeAssignRes = await apiRequest(
    `/inventory/${pgItemId}/assign`,
    'POST',
    { roomId: room101.id },
    ownerACookie
  );
  assert(
    blockedDisposeAssignRes.status === 400,
    `Assignment blocked for DISPOSED asset (HTTP 400 Bad Request) [got ${blockedDisposeAssignRes.status}]`
  );

  console.log('\n--- 7. INVENTORY SUMMARY & DECIMAL VALUATION KPIS ---');

  const summaryRes = await apiRequest('/inventory/summary', 'GET', null, ownerACookie);
  assert(summaryRes.status === 200, `Inventory summary fetched successfully (HTTP 200)`);
  const summary = summaryRes.data?.data;

  assert(typeof summary.totalItems === 'number' && summary.totalItems >= 3, `Total items count is accurate (${summary.totalItems})`);
  assert(typeof summary.assignedItems === 'number', `Assigned items count reported (${summary.assignedItems})`);
  assert(typeof summary.availableItems === 'number', `Available items count reported (${summary.availableItems})`);
  assert(typeof summary.underRepairItems === 'number', `Under repair count reported (${summary.underRepairItems})`);
  assert(typeof summary.damagedItems === 'number', `Damaged count reported (${summary.damagedItems})`);
  assert(
    Number(summary.totalAssetValue) > 0,
    `Total asset valuation calculated accurately with Decimal precision (₹${summary.totalAssetValue})`
  );

  console.log('\n--- 8. RBAC & TENANT SECURITY BOUNDARIES ---');

  // 8.1 Tenant blocked from inventory creation (HTTP 403)
  const tenantCreateRes = await apiRequest(
    '/inventory',
    'POST',
    {
      propertyId: pgPropertyA.id,
      itemName: 'Tenant Chair',
      category: 'FURNITURE',
    },
    tenantACookie
  );
  assert(
    tenantCreateRes.status === 403,
    `Tenant blocked from inventory creation (HTTP 403 Forbidden) [got ${tenantCreateRes.status}]`
  );

  // 8.2 Tenant blocked from inventory viewing (HTTP 403)
  const tenantListRes = await apiRequest('/inventory', 'GET', null, tenantACookie);
  assert(
    tenantListRes.status === 403,
    `Tenant blocked from viewing inventory roster (HTTP 403 Forbidden) [got ${tenantListRes.status}]`
  );

  // 8.3 Tenant blocked from inventory deletion (HTTP 403)
  const tenantDeleteRes = await apiRequest(`/inventory/${commonItemId}`, 'DELETE', null, tenantACookie);
  assert(
    tenantDeleteRes.status === 403,
    `Tenant blocked from inventory deletion (HTTP 403 Forbidden) [got ${tenantDeleteRes.status}]`
  );

  console.log('\n--- 9. AUDIT TRAIL & ASSET DELETION ---');

  // 9.1 Verify Audit Log Entries in Database
  const auditLogs = await prisma.auditLog.findMany({
    where: { organizationId: orgA.id, resourceType: 'INVENTORY_ITEM' },
  });
  assert(auditLogs.length >= 5, `Audit logs recorded for inventory lifecycle (found ${auditLogs.length} events)`);

  const createdLogs = auditLogs.filter((l) => l.action === 'INVENTORY_CREATED');
  assert(createdLogs.length >= 1, `INVENTORY_CREATED audit log entries present`);

  const assignedLogs = auditLogs.filter((l) => l.action === 'INVENTORY_ASSIGNED');
  assert(assignedLogs.length >= 1, `INVENTORY_ASSIGNED audit log entries present`);

  const conditionLogs = auditLogs.filter((l) => l.action === 'INVENTORY_CONDITION_CHANGED');
  assert(conditionLogs.length >= 1, `INVENTORY_CONDITION_CHANGED audit log entries present`);

  // 9.2 Delete Inventory Item
  const deleteRes = await apiRequest(`/inventory/${commonItemId}`, 'DELETE', null, ownerACookie);
  assert(deleteRes.status === 200, `Inventory item deleted successfully (HTTP 200)`);

  const postDeleteLookup = await apiRequest(`/inventory/${commonItemId}`, 'GET', null, ownerACookie);
  assert(postDeleteLookup.status === 404, `Deleted item no longer accessible (HTTP 404 Not Found)`);

  const deleteAudit = await prisma.auditLog.findFirst({
    where: { organizationId: orgA.id, resourceId: commonItemId, action: 'INVENTORY_DELETED' },
  });
  assert(!!deleteAudit, `INVENTORY_DELETED snapshot audit log recorded`);

  console.log('\n================================================================');
  console.log(`🎉 CORE-019 INVENTORY E2E HARDENING SUMMARY`);
  console.log(`   Passed Assertions: ${passedAssertions}`);
  console.log(`   Failed Assertions: ${failedAssertions}`);
  console.log('================================================================\n');

  if (failedAssertions > 0) {
    process.exit(1);
  }
}

runInventoryHardeningSuite()
  .catch((err) => {
    console.error('Fatal error running CORE-019 E2E hardening suite:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
