'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
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
  const { user } = useAuth();

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
    try {
      setSummaryLoading(true);
      const res = await fetch('/api/v1/audit/summary', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) throw new Error('Failed to load audit summary metrics');
      const data = await res.json();
      setSummary(data);
    } catch (err: any) {
      console.error('Error fetching audit summary:', err);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  // Fetch Audit Logs
  const fetchLogs = useCallback(async () => {
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

      if (!res.ok) throw new Error('Failed to load audit logs');
      const result = await res.json();

      setLogs(result.data || []);
      setTotalCount(result.total || 0);
      setTotalPages(result.totalPages || 1);
    } catch (err: any) {
      setError(err.message || 'An error occurred while loading audit trail.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, sortBy, search, selectedCategory, selectedAction, selectedResourceType, startDate, endDate]);

  useEffect(() => {
    if (user) {
      fetchSummary();
    }
  }, [user, fetchSummary]);

  useEffect(() => {
    if (user) {
      fetchLogs();
    }
  }, [user, fetchLogs]);

  // Copy JSON to Clipboard
  const handleCopyJson = () => {
    if (!selectedLog) return;
    navigator.clipboard.writeText(JSON.stringify(selectedLog, null, 2));
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
      if (search.trim()) params.append('search', search.trim());
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
      a.download = exportFormat === 'JSON' ? `audit_logs_${Date.now()}.json` : `audit_logs_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setShowExportModal(false);
      fetchSummary(); // Refresh summary to capture AUDIT_LOG_EXPORTED
    } catch (err: any) {
      alert(err.message || 'Failed to export audit logs');
    } finally {
      setExporting(false);
    }
  };

  // Severity Color Mapping
  const getActionBadgeColor = (action: string) => {
    if (action.includes('DELETED') || action.includes('FAILED') || action.includes('VOIDED') || action.includes('REMOVED')) {
      return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
    }
    if (action.includes('CANCELLED') || action.includes('RESET') || action.includes('SUSPENDED') || action.includes('REJECTED')) {
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    }
    if (action.includes('EXPORTED') || action.includes('SIGNED') || action.includes('ALLOCATED') || action.includes('VERIFIED')) {
      return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    }
    if (action.includes('CREATED') || action.includes('ISSUED') || action.includes('COMPLETED') || action.includes('SUCCESS')) {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    }
    return 'bg-teal-500/10 text-teal-400 border-teal-500/30';
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 lg:p-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Audit Trail & Compliance Log
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  Append-Only
                </span>
              </h1>
              <p className="text-sm text-slate-400">
                Immutable, cryptographic security, financial, and operational event stream
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              fetchSummary();
              fetchLogs();
            }}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-sm font-medium transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold shadow-lg shadow-teal-900/30 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Audit Trail
          </button>
        </div>
      </div>

      {/* KPI StatCards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Audit Logs</span>
            <History className="w-4 h-4 text-teal-400" />
          </div>
          <div className="mt-3 text-2xl font-bold text-white">
            {summaryLoading ? '...' : (summary?.totalLogs || 0).toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-slate-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Strictly Append-Only
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Events (Last 24h)</span>
            <Calendar className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-3 text-2xl font-bold text-white">
            {summaryLoading ? '...' : (summary?.eventsLast24h || 0).toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {summaryLoading ? '...' : `${summary?.eventsLast7d || 0} events past 7 days`}
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Active Actors</span>
            <UserIcon className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-3 text-2xl font-bold text-white">
            {summaryLoading ? '...' : summary?.uniqueActors || 0}
          </div>
          <div className="mt-1 text-xs text-slate-400">Distinct authorized identities</div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Security & Financial Events</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3 text-2xl font-bold text-white">
            {summaryLoading ? '...' : ((summary?.criticalSecurityEvents || 0) + (summary?.financialEvents || 0)).toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {summary?.financialEvents || 0} ledger/finance, {summary?.criticalSecurityEvents || 0} security
          </div>
        </div>
      </div>

      {/* Horizontal Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto py-4 mt-6 border-b border-slate-800 scrollbar-none">
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.value;
          return (
            <button
              key={cat.label}
              onClick={() => {
                setSelectedCategory(cat.value as AuditCategory | '');
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
                isSelected
                  ? 'bg-teal-500/20 text-teal-300 border-teal-500/40 shadow-sm'
                  : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Multi-Parameter Filter Toolbar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 mt-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Keyword Search */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by action, resource, actor, IP, or user agent..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Action Filter */}
          <div>
            <select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-teal-500"
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
              value={selectedResourceType}
              onChange={(e) => {
                setSelectedResourceType(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-teal-500"
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
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as 'NEWEST' | 'OLDEST');
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-teal-500"
            >
              <option value="NEWEST">Newest First</option>
              <option value="OLDEST">Oldest First</option>
            </select>
          </div>
        </div>

        {/* Date Range & Reset Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/60 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Date Range:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-300 text-xs focus:outline-none focus:border-teal-500"
            />
            <span className="text-slate-500">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-300 text-xs focus:outline-none focus:border-teal-500"
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
              className="text-teal-400 hover:text-teal-300 font-medium flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Audit Log Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl mt-6 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-xs font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Timestamp (UTC)</th>
                <th className="px-5 py-3.5">Action</th>
                <th className="px-5 py-3.5">Resource</th>
                <th className="px-5 py-3.5">Actor</th>
                <th className="px-5 py-3.5">Client Context</th>
                <th className="px-5 py-3.5 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                // Skeletons
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-5 py-4"><div className="h-4 bg-slate-800 rounded w-24"></div></td>
                    <td className="px-5 py-4"><div className="h-5 bg-slate-800 rounded w-32"></div></td>
                    <td className="px-5 py-4"><div className="h-4 bg-slate-800 rounded w-28"></div></td>
                    <td className="px-5 py-4"><div className="h-4 bg-slate-800 rounded w-28"></div></td>
                    <td className="px-5 py-4"><div className="h-4 bg-slate-800 rounded w-20"></div></td>
                    <td className="px-5 py-4 text-right"><div className="h-7 bg-slate-800 rounded w-16 ml-auto"></div></td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    <History className="w-10 h-10 mx-auto text-slate-600 mb-3" />
                    <p className="font-semibold text-slate-300">No audit records found</p>
                    <p className="text-xs text-slate-500 mt-1">Try adjusting your filters or search query.</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const date = new Date(log.createdAt);
                  const formattedTime = date.toISOString().replace('T', ' ').substring(0, 19);

                  return (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-4 text-xs font-mono text-slate-300 whitespace-nowrap">
                        {formattedTime}
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${getActionBadgeColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-200 text-xs">{log.resourceType}</span>
                          <span className="text-[11px] font-mono text-slate-500 truncate max-w-[140px]" title={log.resourceId}>
                            {log.resourceId}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        {log.actor ? (
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-200 text-xs">
                              {log.actor.firstName} {log.actor.lastName}
                            </span>
                            <span className="text-[11px] text-slate-400">{log.actor.email}</span>
                            {log.actor.role && (
                              <span className="text-[10px] text-teal-400/90 font-semibold">{log.actor.role}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500 italic">System Process</span>
                        )}
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-400 font-mono">
                        <div className="flex flex-col">
                          <span>{log.ipAddress || '—'}</span>
                          <span className="text-[10px] text-slate-500 truncate max-w-[150px]" title={log.userAgent || ''}>
                            {log.userAgent || '—'}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors inline-flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5 text-teal-400" />
                          Inspect
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
        <div className="p-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 bg-slate-950/60">
          <div>
            Showing <span className="font-semibold text-slate-200">{logs.length}</span> of{' '}
            <span className="font-semibold text-slate-200">{totalCount}</span> records
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-medium text-slate-300">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Slide-Over Metadata Detail Drawer */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Audit Event Details</h3>
                  <p className="text-xs font-mono text-slate-400">{selectedLog.id}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Redaction Notice */}
            <div className="px-5 py-3 bg-teal-950/40 border-b border-teal-800/40 flex items-center gap-2 text-xs text-teal-300">
              <Lock className="w-3.5 h-3.5 shrink-0 text-teal-400" />
              <span>Sensitive credentials, passwords, and keys are automatically redacted.</span>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-sm">
              {/* Event Overview */}
              <div className="grid grid-cols-2 gap-3 p-4 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <div>
                  <span className="text-[11px] text-slate-400 uppercase font-semibold">Action</span>
                  <p className="font-semibold text-white mt-0.5">{selectedLog.action}</p>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 uppercase font-semibold">Resource</span>
                  <p className="font-semibold text-white mt-0.5">{selectedLog.resourceType}</p>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 uppercase font-semibold">Timestamp (UTC)</span>
                  <p className="text-xs font-mono text-slate-300 mt-0.5">{selectedLog.createdAt}</p>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 uppercase font-semibold">Resource ID</span>
                  <p className="text-xs font-mono text-slate-300 mt-0.5 truncate" title={selectedLog.resourceId}>
                    {selectedLog.resourceId}
                  </p>
                </div>
              </div>

              {/* Actor Information */}
              <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-2">
                <span className="text-[11px] text-slate-400 uppercase font-semibold">Actor Profile</span>
                {selectedLog.actor ? (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500">Name:</span>
                      <p className="text-slate-200 font-medium">{selectedLog.actor.firstName} {selectedLog.actor.lastName}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Email:</span>
                      <p className="text-slate-200 font-medium">{selectedLog.actor.email}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Role:</span>
                      <p className="text-teal-400 font-semibold">{selectedLog.actor.role || '—'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">User ID:</span>
                      <p className="text-slate-400 font-mono truncate">{selectedLog.actor.id}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">Automated System Execution</p>
                )}
              </div>

              {/* Client Network & Agent */}
              <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-2">
                <span className="text-[11px] text-slate-400 uppercase font-semibold">Network & Client Context</span>
                <div className="text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">IP Address:</span>
                    <span className="text-slate-300 font-mono">{selectedLog.ipAddress || 'Not recorded'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">User Agent:</span>
                    <span className="text-slate-400 font-mono text-[11px] max-w-[280px] truncate" title={selectedLog.userAgent || ''}>
                      {selectedLog.userAgent || 'Not recorded'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sanitized Metadata JSON */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 uppercase font-semibold">Event Payload / Metadata</span>
                  <button
                    onClick={handleCopyJson}
                    className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy JSON'}
                  </button>
                </div>

                <pre className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-teal-300 overflow-x-auto max-h-72">
                  {JSON.stringify(selectedLog.metadata || {}, null, 2)}
                </pre>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400">
                  <Download className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white">Export Audit Trail</h3>
              </div>

              <button
                onClick={() => setShowExportModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Export up to 5,000 audit records matching current search, category, and date parameters.
            </p>

            {/* Format Selection */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300">File Format</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setExportFormat('CSV')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    exportFormat === 'CSV'
                      ? 'bg-teal-500/10 border-teal-500/50 text-white shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="block font-bold text-sm">CSV Spreadsheet</span>
                  <span className="block text-[11px] text-slate-400 mt-0.5">RFC 4180 with Formula Injection Protection</span>
                </button>

                <button
                  type="button"
                  onClick={() => setExportFormat('JSON')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    exportFormat === 'JSON'
                      ? 'bg-teal-500/10 border-teal-500/50 text-white shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="block font-bold text-sm">JSON Format</span>
                  <span className="block text-[11px] text-slate-400 mt-0.5">Full structured objects & metadata</span>
                </button>
              </div>
            </div>

            {/* Active Filters Summary */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 text-xs text-slate-400 space-y-1">
              <span className="font-semibold text-slate-300 block">Applied Filters:</span>
              <div>Category: <span className="text-slate-200">{selectedCategory || 'All'}</span></div>
              {selectedAction && <div>Action: <span className="text-slate-200">{selectedAction}</span></div>}
              {startDate && <div>Date Range: <span className="text-slate-200">{startDate} to {endDate || 'Now'}</span></div>}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExport}
                disabled={exporting}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold rounded-lg shadow-lg shadow-teal-900/30 transition-colors flex items-center gap-2"
              >
                {exporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {exporting ? 'Generating...' : 'Download Export'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
