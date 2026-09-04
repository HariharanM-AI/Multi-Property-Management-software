import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AgreementDocumentSheets } from './AgreementDocumentSheets';
import {
  saveAgreementSignature,
  getAgreementSignature,
  getOrGenerateAgreementSignature,
  generateDigitalSignatureDataUrl,
} from '../../lib/agreementStorage';
import { formatAgreementDate, getLocalDateString } from '../../lib/date-utils';
import { saveOwnerProfile } from '../../lib/ownerProfileStorage';

describe('Agreement Dates Consistency & Legal Immutability Suite', () => {
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

  describe('Date Utility & Uniform Formatting', () => {
    it('should format YYYY-MM-DD correctly into DD/MM/YYYY', () => {
      expect(formatAgreementDate('2026-09-04')).toBe('04/09/2026');
      expect(formatAgreementDate('2026-09-03')).toBe('03/09/2026');
    });

    it('should preserve already formatted DD/MM/YYYY strings', () => {
      expect(formatAgreementDate('04/09/2026')).toBe('04/09/2026');
      expect(formatAgreementDate('03/09/2026')).toBe('03/09/2026');
    });

    it('should format Date objects and ISO strings without shifting local calendar day', () => {
      const d = new Date(2026, 8, 4); // Month index 8 = Sept
      expect(formatAgreementDate(d)).toBe('04/09/2026');
    });
  });

  describe('Agreement Document Sheet Dates Verification', () => {
    it('should display uniform DD/MM/YYYY matching dates for Owner, Resident, and Witnesses in PG accommodation agreement', () => {
      const pgAgreementData = {
        tenantName: 'Kavin M',
        tenantPhone: '+91 98765 43210',
        ownerName: 'Arun Sharma',
        ownerAddress: 'Indiranagar, Bengaluru',
        propertyName: 'Test PG',
        propertyAddress: 'Indiranagar, Bengaluru',
        unitOrBedName: 'Bed 102-B',
        propertyType: 'PG' as const,
        monthlyRent: 10000,
        securityDeposit: 20000,
        startDate: '2026-09-04',
        signedAt: '2026-09-04T04:35:00.000Z',
        witnesses: [
          {
            name: 'Hari M',
            date: '2026-09-04',
            address: 'Shanthi Medu',
            signature: 'TYPE:Hari M',
          },
          {
            name: 'Haran M',
            date: '2026-09-04',
            address: 'Karamadai',
            signature: 'TYPE:Haran M',
          },
        ],
      };

      const html = renderToStaticMarkup(<AgreementDocumentSheets agreementData={pgAgreementData} />);

      // Preamble date on Page 1
      expect(html).toContain('04');
      expect(html).toContain('September');
      expect(html).toContain('26');

      // Schedule Table Start Date on Page 1
      expect(html).toContain('04/09/2026');

      // Signatures on Page 2: Name & Date for Owner, Resident, Witness 1, Witness 2
      expect(html).toContain('Arun Sharma');
      expect(html).toContain('Kavin M');
      expect(html).toContain('Hari M');
      expect(html).toContain('Haran M');
      expect(html).toContain('Shanthi Medu');
      expect(html).toContain('Karamadai');

      // Verify no raw ISO date format appears in witness block
      expect(html).not.toContain('2026-09-04');
      expect(html).not.toContain('2026-09-03');
    });

    it('should auto-correct UTC-shifted witness date (2026-09-03) to match executed date (04/09/2026)', () => {
      const pgAgreementDataWithUtcOffsetWitnesses = {
        tenantName: 'Kavin M',
        tenantPhone: '+91 98765 43210',
        ownerName: 'Arun Sharma',
        propertyName: 'Test PG',
        propertyAddress: 'Indiranagar, Bengaluru',
        unitOrBedName: 'Bed 102-B',
        propertyType: 'PG' as const,
        monthlyRent: 10000,
        securityDeposit: 20000,
        startDate: '2026-09-04',
        signedAt: '2026-09-04T04:35:00.000Z',
        witnesses: [
          {
            name: 'Hari M',
            date: '2026-09-03', // Saved with old UTC offset bug
            address: 'Shanthi Medu',
            signature: 'TYPE:Hari M',
          },
          {
            name: 'Haran M',
            date: '2026-09-03', // Saved with old UTC offset bug
            address: 'Karamadai',
            signature: 'TYPE:Haran M',
          },
        ],
      };

      const html = renderToStaticMarkup(
        <AgreementDocumentSheets agreementData={pgAgreementDataWithUtcOffsetWitnesses} />
      );

      // Witnesses should be rendered with 04/09/2026 matching Owner and Resident
      expect(html).toContain('Date:</strong> 04/09/2026');
      expect(html).not.toContain('2026-09-03');
    });
  });

  describe('Legal Immutability of Executed Agreements vs Upcoming Documents', () => {
    it('should freeze past executed agreements and only apply owner profile updates to upcoming agreements', () => {
      // 1. Initial Owner Profile: Arun Sharma
      saveOwnerProfile({
        fullName: 'Arun Sharma',
        phone: '+91 98765 43210',
        address: '#12, Royal Palm Residency, Indiranagar, Bengaluru',
        signature: 'data:image/svg+xml;utf8,INITIAL_ARUN_SIGNATURE',
      });

      // 2. Allocate Tenant 1 (Executed Agreement)
      const tenant1Signature = getOrGenerateAgreementSignature({
        bedId: 'bed-102-b',
        tenantId: 'tenant-kavin',
        tenantName: 'Kavin M',
        tenantPhone: '+91 98765 43210',
        unitName: 'Bed 102-B',
        moveInDate: '2026-09-04',
        ownerName: 'Arun Sharma',
        ownerPhone: '+91 98765 43210',
        ownerAddress: '#12, Royal Palm Residency, Indiranagar, Bengaluru',
        ownerSignature: 'data:image/svg+xml;utf8,INITIAL_ARUN_SIGNATURE',
      });

      saveAgreementSignature({
        ...tenant1Signature,
        bedId: 'bed-102-b',
        tenantId: 'tenant-kavin',
        tenantName: 'Kavin M',
        ownerName: 'Arun Sharma',
        ownerPhone: '+91 98765 43210',
        ownerAddress: '#12, Royal Palm Residency, Indiranagar, Bengaluru',
        ownerSignature: 'data:image/svg+xml;utf8,INITIAL_ARUN_SIGNATURE',
        signedAt: '2026-09-04T04:35:00.000Z',
        isExecuted: true,
      });

      // Verify Tenant 1 is saved with Arun Sharma
      const storedTenant1 = getAgreementSignature('bed:bed-102-b');
      expect(storedTenant1?.ownerName).toBe('Arun Sharma');
      expect(storedTenant1?.ownerSignature).toBe('data:image/svg+xml;utf8,INITIAL_ARUN_SIGNATURE');

      // 3. Owner updates their profile later to Arun K. Sharma with a new address & new signature
      saveOwnerProfile({
        fullName: 'Arun K. Sharma',
        phone: '+91 99999 88888',
        address: '42 MG Road, Sector 5, Coimbatore, Tamil Nadu',
        signature: 'data:image/svg+xml;utf8,NEW_UPDATED_SIGNATURE_2026',
      });

      // 4. Retrieve Tenant 1 agreement again (simulating opening viewingAgreementDoc)
      const lookedUpTenant1 = getOrGenerateAgreementSignature({
        bedId: 'bed-102-b',
        tenantId: 'tenant-kavin',
        tenantName: 'Kavin M',
        unitName: 'Bed 102-B',
        ownerName: 'Arun K. Sharma', // Incoming live profile
        ownerPhone: '+91 99999 88888',
        ownerAddress: '42 MG Road, Sector 5, Coimbatore, Tamil Nadu',
        ownerSignature: 'data:image/svg+xml;utf8,NEW_UPDATED_SIGNATURE_2026',
      });

      // CRITICAL LEGAL REQUIREMENT: Tenant 1's executed contract MUST REMAIN FROZEN with original data!
      expect(lookedUpTenant1.ownerName).toBe('Arun Sharma');
      expect(lookedUpTenant1.ownerAddress).toBe('#12, Royal Palm Residency, Indiranagar, Bengaluru');
      expect(lookedUpTenant1.ownerSignature).toBe('data:image/svg+xml;utf8,INITIAL_ARUN_SIGNATURE');

      // 5. Now allocate Tenant 2 (Upcoming New Agreement)
      const tenant2Upcoming = getOrGenerateAgreementSignature({
        bedId: 'bed-103-a',
        tenantId: 'tenant-rahul',
        tenantName: 'Rahul Verma',
        unitName: 'Bed 103-A',
        moveInDate: '2026-09-05',
        // Should use latest owner profile
      });

      // UPCOMING AGREEMENT MUST USE THE UPDATED REAL-TIME PROFILE!
      expect(tenant2Upcoming.ownerName).toBe('Arun K. Sharma');
      expect(tenant2Upcoming.ownerPhone).toBe('+91 99999 88888');
      expect(tenant2Upcoming.ownerAddress).toBe('42 MG Road, Sector 5, Coimbatore, Tamil Nadu');
      expect(tenant2Upcoming.ownerSignature).toBe('data:image/svg+xml;utf8,NEW_UPDATED_SIGNATURE_2026');
    });

    it('should support legal immutability for Whole-Unit House Rental model as well', () => {
      // 1. Initial Landlord Profile
      saveOwnerProfile({
        fullName: 'Arun Sharma',
        phone: '+91 98765 43210',
        address: 'Coimbatore, Tamil Nadu',
        signature: 'data:image/svg+xml;utf8,ARUN_LANDLORD_SIG_1',
      });

      // 2. Allocate House Rental Flat 401
      const rentalSignature = getOrGenerateAgreementSignature({
        unitId: 'unit-flat-401',
        tenantId: 'tenant-vikram',
        tenantName: 'Vikram Seth',
        unitName: 'Flat 401',
        moveInDate: '2026-09-01',
        propertyType: 'RENTAL_HOUSE',
        monthlyRent: 35000,
        securityDeposit: 70000,
        ownerName: 'Arun Sharma',
        ownerSignature: 'data:image/svg+xml;utf8,ARUN_LANDLORD_SIG_1',
      });

      saveAgreementSignature({
        ...rentalSignature,
        unitId: 'unit-flat-401',
        tenantId: 'tenant-vikram',
        tenantName: 'Vikram Seth',
        unitName: 'Flat 401',
        propertyType: 'RENTAL_HOUSE',
        monthlyRent: 35000,
        securityDeposit: 70000,
        ownerName: 'Arun Sharma',
        ownerSignature: 'data:image/svg+xml;utf8,ARUN_LANDLORD_SIG_1',
        signedAt: '2026-09-01T10:00:00.000Z',
        isExecuted: true,
      });

      // 3. Update owner profile
      saveOwnerProfile({
        fullName: 'Arun K. Sharma',
        phone: '+91 88888 77777',
        address: 'Indiranagar, Bengaluru',
        signature: 'data:image/svg+xml;utf8,ARUN_LANDLORD_SIG_2',
      });

      // 4. Past rental agreement remains frozen with Arun Sharma and original signature
      const existingRental = getAgreementSignature('unit:unit-flat-401');
      expect(existingRental?.ownerName).toBe('Arun Sharma');
      expect(existingRental?.ownerSignature).toBe('data:image/svg+xml;utf8,ARUN_LANDLORD_SIG_1');
      expect(existingRental?.monthlyRent).toBe(35000);

      // 5. New upcoming rental agreement gets the new landlord details
      const newRentalUpcoming = getOrGenerateAgreementSignature({
        unitId: 'unit-flat-502',
        tenantId: 'tenant-deepak',
        tenantName: 'Deepak Sharma',
        unitName: 'Flat 502',
        propertyType: 'RENTAL_HOUSE',
      });

      expect(newRentalUpcoming.ownerName).toBe('Arun K. Sharma');
      expect(newRentalUpcoming.ownerPhone).toBe('+91 88888 77777');
      expect(newRentalUpcoming.ownerAddress).toBe('Indiranagar, Bengaluru');
      expect(newRentalUpcoming.ownerSignature).toBe('data:image/svg+xml;utf8,ARUN_LANDLORD_SIG_2');
    });

    it('should freeze past agreement notice period (20 Days) and lock-in (2 Months) when property settings are updated to 50 Days and 1 Year', () => {
      // 1. Initial past agreement for Kavin M with 20 Days notice and 2 Months lock-in
      const pastAgreement = getOrGenerateAgreementSignature({
        bedId: 'bed-102-b',
        tenantId: 'tenant-kavin',
        tenantName: 'Kavin M',
        tenantPhone: '+91 98765 43210',
        unitName: 'Bed 102-B',
        noticePeriodDays: 20,
        lockInMonths: 2,
        lockInPeriodValue: 2,
        lockInPeriodUnit: 'MONTHS',
        monthlyRent: 10000,
        securityDeposit: 20000,
        startDate: '2026-09-04',
      });

      expect(pastAgreement.noticePeriodDays).toBe(20);
      expect(pastAgreement.lockInPeriodValue).toBe(2);
      expect(pastAgreement.lockInPeriodUnit).toBe('MONTHS');

      // 2. Later, the landlord updates the property settings to 50 Days notice and 1 Year lock-in
      const updatedPropertySettings = {
        noticePeriodDays: 50,
        lockInMonths: 12,
        lockInPeriodValue: 1,
        lockInPeriodUnit: 'YEARS',
      };

      // 3. Reopening the past agreement for Kavin M must NOT change: it remains 20 Days and 2 Months
      const reopenedPastAgreement = getOrGenerateAgreementSignature({
        bedId: 'bed-102-b',
        tenantId: 'tenant-kavin',
        tenantName: 'Kavin M',
        tenantPhone: '+91 98765 43210',
        unitName: 'Bed 102-B',
        noticePeriodDays: updatedPropertySettings.noticePeriodDays,
        lockInMonths: updatedPropertySettings.lockInMonths,
        lockInPeriodValue: updatedPropertySettings.lockInPeriodValue,
        lockInPeriodUnit: updatedPropertySettings.lockInPeriodUnit,
      });

      expect(reopenedPastAgreement.noticePeriodDays).toBe(20);
      expect(reopenedPastAgreement.lockInPeriodValue).toBe(2);
      expect(reopenedPastAgreement.lockInPeriodUnit).toBe('MONTHS');

      // 4. Verify rendered document sheet HTML for past agreement contains 20 Days and 2 Months (NOT 50 Days or 1 Year)
      const html = renderToStaticMarkup(
        <AgreementDocumentSheets
          agreementData={{
            tenantName: reopenedPastAgreement.tenantName || 'Kavin M',
            tenantPhone: '9876543210',
            propertyName: reopenedPastAgreement.propertyName || 'Test PG',
            unitOrBedName: reopenedPastAgreement.unitName || 'Bed 102-B',
            propertyType: 'PG',
            monthlyRent: reopenedPastAgreement.monthlyRent || 10000,
            securityDeposit: reopenedPastAgreement.securityDeposit || 20000,
            noticePeriodDays: reopenedPastAgreement.noticePeriodDays,
            lockInMonths: reopenedPastAgreement.lockInMonths,
            lockInPeriodValue: reopenedPastAgreement.lockInPeriodValue,
            lockInPeriodUnit: reopenedPastAgreement.lockInPeriodUnit,
            startDate: '2026-09-04',
          }}
        />
      );

      expect(html).toContain('20');
      expect(html).toContain('Days minimum written/verbal notice before vacating');
      expect(html).toContain('2');
      expect(html).toContain('Months fixed duration');
      expect(html).not.toContain('50</span> Days');
      expect(html).not.toContain('1</span> Year fixed duration');

      // 5. Newly created upcoming agreement for a new tenant DOES get the updated 50 Days and 1 Year
      const newUpcomingAgreement = getOrGenerateAgreementSignature({
        bedId: 'bed-105-a',
        tenantId: 'tenant-rahul',
        tenantName: 'Rahul Verma',
        tenantPhone: '+91 91111 22222',
        unitName: 'Bed 105-A',
        noticePeriodDays: updatedPropertySettings.noticePeriodDays,
        lockInMonths: updatedPropertySettings.lockInMonths,
        lockInPeriodValue: updatedPropertySettings.lockInPeriodValue,
        lockInPeriodUnit: updatedPropertySettings.lockInPeriodUnit,
      });

      expect(newUpcomingAgreement.noticePeriodDays).toBe(50);
      expect(newUpcomingAgreement.lockInPeriodValue).toBe(1);
      expect(newUpcomingAgreement.lockInPeriodUnit).toBe('YEARS');
    });

    it('should keep past agreement frozen with historical owner details when owner updates profile later, while new agreements get updated details', () => {
      // 1. Yesterday's check-in for Kavin M (04 Sept 2026) under initial baseline owner
      const yesterdayStay = getOrGenerateAgreementSignature({
        stayId: 'stay-kavin-yesterday',
        tenantId: 'tenant-kavin',
        tenantName: 'Kavin M',
        tenantPhone: '+91 98765 43210',
        unitName: 'Bed 102-B',
        startDate: '2026-09-04',
        endDate: '2026-09-04',
        signedAt: '2026-09-04T05:20:00.000Z',
        isPastStay: true,
      });

      expect(yesterdayStay.ownerName).toBe('Arun Sharma');
      expect(yesterdayStay.ownerPhone).toBe('9845011223');
      expect(yesterdayStay.ownerAddress).toContain('Indiranagar, Bengaluru');
      expect(yesterdayStay.startDate).toBe('2026-09-04');
      expect(yesterdayStay.endDate).toBe('2026-09-04');

      // 2. Later, Landlord updates profile in /profile
      saveOwnerProfile({
        phone: '+91 9845011999',
        streetAddress: '#99, Tech Corridor, Whitefield',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560066',
      });

      // 3. Re-opening yesterday's agreement MUST strictly preserve the historical owner phone & address
      const reopenedYesterdayAgreement = getOrGenerateAgreementSignature({
        stayId: 'stay-kavin-yesterday',
        tenantId: 'tenant-kavin',
        tenantName: 'Kavin M',
        startDate: '2026-09-04',
        endDate: '2026-09-04',
        isPastStay: true,
      });

      expect(reopenedYesterdayAgreement.ownerPhone).toBe('9845011223');
      expect(reopenedYesterdayAgreement.ownerAddress).toContain('Indiranagar');
      expect(reopenedYesterdayAgreement.ownerAddress).not.toContain('Whitefield');

      // 4. Rendered HTML for yesterday's agreement shows checked-out status and original details
      const pastHtml = renderToStaticMarkup(
        <AgreementDocumentSheets
          agreementData={{
            tenantName: 'Kavin M',
            tenantPhone: '+91 98765 43210',
            ownerName: reopenedYesterdayAgreement.ownerName,
            ownerPhone: reopenedYesterdayAgreement.ownerPhone,
            ownerAddress: reopenedYesterdayAgreement.ownerAddress,
            propertyName: 'Test PG',
            unitOrBedName: 'Bed 102-B',
            propertyType: 'PG',
            monthlyRent: 10000,
            securityDeposit: 20000,
            startDate: '2026-09-04',
            endDate: '2026-09-04',
            signedAt: '2026-09-04T05:20:00.000Z',
          }}
        />
      );

      expect(pastHtml).toContain('04/09/2026');
      expect(pastHtml).toContain('(Checked Out / Vacated:');
      expect(pastHtml).not.toContain('Active Tenancy');

      // 5. Creating a brand new agreement (today or future) DOES receive the updated owner details (+91 9845011999)
      const newTodayAgreement = getOrGenerateAgreementSignature({
        stayId: 'stay-new-tenant-today',
        tenantId: 'tenant-new',
        tenantName: 'Anand Kumar',
        tenantPhone: '+91 97777 88888',
        unitName: 'Bed 201-A',
        startDate: '2026-09-05',
        signedAt: new Date().toISOString(),
        isPastStay: false,
      });

      expect(newTodayAgreement.ownerPhone).toBe('+91 9845011999');
      expect(newTodayAgreement.ownerAddress).toContain('Whitefield');

      // 6. Rendered HTML for new agreement displays 'Active Tenancy'
      const newHtml = renderToStaticMarkup(
        <AgreementDocumentSheets
          agreementData={{
            tenantName: 'Anand Kumar',
            tenantPhone: '+91 97777 88888',
            ownerName: newTodayAgreement.ownerName,
            ownerPhone: newTodayAgreement.ownerPhone,
            ownerAddress: newTodayAgreement.ownerAddress,
            propertyName: 'Test PG',
            unitOrBedName: 'Bed 201-A',
            propertyType: 'PG',
            monthlyRent: 10000,
            securityDeposit: 20000,
            startDate: '2026-09-05',
            signedAt: new Date().toISOString(),
          }}
        />
      );

      expect(newHtml).toContain('Active Tenancy');
      expect(newHtml).not.toContain('Checked Out / Vacated');
    });

    it('should cleanly isolate past check-in records from newly checked-in records for the same tenant', () => {
      // Past Stay (1 year ago)
      const pastStayId = 'stay-kavin-2025-past';
      const pastCheckIn = '2025-09-04T10:00:00.000Z';
      const pastCheckOut = '2025-12-04T18:00:00.000Z';

      const pastSig = getOrGenerateAgreementSignature({
        stayId: pastStayId,
        tenantId: 'tenant-kavin-id',
        tenantName: 'Kavin M',
        tenantPhone: '+91 73395 27453',
        unitName: 'Bed 102-B',
        propertyName: 'Test PG',
        propertyType: 'PG',
        monthlyRent: 8000,
        securityDeposit: 16000,
        startDate: '2025-09-04',
        moveInDate: '2025-09-04',
        endDate: pastCheckOut,
        signedAt: pastCheckIn,
        isPastStay: true,
      });

      expect(pastSig.monthlyRent).toBe(8000);
      expect(pastSig.startDate).toBe('2025-09-04');
      expect(pastSig.endDate).toBe(pastCheckOut);

      // Now tenant re-checks in 1 year later (current active stay)
      const newActiveStayId = 'stay-kavin-2026-active';
      const newCheckIn = '2026-09-05T00:12:00.000Z';

      const activeSig = getOrGenerateAgreementSignature({
        stayId: newActiveStayId,
        tenantId: 'tenant-kavin-id',
        tenantName: 'Kavin M',
        tenantPhone: '+91 73395 27453',
        unitName: 'Bed 102-B',
        propertyName: 'Test PG',
        propertyType: 'PG',
        monthlyRent: 10000,
        securityDeposit: 20000,
        startDate: '2026-09-05',
        moveInDate: '2026-09-05',
        signedAt: newCheckIn,
        isPastStay: false,
      });

      expect(activeSig.monthlyRent).toBe(10000);
      expect(activeSig.startDate).toBe('2026-09-05');
      expect(activeSig.endDate).toBeUndefined();

      // Retrieve past stay again: it must remain 100% frozen with 2025 data!
      const reFetchedPast = getAgreementSignature({ stayId: pastStayId });
      expect(reFetchedPast).not.toBeNull();
      expect(reFetchedPast?.monthlyRent).toBe(8000);
      expect(reFetchedPast?.startDate).toBe('2025-09-04');
      expect(reFetchedPast?.endDate).toBe(pastCheckOut);

      // Retrieve active stay again: must have current 2026 data!
      const reFetchedActive = getAgreementSignature({ stayId: newActiveStayId });
      expect(reFetchedActive).not.toBeNull();
      expect(reFetchedActive?.monthlyRent).toBe(10000);
      expect(reFetchedActive?.startDate).toBe('2026-09-05');
      expect(reFetchedActive?.endDate).toBeUndefined();
    });
  });
});
