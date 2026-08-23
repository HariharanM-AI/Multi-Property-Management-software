'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/lib/auth-context';
import {
  TenantDetailsDto,
  TenantStatus,
  KycDocumentType,
  KycVerificationStatus,
} from '@propertyos/types';
import {
  ArrowLeft,
  Users,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  UploadCloud,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Building,
  GraduationCap,
  Briefcase,
  AlertTriangle,
  FileCheck,
  XCircle,
  Loader2,
  Plus,
  X,
  UserMinus,
  ExternalLink,
  FileSignature,
  ReceiptText,
  CircleDollarSign,
  Shield,
  Zap,
  UtensilsCrossed,
  Wrench,
} from 'lucide-react';

export default function TenantDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params?.id as string;
  const { user } = useAuth();

  const [details, setDetails] = useState<TenantDetailsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState<KycDocumentType>(KycDocumentType.AADHAAR);
  const [docNumber, setDocNumber] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Reject Modal
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Archive Action
  const [archiving, setArchiving] = useState(false);

  // Digital Agreements
  const [tenantAgreements, setTenantAgreements] = useState<any[]>([]);

  // Financial Summary
  const [financialSummary, setFinancialSummary] = useState<any | null>(null);

  // Electricity & Meals Summaries (CORE-012)
  const [elecSummary, setElecSummary] = useState<any | null>(null);
  const [mealSummary, setMealSummary] = useState<any | null>(null);

  // Maintenance Summary (CORE-013)
  const [maintSummary, setMaintSummary] = useState<any | null>(null);

  const fetchTenantDetails = useCallback(async () => {
    if (!tenantId) return;
    try {
      setLoading(true);
      setErrorMsg(null);
      const token = localStorage.getItem('propertyos_token');
      const [res, agrRes, finRes, elecRes, mealRes, maintRes] = await Promise.all([
        fetch(`/api/v1/tenants/${tenantId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/v1/tenants/${tenantId}/agreements`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/v1/financials/tenant/${tenantId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/v1/tenants/${tenantId}/electricity/summary`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/v1/tenants/${tenantId}/meals/summary`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/v1/tenants/${tenantId}/maintenance/summary`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!res.ok) {
        throw new Error('Tenant profile not found or access denied');
      }
      const json = await res.json();
      setDetails(json.data);

      if (agrRes.ok) {
        const agrJson = await agrRes.json();
        setTenantAgreements(agrJson.agreements || []);
      }

      if (finRes.ok) {
        const finJson = await finRes.json();
        if (finJson.data) setFinancialSummary(finJson.data);
      }

      if (elecRes.ok) {
        const eJson = await elecRes.json();
        if (eJson.data || eJson) setElecSummary(eJson.data || eJson);
      }

      if (mealRes.ok) {
        const mJson = await mealRes.json();
        if (mJson.data || mJson) setMealSummary(mJson.data || mJson);
      }

      if (maintRes.ok) {
        const mntJson = await maintRes.json();
        if (mntJson.data || mntJson) setMaintSummary(mntJson.data || mntJson);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load tenant details');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchTenantDetails();
  }, [fetchTenantDetails]);

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('Please select a file to upload');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('documentType', docType);
      if (docNumber.trim()) {
        formData.append('documentNumber', docNumber.trim());
      }

      const res = await fetch(`/api/v1/tenants/${tenantId}/documents`, {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to upload document');
      }

      setShowUploadModal(false);
      setSelectedFile(null);
      setDocNumber('');
      fetchTenantDetails();
    } catch (err: any) {
      alert(err.message || 'Upload error');
    } finally {
      setUploading(false);
    }
  };

  const handleVerifyStatus = async (
    docId: string,
    status: KycVerificationStatus,
    reason?: string
  ) => {
    try {
      setVerifying(true);
      const res = await fetch(`/api/v1/tenants/${tenantId}/documents/${docId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          rejectionReason: reason || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Verification update failed');
      }

      setRejectingDocId(null);
      setRejectionReason('');
      fetchTenantDetails();
    } catch (err: any) {
      alert(err.message || 'Verification error');
    } finally {
      setVerifying(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('Are you sure you want to permanently delete this KYC document?')) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/tenants/${tenantId}/documents/${docId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to delete document');
      }
      fetchTenantDetails();
    } catch (err: any) {
      alert(err.message || 'Delete error');
    }
  };

  const handleArchiveTenant = async () => {
    if (
      !confirm(
        'Are you sure you want to archive/delete this tenant profile? This action will hide the profile from active listings.'
      )
    ) {
      return;
    }

    try {
      setArchiving(true);
      const res = await fetch(`/api/v1/tenants/${tenantId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to archive tenant');
      }
      alert('Tenant profile archived successfully.');
      router.push('/tenants');
    } catch (err: any) {
      alert(err.message || 'Archive error');
    } finally {
      setArchiving(false);
    }
  };

  if (loading) {
    return (
      <AppShell activePath="/tenants">
        <div className="py-24 text-center flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-brand-teal animate-spin mb-3" />
          <p className="text-sm font-medium text-slate-600">Loading tenant details...</p>
        </div>
      </AppShell>
    );
  }

  if (errorMsg || !details) {
    return (
      <AppShell activePath="/tenants">
        <div className="max-w-xl mx-auto py-16 text-center">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-900">Tenant Not Found</h2>
          <p className="text-sm text-slate-500 mt-1 mb-6">
            {errorMsg || 'The requested tenant profile does not exist or has been deleted.'}
          </p>
          <Link
            href="/tenants"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-teal text-white text-sm font-medium hover:bg-teal-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Tenants Directory
          </Link>
        </div>
      </AppShell>
    );
  }

  const { tenant, documents, stays, leases } = details;

  return (
    <AppShell activePath="/tenants">
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        {/* Navigation & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/tenants"
              className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900">
                  {tenant.firstName} {tenant.lastName}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {tenant.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Tenant ID: {tenant.id} • Registered on{' '}
                {new Date(tenant.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {tenant.status === TenantStatus.PROSPECT && (
              <Link
                href={`/check-ins`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                Digital Check-In
              </Link>
            )}
            {tenant.status === TenantStatus.ACTIVE && (
              <Link
                href={`/check-outs`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white font-medium text-sm hover:bg-teal-700 transition shadow-sm"
              >
                <UserMinus className="w-4 h-4" />
                Start Check-Out
              </Link>
            )}
            <button
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-teal text-white font-medium text-sm hover:bg-teal-700 transition shadow-sm"
            >
              <UploadCloud className="w-4 h-4" />
              Upload KYC Document
            </button>
            <button
              onClick={handleArchiveTenant}
              disabled={archiving}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-rose-200 text-rose-600 text-sm font-medium hover:bg-rose-50 transition disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Archive Profile
            </button>
          </div>
        </div>

        {/* 3-Column Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Personal & Contact Information */}
          <div className="space-y-6">
            {/* Contact Card */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-brand-teal" />
                Contact & Details
              </h2>

              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3 text-slate-700">
                  <Phone className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs text-slate-400">Mobile Phone</div>
                    <div className="font-semibold">{tenant.phone}</div>
                  </div>
                </div>

                <div className="flex items-start gap-3 text-slate-700">
                  <Mail className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs text-slate-400">Email Address</div>
                    <div className="font-medium">{tenant.email || 'Not provided'}</div>
                  </div>
                </div>

                <div className="flex items-start gap-3 text-slate-700">
                  <Clock className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs text-slate-400">Date of Birth</div>
                    <div className="font-medium">
                      {tenant.dateOfBirth
                        ? new Date(tenant.dateOfBirth).toLocaleDateString()
                        : 'Not provided'}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 text-slate-700">
                  <Briefcase className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs text-slate-400">Occupation</div>
                    <div className="font-medium">{tenant.occupation || 'Not specified'}</div>
                  </div>
                </div>

                <div className="flex items-start gap-3 text-slate-700">
                  <GraduationCap className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs text-slate-400">Employer / College</div>
                    <div className="font-medium">
                      {tenant.employerOrCollege || 'Not specified'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Permanent Address Card */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <MapPin className="w-4 h-4 text-brand-teal" />
                Permanent Address
              </h2>
              <div className="text-sm text-slate-700 space-y-1">
                <p className="font-medium text-slate-900">{tenant.permanentAddress}</p>
                <p>
                  {tenant.permanentCity}, {tenant.permanentState} - {tenant.permanentPostalCode}
                </p>
              </div>
            </div>

            {/* Emergency Contact Card */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Emergency Contact
              </h2>
              <div className="text-sm text-slate-700 space-y-2">
                <div>
                  <div className="text-xs text-slate-400">Contact Name</div>
                  <div className="font-semibold text-slate-900">
                    {tenant.emergencyContactName}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Phone Number</div>
                  <div className="font-medium text-slate-800">
                    {tenant.emergencyContactPhone}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Relationship</div>
                  <div className="font-medium text-slate-800">
                    {tenant.emergencyContactRelation}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Middle & Right Column: KYC Documents & Stay History */}
          <div className="lg:col-span-2 space-y-6">
            {/* KYC Documents Section */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-brand-teal" />
                    KYC Verification Documents
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Official identity proofs and government verification records
                  </p>
                </div>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 text-brand-teal font-semibold text-xs hover:bg-teal-100 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Document
                </button>
              </div>

              {documents.length === 0 ? (
                <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-xl">
                  <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No KYC documents uploaded</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Upload Aadhaar, PAN, Passport, or student ID for compliance
                  </p>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-teal text-white text-xs font-medium hover:bg-teal-700 transition"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    Upload First Document
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {documents.map((doc) => {
                    const isPending = doc.verificationStatus === KycVerificationStatus.PENDING;
                    const isVerified = doc.verificationStatus === KycVerificationStatus.VERIFIED;
                    const isRejected = doc.verificationStatus === KycVerificationStatus.REJECTED;

                    return (
                      <div
                        key={doc.id}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between space-y-3"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900">
                              {doc.documentType.replace('_', ' ')}
                            </span>
                            {isPending && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock className="w-3 h-3" />
                                Pending
                              </span>
                            )}
                            {isVerified && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                Verified
                              </span>
                            )}
                            {isRejected && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                <XCircle className="w-3 h-3" />
                                Rejected
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-slate-600 space-y-1">
                            {doc.documentNumber && (
                              <div className="font-medium text-slate-800">
                                Number: <span className="font-mono">{doc.documentNumber}</span>
                              </div>
                            )}
                            <div className="text-slate-500">File: {doc.originalFileName}</div>
                            <div className="text-slate-400">
                              {(doc.fileSize / 1024).toFixed(1)} KB • {doc.mimeType}
                            </div>
                            {isRejected && doc.rejectionReason && (
                              <div className="p-2 rounded bg-rose-50 text-rose-700 text-xs border border-rose-200 mt-1">
                                <strong>Reason:</strong> {doc.rejectionReason}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                          <a
                            href={doc.storagePath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-brand-teal hover:underline font-medium"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            View Document
                          </a>

                          <div className="flex items-center gap-1.5">
                            {isPending && (
                              <>
                                <button
                                  onClick={() =>
                                    handleVerifyStatus(doc.id, KycVerificationStatus.VERIFIED)
                                  }
                                  disabled={verifying}
                                  className="px-2.5 py-1 rounded bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition"
                                >
                                  Verify
                                </button>
                                <button
                                  onClick={() => setRejectingDocId(doc.id)}
                                  disabled={verifying}
                                  className="px-2.5 py-1 rounded bg-rose-50 text-rose-600 text-xs font-semibold hover:bg-rose-100 transition"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 transition"
                              title="Delete Document"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Whole-Unit Leases History */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Building className="w-5 h-5 text-brand-teal" />
                Whole-Unit Leases ({leases.length})
              </h2>

              {leases.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs">
                  No active or past whole-unit leases linked to this tenant profile.
                </div>
              ) : (
                <div className="space-y-3">
                  {leases.map((lease: any) => (
                    <div
                      key={lease.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-slate-900 text-sm">
                          Unit: {lease.rentalUnit?.unitNumber || 'N/A'} •{' '}
                          {lease.rentalUnit?.property?.name || 'Property'}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Period: {new Date(lease.startDate).toLocaleDateString()} to{' '}
                          {new Date(lease.endDate).toLocaleDateString()}
                        </div>
                        <div className="text-xs font-medium text-slate-700 mt-1">
                          Rent: ₹{lease.monthlyRent.toLocaleString('en-IN')}/mo • Deposit: ₹
                          {lease.securityDeposit.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {lease.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Digital Agreements */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileSignature className="w-5 h-5 text-brand-teal" />
                  Digital Agreements ({tenantAgreements.length})
                </h2>
                <Link
                  href="/agreements"
                  className="text-xs font-semibold text-brand-teal hover:underline flex items-center gap-1"
                >
                  Manage All &rarr;
                </Link>
              </div>

              {tenantAgreements.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs">
                  No digital agreements registered for this tenant.
                </div>
              ) : (
                <div className="space-y-3">
                  {tenantAgreements.map((agr: any) => (
                    <div
                      key={agr.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between"
                    >
                      <div>
                        <Link
                          href={`/agreements/${agr.id}`}
                          className="font-semibold text-slate-900 text-sm hover:text-brand-teal flex items-center gap-1.5"
                        >
                          {agr.agreementType.replace(/_/g, ' ')}
                          <span className="text-[11px] font-mono px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">
                            v{agr.version}
                          </span>
                        </Link>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Created: {new Date(agr.createdAt).toLocaleDateString()}
                          {agr.contentHash && ` • Hash: ${agr.contentHash.substring(0, 12)}...`}
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                        {agr.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Billing & Financial Overview */}
            {financialSummary && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <ReceiptText className="w-5 h-5 text-brand-teal" />
                    Billing & Financial Account
                  </h2>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/invoices?tenantId=${tenant.id}`}
                      className="text-xs font-semibold text-brand-teal hover:underline"
                    >
                      Invoices ({financialSummary.currentInvoiceCount})
                    </Link>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-500 block uppercase">Invoiced</span>
                    <span className="text-sm font-bold text-slate-900">
                      ₹{Number(financialSummary.totalInvoiced).toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-500 block uppercase">Paid</span>
                    <span className="text-sm font-bold text-emerald-600">
                      ₹{Number(financialSummary.totalPaid).toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-500 block uppercase">Balance Due</span>
                    <span className="text-sm font-bold text-amber-600">
                      ₹{Number(financialSummary.outstandingBalance).toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-500 block uppercase">Deposit Held</span>
                    <span className="text-sm font-bold text-purple-600">
                      ₹{Number(financialSummary.securityDepositHeld).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Electricity & Utility Allocation (CORE-012) */}
            {elecSummary && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-500" />
                    Electricity & Utility Allocation
                  </h2>
                  <Link
                    href="/electricity"
                    className="text-xs font-semibold text-brand-teal hover:underline"
                  >
                    View All Readings
                  </Link>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-500 block uppercase">Allocated Units</span>
                    <span className="text-sm font-bold text-slate-900">
                      {elecSummary.currentPeriodUnits} units
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-500 block uppercase">Allocated Charges</span>
                    <span className="text-sm font-bold text-amber-600">
                      ₹{Number(elecSummary.allocatedAmount).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-500 block uppercase">Assigned Meter</span>
                    <span className="text-sm font-bold text-slate-900">
                      {elecSummary.meter ? `Meter ${elecSummary.meter.meterNumber}` : 'No meter linked'}
                    </span>
                  </div>
                </div>

                {elecSummary.recentCharges && elecSummary.recentCharges.length > 0 && (
                  <div className="divide-y divide-slate-100 border-t border-slate-100 pt-2">
                    {elecSummary.recentCharges.slice(0, 3).map((chg: any) => (
                      <div key={chg.id} className="py-2 flex items-center justify-between text-xs">
                        <span className="text-slate-600">
                          {new Date(chg.chargePeriodStart).toLocaleDateString()} - {new Date(chg.chargePeriodEnd).toLocaleDateString()} ({chg.unitsConsumed} units)
                        </span>
                        <span className="font-bold text-slate-900">₹{Number(chg.amount).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* PG Mess & Meal Subscription (CORE-012) */}
            {mealSummary && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <UtensilsCrossed className="w-5 h-5 text-emerald-600" />
                    PG Mess & Meal Plan
                  </h2>
                  <Link
                    href="/meals"
                    className="text-xs font-semibold text-brand-teal hover:underline"
                  >
                    Attendance Matrix
                  </Link>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-500 block uppercase">Active Package</span>
                    <span className="text-sm font-bold text-slate-900">
                      {mealSummary.activePlan ? mealSummary.activePlan.name : 'No Active Plan'}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-500 block uppercase">Plan Price</span>
                    <span className="text-sm font-bold text-emerald-600">
                      {mealSummary.activePlan ? `₹${Number(mealSummary.activePlan.price).toFixed(2)}/mo` : '—'}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-500 block uppercase">Subscription Status</span>
                    <span className="text-sm font-bold text-brand-teal">
                      {mealSummary.subscription ? mealSummary.subscription.status : 'Inactive'}
                    </span>
                  </div>
                </div>

                {mealSummary.todayRecords && mealSummary.todayRecords.length > 0 && (
                  <div className="border-t border-slate-100 pt-2 flex items-center gap-4 text-xs">
                    <span className="font-semibold text-slate-700">Today's Meals:</span>
                    {mealSummary.todayRecords.map((r: any) => (
                      <span key={r.id} className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                        {r.mealType}: {r.status}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Maintenance Requests & Work Orders (CORE-013) */}
            {maintSummary && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-teal-600" />
                    Maintenance & Work Orders
                  </h2>
                  <Link
                    href="/maintenance"
                    className="text-xs font-semibold text-brand-teal hover:underline"
                  >
                    View All Tickets
                  </Link>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-500 block uppercase">Total Requests</span>
                    <span className="text-sm font-bold text-slate-900">
                      {maintSummary.totalTickets || 0}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-500 block uppercase">Active In Progress</span>
                    <span className="text-sm font-bold text-amber-600">
                      {maintSummary.activeTickets || 0}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-500 block uppercase">Resolved / Closed</span>
                    <span className="text-sm font-bold text-emerald-600">
                      {maintSummary.completedTickets || 0}
                    </span>
                  </div>
                </div>

                {maintSummary.latestTicket && (
                  <div className="border-t border-slate-100 pt-2 flex items-center justify-between text-xs">
                    <span className="text-slate-600">
                      Latest: <span className="font-semibold text-slate-800">{maintSummary.latestTicket.title}</span> ({maintSummary.latestTicket.ticketNumber})
                    </span>
                    <Link
                      href={`/maintenance/${maintSummary.latestTicket.id}`}
                      className="text-teal-600 hover:underline font-semibold"
                    >
                      View Ticket →
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* PG Co-Living Stays History */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-brand-teal" />
                PG Co-Living Stay History ({stays.length})
              </h2>

              {stays.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs">
                  No PG co-living stays registered for this tenant.
                </div>
              ) : (
                <div className="space-y-3">
                  {stays.map((stay) => (
                    <div
                      key={stay.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-slate-900 text-sm">
                          Bed Allocation ID: {stay.bedId}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Check-In: {new Date(stay.checkInDate).toLocaleDateString()}{' '}
                          {stay.checkOutDate
                            ? `• Check-Out: ${new Date(stay.checkOutDate).toLocaleDateString()}`
                            : '• (Current Stay)'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-900">
                          ₹{stay.monthlyRent.toLocaleString('en-IN')}/mo
                        </div>
                        <div className="text-[11px] text-emerald-600 font-semibold">
                          {!stay.checkOutDate ? 'Active Stay' : 'Completed'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Upload Document Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UploadCloud className="w-5 h-5 text-brand-teal" />
                  <h3 className="text-base font-bold text-slate-900">Upload KYC Document</h3>
                </div>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUploadDocument} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Document Type *
                  </label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value as KycDocumentType)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                  >
                    {Object.values(KycDocumentType).map((type) => (
                      <option key={type} value={type}>
                        {type.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Document Number (e.g. Aadhaar/PAN)
                  </label>
                  <input
                    type="text"
                    value={docNumber}
                    onChange={(e) => setDocNumber(e.target.value)}
                    placeholder="Optional ID / Reference Number"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Select File (JPEG, PNG, WEBP, PDF - max 5MB/25MB) *
                  </label>
                  <input
                    type="file"
                    required
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-teal/10 file:text-brand-teal hover:file:bg-brand-teal/20"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="px-4 py-2 text-xs font-semibold bg-brand-teal text-white rounded-lg hover:bg-teal-700 transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      'Upload Document'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Reject Document Modal Dialog */}
        {rejectingDocId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-rose-500" />
                  <h3 className="text-base font-bold text-slate-900">Reject KYC Document</h3>
                </div>
                <button
                  onClick={() => setRejectingDocId(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-500">
                Please specify a reason for rejecting this document so the tenant or staff can
                rectify it.
              </p>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Rejection Reason *
                </label>
                <textarea
                  rows={3}
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Unclear photograph / Expired document"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectingDocId(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={verifying || !rejectionReason.trim()}
                  onClick={() =>
                    handleVerifyStatus(
                      rejectingDocId,
                      KycVerificationStatus.REJECTED,
                      rejectionReason
                    )
                  }
                  className="px-4 py-2 text-xs font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {verifying ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Rejecting...
                    </>
                  ) : (
                    'Confirm Rejection'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
