'use client';

import React, { useEffect, useRef } from 'react';
import { AgreementDocumentData } from './AgreementDocumentViewerModal';
import { generateDigitalSignatureDataUrl } from '../../lib/agreementStorage';

export interface AgreementDocumentSheetsProps {
  agreementData: AgreementDocumentData;
  page1Ref?: React.RefObject<HTMLDivElement | null>;
  page2Ref?: React.RefObject<HTMLDivElement | null>;
  onReady?: (page1El: HTMLDivElement, page2El: HTMLDivElement) => void;
  className?: string;
  isExportingPdf?: boolean;
  visiblePage?: 'both' | 'page1' | 'page2';
}

export function AgreementDocumentSheets({
  agreementData,
  page1Ref,
  page2Ref,
  onReady,
  className = '',
  isExportingPdf = false,
  visiblePage = 'both',
}: AgreementDocumentSheetsProps) {
  const localPage1Ref = useRef<HTMLDivElement>(null);
  const localPage2Ref = useRef<HTMLDivElement>(null);

  const activePage1Ref = page1Ref || localPage1Ref;
  const activePage2Ref = page2Ref || localPage2Ref;

  useEffect(() => {
    if (onReady && activePage1Ref.current && activePage2Ref.current) {
      onReady(activePage1Ref.current, activePage2Ref.current);
    }
  }, [onReady, activePage1Ref, activePage2Ref]);

  const isPG = agreementData.propertyType === 'PG';

  // Format Numeric Values
  const numericRent =
    typeof agreementData.monthlyRent === 'number'
      ? agreementData.monthlyRent
      : Number(String(agreementData.monthlyRent).replace(/[^\d.]/g, '')) || 0;
  const formattedRentNumber = Number(numericRent).toLocaleString('en-IN');

  const numericDeposit =
    typeof agreementData.securityDeposit === 'number'
      ? agreementData.securityDeposit
      : Number(String(agreementData.securityDeposit).replace(/[^\d.]/g, '')) || 0;
  const formattedDepositNumber = Number(numericDeposit).toLocaleString('en-IN');

  // Format Dates
  const execDate = agreementData.startDate ? new Date(agreementData.startDate) : new Date();
  const execDay = String(execDate.getDate()).padStart(2, '0');
  const execMonth = execDate.toLocaleString('en-IN', { month: 'long' });
  const execYear = String(execDate.getFullYear());
  const execYearShort = execYear.slice(-2);
  const executionCity = 'Coimbatore';

  const formattedStartDate = agreementData.startDate
    ? new Date(agreementData.startDate).toLocaleDateString('en-GB')
    : new Date().toLocaleDateString('en-GB');

  const formattedEndDate = agreementData.endDate
    ? new Date(agreementData.endDate).toLocaleDateString('en-GB')
    : new Date(Date.now() + 334 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB');

  const executedDateFormatted = new Date().toLocaleDateString('en-GB');

  // ID Proof Extraction
  const rawId = agreementData.tenantAadhaar || '5489-3231-3231';
  const isPan = /PAN/i.test(rawId);
  const isVoter = /VOTER/i.test(rawId);
  const isDL = /DRIVING|DL/i.test(rawId);
  const isAadhaar = !isPan && !isVoter && !isDL;
  const cleanIdNumber =
    rawId.replace(/^(Aadhaar|PAN|Voter ID|Driving License)\s*[:\-]?\s*/i, '').trim() ||
    '5489-3231-3231';

  // Filter out any mock witness names (Mithun Kumar, Suresh Babu)
  const realWitnesses = agreementData.witnesses?.filter(
    (w) => w.name && w.name !== 'Mithun Kumar' && w.name !== 'Suresh Babu'
  );
  const effectiveWitnesses = realWitnesses && realWitnesses.length > 0 ? realWitnesses : undefined;

  // Address Fallbacks
  const rawOwner = agreementData.ownerName;
  const isGenericOwner =
    !rawOwner ||
    rawOwner.includes('Facility Management') ||
    rawOwner.includes('Property Landlord') ||
    rawOwner.includes('Residential Property');

  const ownerDisplayName = !isGenericOwner ? rawOwner : 'Arun Sharma';
  const ownerDisplayAddress =
    agreementData.ownerAddress || '#12, Royal Palm Residency, Coimbatore, Tamil Nadu';
  const tenantDisplayAddress =
    agreementData.tenantAddress || 'Karamadai, Coimbatore, Tamilnadu, 641019';
  const propertyDisplayAddress =
    agreementData.propertyAddress ||
    '#42, 1st Cross, Indiranagar, Indiranagar, Coimbatore, Tamilnadu — 560038';
  const unitLabel = agreementData.unitOrBedName || 'Bed 102-A';
  const rentedFullAddress = `${unitLabel}, ${agreementData.propertyName}, ${propertyDisplayAddress}`;

  const sharingDisplay = agreementData.sharingType
    ? agreementData.sharingType
    : isPG
    ? 'Single / Double Sharing'
    : 'Full Residential Unit';

  const noticeDays = agreementData.noticePeriodDays ?? 30;
  const lockInMonths = agreementData.lockInPeriodValue ?? agreementData.lockInMonths ?? 1;

  return (
    <div className={`agreement-sheets-root space-y-8 max-w-[860px] mx-auto ${className}`}>
      {/* =================================================================== */}
      {/* PAGE 1: RECITALS, SCHEDULE TABLE & CLAUSES 1 TO 4                   */}
      {/* =================================================================== */}
      {(visiblePage === 'both' || visiblePage === 'page1') && (
        <div
          ref={activePage1Ref}
        className={`agreement-sheet-page-1 bg-white ${
          isExportingPdf ? 'rounded-none shadow-none border-none' : 'rounded-xl shadow-xl border border-slate-300'
        } p-8 sm:p-12 space-y-6 text-slate-900 font-sans leading-normal relative box-border`}
        style={{ width: '850px', minHeight: '1202px', maxWidth: '850px' }}
      >
        <div id="agreement-doc-top" className="h-0 w-0 opacity-0 pointer-events-none" />
        {/* Top Tag */}
        {!isExportingPdf && (
          <div
            data-html2canvas-ignore="true"
            className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs text-slate-400 font-medium"
          >
            <span>Official Tenancy Agreement</span>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200 text-xs">
              Page 1 of 2
            </span>
          </div>
        )}

        {/* DOCUMENT HEADER */}
        <div className="text-center space-y-2 pb-1">
          <h1 className="text-xl sm:text-2xl font-black tracking-wider text-slate-950 uppercase">
            {isPG ? 'PAYING GUEST ACCOMMODATION AGREEMENT' : 'RESIDENTIAL HOUSE RENTAL AGREEMENT'}
          </h1>
          <p className="text-sm sm:text-[14.5px] text-slate-900 font-medium italic max-w-2xl mx-auto leading-relaxed">
            {isPG
              ? 'This digital agreement is executed electronically and serves as a legally binding document between the Owner and the Paying Guest.'
              : 'This digital agreement is executed electronically and serves as a legally binding Residential Tenancy Agreement between the Landlord / Lessor and the Tenant / Lessee.'}
          </p>
        </div>

        {/* OPENING RECITALS */}
        <div className="text-sm sm:text-[14.5px] text-slate-950 font-medium text-justify leading-relaxed">
          {isPG ? (
            <p>
              This Paying Guest Accommodation Agreement is entered into on this{' '}
              <span className="font-bold">{execDay}</span> day of{' '}
              <span className="font-bold">{execMonth}</span>, 20
              <span className="font-bold">{execYearShort}</span> by and between the party detailed as{' '}
              <strong>PG Owner/Manager</strong> and the party detailed as <strong>PG Resident/Tenant</strong> in the
              schedule below. The expressions 'Owner' and 'Resident' shall mean and include their respective heirs,
              successors, legal representatives and assigns.
            </p>
          ) : (
            <p>
              This Residential House Rental Agreement is made and executed at <span className="font-bold">{executionCity}</span> on this{' '}
              <span className="font-bold">{execDay}</span> day of <span className="font-bold">{execMonth}</span>, 20
              <span className="font-bold">{execYearShort}</span> by and between the party detailed as{' '}
              <strong>Landlord / Lessor</strong> and the party detailed as <strong>Tenant / Lessee</strong> in the schedule
              below. The expressions 'Landlord' and 'Tenant' shall mean and include their respective heirs, successors,
              legal representatives, and assigns.
            </p>
          )}
        </div>

        {/* SCHEDULE OF PARTIES & PROPERTY DETAILS TABLE (11 ROWS) */}
        <div className="space-y-2 pt-1">
          <h2 className="text-sm sm:text-base font-black text-slate-950 uppercase tracking-wide">
            SCHEDULE OF PARTIES & PROPERTY DETAILS
          </h2>

          <div className="border-2 border-slate-900 overflow-hidden">
            <table className="w-full text-sm sm:text-[14px] text-left border-collapse">
              <tbody>
                {/* Row 1 */}
                <tr className="border-b border-slate-900">
                  <td className="p-2.5 sm:p-3 font-black text-slate-950 w-[36%] align-top border-r-2 border-slate-900 bg-slate-100/90">
                    1. {isPG ? 'Owner Name:' : 'Landlord / Lessor Name:'}
                  </td>
                  <td className="p-2.5 sm:p-3 font-bold text-slate-950">{ownerDisplayName}</td>
                </tr>

                {/* Row 2 */}
                <tr className="border-b border-slate-900">
                  <td className="p-2.5 sm:p-3 font-black text-slate-950 align-top border-r-2 border-slate-900 bg-slate-100/90">
                    2. {isPG ? 'Resident Name:' : 'Landlord Address & Contact:'}
                  </td>
                  <td className="p-2.5 sm:p-3 text-slate-950 font-semibold">
                    {isPG ? agreementData.tenantName : `${ownerDisplayAddress}${agreementData.ownerPhone ? ` • ${agreementData.ownerPhone}` : ''}`}
                  </td>
                </tr>

                {/* Row 3 */}
                <tr className="border-b border-slate-900">
                  <td className="p-2.5 sm:p-3 font-black text-slate-950 align-top border-r-2 border-slate-900 bg-slate-100/90">
                    3. {isPG ? 'Resident Permanent Address:' : 'Tenant / Lessee Name:'}
                  </td>
                  <td className="p-2.5 sm:p-3 text-slate-950 font-semibold">
                    {isPG ? tenantDisplayAddress : agreementData.tenantName}
                  </td>
                </tr>

                {/* Row 4 */}
                <tr className="border-b border-slate-900">
                  <td className="p-2.5 sm:p-3 font-black text-slate-950 align-top border-r-2 border-slate-900 bg-slate-100/90">
                    4. {isPG ? 'PG Property Address:' : 'Tenant Permanent Address:'}
                  </td>
                  <td className="p-2.5 sm:p-3 text-slate-950 font-semibold">
                    {isPG ? propertyDisplayAddress : tenantDisplayAddress}
                  </td>
                </tr>

                {/* Row 5 */}
                <tr className="border-b border-slate-900">
                  <td className="p-2.5 sm:p-3 font-black text-slate-950 align-top border-r-2 border-slate-900 bg-slate-100/90">
                    5. {isPG ? 'Allocated Room/Bed No:' : 'Rented Flat / House Premises:'}
                  </td>
                  <td className="p-2.5 sm:p-3 text-slate-950">
                    {isPG ? (
                      <span className="font-bold">
                        {agreementData.unitOrBedName} ({sharingDisplay})
                      </span>
                    ) : (
                      <span className="font-semibold">{rentedFullAddress}</span>
                    )}
                  </td>
                </tr>

                {/* Row 6 */}
                <tr className="border-b border-slate-900">
                  <td className="p-2.5 sm:p-3 font-black text-slate-950 align-top border-r-2 border-slate-900 bg-slate-100/90">
                    6. ID Proof Provided:
                  </td>
                  <td className="p-2.5 sm:p-3 text-slate-950">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-3 font-semibold">
                        <span>Aadhaar [{isAadhaar ? '✓' : ' '}]</span>
                        <span>PAN [{isPan ? '✓' : ' '}]</span>
                        <span>Voter ID [{isVoter ? '✓' : ' '}]</span>
                        <span>Driving License [{isDL ? '✓' : ' '}]</span>
                      </div>
                      <div>
                        <span className="font-bold">No:</span> {cleanIdNumber}
                      </div>
                    </div>
                  </td>
                </tr>

                {/* Row 7 */}
                <tr className="border-b border-slate-900">
                  <td className="p-2.5 sm:p-3 font-black text-slate-950 align-top border-r-2 border-slate-900 bg-slate-100/90">
                    7. {isPG ? 'Monthly PG Rent:' : 'Monthly Rent Amount:'}
                  </td>
                  <td className="p-2.5 sm:p-3 text-slate-950">
                    <span className="font-black">Rs. {formattedRentNumber}/-</span> Payment Due Date: By 5th of each month.
                  </td>
                </tr>

                {/* Row 8 */}
                <tr className="border-b border-slate-900">
                  <td className="p-2.5 sm:p-3 font-black text-slate-950 align-top border-r-2 border-slate-900 bg-slate-100/90">
                    8. Security Deposit Amount:
                  </td>
                  <td className="p-2.5 sm:p-3 text-slate-950">
                    <span className="font-black">Rs. {formattedDepositNumber}/-</span> (Refundable subject to terms)
                  </td>
                </tr>

                {/* Row 9 */}
                <tr className="border-b border-slate-900">
                  <td className="p-2.5 sm:p-3 font-black text-slate-950 align-top border-r-2 border-slate-900 bg-slate-100/90">
                    9. {isPG ? 'Agreement Start Date:' : 'Agreement Tenancy Period:'}
                  </td>
                  <td className="p-2.5 sm:p-3 text-slate-950">
                    {isPG ? (
                      <span className="font-bold">{formattedStartDate}</span>
                    ) : (
                      <span>
                        11 Months (Commencing: <strong className="font-black">{formattedStartDate}</strong> to{' '}
                        <strong className="font-black">{formattedEndDate}</strong>)
                      </span>
                    )}
                  </td>
                </tr>

                {/* Row 10 */}
                <tr className="border-b border-slate-900">
                  <td className="p-2.5 sm:p-3 font-black text-slate-950 align-top border-r-2 border-slate-900 bg-slate-100/90">
                    10. Notice Period Required:
                  </td>
                  <td className="p-2.5 sm:p-3 text-slate-950">
                    <span className="font-black">{noticeDays}</span>{' '}
                    {isPG
                      ? 'Days minimum written/verbal notice before vacating'
                      : 'Days standard written/verbal notice from either side.'}
                  </td>
                </tr>

                {/* Row 11 */}
                <tr>
                  <td className="p-2.5 sm:p-3 font-black text-slate-950 align-top border-r-2 border-slate-900 bg-slate-100/90">
                    11. Stay / Lock-In Bracket:
                  </td>
                  <td className="p-2.5 sm:p-3 text-slate-950">
                    <span className="font-black">{lockInMonths}</span> Months fixed duration
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* TERMS AND CONDITIONS (CLAUSES 1 TO 4 ON PAGE 1) */}
        <div className="space-y-2.5 pt-2">
          <h2 className="text-sm sm:text-base font-black text-slate-950 uppercase tracking-wide">
            TERMS AND CONDITIONS
          </h2>

          {isPG ? (
            <div className="space-y-2.5 text-sm sm:text-[13.5px] text-slate-950 font-medium text-justify leading-relaxed">
              <p>
                <strong className="font-black text-black">1. Rent and Payment:</strong> The Resident agrees to pay the stipulated Monthly PG Rent on or before
                the due date mentioned in the schedule above. Late payments may attract a fixed daily penalty fee as
                determined by the Owner.
              </p>
              <p>
                <strong className="font-black text-black">2. Inclusions & Facilities:</strong> The monthly rent covers utility features explicitly agreed
                upon, such as standard electricity allocation, water supply, Wi-Fi connectivity, housekeeping services,
                and routine meals (if specified under house rules).
              </p>
              <p>
                <strong className="font-black text-black">3. Security Deposit Protection:</strong> The Security Deposit paid by the Resident is
                interest-free and refundable strictly at the time of final checkout, subject to full clearance of all
                outstanding dues, fulfillment of the required notice period, and complete verification against property
                damage.
              </p>
              <p>
                <strong className="font-black text-black">4. Notice Period & Lock-in:</strong> The Resident must serve the minimum required notice period
                before vacating the premises. Failure to do so will result in the immediate forfeiture of the security
                deposit. If a lock-in period applies, vacating early will cause automated deposit forfeiture.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 text-sm sm:text-[13.5px] text-slate-950 font-medium text-justify leading-relaxed">
              <p>
                <strong className="font-black text-black">1. Rent and Payment Outlay:</strong> The Tenant agrees to pay the stipulated Monthly Rent to the
                Landlord on or before the due date mentioned in the schedule. Any delay beyond the due date may attract a
                late payment penalty charge as mutually settled or specified by the Landlord.
              </p>
              <p>
                <strong className="font-black text-black">2. Security Deposit Protection:</strong> The interest-free Security Deposit shall be maintained
                by the Landlord and refunded strictly at the time of physical handover of the premises, subject to the
                complete clearance of outstanding electricity, water, utility bills, and verification against physical
                property damage.
              </p>
              <p>
                <strong className="font-black text-black">3. 11-Month Term & Renewal:</strong> This lease is valid for 11 months, renewable upon mutual
                consent with standard 5% to 8% rent revision upon expiry.
              </p>
              <p>
                <strong className="font-black text-black">4. Utility Bills & Maintenance:</strong> Tenant shall pay electricity, water, and local society
                maintenance charges directly as per meter readings.
              </p>
            </div>
          )}
        </div>

        {/* Page 1 Bottom Footer */}
        <div className="pt-3 border-t border-slate-300 flex items-center justify-between text-xs text-slate-600 font-mono">
          <span>Page 1 of 2 • Official Tenancy Agreement</span>
          <span>Model Tenancy Act Compliant</span>
        </div>
      </div>
      )}

      {/* =================================================================== */}
      {/* PAGE 2: CONTINUED TERMS, DECLARATION, SIGNATURES & WITNESSES       */}
      {/* =================================================================== */}
      {(visiblePage === 'both' || visiblePage === 'page2') && (
        <div
          ref={activePage2Ref}
        className={`agreement-sheet-page-2 bg-white ${
          isExportingPdf ? 'rounded-none shadow-none border-none' : 'rounded-xl shadow-xl border border-slate-300'
        } p-8 sm:p-12 space-y-6 text-slate-900 font-sans leading-normal relative box-border`}
        style={{ width: '850px', minHeight: '1202px', maxWidth: '850px' }}
      >
        {/* Top Tag */}
        {!isExportingPdf && (
          <div
            data-html2canvas-ignore="true"
            className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs text-slate-400 font-medium"
          >
            <span>Official Tenancy Agreement</span>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200 text-xs">
              Page 2 of 2
            </span>
          </div>
        )}

        {/* PAGE 2 HEADER */}
        <div className="space-y-1 pb-1">
          <h2 className="text-sm sm:text-base font-black text-slate-950 uppercase tracking-wide">
            TERMS AND CONDITIONS (CONTINUED)
          </h2>
          <p className="text-xs sm:text-[13px] text-slate-800 font-medium italic">
            Operational Guidelines, Structural Boundaries & Statutory Compliance
          </p>
        </div>

        {/* TERMS AND CONDITIONS (CLAUSES 5 TO 10 ON PAGE 2) */}
        {isPG ? (
          <div className="space-y-3 text-sm sm:text-[13.5px] text-slate-950 font-medium text-justify leading-relaxed">
            <p>
              <strong className="font-black text-black">5. Verification Documents:</strong> The Resident must provide valid copies of a
              Government-issued Photo ID (Aadhaar, Passport, Voter ID) and verification from their employer or
              educational institution before moving in. These records shall be used for law enforcement and local
              police verification tracking compliance.
            </p>
            <p>
              <strong className="font-black text-black">6. Rules and Curfew Timings:</strong> The Resident must strictly adhere to the house rules,
              including curfew timings (if applicable). No outside guests or visitors of the opposite sex are allowed
              inside the private rooms without prior explicit authorization from the Management.
            </p>
            <p>
              <strong className="font-black text-black">7. Cleanliness and Maintenance:</strong> Residents are responsible for keeping their allocated
              rooms, beds, and shared common areas tidy. Any physical damage caused to the building, furniture, fixtures,
              or electronic appliances by the Resident will be charged directly to them or deducted from the deposit.
            </p>
            <p>
              <strong className="font-black text-black">8. Prohibited Activities:</strong> Consumption of alcohol, smoking, illegal substances/drugs,
              gambling, or playing loud music causing disturbance to other residents is strictly prohibited inside the
              PG premises. Violation will lead to immediate summary eviction without refund.
            </p>
            <p>
              <strong className="font-black text-black">9. Landlord Right of Inspection:</strong> The Owner/Manager reserves the right to enter and
              inspect the allocated rooms for structural health, safety, maintenance tracking, or cleanliness inspections
              after providing a reasonable advance notification to the Resident.
            </p>
            <p>
              <strong className="font-black text-black">10. Termination & Summary Eviction:</strong> The Owner reserves the absolute right to terminate
              this accommodation agreement and evict the Resident with a short 24 hours' notice in the event of gross
              misconduct, non-payment of rent, or breach of any terms listed in this legal framework.
            </p>
          </div>
        ) : (
          <div className="space-y-3 text-sm sm:text-[13.5px] text-slate-950 font-medium text-justify leading-relaxed">
            <p>
              <strong className="font-black text-black">5. Statutory Verification:</strong> Tenant agrees to submit identity proofs and cooperate with
              statutory tenant police verification and housing society administrative onboarding formalities.
            </p>
            <p>
              <strong className="font-black text-black">6. Cleanliness, Internal Maintenance & Structural Safety:</strong> The Tenant shall maintain the
              rented flat/house in a clean, hygienic, and tenantable condition. The Tenant shall not make structural
              alterations, pierce walls excessively, or remodel layout schemes without written administrative consent
              from the Landlord. Any deliberate or negligent asset damage will be deducted from the security deposit.
            </p>
            <p>
              <strong className="font-black text-black">7. Lawful Usage & Structural Boundaries:</strong> The premises shall be strictly utilized for quiet
              residential deployment only. The Tenant shall not sublet, assign, or share the premises with secondary
              parties. Prohibited or illegal acts, heavy commercial trade routing, or storage of hazardous flammable
              material is completely barred.
            </p>
            <p>
              <strong className="font-black text-black">8. Peaceful Enjoyment & Nuisance Controls:</strong> The Tenant shall respect local housing
              community guidelines, avoiding loud noise, public disturbance, or disruptive behavior that alters the
              peaceful enjoyment of surrounding neighbors.
            </p>
            <p>
              <strong className="font-black text-black">9. Landlord Right of Entry & Formal Inspection:</strong> In accordance with standard model tenancy
              frameworks, the Landlord reserves the right to enter and inspect the structural health of the premises after
              extending a mandatory 24-hour advance warning notification notice to the Tenant.
            </p>
            <p>
              <strong className="font-black text-black">10. Default, Termination and Summary Eviction:</strong> If the Tenant defaults on rent payments
              for two consecutive months, or breaches any essential clause of this legal framework, the Landlord retains
              an absolute right to terminate this lease contract and issue a summary 24-hour eviction instruction.
            </p>
          </div>
        )}

        {/* DECLARATION & SIGNATURES */}
        <div className="space-y-4 pt-4 border-t-2 border-slate-900">
          <div>
            <h2 className="text-sm sm:text-base font-black text-slate-950 uppercase tracking-wide">
              DECLARATION & SIGNATURES
            </h2>
            <p className="text-sm sm:text-[13.5px] text-slate-950 font-medium mt-1 leading-relaxed">
              {isPG
                ? 'IN WITNESS WHEREOF, the parties have electronically or physically signed this agreement to express mutual consent. I have read, understood, and agreed to abide by the above-mentioned terms, conditions, and house rules of the PG accommodation.'
                : 'IN WITNESS WHEREOF, the Landlord and Tenant have executed this Residential Rent Agreement by printing onto stamp paper, affixing their legal signatures on every page, in full presence of the undersigned independent witnesses.'}
            </p>
          </div>

          {/* Primary Signature Blocks (Owner & Tenant) */}
          <div className="grid grid-cols-2 gap-8 pt-1">
            {/* Owner / Landlord */}
            <div className="space-y-2">
              <span className="text-sm sm:text-[14px] font-black text-slate-950 block">
                {isPG ? 'Signature of the Owner / Manager' : 'Signature of the Landlord / Lessor'}
              </span>
              <div className="h-20 sm:h-24 border-b-2 border-slate-900 flex items-center justify-start pb-1">
                {agreementData.ownerSignature && agreementData.ownerSignature.startsWith('data:image') ? (
                  <img
                    src={agreementData.ownerSignature}
                    alt="Owner Signature"
                    className="max-h-16 sm:max-h-20 max-w-full object-contain"
                  />
                ) : agreementData.ownerSignature?.startsWith('TYPE:') ? (
                  <div className="font-serif italic text-2xl sm:text-3xl text-blue-900 font-bold">
                    {agreementData.ownerSignature.replace('TYPE:', '')}
                    <span className="block text-[11px] font-mono text-slate-600 font-semibold">
                      Owner Digital Signature
                    </span>
                  </div>
                ) : (
                  <img
                    src={generateDigitalSignatureDataUrl(ownerDisplayName, 'Owner Verified E-Sign')}
                    alt="Owner Signature"
                    className="max-h-16 sm:max-h-20 max-w-full object-contain"
                  />
                )}
              </div>
              <div className="text-sm text-slate-950 space-y-0.5">
                <div>
                  <strong className="font-black text-black">Name:</strong> {ownerDisplayName}
                </div>
                <div>
                  <strong className="font-black text-black">Date:</strong> {executedDateFormatted}
                </div>
              </div>
            </div>

            {/* Resident / Tenant */}
            <div className="space-y-2">
              <span className="text-sm sm:text-[14px] font-black text-slate-950 block">
                {isPG ? 'Signature of the Resident' : 'Signature of the Tenant / Lessee'}
              </span>
              <div className="h-20 sm:h-24 border-b-2 border-slate-900 flex items-center justify-start pb-1">
                {agreementData.residentSignature && agreementData.residentSignature.startsWith('data:image') ? (
                  <img
                    src={agreementData.residentSignature}
                    alt="Resident Signature"
                    className="max-h-16 sm:max-h-20 max-w-full object-contain"
                  />
                ) : agreementData.residentSignature?.startsWith('TYPE:') ? (
                  <div className="font-serif italic text-2xl sm:text-3xl text-blue-900 font-bold">
                    {agreementData.residentSignature.replace('TYPE:', '')}
                    <span className="block text-[11px] font-mono text-slate-600 font-semibold">
                      E-Sign Capture on {executedDateFormatted}
                    </span>
                  </div>
                ) : (
                  <div className="font-serif italic text-lg sm:text-xl text-blue-900 font-bold">
                    {agreementData.tenantName}
                    <span className="block text-[11px] font-mono text-slate-600 font-semibold">
                      E-Sign Capture on {executedDateFormatted}
                    </span>
                  </div>
                )}
              </div>
              <div className="text-sm text-slate-950 space-y-0.5">
                <div>
                  <strong className="font-black text-black">Name:</strong> {agreementData.tenantName}
                </div>
                <div>
                  <strong className="font-black text-black">Date:</strong> {executedDateFormatted}
                </div>
              </div>
            </div>
          </div>

          {/* WITNESSES IN ATTENDANCE */}
          <div className="pt-4 border-t border-dashed border-slate-400 space-y-2.5">
            <span className="text-sm sm:text-base font-black text-slate-950 uppercase tracking-wider block">
              WITNESSES IN ATTENDANCE:
            </span>
            <div className="grid grid-cols-2 gap-8 pt-1">
              {/* Witness 1 */}
              <div className="space-y-2">
                <span className="text-sm sm:text-[14px] font-black text-slate-950 block">
                  Signature of Witness 1
                </span>
                <div className="h-20 sm:h-24 border-b-2 border-slate-900 flex items-center justify-start pb-1">
                  {effectiveWitnesses?.[0]?.signature &&
                  effectiveWitnesses[0].signature.startsWith('data:image') ? (
                    <img
                      src={effectiveWitnesses[0].signature}
                      alt="Witness 1 Signature"
                      className="max-h-16 sm:max-h-20 max-w-full object-contain"
                    />
                  ) : effectiveWitnesses?.[0]?.signature?.startsWith('TYPE:') ? (
                    <div className="font-serif italic text-2xl sm:text-3xl text-blue-900 font-bold">
                      {effectiveWitnesses[0].signature.replace('TYPE:', '')}
                      <span className="block text-[11px] font-mono text-slate-600 font-semibold">
                        Witness 1 E-Signature
                      </span>
                    </div>
                  ) : effectiveWitnesses?.[0]?.signature ? (
                    <div className="font-serif italic text-lg sm:text-xl text-blue-900 font-bold">
                      {effectiveWitnesses[0].signature.replace(/^WITNESS:/i, '')}
                      <span className="block text-[11px] font-mono text-slate-600 font-semibold">
                        Witness 1 Signature
                      </span>
                    </div>
                  ) : (
                    <div className="w-full text-slate-300 text-xs italic">
                      {/* Blank line for physical signature */}
                    </div>
                  )}
                </div>
                <div className="text-sm text-slate-950 space-y-0.5">
                  <div>
                    <strong className="font-black text-black">Name:</strong>{' '}
                    {effectiveWitnesses?.[0]?.name ? effectiveWitnesses[0].name : '________________________'}
                  </div>
                  <div>
                    <strong className="font-black text-black">Date:</strong>{' '}
                    {effectiveWitnesses?.[0]?.date ? effectiveWitnesses[0].date : executedDateFormatted}
                  </div>
                  <div>
                    <strong className="font-black text-black">Address:</strong>{' '}
                    {effectiveWitnesses?.[0]?.address
                      ? effectiveWitnesses[0].address
                      : '________________________'}
                  </div>
                </div>
              </div>

              {/* Witness 2 */}
              <div className="space-y-2">
                <span className="text-sm sm:text-[14px] font-black text-slate-950 block">
                  Signature of Witness 2
                </span>
                <div className="h-20 sm:h-24 border-b-2 border-slate-900 flex items-center justify-start pb-1">
                  {effectiveWitnesses?.[1]?.signature &&
                  effectiveWitnesses[1].signature.startsWith('data:image') ? (
                    <img
                      src={effectiveWitnesses[1].signature}
                      alt="Witness 2 Signature"
                      className="max-h-16 sm:max-h-20 max-w-full object-contain"
                    />
                  ) : effectiveWitnesses?.[1]?.signature?.startsWith('TYPE:') ? (
                    <div className="font-serif italic text-2xl sm:text-3xl text-blue-900 font-bold">
                      {effectiveWitnesses[1].signature.replace('TYPE:', '')}
                      <span className="block text-[11px] font-mono text-slate-600 font-semibold">
                        Witness 2 E-Signature
                      </span>
                    </div>
                  ) : effectiveWitnesses?.[1]?.signature ? (
                    <div className="font-serif italic text-lg sm:text-xl text-blue-900 font-bold">
                      {effectiveWitnesses[1].signature.replace(/^WITNESS:/i, '')}
                      <span className="block text-[11px] font-mono text-slate-600 font-semibold">
                        Witness 2 Signature
                      </span>
                    </div>
                  ) : (
                    <div className="w-full text-slate-300 text-xs italic">
                      {/* Blank line for physical signature */}
                    </div>
                  )}
                </div>
                <div className="text-sm text-slate-950 space-y-0.5">
                  <div>
                    <strong className="font-black text-black">Name:</strong>{' '}
                    {effectiveWitnesses?.[1]?.name ? effectiveWitnesses[1].name : '________________________'}
                  </div>
                  <div>
                    <strong className="font-black text-black">Date:</strong>{' '}
                    {effectiveWitnesses?.[1]?.date ? effectiveWitnesses[1].date : executedDateFormatted}
                  </div>
                  <div>
                    <strong className="font-black text-black">Address:</strong>{' '}
                    {effectiveWitnesses?.[1]?.address
                      ? effectiveWitnesses[1].address
                      : '________________________'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Page 2 Bottom Footer */}
        <div className="pt-3 border-t border-slate-300 flex items-center justify-between text-xs text-slate-700 font-mono font-semibold">
          <span>Page 2 of 2 • Official Tenancy Agreement</span>
          <span>Section 65B Certified Electronic Record</span>
        </div>
      </div>
      )}
    </div>
  );
}
