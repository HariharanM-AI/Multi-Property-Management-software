import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AgreementDocumentSheets } from './AgreementDocumentSheets';
import { formatIdProofDisplay } from './AgreementSignModal';
import {
  saveAgreementSignature,
  getAgreementSignature,
  getOrGenerateAgreementSignature,
  generateDigitalSignatureDataUrl,
} from '../../lib/agreementStorage';

describe('House Rental Model Agreement & Flow Verification', () => {
  beforeEach(() => {
    // Simple in-memory localStorage mock for node test environment
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

  it('should render RESIDENTIAL HOUSE RENTAL AGREEMENT title and Landlord/Tenant recitals', () => {
    const rentalData = {
      tenantName: 'Vikram Seth',
      tenantPhone: '+91 98765 43210',
      tenantEmail: 'vikram@example.com',
      tenantAddress: '42 MG Road, Indiranagar, Bengaluru, Karnataka 560038',
      tenantAadhaar: 'Aadhaar (9876 5432 1098)',
      ownerName: 'Arun Sharma',
      ownerAddress: '#12, Royal Palm Residency, Coimbatore, Tamil Nadu',
      ownerPhone: '+91 98450 12345',
      propertyName: 'Palm Grove Apartments',
      propertyAddress: '#12, Royal Palm Residency, Coimbatore, Tamil Nadu',
      unitOrBedName: 'Flat 302',
      propertyType: 'RENTAL_HOUSE' as const,
      monthlyRent: 35000,
      securityDeposit: 70000,
      noticePeriodDays: 30,
      lockInMonths: 6,
      startDate: '2026-09-01',
      endDate: '2027-08-01',
      witnesses: [
        {
          name: 'Rajesh Kumar',
          date: '2026-09-01',
          address: 'Flat 101, Palm Grove Apartments, Coimbatore',
          signature: 'TYPE:Rajesh Kumar',
        },
        {
          name: 'Priya Sharma',
          date: '2026-09-01',
          address: 'Flat 102, Palm Grove Apartments, Coimbatore',
          signature: 'TYPE:Priya Sharma',
        },
      ],
    };

    const html = renderToStaticMarkup(<AgreementDocumentSheets agreementData={rentalData} />);

    // 1. Verify Document Title
    expect(html).toContain('RESIDENTIAL HOUSE RENTAL AGREEMENT');
    expect(html).not.toContain('PAYING GUEST ACCOMMODATION AGREEMENT');

    // 2. Verify Preamble & Recitals for House Rental
    expect(html).toContain('Landlord / Lessor');
    expect(html).toContain('Tenant / Lessee');
    expect(html).toContain('Residential House Rental Agreement is made and executed');

    // 3. Verify Schedule Table 11 Rows
    expect(html).toContain('1. Landlord / Lessor Name:');
    expect(html).toContain('Arun Sharma');
    expect(html).toContain('2. Landlord Address &amp; Contact:');
    expect(html).toContain('3. Tenant / Lessee Name:');
    expect(html).toContain('Vikram Seth');
    expect(html).toContain('4. Tenant Permanent Address:');
    expect(html).toContain('5. Rented Flat / House Premises:');
    expect(html).toContain('Flat 302');
    expect(html).toContain('6. ID Proof Provided:');
    expect(html).toContain('Aadhaar [✓]');
    expect(html).toContain('7. Monthly Rent Amount:');
    expect(html).toContain('35,000');
    expect(html).toContain('8. Security Deposit Amount:');
    expect(html).toContain('70,000');
    expect(html).toContain('9. Agreement Tenancy Period:');
    expect(html).toContain('11 Months');
    expect(html).toContain('10. Notice Period Required:');
    expect(html).toContain('30</span> Days');
    expect(html).toContain('11. Stay / Lock-In Bracket:');
    expect(html).toContain('6</span> Months');

    // 4. Verify House Rental Specific Clauses
    expect(html).toContain('1. Rent and Payment Outlay:');
    expect(html).toContain('2. Security Deposit Protection:');
    expect(html).toContain('3. 11-Month Term &amp; Renewal:');
    expect(html).toContain('4. Utility Bills &amp; Maintenance:');
    expect(html).toContain('5. Statutory Verification:');
    expect(html).toContain('6. Cleanliness, Internal Maintenance &amp; Structural Safety:');
    expect(html).toContain('7. Lawful Usage &amp; Structural Boundaries:');
    expect(html).toContain('8. Peaceful Enjoyment &amp; Nuisance Controls:');
    expect(html).toContain('9. Landlord Right of Entry &amp; Formal Inspection:');
    expect(html).toContain('10. Default, Termination and Summary Eviction:');

    // 5. Verify Signatures Block
    expect(html).toContain('Signature of the Landlord / Lessor');
    expect(html).toContain('Signature of the Tenant / Lessee');

    // 6. Verify Two Witnesses
    expect(html).toContain('Signature of Witness 1');
    expect(html).toContain('Rajesh Kumar');
    expect(html).toContain('Signature of Witness 2');
    expect(html).toContain('Priya Sharma');
  });

  it('should render PAYING GUEST ACCOMMODATION AGREEMENT title for PG properties', () => {
    const pgData = {
      tenantName: 'Ananya Rao',
      tenantPhone: '+91 91234 56789',
      propertyName: 'Green Valley PG',
      unitOrBedName: 'Bed 201-B',
      sharingType: 'DOUBLE',
      propertyType: 'PG' as const,
      monthlyRent: 8500,
      securityDeposit: 17000,
      noticePeriodDays: 30,
      lockInMonths: 1,
    };

    const html = renderToStaticMarkup(<AgreementDocumentSheets agreementData={pgData} />);

    expect(html).toContain('PAYING GUEST ACCOMMODATION AGREEMENT');
    expect(html).not.toContain('RESIDENTIAL HOUSE RENTAL AGREEMENT');
    expect(html).toContain('PG Owner/Manager');
    expect(html).toContain('PG Resident/Tenant');
    expect(html).toContain('Bed 201-B');
    expect(html).toContain('DOUBLE');
    expect(html).toContain('Rules and Curfew Timings');
    expect(html).toContain('Prohibited Activities');
  });

  it('should format ID proof displays accurately', () => {
    expect(formatIdProofDisplay('Aadhaar Card', '987654321098')).toBe('Aadhar (987654321098)');
    expect(formatIdProofDisplay('PAN', 'ABCDE1234F')).toBe('PAN (ABCDE1234F)');
    expect(formatIdProofDisplay('Passport (Z1234567)')).toBe('Passport (Z1234567)');
    expect(formatIdProofDisplay('Aadhaar and 123456789012')).toBe('Aadhar (123456789012)');
  });

  it('should save and retrieve agreement signatures indexed by rental unit ID', () => {
    const testUnitId = 'unit-test-404';
    const testTenant = 'Suresh Nair';

    saveAgreementSignature({
      unitId: testUnitId,
      unitName: 'Flat 404',
      tenantName: testTenant,
      signerName: testTenant,
      signedAt: '2026-09-01T10:00:00.000Z',
      agreementType: 'RENTAL_AGREEMENT',
      signatureImage: 'data:image/png;base64,testSignature',
      isSigned: true,
      ownerName: 'Arun Sharma',
      ownerAddress: '#12, Royal Palm Residency, Coimbatore, Tamil Nadu',
      witnesses: [
        { name: 'Witness One', date: '2026-09-01', address: 'Coimbatore', signature: 'TYPE:Witness One' },
        { name: 'Witness Two', date: '2026-09-01', address: 'Coimbatore', signature: 'TYPE:Witness Two' },
      ],
    });

    const retrieved = getAgreementSignature(testUnitId);
    expect(retrieved).toBeDefined();
    expect(retrieved?.isSigned).toBe(true);
    expect(retrieved?.signerName).toBe(testTenant);
    expect(retrieved?.ownerName).toBe('Arun Sharma');
    expect(retrieved?.witnesses).toHaveLength(2);
    expect(retrieved?.witnesses?.[0]?.name).toBe('Witness One');
  });

  it('should generate digital signature data URL with Landlord title', () => {
    const dataUrl = generateDigitalSignatureDataUrl('Arun Sharma', 'Authorized Landlord / Owner');
    expect(dataUrl).toContain('data:image/svg+xml');
    expect(dataUrl).toContain('Arun%20Sharma');
    expect(dataUrl).toContain('Authorized%20Landlord%20%2F%20Owner');
  });

  it('should dynamically display Lock-In Bracket units (Days, Months, Years) accurately', () => {
    // Test Days
    const daysData = {
      tenantName: 'Kavin M',
      tenantPhone: '+91 98765 43210',
      propertyName: 'Test PG',
      propertyType: 'PG' as const,
      unitOrBedName: 'Bed 102-B',
      monthlyRent: 8000,
      lockInPeriodValue: 100,
      lockInPeriodUnit: 'DAYS',
      noticePeriodDays: 30,
    };
    const htmlDays = renderToStaticMarkup(<AgreementDocumentSheets agreementData={daysData} />);
    expect(htmlDays).toContain('11. Stay / Lock-In Bracket:');
    expect(htmlDays).toContain('100</span> Days fixed duration');

    // Test Years
    const yearsData = {
      ...daysData,
      lockInPeriodValue: 2,
      lockInPeriodUnit: 'YEARS',
    };
    const htmlYears = renderToStaticMarkup(<AgreementDocumentSheets agreementData={yearsData} />);
    expect(htmlYears).toContain('2</span> Years fixed duration');

    // Test Single Day / Month
    const singleDayData = {
      ...daysData,
      lockInPeriodValue: 1,
      lockInPeriodUnit: 'DAYS',
    };
    const htmlSingleDay = renderToStaticMarkup(<AgreementDocumentSheets agreementData={singleDayData} />);
    expect(htmlSingleDay).toContain('1</span> Day fixed duration');
  });

  it('should accurately calculate statutory 11 Months Tenancy Period (Commencing 05/09/2026 to 04/08/2027) and display 20 Months lock-in', () => {
    const flat102Data = {
      tenantName: 'Hari M',
      tenantPhone: '+91 98765 43231',
      propertyName: 'Hari Homes',
      unitOrBedName: 'Flat 102',
      propertyType: 'RENTAL_HOUSE' as const,
      monthlyRent: 3000,
      securityDeposit: 6000,
      startDate: '2026-09-05',
      endDate: '2027-08-04',
      noticePeriodDays: 200,
      lockInPeriodValue: 20,
      lockInPeriodUnit: 'MONTHS',
    };

    const html = renderToStaticMarkup(<AgreementDocumentSheets agreementData={flat102Data} />);

    // Row 9: Agreement Tenancy Period
    expect(html).toContain('9. Agreement Tenancy Period:');
    expect(html).toContain('11 Months (Commencing:');
    expect(html).toContain('05/09/2026');
    expect(html).toContain('04/08/2027');
    // Must NOT say 05/09/2027 (which would be 12 months/1 full year)
    expect(html).not.toContain('05/09/2027');

    // Row 10: Notice Period Required
    expect(html).toContain('10. Notice Period Required:');
    expect(html).toContain('200</span> Days standard written/verbal notice from either side');

    // Row 11: Stay / Lock-In Bracket
    expect(html).toContain('11. Stay / Lock-In Bracket:');
    expect(html).toContain('20</span> Months fixed duration');
  });
});

