'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageTransition } from '@/components/ui/MotionWrapper';
import { useAuth } from '@/lib/auth-context';
import {
  PortfolioDashboardDto,
  PropertyCardDto,
  PropertyType,
} from '@propertyos/types';
import {
  Building2,
  BedDouble,
  Receipt,
  CircleDollarSign,
  AlertTriangle,
  Wrench,
  Calendar,
  Users,
  ArrowRight,
  RefreshCw,
  Clock,
  CheckCircle2,
  Phone,
  Layers,
  Search,
  Lock,
  ShieldCheck,
} from 'lucide-react';

export default function HomePage() {
  const { user, organization, isAuthenticated, isLoading: authLoading } = useAuth();
  const [dashboardData, setDashboardData] = useState<PortfolioDashboardDto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Filter states
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'PG' | 'RENTAL_HOUSE'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionTab, setActionTab] = useState<'ALL' | 'OVERDUE' | 'MAINTENANCE' | 'RENEWALS'>('ALL');

  const fetchDashboard = useCallback(async (isManualRefresh = false) => {
    if (!isAuthenticated) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (typeFilter !== 'ALL') params.append('propertyType', typeFilter);

      const res = await fetch(`/api/v1/dashboard/summary?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) {
        setDashboardData(null);
        setError(null);
        return;
      }

      const json = await res.json();
      if (json.success && json.data) {
        setDashboardData(json.data);
      } else {
        setError(null);
      }
    } catch (err: any) {
      console.warn('Dashboard sync note:', err);
      setError(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [typeFilter, isAuthenticated]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Format INR currency
  const formatINR = (val: string | number | undefined | null) => {
    const num = Number(val || 0);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(num);
  };

  // Filter property cards by search query
  const filteredProperties = (dashboardData?.propertyCards || []).filter((prop: PropertyCardDto) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      prop.name.toLowerCase().includes(q) ||
      prop.code.toLowerCase().includes(q) ||
      prop.city.toLowerCase().includes(q) ||
      prop.address.toLowerCase().includes(q)
    );
  });

  const kpis = dashboardData?.kpis;
  const actionItems = dashboardData?.actionItems;
  const overdueCount = actionItems?.overdueInvoices.length || 0;
  const urgentMaintCount = actionItems?.urgentMaintenance.length || 0;
  const renewalsCount = actionItems?.upcomingRenewals.length || 0;
  const totalActionCount = actionItems?.totalActionItemsCount || 0;

  if (!authLoading && !isAuthenticated) {
    return (
      <AppShell activePath="/">
        <div className="max-w-3xl mx-auto my-12 text-center bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 shadow-sm animate-fadeIn">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 border border-teal-200/80 text-brand-teal flex items-center justify-center mx-auto mb-6">
            <Building2 className="w-8 h-8" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold uppercase tracking-wider mb-4">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Property Operations Platform</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-3">
            Welcome to PropertyOS Enterprise
          </h1>
          <p className="text-sm sm:text-base text-slate-600 max-w-lg mx-auto leading-relaxed mb-8">
            To view live property metrics, cash collections, blended occupancy rates, and operational triage, please sign in to your owner account or register a new enterprise entity.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
            <Link
              href="/login?returnUrl=/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brand-teal hover:bg-teal-700 text-white font-bold text-sm shadow-md shadow-teal-700/10 transition cursor-pointer"
            >
              <span>Sign In to Continue</span>
              <ArrowRight className="w-4 h-4 ml-0.5" />
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
    <AppShell activePath="/">
      {() => (
        <PageTransition className="max-w-7xl mx-auto space-y-8 pb-12">
          {/* Executive Header */}
          <div className="bg-brand-white border border-surface-border rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold tracking-wider uppercase text-brand-teal">
                    Executive Operations
                  </span>
                  <StatusBadge status={organization?.name || 'PropertyOS Multi-Tenant'} variant="active" />
                </div>
                <h1 className="text-2xl font-bold text-brand-navy">
                  Welcome back, {user?.firstName || 'Owner'}
                </h1>
                <p className="text-sm text-surface-textSecondary mt-1">
                  Real-time portfolio command center across all residential and co-living properties.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => fetchDashboard(true)}
                  disabled={loading || refreshing}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-subtle border border-surface-border text-xs font-semibold text-brand-navy hover:bg-slate-100 transition-colors disabled:opacity-50"
                  title="Refresh metrics"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-brand-teal ${refreshing ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>

                <Link
                  href="/reports"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-subtle border border-surface-border text-xs font-semibold text-brand-navy hover:bg-slate-100 transition-colors"
                >
                  <Receipt className="w-3.5 h-3.5 text-brand-teal" />
                  <span>P&L Reports</span>
                </Link>

                <Link
                  href="/properties/new"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-teal text-brand-white text-xs font-semibold hover:bg-teal-700 transition-colors shadow-sm"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Add Property</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                onClick={() => fetchDashboard()}
                className="text-xs font-semibold underline hover:text-rose-900"
              >
                Retry
              </button>
            </div>
          )}

          {/* 5 Executive KPI StatCards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard
              label="Active Properties"
              value={loading ? '-' : `${kpis?.activeProperties || 0} / ${kpis?.totalProperties || 0}`}
              subtext={
                loading
                  ? 'Loading...'
                  : `${kpis?.pgCount || 0} PG Co-Living • ${kpis?.rentalCount || 0} Whole-Unit`
              }
              icon={Building2}
              variant="teal"
            />

            <StatCard
              label="Blended Occupancy"
              value={loading ? '-' : `${kpis?.capacity.blendedOccupancyRate || 0}%`}
              subtext={
                loading
                  ? 'Loading...'
                  : `${(kpis?.capacity.occupiedBeds || 0) + (kpis?.capacity.occupiedUnits || 0)} / ${(kpis?.capacity.totalBeds || 0) + (kpis?.capacity.totalUnits || 0)} Units & Beds`
              }
              icon={BedDouble}
              variant="emerald"
            />

            <StatCard
              label="Monthly Invoiced"
              value={loading ? '-' : formatINR(kpis?.financials.invoicedRevenue)}
              subtext="Current Calendar Month"
              icon={Receipt}
              variant="default"
            />

            <StatCard
              label="Monthly Cash NOI"
              value={loading ? '-' : formatINR(kpis?.financials.netOperatingIncome)}
              subtext={
                loading
                  ? 'Loading...'
                  : `Margin: ${kpis?.financials.operatingMarginPercentage || 0}% • Col: ${formatINR(kpis?.financials.collectedRevenue)}`
              }
              icon={CircleDollarSign}
              variant="teal"
            />

            <StatCard
              label="Receivables Due"
              value={loading ? '-' : formatINR(kpis?.financials.outstandingReceivables)}
              subtext={
                loading
                  ? 'Loading...'
                  : `${overdueCount} Overdue Invoice${overdueCount === 1 ? '' : 's'}`
              }
              icon={AlertTriangle}
              variant={overdueCount > 0 ? 'rose' : 'default'}
            />
          </div>

          {/* Action Items Alert Center */}
          <div className="bg-brand-white border border-surface-border rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-border pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-brand-navy flex items-center gap-2">
                    <span>Action Items & Operational Triage</span>
                    {totalActionCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        {totalActionCount} Urgent
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-surface-textSecondary">
                    Immediate operational matters requiring management attention
                  </p>
                </div>
              </div>

              {/* Action Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-surface-subtle rounded-xl border border-surface-border text-xs">
                <button
                  onClick={() => setActionTab('ALL')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    actionTab === 'ALL'
                      ? 'bg-brand-white text-brand-navy shadow-sm'
                      : 'text-surface-textSecondary hover:text-brand-navy'
                  }`}
                >
                  All ({totalActionCount})
                </button>
                <button
                  onClick={() => setActionTab('OVERDUE')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    actionTab === 'OVERDUE'
                      ? 'bg-brand-white text-rose-700 shadow-sm'
                      : 'text-surface-textSecondary hover:text-brand-navy'
                  }`}
                >
                  Overdue Invoices ({overdueCount})
                </button>
                <button
                  onClick={() => setActionTab('MAINTENANCE')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    actionTab === 'MAINTENANCE'
                      ? 'bg-brand-white text-amber-700 shadow-sm'
                      : 'text-surface-textSecondary hover:text-brand-navy'
                  }`}
                >
                  Urgent Tickets ({urgentMaintCount})
                </button>
                <button
                  onClick={() => setActionTab('RENEWALS')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    actionTab === 'RENEWALS'
                      ? 'bg-brand-white text-brand-teal shadow-sm'
                      : 'text-surface-textSecondary hover:text-brand-navy'
                  }`}
                >
                  Lease Renewals ({renewalsCount})
                </button>
              </div>
            </div>

            {/* Action Items List */}
            {totalActionCount === 0 ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-brand-navy">Portfolio Running Smoothly</h3>
                <p className="text-xs text-surface-textSecondary mt-1">
                  Zero overdue invoices, urgent maintenance tickets, or immediate lease expirations.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* 1. Overdue Invoices */}
                {(actionTab === 'ALL' || actionTab === 'OVERDUE') &&
                  actionItems?.overdueInvoices.slice(0, 3).map((inv) => (
                    <div
                      key={`overdue-${inv.id}`}
                      className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-50 transition-colors flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">
                            {inv.daysOverdue} Days Overdue
                          </span>
                          <span className="text-xs font-mono font-bold text-rose-700">
                            {formatINR(inv.outstandingAmount)}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-brand-navy truncate">{inv.tenantName}</h4>
                        <p className="text-xs text-surface-textSecondary truncate">{inv.propertyName}</p>
                        {inv.tenantPhone && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{inv.tenantPhone}</span>
                          </div>
                        )}
                      </div>
                      <div className="mt-3 pt-2 border-t border-rose-200/60 flex items-center justify-between text-xs">
                        <span className="text-[11px] text-slate-500 font-mono">{inv.invoiceNumber}</span>
                        <Link
                          href={`/invoices`}
                          className="font-semibold text-rose-700 hover:text-rose-900 flex items-center gap-1"
                        >
                          <span>Collect</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  ))}

                {/* 2. Urgent Maintenance Tickets */}
                {(actionTab === 'ALL' || actionTab === 'MAINTENANCE') &&
                  actionItems?.urgentMaintenance.slice(0, 3).map((tkt) => (
                    <div
                      key={`urgent-${tkt.id}`}
                      className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-50 transition-colors flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                            {tkt.priority} Priority
                          </span>
                          <span className="text-xs text-amber-800 font-medium">{tkt.locationDisplay}</span>
                        </div>
                        <h4 className="text-sm font-bold text-brand-navy line-clamp-1">{tkt.title}</h4>
                        <p className="text-xs text-surface-textSecondary truncate">{tkt.propertyName}</p>
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>Logged {tkt.ageInDays} day{tkt.ageInDays === 1 ? '' : 's'} ago</span>
                        </div>
                      </div>
                      <div className="mt-3 pt-2 border-t border-amber-200/60 flex items-center justify-between text-xs">
                        <span className="text-[11px] text-slate-500 font-mono">{tkt.ticketNumber}</span>
                        <Link
                          href={`/maintenance/${tkt.id}`}
                          className="font-semibold text-amber-800 hover:text-amber-950 flex items-center gap-1"
                        >
                          <span>View Ticket</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  ))}

                {/* 3. Upcoming Renewals */}
                {(actionTab === 'ALL' || actionTab === 'RENEWALS') &&
                  actionItems?.upcomingRenewals.slice(0, 3).map((lease) => (
                    <div
                      key={`renewal-${lease.id}`}
                      className="p-4 rounded-xl border border-teal-200 bg-teal-50/50 hover:bg-teal-50 transition-colors flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-teal-100 text-teal-800 border border-teal-300">
                            {lease.daysRemaining} Days Left
                          </span>
                          <span className="text-xs font-semibold text-teal-800">
                            Unit {lease.unitNumber || 'Main'}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-brand-navy truncate">{lease.tenantName}</h4>
                        <p className="text-xs text-surface-textSecondary truncate">{lease.propertyName}</p>
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>Expires {new Date(lease.endDate).toLocaleDateString('en-IN')}</span>
                        </div>
                      </div>
                      <div className="mt-3 pt-2 border-t border-teal-200/60 flex items-center justify-between text-xs">
                        <span className="text-[11px] text-slate-500 font-semibold">{formatINR(lease.monthlyRent)}/mo</span>
                        <Link
                          href={`/tenants/${lease.tenantId}`}
                          className="font-semibold text-brand-teal hover:text-teal-900 flex items-center gap-1"
                        >
                          <span>Renew Lease</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Property Performance Matrix */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-brand-navy">Portfolio Property Performance</h2>
                <p className="text-xs text-surface-textSecondary">
                  Health, occupancy capacity, and monthly financial performance by property
                </p>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search property or city..."
                    className="pl-8 pr-3 py-1.5 rounded-lg border border-surface-border text-xs focus:outline-none focus:ring-1 focus:ring-brand-teal w-48 bg-brand-white"
                  />
                </div>

                <div className="flex items-center p-1 rounded-lg bg-surface-subtle border border-surface-border text-xs font-semibold">
                  <button
                    onClick={() => setTypeFilter('ALL')}
                    className={`px-3 py-1 rounded-md transition-all ${
                      typeFilter === 'ALL'
                        ? 'bg-brand-white text-brand-navy shadow-sm'
                        : 'text-surface-textSecondary hover:text-brand-navy'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setTypeFilter('PG')}
                    className={`px-3 py-1 rounded-md transition-all ${
                      typeFilter === 'PG'
                        ? 'bg-brand-white text-brand-navy shadow-sm'
                        : 'text-surface-textSecondary hover:text-brand-navy'
                    }`}
                  >
                    PG Co-Living
                  </button>
                  <button
                    onClick={() => setTypeFilter('RENTAL_HOUSE')}
                    className={`px-3 py-1 rounded-md transition-all ${
                      typeFilter === 'RENTAL_HOUSE'
                        ? 'bg-brand-white text-brand-navy shadow-sm'
                        : 'text-surface-textSecondary hover:text-brand-navy'
                    }`}
                  >
                    Whole-Unit
                  </button>
                </div>
              </div>
            </div>

            {/* Property Cards Grid */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="h-64 rounded-2xl bg-brand-white border border-surface-border animate-pulse p-6"
                  />
                ))}
              </div>
            ) : filteredProperties.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="No Properties Found"
                description={
                  searchQuery || typeFilter !== 'ALL'
                    ? 'No properties matched your current filter criteria.'
                    : 'Get started by creating your first PG or Whole-Unit rental property.'
                }
                actionLabel={searchQuery || typeFilter !== 'ALL' ? undefined : 'Add First Property'}
                onAction={
                  searchQuery || typeFilter !== 'ALL'
                    ? undefined
                    : () => (window.location.href = '/properties/new')
                }
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProperties.map((prop) => {
                  const isPg = prop.propertyType === PropertyType.PG;
                  return (
                    <div
                      key={prop.id}
                      className="bg-brand-white border border-surface-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
                    >
                      {/* Card Header */}
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            {prop.code}
                          </span>
                          <StatusBadge
                            status={isPg ? 'PG / CO-LIVING' : 'WHOLE-UNIT RENTAL'}
                            variant="active"
                          />
                        </div>
                        <h3 className="text-base font-bold text-brand-navy truncate">{prop.name}</h3>
                        <p className="text-xs text-surface-textSecondary truncate">{prop.address}, {prop.city}</p>
                      </div>

                      {/* Capacity & Occupancy Bar */}
                      <div className="p-3 bg-surface-subtle rounded-xl border border-surface-border space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-surface-textSecondary font-medium">
                            {isPg ? 'Bed Capacity' : 'Unit Capacity'}:
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-brand-navy">
                              {prop.capacity.occupied} / {prop.capacity.total} ({prop.capacity.occupancyRate}%)
                            </span>
                            <StatusBadge status={prop.capacity.statusBadge} />
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              prop.capacity.occupancyRate >= 80
                                ? 'bg-emerald-500'
                                : prop.capacity.occupancyRate >= 50
                                ? 'bg-brand-teal'
                                : prop.capacity.occupancyRate > 0
                                ? 'bg-amber-500'
                                : 'bg-slate-300'
                            }`}
                            style={{ width: `${Math.min(100, prop.capacity.occupancyRate)}%` }}
                          />
                        </div>
                      </div>

                      {/* Current Month Financials & Operational Health */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-lg bg-surface-subtle border border-surface-border">
                          <span className="text-[10px] font-semibold text-surface-textSecondary uppercase tracking-wider block">
                            Month Invoiced
                          </span>
                          <span className="font-bold text-brand-navy mt-0.5 block">
                            {formatINR(prop.financials.invoicedRevenue)}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-lg bg-surface-subtle border border-surface-border">
                          <span className="text-[10px] font-semibold text-surface-textSecondary uppercase tracking-wider block">
                            Month Net Income
                          </span>
                          <span
                            className={`font-bold mt-0.5 block ${
                              Number(prop.financials.netIncome) >= 0 ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {formatINR(prop.financials.netIncome)}
                          </span>
                        </div>
                      </div>

                      {/* Maintenance & Pending Invoices Indicators */}
                      <div className="flex items-center justify-between text-xs pt-2 border-t border-surface-border text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Wrench className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {prop.maintenance.openCount + prop.maintenance.inProgressCount} Open Ticket
                            {prop.maintenance.openCount + prop.maintenance.inProgressCount === 1 ? '' : 's'}
                          </span>
                          {prop.maintenance.hasUrgent && (
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="Has Urgent Tickets" />
                          )}
                        </div>

                        {Number(prop.pendingInvoicesAmount) > 0 ? (
                          <span className="text-rose-600 font-semibold">
                            {formatINR(prop.pendingInvoicesAmount)} Due
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-medium">All Settled</span>
                        )}
                      </div>

                      {/* Card Footer Actions */}
                      <div className="pt-2 border-t border-surface-border flex items-center justify-between">
                        <Link
                          href={isPg ? `/properties/${prop.id}/floors` : `/properties/${prop.id}/units`}
                          className="text-xs font-semibold text-slate-600 hover:text-brand-navy"
                        >
                          {isPg ? 'Rooms & Beds' : 'Units & Leases'}
                        </Link>

                        <Link
                          href={`/properties/${prop.id}`}
                          className="text-xs font-bold text-brand-teal hover:text-teal-800 flex items-center gap-1"
                        >
                          <span>Manage Property</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Operational Activity Stream */}
          {dashboardData?.recentActivity && dashboardData.recentActivity.length > 0 && (
            <div className="bg-brand-white border border-surface-border rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-surface-border pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-teal-100 text-brand-teal flex items-center justify-center">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-brand-navy">Recent Operational Activity</h3>
                    <p className="text-xs text-surface-textSecondary">
                      Chronological stream of recent payments, maintenance updates, and resident check-ins
                    </p>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-surface-border">
                {dashboardData.recentActivity.map((act) => (
                  <div key={act.id} className="py-3 flex items-start justify-between gap-4 text-xs">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {act.type === 'PAYMENT_RECEIVED' && (
                          <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                            <CircleDollarSign className="w-3.5 h-3.5" />
                          </div>
                        )}
                        {act.type === 'MAINTENANCE_CREATED' && (
                          <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                            <Wrench className="w-3.5 h-3.5" />
                          </div>
                        )}
                        {act.type === 'MAINTENANCE_COMPLETED' && (
                          <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </div>
                        )}
                        {act.type === 'TENANT_CHECKED_IN' && (
                          <div className="w-6 h-6 rounded-full bg-teal-100 text-brand-teal flex items-center justify-center">
                            <Users className="w-3.5 h-3.5" />
                          </div>
                        )}
                        {act.type === 'EXPENSE_RECORDED' && (
                          <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center">
                            <Receipt className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>

                      <div>
                        <span className="font-bold text-brand-navy block">{act.title}</span>
                        <span className="text-slate-600 block mt-0.5">{act.description}</span>
                        {act.propertyName && (
                          <span className="text-[11px] text-slate-400 mt-0.5 block">
                            Property: {act.propertyName}
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="text-[11px] text-slate-400 shrink-0 font-medium">
                      {new Date(act.timestamp).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </PageTransition>
      )}
    </AppShell>
  );
}
