'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { BackButton } from '@/components/ui/BackButton';
import { useAuth } from '@/lib/auth-context';
import {
  AgreementDto,
  AgreementSummaryDto,
  AgreementStatus,
  AgreementType,
  AgreementTemplateDto,
} from '@propertyos/types';
import {
  FileSignature,
  Plus,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck,
  XCircle,
  ArrowRight,
  Shield,
  Layers,
  Sparkles,
  Download,
  Building,
  User,
  Calendar,
  Loader2,
  FileText,
  Send,
  X,
  History,
} from 'lucide-react';

export default function AgreementsDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [agreements, setAgreements] = useState<AgreementDto[]>([]);
  const [summary, setSummary] = useState<AgreementSummaryDto>({
    total: 0,
    draft: 0,
    pendingSignature: 0,
    partiallySigned: 0,
    signed: 0,
    finalized: 0,
    cancelled: 0,
  });

  const [properties, setProperties] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [templates, setTemplates] = useState<AgreementTemplateDto[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter States
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Create Agreement Wizard Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formPropertyId, setFormPropertyId] = useState('');
  const [formTenantId, setFormTenantId] = useState('');
  const [formType, setFormType] = useState<AgreementType>(AgreementType.RENTAL_AGREEMENT);
  const [formTemplateId, setFormTemplateId] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('propertyos_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const url =
        selectedPropertyId !== 'ALL'
          ? `/api/v1/agreements/summary?propertyId=${selectedPropertyId}`
          : '/api/v1/agreements/summary';

      const res = await fetch(url, {
        headers,
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) setSummary(json.data);
      }
    } catch {
      // Non-blocking fallback
    }
  }, [selectedPropertyId]);

  const fetchAgreements = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('propertyos_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const params = new URLSearchParams();
      if (selectedStatus !== 'ALL') params.append('status', selectedStatus);
      if (selectedType !== 'ALL') params.append('agreementType', selectedType);
      if (selectedPropertyId !== 'ALL') params.append('propertyId', selectedPropertyId);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await fetch(`/api/v1/agreements?${params.toString()}`, {
        headers,
        credentials: 'include',
      });

      if (res.status === 401) {
        // Unauthenticated / Guest state
        setAgreements([]);
        return;
      }

      if (!res.ok) {
        throw new Error('Failed to load agreements list');
      }

      const json = await res.json();
      const list = json.data?.agreements || json.agreements || (Array.isArray(json.data) ? json.data : []);
      setAgreements(list);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error fetching agreements');
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, selectedType, selectedPropertyId, searchQuery]);

  const fetchDropdownData = useCallback(async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('propertyos_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const [propRes, tenantRes, tmplRes] = await Promise.all([
        fetch('/api/v1/properties', { headers, credentials: 'include' }),
        fetch('/api/v1/tenants', { headers, credentials: 'include' }),
        fetch('/api/v1/agreement-templates?status=ACTIVE', { headers, credentials: 'include' }),
      ]);

      if (propRes.ok) {
        const json = await propRes.json();
        const list = json.data?.properties || json.properties || (Array.isArray(json.data) ? json.data : []);
        setProperties(list);
      }
      if (tenantRes.ok) {
        const json = await tenantRes.json();
        const list = json.data?.tenants || json.tenants || (Array.isArray(json.data) ? json.data : []);
        setTenants(list);
      }
      if (tmplRes.ok) {
        const json = await tmplRes.json();
        const list = json.data?.templates || json.templates || (Array.isArray(json.data) ? json.data : []);
        setTemplates(list);
      }
    } catch {
      // Non-blocking
    }
  }, []);

  useEffect(() => {
    fetchDropdownData();
  }, [fetchDropdownData]);

  useEffect(() => {
    fetchAgreements();
    fetchSummary();
  }, [fetchAgreements, fetchSummary]);

  const handleCreateAgreement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPropertyId || !formTenantId) {
      setCreateError('Please select both a property and a tenant');
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('propertyos_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/properties/${formPropertyId}/agreements`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          tenantId: formTenantId,
          agreementType: formType,
          templateId: formTemplateId || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to create agreement');
      }

      setShowCreateModal(false);
      // Navigate to the newly created agreement
      if (json.data?.id) {
        router.push(`/agreements/${json.data.id}`);
      } else {
        fetchAgreements();
        fetchSummary();
      }
    } catch (err: any) {
      setCreateError(err.message || 'Error creating agreement');
    } finally {
      setCreating(false);
    }
  };

  const getStatusBadge = (status: AgreementStatus) => {
    switch (status) {
      case AgreementStatus.FINALIZED:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Finalized
          </span>
        );
      case AgreementStatus.SIGNED:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
            <FileCheck className="w-3.5 h-3.5" />
            Fully Signed
          </span>
        );
      case AgreementStatus.PARTIALLY_SIGNED:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Clock className="w-3.5 h-3.5" />
            Partially Signed
          </span>
        );
      case AgreementStatus.PENDING_SIGNATURE:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            Pending Signature
          </span>
        );
      case AgreementStatus.GENERATED:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Sparkles className="w-3.5 h-3.5" />
            Generated
          </span>
        );
      case AgreementStatus.DRAFT:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <FileText className="w-3.5 h-3.5" />
            Draft
          </span>
        );
      case AgreementStatus.CANCELLED:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" />
            Cancelled
          </span>
        );
      default:
        return <span className="text-xs text-slate-500">{status}</span>;
    }
  };

  return (
    <AppShell activePath="/agreements">
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="mb-2">
              <BackButton fallbackHref="/" label="Back to Dashboard" />
            </div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-teal-50 border border-teal-200 text-brand-teal">
                <FileSignature className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Digital Agreements & Signatures
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  Versioned legal templates, SHA-256 verified document snapshots & digital sign-offs
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/settings/agreement-templates"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition shadow-sm"
            >
              <FileText className="w-4 h-4 text-slate-500" />
              Manage Templates
            </Link>

            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-teal text-white font-medium text-sm hover:bg-teal-700 transition shadow-sm shadow-teal-700/20"
            >
              <Plus className="w-4 h-4" />
              New Agreement
            </button>
          </div>
        </div>

        {/* KPI Metrics Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total</p>
            <p className="text-2xl font-bold text-slate-900 mt-1.5">{summary.total}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Drafts</p>
            <p className="text-2xl font-bold text-slate-700 mt-1.5">{summary.draft}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
            <p className="text-xs font-medium text-amber-600 uppercase tracking-wider">Pending Sign</p>
            <p className="text-2xl font-bold text-amber-700 mt-1.5">{summary.pendingSignature}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
            <p className="text-xs font-medium text-indigo-600 uppercase tracking-wider">Partial Sign</p>
            <p className="text-2xl font-bold text-indigo-700 mt-1.5">{summary.partiallySigned}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
            <p className="text-xs font-medium text-teal-600 uppercase tracking-wider">Signed</p>
            <p className="text-2xl font-bold text-teal-700 mt-1.5">{summary.signed}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
            <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Finalized</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1.5">{summary.finalized}</p>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3.5 items-center justify-between">
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {['ALL', 'DRAFT', 'GENERATED', 'PENDING_SIGNATURE', 'PARTIALLY_SIGNED', 'SIGNED', 'FINALIZED'].map(
              (st) => (
                <button
                  key={st}
                  onClick={() => setSelectedStatus(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    selectedStatus === st
                      ? 'bg-brand-teal text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st.replace(/_/g, ' ')}
                </button>
              )
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            <div className="relative flex-1 md:w-60">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search tenant or property..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
              />
            </div>

            <select
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
            >
              <option value="ALL">All Properties</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-20 text-center flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 text-brand-teal animate-spin mb-3" />
              <p className="text-sm font-medium text-slate-600">Loading agreements...</p>
            </div>
          ) : errorMsg ? (
            <div className="py-16 text-center text-rose-500">
              <AlertCircle className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm font-medium">{errorMsg}</p>
            </div>
          ) : agreements.length === 0 ? (
            <div className="py-16 text-center">
              <FileSignature className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-800">No Digital Agreements Found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No agreement records match your current filter criteria. Create a new digital agreement to get started.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-brand-teal text-white text-xs font-semibold hover:bg-teal-700 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                New Agreement
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Agreement / Type</th>
                    <th className="py-3.5 px-4">Tenant</th>
                    <th className="py-3.5 px-4">Property</th>
                    <th className="py-3.5 px-4">Version</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Signatures</th>
                    <th className="py-3.5 px-4">Generated / SHA-256</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {agreements.map((agr: any) => {
                    const signedCount = (agr.signatures || []).filter(
                      (s: any) => s.status === 'SIGNED'
                    ).length;
                    const totalSigs = (agr.signatures || []).length;

                    return (
                      <tr key={agr.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3.5 px-4 font-medium text-slate-900">
                          <Link
                            href={`/agreements/${agr.id}`}
                            className="hover:text-brand-teal flex items-center gap-1.5"
                          >
                            <FileSignature className="w-3.5 h-3.5 text-slate-400" />
                            {agr.agreementType.replace(/_/g, ' ')}
                          </Link>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            ID: {agr.id.substring(0, 8)}...
                          </p>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-slate-800">
                            {agr.tenant
                              ? `${agr.tenant.firstName} ${agr.tenant.lastName}`
                              : 'Tenant'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="text-slate-600">
                            {agr.property?.name || 'Property'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono font-medium text-[11px]">
                            v{agr.version}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">{getStatusBadge(agr.status)}</td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                signedCount === totalSigs && totalSigs > 0
                                  ? 'bg-emerald-500'
                                  : signedCount > 0
                                  ? 'bg-indigo-500'
                                  : 'bg-amber-500'
                              }`}
                            />
                            {signedCount} of {totalSigs || 2} Signed
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {agr.contentHash ? (
                            <span
                              className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 max-w-[120px] truncate block"
                              title={agr.contentHash}
                            >
                              {agr.contentHash.substring(0, 16)}...
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Not Generated</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Link
                            href={`/agreements/${agr.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 transition shadow-sm"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-500" />
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create Agreement Wizard Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-teal-50 text-brand-teal">
                    <FileSignature className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">Create Digital Agreement</h3>
                    <p className="text-xs text-slate-500">
                      Initialize a new digital agreement draft for a tenant
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {createError && (
                <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs text-rose-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <form onSubmit={handleCreateAgreement} className="space-y-4 mt-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Select Property <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formPropertyId}
                    onChange={(e) => setFormPropertyId(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                  >
                    <option value="">-- Choose Property --</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.propertyType})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Select Tenant <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formTenantId}
                    onChange={(e) => setFormTenantId(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                  >
                    <option value="">-- Choose Tenant --</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.firstName} {t.lastName} • {t.phone} ({t.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Agreement Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as AgreementType)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                  >
                    <option value={AgreementType.RENTAL_AGREEMENT}>RENTAL AGREEMENT (Whole Unit)</option>
                    <option value={AgreementType.PG_AGREEMENT}>PG AGREEMENT (Co-living)</option>
                    <option value={AgreementType.HOUSE_RULES}>HOUSE RULES</option>
                    <option value={AgreementType.ADDENDUM}>ADDENDUM</option>
                    <option value={AgreementType.OTHER}>OTHER</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Template (Optional)
                  </label>
                  <select
                    value={formTemplateId}
                    onChange={(e) => setFormTemplateId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                  >
                    <option value="">-- Use Default Active Template --</option>
                    {templates
                      .filter((t) => t.agreementType === formType)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} (v{t.version})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-teal text-white font-medium hover:bg-teal-700 transition disabled:opacity-50"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Create Draft
                      </>
                    )}
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
