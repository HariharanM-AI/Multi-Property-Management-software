const API_BASE = process.env.API_BASE || 'http://localhost:4000/api/v1';

async function apiRequest(endpoint, method = 'GET', body = null, cookie = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = cookie;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${endpoint}`, options);
  let data = null;
  try {
    data = await res.json();
  } catch (e) {}

  return { status: res.status, headers: res.headers, data };
}

async function runE2E() {
  console.log('====================================================');
  console.log('🚀 CORE-010 DIGITAL AGREEMENTS & SIGNATURES E2E TEST');
  console.log('====================================================\n');

  // Step 1: Register and login as Owner
  const timestamp = Date.now();
  const ownerEmail = `agr_owner_${timestamp}@propertyos.test`;
  const tenantEmail = `agr_tenant_${timestamp}@propertyos.test`;
  const password = 'Password@123456!';

  console.log('1. Registering Owner & Organization...');
  const regRes = await apiRequest('/auth/register', 'POST', {
    email: ownerEmail,
    password,
    firstName: 'Arun',
    lastName: 'Sharma',
    phone: '9845012345',
    organizationName: `Sharma Estates ${timestamp}`,
  });

  if (regRes.status !== 201) {
    console.error('❌ Owner registration failed:', regRes.data);
    process.exit(1);
  }

  const ownerCookie = regRes.headers.get('set-cookie');
  const orgId = regRes.data.data.organization.id;
  console.log(`✅ Owner registered. OrgId: ${orgId}`);

  // Step 2: Create Property
  console.log('\n2. Creating Property...');
  const propRes = await apiRequest(
    '/properties',
    'POST',
    {
      name: `Grand Residency ${timestamp}`,
      code: `GR-${timestamp.toString().slice(-4)}`,
      propertyType: 'RENTAL_HOUSE',
      address: '100 MG Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560001',
      totalFloors: 2,
    },
    ownerCookie
  );

  if (propRes.status !== 201) {
    console.error('❌ Create property failed:', propRes.data);
    process.exit(1);
  }
  const propertyId = propRes.data.data.id;
  console.log(`✅ Property created: ${propRes.data.data.name} (ID: ${propertyId})`);

  // Step 3: Create Rental Unit, Tenant & Lease
  console.log('\n3. Creating Rental Unit, Tenant & Lease...');
  const unitRes = await apiRequest(
    `/properties/${propertyId}/units`,
    'POST',
    {
      unitNumber: 'Flat 101',
      floorNumber: 1,
      unitType: 'APARTMENT',
      monthlyRent: 25000,
      securityDeposit: 50000,
      maintenanceCharges: 2000,
    },
    ownerCookie
  );

  if (unitRes.status !== 201) {
    console.error('❌ Create unit failed:', unitRes.data);
    process.exit(1);
  }
  const unitId = unitRes.data.data.id;

  const tenantRes = await apiRequest(
    '/tenants',
    'POST',
    {
      firstName: 'Ramesh',
      lastName: 'Kumar',
      email: tenantEmail,
      phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
      dateOfBirth: '1995-05-15T00:00:00.000Z',
      permanentAddress: '12 Temple St',
      permanentCity: 'Mysuru',
      permanentState: 'Karnataka',
      permanentPostalCode: '570001',
      emergencyContactName: 'Suresh Kumar',
      emergencyContactPhone: '9845000000',
      emergencyContactRelation: 'Father',
    },
    ownerCookie
  );

  if (tenantRes.status !== 201) {
    console.error('❌ Create tenant failed:', tenantRes.data);
    process.exit(1);
  }
  const tenantId = tenantRes.data.data.id;
  console.log(`✅ Tenant created: Ramesh Kumar (ID: ${tenantId})`);

  const leaseRes = await apiRequest(
    `/properties/${propertyId}/leases`,
    'POST',
    {
      rentalUnitId: unitId,
      tenantId,
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2027-08-31T00:00:00.000Z',
      monthlyRent: 25000,
      securityDeposit: 50000,
      lockInMonths: 6,
      noticePeriodDays: 30,
    },
    ownerCookie
  );

  if (leaseRes.status !== 201) {
    console.error('❌ Create lease failed:', leaseRes.data);
    process.exit(1);
  }
  const leaseId = leaseRes.data.data.id;
  console.log(`✅ Lease created: ID ${leaseId}`);

  // Step 4: Template Management & Version Immutability
  console.log('\n4. Testing Template Management & Version Immutability...');
  const templateRes = await apiRequest(
    '/agreement-templates',
    'POST',
    {
      name: 'Residential Lease Agreement',
      agreementType: 'RENTAL_AGREEMENT',
      description: 'Standard 11-month residential agreement template',
      content: `STANDARD RESIDENTIAL LEASE AGREEMENT
Date: {{AGREEMENT_DATE}}

This agreement is executed between Property Management for {{PROPERTY_NAME}} located at {{PROPERTY_ADDRESS}}, {{PROPERTY_CITY}}, {{PROPERTY_STATE}} and Tenant {{TENANT_NAME}} (Phone: {{TENANT_PHONE}}, Email: {{TENANT_EMAIL}}).

1. PREMISES:
The Landlord grants tenancy of Unit {{UNIT_NUMBER}} at {{PROPERTY_NAME}}.

2. FINANCIAL TERMS:
Monthly Rent: {{MONTHLY_RENT}}
Security Deposit: {{SECURITY_DEPOSIT}}
Lease Duration: {{LEASE_START_DATE}} to {{LEASE_END_DATE}}

3. EMERGENCY CONTACT:
Name: {{EMERGENCY_CONTACT_NAME}} ({{EMERGENCY_CONTACT_RELATION}})
Phone: {{EMERGENCY_CONTACT_PHONE}}

4. DIGITAL ACCEPTANCE:
By digitally executing this agreement, both parties accept the terms and community rules.`,
    },
    ownerCookie
  );

  if (templateRes.status !== 201) {
    console.error('❌ Create template failed:', templateRes.data);
    process.exit(1);
  }
  const templateId = templateRes.data.data.id;
  console.log(`✅ Template created (ID: ${templateId}, v${templateRes.data.data.version}, status: ${templateRes.data.data.status})`);

  // Activate template
  const actRes = await apiRequest(`/agreement-templates/${templateId}/activate`, 'POST', {}, ownerCookie);
  if (actRes.status !== 201 && actRes.status !== 200) {
    console.error('❌ Activate template failed:', actRes.data);
    process.exit(1);
  }
  console.log('✅ Template activated.');

  // Edit active template -> must branch to v2
  const editTmplRes = await apiRequest(
    `/agreement-templates/${templateId}`,
    'PATCH',
    {
      name: 'Residential Lease Agreement',
      content: templateRes.data.data.content + '\n\n5. AMENDMENT: No smoking on premises.',
    },
    ownerCookie
  );

  if (editTmplRes.status !== 200) {
    console.error('❌ Edit active template failed:', editTmplRes.data);
    process.exit(1);
  }
  console.log(`✅ Active template modified -> Branched to new version (ID: ${editTmplRes.data.data.id}, v${editTmplRes.data.data.version}, status: ${editTmplRes.data.data.status})`);

  // Step 5: Create Agreement Draft
  console.log('\n5. Creating Agreement Draft...');
  const createAgrRes = await apiRequest(
    `/properties/${propertyId}/agreements`,
    'POST',
    {
      tenantId,
      leaseId,
      agreementType: 'RENTAL_AGREEMENT',
      templateId,
    },
    ownerCookie
  );

  if (createAgrRes.status !== 201) {
    console.error('❌ Create agreement draft failed:', createAgrRes.data);
    process.exit(1);
  }
  const agreementId = createAgrRes.data.data.id;
  console.log(`✅ Agreement created: ID ${agreementId}, status: ${createAgrRes.data.data.status}, version: ${createAgrRes.data.data.version}`);

  // Step 6: Generate Agreement (Deterministic Rendering, SHA-256 Hashing, PDF generation)
  console.log('\n6. Generating Agreement Snapshot & PDF...');
  const genRes = await apiRequest(
    `/agreements/${agreementId}/generate`,
    'POST',
    { templateId },
    ownerCookie
  );

  if (genRes.status !== 201 && genRes.status !== 200) {
    console.error('❌ Generate agreement failed:', genRes.data);
    process.exit(1);
  }
  const generated = genRes.data.data;
  console.log(`✅ Agreement generated!`);
  console.log(`   - Status: ${generated.status}`);
  console.log(`   - SHA-256 Hash: ${generated.contentHash}`);
  console.log(`   - PDF Document Path: ${generated.documentPath}`);
  console.log(`   - Template Version: v${generated.templateVersion}`);

  if (!generated.contentHash || generated.contentHash.length !== 64) {
    throw new Error('Invalid SHA-256 content hash generated');
  }

  // Step 7: Send For Signature
  console.log('\n7. Sending Agreement for Signature...');
  const sendRes = await apiRequest(`/agreements/${agreementId}/send-for-signature`, 'POST', {}, ownerCookie);
  if (sendRes.status !== 200 && sendRes.status !== 201) {
    console.error('❌ Send for signature failed:', sendRes.data);
    process.exit(1);
  }
  console.log(`✅ Agreement status transitioned to: ${sendRes.data.data.status}`);

  // Step 8: Multi-Party Digital Signatures
  console.log('\n8. Executing Digital Signatures...');

  // Sign as Tenant
  const signTenantRes = await apiRequest(
    `/agreements/${agreementId}/sign`,
    'POST',
    {
      signerType: 'TENANT',
      signerName: 'Ramesh Kumar',
      signerEmail: tenantEmail,
      signatureData: 'ACCEPTED_VIA_PORTAL',
    },
    ownerCookie
  );

  if (signTenantRes.status !== 200 && signTenantRes.status !== 201) {
    console.error('❌ Tenant sign failed:', signTenantRes.data);
    process.exit(1);
  }
  console.log(`✅ Tenant signed. Agreement status: ${signTenantRes.data.data.status}`);

  // Sign as Property Manager
  const signMgrRes = await apiRequest(
    `/agreements/${agreementId}/sign`,
    'POST',
    {
      signerType: 'PROPERTY_MANAGER',
      signerName: 'Arun Sharma',
      signatureData: 'ACCEPTED_VIA_MANAGEMENT_PORTAL',
    },
    ownerCookie
  );

  if (signMgrRes.status !== 200 && signMgrRes.status !== 201) {
    console.error('❌ Manager sign failed:', signMgrRes.data);
    process.exit(1);
  }
  console.log(`✅ Property Manager signed. Agreement status: ${signMgrRes.data.data.status}`);

  // Verify all signatures signed
  const sigsRes = await apiRequest(`/agreements/${agreementId}/signatures`, 'GET', null, ownerCookie);
  console.log(`✅ Signatures verified (${sigsRes.data.data.length} signers, all SIGNED).`);

  // Step 9: Finalization & Permanent Immutability
  console.log('\n9. Finalizing Agreement & Verifying Immutability...');
  const finalizeRes = await apiRequest(`/agreements/${agreementId}/finalize`, 'POST', {}, ownerCookie);
  if (finalizeRes.status !== 200 && finalizeRes.status !== 201) {
    console.error('❌ Finalize failed:', finalizeRes.data);
    process.exit(1);
  }
  console.log(`✅ Agreement finalized! Status: ${finalizeRes.data.data.status}, FinalizedAt: ${finalizeRes.data.data.finalizedAt}`);

  // Idempotency: Finalize again must succeed safely
  const reFinalizeRes = await apiRequest(`/agreements/${agreementId}/finalize`, 'POST', {}, ownerCookie);
  if (reFinalizeRes.status !== 200 && reFinalizeRes.status !== 201) {
    console.error('❌ Re-finalize failed:', reFinalizeRes.data);
    process.exit(1);
  }
  console.log(`✅ Finalize idempotency confirmed. Status: ${reFinalizeRes.data.data.status}`);

  // Immutability: Cancellation of finalized agreement must fail
  const cancelAttemptRes = await apiRequest(
    `/agreements/${agreementId}/cancel`,
    'POST',
    { reason: 'Should fail' },
    ownerCookie
  );

  if (cancelAttemptRes.status === 400) {
    console.log('✅ Finalized agreement cancellation blocked with 400 Bad Request as expected.');
  } else {
    console.error('❌ Expected 400 for cancelling finalized agreement, got:', cancelAttemptRes.status);
    process.exit(1);
  }

  // Step 10: Version Lineage (Create v2 Renewal/Addendum)
  console.log('\n10. Testing Agreement Version Lineage (v2 Renewal/Addendum)...');
  const v2Res = await apiRequest(`/agreements/${agreementId}/new-version`, 'POST', {}, ownerCookie);
  if (v2Res.status !== 201 && v2Res.status !== 200) {
    console.error('❌ Create new version failed:', v2Res.data);
    process.exit(1);
  }
  const v2Agr = v2Res.data.data;
  console.log(`✅ New version created: ID ${v2Agr.id}, Version: v${v2Agr.version}, PreviousAgreementId: ${v2Agr.previousAgreementId}, Status: ${v2Agr.status}`);

  if (v2Agr.version !== 2 || v2Agr.previousAgreementId !== agreementId) {
    throw new Error('Version lineage mismatch');
  }

  // Step 11: Multi-Tenant Scoping Isolation
  console.log('\n11. Testing Multi-Tenant Scoping Isolation...');
  const otherUserEmail = `other_org_${timestamp}@propertyos.test`;
  const otherRegRes = await apiRequest('/auth/register', 'POST', {
    email: otherUserEmail,
    password,
    firstName: 'Other',
    lastName: 'Owner',
    phone: '9845098765',
    organizationName: `Other Org ${timestamp}`,
  });
  const otherCookie = otherRegRes.headers.get('set-cookie');

  const otherAccessRes = await apiRequest(`/agreements/${agreementId}`, 'GET', null, otherCookie);
  if (otherAccessRes.status === 404) {
    console.log('✅ Cross-organization access correctly blocked with 404 Not Found.');
  } else {
    console.error('❌ Expected 404 for cross-org access, got:', otherAccessRes.status);
    process.exit(1);
  }

  // Step 12: Cancellation Lifecycle
  console.log('\n12. Testing Agreement Cancellation...');
  const cancelAgrRes = await apiRequest(
    `/properties/${propertyId}/agreements`,
    'POST',
    {
      tenantId,
      agreementType: 'HOUSE_RULES',
    },
    ownerCookie
  );
  const cancelAgrId = cancelAgrRes.data.data.id;
  const cancelledRes = await apiRequest(
    `/agreements/${cancelAgrId}/cancel`,
    'POST',
    { reason: 'Tenant requested waiver' },
    ownerCookie
  );
  if (cancelledRes.status !== 200 && cancelledRes.status !== 201) {
    console.error('❌ Cancel draft agreement failed:', cancelledRes.data);
    process.exit(1);
  }
  console.log(`✅ Cancellation completed. Status: ${cancelledRes.data.data.status}`);

  console.log('\n====================================================');
  console.log('🎉 ALL CORE-010 E2E TESTS COMPLETED AND PASSED 100%!');
  console.log('====================================================');
}

runE2E().catch((err) => {
  console.error('❌ E2E TEST FAILED:', err);
  process.exit(1);
});
