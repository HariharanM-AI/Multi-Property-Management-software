'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/lib/auth-context';
import {
  AgreementDetailsDto,
  AgreementStatus,
  AgreementSignerType,
  SignatureStatus,
  UserRole,
} from '@propertyos/types';
import {
  ArrowLeft,
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
  Building,
  Calendar,
  History,
  FileText,
  Plus,
  X,
  Lock,
} from 'lucide-react';

export default function AgreementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const agreementId = params?.id as string;
  const { user } = useAuth();

  const [details, setDetails] = useState<AgreementDetailsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);

  // Sign Modal State
  const [showSignModal, setShowSignModal] = useState(false);
  const [signerType, setSignerType] = useState<AgreementSignerType>(AgreementSignerType.PROPERTY_MANAGER);
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [signConsent, setSignConsent] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);

  // Cancel Modal State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const fetchAgreement = useCallback(async () => {
    if (!agreementId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('propertyos_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/agreements/${agreementId}`, {
        headers,
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Failed to load agreement details');
      }

      const json = await res.json();
      setDetails(json.data || null);
      if (user) {
        setSignerName(`${user.firstName} ${user.lastName}`);
        setSignerEmail(user.email || '');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error loading agreement');
    } finally {
      setLoading(false);
    }
  }, [agreementId, user]);

  useEffect(() => {
    fetchAgreement();
  }, [fetchAgreement]);

  const handleGenerate = async () => {
    setActionLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('propertyos_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/agreements/${agreementId}/generate`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || 'Failed to generate agreement');
      }

      fetchAgreement();
    } catch (err: any) {
      alert(`Generation Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendForSignature = async () => {
    setActionLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('propertyos_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/agreements/${agreementId}/send-for-signature`, {
        method: 'POST',
        headers,
        credentials: 'include',
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || 'Failed to send for signature');
      }

      fetchAgreement();
    } catch (err: any) {
      alert(`Send Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signConsent) {
      setSignError('You must confirm acceptance to digitally sign');
      return;
    }

    setActionLoading(true);
    setSignError(null);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('propertyos_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/agreements/${agreementId}/sign`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          signerType,
          signerName,
          signerEmail: signerEmail || undefined,
          signatureData: 'ACCEPTED_DIGITALLY',
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to record signature');
      }

      setShowSignModal(false);
      fetchAgreement();
    } catch (err: any) {
      setSignError(err.message || 'Error signing agreement');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinalize = async () => {
    if (!confirm('Are you sure you want to finalize this agreement? Once finalized, the document is permanently frozen and immutable.')) {
      return;
    }

    setActionLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('propertyos_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/agreements/${agreementId}/finalize`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || 'Failed to finalize agreement');
      }

      fetchAgreement();
    } catch (err: any) {
      alert(`Finalization Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('propertyos_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/agreements/${agreementId}/cancel`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ reason: cancelReason }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || 'Failed to cancel agreement');
      }

      setShowCancelModal(false);
      fetchAgreement();
    } catch (err: any) {
      alert(`Cancellation Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateNewVersion = async () => {
    if (!confirm('Create a new version (v' + ((details?.agreement.version || 1) + 1) + ') branching from this agreement?')) {
      return;
    }

    setActionLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('propertyos_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/agreements/${agreementId}/new-version`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({}),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to create new version');
      }

      if (json.data?.id) {
        router.push(`/agreements/${json.data.id}`);
      }
    } catch (err: any) {
      alert(`Error creating new version: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const copyHash = () => {
    if (details?.agreement.contentHash) {
      navigator.clipboard.writeText(details.agreement.contentHash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  if (loading) {
    return (
      <AppShell activePath="/agreements">
        <div className="py-24 text-center flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-brand-teal animate-spin mb-3" />
          <p className="text-sm font-medium text-slate-600">Loading agreement details...</p>
        </div>
      </AppShell>
    );
  }

  if (errorMsg || !details) {
    return (
      <AppShell activePath="/agreements">
        <div className="max-w-xl mx-auto py-16 text-center">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-900">Agreement Not Found</h2>
          <p className="text-sm text-slate-500 mt-1 mb-6">
            {errorMsg || 'The requested agreement does not exist or has been deleted.'}
          </p>
          <Link
            href="/agreements"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-teal text-white text-sm font-medium hover:bg-teal-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Agreements
          </Link>
        </div>
      </AppShell>
    );
  }

  const { agreement, tenant, property, signatures, template } = details;

  return (
    <AppShell activePath="/agreements">
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/agreements"
              className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition shadow-sm"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-slate-900">
                  {agreement.agreementType.replace(/_/g, ' ')}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  v{agreement.version}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {agreement.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Agreement ID: {agreement.id} • Created on {new Date(agreement.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Top Actions Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {agreement.status === AgreementStatus.DRAFT && (
              <>
                <button
                  onClick={handleGenerate}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-teal text-white font-medium text-sm hover:bg-teal-700 transition shadow-sm disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate Document
                </button>
                <button
                  onClick={() => setShowCancelModal(true)}
                  disabled={actionLoading}
                  className="px-3 py-2 rounded-lg border border-rose-200 text-rose-600 text-sm font-medium hover:bg-rose-50 transition"
                >
                  Cancel
                </button>
              </>
            )}

            {agreement.status === AgreementStatus.GENERATED && (
              <>
                <button
                  onClick={handleSendForSignature}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  Send for Signature
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={actionLoading}
                  className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition"
                >
                  Regenerate
                </button>
                <button
                  onClick={() => setShowCancelModal(true)}
                  disabled={actionLoading}
                  className="px-3 py-2 rounded-lg border border-rose-200 text-rose-600 text-sm font-medium hover:bg-rose-50 transition"
                >
                  Cancel
                </button>
              </>
            )}

            {(agreement.status === AgreementStatus.PENDING_SIGNATURE ||
              agreement.status === AgreementStatus.PARTIALLY_SIGNED) && (
              <>
                <button
                  onClick={() => setShowSignModal(true)}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 transition shadow-sm disabled:opacity-50"
                >
                  <FileCheck className="w-4 h-4" />
                  Sign Agreement
                </button>
                <button
                  onClick={() => setShowCancelModal(true)}
                  disabled={actionLoading}
                  className="px-3 py-2 rounded-lg border border-rose-200 text-rose-600 text-sm font-medium hover:bg-rose-50 transition"
                >
                  Cancel
                </button>
              </>
            )}

            {agreement.status === AgreementStatus.SIGNED && (
              <button
                onClick={handleFinalize}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 transition shadow-sm disabled:opacity-50"
              >
                <Lock className="w-4 h-4" />
                Finalize Agreement
              </button>
            )}

            {(agreement.status === AgreementStatus.FINALIZED ||
              agreement.status === AgreementStatus.CANCELLED) && (
              <button
                onClick={handleCreateNewVersion}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-teal text-white font-medium text-sm hover:bg-teal-700 transition shadow-sm disabled:opacity-50"
              >
                <History className="w-4 h-4" />
                Create New Version (v{agreement.version + 1})
              </button>
            )}

            {agreement.documentPath && (
              <a
                href={agreement.documentPath}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition shadow-sm"
              >
                <Download className="w-4 h-4 text-slate-500" />
                Download PDF
              </a>
            )}
          </div>
        </div>

        {/* Top Info Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
              <User className="w-4 h-4 text-brand-teal" />
              Tenant Party
            </div>
            <Link href={`/tenants/${tenant.id}`} className="font-bold text-slate-900 text-sm hover:text-brand-teal">
              {tenant.firstName} {tenant.lastName}
            </Link>
            <p className="text-xs text-slate-500 mt-0.5">{tenant.phone} • {tenant.email || 'No email'}</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
              <Building className="w-4 h-4 text-brand-teal" />
              Property & Premises
            </div>
            <Link href={`/properties/${property.id}`} className="font-bold text-slate-900 text-sm hover:text-brand-teal">
              {property.name}
            </Link>
            <p className="text-xs text-slate-500 mt-0.5">{property.address}, {property.city}</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
              <Shield className="w-4 h-4 text-brand-teal" />
              Document Snapshot Integrity
            </div>
            {agreement.contentHash ? (
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-700 bg-slate-50 px-1.5 py-0.5 rounded">
                    {agreement.contentHash.substring(0, 18)}...
                  </span>
                  <button onClick={copyHash} className="text-slate-400 hover:text-brand-teal p-1">
                    {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3 h-3" /> SHA-256 Verified
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Not yet generated</p>
            )}
          </div>
        </div>

        {/* Main Content: Rendered Agreement Document & Signatures */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Document Preview (2 Cols) */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand-teal" />
                <h3 className="font-bold text-slate-900 text-base">Rendered Agreement Snapshot</h3>
              </div>
              {agreement.templateVersion && (
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  Template Version: v{agreement.templateVersion}
                </span>
              )}
            </div>

            {agreement.renderedContent ? (
              <div className="bg-slate-50/70 p-6 rounded-xl border border-slate-200/80 font-sans text-xs text-slate-800 leading-relaxed whitespace-pre-wrap selection:bg-teal-100">
                {agreement.renderedContent}
              </div>
            ) : (
              <div className="py-20 text-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <Sparkles className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-medium text-slate-600">Document Has Not Been Generated</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Click 'Generate Document' to evaluate placeholders and produce the authoritative snapshot.
                </p>
              </div>
            )}
          </div>

          {/* Signatures & Execution Timeline (1 Col) */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h3 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
                <FileSignature className="w-4 h-4 text-brand-teal" />
                Digital Signatures & Sign-offs
              </h3>

              <div className="space-y-3">
                {signatures.map((sig, idx) => (
                  <div key={sig.id || idx} className="p-3 rounded-xl border border-slate-100 bg-slate-50/60">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-slate-800">{sig.signerName}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          sig.status === SignatureStatus.SIGNED
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {sig.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{sig.signerType}</p>
                    {sig.signedAt && (
                      <p className="text-[10px] text-slate-400 mt-1">
                        Signed: {new Date(sig.signedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Version Lineage Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h3 className="font-bold text-slate-900 text-sm mb-2 flex items-center gap-2">
                <History className="w-4 h-4 text-brand-teal" />
                Version Lineage
              </h3>
              <p className="text-xs text-slate-500">
                Current Version: <span className="font-bold text-slate-800">Version {agreement.version}</span>
              </p>
              {agreement.previousAgreementId && (
                <Link
                  href={`/agreements/${agreement.previousAgreementId}`}
                  className="mt-2 text-xs text-brand-teal hover:underline flex items-center gap-1 font-medium"
                >
                  View Previous Version &rarr;
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Digital Sign Modal */}
        {showSignModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">Digital Signature</h3>
                    <p className="text-xs text-slate-500">Execute verified sign-off for agreement</p>
                  </div>
                </div>
                <button onClick={() => setShowSignModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {signError && (
                <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{signError}</span>
                </div>
              )}

              <form onSubmit={handleSign} className="space-y-4 mt-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Signer Role</label>
                  <select
                    value={signerType}
                    onChange={(e) => setSignerType(e.target.value as AgreementSignerType)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
                  >
                    <option value={AgreementSignerType.PROPERTY_MANAGER}>PROPERTY MANAGER</option>
                    <option value={AgreementSignerType.OWNER}>OWNER</option>
                    <option value={AgreementSignerType.TENANT}>TENANT</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Signer Full Name</label>
                  <input
                    type="text"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Signer Email</label>
                  <input
                    type="email"
                    value={signerEmail}
                    onChange={(e) => setSignerEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                  />
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <p className="text-[11px] font-semibold text-slate-700">SHA-256 Fingerprint Confirmation:</p>
                  <p className="text-[10px] font-mono text-slate-500 break-all">{agreement.contentHash}</p>
                </div>

                <label className="flex items-start gap-2 pt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={signConsent}
                    onChange={(e) => setSignConsent(e.target.checked)}
                    className="mt-0.5 rounded text-brand-teal focus:ring-brand-teal"
                  />
                  <span className="text-slate-600 text-[11px] leading-tight">
                    I acknowledge that I have reviewed the agreement snapshot content and hereby record my digital signature and acceptance.
                  </span>
                </label>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowSignModal(false)}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition disabled:opacity-50"
                  >
                    Confirm & Sign
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Cancel Modal */}
        {showCancelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
              <h3 className="font-bold text-slate-900 text-lg mb-2">Cancel Agreement</h3>
              <p className="text-xs text-slate-500 mb-4">
                Are you sure you want to cancel this agreement? This action cannot be undone.
              </p>
              <form onSubmit={handleCancel} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cancellation Reason</label>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Enter reason for cancelling agreement..."
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCancelModal(false)}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600"
                  >
                    Keep Agreement
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-lg bg-rose-600 text-white font-medium hover:bg-rose-700"
                  >
                    Confirm Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
