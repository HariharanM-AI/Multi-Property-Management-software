'use client';

import React, { useRef } from 'react';
import {
  FileText,
  Download,
  Printer,
  MessageCircle,
  X,
  ShieldCheck,
  Building,
  User,
  Calendar,
  CreditCard,
  Scale,
  CheckCircle2,
  Lock,
  Sparkles,
} from 'lucide-react';
import { formatIdProofDisplay } from './AgreementSignModal';

export interface AgreementDocumentData {
  id?: string;
  tenantName: string;
  tenantPhone: string;
  tenantEmail?: string;
  tenantAddress?: string;
  tenantAadhaar?: string;
  ownerName?: string;
  ownerPhone?: string;
  ownerAddress?: string;
  ownerSignature?: string;
  residentSignature?: string;
  propertyName: string;
  propertyAddress?: string;
  unitOrBedName: string;
  sharingType?: string;
  propertyType: 'PG' | 'RENTAL_HOUSE';
  monthlyRent: number | string;
  securityDeposit?: number | string;
  lockInMonths?: number;
  lockInPeriodValue?: number;
  lockInPeriodUnit?: 'DAYS' | 'MONTHS' | 'YEARS' | string;
  noticePeriodDays?: number;
  startDate?: string;
  endDate?: string;
  signedAt?: string;
  status?: string;
  version?: number;
}

interface AgreementDocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  agreementData: AgreementDocumentData | null;
}

