'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  FileSignature,
  CheckCircle2,
  ShieldCheck,
  X,
  RotateCcw,
  Building,
  User,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  AlertCircle,
  FileText,
  Lock,
  ChevronRight,
  PenTool,
    Clock,
  Check,
  Scale,
  Type,
} from 'lucide-react';

export interface AgreementSignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignComplete: (signatureData: {
    signerName: string;
    signerEmail?: string;
    signatureImage?: string;
    signedAt: string;
    agreementType: string;
  }) => void;
  agreementData: {
    tenantName: string;
    tenantPhone?: string;
    tenantEmail?: string;
    tenantAadhaar?: string;
    tenantAddress?: string;
    ownerName?: string;
    ownerAddress?: string;
    ownerPhone?: string;
    ownerSignature?: string;
    residentSignature?: string;
    propertyName: string;
    propertyAddress?: string;
    unitOrBedName: string; // e.g. "Bed 102-A" or "Flat 102"
    sharingType?: string;
    propertyType: 'PG' | 'RENTAL_HOUSE';
    monthlyRent: number | string;
    securityDeposit?: number | string;
    roomNumber?: string;
    lockInMonths?: number;
    lockInPeriodMonths?: number;
    lockInPeriodValue?: number;
    lockInPeriodUnit?: 'DAYS' | 'MONTHS' | 'YEARS' | string;
    noticePeriodDays?: number;
    startDate?: string;
    endDate?: string;
  };
}

export type AgreementSignDetails = AgreementSignModalProps['agreementData'];

export function formatIdProofDisplay(docTypeOrFullString?: string | null, docNum?: string | null): string {
  if (!docTypeOrFullString && !docNum) return '';

  let str = (docTypeOrFullString || '').trim();
  let num = (docNum || '').trim();

  // If str is in "Name (Number)" format, extract both
  const match = str.match(/^([^(]+)\s*\(([^)]+)\)$/);
  if (match) {
    str = match[1].trim();
    if (!num) {
      num = match[2].trim();
    }
  }

  // If str contains "and" or ":", e.g. "Aadhaar and 987678987678" or "Aadhaar: 987678987678"
  if (str && !num && (str.includes(' and ') || str.includes(':'))) {
    const parts = str.split(/\s+and\s+|:\s*/);
    if (parts.length === 2) {
      str = parts[0].trim();
      num = parts[1].trim();
    }
  }

  // If str is purely numeric (or starts with ID:) and num is empty, treat str as doc number
  if (/^(ID:\s*)?\d{8,16}$/i.test(str) && !num) {
    num = str.replace(/^ID:\s*/i, '').trim();
    str = 'Aadhaar';
  }

  // Clean num of any "ID:" or existing outer parens
  num = num.replace(/^ID:\s*/i, '').replace(/^\((.*)\)$/, '$1').trim();

  // Standardize doc name
  let docName = str || 'Aadhaar';
  if (/^aadhaar/i.test(docName) || /^aadhar/i.test(docName)) {
    docName = 'Aadhar';
  } else if (/^pan/i.test(docName)) {
    docName = 'PAN';
  } else if (/^passport/i.test(docName)) {
    docName = 'Passport';
  } else if (/^voter/i.test(docName)) {
    docName = 'Voter ID';
  } else if (/^driv/i.test(docName)) {
    docName = 'Driving License';
  } else if (/^employ/i.test(docName) || /^corp/i.test(docName)) {
    docName = 'Employment ID';
  } else if (/^student/i.test(docName)) {
    docName = 'Student ID';
  } else {
    docName = docName.replace(/_/g, ' ').replace(/\s*Card\s*/i, '').trim();
    if (docName.length > 0) {
      docName = docName.charAt(0).toUpperCase() + docName.slice(1);
    } else {
      docName = 'Aadhar';
    }
  }

  if (num) {
    return `${docName} (${num})`;
  }

  return docName;
}

