'use client';

import React, { useEffect, useRef } from 'react';
import { CheckoutAgreementData } from '../../lib/agreementStorage';
import {
  isRealDrawnOrSignedSignature,
  HARI_M_DRAWN_SIG,
  KAVIN_M_DRAWN_SIG,
  generateRealisticHanddrawnResidentSignature,
} from '../../lib/agreementStorage';
import { getOwnerProfile } from '../../lib/ownerProfileStorage';
import { formatAgreementDate } from '../../lib/date-utils';

export interface CheckoutAgreementDocumentSheetsProps {
  agreementData: CheckoutAgreementData;
  page1Ref?: React.RefObject<HTMLDivElement | null>;
  page2Ref?: React.RefObject<HTMLDivElement | null>;
  onReady?: (page1El: HTMLDivElement, page2El: HTMLDivElement) => void;
  className?: string;
  isExportingPdf?: boolean;
  visiblePage?: 'both' | 'page1' | 'page2';
}

export function CheckoutAgreementDocumentSheets({
  agreementData,
  page1Ref,
  page2Ref,
  onReady,
  className = '',
  isExportingPdf = false,
  visiblePage = 'both',
}: CheckoutAgreementDocumentSheetsProps) {
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

  const depositNum = Number(agreementData.initialDeposit) || 0;
  const deductionsNum = Number(agreementData.deductions) || 0;
  const netRefundNum = Number(agreementData.netRefund) || Math.max(0, depositNum - deductionsNum);

  const formattedDeposit = depositNum.toLocaleString('en-IN');
  const formattedDeductions = deductionsNum.toLocaleString('en-IN');
  const formattedNetRefund = netRefundNum.toLocaleString('en-IN');

  const rawDateToUse = agreementData.signedAt || agreementData.checkOutDate || new Date();
  let execDate: Date;
  if (typeof rawDateToUse === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDateToUse.trim())) {
    const [y, m, d] = rawDateToUse.trim().split('-').map(Number);
    execDate = new Date(y, m - 1, d);
  } else {
    execDate = rawDateToUse instanceof Date ? rawDateToUse : new Date(rawDateToUse);
    if (isNaN(execDate.getTime())) execDate = new Date();
  }

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const execDay = String(execDate.getDate()).padStart(2, '0');
  const execMonth = MONTHS[execDate.getMonth()] || 'September';
  const execYear = String(execDate.getFullYear());
  const execYearShort = execYear.slice(-2);
  const executionCity = 'Coimbatore';

  const formattedStartDate = formatAgreementDate(agreementData.originalStartDate || '2026-08-01');
  const formattedCheckOutDate = formatAgreementDate(agreementData.checkOutDate || rawDateToUse);
  const executedDateFormatted = formatAgreementDate(rawDateToUse);

  const activeOwnerProfile = getOwnerProfile();
  const ownerSignatureToRender = isRealDrawnOrSignedSignature(agreementData.ownerSignature)
    ? agreementData.ownerSignature
    : (isRealDrawnOrSignedSignature(activeOwnerProfile.signature)
        ? activeOwnerProfile.signature
        : (agreementData.ownerSignature || activeOwnerProfile.signature));

  let residentSignatureToRender = agreementData.residentSignature;
  if (!isRealDrawnOrSignedSignature(residentSignatureToRender)) {
    const tLower = (agreementData.tenantName || '').toLowerCase();
    if (tLower.includes('hari')) residentSignatureToRender = HARI_M_DRAWN_SIG;
    else if (tLower.includes('kavin')) residentSignatureToRender = KAVIN_M_DRAWN_SIG;
    else {
      residentSignatureToRender = generateRealisticHanddrawnResidentSignature(agreementData.tenantName || 'Resident', formattedCheckOutDate);
    }
  }

  const witness1 = agreementData.witnesses?.[0] || {
    name: 'Suresh Babu',
    address: '#45, MG Road, Bengaluru',
  };
  const witness2 = agreementData.witnesses?.[1] || {
    name: 'Mithun Kumar',
    address: '#12, Indiranagar, Bengaluru',
  };

  const sharingDisplay = agreementData.sharingType
    ? agreementData.sharingType.replace('_', ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase())
    : 'Single / Sharing';

  const transactionRefDisplay = agreementData.transactionRef || 'BANK-TXN-20260905-9841';

  return (
    <div className={`space-y-8 flex flex-col items-center select-text font-serif ${className}`}>
      {/* ========================================================================= */}
      {/* PAGE 1: TITLE, SCHEDULE OF CLOSURE, AND INITIAL SETTLEMENT CLAUSES        */}
      {/* ========================================================================= */}
      {(visiblePage === 'both' || visiblePage === 'page1') && (
        <div
          ref={activePage1Ref}
          data-page="1"
          className="w-[210mm] min-h-[297mm] p-[16mm] bg-white text-slate-900 border border-slate-300 shadow-xl print:shadow-none print:border-none relative flex flex-col justify-between box-border text-[11pt] leading-[1.6]"
        >
          <div>
            {/* Header / Title */}
            <div className="text-center pb-4 border-b-2 border-slate-900 mb-5">
              <h1 className="text-[17pt] font-black tracking-wide text-slate-950 uppercase font-sans">
                {isPG
                  ? 'PAYING GUEST PROPERTY HANDOVER &'
                  : 'RESIDENTIAL HOUSE PROPERTY HANDOVER &'}
              </h1>
              <h2 className="text-[17pt] font-black tracking-wide text-slate-950 uppercase font-sans mt-0.5">
                DEPOSIT SETTLEMENT AGREEMENT
              </h2>
              <p className="text-[9.5pt] italic text-slate-700 mt-2.5 max-w-[175mm] mx-auto leading-relaxed">
                {isPG
                  ? 'This Digital Settlement Agreement is executed electronically and serves as a legally binding document confirming the final checkout, key handover, and security deposit closure between the Owner and the Resident.'
                  : 'This lease closure agreement is governed under the Indian Contract Act, 1872 and the Transfer of Property Act, 1882. This digital agreement is executed electronically and serves as a legally binding document between the Landlord and the Tenant.'}
              </p>
            </div>

            {/* Preamble */}
            <p className="text-justify text-[10pt] mb-5 text-slate-900">
              {isPG ? (
                <>
                  This Agreement is entered into on this <strong>{execDay}</strong> day of <strong>{execMonth}</strong>, 20<strong>{execYearShort}</strong>, by and between the party detailed as <strong>PG Owner/Manager</strong> and the party detailed as <strong>PG Resident/Tenant</strong> in the schedule below.
                </>
              ) : (
                <>
                  This Handover Agreement is made and executed at <strong>{executionCity}</strong> on this <strong>{execDay}</strong> day of <strong>{execMonth}</strong>, 20<strong>{execYearShort}</strong>, by and between the party detailed as <strong>Landlord/Lessor</strong> and the party detailed as <strong>Tenant/Lessee</strong> in the schedule below.
                </>
              )}
            </p>

            {/* SCHEDULE OF CLOSURE & PROPERTY DETAILS TABLE */}
            <div className="mb-6">
              <h3 className="text-[11.5pt] font-black uppercase tracking-wider text-slate-950 border-b-2 border-slate-900 pb-1 mb-2.5 font-sans flex items-center justify-between">
                <span>SCHEDULE OF CLOSURE &amp; PROPERTY DETAILS</span>
                <span className="text-[9pt] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300 normal-case font-sans">
                  Official Handover Record
                </span>
              </h3>

              <table className="w-full border-2 border-slate-900 text-[9.5pt] border-collapse">
                <tbody>
                  {/* Row 1 */}
                  <tr className="border-b border-slate-900">
                    <td className="w-[42%] p-2.5 font-black text-slate-950 border-r-2 border-slate-900 bg-slate-100/90">
                      1. {isPG ? 'Owner / Manager Name:' : 'Landlord / Lessor Name:'}
                    </td>
                    <td className="p-2.5 text-slate-950 font-bold">
                      {agreementData.ownerName}
                    </td>
                  </tr>

                  {/* Row 2 */}
                  <tr className="border-b border-slate-900">
                    <td className="p-2.5 font-black text-slate-950 border-r-2 border-slate-900 bg-slate-100/90">
                      2. {isPG ? 'Resident Name:' : 'Tenant / Lessee Name:'}
                    </td>
                    <td className="p-2.5 text-slate-950 font-bold">
                      {agreementData.tenantName}
                    </td>
                  </tr>

                  {/* Row 3 */}
                  <tr className="border-b border-slate-900">
                    <td className="p-2.5 font-black text-slate-950 border-r-2 border-slate-900 bg-slate-100/90">
                      3. {isPG ? 'PG Property Address:' : 'Rented Property Address:'}
                    </td>
                    <td className="p-2.5 text-slate-950 font-semibold">
                      {agreementData.propertyAddress || '#45, 2nd Main, Indiranagar, Bengaluru, Karnataka'}
                    </td>
                  </tr>

                  {/* Row 4 */}
                  <tr className="border-b border-slate-900">
                    <td className="p-2.5 font-black text-slate-950 border-r-2 border-slate-900 bg-slate-100/90">
                      4. {isPG ? 'Allocated Room/Bed No:' : 'Original Agreement Tenancy Period:'}
                    </td>
                    <td className="p-2.5 text-slate-950">
                      {isPG ? (
                        <span className="font-bold">
                          {agreementData.unitOrBedName} ({sharingDisplay})
                        </span>
                      ) : (
                        <span className="font-semibold">
                          Original Agreement Date: <strong>{formattedStartDate}</strong> (11-Month Tenancy Period)
                        </span>
                      )}
                    </td>
                  </tr>

                  {/* Row 5 */}
                  <tr className="border-b border-slate-900">
                    <td className="p-2.5 font-black text-slate-950 border-r-2 border-slate-900 bg-slate-100/90">
                      5. {isPG ? 'Agreement Start Date:' : 'Physical Handover / Move-Out Date:'}
                    </td>
                    <td className="p-2.5 text-slate-950">
                      {isPG ? (
                        <span className="font-bold">{formattedStartDate}</span>
                      ) : (
                        <span className="font-black text-slate-950">{formattedCheckOutDate}</span>
                      )}
                    </td>
                  </tr>

                  {/* Row 6 (For PG) */}
                  {isPG && (
                    <tr>
                      <td className="p-2.5 font-black text-slate-950 border-r-2 border-slate-900 bg-slate-100/90">
                        6. Final Check-Out Date:
                      </td>
                      <td className="p-2.5 text-slate-950">
                        <span className="font-black text-slate-950">{formattedCheckOutDate}</span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* TERMS AND CONDITIONS OF CHECK-OUT */}
            <div className="space-y-3.5 text-justify text-[9.8pt]">
              <h3 className="text-[11.5pt] font-black uppercase tracking-wider text-slate-950 border-b-2 border-slate-900 pb-1 mb-2 font-sans">
                {isPG ? 'TERMS AND CONDITIONS OF CHECK-OUT' : 'TERMS AND CONDITIONS OF CLOSURE'}
              </h3>

              {isPG ? (
                <>
                  <p>
                    <strong>1. Notice &amp; Lock-in Compliance:</strong> The Owner verifies that the Resident has successfully fulfilled the required notice period and stayed within the established lock-in bracket as specified under Clause 4 of the initial accommodation terms.
                  </p>
                  <p>
                    <strong>2. Final Dues &amp; Clearance:</strong> The Resident has paid all Monthly PG Rent up to the final check-out date. All additional utility allocations or late penalty fees (if applicable) have been settled.
                  </p>
                  <div>
                    <p className="mb-2">
                      <strong>3. Security Deposit Settlement:</strong> The interest-free Security Deposit is settled as follows:
                    </p>
                    <div className="bg-slate-50 border-2 border-slate-900 p-3 rounded-md space-y-1 font-sans text-[9.5pt]">
                      <div className="flex justify-between border-b border-slate-300 pb-1">
                        <span className="font-semibold text-slate-700">• Total Security Deposit Maintained:</span>
                        <strong className="text-slate-950">Rs. {formattedDeposit}/-</strong>
                      </div>
                      <div className="flex justify-between border-b border-slate-300 pb-1 text-rose-800">
                        <span className="font-semibold">• Deductions (for structural health, asset damage, or missing fixtures):</span>
                        <strong>Rs. {formattedDeductions}/-</strong>
                      </div>
                      <div className="flex justify-between pt-1 text-emerald-900 font-black text-[10pt]">
                        <span>• Net Refund Amount Disbursed:</span>
                        <span>Rs. {formattedNetRefund}/-</span>
                      </div>
                    </div>
                    <p className="mt-2 text-[9.3pt] text-slate-800 italic">
                      The Owner has successfully transferred the Net Refund Amount via Bank Transfer / Cheque (Ref No: <strong>{transactionRefDisplay}</strong> dated <strong>{formattedCheckOutDate}</strong>), and the Resident acknowledges full receipt of this final settlement.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <p>
                    <strong>1. Handover &amp; Condition Verification:</strong> The Tenant has officially vacated the premises and completed the physical handover of the rented flat/house ({agreementData.unitOrBedName}). The Landlord has inspected the structural health, internal maintenance, and safety of the premises, confirming it is in a clean, tenantable condition, subject only to normal wear and tear. All keys and access tokens are returned.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Page 1 Footer */}
          <div className="pt-3 border-t border-slate-400 flex items-center justify-between text-[8.5pt] text-slate-600 font-sans">
            <div>PropertyOS Official Settlement Engine • Ref: {agreementData.id}</div>
            <div className="font-bold">Page 1 of 2</div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PAGE 2: MUTUAL RELEASE, DECLARATION, SIGNATURES & WITNESSES               */}
      {/* ========================================================================= */}
      {(visiblePage === 'both' || visiblePage === 'page2') && (
        <div
          ref={activePage2Ref}
          data-page="2"
          className="w-[210mm] min-h-[297mm] p-[16mm] bg-white text-slate-900 border border-slate-300 shadow-xl print:shadow-none print:border-none relative flex flex-col justify-between box-border text-[11pt] leading-[1.6]"
        >
          <div>
            {/* Upper terms on page 2 */}
            <div className="space-y-4 text-justify text-[9.8pt] mb-8">
              {isPG ? (
                <>
                  <p>
                    <strong>4. Release of Mutual Liability:</strong> Both parties acknowledge that the allocated room, bed, and common areas have been handed over in a clean, tidy condition. With the execution of this electronic framework, both the Owner and Resident declare they have no further financial claims, operational liabilities, or legal actions pending against each other.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    <strong>2. Statutory Utility Clearances:</strong> In compliance with Clause 4 of the original lease, the tenant has produced paid receipts and cleared all outstanding electricity, water, internet, and piped gas charges calculated up to the final physical handover date.
                  </p>
                  <div>
                    <p className="mb-2">
                      <strong>3. Deposit Settlement &amp; Deductions:</strong> The interest-free Security Deposit is processed as follows:
                    </p>
                    <div className="bg-slate-50 border-2 border-slate-900 p-3 rounded-md space-y-1 font-sans text-[9.5pt]">
                      <div className="flex justify-between border-b border-slate-300 pb-1">
                        <span className="font-semibold text-slate-700">• Initial Security Deposit Amount:</span>
                        <strong className="text-slate-950">Rs. {formattedDeposit}/-</strong>
                      </div>
                      <div className="flex justify-between border-b border-slate-300 pb-1 text-rose-800">
                        <span className="font-semibold">• Deductions (Agreed painting/repairs per Clause 6):</span>
                        <strong>Rs. {formattedDeductions}/-</strong>
                      </div>
                      <div className="flex justify-between pt-1 text-emerald-900 font-black text-[10pt]">
                        <span>• Net Refund Amount Settled:</span>
                        <span>Rs. {formattedNetRefund}/-</span>
                      </div>
                    </div>
                    <p className="mt-2 text-[9.3pt] text-slate-800 italic">
                      The Landlord has refunded the Net Amount via transaction reference number <strong>{transactionRefDisplay}</strong> dated <strong>{formattedCheckOutDate}</strong>.
                    </p>
                  </div>
                  <p>
                    <strong>4. Termination of Tenancy &amp; Release:</strong> By signing this document, the original 11-Month Residential Rent Agreement is mutually terminated. Both the Landlord/Lessor and Tenant/Lessee stand discharged from all current, historical, or future legal or financial obligations regarding this tenancy.
                  </p>
                </>
              )}
            </div>

            {/* DECLARATION & SIGNATURES */}
            <div className="mb-8">
              <h3 className="text-[12pt] font-black uppercase tracking-wider text-slate-950 border-b-2 border-slate-900 pb-1 mb-2.5 font-sans">
                DECLARATION &amp; SIGNATURES
              </h3>
              <p className="text-[9.5pt] italic text-slate-800 mb-6">
                {isPG
                  ? 'IN WITNESS WHEREOF, the parties have electronically or physically signed this agreement to express mutual consent and finalize the official check-out process.'
                  : 'IN WITNESS WHEREOF, the Landlord and Tenant have executed this Property Handover & Deposit Settlement Agreement by printing onto non-judicial stamp paper, affixing their legal signatures in full presence of the undersigned independent witnesses.'}
              </p>

              {/* Two Column Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-2">
                {/* Column 1: Owner / Landlord */}
                <div className="space-y-2">
                  <div className="text-[10pt] font-black text-slate-950 uppercase tracking-wide font-sans">
                    {isPG ? 'Signature of the Owner / Manager' : 'Signature of the Landlord / Lessor'}
                  </div>
                  <div className="h-20 border-b-2 border-slate-900 flex items-end pb-1 relative">
                    {ownerSignatureToRender ? (
                      <img
                        src={ownerSignatureToRender}
                        alt="Owner Signature"
                        className="max-h-16 max-w-[200px] object-contain"
                      />
                    ) : (
                      <div className="text-slate-400 italic text-xs">Awaiting Signature</div>
                    )}
                  </div>
                  <div className="text-[9.5pt] space-y-0.5 pt-1">
                    <div>
                      <strong>Name:</strong> {agreementData.ownerName}
                    </div>
                    <div>
                      <strong>Date:</strong> {executedDateFormatted}
                    </div>
                  </div>
                </div>

                {/* Column 2: Resident / Tenant */}
                <div className="space-y-2">
                  <div className="text-[10pt] font-black text-slate-950 uppercase tracking-wide font-sans">
                    {isPG ? 'Signature of the Resident' : 'Signature of the Tenant / Lessee'}
                  </div>
                  <div className="h-20 border-b-2 border-slate-900 flex items-end pb-1 relative">
                    {residentSignatureToRender ? (
                      <img
                        src={residentSignatureToRender}
                        alt="Resident Signature"
                        className="max-h-16 max-w-[200px] object-contain"
                      />
                    ) : (
                      <div className="text-slate-400 italic text-xs">Awaiting Signature</div>
                    )}
                  </div>
                  <div className="text-[9.5pt] space-y-0.5 pt-1">
                    <div>
                      <strong>Name:</strong> {agreementData.tenantName}
                    </div>
                    <div>
                      <strong>Date:</strong> {executedDateFormatted}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* WITNESSES IN ATTENDANCE */}
            <div>
              <h3 className="text-[11pt] font-black uppercase tracking-wider text-slate-950 border-b-2 border-slate-900 pb-1 mb-4 font-sans">
                WITNESSES IN ATTENDANCE:
              </h3>

              <div className="grid grid-cols-2 gap-8">
                {/* Witness 1 */}
                <div className="space-y-2 text-[9pt]">
                  <div className="font-black text-slate-950 uppercase tracking-wide font-sans">
                    WITNESS 1:
                  </div>
                  <div className="pt-2">
                    <strong>Signature:</strong>{' '}
                    <span className="inline-block border-b border-slate-800 w-44 font-serif italic text-blue-950 pl-2">
                      {witness1.signature ? (
                        <img src={witness1.signature} alt="Witness 1" className="h-6 inline-block" />
                      ) : (
                        witness1.name
                      )}
                    </span>
                  </div>
                  <div>
                    <strong>Name:</strong>{' '}
                    <span className="inline-block border-b border-slate-800 w-48 pl-2">
                      {witness1.name}
                    </span>
                  </div>
                  <div>
                    <strong>Address:</strong>{' '}
                    <span className="inline-block border-b border-slate-800 w-48 pl-2">
                      {witness1.address}
                    </span>
                  </div>
                </div>

                {/* Witness 2 */}
                <div className="space-y-2 text-[9pt]">
                  <div className="font-black text-slate-950 uppercase tracking-wide font-sans">
                    WITNESS 2:
                  </div>
                  <div className="pt-2">
                    <strong>Signature:</strong>{' '}
                    <span className="inline-block border-b border-slate-800 w-44 font-serif italic text-blue-950 pl-2">
                      {witness2.signature ? (
                        <img src={witness2.signature} alt="Witness 2" className="h-6 inline-block" />
                      ) : (
                        witness2.name
                      )}
                    </span>
                  </div>
                  <div>
                    <strong>Name:</strong>{' '}
                    <span className="inline-block border-b border-slate-800 w-48 pl-2">
                      {witness2.name}
                    </span>
                  </div>
                  <div>
                    <strong>Address:</strong>{' '}
                    <span className="inline-block border-b border-slate-800 w-48 pl-2">
                      {witness2.address}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Page 2 Footer */}
          <div className="pt-3 border-t border-slate-400 flex items-center justify-between text-[8.5pt] text-slate-600 font-sans">
            <div>PropertyOS Official Settlement Engine • Ref: {agreementData.id}</div>
            <div className="font-bold">Page 2 of 2</div>
          </div>
        </div>
      )}
    </div>
  );
}