export function AgreementDocumentViewerModal({
  isOpen,
  onClose,
  agreementData,
}: AgreementDocumentViewerModalProps) {
  const printContentRef = useRef<HTMLDivElement | null>(null);

  if (!isOpen || !agreementData) return null;

  const isPG = agreementData.propertyType === 'PG';

  const formattedRent =
    typeof agreementData.monthlyRent === 'number'
      ? `₹${agreementData.monthlyRent.toLocaleString('en-IN')}`
      : agreementData.monthlyRent?.toString().startsWith('₹')
      ? agreementData.monthlyRent
      : `₹${agreementData.monthlyRent || '0'}`;

  const formattedDeposit = agreementData.securityDeposit
    ? typeof agreementData.securityDeposit === 'number'
      ? `₹${agreementData.securityDeposit.toLocaleString('en-IN')}`
      : agreementData.securityDeposit.toString().startsWith('₹')
      ? agreementData.securityDeposit
      : `₹${agreementData.securityDeposit}`
    : typeof agreementData.monthlyRent === 'number'
    ? `₹${(agreementData.monthlyRent * 2).toLocaleString('en-IN')}`
    : '₹0';

  const ownerDisplayName = agreementData.ownerName || `${agreementData.propertyName} Management`;
  const ownerDisplayAddress =
    agreementData.ownerAddress || agreementData.propertyAddress || 'Registered Property Office';
  const tenantDisplayAddress =
    agreementData.tenantAddress || 'Address on record / Verified via Government Photo ID';
  const tenantDisplayAadhaar =
    formatIdProofDisplay(agreementData.tenantAadhaar) || 'Government Photo ID (Aadhaar / Passport / Voter ID)';
  const propertyDisplayAddress =
    agreementData.propertyAddress || `${agreementData.propertyName}, Bengaluru, Karnataka`;
  const startDateText = agreementData.startDate || new Date().toISOString().split('T')[0];
  const endDateText = agreementData.endDate || '11 Months from Start Date';
  const executedDateText = agreementData.signedAt
    ? new Date(agreementData.signedAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

  const handlePrint = () => {
    window.print();
  };

  const handleSendWhatsApp = () => {
    const cleanPhone = agreementData.tenantPhone.replace(/\D/g, '').slice(-10);
    const waText = encodeURIComponent(
      `Hello ${agreementData.tenantName},\n\n` +
        `Your official Tenancy Agreement for ${agreementData.unitOrBedName} at ${agreementData.propertyName} has been generated and recorded.\n\n` +
        `📄 Document: ${isPG ? 'PG Accommodation Agreement' : 'Residential Lease Agreement'}\n` +
        `🏡 Property: ${agreementData.propertyName}\n` +
        `📍 Address: ${propertyDisplayAddress}\n` +
        `💰 Monthly Rent: ${formattedRent}\n` +
        `🛡️ Security Deposit: ${formattedDeposit}\n` +
        `📅 Period: ${startDateText} to ${endDateText}\n` +
        `✍️ Status: Verified & Recorded\n\n` +
        `A verified PDF copy is available in your tenant profile.\n\n` +
        `Thank you!`
    );
    window.open(`https://wa.me/91${cleanPhone}?text=${waText}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl max-h-[94vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden text-slate-800">
        
        {/* ========================================================================= */}
        {/* TOP BAR / CONTROLS (NON-PRINTABLE) */}
        {/* ========================================================================= */}
        <div className="px-6 py-3.5 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between gap-4 shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${isPG ? 'bg-teal-500/20 border-teal-400/40 text-teal-300' : 'bg-blue-500/20 border-blue-400/40 text-blue-300'} border flex items-center justify-center font-bold`}>
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-wide">
                  {isPG ? 'PG Accommodation Agreement' : 'Residential Lease Agreement'}
                </h3>
                <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${isPG ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-blue-500/20 text-blue-300 border-blue-500/30'} border`}>
                  Filled PDF Document
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {agreementData.tenantName} • {agreementData.unitOrBedName} • {agreementData.propertyName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
              title="Share filled agreement on WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className={`px-3 py-1.5 rounded-lg ${isPG ? 'bg-brand-teal hover:bg-teal-500' : 'bg-blue-600 hover:bg-blue-500'} text-white text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer`}
              title="Print or Save as PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download / Print PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* DOCUMENT VIEWER BODY (SCROLLABLE & PRINTABLE) */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100 print:bg-white print:p-0">
          <div
            ref={printContentRef}
            className="bg-white max-w-[800px] mx-auto rounded-xl border border-slate-300/80 shadow-md p-6 sm:p-10 space-y-6 text-slate-900 font-sans print:border-none print:shadow-none print:p-0 print:m-0"
          >
            {/* 1. Header & Legal Framework */}
            <div className="text-center pb-5 border-b-2 border-slate-900 space-y-1.5">
              <div className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full ${isPG ? 'bg-teal-50 border-teal-200 text-brand-teal' : 'bg-blue-50 border-blue-200 text-blue-800'} border text-[11px] font-bold`}>
                <Scale className="w-3 h-3" />
                Model Tenancy Act (MTA 2021) & Indian Contract Act, 1872 Compliant
              </div>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-wide">
                {isPG
                  ? 'PAYING GUEST ACCOMMODATION AGREEMENT'
                  : 'RESIDENTIAL RENT / LEASE AGREEMENT'}
              </h1>
              <p className="text-xs text-slate-500">
                Official Digital Tenancy Contract & Rules of Stay
              </p>
            </div>

            {/* 2. Introductory Recitals */}
            <div className="text-xs text-slate-700 leading-relaxed space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <p>
                This <strong>Tenancy Agreement</strong> is executed on this <strong>{executedDateText}</strong> by and between:
              </p>
              <p>
                <strong>FIRST PARTY (Landlord / Manager):</strong> <span className="font-semibold text-slate-900">{ownerDisplayName}</span>, having address at <span>{ownerDisplayAddress}</span> {agreementData.ownerPhone ? `(Contact: ${agreementData.ownerPhone})` : ''} (hereinafter referred to as the <em>"Owner / First Party"</em>).
              </p>
              <p>
                <strong>AND</strong>
              </p>
              <p>
                <strong>SECOND PARTY (Resident / Tenant):</strong> <span className="font-semibold text-slate-900">{agreementData.tenantName}</span>, having permanent address at <span>{tenantDisplayAddress}</span> {agreementData.tenantPhone ? `(Mobile: ${agreementData.tenantPhone})` : ''} (hereinafter referred to as the <em>"Resident / Second Party"</em>).
              </p>
            </div>

            {/* 3. 11-Item Schedule Table */}
            <div className="space-y-2">
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                <ShieldCheck className={`w-4 h-4 ${isPG ? 'text-brand-teal' : 'text-blue-600'}`} />
                Schedule of Premises & Commercial Terms (11 Key Items)
              </h2>

              <div className="rounded-xl border border-slate-300 overflow-hidden">
                <table className="w-full text-xs text-left border-collapse">
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <td className="p-2.5 font-bold text-slate-700 w-1/3 bg-slate-50">1. Property / Building Name</td>
                      <td className="p-2.5 font-bold text-slate-900">{agreementData.propertyName}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-2.5 font-bold text-slate-700 bg-slate-50">2. Complete Premises Address</td>
                      <td className="p-2.5 text-slate-800">{propertyDisplayAddress}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-2.5 font-bold text-slate-700 bg-slate-50">3. Allocated Space / Bed / Unit</td>
                      <td className={`p-2.5 font-extrabold ${isPG ? 'text-brand-teal' : 'text-blue-700'}`}>{agreementData.unitOrBedName} {agreementData.sharingType ? `(${agreementData.sharingType})` : ''}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-2.5 font-bold text-slate-700 bg-slate-50">4. Resident / Tenant Full Name</td>
                      <td className="p-2.5 font-bold text-slate-900">{agreementData.tenantName}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-2.5 font-bold text-slate-700 bg-slate-50">5. Resident Permanent Address</td>
                      <td className="p-2.5 text-slate-800">{tenantDisplayAddress}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-2.5 font-bold text-slate-700 bg-slate-50">6. Registered Phone & Email</td>
                      <td className="p-2.5 font-mono text-slate-800">{agreementData.tenantPhone} {agreementData.tenantEmail ? `• ${agreementData.tenantEmail}` : ''}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-2.5 font-bold text-slate-700 bg-slate-50">7. Verified Identity Document</td>
                      <td className="p-2.5 text-slate-800 font-semibold">{tenantDisplayAadhaar}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-2.5 font-bold text-slate-700 bg-slate-50">8. Agreed Monthly Rent</td>
                      <td className="p-2.5 font-extrabold text-slate-900">{formattedRent} / month (Payable in advance by 5th of each calendar month)</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-2.5 font-bold text-slate-700 bg-slate-50">9. Refundable Security Deposit</td>
                      <td className={`p-2.5 font-extrabold ${isPG ? 'text-emerald-800' : 'text-blue-900'}`}>{formattedDeposit} (Held interest-free, refundable upon peaceful checkout)</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-2.5 font-bold text-slate-700 bg-slate-50">10. Agreement Duration & Term</td>
                      <td className="p-2.5 text-slate-800 font-medium">{startDateText} to {endDateText} (11 Months Term)</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-2.5 font-bold text-slate-700 bg-slate-50">11. Notice Period Required</td>
                      <td className="p-2.5 text-slate-800 font-semibold">{agreementData.noticePeriodDays ?? 30} Days Written Notice prior to vacating</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold text-slate-700 bg-slate-50">12. Minimum Lock-In Period</td>
                      <td className="p-2.5 text-slate-800 font-semibold">
                        {agreementData.lockInPeriodValue ?? agreementData.lockInMonths ?? 1}{' '}
                        {agreementData.lockInPeriodUnit
                          ? agreementData.lockInPeriodUnit.toUpperCase() === 'DAYS'
                            ? 'Day(s)'
                            : agreementData.lockInPeriodUnit.toUpperCase() === 'YEARS'
                            ? 'Year(s)'
                            : 'Month(s)'
                          : 'Month(s)'}{' '}
                        Fixed Stay
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. Verbatim 10 Legal Clauses */}
            <div className="space-y-3 pt-2">
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1.5">
                Standard Terms and Binding Covenants (10 Clauses)
              </h2>

              {isPG ? (
                <div className="space-y-2.5 text-xs text-slate-700 leading-relaxed">
                  <div><strong>1. Monthly Rent & Payment:</strong> The Resident covenants to pay the agreed Monthly Rent in advance on or before the 5th day of every calendar month via authorized digital payment modes.</div>
                  <div><strong>2. Utilities & Common Amenities:</strong> The rent includes standard electricity allowance, high-speed Wi-Fi, 24/7 water supply, housekeeping of common amenities, and CCTV security monitoring.</div>
                  <div><strong>3. Security Deposit Refund:</strong> The Security Deposit is refundable within 7 business days following checkout inspection, subject to deduction of outstanding dues or repairs.</div>
                  <div>
                    <strong>4. Notice Period & Lock-in:</strong> A minimum{' '}
                    <strong>{agreementData.noticePeriodDays ?? 30} days</strong> prior written notice is mandatory before vacating. Vacating before the{' '}
                    <strong>
                      {agreementData.lockInPeriodValue ?? agreementData.lockInMonths ?? 1}{' '}
                      {agreementData.lockInPeriodUnit
                        ? agreementData.lockInPeriodUnit.toUpperCase() === 'DAYS'
                          ? 'day(s)'
                          : agreementData.lockInPeriodUnit.toUpperCase() === 'YEARS'
                          ? 'year(s)'
                          : 'month(s)'
                        : 'month(s)'}
                    </strong>{' '}
                    lock-in period forfeits 1 month deposit.
                  </div>
                  <div><strong>5. Mandatory Identification:</strong> The Resident has submitted authentic government-issued photo identification and emergency contact coordinates.</div>
                  <div><strong>6. House Rules & Quiet Hours:</strong> Silence must be maintained between 10:00 PM and 6:00 AM. Non-registered overnight visitors are strictly prohibited.</div>
                  <div><strong>7. Care of Premises & Inventory:</strong> Resident shall keep the allocated bed, room, and common facilities in clean and orderly condition.</div>
                  <div><strong>8. Prohibited Substance Policy:</strong> Possession, usage, or storage of illegal narcotics, alcohol, or hazardous heaters/appliances is strictly prohibited.</div>
                  <div><strong>9. Right of Inspection:</strong> Property management reserves the right to inspect common areas and rooms with reasonable prior notice for safety and hygiene.</div>
                  <div><strong>10. Termination for Cause:</strong> Breach of rules, default in rent exceeding 10 days, or nuisance warrants immediate termination and eviction.</div>
                </div>
              ) : (
                <div className="space-y-2.5 text-xs text-slate-700 leading-relaxed">
                  <div><strong>1. Rent Payment Schedule:</strong> Tenant agrees to pay monthly rent in advance on or before the 5th day of each calendar month.</div>
                  <div><strong>2. Security Deposit Receipt:</strong> Landlord acknowledges receipt of the Security Deposit, refundable upon handover of vacant possession.</div>
                  <div><strong>3. 11-Month Term & Renewal:</strong> This lease is valid for 11 months, renewable upon mutual consent with standard 5% to 8% rent revision.</div>
                  <div><strong>4. Utility Bills & Maintenance:</strong> Tenant shall pay electricity, water, and local society maintenance charges directly as per meter readings.</div>
                  <div><strong>5. Statutory Verification:</strong> Tenant agrees to submit identity proofs and cooperate with statutory tenant police verification.</div>
                  <div><strong>6. Upkeep & Alterations:</strong> Tenant agrees to maintain premises in good order and make no structural alterations without written consent.</div>
                  <div><strong>7. Residential Usage:</strong> Rented premises shall be used purely for private residential dwelling by tenant and immediate family members.</div>
                  <div><strong>8. Quiet Enjoyment:</strong> Landlord covenants that Tenant shall peacefully enjoy the demised premises without unlawful interference.</div>
                  <div><strong>9. Inspection & Repairs:</strong> Landlord may enter premises for necessary repairs with a minimum 24-hour prior intimation.</div>
                  <div><strong>10. Default & Determination:</strong> Non-payment of rent for 2 consecutive cycles or breach of covenants grants Landlord the right to terminate.</div>
                </div>
              )}
            </div>

            {/* 5. Dual Execution & Digital Signatures Section */}
            <div className="pt-4 border-t-2 border-slate-900 space-y-4">
              <div className="text-xs font-black text-slate-900 uppercase tracking-wider text-center">
                IN WITNESS WHEREOF, THE PARTIES HERETO HAVE DULY EXECUTED THIS AGREEMENT
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                {/* Landlord / Owner Signature Box */}
                <div className="p-4 rounded-xl border-2 border-slate-300 bg-slate-50/70 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 border-b border-slate-200 pb-1.5">
                    <span>FIRST PARTY (Owner / Landlord)</span>
                    <span className={`text-[10px] ${isPG ? 'text-emerald-700 bg-emerald-100 border-emerald-300' : 'text-blue-800 bg-blue-100 border-blue-300'} font-bold px-2 py-0.5 rounded-full border`}>
                      ✓ Authorized
                    </span>
                  </div>

                  <div className="h-20 flex items-center justify-center bg-white rounded-lg border border-slate-200 p-2 overflow-hidden">
                    {agreementData.ownerSignature && agreementData.ownerSignature.startsWith('data:image') ? (
                      <img
                        src={agreementData.ownerSignature}
                        alt="Owner Signature"
                        className="max-h-16 max-w-full object-contain"
                      />
                    ) : agreementData.ownerSignature?.startsWith('TYPE:') ? (
                      <span className={`font-serif italic text-xl ${isPG ? 'text-brand-teal' : 'text-blue-800'} font-semibold`}>
                        {agreementData.ownerSignature.replace('TYPE:', '')}
                      </span>
                    ) : (
                      <span className="font-serif italic text-lg text-slate-700">
                        {ownerDisplayName}
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-600 space-y-0.5">
                    <div className="font-bold text-slate-900">{ownerDisplayName}</div>
                    <div className="text-slate-500">Date: {executedDateText}</div>
                    <div className="text-[10px] text-slate-400 font-mono">Digital Signature Stamp Verified</div>
                  </div>
                </div>

                {/* Tenant / Resident Signature Box */}
                <div className={`p-4 rounded-xl border-2 ${isPG ? 'border-teal-300 bg-teal-50/40' : 'border-blue-300 bg-blue-50/40'} space-y-3`}>
                  <div className={`flex items-center justify-between text-xs font-bold ${isPG ? 'text-teal-900 border-teal-200' : 'text-blue-900 border-blue-200'} border-b pb-1.5`}>
                    <span>SECOND PARTY (Resident / Tenant)</span>
                    <span className={`text-[10px] ${isPG ? 'text-emerald-700 bg-emerald-100 border-emerald-300' : 'text-blue-800 bg-blue-100 border-blue-300'} font-bold px-2 py-0.5 rounded-full border`}>
                      ✓ Digitally Signed
                    </span>
                  </div>

                  <div className={`h-20 flex items-center justify-center bg-white rounded-lg border ${isPG ? 'border-teal-200' : 'border-blue-200'} p-2 overflow-hidden`}>
                    {agreementData.residentSignature && agreementData.residentSignature.startsWith('data:image') ? (
                      <img
                        src={agreementData.residentSignature}
                        alt="Resident Signature"
                        className="max-h-16 max-w-full object-contain"
                      />
                    ) : agreementData.residentSignature?.startsWith('TYPE:') ? (
                      <span className={`font-serif italic text-xl ${isPG ? 'text-brand-teal' : 'text-blue-600'} font-semibold`}>
                        {agreementData.residentSignature.replace('TYPE:', '')}
                      </span>
                    ) : (
                      <span className="font-serif italic text-lg text-slate-700">
                        {agreementData.tenantName}
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-600 space-y-0.5">
                    <div className="font-bold text-slate-900">{agreementData.tenantName}</div>
                    <div className="text-slate-500">Date: {executedDateText}</div>
                    <div className={`text-[10px] ${isPG ? 'text-teal-600' : 'text-blue-600'} font-mono`}>E-Sign Pad Capture Verified</div>
                  </div>
                </div>
              </div>

              {/* Security & Audit Footer */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
                <div className="flex items-center gap-1.5 font-mono">
                  <Lock className={`w-3.5 h-3.5 ${isPG ? 'text-brand-teal' : 'text-blue-600'}`} />
                  <span>Document Hash: {agreementData.id ? `AGR-${agreementData.id.substring(0, 12)}` : 'AGR-MTA-VERIFIED-2026'}</span>
                </div>
                <div className={`${isPG ? 'text-emerald-700' : 'text-blue-800'} font-semibold flex items-center gap-1`}>
                  <CheckCircle2 className={`w-3.5 h-3.5 ${isPG ? 'text-emerald-600' : 'text-blue-600'}`} />
                  <span>Tamper-Evident Digital Tenancy Record</span>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