export function AgreementSignModal({
  isOpen,
  onClose,
  onSignComplete,
  agreementData,
}: AgreementSignModalProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'sign'>('preview');
  const [signMode, setSignMode] = useState<'draw' | 'type'>('draw');
  const [typedName, setTypedName] = useState(agreementData.tenantName || '');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Canvas drawing state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [currentSignatureImage, setCurrentSignatureImage] = useState<string | undefined>(agreementData.residentSignature);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('preview');
      setIsSubmitting(false);
      setCurrentSignatureImage(agreementData.residentSignature);

      if (agreementData.residentSignature) {
        if (agreementData.residentSignature.startsWith('TYPE:')) {
          setSignMode('type');
          setTypedName(agreementData.residentSignature.replace('TYPE:', ''));
          setHasDrawn(true);
          setTermsAccepted(true);
        } else {
          setSignMode('draw');
          setTypedName(agreementData.tenantName || '');
          setHasDrawn(true);
          setTermsAccepted(true);
        }
      } else {
        setTypedName(agreementData.tenantName || '');
        setTermsAccepted(false);
        setHasDrawn(false);
        setSignMode('draw');
      }
    }
  }, [isOpen, agreementData.tenantName, agreementData.residentSignature]);

  // Load existing signature onto canvas when switching to sign tab in draw mode
  useEffect(() => {
    if (
      isOpen &&
      activeTab === 'sign' &&
      signMode === 'draw' &&
      currentSignatureImage &&
      !currentSignatureImage.startsWith('TYPE:')
    ) {
      const timer = setTimeout(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setHasDrawn(true);
        };
        img.src = currentSignatureImage;
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [isOpen, activeTab, signMode, currentSignatureImage]);

  // Handle canvas drawing
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawn(true);
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.strokeStyle = agreementData.propertyType === 'PG' ? '#0f766e' : '#2563eb';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      const canvas = canvasRef.current;
      if (canvas) {
        const dataUrl = canvas.toDataURL('image/png');
        setCurrentSignatureImage(dataUrl);
        setHasDrawn(true);
      }
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    setHasDrawn(false);
    setCurrentSignatureImage(undefined);
    if (agreementData) {
      agreementData.residentSignature = undefined;
    }
  };

  const handleExecuteSignature = async () => {
    if (!termsAccepted) return;
    setIsSubmitting(true);

    let signatureImage = '';
    if (signMode === 'draw') {
      if (canvasRef.current && hasDrawn) {
        signatureImage = canvasRef.current.toDataURL('image/png');
      } else if (currentSignatureImage) {
        signatureImage = currentSignatureImage;
      }
    } else if (signMode === 'type') {
      signatureImage = `TYPE:${typedName.trim() || agreementData.tenantName}`;
    }

    try {
      await onSignComplete({
        signerName: typedName.trim() || agreementData.tenantName,
        signerEmail: agreementData.tenantEmail,
        signatureImage: signatureImage || undefined,
        signedAt: new Date().toISOString(),
        agreementType: agreementData.propertyType === 'PG' ? 'PG_AGREEMENT' : 'RENTAL_AGREEMENT',
      });
    } catch {
      // Handled upstream
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const isPG = agreementData.propertyType === 'PG';

  // Dynamic Theme Colors: PG (Teal) vs House Rental (Blue)
  const theme = {
    primaryBg: isPG ? 'bg-brand-teal hover:bg-teal-700' : 'bg-blue-600 hover:bg-blue-700',
    primaryText: isPG ? 'text-brand-teal' : 'text-blue-600',
    primaryBorder: isPG ? 'border-teal-200' : 'border-blue-200',
    primaryBorderFocus: isPG ? 'focus:ring-brand-teal' : 'focus:ring-blue-500',
    primaryLightBg: isPG ? 'bg-teal-50' : 'bg-blue-50',
    primaryBadgeBg: isPG ? 'bg-teal-100/80 text-teal-800 border-teal-200' : 'bg-blue-50 text-blue-800 border-blue-200',
    stepActiveTab: isPG ? 'border-brand-teal text-brand-teal bg-white' : 'border-blue-600 text-blue-600 bg-white',
    stepActiveBadge: isPG ? 'bg-teal-100 text-teal-800' : 'bg-blue-100 text-blue-800',
    cardBorder: isPG ? 'border-teal-200/90' : 'border-blue-200/90',
    cardDashedBorder: isPG ? 'border-teal-300' : 'border-blue-300',
    canvasBorder: isPG ? 'border-teal-400/80' : 'border-blue-400/80',
    depositText: isPG ? 'text-emerald-800' : 'text-blue-900',
    allocatedText: isPG ? 'text-brand-teal' : 'text-blue-700',
    checkboxBg: isPG ? 'bg-emerald-50/80 border-emerald-200/90' : 'bg-blue-50/80 border-blue-200/90',
    checkboxInput: isPG ? 'text-brand-teal focus:ring-brand-teal' : 'text-blue-600 focus:ring-blue-500',
    preAuthBadge: isPG ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-blue-100 text-blue-800 border-blue-300',
  };

  const formattedRent = typeof agreementData.monthlyRent === 'number'
    ? `₹${agreementData.monthlyRent.toLocaleString('en-IN')}`
    : (agreementData.monthlyRent.toString().startsWith('₹') ? agreementData.monthlyRent : `₹${agreementData.monthlyRent}`);

  const formattedDeposit = agreementData.securityDeposit
    ? (typeof agreementData.securityDeposit === 'number'
        ? `₹${agreementData.securityDeposit.toLocaleString('en-IN')}`
        : (agreementData.securityDeposit.toString().startsWith('₹') ? agreementData.securityDeposit : `₹${agreementData.securityDeposit}`))
    : (typeof agreementData.monthlyRent === 'number' ? `₹${(agreementData.monthlyRent * 2).toLocaleString('en-IN')}` : '₹0');

  const ownerDisplayName = agreementData.ownerName || `${agreementData.propertyName} Management`;
  const ownerDisplayAddress = agreementData.ownerAddress || agreementData.propertyAddress || 'Registered Property Office';
  const tenantDisplayAddress = agreementData.tenantAddress || 'Address on record / Verified via Government ID';
  const tenantDisplayAadhaar = formatIdProofDisplay(agreementData.tenantAadhaar) || 'Government Photo ID (Aadhaar / Voter / Passport)';
  const propertyDisplayAddress = agreementData.propertyAddress || agreementData.propertyName;
  const startDateText = agreementData.startDate || new Date().toISOString().split('T')[0];
  const endDateText = agreementData.endDate || '11 Months from Start Date';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden text-slate-800">
        
        {/* ========================================================================= */}
        {/* MODAL HEADER */}
        {/* ========================================================================= */}
        <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${theme.primaryLightBg} border ${theme.primaryBorder} ${theme.primaryText} flex items-center justify-center font-bold shadow-2xs`}>
              <FileSignature className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  {isPG ? 'Paying Guest Accommodation Agreement' : 'Residential 11-Month Rent Agreement'}
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${theme.primaryBadgeBg} border`}>
                  MTA 2021 Compliant
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Legal Tenancy Agreement for <strong className="text-slate-800 font-semibold">{agreementData.tenantName}</strong> • <span className={`font-semibold ${theme.allocatedText}`}>{agreementData.unitOrBedName}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* STEP / TAB NAVIGATION BAR */}
        {/* ========================================================================= */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50/80 px-6 pt-2.5 gap-3">
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-5 py-2.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'preview'
                ? `${theme.stepActiveTab} shadow-2xs`
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60 rounded-t-lg'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>1. Review Agreement Terms & Schedule</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
              activeTab === 'preview' ? theme.stepActiveBadge : 'bg-slate-200 text-slate-600'
            }`}>
              Step 1
            </span>
          </button>

          <button
            onClick={() => setActiveTab('sign')}
            className={`px-5 py-2.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'sign'
                ? `${theme.stepActiveTab} shadow-2xs`
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60 rounded-t-lg'
            }`}
          >
            <PenTool className="w-4 h-4" />
            <span>2. Dual Digital E-Signature Pad</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
              activeTab === 'sign' ? theme.stepActiveBadge : 'bg-slate-200 text-slate-600'
            }`}>
              Step 2
            </span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* MODAL BODY */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 space-y-6">
          {activeTab === 'preview' ? (
            <div className="space-y-6">
              
              {/* Formatted Contract Document */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6 text-slate-800 font-sans select-text">
                
                {/* Contract Header Banner */}
                <div className="text-center pb-5 border-b border-slate-200/80 space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold mb-1">
                    <Scale className={`w-3.5 h-3.5 ${theme.primaryText}`} />
                    Government Standard Model Tenancy Framework
                  </div>
                  <h4 className="text-base sm:text-lg font-extrabold text-slate-900 uppercase tracking-wide">
                    {isPG
                      ? 'PAYING GUEST ACCOMMODATION AGREEMENT'
                      : 'RESIDENTIAL RENT AGREEMENT'}
                  </h4>
                  <p className="text-xs text-slate-500 max-w-xl mx-auto">
                    Executed under the Indian Contract Act, 1872 and the Model Tenancy Framework for residential stay.
                  </p>
                </div>

                {/* 11-ITEM SCHEDULE OF PARTIES & PROPERTY DETAILS TABLE */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h5 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className={`w-4 h-4 ${theme.primaryText}`} />
                      Schedule of Parties & Tenancy Details (11 Key Items)
                    </h5>
                    <span className="text-[11px] font-semibold text-slate-500">Official Schedule</span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50/60">
                    <table className="w-full text-xs text-left border-collapse">
                      <tbody>
                        <tr className="border-b border-slate-200">
                          <td className="p-2.5 font-bold text-slate-700 w-1/3 bg-slate-100/70">1. {isPG ? 'Owner / Manager' : 'Landlord / Lessor'}</td>
                          <td className="p-2.5 font-bold text-slate-900">{ownerDisplayName} {agreementData.ownerPhone ? `(Ph: ${agreementData.ownerPhone})` : ''}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="p-2.5 font-bold text-slate-700 bg-slate-100/70">2. {isPG ? 'Resident Name' : 'Tenant / Lessee Name'}</td>
                          <td className="p-2.5 font-bold text-slate-900">{agreementData.tenantName} {agreementData.tenantPhone ? `(Ph: ${agreementData.tenantPhone})` : ''}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="p-2.5 font-bold text-slate-700 bg-slate-100/70">3. Resident Permanent Address</td>
                          <td className="p-2.5 text-slate-800">{tenantDisplayAddress}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="p-2.5 font-bold text-slate-700 bg-slate-100/70">4. {isPG ? 'PG Property Address' : 'Rented Property Address'}</td>
                          <td className="p-2.5 font-semibold text-slate-800">{propertyDisplayAddress}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="p-2.5 font-bold text-slate-700 bg-slate-100/70">5. Allocated Space & Type</td>
                          <td className={`p-2.5 ${theme.allocatedText} font-extrabold`}>{agreementData.unitOrBedName} {agreementData.sharingType ? `(${agreementData.sharingType})` : ''}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="p-2.5 font-bold text-slate-700 bg-slate-100/70">6. ID Proof Provided</td>
                          <td className="p-2.5 text-slate-800 font-semibold">{tenantDisplayAadhaar}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="p-2.5 font-bold text-slate-700 bg-slate-100/70">7. Monthly Rent & Due Day</td>
                          <td className="p-2.5 font-bold text-slate-900">{formattedRent} / month (Payable by 5th of each calendar month)</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="p-2.5 font-bold text-slate-700 bg-slate-100/70">8. Security Deposit Amount</td>
                          <td className={`p-2.5 font-bold ${theme.depositText}`}>{formattedDeposit} (Refundable upon vacating)</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="p-2.5 font-bold text-slate-700 bg-slate-100/70">9. Agreement Period & Start Date</td>
                          <td className="p-2.5 text-slate-800">{startDateText} to {endDateText} (11 Months Term)</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="p-2.5 font-bold text-slate-700 bg-slate-100/70">10. Notice Period Required</td>
                          <td className="p-2.5 font-semibold text-slate-800">{agreementData.noticePeriodDays ?? 30} Days Written Notice</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-bold text-slate-700 bg-slate-100/70">11. Minimum Lock-in Period</td>
                          <td className="p-2.5 font-semibold text-slate-800">
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

                {/* 10 VERBATIM LEGAL CLAUSES */}
                <div className="space-y-4 pt-2">
                  <h5 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-2">
                    Terms and Conditions (10 Binding Clauses)
                  </h5>

                  {isPG ? (
                    <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
                      <div><strong>1. Rent & Payment:</strong> The Resident agrees to pay the agreed Monthly PG Rent in advance on or before the Rent Payment Due Date every month via digital payment modes.</div>
                      <div><strong>2. Inclusions & Facilities:</strong> The PG rent covers electricity up to fair usage limits, high-speed Wi-Fi, drinking water, housekeeping of common spaces, and security.</div>
                      <div><strong>3. Security Deposit Protection:</strong> The Security Deposit is held interest-free and refunded upon check-out within 7 bank days after deduction of unpaid dues or damages.</div>
                      <div>
                        <strong>4. Notice Period & Lock-in:</strong> The Resident shall serve at least{' '}
                        <strong>{agreementData.noticePeriodDays ?? 30} Days</strong> prior notice. Vacating before the{' '}
                        <strong>
                          {agreementData.lockInPeriodValue ?? agreementData.lockInMonths ?? 1}{' '}
                          {agreementData.lockInPeriodUnit
                            ? agreementData.lockInPeriodUnit.toUpperCase() === 'DAYS'
                              ? 'Day(s)'
                              : agreementData.lockInPeriodUnit.toUpperCase() === 'YEARS'
                              ? 'Year(s)'
                              : 'Month(s)'
                            : 'Month(s)'}
                        </strong>{' '}
                        lock-in period forfeits 1 month rent deposit.
                      </div>
                      <div><strong>5. Verification Documents:</strong> Resident must provide authentic ID proof (Aadhaar / Passport) and emergency contact details before taking occupancy.</div>
                      <div><strong>6. Rules & Curfew:</strong> Resident must maintain silence between 10:00 PM and 6:00 AM. Non-registered overnight visitors are strictly prohibited.</div>
                      <div><strong>7. Cleanliness & Maintenance:</strong> Resident shall maintain allocated space cleanly. Any damage to premises fittings shall be compensated by resident.</div>
                      <div><strong>8. Prohibited Activities:</strong> Possession or consumption of illegal substances, loud parties, or hazardous appliances is strictly prohibited.</div>
                      <div><strong>9. Right of Inspection:</strong> The Owner/Manager reserves the right to inspect premises for hygiene and safety with reasonable notice.</div>
                      <div><strong>10. Termination & Eviction:</strong> Breach of rules, default in rent for over 10 days, or unlawful activity warrants immediate eviction.</div>
                    </div>
                  ) : (
                    <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
                      <div><strong>1. Rent & Payment Outlay:</strong> Tenant agrees to pay monthly rent in advance by the 5th day of every calendar month. Delayed payments attract standard late fee.</div>
                      <div><strong>2. Security Deposit Protection:</strong> Landlord acknowledges receipt of security deposit, refundable upon handover of peaceful vacant possession.</div>
                      <div><strong>3. 11-Month Term & Escalation:</strong> Agreement valid for 11 months. Renewal is mutually agreed with standard 5% to 8% escalation.</div>
                      <div><strong>4. Utilities & Maintenance:</strong> Tenant shall pay electricity, water, and society maintenance charges directly as per actual meter readings.</div>
                      <div><strong>5. Mandatory Verification:</strong> Tenant agrees to submit identity proofs and cooperate with local law enforcement/police verification requirements.</div>
                      <div><strong>6. Cleanliness & Safety:</strong> Tenant agrees to maintain premises in good tenable condition and avoid structural modifications.</div>
                      <div><strong>7. Lawful Usage:</strong> Rented premises shall be used purely for private residential purposes by tenant and immediate family.</div>
                      <div><strong>8. Peaceful Enjoyment:</strong> Landlord ensures quiet and peaceful enjoyment without unlawful interference.</div>
                      <div><strong>9. Right of Entry:</strong> Landlord may enter premises for inspection or repairs with prior 24-hour notice.</div>
                      <div><strong>10. Default & Eviction:</strong> Non-payment of rent for 2 consecutive months or breach of covenants grants Landlord right to terminate.</div>
                    </div>
                  )}
                </div>

              </div>

            </div>
          ) : (
            <div className="space-y-6">
              
              {/* DUAL SIGNATURE VISUAL CARDS: OWNER (PRE-SIGNED) + TENANT (SIGNING) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Left Card: Landlord / Owner Signature Status */}
                <div className={`p-4 rounded-xl bg-white border ${theme.cardBorder} shadow-2xs space-y-3`}>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className={`w-3.5 h-3.5 ${theme.primaryText}`} />
                      Landlord / Owner Execution
                    </span>
                    <span className={`text-[10px] font-bold ${theme.preAuthBadge} px-2 py-0.5 rounded-full border`}>
                      ✓ Pre-Authorized
                    </span>
                  </div>

                  <div className={`h-24 bg-slate-50 border border-dashed ${theme.cardDashedBorder} rounded-lg flex items-center justify-center p-2 overflow-hidden`}>
                    {agreementData.ownerSignature && agreementData.ownerSignature.startsWith('data:image') ? (
                      <img
                        src={agreementData.ownerSignature}
                        alt="Owner Signature"
                        className="max-h-20 object-contain"
                      />
                    ) : agreementData.ownerSignature && agreementData.ownerSignature.startsWith('TYPE:') ? (
                      <span className={`font-serif italic text-xl ${isPG ? 'text-teal-800' : 'text-blue-800'}`}>
                        {agreementData.ownerSignature.replace('TYPE:', '')}
                      </span>
                    ) : (
                      <div className={`text-center font-serif italic text-lg ${isPG ? 'text-teal-800' : 'text-blue-800'}`}>
                        {ownerDisplayName}
                        <div className="text-[10px] text-slate-400 font-sans not-italic">Digitally Verified Stamp</div>
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-slate-700">
                    <strong>{ownerDisplayName}</strong>
                    <div className="text-[11px] text-slate-500">{ownerDisplayAddress}</div>
                  </div>
                </div>

                {/* Right Card: Tenant / Resident Signature Target */}
                <div className={`p-4 rounded-xl bg-white border ${theme.cardBorder} shadow-2xs space-y-3`}>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                      <PenTool className={`w-3.5 h-3.5 ${theme.primaryText}`} />
                      Resident / Tenant Signature
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      (signMode === 'draw' && (hasDrawn || currentSignatureImage)) || (signMode === 'type' && typedName.trim())
                        ? (isPG ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-blue-100 text-blue-800 border-blue-300')
                        : 'bg-amber-100 text-amber-800 border-amber-300'
                    }`}>
                      {(signMode === 'draw' && (hasDrawn || currentSignatureImage)) || (signMode === 'type' && typedName.trim())
                        ? '✓ Signed'
                        : '✍️ Sign Below'}
                    </span>
                  </div>

                  <div className={`h-24 bg-slate-50 border border-dashed ${theme.cardDashedBorder} rounded-lg flex items-center justify-center p-2 overflow-hidden`}>
                    {signMode === 'draw' && (hasDrawn || currentSignatureImage) ? (
                      currentSignatureImage && !currentSignatureImage.startsWith('TYPE:') ? (
                        <img
                          src={currentSignatureImage}
                          alt="Resident Signature"
                          className="h-16 max-w-full object-contain"
                        />
                      ) : (
                        <span className={`text-xs ${isPG ? 'text-emerald-700' : 'text-blue-700'} font-bold flex items-center gap-1`}>
                          <Check className="w-4 h-4" /> Signature Captured on Pad
                        </span>
                      )
                    ) : signMode === 'type' && typedName ? (
                      <span className={`font-serif italic text-2xl ${theme.primaryText}`}>
                        {typedName}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Signature will appear here...</span>
                    )}
                  </div>

                  <div className="text-xs text-slate-700">
                    <strong>{agreementData.tenantName}</strong>
                    <div className="text-[11px] text-slate-500">{agreementData.unitOrBedName}</div>
                  </div>
                </div>

              </div>

              {/* Signing Mode Selector */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <div className="text-sm font-bold text-slate-800">Choose Resident Signature Method:</div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSignMode('draw')}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      signMode === 'draw'
                        ? `${theme.primaryBg} text-white shadow-2xs`
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <PenTool className="w-4 h-4" />
                    Draw on Pad
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignMode('type')}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      signMode === 'type'
                        ? `${theme.primaryBg} text-white shadow-2xs`
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <Type className="w-4 h-4" />
                    Type Script
                  </button>
                </div>
              </div>

              {/* Signature Drawing / Typing Pad */}
              {signMode === 'draw' ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
                    <span>Draw signature using stylus, touch, or mouse inside the pad:</span>
                    <button
                      type="button"
                      onClick={clearCanvas}
                      className="text-xs text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Clear & Redraw
                    </button>
                  </div>

                  <div className={`border-2 border-dashed ${theme.canvasBorder} rounded-2xl bg-white overflow-hidden relative shadow-2xs`}>
                    <canvas
                      ref={canvasRef}
                      width={750}
                      height={180}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="w-full h-44 cursor-crosshair touch-none bg-transparent"
                    />
                    {!hasDrawn && !currentSignatureImage && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-sm font-semibold italic">
                        ✍️ Sign with finger or stylus here...
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      Type Full Legal Name for Electronic Signature:
                    </label>
                    <input
                      type="text"
                      value={typedName}
                      onChange={(e) => setTypedName(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className={`w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-900 font-serif text-lg tracking-wide focus:outline-none focus:ring-2 ${theme.primaryBorderFocus} focus:border-transparent shadow-2xs`}
                    />
                  </div>

                  <div className={`p-8 bg-white border ${theme.primaryBorder} rounded-2xl text-center font-serif italic text-3xl ${theme.primaryText} shadow-2xs`}>
                    {typedName || 'Your Signature Script Preview'}
                  </div>
                </div>
              )}

              {/* Legal Confirmation Checkbox */}
              <div className={`p-4.5 rounded-xl ${theme.checkboxBg} shadow-2xs`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className={`mt-1 w-4.5 h-4.5 rounded border-slate-300 ${theme.checkboxInput} cursor-pointer`}
                  />
                  <span className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium">
                    I, <strong className="text-slate-900 font-bold">{agreementData.tenantName}</strong>, confirm that I have reviewed, understood, and accept all clauses, lock-in terms, deposit conditions, and code of conduct for{' '}
                    <strong className={`${theme.allocatedText} font-bold`}>{agreementData.unitOrBedName}</strong>. I execute this electronic signature with full legal binding intent.
                  </span>
                </label>
              </div>

            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* MODAL FOOTER */}
        {/* ========================================================================= */}
        <div className="px-6 py-4 border-t border-slate-200/90 bg-white flex flex-wrap items-center justify-between gap-3.5">
          
          {/* Left Action: Mandatory Notice */}
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <Lock className={`w-3.5 h-3.5 ${theme.primaryText} shrink-0`} />
            <span>Mandatory Tenancy Execution (MTA 2021)</span>
          </div>

          {/* Right Action: Step Progress Buttons */}
          <div className="flex items-center gap-3 ml-auto">
            {activeTab === 'preview' ? (
              <button
                type="button"
                onClick={() => setActiveTab('sign')}
                className={`px-6 py-2.5 rounded-xl ${theme.primaryBg} text-white text-sm font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer`}
              >
                <span>Proceed to E-Signature</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold border border-slate-300 transition-colors cursor-pointer"
                >
                  Review Terms Again
                </button>
                
                <button
                  type="button"
                  disabled={!termsAccepted || (signMode === 'draw' && !hasDrawn) || isSubmitting}
                  onClick={handleExecuteSignature}
                  className={`px-6 py-2.5 rounded-xl ${theme.primaryBg} disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmitting ? 'Executing Agreement...' : 'Sign & Complete Agreement'}</span>
                </button>
              </>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
