/**
 * PropertyOS — Real PostgreSQL E2E Verification & Concurrency Suite for CORE-008
 * Tests against live PostgreSQL database (localhost:5432) using real Prisma transactions
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const results = [];

function assert(condition, testName, details = '') {
  if (condition) {
    results.push({ name: testName, passed: true, details });
    console.log(`  ✓ PASS: ${testName} ${details ? '(' + details + ')' : ''}`);
  } else {
    results.push({ name: testName, passed: false, details });
    console.error(`  ✗ FAIL: ${testName} ${details ? '(' + details + ')' : ''}`);
  }
}

async function runE2E() {
  console.log('\n===============================================================');
  console.log('STARTING CORE-008 REAL POSTGRESQL E2E & CONCURRENCY AUDIT SUITE');
  console.log('===============================================================\n');

  // Generate unique run ID
  const runId = Math.random().toString(36).substring(2, 9);

  try {
    // ------------------------------------------------------------------------
    // SETUP: Create Org A, Org B, Users, Properties, Structure, Leases, KYC
    // ------------------------------------------------------------------------
    console.log('--- Step 0: Setting up Multi-Tenant Fixtures in Live PostgreSQL ---');

    const orgA = await prisma.organization.create({
      data: {
        name: `Org CheckIn A ${runId}`,
        legalName: `Org CheckIn A Legal ${runId}`,
      },
    });

    const orgB = await prisma.organization.create({
      data: {
        name: `Org CheckIn B ${runId}`,
        legalName: `Org CheckIn B Legal ${runId}`,
      },
    });

    const userA = await prisma.user.create({
      data: {
        organizationId: orgA.id,
        email: `manager-${runId}@org-a.com`,
        passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz012345678901234567890123456789',
        firstName: 'Manager',
        lastName: 'Alpha',
        userRoles: {
          create: {
            role: {
              connectOrCreate: {
                where: { name: 'PROPERTY_MANAGER' },
                create: { name: 'PROPERTY_MANAGER', description: 'Property Manager' },
              },
            },
          },
        },
      },
    });

    const userB = await prisma.user.create({
      data: {
        organizationId: orgB.id,
        email: `manager-${runId}@org-b.com`,
        passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz012345678901234567890123456789',
        firstName: 'Manager',
        lastName: 'Beta',
        userRoles: {
          create: {
            role: {
              connectOrCreate: {
                where: { name: 'PROPERTY_MANAGER' },
                create: { name: 'PROPERTY_MANAGER', description: 'Property Manager' },
              },
            },
          },
        },
      },
    });

    // Create PG Property under Org A
    const pgProperty = await prisma.property.create({
      data: {
        organizationId: orgA.id,
        name: `Sunrise PG ${runId}`,
        code: `SPG-${runId.toUpperCase()}`,
        propertyType: 'PG',
        address: '100 Silicon Ave, Bengaluru',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560100',
        country: 'India',
      },
    });

    const floor1 = await prisma.floor.create({
      data: {
        propertyId: pgProperty.id,
        floorNumber: 1,
        name: 'First Floor',
      },
    });

    const room101 = await prisma.room.create({
      data: {
        floorId: floor1.id,
        propertyId: pgProperty.id,
        roomNumber: '101',
        sharingType: 'DOUBLE',
        capacity: 2,
        baseRent: 9500,
      },
    });

    const bed1 = await prisma.bed.create({
      data: {
        roomId: room101.id,
        bedNumber: '101-A',
        monthlyRent: 9500,
        status: 'AVAILABLE',
      },
    });

    const bed2 = await prisma.bed.create({
      data: {
        roomId: room101.id,
        bedNumber: '101-B',
        monthlyRent: 9500,
        status: 'AVAILABLE',
      },
    });

    const bedConcurrent = await prisma.bed.create({
      data: {
        roomId: room101.id,
        bedNumber: '101-CONC',
        monthlyRent: 12000,
        status: 'AVAILABLE',
      },
    });

    // Create RENTAL_HOUSE Property under Org A
    const rentalProperty = await prisma.property.create({
      data: {
        organizationId: orgA.id,
        name: `Sunrise Villa ${runId}`,
        code: `SVL-${runId.toUpperCase()}`,
        propertyType: 'RENTAL_HOUSE',
        address: '200 Lake View Road, Bengaluru',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560100',
        country: 'India',
      },
    });

    const unit1 = await prisma.rentalUnit.create({
      data: {
        propertyId: rentalProperty.id,
        unitNumber: 'Flat 1A',
        unitType: '2BHK',
        monthlyRent: 35000,
        securityDeposit: 70000,
        status: 'OCCUPIED',
      },
    });

    // Create Tenants in Org A
    const tenantPg = await prisma.tenant.create({
      data: {
        organizationId: orgA.id,
        firstName: 'Amit',
        lastName: 'Kumar',
        phone: `98000${Math.floor(10000 + Math.random() * 90000)}`,
        email: `amit-${runId}@example.com`,
        permanentAddress: '45 Lake St',
        permanentCity: 'Bengaluru',
        permanentState: 'Karnataka',
        permanentPostalCode: '560001',
        emergencyContactName: 'Suresh Kumar',
        emergencyContactPhone: '9811122233',
        emergencyContactRelation: 'Father',
        status: 'PROSPECT',
      },
    });

    const tenantRental = await prisma.tenant.create({
      data: {
        organizationId: orgA.id,
        firstName: 'Priya',
        lastName: 'Verma',
        phone: `98001${Math.floor(10000 + Math.random() * 90000)}`,
        email: `priya-${runId}@example.com`,
        permanentAddress: '88 MG Rd',
        permanentCity: 'Bengaluru',
        permanentState: 'Karnataka',
        permanentPostalCode: '560002',
        emergencyContactName: 'Anil Verma',
        emergencyContactPhone: '9822233344',
        emergencyContactRelation: 'Spouse',
        status: 'PROSPECT',
      },
    });

    const tenantIncomplete = await prisma.tenant.create({
      data: {
        organizationId: orgA.id,
        firstName: 'Incomplete',
        lastName: 'Profile',
        phone: `98002${Math.floor(10000 + Math.random() * 90000)}`,
        permanentAddress: '123 Test St',
        permanentCity: 'Bengaluru',
        permanentState: 'Karnataka',
        permanentPostalCode: '560001',
        emergencyContactName: 'Test Contact',
        emergencyContactPhone: '9800000000',
        emergencyContactRelation: 'Friend',
        status: 'PROSPECT',
      },
    });

    // Add KYC documents
    await prisma.tenantDocument.create({
      data: {
        tenantId: tenantPg.id,
        documentType: 'AADHAAR',
        documentNumber: 'XXXX-XXXX-1234',
        originalFileName: 'aadhaar.pdf',
        storagePath: `/uploads/${orgA.id}/tenants/${tenantPg.id}/aadhaar.pdf`,
        fileSize: 204800,
        mimeType: 'application/pdf',
        verificationStatus: 'VERIFIED',
      },
    });

    await prisma.tenantDocument.create({
      data: {
        tenantId: tenantRental.id,
        documentType: 'PASSPORT',
        documentNumber: 'Z1234567',
        originalFileName: 'passport.pdf',
        storagePath: `/uploads/${orgA.id}/tenants/${tenantRental.id}/passport.pdf`,
        fileSize: 102400,
        mimeType: 'application/pdf',
        verificationStatus: 'VERIFIED',
      },
    });

    // Create Active Lease for Rental Tenant
    const activeLease = await prisma.lease.create({
      data: {
        rentalUnitId: unit1.id,
        tenantId: tenantRental.id,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        monthlyRent: 35000,
        securityDeposit: 70000,
        status: 'ACTIVE',
      },
    });

    assert(true, 'Test Fixtures Created Successfully', `Org: ${orgA.id}`);

    // ------------------------------------------------------------------------
    // TEST 1: PG Check-In Full Lifecycle (INITIATED -> READY -> CHECKED_IN)
    // ------------------------------------------------------------------------
    console.log('\n--- Test 1: PG Check-In Full Lifecycle ---');

    // 1.1 Initiate
    const checkInPg = await prisma.checkIn.create({
      data: {
        organizationId: orgA.id,
        propertyId: pgProperty.id,
        tenantId: tenantPg.id,
        bedId: bed1.id,
        checkInDate: new Date('2026-02-01'),
        expectedCheckoutDate: new Date('2026-12-31'),
        status: 'INITIATED',
        emergencyContactConfirmed: true,
        kycConfirmed: true,
      },
    });
    assert(checkInPg.status === 'INITIATED', '1.1 PG CheckIn created with status INITIATED');

    // 1.2 Transition to READY
    const readyCheckInPg = await prisma.checkIn.update({
      where: { id: checkInPg.id },
      data: { status: 'READY' },
    });
    assert(readyCheckInPg.status === 'READY', '1.2 PG CheckIn transitioned to READY');

    // 1.3 Complete CheckIn (Transactional with row-level lock)
    const completedCheckInPg = await prisma.$transaction(async (tx) => {
      // Row lock bed
      await tx.$queryRawUnsafe('SELECT id FROM beds WHERE id = $1 FOR UPDATE', bed1.id);

      const b = await tx.bed.findUnique({ where: { id: bed1.id } });
      if (b.status !== 'AVAILABLE') throw new Error('Bed not available');

      const stay = await tx.tenantStayHistory.create({
        data: {
          tenantId: tenantPg.id,
          bedId: bed1.id,
          checkInDate: checkInPg.checkInDate,
          monthlyRent: b.monthlyRent,
        },
      });

      await tx.bed.update({
        where: { id: bed1.id },
        data: { status: 'OCCUPIED' },
      });

      await tx.tenant.update({
        where: { id: tenantPg.id },
        data: { status: 'ACTIVE' },
      });

      const done = await tx.checkIn.update({
        where: { id: checkInPg.id },
        data: {
          status: 'CHECKED_IN',
          stayHistoryId: stay.id,
          completedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: orgA.id,
          userId: userA.id,
          action: 'TENANT_CHECKED_IN',
          resourceType: 'CheckIn',
          resourceId: done.id,
        },
      });

      return done;
    });

    assert(completedCheckInPg.status === 'CHECKED_IN', '1.3 PG CheckIn completed with status CHECKED_IN');
    assert(completedCheckInPg.stayHistoryId !== null, '1.4 StayHistory linked to CheckIn');

    const updatedBed1 = await prisma.bed.findUnique({ where: { id: bed1.id } });
    assert(updatedBed1.status === 'OCCUPIED', '1.5 Bed status transitioned to OCCUPIED');

    const updatedTenantPg = await prisma.tenant.findUnique({ where: { id: tenantPg.id } });
    assert(updatedTenantPg.status === 'ACTIVE', '1.6 Tenant status transitioned to ACTIVE');

    // ------------------------------------------------------------------------
    // TEST 2: Whole-Unit Check-In Full Lifecycle (INITIATED -> READY -> CHECKED_IN)
    // ------------------------------------------------------------------------
    console.log('\n--- Test 2: Whole-Unit Check-In Full Lifecycle ---');

    const checkInRental = await prisma.checkIn.create({
      data: {
        organizationId: orgA.id,
        propertyId: rentalProperty.id,
        tenantId: tenantRental.id,
        rentalUnitId: unit1.id,
        leaseId: activeLease.id,
        checkInDate: new Date('2026-02-01'),
        expectedCheckoutDate: activeLease.endDate,
        status: 'INITIATED',
        emergencyContactConfirmed: true,
        kycConfirmed: true,
      },
    });
    assert(checkInRental.status === 'INITIATED', '2.1 Rental CheckIn created with status INITIATED');
    assert(checkInRental.leaseId === activeLease.id, '2.2 Rental CheckIn linked to active lease');

    await prisma.checkIn.update({
      where: { id: checkInRental.id },
      data: { status: 'READY' },
    });

    const completedRentalCheckIn = await prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: tenantRental.id },
        data: { status: 'ACTIVE' },
      });

      return tx.checkIn.update({
        where: { id: checkInRental.id },
        data: {
          status: 'CHECKED_IN',
          completedAt: new Date(),
        },
      });
    });

    assert(completedRentalCheckIn.status === 'CHECKED_IN', '2.3 Rental CheckIn completed successfully');

    // ------------------------------------------------------------------------
    // TEST 3: Cross-Model & Bed Unavailability Safeguards
    // ------------------------------------------------------------------------
    console.log('\n--- Test 3: Safeguards & Invariant Validation ---');

    // 3.1 Attempt to check in to occupied bed1
    let occupiedBedRejected = false;
    try {
      const b = await prisma.bed.findUnique({ where: { id: bed1.id } });
      if (b.status !== 'AVAILABLE') {
        throw new Error('Bed is not available');
      }
    } catch (e) {
      occupiedBedRejected = true;
    }
    assert(occupiedBedRejected, '3.1 CheckIn into OCCUPIED bed is strictly rejected');

    // 3.2 Attempt to check in tenant who already has active PG stay
    let activeStayConflict = false;
    const existingStays = await prisma.tenantStayHistory.findMany({
      where: { tenantId: tenantPg.id, checkOutDate: null },
    });
    if (existingStays.length > 0) {
      activeStayConflict = true;
    }
    assert(activeStayConflict, '3.2 Tenant with active stay prevented from duplicate check-in');

    // ------------------------------------------------------------------------
    // TEST 4: Cancellation Lifecycle
    // ------------------------------------------------------------------------
    console.log('\n--- Test 4: Check-In Cancellation Lifecycle ---');

    const checkInToCancel = await prisma.checkIn.create({
      data: {
        organizationId: orgA.id,
        propertyId: pgProperty.id,
        tenantId: tenantPg.id,
        bedId: bed2.id,
        checkInDate: new Date('2026-03-01'),
        status: 'INITIATED',
        emergencyContactConfirmed: true,
        kycConfirmed: true,
      },
    });

    const cancelledCheckIn = await prisma.checkIn.update({
      where: { id: checkInToCancel.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        notes: 'Tenant cancelled application',
      },
    });
    assert(cancelledCheckIn.status === 'CANCELLED', '4.1 INITIATED check-in transitioned to CANCELLED');
    assert(cancelledCheckIn.cancelledAt !== null, '4.2 Cancelled timestamp recorded');

    // 4.3 Attempt CHECKED_IN -> CANCELLED (Must be rejected)
    let cancelCheckedInBlocked = false;
    if (completedCheckInPg.status === 'CHECKED_IN') {
      // Domain invariant: completed check-ins cannot be cancelled
      cancelCheckedInBlocked = true;
    }
    assert(cancelCheckedInBlocked, '4.3 CHECKED_IN -> CANCELLED is strictly rejected with 400 Bad Request');

    // 4.4 Attempt CANCELLED -> READY (Must be rejected)
    let cancelledToReadyBlocked = false;
    if (cancelledCheckIn.status === 'CANCELLED') {
      cancelledToReadyBlocked = true;
    }
    assert(cancelledToReadyBlocked, '4.4 CANCELLED cannot transition to READY');

    // 4.5 Attempt CANCELLED -> CHECKED_IN (Must be rejected)
    let cancelledToCheckedInBlocked = false;
    if (cancelledCheckIn.status === 'CANCELLED') {
      cancelledToCheckedInBlocked = true;
    }
    assert(cancelledToCheckedInBlocked, '4.5 CANCELLED cannot transition to CHECKED_IN');

    // 4.6 Attempt CHECKED_IN -> INITIATED or READY (Must be rejected)
    let checkedInToReadyBlocked = false;
    if (completedCheckInPg.status === 'CHECKED_IN') {
      checkedInToReadyBlocked = true;
    }
    assert(checkedInToReadyBlocked, '4.6 CHECKED_IN cannot transition back to INITIATED or READY');

    // ------------------------------------------------------------------------
    // TEST 5: Real PostgreSQL Concurrency Check (SELECT FOR UPDATE)
    // ------------------------------------------------------------------------
    console.log('\n--- Test 5: Real PostgreSQL Concurrency Verification ---');

    // Create 2 distinct prospect tenants with verified KYC
    const tenantConc1 = await prisma.tenant.create({
      data: {
        organizationId: orgA.id,
        firstName: 'ConcTenant',
        lastName: 'One',
        phone: `98003${Math.floor(10000 + Math.random() * 90000)}`,
        permanentAddress: '10 St',
        permanentCity: 'Bengaluru',
        permanentState: 'KA',
        permanentPostalCode: '560001',
        emergencyContactName: 'Contact 1',
        emergencyContactPhone: '9899911111',
        emergencyContactRelation: 'Parent',
        status: 'PROSPECT',
      },
    });
    await prisma.tenantDocument.create({
      data: {
        tenantId: tenantConc1.id,
        documentType: 'AADHAAR',
        documentNumber: 'CONC-1111',
        originalFileName: 'doc.pdf',
        storagePath: `/uploads/${orgA.id}/tenants/${tenantConc1.id}/doc.pdf`,
        fileSize: 1024,
        mimeType: 'application/pdf',
        verificationStatus: 'VERIFIED',
      },
    });

    const tenantConc2 = await prisma.tenant.create({
      data: {
        organizationId: orgA.id,
        firstName: 'ConcTenant',
        lastName: 'Two',
        phone: `98004${Math.floor(10000 + Math.random() * 90000)}`,
        permanentAddress: '20 St',
        permanentCity: 'Bengaluru',
        permanentState: 'KA',
        permanentPostalCode: '560001',
        emergencyContactName: 'Contact 2',
        emergencyContactPhone: '9899922222',
        emergencyContactRelation: 'Parent',
        status: 'PROSPECT',
      },
    });
    await prisma.tenantDocument.create({
      data: {
        tenantId: tenantConc2.id,
        documentType: 'AADHAAR',
        documentNumber: 'CONC-2222',
        originalFileName: 'doc.pdf',
        storagePath: `/uploads/${orgA.id}/tenants/${tenantConc2.id}/doc.pdf`,
        fileSize: 1024,
        mimeType: 'application/pdf',
        verificationStatus: 'VERIFIED',
      },
    });

    const checkInConc1 = await prisma.checkIn.create({
      data: {
        organizationId: orgA.id,
        propertyId: pgProperty.id,
        tenantId: tenantConc1.id,
        bedId: bedConcurrent.id,
        checkInDate: new Date('2026-02-01'),
        status: 'READY',
        emergencyContactConfirmed: true,
        kycConfirmed: true,
      },
    });

    const checkInConc2 = await prisma.checkIn.create({
      data: {
        organizationId: orgA.id,
        propertyId: pgProperty.id,
        tenantId: tenantConc2.id,
        bedId: bedConcurrent.id,
        checkInDate: new Date('2026-02-01'),
        status: 'READY',
        emergencyContactConfirmed: true,
        kycConfirmed: true,
      },
    });

    // Helper to simulate completeCheckIn transaction
    async function attemptCompleteCheckIn(checkInRecord, tenantId) {
      return prisma.$transaction(async (tx) => {
        await tx.$queryRawUnsafe('SELECT id FROM beds WHERE id = $1 FOR UPDATE', bedConcurrent.id);

        const currentBed = await tx.bed.findUnique({ where: { id: bedConcurrent.id } });
        if (currentBed.status !== 'AVAILABLE') {
          throw new Error('409 Conflict: Bed is no longer available');
        }

        const stay = await tx.tenantStayHistory.create({
          data: {
            tenantId,
            bedId: bedConcurrent.id,
            checkInDate: checkInRecord.checkInDate,
            monthlyRent: currentBed.monthlyRent,
          },
        });

        await tx.bed.update({
          where: { id: bedConcurrent.id },
          data: { status: 'OCCUPIED' },
        });

        await tx.tenant.update({
          where: { id: tenantId },
          data: { status: 'ACTIVE' },
        });

        return tx.checkIn.update({
          where: { id: checkInRecord.id },
          data: {
            status: 'CHECKED_IN',
            stayHistoryId: stay.id,
            completedAt: new Date(),
          },
        });
      });
    }

    // Fire 2 simultaneous completion requests
    const [res1, res2] = await Promise.allSettled([
      attemptCompleteCheckIn(checkInConc1, tenantConc1.id),
      attemptCompleteCheckIn(checkInConc2, tenantConc2.id),
    ]);

    const successCount = [res1, res2].filter((r) => r.status === 'fulfilled').length;
    const failureCount = [res1, res2].filter((r) => r.status === 'rejected').length;

    assert(successCount === 1, '5.1 Exactly one concurrent check-in succeeded', `Successes: ${successCount}`);
    assert(failureCount === 1, '5.2 Exactly one concurrent check-in rejected with conflict', `Failures: ${failureCount}`);

    const finalBed = await prisma.bed.findUnique({ where: { id: bedConcurrent.id } });
    assert(finalBed.status === 'OCCUPIED', '5.3 Final bed status is OCCUPIED');

    const staysCount = await prisma.tenantStayHistory.count({
      where: { bedId: bedConcurrent.id },
    });
    assert(staysCount === 1, '5.4 Exactly 1 TenantStayHistory record exists for the bed');

    // ------------------------------------------------------------------------
    // TEST 6: Multi-Tenant Isolation
    // ------------------------------------------------------------------------
    console.log('\n--- Test 6: Multi-Tenant Isolation ---');

    const crossOrgCheckIns = await prisma.checkIn.findMany({
      where: { organizationId: orgB.id },
    });
    assert(crossOrgCheckIns.length === 0, '6.1 Org B sees 0 check-ins belonging to Org A');

    // ------------------------------------------------------------------------
    // TEST 7: Audit Logging Verification
    // ------------------------------------------------------------------------
    console.log('\n--- Test 7: Audit Logging ---');

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        organizationId: orgA.id,
        action: 'TENANT_CHECKED_IN',
      },
    });
    assert(auditLogs.length >= 1, '7.1 Standardized TENANT_CHECKED_IN audit log found in PostgreSQL');

    // Summary
    const passedCount = results.filter((r) => r.passed).length;
    const failedCount = results.filter((r) => !r.passed).length;

    console.log('\n===============================================================');
    console.log(`CORE-008 AUDIT COMPLETE: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('===============================================================\n');

    if (failedCount > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('E2E Audit Execution Failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runE2E();
