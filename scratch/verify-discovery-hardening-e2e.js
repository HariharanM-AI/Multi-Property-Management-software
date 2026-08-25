const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API_BASE = 'http://localhost:4000/api/v1';

let passedAssertions = 0;
let totalAssertions = 0;

function assert(condition, message) {
  totalAssertions++;
  if (!condition) {
    console.error(`❌ Assertion FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedAssertions++;
  console.log(`  ✓ ${message}`);
}

async function request(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const res = await fetch(url, { ...options, headers });
  const status = res.status;
  let body = null;
  try {
    body = await res.json();
  } catch (e) {
    // not json
  }
  return { status, ok: res.ok, body };
}

async function runDiscoveryE2ETests() {
  console.log('\n===============================================================');
  console.log('🚀 RUNNING CORE-024 PROPERTY DISCOVERY & SEARCH HARDENING SUITE');
  console.log('===============================================================\n');

  // Clean up any previous test discovery properties
  console.log('1. Setting up multi-tenant test discovery properties across Bangalore, Hyderabad, and Pune...');
  
  // Find or create test organization
  let org = await prisma.organization.findFirst({
    where: { name: 'CORE024 Test Realties' },
  });

  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: 'CORE024 Test Realties',
        legalName: 'CORE024 Test Realties Private Limited',
        email: 'discovery-test@propertyos.in',
        phone: '+919988776655',
      },
    });
  }

  // Ensure test amenities exist
  const wifiAmenity = await prisma.amenity.upsert({
    where: { name: 'High-Speed WiFi' },
    update: {},
    create: { name: 'High-Speed WiFi', category: 'Connectivity', icon: 'Wifi' },
  });

  const acAmenity = await prisma.amenity.upsert({
    where: { name: 'Air Conditioning' },
    update: {},
    create: { name: 'Air Conditioning', category: 'Climate', icon: 'AirVent' },
  });

  const foodAmenity = await prisma.amenity.upsert({
    where: { name: 'Food/Mess Included' },
    update: {},
    create: { name: 'Food/Mess Included', category: 'Food', icon: 'Utensils' },
  });

  const parkingAmenity = await prisma.amenity.upsert({
    where: { name: 'Covered Parking' },
    update: {},
    create: { name: 'Covered Parking', category: 'Parking', icon: 'Car' },
  });

  // Create Property 1: Active PG in Koramangala Bangalore
  const p1 = await prisma.property.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'PROP-DISC-001' } },
    update: {
      status: 'ACTIVE',
      deletedAt: null,
      name: 'Apex Luxury PG Koramangala',
      city: 'Bangalore',
      locality: 'Koramangala',
      state: 'Karnataka',
      postalCode: '560095',
      latitude: 12.9352,
      longitude: 77.6245,
      description: 'Ultra-modern PG facility with high-speed fiber, air conditioning, and North/South Indian meals.',
    },
    create: {
      organizationId: org.id,
      code: 'PROP-DISC-001',
      name: 'Apex Luxury PG Koramangala',
      propertyType: 'PG',
      status: 'ACTIVE',
      address: '101, 80ft Road, 4th Block',
      locality: 'Koramangala',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
      postalCode: '560095',
      latitude: 12.9352,
      longitude: 77.6245,
      contactPhone: '+919876500001',
      contactEmail: 'apex-pg@discovery.test',
      description: 'Ultra-modern PG facility with high-speed fiber, air conditioning, and North/South Indian meals.',
      images: ['https://images.unsplash.com/photo-1555854877-bab0e564b8d5'],
    },
  });

  // Attach amenities to P1
  await prisma.propertyAmenity.deleteMany({ where: { propertyId: p1.id } });
  await prisma.propertyAmenity.createMany({
    data: [
      { propertyId: p1.id, amenityId: wifiAmenity.id },
      { propertyId: p1.id, amenityId: acAmenity.id },
      { propertyId: p1.id, amenityId: foodAmenity.id },
    ],
  });

  // Setup Rooms & Beds for P1 (2 Double sharing rooms with available beds)
  await prisma.bed.deleteMany({ where: { room: { propertyId: p1.id } } });
  await prisma.room.deleteMany({ where: { propertyId: p1.id } });
  await prisma.floor.deleteMany({ where: { propertyId: p1.id } });

  const floor1 = await prisma.floor.create({
    data: {
      propertyId: p1.id,
      floorNumber: 1,
      name: 'First Floor',
    },
  });

  const room1 = await prisma.room.create({
    data: {
      propertyId: p1.id,
      floorId: floor1.id,
      roomNumber: '101',
      sharingType: 'DOUBLE',
      capacity: 2,
      baseRent: 11000,
      amenities: ['AC', 'Attached Bath'],
      beds: {
        create: [
          { bedNumber: '101-A', monthlyRent: 11000, status: 'AVAILABLE' },
          { bedNumber: '101-B', monthlyRent: 11000, status: 'AVAILABLE' },
        ],
      },
    },
  });

  const room2 = await prisma.room.create({
    data: {
      propertyId: p1.id,
      floorId: floor1.id,
      roomNumber: '102',
      sharingType: 'SINGLE',
      capacity: 1,
      baseRent: 19000,
      amenities: ['AC', 'Attached Bath', 'Balcony'],
      beds: {
        create: [
          { bedNumber: '102-A', monthlyRent: 19000, status: 'AVAILABLE' },
        ],
      },
    },
  });

  // Create Property 2: Active Whole-Unit Rental in HSR Layout Bangalore (~3.3km from Koramangala)
  const p2 = await prisma.property.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'PROP-DISC-002' } },
    update: {
      status: 'ACTIVE',
      deletedAt: null,
      name: 'Zenith Heights 2BHK and 3BHK',
      city: 'Bangalore',
      locality: 'HSR Layout',
      state: 'Karnataka',
      postalCode: '560102',
      latitude: 12.9121,
      longitude: 77.6446,
      description: 'Gated community flats with covered parking, 24/7 power backup, and modern amenities.',
    },
    create: {
      organizationId: org.id,
      code: 'PROP-DISC-002',
      name: 'Zenith Heights 2BHK and 3BHK',
      propertyType: 'RENTAL_HOUSE',
      status: 'ACTIVE',
      address: '202, Sector 2, 27th Main',
      locality: 'HSR Layout',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
      postalCode: '560102',
      latitude: 12.9121,
      longitude: 77.6446,
      contactPhone: '+919876500002',
      contactEmail: 'zenith@discovery.test',
      description: 'Gated community flats with covered parking, 24/7 power backup, and modern amenities.',
      images: ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00'],
    },
  });

  await prisma.propertyAmenity.deleteMany({ where: { propertyId: p2.id } });
  await prisma.propertyAmenity.createMany({
    data: [
      { propertyId: p2.id, amenityId: wifiAmenity.id },
      { propertyId: p2.id, amenityId: parkingAmenity.id },
    ],
  });

  await prisma.rentalUnit.deleteMany({ where: { propertyId: p2.id } });
  await prisma.rentalUnit.createMany({
    data: [
      {
        propertyId: p2.id,
        unitNumber: 'Flat 301',
        unitType: '2BHK',
        furnishingStatus: 'FULLY_FURNISHED',
        superBuiltupAreaSqFt: 1200,
        monthlyRent: 35000,
        securityDeposit: 100000,
        maintenanceCharges: 3000,
        status: 'AVAILABLE',
      },
      {
        propertyId: p2.id,
        unitNumber: 'Flat 302',
        unitType: '3BHK',
        furnishingStatus: 'SEMI_FURNISHED',
        superBuiltupAreaSqFt: 1650,
        monthlyRent: 48000,
        securityDeposit: 150000,
        maintenanceCharges: 4000,
        status: 'OCCUPIED',
      },
    ],
  });

  // Create Property 3: Active PG in HITEC City Hyderabad (~500km away)
  const p3 = await prisma.property.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'PROP-DISC-003' } },
    update: {
      status: 'ACTIVE',
      deletedAt: null,
      name: 'Cyber Towers Co-Living PG',
      city: 'Hyderabad',
      locality: 'Madhapur',
      state: 'Telangana',
      postalCode: '500081',
      latitude: 17.4483,
      longitude: 78.3915,
      description: 'Affordable co-living space near Mindspace Cyberabad.',
    },
    create: {
      organizationId: org.id,
      code: 'PROP-DISC-003',
      name: 'Cyber Towers Co-Living PG',
      propertyType: 'PG',
      status: 'ACTIVE',
      address: '77, Madhapur Main Road',
      locality: 'Madhapur',
      city: 'Hyderabad',
      state: 'Telangana',
      country: 'India',
      postalCode: '500081',
      latitude: 17.4483,
      longitude: 78.3915,
      contactPhone: '+919876500003',
      contactEmail: 'cyber-pg@discovery.test',
      description: 'Affordable co-living space near Mindspace Cyberabad.',
      images: ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267'],
    },
  });

  await prisma.propertyAmenity.deleteMany({ where: { propertyId: p3.id } });
  await prisma.propertyAmenity.createMany({
    data: [
      { propertyId: p3.id, amenityId: wifiAmenity.id },
    ],
  });

  await prisma.bed.deleteMany({ where: { room: { propertyId: p3.id } } });
  await prisma.room.deleteMany({ where: { propertyId: p3.id } });
  await prisma.floor.deleteMany({ where: { propertyId: p3.id } });

  const floor3 = await prisma.floor.create({
    data: {
      propertyId: p3.id,
      floorNumber: 2,
      name: 'Second Floor',
    },
  });

  await prisma.room.create({
    data: {
      propertyId: p3.id,
      floorId: floor3.id,
      roomNumber: '201',
      sharingType: 'TRIPLE',
      capacity: 3,
      baseRent: 8000,
      beds: {
        create: [
          { bedNumber: '201-A', monthlyRent: 8000, status: 'AVAILABLE' },
          { bedNumber: '201-B', monthlyRent: 8000, status: 'AVAILABLE' },
          { bedNumber: '201-C', monthlyRent: 8000, status: 'OCCUPIED' },
        ],
      },
    },
  });

  // Create Property 4: INACTIVE Property in Pune (Must NEVER appear in public discovery)
  const p4 = await prisma.property.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'PROP-DISC-004' } },
    update: {
      status: 'INACTIVE',
      deletedAt: null,
      name: 'Draft Unpublished PG Pune',
      city: 'Pune',
      locality: 'Hinjawadi',
      state: 'Maharashtra',
      postalCode: '411057',
    },
    create: {
      organizationId: org.id,
      code: 'PROP-DISC-004',
      name: 'Draft Unpublished PG Pune',
      propertyType: 'PG',
      status: 'INACTIVE',
      address: 'Phase 1, Hinjawadi',
      locality: 'Hinjawadi',
      city: 'Pune',
      state: 'Maharashtra',
      country: 'India',
      postalCode: '411057',
      contactPhone: '+919876500004',
      contactEmail: 'pune-draft@discovery.test',
      images: [],
    },
  });

  console.log('✅ Seeded test properties successfully!\n');

  // =========================================================================
  // TEST GROUP 1: Discovery Cities & Metadata Aggregation
  // =========================================================================
  console.log('2. Testing GET /api/v1/discovery/cities...');
  {
    const res = await request('/discovery/cities');
    assert(res.status === 200, 'GET /cities returns 200 OK');
    assert(res.body.success === true, 'Response body success is true');
    assert(Array.isArray(res.body.data), 'Returns data array');
    
    const bangalore = res.body.data.find((c) => c.city === 'Bangalore');
    assert(bangalore !== undefined, 'Contains Bangalore in discovery cities');
    assert(bangalore.activePropertiesCount >= 2, 'Bangalore activePropertiesCount >= 2');
    assert(bangalore.localities.includes('Koramangala'), 'Bangalore includes Koramangala locality');
    assert(bangalore.localities.includes('HSR Layout'), 'Bangalore includes HSR Layout locality');
    
    const hyderabad = res.body.data.find((c) => c.city === 'Hyderabad');
    assert(hyderabad !== undefined, 'Contains Hyderabad in discovery cities');

    const pune = res.body.data.find((c) => c.city === 'Pune');
    assert(pune === undefined, 'Inactive property city (Pune) is EXCLUDED from discovery cities');
  }

  // =========================================================================
  // TEST GROUP 2: Curated Featured Properties
  // =========================================================================
  console.log('\n3. Testing GET /api/v1/discovery/featured...');
  {
    const res = await request('/discovery/featured?limit=3');
    assert(res.status === 200, 'GET /featured returns 200 OK');
    assert(res.body.success === true, 'Response success is true');
    assert(Array.isArray(res.body.data), 'Featured data is array');
    assert(res.body.data.length <= 3, 'Featured respect limit bounds');
    assert(res.body.data.every((p) => p.status === 'ACTIVE'), 'All featured properties are ACTIVE');
    assert(res.body.data.every((p) => p.hasAvailability === true), 'Properties with available inventory prioritized');
  }

  // =========================================================================
  // TEST GROUP 3: Keyword Search & Deterministic Relational Filters
  // =========================================================================
  console.log('\n4. Testing GET /api/v1/discovery search & relational filters...');
  {
    // Search by property name
    const searchApex = await request('/discovery?search=Apex');
    assert(searchApex.status === 200, 'Search by name returns 200 OK');
    assert(searchApex.body.data.some((p) => p.id === p1.id), 'Finds Apex PG');
    assert(!searchApex.body.data.some((p) => p.id === p2.id), 'Does not include Zenith in Apex search');

    // Filter by City: Bangalore
    const cityBangalore = await request('/discovery?city=Bangalore');
    assert(cityBangalore.status === 200, 'City filter returns 200 OK');
    assert(cityBangalore.body.data.length >= 2, 'Returns Bangalore properties');
    assert(cityBangalore.body.data.every((p) => p.city === 'Bangalore'), 'All returned items have city === Bangalore');

    // Filter by Locality: Koramangala
    const locKora = await request('/discovery?locality=Koramangala');
    assert(locKora.status === 200, 'Locality filter returns 200 OK');
    assert(locKora.body.data.length >= 1, 'Returns Koramangala properties');
    assert(locKora.body.data.every((p) => p.locality === 'Koramangala'), 'All returned items have locality === Koramangala');

    // Filter by PropertyType: PG vs RENTAL_HOUSE
    const pgFilter = await request('/discovery?propertyType=PG');
    assert(pgFilter.status === 200, 'PropertyType PG returns 200 OK');
    assert(pgFilter.body.data.every((p) => p.propertyType === 'PG'), 'All items are PG');

    const rentalFilter = await request('/discovery?propertyType=RENTAL_HOUSE');
    assert(rentalFilter.status === 200, 'PropertyType RENTAL_HOUSE returns 200 OK');
    assert(rentalFilter.body.data.every((p) => p.propertyType === 'RENTAL_HOUSE'), 'All items are RENTAL_HOUSE');

    // Filter by Budget / Rent Range
    const rentFilter = await request('/discovery?minRent=20000&maxRent=40000');
    assert(rentFilter.status === 200, 'Budget range filter returns 200 OK');
    assert(rentFilter.body.data.some((p) => p.id === p2.id), 'Finds 2BHK flat starting at 35000');
    assert(!rentFilter.body.data.some((p) => p.id === p3.id), 'Excludes 8000 PG');

    // Filter by PG Sharing Types
    const sharingFilter = await request('/discovery?sharingTypes=SINGLE,DOUBLE');
    assert(sharingFilter.status === 200, 'Sharing type filter returns 200 OK');
    assert(sharingFilter.body.data.some((p) => p.id === p1.id), 'Finds Apex PG with SINGLE and DOUBLE sharing');

    // Filter by Rental Unit Types
    const unitTypeFilter = await request('/discovery?unitTypes=2BHK');
    assert(unitTypeFilter.status === 200, 'Unit type filter returns 200 OK');
    assert(unitTypeFilter.body.data.some((p) => p.id === p2.id), 'Finds Zenith 2BHK unit');

    // Filter by Required Amenity Intersection
    const amenityFilter = await request('/discovery?amenities=High-Speed WiFi,Air Conditioning,Food/Mess Included');
    assert(amenityFilter.status === 200, 'Amenity intersection returns 200 OK');
    assert(amenityFilter.body.data.some((p) => p.id === p1.id), 'Apex PG has all 3 amenities');
    assert(!amenityFilter.body.data.some((p) => p.id === p2.id), 'Zenith is excluded (missing AC and Mess)');

    // Inactive Property Exclusion (P4)
    const allActive = await request('/discovery?limit=100');
    assert(!allActive.body.data.some((p) => p.id === p4.id), 'Inactive property P4 is NEVER returned in discovery results');
  }

  // =========================================================================
  // TEST GROUP 4: Haversine Geo-Radius Proximity & Distance Calculation
  // =========================================================================
  console.log('\n5. Testing Haversine Geo-Radius & Near-Me Proximity...');
  {
    // Search within 5km of Koramangala coordinates (12.9352, 77.6245)
    const nearMeRes = await request(`/discovery?latitude=12.9352&longitude=77.6245&radiusKm=5&sortBy=DISTANCE_ASC&organizationId=${org.id}`);
    assert(nearMeRes.status === 200, 'Near-Me query returns 200 OK');
    assert(nearMeRes.body.data.length === 2, 'Returns exactly Koramangala and HSR Layout properties for test org');
    
    const first = nearMeRes.body.data[0];
    assert(first.id === p1.id, 'Closest property is Koramangala PG');
    assert(first.distanceKm === 0, 'Origin distance is 0 km');

    const second = nearMeRes.body.data[1];
    assert(second.id === p2.id, 'Second closest property is HSR Layout');
    assert(second.distanceKm > 2.5 && second.distanceKm < 4.0, 'HSR Layout distance is ~3.3km from Koramangala');

    // Hyderabad (~500km away) MUST NOT be present in 5km radius
    assert(!nearMeRes.body.data.some((p) => p.id === p3.id), 'Distant Hyderabad property is excluded by 5km radius');
  }

  // =========================================================================
  // TEST GROUP 5: Deterministic Sorting & Pagination Invariants
  // =========================================================================
  console.log('\n6. Testing Deterministic Sorting & Pagination...');
  {
    // RENT_ASC
    const rentAsc = await request('/discovery?sortBy=RENT_ASC');
    assert(rentAsc.status === 200, 'RENT_ASC returns 200 OK');
    for (let i = 0; i < rentAsc.body.data.length - 1; i++) {
      assert(
        rentAsc.body.data[i].startingRent <= rentAsc.body.data[i + 1].startingRent,
        `Rent order invariant: ${rentAsc.body.data[i].startingRent} <= ${rentAsc.body.data[i + 1].startingRent}`
      );
    }

    // RENT_DESC
    const rentDesc = await request('/discovery?sortBy=RENT_DESC');
    assert(rentDesc.status === 200, 'RENT_DESC returns 200 OK');
    for (let i = 0; i < rentDesc.body.data.length - 1; i++) {
      assert(
        rentDesc.body.data[i].startingRent >= rentDesc.body.data[i + 1].startingRent,
        `Rent order descending: ${rentDesc.body.data[i].startingRent} >= ${rentDesc.body.data[i + 1].startingRent}`
      );
    }

    // Pagination slice test
    const page1 = await request('/discovery?limit=1&page=1');
    const page2 = await request('/discovery?limit=1&page=2');
    assert(page1.body.meta.page === 1, 'Page 1 meta page === 1');
    assert(page1.body.meta.limit === 1, 'Page 1 meta limit === 1');
    assert(page1.body.meta.totalPages >= 3, 'Total pages >= 3');
    assert(page1.body.data.length === 1, 'Page 1 returns 1 item');
    assert(page2.body.data.length === 1, 'Page 2 returns 1 item');
    assert(page1.body.data[0].id !== page2.body.data[0].id, 'Page 1 and Page 2 contain distinct items');
  }

  // =========================================================================
  // TEST GROUP 6: Single Property Detail & Security Sanity
  // =========================================================================
  console.log('\n7. Testing GET /api/v1/discovery/:id & Security Boundaries...');
  {
    // Valid PG detail
    const pgDetail = await request(`/discovery/${p1.id}`);
    assert(pgDetail.status === 200, 'GET /discovery/:id for PG returns 200 OK');
    assert(pgDetail.body.data.name === 'Apex Luxury PG Koramangala', 'Returns exact PG name');
    assert(pgDetail.body.data.availableRooms !== undefined, 'Returns availableRooms array');
    assert(pgDetail.body.data.availableRooms.length === 2, 'Contains 2 rooms');
    assert(pgDetail.body.data.availableCapacity === 3, 'Apex PG availableCapacity === 3 beds');
    assert(pgDetail.body.data.startingRent === 11000, 'Starting rent === 11000');

    // Valid Rental detail
    const rentalDetail = await request(`/discovery/${p2.id}`);
    assert(rentalDetail.status === 200, 'GET /discovery/:id for Rental returns 200 OK');
    assert(rentalDetail.body.data.availableUnits !== undefined, 'Returns availableUnits array');
    assert(rentalDetail.body.data.availableUnits.length === 2, 'Contains 2 rental units');
    assert(rentalDetail.body.data.availableCapacity === 1, 'Zenith availableCapacity === 1 unit');
    assert(rentalDetail.body.data.startingRent === 35000, 'Starting rent === 35000');

    // Fail-Closed: INACTIVE property (P4) MUST return 404
    const inactiveDetail = await request(`/discovery/${p4.id}`);
    assert(inactiveDetail.status === 404, 'Inactive property returns 404 Not Found (fail-closed)');

    // Fail-Closed: Non-existent UUID
    const nonExistent = await request('/discovery/00000000-0000-0000-0000-000000000000');
    assert(nonExistent.status === 404, 'Non-existent UUID returns 404 Not Found');

    // Security PII Invariant: No tenant personal data or internal financial ledger in response
    const jsonStr = JSON.stringify(pgDetail.body);
    assert(!jsonStr.includes('tenantId'), 'No tenantId in public discovery response');
    assert(!jsonStr.includes('passwordHash'), 'No passwordHash in public discovery response');
    assert(!jsonStr.includes('journalEntries'), 'No journalEntries in public discovery response');
  }

  // =========================================================================
  // TEST GROUP 7: Validation Schema Rejections (400 Bad Request)
  // =========================================================================
  console.log('\n8. Testing Validation Bounds & Error Rejection...');
  {
    // Negative minRent
    const negRent = await request('/discovery?minRent=-500');
    assert(negRent.status === 400, 'Negative minRent returns 400 Bad Request');

    // minRent > maxRent
    const invRent = await request('/discovery?minRent=50000&maxRent=10000');
    assert(invRent.status === 400, 'minRent > maxRent returns 400 Bad Request');

    // Invalid Latitude
    const invLat = await request('/discovery?latitude=120&longitude=77');
    assert(invLat.status === 400, 'Latitude > 90 returns 400 Bad Request');

    // DISTANCE_ASC without coordinates
    const noCoordDist = await request('/discovery?sortBy=DISTANCE_ASC');
    assert(noCoordDist.status === 400, 'DISTANCE_ASC without coordinates returns 400 Bad Request');
  }

  console.log('\n===============================================================');
  console.log(`🎉 CORE-024 DISCOVERY SUITE COMPLETE: ${passedAssertions}/${totalAssertions} ASSERTIONS PASSED!`);
  console.log('===============================================================\n');

  await prisma.$disconnect();
}

runDiscoveryE2ETests().catch(async (e) => {
  console.error('\n❌ Suite execution aborted with error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
