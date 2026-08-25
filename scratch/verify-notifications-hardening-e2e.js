/**
 * ==============================================================================
 * PROPERTYOS CORE-023 IN-APP NOTIFICATION SYSTEM REAL POSTGRESQL E2E SUITE
 * ==============================================================================
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const argon2 = require('@node-rs/argon2');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://postgres:postgrespassword@172.21.131.176:5432/propertyos?schema=public',
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

    return { status: res.status, headers: res.headers, data };
  }
}

async function createActor(orgId, roleType, label) {
  const email = `notif-${label}-${crypto.randomBytes(4).toString('hex')}@propertyos-test.com`;
  const passwordHash = await argon2.hash('TestPass123!');

  const user = await prisma.user.create({
    data: {
      organizationId: orgId,
      email,
      passwordHash,
      firstName: label,
      lastName: 'User',
      phone: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
    },
  });

  const role = await prisma.role.findUnique({ where: { name: roleType } });
  if (role) {
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: role.id,
      },
    });
  }

  // Create session for authentication
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  await prisma.session.create({
    data: {
      userId: user.id,
      sessionToken: tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const cookie = `propertyos_session=${rawToken}`;
  return { user, cookie, email };
}

async function main() {
  console.log('\n==============================================================================');
  console.log('PROPERTYOS CORE-023: IN-APP NOTIFICATION REAL POSTGRESQL E2E SUITE');
  console.log('==============================================================================\n');

  try {
    // --------------------------------------------------------------------------
    // 1. SETUP ORGANIZATIONS AND ROLE PERSONAS
    // --------------------------------------------------------------------------
    console.log('[SECTION 1] Setting up Multi-Tenant Actors (Org A and Org B)...');

    const orgA = await prisma.organization.create({
      data: { name: `OrgA Notif Test ${Date.now()}` },
    });
    const orgB = await prisma.organization.create({
      data: { name: `OrgB Notif Test ${Date.now()}` },
    });

    const propA = await prisma.property.create({
      data: {
        organizationId: orgA.id,
        name: 'GreenGlen Villa',
        code: `GG-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
        propertyType: 'PG',
        address: '100 Outer Ring Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560103',
      },
    });

    const propB = await prisma.property.create({
      data: {
        organizationId: orgB.id,
        name: 'Koramangala Residency',
        code: `KM-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
        propertyType: 'RENTAL_HOUSE',
        address: '400 80ft Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560034',
      },
    });

    const ownerA = await createActor(orgA.id, 'OWNER', 'OwnerA');
    const managerA = await createActor(orgA.id, 'PROPERTY_MANAGER', 'ManagerA');
    const accountantA = await createActor(orgA.id, 'ACCOUNTANT', 'AccountantA');
    const wardenA = await createActor(orgA.id, 'WARDEN', 'WardenA');
    const securityA = await createActor(orgA.id, 'SECURITY', 'SecurityA');
    const staffA = await createActor(orgA.id, 'MAINTENANCE_STAFF', 'StaffA');
    const tenantA = await createActor(orgA.id, 'TENANT', 'TenantA');
    const tenantA2 = await createActor(orgA.id, 'TENANT', 'TenantA2');

    const ownerB = await createActor(orgB.id, 'OWNER', 'OwnerB');
    const tenantB = await createActor(orgB.id, 'TENANT', 'TenantB');

    assert(ownerA.user.id && tenantA.user.id && ownerB.user.id, 'Actors and sessions initialized successfully in PostgreSQL');

    // --------------------------------------------------------------------------
    // 2. DISPATCH NOTIFICATIONS OF MULTIPLE TYPES
    // --------------------------------------------------------------------------
    console.log('\n[SECTION 2] Administrative Notification Dispatch & Validation...');

    // 2.1 Owner A dispatches RENT_DUE notification to Tenant A
    const rentDuePayload = {
      userId: tenantA.user.id,
      propertyId: propA.id,
      type: 'RENT_DUE',
      title: 'Rent Due for September',
      message: 'Your monthly rent of ₹16,500.00 is due on 05-Sep-2026.',
      link: '/invoices/inv-101',
      metadata: { invoiceId: 'inv-101', amount: '16500.00' },
    };

    const rentDueRes = await apiRequest('/notifications', 'POST', rentDuePayload, ownerA.cookie);
    assert(rentDueRes.status === 201, 'Owner A dispatches RENT_DUE notification (201 Created)');
    assert(rentDueRes.data?.data?.id, 'Notification created with valid UUID');
    assert(rentDueRes.data?.data?.isRead === false, 'Notification defaults to isRead: false');
    assert(rentDueRes.data?.data?.property?.name === 'GreenGlen Villa', 'Property relation included in response');
    const notifRentDueId = rentDueRes.data?.data?.id;

    // 2.2 Manager A dispatches MAINTENANCE_UPDATED to Tenant A
    const maintPayload = {
      userId: tenantA.user.id,
      propertyId: propA.id,
      type: 'MAINTENANCE_UPDATED',
      title: 'Maintenance Ticket #402 Assigned',
      message: 'A plumbing technician has been assigned to your ticket.',
      link: '/maintenance/ticket-402',
    };
    const maintRes = await apiRequest('/notifications', 'POST', maintPayload, managerA.cookie);
    assert(maintRes.status === 201, 'Manager A dispatches MAINTENANCE_UPDATED notification (201 Created)');
    const notifMaintId = maintRes.data?.data?.id;

    // 2.3 Dispatch PAYMENT_RECEIVED, LEASE_EXPIRING, VISITOR_REQUEST, DOCUMENT_EXPIRING, GENERAL to Tenant A
    const otherTypes = [
      { type: 'PAYMENT_RECEIVED', title: 'Payment Receipt #881', message: 'Received ₹16,500.00 via UPI.', link: '/payments/pay-881' },
      { type: 'PAYMENT_OVERDUE', title: 'Invoice Overdue Notice', message: 'Please clear your overdue balance of ₹2,000.00.', link: '/invoices/inv-099' },
      { type: 'LEASE_EXPIRING', title: 'Lease Renewal in 30 Days', message: 'Your lease agreement is expiring next month.', link: '/agreements/agr-001' },
      { type: 'CHECKOUT_REMINDER', title: 'Move-out Inspection Scheduled', message: 'Warden inspection booked for 31-Aug.', link: '/check-outs/chk-001' },
      { type: 'VISITOR_REQUEST', title: 'Visitor Arrived at Gate', message: 'Ramesh Kumar is at the security desk.', link: '/visitors' },
      { type: 'DOCUMENT_EXPIRING', title: 'Police Verification Required', message: 'Please upload your latest address proof.', link: '/tenants' },
      { type: 'GENERAL', title: 'Scheduled Power Maintenance', message: 'Generator testing from 2 PM to 3 PM tomorrow.', link: '/electricity' },
    ];

    for (const t of otherTypes) {
      const res = await apiRequest('/notifications', 'POST', {
        userId: tenantA.user.id,
        propertyId: propA.id,
        type: t.type,
        title: t.title,
        message: t.message,
        link: t.link,
      }, ownerA.cookie);
      assert(res.status === 201, `Dispatched notification of type ${t.type} (201 Created)`);
    }

    // Dispatch 2 notifications to Tenant A2
    await apiRequest('/notifications', 'POST', {
      userId: tenantA2.user.id,
      propertyId: propA.id,
      type: 'GENERAL',
      title: 'Welcome to GreenGlen Villa',
      message: 'Welcome to our PG residency community!',
      link: '/pg/rooms',
    }, ownerA.cookie);

    // --------------------------------------------------------------------------
    // 3. UNREAD COUNT VERIFICATION
    // --------------------------------------------------------------------------
    console.log('\n[SECTION 3] Unread Counter & Self-Scoping...');

    const unreadCountTenantA = await apiRequest('/notifications/unread-count', 'GET', null, tenantA.cookie);
    assert(unreadCountTenantA.status === 200, 'Tenant A fetches unread count (200 OK)');
    assert(unreadCountTenantA.data?.data?.unreadCount === 9, `Tenant A has exactly 9 unread notifications (actual: ${unreadCountTenantA.data?.data?.unreadCount})`);

    const unreadCountTenantA2 = await apiRequest('/notifications/unread-count', 'GET', null, tenantA2.cookie);
    assert(unreadCountTenantA2.data?.data?.unreadCount === 1, `Tenant A2 has exactly 1 unread notification (actual: ${unreadCountTenantA2.data?.data?.unreadCount})`);

    // --------------------------------------------------------------------------
    // 4. INBOX LISTING, FILTERING, SEARCH & PAGINATION
    // --------------------------------------------------------------------------
    console.log('\n[SECTION 4] Inbox Listing, Filters, Search & Pagination...');

    // 4.1 Full listing for Tenant A
    const listAll = await apiRequest('/notifications?page=1&limit=20', 'GET', null, tenantA.cookie);
    assert(listAll.status === 200, 'Tenant A lists notifications (200 OK)');
    assert(listAll.data?.data?.data?.length === 9, 'All 9 notifications returned in newest-first order');
    assert(listAll.data?.data?.total === 9, 'Total count is 9');

    // 4.2 Filter by isRead = false
    const listUnread = await apiRequest('/notifications?isRead=false', 'GET', null, tenantA.cookie);
    assert(listUnread.data?.data?.data?.length === 9, 'Filtering by isRead=false returns 9 unread items');

    // 4.3 Filter by type = RENT_DUE
    const listRentDue = await apiRequest('/notifications?type=RENT_DUE', 'GET', null, tenantA.cookie);
    assert(listRentDue.data?.data?.data?.length === 1, 'Filtering by type=RENT_DUE returns exactly 1 item');
    assert(listRentDue.data?.data?.data[0]?.type === 'RENT_DUE', 'Item type is RENT_DUE');

    // 4.4 Filter by propertyId
    const listPropA = await apiRequest(`/notifications?propertyId=${propA.id}`, 'GET', null, tenantA.cookie);
    assert(listPropA.data?.data?.data?.length === 9, 'Filtering by propertyId matches Prop A items');

    // 4.5 Search filter
    const searchRes = await apiRequest('/notifications?search=plumbing', 'GET', null, tenantA.cookie);
    assert(searchRes.data?.data?.data?.length === 1, 'Search for "plumbing" matches maintenance notification');
    assert(searchRes.data?.data?.data[0]?.id === notifMaintId, 'Matched correct maintenance notification ID');

    // 4.6 Pagination
    const page1 = await apiRequest('/notifications?page=1&limit=4', 'GET', null, tenantA.cookie);
    assert(page1.data?.data?.data?.length === 4, 'Page 1 limit 4 returns 4 items');
    assert(page1.data?.data?.totalPages === 3, 'Total pages is 3 for 9 items');

    const page2 = await apiRequest('/notifications?page=2&limit=4', 'GET', null, tenantA.cookie);
    assert(page2.data?.data?.data?.length === 4, 'Page 2 limit 4 returns 4 items');

    const page3 = await apiRequest('/notifications?page=3&limit=4', 'GET', null, tenantA.cookie);
    assert(page3.data?.data?.data?.length === 1, 'Page 3 limit 4 returns 1 remaining item');

    // --------------------------------------------------------------------------
    // 5. SINGLE MARK-AS-READ & GET BY ID
    // --------------------------------------------------------------------------
    console.log('\n[SECTION 5] Single Mark-As-Read & Get By ID...');

    // 5.1 Get single notification
    const singleNotif = await apiRequest(`/notifications/${notifRentDueId}`, 'GET', null, tenantA.cookie);
    assert(singleNotif.status === 200, 'Tenant A retrieves single notification by ID (200 OK)');
    assert(singleNotif.data?.data?.id === notifRentDueId, 'Retrieved matching notification ID');

    // 5.2 Mark single notification as read
    const markReadRes = await apiRequest(`/notifications/${notifRentDueId}/read`, 'PATCH', null, tenantA.cookie);
    assert(markReadRes.status === 200, 'Tenant A marks notification as read (200 OK)');
    assert(markReadRes.data?.data?.isRead === true, 'isRead is updated to true');
    assert(markReadRes.data?.data?.readAt !== null, 'readAt timestamp is populated');

    // 5.3 Idempotent read
    const markReadAgain = await apiRequest(`/notifications/${notifRentDueId}/read`, 'PATCH', null, tenantA.cookie);
    assert(markReadAgain.status === 200, 'Marking already-read notification is idempotent (200 OK)');
    assert(markReadAgain.data?.data?.isRead === true, 'isRead remains true');

    // Check unread count decreased to 8
    const countAfterOneRead = await apiRequest('/notifications/unread-count', 'GET', null, tenantA.cookie);
    assert(countAfterOneRead.data?.data?.unreadCount === 8, 'Unread count updated to 8 after 1 item read');

    // --------------------------------------------------------------------------
    // 6. BULK MARK-ALL-AS-READ
    // --------------------------------------------------------------------------
    console.log('\n[SECTION 6] Bulk Mark-All-As-Read...');

    const markAllRes = await apiRequest('/notifications/mark-all-read', 'POST', null, tenantA.cookie);
    assert(markAllRes.status === 200, 'Tenant A executes bulk mark-all-read (200 OK)');
    const markAllData = markAllRes.data?.data || markAllRes.data;
    assert(markAllData?.success === true, 'Bulk mark-all-read returned success: true');
    assert(markAllData?.count === 8, 'Bulk mark-all-read updated remaining 8 unread items');

    const countAfterAllRead = await apiRequest('/notifications/unread-count', 'GET', null, tenantA.cookie);
    assert(countAfterAllRead.data?.data?.unreadCount === 0, 'Unread count is now 0 after bulk mark-all-read');

    // Repeated bulk mark-all-read when 0 unread
    const markAllAgain = await apiRequest('/notifications/mark-all-read', 'POST', null, tenantA.cookie);
    const markAllAgainData = markAllAgain.data?.data || markAllAgain.data;
    assert(markAllAgainData?.count === 0, 'Repeated bulk mark-all-read safely returns count 0');

    // --------------------------------------------------------------------------
    // 7. SECURITY & MULTI-TENANT FAIL-CLOSED ISOLATION
    // --------------------------------------------------------------------------
    console.log('\n[SECTION 7] Security, RBAC & Multi-Tenant Fail-Closed Isolation...');

    // 7.1 Cross-User isolation within same Organization (Tenant A2 cannot access Tenant A's notification)
    const crossUserGet = await apiRequest(`/notifications/${notifRentDueId}`, 'GET', null, tenantA2.cookie);
    assert(crossUserGet.status === 404, 'Cross-user GET by ID returns 404 Not Found (fail-closed)');

    const crossUserRead = await apiRequest(`/notifications/${notifRentDueId}/read`, 'PATCH', null, tenantA2.cookie);
    assert(crossUserRead.status === 404, 'Cross-user mark-as-read returns 404 Not Found');

    const crossUserDelete = await apiRequest(`/notifications/${notifRentDueId}`, 'DELETE', null, tenantA2.cookie);
    assert(crossUserDelete.status === 404, 'Cross-user delete returns 404 Not Found');

    // 7.2 Cross-Organization isolation (Tenant B from Org B cannot access Org A notifications)
    const crossOrgGet = await apiRequest(`/notifications/${notifRentDueId}`, 'GET', null, tenantB.cookie);
    assert(crossOrgGet.status === 404, 'Cross-organization GET returns 404 Not Found');

    const crossOrgRead = await apiRequest(`/notifications/${notifRentDueId}/read`, 'PATCH', null, tenantB.cookie);
    assert(crossOrgRead.status === 404, 'Cross-organization mark-as-read returns 404 Not Found');

    const crossOrgDelete = await apiRequest(`/notifications/${notifRentDueId}`, 'DELETE', null, tenantB.cookie);
    assert(crossOrgDelete.status === 404, 'Cross-organization delete returns 404 Not Found');

    // 7.3 Cannot create notification targeting user in another organization
    const crossOrgCreate = await apiRequest('/notifications', 'POST', {
      userId: tenantB.user.id, // User in Org B
      type: 'GENERAL',
      title: 'Spam',
      message: 'Cross org attack',
    }, ownerA.cookie);
    assert(crossOrgCreate.status === 404, 'Owner A creating notification for Org B user rejected with 404');

    // 7.4 Cannot create notification with foreign propertyId
    const crossPropCreate = await apiRequest('/notifications', 'POST', {
      userId: tenantA.user.id,
      propertyId: propB.id, // Property in Org B
      type: 'GENERAL',
      title: 'Invalid Prop',
      message: 'Property ownership test',
    }, ownerA.cookie);
    assert(crossPropCreate.status === 404, 'Owner A creating notification with Org B property rejected with 404');

    // 7.5 RBAC: Creation restricted to OWNER and PROPERTY_MANAGER
    const accountantCreate = await apiRequest('/notifications', 'POST', rentDuePayload, accountantA.cookie);
    assert(accountantCreate.status === 403, 'Accountant cannot create notifications (403 Forbidden)');

    const wardenCreate = await apiRequest('/notifications', 'POST', rentDuePayload, wardenA.cookie);
    assert(wardenCreate.status === 403, 'Warden cannot create notifications (403 Forbidden)');

    const securityCreate = await apiRequest('/notifications', 'POST', rentDuePayload, securityA.cookie);
    assert(securityCreate.status === 403, 'Security cannot create notifications (403 Forbidden)');

    const staffCreate = await apiRequest('/notifications', 'POST', rentDuePayload, staffA.cookie);
    assert(staffCreate.status === 403, 'Maintenance Staff cannot create notifications (403 Forbidden)');

    const tenantCreate = await apiRequest('/notifications', 'POST', rentDuePayload, tenantA.cookie);
    assert(tenantCreate.status === 403, 'Tenant cannot create notifications (403 Forbidden)');

    // 7.6 RBAC: All 7 roles can read their own notifications
    const rolesToTest = [
      { name: 'OWNER', actor: ownerA },
      { name: 'PROPERTY_MANAGER', actor: managerA },
      { name: 'ACCOUNTANT', actor: accountantA },
      { name: 'WARDEN', actor: wardenA },
      { name: 'SECURITY', actor: securityA },
      { name: 'MAINTENANCE_STAFF', actor: staffA },
      { name: 'TENANT', actor: tenantA },
    ];

    for (const r of rolesToTest) {
      const readRes = await apiRequest('/notifications/unread-count', 'GET', null, r.actor.cookie);
      assert(readRes.status === 200, `Role ${r.name} has NOTIFICATION_READ permission (200 OK)`);
    }

    // 7.7 Unauthenticated access rejected
    const unauthRes = await apiRequest('/notifications', 'GET', null, null);
    assert(unauthRes.status === 401, 'Unauthenticated request rejected with 401 Unauthorized');

    // --------------------------------------------------------------------------
    // 8. NOTIFICATION DELETION & AUDIT LOGGING
    // --------------------------------------------------------------------------
    console.log('\n[SECTION 8] Deletion & Audit Trail Verification...');

    // 8.1 Tenant A deletes their rent due notification
    const deleteRes = await apiRequest(`/notifications/${notifRentDueId}`, 'DELETE', null, tenantA.cookie);
    assert(deleteRes.status === 200, 'Tenant A deletes own notification (200 OK)');
    const deleteData = deleteRes.data?.data || deleteRes.data;
    assert(deleteData?.success === true, 'Delete returned success: true');

    // 8.2 Verify notification no longer exists
    const getDeleted = await apiRequest(`/notifications/${notifRentDueId}`, 'GET', null, tenantA.cookie);
    assert(getDeleted.status === 404, 'Deleted notification is no longer retrievable (404 Not Found)');

    // 8.3 Verify AuditLog entries
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        organizationId: orgA.id,
        resourceType: 'NOTIFICATION',
      },
    });
    assert(auditLogs.length > 0, `Audit logs created for notification actions (found: ${auditLogs.length})`);
    const dispatchLog = auditLogs.find((l) => l.action === 'NOTIFICATION_DISPATCHED');
    assert(dispatchLog !== undefined, 'Audit log contains NOTIFICATION_DISPATCHED event');
    const deleteLog = auditLogs.find((l) => l.action === 'NOTIFICATION_DELETED');
    assert(deleteLog !== undefined, 'Audit log contains NOTIFICATION_DELETED event');

    // --------------------------------------------------------------------------
    // 9. VALIDATION & SANITIZATION RULES
    // --------------------------------------------------------------------------
    console.log('\n[SECTION 9] Validation & Sensitive Data Hygiene...');

    // 9.1 Invalid notification type
    const invalidTypeRes = await apiRequest('/notifications', 'POST', {
      userId: tenantA.user.id,
      type: 'INVALID_AI_TYPE',
      title: 'Invalid',
      message: 'Test',
    }, ownerA.cookie);
    assert(invalidTypeRes.status === 400, 'Invalid NotificationType rejected with 400 Bad Request');

    // 9.2 Empty title
    const emptyTitleRes = await apiRequest('/notifications', 'POST', {
      userId: tenantA.user.id,
      type: 'GENERAL',
      title: '',
      message: 'Test',
    }, ownerA.cookie);
    assert(emptyTitleRes.status === 400, 'Empty title rejected with 400 Bad Request');

    // 9.3 Unsafe external deep-link URL rejected
    const unsafeLinkRes = await apiRequest('/notifications', 'POST', {
      userId: tenantA.user.id,
      type: 'GENERAL',
      title: 'Phishing Alert',
      message: 'Click external link',
      link: 'https://evil.com/login',
    }, ownerA.cookie);
    assert(unsafeLinkRes.status === 400, 'External/non-relative deep link rejected with 400 Bad Request');

    // 9.4 Metadata sanitization check (password field stripped)
    const sanitizedNotifRes = await apiRequest('/notifications', 'POST', {
      userId: tenantA.user.id,
      type: 'GENERAL',
      title: 'Security Verification',
      message: 'Security update',
      metadata: { safeKey: 'safeValue', password: 'plainPasswordSecret' },
    }, ownerA.cookie);
    assert(sanitizedNotifRes.status === 201, 'Notification with metadata created (201 Created)');
    assert(sanitizedNotifRes.data?.data?.metadata?.safeKey === 'safeValue', 'Safe metadata preserved');
    assert(sanitizedNotifRes.data?.data?.metadata?.password === undefined, 'Sensitive password field stripped from metadata');

    // --------------------------------------------------------------------------
    // 10. CLEANUP TEST ARTIFACTS
    // --------------------------------------------------------------------------
    console.log('\n[SECTION 10] Cleaning Up Test Records...');
    await prisma.organization.deleteMany({
      where: { id: { in: [orgA.id, orgB.id] } },
    });
    console.log('  ✅ Cleaned up test organizations and cascaded records');

  } catch (error) {
    console.error('💥 UNCAUGHT ERROR IN E2E SUITE:', error);
    failedAssertions++;
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n==============================================================================');
  console.log(`CORE-023 E2E SUITE SUMMARY: ${passedAssertions} PASSED, ${failedAssertions} FAILED`);
  console.log('==============================================================================\n');

  if (failedAssertions > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();
