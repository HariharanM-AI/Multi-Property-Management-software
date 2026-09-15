import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CheckoutAgreementDocumentSheets } from './CheckoutAgreementDocumentSheets';
import { CheckoutAgreementSignModal } from './CheckoutAgreementSignModal';
import {
  saveCheckoutAgreement,
  getCheckoutAgreement,
  getOrGenerateCheckoutAgreement,
  saveAgreementSignature,
  getAgreementSignature,
  CheckoutAgreementData,
} from '../../lib/agreementStorage';

describe('Check-Out Property Handover & Security Deposit Settlement Agreements', () => {
  beforeEach(() => {
    const storage: Record<string, string> = {};
    const localStorageMock = {
      getItem: (key: string) => storage[key] || null,
      setItem: (key: string, value: string) => {
        storage[key] = value.toString();
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
      clear: () => {
        Object.keys(storage).forEach((k) => delete storage[k]);
      },
    };
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'window', {
      value: {
        localStorage: localStorageMock,
        dispatchEvent: () => true,
      },
      writable: true,
      configurable: true,
    });
  });

  it('should render PAYING GUEST CHECK-OUT AGREEMENT with exact schedule, clauses and deposit arithmetic', () => {
    const pgCheckoutData: CheckoutAgreementData = {
      id: 'checkout-pg-001',
      tenantName: 'Hariharan M',
      tenantPhone: '+91 98765 43210',
      tenantEmail: 'hari@example.com',
      tenantAddress: '42 South Car St, Tirunelveli, Tamil Nadu',
      tenantAadhaar: 'Aadhaar (9876 5432 1098)',
      ownerName: 'Arun Sharma',
      ownerAddress: '#12, Royal Palm Residency, Indiranagar, Bengaluru',
      ownerPhone: '+91 98450 11223',
      propertyName: 'Sri Balaji Luxury PG',
      propertyAddress: '#45, 2nd Main, Indiranagar, Bengaluru',
      unitOrBedName: 'Bed 101-C (Room 101)',
      propertyType: 'PG',
      sharingType: '3-Sharing',
      originalStartDate: '2026-08-01',
      checkOutDate: '2026-09-05',
      signedAt: '2026-09-05T10:00:00.000Z',
      initialDeposit: 17000,
      deductions: 2000,
      deductionReason: 'Painting touch-up and electricity settlement',
      netRefund: 15000,
      transactionRef: 'IMPS-TXN-20260905-9921',
      paymentMode: 'BANK_TRANSFER',
      keyHandoverConfirmed: true,
      status: 'COMPLETED',
      isExecuted: true,
      witnesses: [
        { name: 'Suresh Babu', address: '#45, MG Road, Bengaluru', date: '2026-09-05' },
        { name: 'Mithun Kumar', address: '#12, Indiranagar, Bengaluru', date: '2026-09-05' },
      ],
    };

    const html = renderToStaticMarkup(<CheckoutAgreementDocumentSheets agreementData={pgCheckoutData} />);

    // 1. Verify Document Title
    expect(html).toContain('PAYING GUEST PROPERTY HANDOVER &amp;');
    expect(html).toContain('DEPOSIT SETTLEMENT AGREEMENT');
    expect(html).not.toContain('RESIDENTIAL HOUSE PROPERTY HANDOVER');

    // 2. Verify Recitals
    expect(html).toContain('Owner / Manager');
    expect(html).toContain('Resident');
    expect(html).toContain('Arun Sharma');
    expect(html).toContain('Hariharan M');

    // 3. Verify Schedule Table
    expect(html).toContain('1. Owner / Manager Name:');
    expect(html).toContain('2. Resident Name:');
    expect(html).toContain('3. PG Property Address:');
    expect(html).toContain('4. Allocated Room/Bed No:');
    expect(html).toContain('Bed 101-C (Room 101)');
    expect(html).toContain('5. Agreement Start Date:');
    expect(html).toContain('6. Final Check-Out Date:');

    // 4. Verify Clauses
    expect(html).toContain('1. Notice &amp; Lock-in Compliance:');
    expect(html).toContain('2. Final Dues &amp; Clearance:');
    expect(html).toContain('3. Security Deposit Settlement:');
    expect(html).toContain('4. Release of Mutual Liability:');

    // 5. Verify Deposit Arithmetic
    expect(html).toContain('17,000');
    expect(html).toContain('2,000');
    expect(html).toContain('15,000');
    expect(html).toContain('IMPS-TXN-20260905-9921');

    // 6. Verify Witnesses
    expect(html).toContain('Suresh Babu');
    expect(html).toContain('Mithun Kumar');
  });

  it('should render RESIDENTIAL HOUSE RENTAL CHECK-OUT AGREEMENT with statutory references and full settlement', () => {
    const houseCheckoutData: CheckoutAgreementData = {
      id: 'checkout-house-001',
      tenantName: 'Kavin M',
      tenantPhone: '+91 98450 44332',
      tenantEmail: 'kavin@example.com',
      tenantAddress: '77 Anna Nagar, Chennai, Tamil Nadu',
      tenantAadhaar: 'Aadhar (5432 9876 1122)',
      ownerName: 'Arun Sharma',
      ownerAddress: '#12, Royal Palm Residency, Indiranagar, Bengaluru',
      ownerPhone: '+91 98450 11223',
      propertyName: 'Hari Homes',
      propertyAddress: '#102, 4th Cross, Indiranagar, Bengaluru',
      unitOrBedName: 'Flat 102',
      propertyType: 'RENTAL_HOUSE',
      originalStartDate: '2026-08-01',
      checkOutDate: '2026-09-06',
      signedAt: '2026-09-06T11:30:00.000Z',
      initialDeposit: 50000,
      deductions: 5000,
      deductionReason: 'Wall touch-up and deep cleaning per Clause 6',
      netRefund: 45000,
      transactionRef: 'NEFT-TXN-20260906-8812',
      paymentMode: 'BANK_TRANSFER',
      keyHandoverConfirmed: true,
      status: 'COMPLETED',
      isExecuted: true,
      witnesses: [
        { name: 'Ramesh Sundaram', address: 'Flat 101, Hari Homes, Bengaluru', date: '2026-09-06' },
        { name: 'Anitha Raman', address: 'Flat 103, Hari Homes, Bengaluru', date: '2026-09-06' },
      ],
    };

    const html = renderToStaticMarkup(<CheckoutAgreementDocumentSheets agreementData={houseCheckoutData} />);

    // 1. Verify Document Title & Statutory Header
    expect(html).toContain('RESIDENTIAL HOUSE PROPERTY HANDOVER &amp;');
    expect(html).toContain('DEPOSIT SETTLEMENT AGREEMENT');
    expect(html).toContain('Indian Contract Act, 1872 and the Transfer of Property Act, 1882');

    // 2. Verify Recitals
    expect(html).toContain('Landlord/Lessor');
    expect(html).toContain('Tenant/Lessee');
    expect(html).toContain('Flat 102');

    // 3. Verify Schedule Table
    expect(html).toContain('1. Landlord / Lessor Name:');
    expect(html).toContain('2. Tenant / Lessee Name:');
    expect(html).toContain('3. Rented Property Address:');
    expect(html).toContain('4. Original Agreement Tenancy Period:');
    expect(html).toContain('5. Physical Handover / Move-Out Date:');

    // 4. Verify House Rental Clauses
    expect(html).toContain('1. Handover &amp; Condition Verification:');
    expect(html).toContain('2. Statutory Utility Clearances:');
    expect(html).toContain('3. Deposit Settlement &amp; Deductions:');
    expect(html).toContain('4. Termination of Tenancy &amp; Release:');

    // 5. Verify Deposit Arithmetic
    expect(html).toContain('50,000');
    expect(html).toContain('5,000');
    expect(html).toContain('45,000');
    expect(html).toContain('NEFT-TXN-20260906-8812');

    // 6. Verify Witnesses
    expect(html).toContain('Ramesh Sundaram');
    expect(html).toContain('Anitha Raman');
  });

  it('should maintain check-in agreements and check-out agreements side-by-side without overwriting history', () => {
    // 1. Save original Check-In Agreement
    saveAgreementSignature({
      signerName: 'Hariharan M',
      signedAt: '2026-08-01T09:00:00.000Z',
      agreementType: 'PG_AGREEMENT',
      isSigned: true,
      bedId: 'bed-101-c',
      tenantName: 'Hariharan M',
      unitName: 'Bed 101-C',
      propertyName: 'Sri Balaji Luxury PG',
      monthlyRent: 8500,
      securityDeposit: 17000,
      startDate: '2026-08-01',
      noticePeriodDays: 30,
      lockInMonths: 1,
    });

    // 2. Save Check-Out Settlement Agreement
    const checkoutDoc = getOrGenerateCheckoutAgreement({
      bedId: 'bed-101-c',
      tenantName: 'Hariharan M',
      propertyName: 'Sri Balaji Luxury PG',
      unitOrBedName: 'Bed 101-C',
      propertyType: 'PG',
      originalStartDate: '2026-08-01',
      checkOutDate: '2026-09-05',
      initialDeposit: 17000,
      deductions: 1500,
      deductionReason: 'Minor repairs',
      netRefund: 15500,
    });

    // 3. Verify both documents exist independently and accurately
    const retrievedCheckIn = getAgreementSignature({ bedId: 'bed-101-c' });
    const retrievedCheckOut = getCheckoutAgreement({ bedId: 'bed-101-c' });

    expect(retrievedCheckIn).not.toBeNull();
    expect(retrievedCheckIn?.monthlyRent).toBe(8500);
    expect(retrievedCheckIn?.startDate).toBe('2026-08-01');

    expect(retrievedCheckOut).not.toBeNull();
    expect(retrievedCheckOut?.initialDeposit).toBe(17000);
    expect(retrievedCheckOut?.deductions).toBe(1500);
    expect(retrievedCheckOut?.netRefund).toBe(15500);
    expect(retrievedCheckOut?.checkOutDate).toBe('2026-09-05');
  });

  it('should render CheckoutAgreementSignModal with clean UI matching images 2 & 3 and without dummy autofilled values', () => {
    const rawSettlementData = {
      tenantName: 'Kevin M',
      tenantPhone: '+91 98450 11223',
      tenantEmail: 'kevin@example.com',
      propertyName: 'Sri Balaji Luxury PG',
      unitOrBedName: 'Bed 102-C (Room 102)',
      propertyType: 'PG' as const,
      initialDeposit: 17000,
      deductions: 0,
      // No deductionReason, transactionRef, residentSignature or witnesses provided
    };

    const html = renderToStaticMarkup(
      <CheckoutAgreementSignModal
        isOpen={true}
        onClose={() => {}}
        onSignComplete={() => {}}
        settlementData={rawSettlementData}
      />
    );

    // 1. Verify UI layout matches Image 2 & 3
    expect(html).toContain('Signature of the Resident');
    expect(html).toContain('Draw Pad');
    expect(html).toContain('Type Name');
    expect(html).toContain('Clear &amp; Redraw');
    expect(html).toContain('Draw your signature here with mouse or finger (Large Full-Width Pad)');
    expect(html).toContain('WITNESS 1');
    expect(html).toContain('Witness 1 Signature Pad');
    expect(html).toContain('WITNESS 2');
    expect(html).toContain('Witness 2 Signature Pad');

    // 2. Verify clean placeholders exist
    expect(html).toContain('placeholder="e.g. Ramesh Kumar"');
    expect(html).toContain('placeholder="e.g. Priya Sundaram"');
    expect(html).toContain('placeholder="e.g. #12, 14th Main Road, Sector 4, Coimbatore, Tamil Nadu"');
    expect(html).toContain('placeholder="e.g. #45, 5th Cross, Indiranagar, Bengaluru, Karnataka"');
    expect(html).toContain('placeholder="e.g. Painting touch-up / utility bill clearance or zero dues"');
    expect(html).toContain('placeholder="e.g. UTR / IMPS / Cheque reference number"');

    // 3. Verify NO hardcoded dummy values are rendered in inputs
    expect(html).not.toContain('value="Suresh Babu"');
    expect(html).not.toContain('value="Mithun Kumar"');
    expect(html).not.toContain('value="Room maintenance &amp; utility settlement"');
    expect(html).not.toContain('value="Painting / utility settlement"');
    expect(html).not.toContain('REF-PG-101-343449');
    expect(html).not.toContain('REF-SETTLE-');

    // 4. Verify Model Tenancy and Section 65B footnote
    expect(html).toContain('Model Tenancy Act 2021 Formatted Document');
    expect(html).toContain('Section 65B Indian Evidence Act Compliant Electronic Record');
  });

  it('should accurately restore user-entered data and signatures during Re-Sign flow', () => {
    const reSignSettlementData = {
      tenantName: 'Kevin M',
      tenantPhone: '+91 98450 11223',
      tenantEmail: 'kevin@example.com',
      propertyName: 'Sri Balaji Luxury PG',
      unitOrBedName: 'Bed 102-C (Room 102)',
      propertyType: 'PG' as const,
      initialDeposit: 17000,
      deductions: 2500,
      deductionReason: 'AC repair and room sanitization settlement',
      transactionRef: 'UTR-HDFC-991823',
      paymentMode: 'BANK_TRANSFER',
      residentSignature: 'TYPE:Kevin M',
      witnesses: [
        { name: 'Aakash Mehta', address: '#15, MG Road, Bengaluru', date: '2026-09-07', signature: 'TYPE:Aakash Mehta' },
        { name: 'Deepa Nair', address: '#24, Indiranagar, Bengaluru', date: '2026-09-07', signature: 'TYPE:Deepa Nair' },
      ],
    };

    const html = renderToStaticMarkup(
      <CheckoutAgreementSignModal
        isOpen={true}
        onClose={() => {}}
        onSignComplete={() => {}}
        settlementData={reSignSettlementData}
      />
    );

    // Verify user's filled data is restored and visible
    expect(html).toContain('AC repair and room sanitization settlement');
    expect(html).toContain('UTR-HDFC-991823');
    expect(html).toContain('Aakash Mehta');
    expect(html).toContain('#15, MG Road, Bengaluru');
    expect(html).toContain('Deepa Nair');
    expect(html).toContain('#24, Indiranagar, Bengaluru');
    expect(html).toContain('Kevin M');

    // Verify no arbitrary fallback dummy data replaced the user's data
    expect(html).not.toContain('Room maintenance &amp; utility settlement');
    expect(html).not.toContain('REF-PG-101-343449');
  });
});
