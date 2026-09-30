'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { AppShell } from '@/components/layout/AppShell';
import { BackButton } from '@/components/ui/BackButton';
import {
  AuditLogDto,
  AuditSummaryDto,
  AuditCategory,
} from '@propertyos/types';
import {
  Shield,
  History,
  Download,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Calendar,
  User as UserIcon,
  Server,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ChevronLeft,
  ChevronRight,
  X,
  Copy,
  Check,
  Globe,
  SlidersHorizontal,
} from 'lucide-react';

export default function AuditPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  // State
  const [logs, setLogs] = useState<AuditLogDto[]>([]);
  const [summary, setSummary] = useState<AuditSummaryDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination & Filtering
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<AuditCategory | ''>('');
  const [selectedAction, setSelectedAction] = useState('');
  const [selectedResourceType, setSelectedResourceType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState<'NEWEST' | 'OLDEST'>('NEWEST');

  // Selected Log for Drawer
  const [selectedLog, setSelectedLog] = useState<AuditLogDto | null>(null);
  const [copied, setCopied] = useState(false);

  // Export Modal
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'CSV' | 'JSON'>('CSV');
  const [exporting, setExporting] = useState(false);

  // Fetch Summary KPIs
  const fetchSummary = useCallback(async () => {
    if (!isAuthenticated) {
      setSummaryLoading(false);
      return;
    }
    try {
      setSummaryLoading(true);
      const res = await fetch('/api/v1/audit/summary', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        setSummary(null);
        return;
      }
      const data = await res.json();
      setSummary(data?.data || data);
    } catch (err: any) {
      console.warn('Audit summary sync note:', err);
    } finally {
      setSummaryLoading(false);
    }
  }, [isAuthenticated]);

  // Fetch Audit Logs
  const fetchLogs = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sortBy,
      });

      if (search.trim()) params.append('search', search.trim());
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedAction) params.append('action', selectedAction);
      if (selectedResourceType) params.append('resourceType', selectedResourceType);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await fetch(`/api/v1/audit/logs?${params.toString()}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        // Handle server offline/syncing gracefully without crashing banner
        setLogs([]);
        setError(null);
        return;
      }

      const resData = await res.json();
      const raw = resData?.data || resData;
      const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);
      setLogs(Array.isArray(list) ? list : []);

      if (resData?.meta) {
        setTotalPages(resData.meta.totalPages || 1);
        setTotalCount(resData.meta.total || 0);
      } else if (raw?.meta) {
        setTotalPages(raw.meta.totalPages || 1);
        setTotalCount(raw.meta.total || 0);
      } else {
        setTotalPages(1);
        setTotalCount(Array.isArray(list) ? list.length : 0);
      }
    } catch (err: any) {
      console.warn('Audit trail sync note:', err);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [page, limit, sortBy, search, selectedCategory, selectedAction, selectedResourceType, startDate, endDate, isAuthenticated]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Copy JSON metadata handler
  const handleCopyMetadata = () => {
    if (!selectedLog) return;
    navigator.clipboard.writeText(JSON.stringify(selectedLog.metadata || {}, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Trigger Export
  const handleExport = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams({
        format: exportFormat,
      });

      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedAction) params.append('action', selectedAction);
      if (selectedResourceType) params.append('resourceType', selectedResourceType);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await fetch(`/api/v1/audit/export?${params.toString()}`, {
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Export generation failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-trail-${new Date().toISOString().split('T')[0]}.${exportFormat.toLowerCase()}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      setShowExportModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to export audit logs');
    } finally {
      setExporting(false);
    }
  };

  // Severity Color Mapping
  const getActionBadgeColor = (action: string) => {
    if (action.includes('DELETED') || action.includes('FAILED') || action.includes('VOIDED') || action.includes('REMOVED')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    if (action.includes('CANCELLED') || action.includes('RESET') || action.includes('SUSPENDED') || action.includes('REJECTED')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (action.includes('EXPORTED') || action.includes('SIGNED') || action.includes('ALLOCATED') || action.includes('VERIFIED')) {
      return 'bg-purple-50 text-purple-700 border-purple-200';
    }
    if (action.includes('CREATED') || action.includes('ISSUED') || action.includes('COMPLETED') || action.includes('SUCCESS')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    return 'bg-teal-50 text-teal-700 border-teal-200';
  };

  const categories = [
    { label: 'All Events', value: '' },
    { label: 'Auth & Security', value: AuditCategory.AUTH_SECURITY },
    { label: 'Finance & Invoicing', value: AuditCategory.FINANCE_BILLING },
    { label: 'Tenants & KYC', value: AuditCategory.TENANTS_KYC },
    { label: 'Leases & Stays', value: AuditCategory.LEASES_STAYS },
    { label: 'Facility & Operations', value: AuditCategory.FACILITY_OPERATIONS },
    { label: 'Community & Marketplace', value: AuditCategory.COMMUNITY_ENGAGEMENT },
    { label: 'Compliance & Exports', value: AuditCategory.AUDIT_COMPLIANCE },
  ];

  if (!authLoading && !isAuthenticated) {
    return (
      <AppShell activePath="/audit">
        <div className="max-w-2xl mx-auto my-12 text-center bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 shadow-sm animate-fadeIn">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 border border-teal-200/80 text-brand-teal flex items-center justify-center mx-auto mb-6">
            <Shield className="w-8 h-8" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold uppercase tracking-wider mb-4">
            <Lock className="w-3.5 h-3.5" />
            <span>Compliance & Governance Restricted</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-3">
            Sign In to View Audit Trail
          </h1>
          <p className="text-sm sm:text-base text-slate-600 max-w-md mx-auto leading-relaxed mb-8">
            Cryptographic event streams, actor attribution, financial modifications, and compliance logs require authenticated owner or administrator credentials.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
            <Link
              href="/login?returnUrl=/audit"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brand-teal hover:bg-teal-700 text-white font-bold text-sm shadow-md shadow-teal-700/10 transition cursor-pointer"
            >
              <span>Sign In to Continue</span>
            </Link>
            <Link
              href="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm border border-slate-300 transition cursor-pointer"
            >
              <span>Register New Account</span>
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell activePath="/audit">
      <div className="space-y-6 w-full pb-12">
        {/* Navigation Back Button */}
        <div className="flex items-center justify-between">
          <BackButton fallbackHref="/" label="Back to Dashboard" />
        </div>

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-50 text-brand-teal border border-teal-200 rounded-xl">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                <span>Audit Trail & Compliance Log</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-brand-teal border border-teal-200">
                  Append-Only
                </span>
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Immutable, cryptographic security, financial, and operational event stream
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                fetchSummary();
                fetchLogs();
              }}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 shadow-sm transition"
            >
              <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={() => setShowExportModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-teal text-white text-sm font-medium hover:bg-teal-700 shadow-sm transition"
            >
              <Download className="w-4 h-4" />
              <span>Export Audit Trail</span>
            </button>
          </div>
        </div>

        {/* KPI Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Audit Logs
              </span>
              <History className="w-5 h-5 text-brand-teal" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">
              {summaryLoading ? '...' : (summary?.totalLogs || 0).toLocaleString()}
            </p>
            <p className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Strictly Append-Only
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Events (Last 24h)
              </span>
              <Calendar className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-blue-600 mt-2">
              {summaryLoading ? '...' : (summary?.eventsLast24h || 0).toLocaleString()}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {summaryLoading ? '...' : `${summary?.eventsLast7d || 0} events past 7 days`}
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Active Actors
              </span>
              <UserIcon className="w-5 h-5 text-indigo-500" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">
              {summaryLoading ? '...' : summary?.uniqueActors || 0}
            </p>
            <p className="text-xs text-slate-500 mt-1">Distinct authorized identities</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Security & Finance
              </span>
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-amber-600 mt-2">
              {summaryLoading ? '...' : ((summary?.criticalSecurityEvents || 0) + (summary?.financialEvents || 0)).toLocaleString()}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {summary?.financialEvents || 0} ledger/finance, {summary?.criticalSecurityEvents || 0} security
            </p>
          </div>
        </div>

        {/* Horizontal Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto py-2 border-b border-slate-200 scrollbar-none">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.value;
            return (
              <button
                key={cat.label}
                onClick={() => {
                  setSelectedCategory(cat.value as AuditCategory | '');
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border shrink-0 ${
                  isSelected
                    ? 'bg-brand-teal text-white border-brand-teal shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Multi-Parameter Filter Toolbar */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Keyword Search */}
            <div className="relative lg:col-span-2">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by action, resource, actor, IP, or user agent..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
              />
            </div>

            {/* Action Filter */}
            <div>
              <select
                aria-label="Filter by Action"
                value={selectedAction}
                onChange={(e) => {
                  setSelectedAction(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
              >
                <option value="">All Actions</option>
                {summary?.topActions?.map((a) => (
                  <option key={a.action} value={a.action}>
                    {a.action} ({a.count})
                  </option>
                ))}
              </select>
            </div>

            {/* Resource Type Filter */}
            <div>
              <select
                aria-label="Filter by Resource Type"
                value={selectedResourceType}
                onChange={(e) => {
                  setSelectedResourceType(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
              >
                <option value="">All Resources</option>
                {summary?.resourceBreakdown?.map((r) => (
                  <option key={r.resourceType} value={r.resourceType}>
                    {r.resourceType} ({r.count})
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Order */}
            <div>
              <select
                aria-label="Sort Order"
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as 'NEWEST' | 'OLDEST');
                  setPage(1);
                }}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
              >
                <option value="NEWEST">Newest First</option>
                <option value="OLDEST">Oldest First</option>
              </select>
            </div>
          </div>

          {/* Date Range & Reset Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Date Range:</span>
              <input
                type="date"
                aria-label="Start Date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                aria-label="End Date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
              />
            </div>

            {(search || selectedCategory || selectedAction || selectedResourceType || startDate || endDate) && (
              <button
                onClick={() => {
                  setSearch('');
                  setSelectedCategory('');
                  setSelectedAction('');
                  setSelectedResourceType('');
                  setStartDate('');
                  setEndDate('');
                  setPage(1);
                }}
                className="text-brand-teal hover:underline font-semibold flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Main Audit Log Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Timestamp (UTC)</th>
                  <th className="px-5 py-3.5">Action</th>
                  <th className="px-5 py-3.5">Resource</th>
                  <th className="px-5 py-3.5">Actor</th>
                  <th className="px-5 py-3.5">Client Context</th>
                  <th className="px-5 py-3.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-5 py-4"><div className="h-4 bg-slate-100 rounded w-24"></div></td>
                      <td className="px-5 py-4"><div className="h-5 bg-slate-100 rounded w-32"></div></td>
                      <td className="px-5 py-4"><div className="h-4 bg-slate-100 rounded w-28"></div></td>
                      <td className="px-5 py-4"><div className="h-4 bg-slate-100 rounded w-28"></div></td>
                      <td className="px-5 py-4"><div className="h-4 bg-slate-100 rounded w-20"></div></td>
                      <td className="px-5 py-4 text-right"><div className="h-7 bg-slate-100 rounded w-16 ml-auto"></div></td>
                    </tr>
                  ))
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center text-slate-400">
                      <History className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                      <p className="font-semibold text-slate-700">No audit records found</p>
                      <p className="text-xs text-slate-500 mt-1">Try adjusting your filters or search query.</p>
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const date = new Date(log.createdAt);
                    const formattedTime = date.toISOString().replace('T', ' ').substring(0, 19);

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-4 text-xs font-mono text-slate-600 whitespace-nowrap">
                          {formattedTime}
                        </td>

                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${getActionBadgeColor(log.action)}`}>
                            {log.action}
                          </span>
                        </td>

                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-900 text-xs">{log.resourceType}</span>
                            <span className="text-[11px] font-mono text-slate-400 truncate max-w-[140px]" title={log.resourceId}>
                              {log.resourceId}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4 whitespace-nowrap">
                          {log.actor ? (
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-900 text-xs">
                                {log.actor.firstName} {log.actor.lastName}
                              </span>
                              <span className="text-[11px] text-slate-500">{log.actor.email}</span>
                              {log.actor.role && (
                                <span className="text-[10px] text-brand-teal font-semibold">{log.actor.role}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">System Process</span>
                          )}
                        </td>

                        <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-500 font-mono">
                          <div className="flex flex-col">
                            <span>{log.ipAddress || '—'}</span>
                            <span className="text-[10px] text-slate-400 truncate max-w-[150px]" title={log.userAgent || ''}>
                              {log.userAgent || '—'}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition inline-flex items-center gap-1.5 shadow-2xs"
                          >
                            <Eye className="w-3.5 h-3.5 text-brand-teal" />
                            <span>Inspect</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 bg-slate-50/50">
            <div>
              Showing <span className="font-semibold text-slate-800">{logs.length}</span> of{' '}
              <span className="font-semibold text-slate-800">{totalCount}</span> records
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-medium text-slate-700">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Slide-Over Metadata Detail Drawer */}
        {selectedLog && (
          <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
            <div className="w-full max-w-xl bg-white border-l border-slate-200 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
              {/* Drawer Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-teal-50 text-brand-teal border border-teal-200">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Audit Event Details</h3>
                    <p className="text-xs font-mono text-slate-500">{selectedLog.id}</p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Redaction Notice */}
              <div className="px-5 py-3 bg-teal-50 border-b border-teal-100 flex items-center gap-2 text-xs text-teal-800">
                <Lock className="w-3.5 h-3.5 shrink-0 text-brand-teal" />
                <span>Sensitive credentials, passwords, and keys are automatically redacted.</span>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5 text-sm">
                {/* Event Overview */}
                <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <span className="text-[11px] text-slate-500 uppercase font-semibold">Action</span>
                    <p className="font-semibold text-slate-900 mt-0.5">{selectedLog.action}</p>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 uppercase font-semibold">Resource</span>
                    <p className="font-semibold text-slate-900 mt-0.5">{selectedLog.resourceType}</p>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 uppercase font-semibold">Timestamp (UTC)</span>
                    <p className="text-xs font-mono text-slate-700 mt-0.5">{selectedLog.createdAt}</p>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 uppercase font-semibold">Resource ID</span>
                    <p className="text-xs font-mono text-slate-700 mt-0.5 truncate" title={selectedLog.resourceId}>
                      {selectedLog.resourceId}
                    </p>
                  </div>
                </div>

                {/* Actor Information */}
                <div className="p-4 rounded-xl border border-slate-200 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-brand-teal" />
                    Authorized Actor
                  </h4>

                  {selectedLog.actor ? (
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500 block">Name:</span>
                        <span className="font-semibold text-slate-900">
                          {selectedLog.actor.firstName} {selectedLog.actor.lastName}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Email:</span>
                        <span className="font-semibold text-slate-900">{selectedLog.actor.email}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Role:</span>
                        <span className="font-semibold text-brand-teal">{selectedLog.actor.role || '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">User ID:</span>
                        <span className="font-mono text-slate-600 truncate block" title={selectedLog.actor.id}>
                          {selectedLog.actor.id}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">System daemon / Automated cron scheduler</p>
                  )}
                </div>

                {/* Client Environment */}
                <div className="p-4 rounded-xl border border-slate-200 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-brand-teal" />
                    Client Context
                  </h4>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-slate-500 block">IP Address:</span>
                      <span className="font-mono font-semibold text-slate-900">{selectedLog.ipAddress || 'Not recorded'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">User Agent:</span>
                      <span className="font-mono text-slate-700 text-[11px] break-all">
                        {selectedLog.userAgent || 'Not recorded'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Differential State / Metadata */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                      <Server className="w-4 h-4 text-brand-teal" />
                      Differential Metadata (JSON)
                    </h4>

                    <button
                      onClick={handleCopyMetadata}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy JSON'}</span>
                    </button>
                  </div>

                  <pre className="p-4 rounded-xl bg-slate-900 text-teal-300 font-mono text-xs overflow-x-auto max-h-72 border border-slate-800">
                    {JSON.stringify(selectedLog.metadata || {}, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50/50">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition shadow-2xs"
                >
                  Close Inspector
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Export Modal */}
        {showExportModal && (
          <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-teal-50 text-brand-teal border border-teal-200">
                    <Download className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">Export Audit Trail</h3>
                </div>

                <button
                  onClick={() => setShowExportModal(false)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs text-slate-600">
                <p>
                  Export all audit logs matching your current filters for compliance reporting, internal reviews, and tax audits.
                </p>

                <div className="space-y-2">
                  <label className="font-semibold text-slate-700 block">Export File Format</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setExportFormat('CSV')}
                      className={`p-3 rounded-xl border text-center font-semibold transition ${
                        exportFormat === 'CSV'
                          ? 'border-brand-teal bg-teal-50/50 text-brand-teal ring-1 ring-brand-teal'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      CSV (Excel / Sheets)
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportFormat('JSON')}
                      className={`p-3 rounded-xl border text-center font-semibold transition ${
                        exportFormat === 'JSON'
                          ? 'border-brand-teal bg-teal-50/50 text-brand-teal ring-1 ring-brand-teal'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      JSON (Raw Stream)
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px]">
                  <strong>Formula Injection Defense:</strong> All CSV cells beginning with special characters (=, +, -, @) are automatically sanitized.
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>

                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-teal text-white text-xs font-semibold hover:bg-teal-700 transition shadow-sm disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{exporting ? 'Generating...' : `Export ${exportFormat}`}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
