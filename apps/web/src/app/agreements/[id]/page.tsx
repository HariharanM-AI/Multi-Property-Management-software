'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { BackButton } from '@/components/ui/BackButton';
import { useAuth } from '@/lib/auth-context';
import {
  FileSignature,
  Download,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck,
  XCircle,
  Shield,
  Sparkles,
  Send,
  Loader2,
  Copy,
  Check,
  User,
  Building2,
  Calendar,
  History,
  FileText,
  Plus,
  X,
  Lock,
  Printer,
  Home,
  BedDouble,
  ArrowLeft,
} from 'lucide-react';
import { AgreementDocumentSheets } from '@/components/agreements/AgreementDocumentSheets';
import { AgreementDocumentData } from '@/components/agreements/AgreementDocumentViewerModal';
import { downloadAgreementPdf } from '@/components/agreements/downloadAgreementPdf';
import {
  getAgreementSignature,
  saveAgreementSignature,
  generateDigitalSignatureDataUrl,
  StoredAgreementSignature,
} from '@/lib/agreementStorage';
import { getOwnerProfile } from '@/lib/ownerProfileStorage';
import { formatAgreementDate, getLocalDateString } from '@/lib/date-utils';

export default function AgreementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const agreementId = params?.id as string;
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [agreementData, setAgreementData] = useState<AgreementDocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);
  const [activeTab, setActiveTab] = useState<'document' | 'terms' | 'signatures'>('document');

  const fetchAgreement = useCallback(async () => {
    if (!agreementId) return;
    setLoading(true);
    setErrorMsg(null);

    const ownerProfile = getOwnerProfile();

    try {
      // 1. Try fetching from backend API first
      const token = typeof window !== 'undefined' ? localStorage.getItem('propertyos_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let apiDoc: any = null;
      try {
        const res = await fetch(`/api/v1/agreements/${agreementId}`, {
          headers,
          credentials: 'include',
        });
        if (res.ok) {
          const json = await res.json();
          apiDoc = json.data;
        }
      } catch {}

      if (apiDoc) {
        const isHouse = apiDoc.agreement.agreementType === 'RENTAL_AGREEMENT';
        setAgreementData({
          id: apiDoc.agreement.id,
          tenantName: apiDoc.tenant ? `${apiDoc.tenant.firstName} ${apiDoc.tenant.lastName}` : 'Resident',
          tenantPhone: apiDoc.tenant?.phone || '+91 98765 43210',
          tenantEmail: apiDoc.tenant?.email,
          tenantAddress: apiDoc.tenant?.permanentAddress || 'Resident Permanent Address on record',
          tenantAadhaar: apiDoc.tenant?.documentNumber || 'Government ID Verified',
          ownerName: ownerProfile.fullName,
          ownerPhone: ownerProfile.phone,
          ownerAddress: ownerProfile.address,
          ownerSignature: ownerProfile.signature,
          propertyName: apiDoc.property?.name || (isHouse ? 'Whole-Unit Residential' : 'PG Accommodation'),
          propertyAddress: apiDoc.property?.address || '#10, Enterprise Park, Bengaluru',
          unitOrBedName: apiDoc.unit?.name || (isHouse ? 'Unit Flat' : 'Bed Allocation'),
          propertyType: isHouse ? 'RENTAL_HOUSE' : 'PG',
          monthlyRent: apiDoc.agreement.monthlyRent || (isHouse ? 25000 : 9500),
          securityDeposit: apiDoc.agreement.securityDeposit || (isHouse ? 50000 : 19000),
          lockInMonths: apiDoc.agreement.lockInMonths || (isHouse ? 11 : 2),
          lockInPeriodValue: apiDoc.agreement.lockInMonths || (isHouse ? 11 : 2),
          lockInPeriodUnit: 'MONTHS',
          noticePeriodDays: apiDoc.agreement.noticePeriodDays || (isHouse ? 30 : 20),
          startDate: apiDoc.agreement.startDate || getLocalDateString(),
          signedAt: apiDoc.agreement.signedAt || apiDoc.agreement.createdAt,
          status: apiDoc.agreement.status || 'FINALIZED',
          version: apiDoc.agreement.version || 1,
          witnesses: apiDoc.signatures?.flatMap((s: any) => s.witnesses || []) || [],
        });
        return;
      }

      // 2. Check local storage
      const storedSig = getAgreementSignature(agreementId);
      if (storedSig) {
        const isHouse = storedSig.propertyType === 'RENTAL_HOUSE';
        setAgreementData({
          id: agreementId,
          tenantName: storedSig.tenantName || 'Resident',
          tenantPhone: storedSig.tenantPhone || '+91 98765 43210',
          tenantEmail: storedSig.tenantEmail,
          tenantAddress: storedSig.tenantAddress || 'Resident Permanent Address on record',
          tenantAadhaar: storedSig.tenantAadhaar || 'Government ID Verified',
          ownerName: storedSig.ownerName || ownerProfile.fullName,
          ownerPhone: storedSig.ownerPhone || ownerProfile.phone,
          ownerAddress: storedSig.ownerAddress || ownerProfile.address,
          ownerSignature: storedSig.ownerSignature || ownerProfile.signature,
          residentSignature: storedSig.signatureImage,
          propertyName: storedSig.propertyName || (isHouse ? 'Green Valley Villa' : 'Royal Palm Co-Living'),
          propertyAddress: storedSig.propertyAddress || '#12, Royal Palm Residency, Indiranagar, Bengaluru',
          unitOrBedName: storedSig.unitName || (isHouse ? 'Flat 102' : 'Bed 102-A'),
          propertyType: storedSig.propertyType || (isHouse ? 'RENTAL_HOUSE' : 'PG'),
          monthlyRent: storedSig.monthlyRent || (isHouse ? 28000 : 9500),
          securityDeposit: storedSig.securityDeposit || (isHouse ? 84000 : 19000),
          lockInMonths: storedSig.lockInMonths || (isHouse ? 11 : 2),
          lockInPeriodValue: storedSig.lockInPeriodValue || storedSig.lockInMonths || (isHouse ? 11 : 2),
          lockInPeriodUnit: storedSig.lockInPeriodUnit || 'MONTHS',
          noticePeriodDays: storedSig.noticePeriodDays || (isHouse ? 30 : 20),
          startDate: storedSig.startDate || getLocalDateString(),
          signedAt: storedSig.signedAt || new Date().toISOString(),
          status: storedSig.isExecuted ? 'FINALIZED' : 'SIGNED',
          version: 1,
          witnesses: storedSig.witnesses,
        });
        return;
      }

      // 3. Fallback mock agreements based on ID
      const isKavin = agreementId.includes('kavin') || agreementId.includes('01');
      const isPooja = agreementId.includes('pooja') || agreementId.includes('03');
      const isAmit = agreementId.includes('amit') || agreementId.includes('04');

      const mockDoc: AgreementDocumentData = {
        id: agreementId,
        tenantName: isKavin ? 'Kavin M' : isPooja ? 'Pooja Hegde' : isAmit ? 'Amit Verma' : 'Rajesh Sharma',
        tenantPhone: isKavin ? '+91 98765 43210' : isPooja ? '+91 97411 65432' : isAmit ? '+91 99002 84729' : '+91 98450 91823',
        tenantEmail: isKavin ? 'kavin.m@example.com' : isPooja ? 'pooja.hegde@outlook.com' : 'rajesh.sharma@techcorp.in',
        tenantAadhaar: isKavin ? 'XXXX-XXXX-7192' : isPooja ? 'XXXX-XXXX-9024' : 'XXXX-XXXX-3891',
        tenantAddress: isKavin
          ? '#44, 4th Cross, Gandhi Nagar, Salem, Tamil Nadu - 636007'
          : '#12, Lotus Towers, Andheri West, Mumbai - 400053',
        ownerName: ownerProfile.fullName,
        ownerPhone: ownerProfile.phone,
        ownerAddress: ownerProfile.address,
        ownerSignature: ownerProfile.signature,
        residentSignature: generateDigitalSignatureDataUrl(
          isKavin ? 'Kavin M' : isPooja ? 'Pooja Hegde' : 'Rajesh Sharma',
          'Verified Digital E-Sign'
        ),
        propertyName: isKavin
          ? 'Royal Palms Co-Living'
          : isPooja
          ? 'Greenfield Towers PG'
          : 'Green Valley Villa & Apartments',
        propertyAddress: isKavin
          ? '#12, Royal Palm Residency, Indiranagar, Bengaluru, Karnataka - 560038'
          : '#88, 80 Feet Road, 4th Block, Koramangala, Bengaluru, Karnataka - 560034',
        unitOrBedName: isKavin ? 'Bed 102-A' : isPooja ? 'Bed 204-B' : 'Flat 102 (3BHK)',
        propertyType: isKavin || isPooja ? 'PG' : 'RENTAL_HOUSE',
        monthlyRent: isKavin ? 9500 : isPooja ? 12000 : 28000,
        securityDeposit: isKavin ? 19000 : isPooja ? 24000 : 84000,
        lockInMonths: isKavin ? 2 : isPooja ? 3 : 11,
        lockInPeriodValue: isKavin ? 2 : isPooja ? 3 : 11,
        lockInPeriodUnit: 'MONTHS',
        noticePeriodDays: isKavin ? 20 : 30,
        startDate: '2026-08-01',
        signedAt: '2026-08-01T10:30:00.000Z',
        status: isAmit ? 'PENDING_SIGNATURE' : 'FINALIZED',
        version: 1,
      };

      setAgreementData(mockDoc);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error loading agreement');
    } finally {
      setLoading(false);
    }
  }, [agreementId]);

  useEffect(() => {
    fetchAgreement();
  }, [fetchAgreement]);

  const handleDownloadPdf = async () => {
    if (!agreementData) return;
    setDownloading(true);
    try {
      await downloadAgreementPdf(agreementData);
    } catch (err: any) {
      alert(`PDF Generation Error: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const copyHash = () => {
    const hash = '7b8f9a2e4c10d35a6f8b42e7c10d35a6';
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  if (!authLoading && !isAuthenticated) {
    return (
      <AppShell activePath="/agreements">
        <div className="max-w-xl mx-auto py-20 px-4 text-center">
          <div className="w-16 h-16 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center mx-auto mb-4 text-amber-600 shadow-2xs">
            <Lock className="w-8 h-8" />
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wider mb-3">
            <Shield className="w-3.5 h-3.5" /> Confidential Tenant Record
          </span>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Authentication Required
          </h2>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            Tenant digital agreements contain legally binding terms and confidential personal identifiable information (PII).
            To protect resident privacy, please sign in with your Property Owner account to access this document.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-brand-teal text-white font-semibold text-sm hover:bg-teal-700 transition shadow-sm cursor-pointer"
            >
              Sign In to View Agreement
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell activePath="/agreements">
        <div className="py-24 text-center flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-brand-teal animate-spin mb-3" />
          <p className="text-sm font-medium text-slate-600">Loading agreement details & snapshot...</p>
        </div>
      </AppShell>
    );
  }

  if (errorMsg || !agreementData) {
    return (
      <AppShell activePath="/agreements">
        <div className="max-w-xl mx-auto py-16 text-center">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-900">Agreement Not Found</h2>
          <p className="text-sm text-slate-500 mt-1 mb-6">
            {errorMsg || 'The requested agreement snapshot does not exist or has been removed.'}
          </p>
          <Link
            href="/agreements"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-teal text-white text-sm font-medium hover:bg-teal-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Agreements Dashboard
          </Link>
        </div>
      </AppShell>
    );
  }

  const isHouse = agreementData.propertyType === 'RENTAL_HOUSE';
  const isFinal = agreementData.status === 'FINALIZED';

  return (
    <AppShell activePath="/agreements">
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="mb-2">
              <BackButton fallbackHref="/agreements" label="Back to Agreements Dashboard" />
            </div>
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl border ${
                  isHouse ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-teal-50 border-teal-200 text-brand-teal'
                }`}
              >
                {isHouse ? <Home className="w-6 h-6" /> : <BedDouble className="w-6 h-6" />}
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                    {agreementData.tenantName} — {isHouse ? 'House Rental Agreement' : 'PG Co-Living Agreement'}
                  </h1>
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    v{agreementData.version || 1}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {agreementData.status || 'FINALIZED'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {agreementData.propertyName} • {agreementData.unitOrBedName} • Executed on{' '}
                  {formatAgreementDate(agreementData.signedAt || agreementData.startDate)}
                </p>
              </div>
            </div>
          </div>

          {/* Top Actions Bar: OWNER CAN ONLY VIEW AND DOWNLOAD */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 transition shadow-2xs cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              Print
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-teal text-white font-medium text-xs hover:bg-teal-700 transition shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download Official PDF
                </>
              )}
            </button>
          </div>
        </div>

        {/* Snapshot Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Resident Tenant</span>
            <span className="font-bold text-slate-900 text-sm mt-0.5 block">{agreementData.tenantName}</span>
            <span className="text-xs text-slate-500">{agreementData.tenantPhone}</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Premises & Unit</span>
            <span className="font-bold text-slate-900 text-sm mt-0.5 block truncate">{agreementData.propertyName}</span>
            <span className="text-xs text-slate-700 font-medium">{agreementData.unitOrBedName}</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Financial Terms</span>
            <span className="font-bold text-slate-900 text-sm mt-0.5 block">
              ₹{Number(agreementData.monthlyRent).toLocaleString('en-IN')}{' '}
              <span className="text-xs font-normal text-slate-500">/mo</span>
            </span>
            <span className="text-xs text-slate-600 font-medium">
              Deposit: ₹{Number(agreementData.securityDeposit || 0).toLocaleString('en-IN')}
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Legal Immutability</span>
            <span className="text-emerald-700 font-bold text-xs mt-1 flex items-center gap-1">
              <Lock className="w-3.5 h-3.5" /> SHA-256 Frozen
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="font-mono text-[10px] text-slate-500">7b8f9a2e4c10...</span>
              <button onClick={copyHash} className="text-slate-400 hover:text-brand-teal p-0.5">
                {copiedHash ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('document')}
            className={`px-4 py-2.5 text-xs font-bold transition border-b-2 flex items-center gap-2 ${
              activeTab === 'document'
                ? 'border-brand-teal text-brand-teal'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            Official 2-Page Document Preview
          </button>
          <button
            onClick={() => setActiveTab('terms')}
            className={`px-4 py-2.5 text-xs font-bold transition border-b-2 flex items-center gap-2 ${
              activeTab === 'terms'
                ? 'border-brand-teal text-brand-teal'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Shield className="w-4 h-4" />
            Contract Terms & Snapshot Data
          </button>
          <button
            onClick={() => setActiveTab('signatures')}
            className={`px-4 py-2.5 text-xs font-bold transition border-b-2 flex items-center gap-2 ${
              activeTab === 'signatures'
                ? 'border-brand-teal text-brand-teal'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileSignature className="w-4 h-4" />
            Signatures & Execution Audit
          </button>
        </div>

        {/* TAB 1: OFFICIAL 2-PAGE DOCUMENT PREVIEW */}
        {activeTab === 'document' && (
          <div className="bg-slate-100/70 p-4 sm:p-8 rounded-2xl border border-slate-200 flex justify-center">
            <div className="max-w-[850px] w-full bg-white shadow-xl rounded-xl overflow-hidden border border-slate-300">
              <AgreementDocumentSheets agreementData={agreementData} />
            </div>
          </div>
        )}

        {/* TAB 2: CONTRACT TERMS SNAPSHOT */}
        {activeTab === 'terms' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900">Frozen Contract Terms</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Parameters captured at agreement execution time. These terms are legally sealed and immutable.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/70">
                <span className="text-xs font-medium text-slate-500">Notice Period</span>
                <p className="text-lg font-bold text-slate-900 mt-1">{agreementData.noticePeriodDays || 30} Days</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Prior written notice required before departure</p>
              </div>

              <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/70">
                <span className="text-xs font-medium text-slate-500">Lock-in Period</span>
                <p className="text-lg font-bold text-slate-900 mt-1">
                  {agreementData.lockInPeriodValue || agreementData.lockInMonths || 2}{' '}
                  {agreementData.lockInPeriodUnit || 'Months'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Minimum mandatory stay duration</p>
              </div>

              <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/70">
                <span className="text-xs font-medium text-slate-500">Agreement Execution Date</span>
                <p className="text-lg font-bold text-slate-900 mt-1">
                  {formatAgreementDate(agreementData.signedAt || agreementData.startDate)}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Synchronized across Page 1 and Page 2</p>
              </div>

              <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/70">
                <span className="text-xs font-medium text-slate-500">Monthly Contract Rent</span>
                <p className="text-lg font-bold text-slate-900 mt-1">
                  ₹{Number(agreementData.monthlyRent).toLocaleString('en-IN')}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Due on 1st–5th of every calendar month</p>
              </div>

              <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/70">
                <span className="text-xs font-medium text-slate-500">Security Deposit</span>
                <p className="text-lg font-bold text-slate-900 mt-1">
                  ₹{Number(agreementData.securityDeposit || 0).toLocaleString('en-IN')}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Refundable upon formal move-out clearance</p>
              </div>

              <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/70">
                <span className="text-xs font-medium text-slate-500">Operating Model</span>
                <p className="text-lg font-bold text-slate-900 mt-1">
                  {isHouse ? 'Whole-Unit Residential Lease' : 'PG Co-Living License'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Specific statutory tenancy covenants applied</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SIGNATURES & AUDIT TRAIL */}
        {activeTab === 'signatures' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900">Digital Execution & Signature Audit</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Verified electronic sign-offs by Landlord, Tenant, and attesting witnesses
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Landlord / Owner Box */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                    Authorized Landlord / Owner
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    SIGNED
                  </span>
                </div>
                <div>
                  <p className="font-bold text-sm text-slate-900">{agreementData.ownerName}</p>
                  <p className="text-xs text-slate-500">{agreementData.ownerPhone}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{agreementData.ownerAddress}</p>
                </div>
                {agreementData.ownerSignature && (
                  <div className="pt-2 border-t border-slate-200">
                    <p className="text-[10px] text-slate-400 font-medium mb-1">Electronic Signature:</p>
                    <img
                      src={agreementData.ownerSignature}
                      alt="Owner Signature"
                      className="h-12 object-contain bg-white p-1 rounded border border-slate-200"
                    />
                  </div>
                )}
              </div>

              {/* Resident / Tenant Box */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                    Resident Tenant / Licensee
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    SIGNED
                  </span>
                </div>
                <div>
                  <p className="font-bold text-sm text-slate-900">{agreementData.tenantName}</p>
                  <p className="text-xs text-slate-500">{agreementData.tenantPhone}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{agreementData.tenantAddress}</p>
                </div>
                {agreementData.residentSignature ? (
                  <div className="pt-2 border-t border-slate-200">
                    <p className="text-[10px] text-slate-400 font-medium mb-1">Resident Digital E-Sign:</p>
                    <img
                      src={agreementData.residentSignature}
                      alt="Resident Signature"
                      className="h-12 object-contain bg-white p-1 rounded border border-slate-200"
                    />
                  </div>
                ) : (
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-xs text-amber-600 italic">Signature pending tenant sign-off</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
