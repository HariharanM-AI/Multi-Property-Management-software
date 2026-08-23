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

async function runBillingE2E() {
  console.log('================================================================');
  console.log('🚀 CORE-011 BILLING, INVOICING & LEDGER FOUNDATION E2E TEST');
  console.log('================================================================\n');

  const timestamp = Date.now();
  const ownerEmail = `billing_owner_${timestamp}@propertyos.test`;
  const org2Email = `billing_org2_${timestamp}@propertyos.test`;
  const password = 'Password@123456!';

  // 1. Register Owner & Org 1
  console.log('1. Registering Owner & Organization 1...');
  const regRes = await apiRequest('/auth/register', 'POST', {
    email: ownerEmail,
    password,
    firstName: 'Raghav',
    lastName: 'Verma',
    phone: '9876543210',
    organizationName: `Verma Living ${timestamp}`,
  });

  if (regRes.status !== 201) {
    console.error('❌ Owner 1 registration failed:', regRes.data);
    process.exit(1);
  }

  const ownerCookie = regRes.headers.get('set-cookie');
  const orgId = regRes.data.data.organization.id;
  console.log(`✅ Owner 1 registered. OrgId: ${orgId}`);

  // 2. Register Owner & Org 2 (for multi-tenant isolation testing)
  console.log('\n2. Registering Owner & Organization 2 (Multi-tenant Isolation)...');
  const reg2Res = await apiRequest('/auth/register', 'POST', {
    email: org2Email,
    password,
    firstName: 'Other',
    lastName: 'Owner',
    phone: '9876543211',
    organizationName: `Other Org ${timestamp}`,
  });
  const org2Cookie = reg2Res.headers.get('set-cookie');
  const org2Id = reg2Res.data.data.organization.id;
  console.log(`✅ Owner 2 registered. Org2Id: ${org2Id}`);

  // 3. Create Property in Org 1
  console.log('\n3. Creating Property in Org 1...');
  const propRes = await apiRequest(
    '/properties',
    'POST',
    {
      name: `Verma Heights PG ${timestamp}`,
      propertyType: 'PG',
      address: '123 Tech Park Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560100',
    },
    ownerCookie
  );

  if (propRes.status !== 201) {
    console.error('❌ Property creation failed:', propRes.data);
    process.exit(1);
  }
  const propertyId = propRes.data.data.id;
  console.log(`✅ Property created: ${propertyId}`);

  // 4. Create Tenant in Org 1
  console.log('\n4. Creating Tenant in Org 1...');
  const tenantRes = await apiRequest(
    '/tenants',
    'POST',
    {
      firstName: 'Siddharth',
      lastName: 'Nair',
      email: `sid_${timestamp}@propertyos.test`,
      phone: '9845012345',
      emergencyContactName: 'Ramesh Nair',
      emergencyContactPhone: '9845099999',
      emergencyContactRelation: 'Father',
      permanentAddress: '12 Brigade Road',
      permanentCity: 'Bengaluru',
      permanentState: 'Karnataka',
      permanentPostalCode: '560025',
    },
    ownerCookie
  );

  if (tenantRes.status !== 201) {
    console.error('❌ Tenant creation failed:', tenantRes.data);
    process.exit(1);
  }
  const tenantId = tenantRes.data.data.id;
  console.log(`✅ Tenant created: ${tenantId}`);

  // 5. Create Billing Charge Definitions
  console.log('\n5. Creating Billing Charge Definitions...');
  const rentChargeRes = await apiRequest(
    '/billing/charges',
    'POST',
    {
      name: 'Standard Monthly Bed Rent',
      chargeType: 'RENT',
      amount: '12000.00',
      frequency: 'MONTHLY',
      description: 'Monthly accommodation rent',
    },
    ownerCookie
  );

  if (rentChargeRes.status !== 201) {
    console.error('❌ Rent charge creation failed:', rentChargeRes.data);
    process.exit(1);
  }
  const rentChargeId = rentChargeRes.data.data.id;
  console.log(`✅ Rent Charge created: ${rentChargeId} (₹12,000 / MONTHLY)`);

  const utilChargeRes = await apiRequest(
    '/billing/charges',
    'POST',
    {
      name: 'Monthly Maintenance & Wi-Fi',
      chargeType: 'MAINTENANCE',
      amount: '1500.00',
      frequency: 'MONTHLY',
    },
    ownerCookie
  );
  const utilChargeId = utilChargeRes.data.data.id;
  console.log(`✅ Maintenance Charge created: ${utilChargeId} (₹1,500 / MONTHLY)`);

  // 6. Create Recurring Billing Schedule
  console.log('\n6. Creating Recurring Billing Schedule...');
  const today = new Date().toISOString();
  const schedRes = await apiRequest(
    '/billing/schedules',
    'POST',
    {
      tenantId,
      propertyId,
      chargeId: rentChargeId,
      frequency: 'MONTHLY',
      startDate: today,
    },
    ownerCookie
  );

  if (schedRes.status !== 201) {
    console.error('❌ Schedule creation failed:', schedRes.data);
    process.exit(1);
  }
  const scheduleId = schedRes.data.data.id;
  console.log(`✅ Recurring schedule created: ${scheduleId}`);

  // 7. Run Automated Due Billing Cycle
  console.log('\n7. Running Automated Due Billing Cycle...');
  const cycleRes = await apiRequest(
    '/billing/generate-due',
    'POST',
    { asOfDate: today },
    ownerCookie
  );

  if (cycleRes.status !== 201 && cycleRes.status !== 200) {
    console.error('❌ Billing cycle run failed:', cycleRes.data);
    process.exit(1);
  }
  console.log(`✅ Billing cycle generated ${cycleRes.data.data.generatedCount} invoice(s)`);

  // 8. Create Manual Invoice with Multi-line items and Adjustments
  console.log('\n8. Creating Itemized Invoice (DRAFT)...');
  const invRes = await apiRequest(
    '/invoices',
    'POST',
    {
      tenantId,
      propertyId,
      issueDate: today,
      dueDate: new Date(Date.now() + 5 * 86400000).toISOString(),
      adjustments: '-500.00', // ₹500 early-bird discount
      notes: 'Early-bird discount applied',
      lines: [
        {
          description: 'Standard Room Rent',
          chargeType: 'RENT',
          quantity: 1,
          unitAmount: '12000.00',
        },
        {
          description: 'High-speed Fiber Internet & Maintenance',
          chargeType: 'MAINTENANCE',
          quantity: 1,
          unitAmount: '1500.00',
        },
      ],
    },
    ownerCookie
  );

  if (invRes.status !== 201) {
    console.error('❌ Invoice creation failed:', JSON.stringify(invRes.data, null, 2));
    process.exit(1);
  }

  const invoice = invRes.data.data;
  console.log(`✅ Invoice Created: ${invoice.invoiceNumber}`);
  console.log(`   Subtotal: ₹${invoice.subtotal} (Expected: 13500)`);
  console.log(`   Adjustments: ₹${invoice.adjustments} (Expected: -500)`);
  console.log(`   Total Amount: ₹${invoice.totalAmount} (Expected: 13000)`);
  console.log(`   Outstanding: ₹${invoice.outstandingAmount} (Expected: 13000)`);
  console.log(`   Status: ${invoice.status} (Expected: DRAFT)`);

  if (invoice.totalAmount !== '13000' && invoice.totalAmount !== '13000.00') {
    console.error('❌ Incorrect decimal invoice total calculated!');
    process.exit(1);
  }

  // 9. Issue Invoice (DRAFT -> ISSUED) & verify Ledger
  console.log('\n9. Issuing Invoice & verifying Double-Entry Ledger...');
  const issueRes = await apiRequest(`/invoices/${invoice.id}/issue`, 'POST', {}, ownerCookie);
  if (issueRes.status !== 201 && issueRes.status !== 200) {
    console.error('❌ Invoice issue failed:', issueRes.data);
    process.exit(1);
  }
  console.log(`✅ Invoice status transitioned to ISSUED`);

  // Check ledger entries for this invoice
  const invLedgerRes = await apiRequest(`/ledger/invoice/${invoice.id}`, 'GET', null, ownerCookie);
  const invLedger = invLedgerRes.data.data;
  console.log(`✅ Found ${invLedger.length} ledger entries for issued invoice`);
  let invDebit = 0;
  let invCredit = 0;
  for (const entry of invLedger) {
    invDebit += Number(entry.debitAmount);
    invCredit += Number(entry.creditAmount);
  }
  console.log(`   Total Debit: ₹${invDebit} | Total Credit: ₹${invCredit}`);
  if (invDebit !== invCredit || invDebit !== 13500) {
    console.error(`❌ Ledger unbalanced or mismatch! Debit: ${invDebit}, Credit: ${invCredit}`);
    process.exit(1);
  }
  console.log(`✅ Balanced Double-Entry Invariant verified (Total DR === Total CR === ₹13,500)`);

  // 10. Record Payment
  console.log('\n10. Recording Payment with Reference (UPI)...');
  const payRef = `UPI-TXN-${timestamp}`;
  const payRes = await apiRequest(
    '/payments',
    'POST',
    {
      tenantId,
      amount: '13000.00',
      paymentMethod: 'UPI',
      referenceNumber: payRef,
      paymentDate: today,
      notes: 'Full rent & maintenance payment via GPay',
    },
    ownerCookie
  );

  if (payRes.status !== 201) {
    console.error('❌ Payment recording failed:', payRes.data);
    process.exit(1);
  }
  const payment = payRes.data.data;
  console.log(`✅ Payment Recorded: ${payment.id} (₹${payment.amount}, status: ${payment.status})`);

  // 11. Test Idempotency: Repeating duplicate payment reference
  console.log('\n11. Testing Payment Idempotency (Duplicate reference number)...');
  const dupPayRes = await apiRequest(
    '/payments',
    'POST',
    {
      tenantId,
      amount: '13000.00',
      paymentMethod: 'UPI',
      referenceNumber: payRef,
      paymentDate: today,
    },
    ownerCookie
  );

  if (dupPayRes.status === 409) {
    console.log(`✅ Duplicate payment reference correctly rejected with 409 Conflict`);
  } else {
    console.error(`❌ Expected 409 Conflict on duplicate payment reference, got ${dupPayRes.status}`);
    process.exit(1);
  }

  // 12. Allocate Payment Funds to Invoice
  console.log('\n12. Allocating Payment Funds to Invoice...');
  const allocRes = await apiRequest(
    `/payments/${payment.id}/allocate`,
    'POST',
    {
      invoiceId: invoice.id,
      amount: '13000.00',
    },
    ownerCookie
  );

  if (allocRes.status !== 201 && allocRes.status !== 200) {
    console.error('❌ Payment allocation failed:', allocRes.data);
    process.exit(1);
  }

  // Check updated invoice status
  const updatedInvRes = await apiRequest(`/invoices/${invoice.id}`, 'GET', null, ownerCookie);
  const updatedInv = updatedInvRes.data.data;
  console.log(`✅ Invoice status after allocation: ${updatedInv.status} (Expected: PAID)`);
  console.log(`   Paid Amount: ₹${updatedInv.paidAmount} | Outstanding: ₹${updatedInv.outstandingAmount}`);
  if (updatedInv.status !== 'PAID' || Number(updatedInv.outstandingAmount) !== 0) {
    console.error('❌ Invoice not marked as PAID or outstanding balance non-zero!');
    process.exit(1);
  }

  // 13. Test Over-Allocation Protection
  console.log('\n13. Testing Over-Allocation Protection...');
  const overAllocRes = await apiRequest(
    `/payments/${payment.id}/allocate`,
    'POST',
    {
      invoiceId: invoice.id,
      amount: '100.00',
    },
    ownerCookie
  );

  if (overAllocRes.status === 400) {
    console.log(`✅ Over-allocation correctly rejected with 400 Bad Request (${overAllocRes.data?.message})`);
  } else {
    console.error(`❌ Expected 400 on over-allocation, got ${overAllocRes.status}`);
    process.exit(1);
  }

  // 14. Security Deposit Tracking & Invariant Verification
  console.log('\n14. Security Deposit Account & Invariant Verification...');
  const depRes = await apiRequest(`/security-deposits/tenant/${tenantId}`, 'GET', null, ownerCookie);
  const depositAcc = depRes.data.data;
  console.log(`✅ Deposit Account loaded: ${depositAcc.id}`);

  // Set Held Deposit = ₹20,000
  const setHeldRes = await apiRequest(
    `/security-deposits/${depositAcc.id}`,
    'PATCH',
    { amountHeld: '20000.00' },
    ownerCookie
  );
  console.log(`   Deposit Held set to: ₹${setHeldRes.data.data.amountHeld}`);

  // Deduct ₹3,000 and Refund ₹17,000 (Total 20,000 <= 20,000)
  const validUpdateRes = await apiRequest(
    `/security-deposits/${depositAcc.id}`,
    'PATCH',
    { deductionAmount: '3000.00', refundAmount: '17000.00' },
    ownerCookie
  );
  if (validUpdateRes.status === 200) {
    console.log(`✅ Valid Deposit deduction + refund processed. Available: ₹${validUpdateRes.data.data.availableBalance}`);
  } else {
    console.error('❌ Valid deposit update failed:', validUpdateRes.data);
    process.exit(1);
  }

  // Attempt invalid refund that exceeds held deposit (Invariant violation)
  const invalidDepRes = await apiRequest(
    `/security-deposits/${depositAcc.id}`,
    'PATCH',
    { refundAmount: '500.00' }, // 17000 + 3000 + 500 = 20500 > 20000
    ownerCookie
  );

  if (invalidDepRes.status === 400) {
    console.log(`✅ Invariant violation correctly rejected with 400 Bad Request (${invalidDepRes.data?.message})`);
  } else {
    console.error(`❌ Expected 400 on deposit invariant violation, got ${invalidDepRes.status}`);
    process.exit(1);
  }

  // 15. Multi-Tenant Isolation Testing (Org 2 cannot access Org 1 data)
  console.log('\n15. Multi-Tenant Isolation Verification...');
  const crossInvRes = await apiRequest(`/invoices/${invoice.id}`, 'GET', null, org2Cookie);
  const crossPayRes = await apiRequest(`/payments/${payment.id}`, 'GET', null, org2Cookie);
  const crossDepRes = await apiRequest(`/security-deposits/${depositAcc.id}`, 'GET', null, org2Cookie);

  if (crossInvRes.status === 404 && crossPayRes.status === 404 && crossDepRes.status === 404) {
    console.log(`✅ Cross-organization access strictly blocked (All returned 404 Not Found)`);
  } else {
    console.error(`❌ Multi-tenant breach detected! Invoices: ${crossInvRes.status}, Payments: ${crossPayRes.status}, Deposits: ${crossDepRes.status}`);
    process.exit(1);
  }

  // 16. Organization-Wide Balanced Ledger Invariant Check
  console.log('\n16. Verifying Organization-Wide Balanced Ledger Invariant...');
  const allLedgerRes = await apiRequest('/ledger', 'GET', null, ownerCookie);
  const allLedger = allLedgerRes.data.data;
  let totalDebitAll = 0;
  let totalCreditAll = 0;
  for (const e of allLedger) {
    totalDebitAll += Number(e.debitAmount);
    totalCreditAll += Number(e.creditAmount);
  }
  console.log(`   Organization Ledger Total Debit: ₹${totalDebitAll} | Total Credit: ₹${totalCreditAll}`);
  if (totalDebitAll !== totalCreditAll) {
    console.error(`❌ Ledger unbalanced! Debit: ${totalDebitAll}, Credit: ${totalCreditAll}`);
    process.exit(1);
  }
  console.log(`✅ GLOBAL LEDGER INVARIANT SATISFIED: Total Debit === Total Credit`);

  console.log('\n================================================================');
  console.log('🎉 CORE-011 BILLING & FINANCIAL FOUNDATION E2E TEST: PASSED 100%');
  console.log('================================================================\n');
}

runBillingE2E().catch((err) => {
  console.error('Fatal E2E error:', err);
  process.exit(1);
});
