'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  ShieldCheck,
  Users,
  UserCheck,
  Clock,
  Search,
  Plus,
  LogOut,
  LogIn,
  CheckCircle2,
  XCircle,
  Building2,
  Phone,
  QrCode,
  CalendarCheck,
  AlertCircle,
} from 'lucide-react';
import {
  VisitorRecordDto,
  VisitorSummaryDto,
  VisitorStatus,
} from '@propertyos/types';

export default function VisitorsPage() {
  const [visitors, setVisitors] = useState<VisitorRecordDto[]>([]);
  const [summary, setSummary] = useState<VisitorSummaryDto>({
    totalVisitorsToday: 0,
    activeVisitorsInside: 0,
    expectedVisitors: 0,
    totalVisitorsThisMonth: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'inside' | 'expected' | 'all'>('inside');
  const [searchQuery, setSearchQuery] = useState('');
  const [gatePassSearch, setGatePassSearch] = useState('');
  const [gatePassResult, setGatePassResult] = useState<VisitorRecordDto | null>(null);
  const [gatePassSearching, setGatePassSearching] = useState(false);
  const [gatePassError, setGatePassError] = useState<string | null>(null);

  // Modal states
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [properties, setProperties] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [registerForm, setRegisterForm] = useState({
    propertyId: '',
    tenantId: '',
    visitorName: '',
    visitorPhone: '',
    purpose: '',
    isApproved: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/visitors/summary');
      if (res.ok) {
        const data = await res.json();
        if (data.data) {
          setSummary(data.data);
        }
      }
    } catch (e) {
      console.error('Failed to fetch visitor summary', e);
    }
  }, []);

  const fetchVisitors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = '/api/v1/visitors?limit=100';
      if (activeTab === 'inside') {
        url += '&status=CHECKED_IN';
      } else if (activeTab === 'expected') {
        url += '&status=APPROVED';
      }
      if (searchQuery.trim()) {
        url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to load visitors (${res.status})`);
      }
      const data = await res.json();
      setVisitors(data.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load visitor records');
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery]);

  const fetchFormData = async () => {
    try {
      const [propRes, tenRes] = await Promise.all([
        fetch('/api/v1/properties'),
        fetch('/api/v1/tenants'),
      ]);
      if (propRes.ok) {
        const propData = await propRes.json();
        setProperties(propData.data || []);
        if (propData.data?.length > 0 && !registerForm.propertyId) {
          setRegisterForm((prev) => ({ ...prev, propertyId: propData.data[0].id }));
        }
      }
      if (tenRes.ok) {
        const tenData = await tenRes.json();
        setTenants(tenData.data || []);
        if (tenData.data?.length > 0 && !registerForm.tenantId) {
          setRegisterForm((prev) => ({ ...prev, tenantId: tenData.data[0].id }));
        }
      }
    } catch (e) {
      console.error('Failed to load properties or tenants for modal', e);
    }
  };

  useEffect(() => {
    fetchSummary();
    fetchVisitors();
  }, [fetchSummary, fetchVisitors]);

  const handleGatePassLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gatePassSearch.trim()) return;

    setGatePassSearching(true);
    setGatePassError(null);
    setGatePassResult(null);

    try {
      const res = await fetch(`/api/v1/visitors/gatepass/${encodeURIComponent(gatePassSearch.trim().toUpperCase())}`);
      if (!res.ok) {
        if (res.status === 404) {
          setGatePassError('Gatepass code not found or invalid.');
        } else {
          setGatePassError('Error looking up gatepass.');
        }
        return;
      }
      const data = await res.json();
      setGatePassResult(data.data);
    } catch (err: any) {
      setGatePassError(err.message || 'Failed to search gatepass');
    } finally {
      setGatePassSearching(false);
    }
  };

  const handleCheckIn = async (id: string) => {
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/v1/visitors/${id}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        await Promise.all([fetchSummary(), fetchVisitors()]);
        if (gatePassResult && gatePassResult.id === id) {
          setGatePassResult({ ...gatePassResult, status: 'CHECKED_IN' as VisitorStatus });
        }
      } else {
        const err = await res.json();
        alert(err.message || 'Check-in failed');
      }
    } catch (e) {
      alert('Error during check-in');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCheckOut = async (id: string) => {
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/v1/visitors/${id}/check-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        await Promise.all([fetchSummary(), fetchVisitors()]);
        if (gatePassResult && gatePassResult.id === id) {
          setGatePassResult({
            ...gatePassResult,
            status: 'CHECKED_OUT' as VisitorStatus,
            exitTime: new Date().toISOString(),
          });
        }
      } else {
        const err = await res.json();
        alert(err.message || 'Check-out failed');
      }
    } catch (e) {
      alert('Error during check-out');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleApprove = async (id: string) => {
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/v1/visitors/${id}/approve`, {
        method: 'POST',
      });
      if (res.ok) {
        await Promise.all([fetchSummary(), fetchVisitors()]);
      } else {
        const err = await res.json();
        alert(err.message || 'Approval failed');
      }
    } catch (e) {
      alert('Error approving visitor');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/v1/visitors/${id}/reject`, {
        method: 'POST',
      });
      if (res.ok) {
        await Promise.all([fetchSummary(), fetchVisitors()]);
      } else {
        const err = await res.json();
        alert(err.message || 'Rejection failed');
      }
    } catch (e) {
      alert('Error rejecting visitor');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/visitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm),
      });

      if (res.ok) {
        const data = await res.json();
        setShowRegisterModal(false);
        setRegisterForm({
          propertyId: properties[0]?.id || '',
          tenantId: tenants[0]?.id || '',
          visitorName: '',
          visitorPhone: '',
          purpose: '',
          isApproved: true,
        });
        await Promise.all([fetchSummary(), fetchVisitors()]);
        alert(`Visitor registered! Gatepass Code: ${data.data.gatePassCode}`);
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to register visitor');
      }
    } catch (err: any) {
      alert('Error creating visitor');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: VisitorStatus) => {
    switch (status) {
      case 'CHECKED_IN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Inside Premises
          </span>
        );
      case 'CHECKED_OUT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
            <LogOut className="w-3 h-3" />
            Checked Out
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400 border border-teal-200 dark:border-teal-800">
            <CheckCircle2 className="w-3 h-3" />
            Pre-Approved
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3 h-3" />
            Awaiting Approval
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
            <XCircle className="w-3 h-3" />
            Entry Rejected
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 w-full pb-12">
        <PageHeader
          title="Visitors & Gatepass Console"
          subtitle="Real-time security desk check-ins, resident guest pre-approvals, and verified audit roster"
          icon={ShieldCheck}
          showBack={true}
          backHref="/"
          backLabel="Back to Dashboard"
          actions={
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                fetchFormData();
                setShowRegisterModal(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1.5 inline" />
              Register Visitor / Gatepass
            </Button>
          }
        />

        {/* 4 Summary Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Active Visitors Inside"
            value={summary.activeVisitorsInside}
            subtext="Currently on premises"
            icon={UserCheck}
            variant="emerald"
          />
          <StatCard
            label="Expected Today"
            value={summary.expectedVisitors}
            subtext="Pre-approved guests"
            icon={Clock}
            variant="amber"
          />
          <StatCard
            label="Total Visitors Today"
            value={summary.totalVisitorsToday}
            subtext="Today's gate entries"
            icon={Users}
            variant="teal"
          />
          <StatCard
            label="Total This Month"
            value={summary.totalVisitorsThisMonth}
            subtext="Calendar month total"
            icon={CalendarCheck}
            variant="blue"
          />
        </div>

        {/* Quick Gatepass Verification Bar (Guard Console) */}
        <div className="bg-brand-white dark:bg-surface-dark border border-surface-border rounded-xl p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-brand-teal border border-teal-200 dark:border-teal-800">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-brand-navy dark:text-zinc-100">
                  Quick Gatepass Lookup & Verification
                </h2>
                <p className="text-xs text-surface-textSecondary">
                  Enter 10-character Gatepass code (e.g. GP-20260824-A1B2) for instant entry validation
                </p>
              </div>
            </div>

            <form onSubmit={handleGatePassLookup} className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-72">
                <input
                  type="text"
                  placeholder="Enter Gatepass Code..."
                  value={gatePassSearch}
                  onChange={(e) => setGatePassSearch(e.target.value)}
                  className="w-full pl-3 pr-3 py-2 text-xs rounded-lg border border-surface-border bg-surface-background dark:bg-zinc-800 text-brand-navy dark:text-zinc-100 uppercase font-mono tracking-wider focus:outline-hidden focus:ring-2 focus:ring-brand-teal"
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={gatePassSearching}
              >
                <Search className="w-3.5 h-3.5 mr-1 inline" />
                Lookup
              </Button>
            </form>
          </div>

          {/* Gatepass Lookup Result Card */}
          {gatePassResult && (
            <div className="mt-4 p-4 rounded-xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-brand-teal uppercase px-2 py-0.5 bg-brand-white dark:bg-zinc-800 rounded border border-teal-200">
                    {gatePassResult.gatePassCode}
                  </span>
                  {getStatusBadge(gatePassResult.status)}
                </div>
                <div className="text-sm font-bold text-brand-navy dark:text-zinc-100">
                  {gatePassResult.visitorName} ({gatePassResult.visitorPhone})
                </div>
                <div className="text-xs text-surface-textSecondary">
                  Host Resident: <span className="font-semibold text-brand-navy dark:text-zinc-200">{gatePassResult.tenantName || 'Resident'}</span> • Unit/Room: {gatePassResult.roomOrUnitNumber || gatePassResult.propertyName || 'N/A'} • Purpose: {gatePassResult.purpose}
                </div>
              </div>

              <div className="flex gap-2 shrink-0">
                {gatePassResult.status === 'APPROVED' && (
                  <Button
                    variant="primary"
                    size="sm"
                    isLoading={actionLoadingId === gatePassResult.id}
                    onClick={() => handleCheckIn(gatePassResult.id)}
                  >
                    <LogIn className="w-3.5 h-3.5 mr-1 inline" />
                    Check In Guest
                  </Button>
                )}
                {gatePassResult.status === 'CHECKED_IN' && (
                  <Button
                    variant="danger"
                    size="sm"
                    isLoading={actionLoadingId === gatePassResult.id}
                    onClick={() => handleCheckOut(gatePassResult.id)}
                  >
                    <LogOut className="w-3.5 h-3.5 mr-1 inline" />
                    Log Exit
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setGatePassResult(null)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}

          {gatePassError && (
            <div className="mt-3 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{gatePassError}</span>
            </div>
          )}
        </div>

        {/* Visitor Roster Section */}
        <div className="bg-brand-white dark:bg-surface-dark border border-surface-border rounded-xl shadow-xs overflow-hidden">
          {/* Filter and Tab Header */}
          <div className="p-4 border-b border-surface-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex gap-1 p-1 bg-surface-background dark:bg-zinc-800 rounded-lg">
              <button
                onClick={() => setActiveTab('inside')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  activeTab === 'inside'
                    ? 'bg-brand-white dark:bg-zinc-700 text-brand-navy dark:text-zinc-100 shadow-xs'
                    : 'text-surface-textSecondary hover:text-brand-navy'
                }`}
              >
                Inside Premises ({summary.activeVisitorsInside})
              </button>
              <button
                onClick={() => setActiveTab('expected')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  activeTab === 'expected'
                    ? 'bg-brand-white dark:bg-zinc-700 text-brand-navy dark:text-zinc-100 shadow-xs'
                    : 'text-surface-textSecondary hover:text-brand-navy'
                }`}
              >
                Expected Pre-Approvals ({summary.expectedVisitors})
              </button>
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  activeTab === 'all'
                    ? 'bg-brand-white dark:bg-zinc-700 text-brand-navy dark:text-zinc-100 shadow-xs'
                    : 'text-surface-textSecondary hover:text-brand-navy'
                }`}
              >
                All Records
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-surface-textSecondary" />
              <input
                type="text"
                placeholder="Search visitor, phone, host..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-surface-border bg-surface-background dark:bg-zinc-800 text-brand-navy dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-brand-teal"
              />
            </div>
          </div>

          {/* Roster Table */}
          {loading ? (
            <div className="p-12 text-center text-xs text-surface-textSecondary">
              Loading visitor records...
            </div>
          ) : error ? (
            <div className="p-8 text-center text-xs text-rose-600">
              {error}
            </div>
          ) : visitors.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No visitor records found"
              description={
                activeTab === 'inside'
                  ? 'There are currently no active visitors inside the property premises.'
                  : activeTab === 'expected'
                  ? 'No expected pre-registered visitors awaiting arrival today.'
                  : 'No visitors recorded matching your criteria.'
              }
              actionLabel="Register New Visitor"
              onAction={() => {
                fetchFormData();
                setShowRegisterModal(true);
              }}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-background/50 dark:bg-zinc-800/50 border-b border-surface-border text-surface-textSecondary font-semibold">
                    <th className="py-3 px-4">Gatepass Code</th>
                    <th className="py-3 px-4">Visitor Details</th>
                    <th className="py-3 px-4">Host Resident & Room</th>
                    <th className="py-3 px-4">Purpose</th>
                    <th className="py-3 px-4">Entry / Exit Time</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {visitors.map((visitor) => (
                    <tr key={visitor.id} className="hover:bg-surface-background/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-brand-teal">
                        {visitor.gatePassCode}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-brand-navy dark:text-zinc-100">{visitor.visitorName}</div>
                        <div className="text-surface-textSecondary text-[11px] font-mono">{visitor.visitorPhone}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-brand-navy dark:text-zinc-100">{visitor.tenantName || 'Resident'}</div>
                        <div className="text-surface-textSecondary text-[11px]">
                          {visitor.roomOrUnitNumber ? visitor.roomOrUnitNumber : visitor.propertyName || 'Property Resident'}
                        </div>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-surface-textSecondary">
                        {visitor.purpose}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px]">
                        <div>In: {new Date(visitor.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
                        {visitor.exitTime && (
                          <div className="text-surface-textSecondary">
                            Out: {new Date(visitor.exitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(visitor.status)}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex gap-2 justify-end">
                          {visitor.status === 'CHECKED_IN' && (
                            <Button
                              variant="danger"
                              size="sm"
                              isLoading={actionLoadingId === visitor.id}
                              onClick={() => handleCheckOut(visitor.id)}
                            >
                              Log Exit
                            </Button>
                          )}
                          {visitor.status === 'APPROVED' && (
                            <Button
                              variant="primary"
                              size="sm"
                              isLoading={actionLoadingId === visitor.id}
                              onClick={() => handleCheckIn(visitor.id)}
                            >
                              Check In
                            </Button>
                          )}
                          {visitor.status === 'PENDING' && (
                            <>
                              <Button
                                variant="primary"
                                size="sm"
                                isLoading={actionLoadingId === visitor.id}
                                onClick={() => handleApprove(visitor.id)}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                isLoading={actionLoadingId === visitor.id}
                                onClick={() => handleReject(visitor.id)}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal for registering new visitor */}
        <Modal
          isOpen={showRegisterModal}
          onClose={() => setShowRegisterModal(false)}
          title="Register New Visitor / Generate Gatepass"
        >
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-brand-navy dark:text-zinc-300 mb-1">
                Select Property *
              </label>
              <select
                required
                value={registerForm.propertyId}
                onChange={(e) => setRegisterForm({ ...registerForm, propertyId: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-lg border border-surface-border bg-surface-background dark:bg-zinc-800 text-brand-navy dark:text-zinc-100 focus:ring-2 focus:ring-brand-teal"
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.propertyType})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-navy dark:text-zinc-300 mb-1">
                Host Resident / Tenant *
              </label>
              <select
                required
                value={registerForm.tenantId}
                onChange={(e) => setRegisterForm({ ...registerForm, tenantId: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-lg border border-surface-border bg-surface-background dark:bg-zinc-800 text-brand-navy dark:text-zinc-100 focus:ring-2 focus:ring-brand-teal"
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.firstName} {t.lastName} ({t.phone})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-brand-navy dark:text-zinc-300 mb-1">
                  Visitor Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={registerForm.visitorName}
                  onChange={(e) => setRegisterForm({ ...registerForm, visitorName: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-surface-border bg-surface-background dark:bg-zinc-800 text-brand-navy dark:text-zinc-100 focus:ring-2 focus:ring-brand-teal"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-brand-navy dark:text-zinc-300 mb-1">
                  Visitor Mobile Number *
                </label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  placeholder="10-digit Indian mobile"
                  value={registerForm.visitorPhone}
                  onChange={(e) => setRegisterForm({ ...registerForm, visitorPhone: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-surface-border bg-surface-background dark:bg-zinc-800 text-brand-navy dark:text-zinc-100 focus:ring-2 focus:ring-brand-teal font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-navy dark:text-zinc-300 mb-1">
                Purpose of Visit *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Family visit, Delivery, Study session"
                value={registerForm.purpose}
                onChange={(e) => setRegisterForm({ ...registerForm, purpose: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-lg border border-surface-border bg-surface-background dark:bg-zinc-800 text-brand-navy dark:text-zinc-100 focus:ring-2 focus:ring-brand-teal"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isApprovedCheck"
                checked={registerForm.isApproved}
                onChange={(e) => setRegisterForm({ ...registerForm, isApproved: e.target.checked })}
                className="rounded text-brand-teal focus:ring-brand-teal"
              />
              <label htmlFor="isApprovedCheck" className="text-xs text-brand-navy dark:text-zinc-300">
                Pre-approve this guest for entry immediately
              </label>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-surface-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowRegisterModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={submitting}
              >
                Create Gatepass
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </AppShell>
  );
}
