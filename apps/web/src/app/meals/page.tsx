'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { BackButton } from '@/components/ui/BackButton';
import { useAuth } from '@/lib/auth-context';
import { getLocalDateString } from '@/lib/date-utils';
import {
  MealPlanDto,
  MealSubscriptionDto,
  MealRecordDto,
  MealChargeDto,
  MealSummaryDto,
  DailyMealMatrixRowDto,
  MealType,
  MealPlanStatus,
  MealSubscriptionStatus,
  MealRecordStatus,
  MealBillingMode,
  BillingFrequency,
  PropertyType,
} from '@propertyos/types';
import {
  UtensilsCrossed,
  Plus,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  CircleDollarSign,
  ArrowRight,
  TrendingUp,
  Shield,
  Layers,
  Calendar,
  Loader2,
  FileText,
  Play,
  RotateCcw,
  Building,
  User,
  X,
  Coffee,
  Sun,
  Moon,
  Check,
  Ban,
  HelpCircle,
  Users,
} from 'lucide-react';

export default function MealsManagementPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [properties, setProperties] = useState<any[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'overview' | 'plans' | 'subscriptions' | 'matrix' | 'charges'>('overview');

  // Summary & Data State
  const [summary, setSummary] = useState<MealSummaryDto | null>(null);
  const [plans, setPlans] = useState<MealPlanDto[]>([]);
  const [subscriptions, setSubscriptions] = useState<MealSubscriptionDto[]>([]);
  const [charges, setCharges] = useState<MealChargeDto[]>([]);
  const [matrix, setMatrix] = useState<DailyMealMatrixRowDto[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);

  // Matrix Filter State
  const [matrixDate, setMatrixDate] = useState(getLocalDateString());
  const [matrixSearch, setMatrixSearch] = useState('');
  const [savingAttendance, setSavingAttendance] = useState(false);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Create Plan Modal State
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planName, setPlanName] = useState('');
  const [planDesc, setPlanDesc] = useState('');
  const [planPrice, setPlanPrice] = useState('');
  const [planFreq, setPlanFreq] = useState<BillingFrequency>(BillingFrequency.MONTHLY);
  const [hasBreakfast, setHasBreakfast] = useState(true);
  const [hasLunch, setHasLunch] = useState(true);
  const [hasDinner, setHasDinner] = useState(true);
  const [savingPlan, setSavingPlan] = useState(false);

  // Create Subscription Modal State
  const [showSubModal, setShowSubModal] = useState(false);
  const [subTenantId, setSubTenantId] = useState('');
  const [subPlanId, setSubPlanId] = useState('');
  const [subStartDate, setSubStartDate] = useState(getLocalDateString());
  const [subEndDate, setSubEndDate] = useState('');
  const [savingSub, setSavingSub] = useState(false);

  // Generate Charges Modal State
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [genPeriodStart, setGenPeriodStart] = useState(getLocalDateString());
  const [genPeriodEnd, setGenPeriodEnd] = useState(getLocalDateString());
  const [genAutoInvoice, setGenAutoInvoice] = useState(true);
  const [generatingCharges, setGeneratingCharges] = useState(false);

  const getHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('propertyos_token') : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  // Load properties on mount
  useEffect(() => {
    async function loadProperties() {
      try {
        const res = await fetch('/api/v1/properties', {
          headers: getHeaders(),
          credentials: 'include',
        });
        if (res.ok) {
          const json = await res.json();
          const list = json.data || json;
          const pgProps = list.filter((p: any) => p.propertyType === PropertyType.PG);
          setProperties(pgProps);
          if (pgProps.length > 0) {
            setSelectedPropertyId(pgProps[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load properties', err);
      }
    }
    loadProperties();
  }, []);

  // Load checked-in tenants for selected property
  useEffect(() => {
    if (!selectedPropertyId) return;
    async function loadTenants() {
      try {
        const res = await fetch(`/api/v1/tenants?propertyId=${selectedPropertyId}`, {
          headers: getHeaders(),
          credentials: 'include',
        });
        if (res.ok) {
          const json = await res.json();
          setTenants(json.data || json);
        }
      } catch (err) {
        console.error('Failed to load tenants', err);
      }
    }
    loadTenants();
  }, [selectedPropertyId]);

  // Load all meals data
  const loadData = useCallback(async () => {
    if (!selectedPropertyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const [sumRes, planRes, subRes, chgRes, matRes] = await Promise.all([
        fetch(`/api/v1/properties/${selectedPropertyId}/meals/summary`, { headers: getHeaders(), credentials: 'include' }),
        fetch(`/api/v1/properties/${selectedPropertyId}/meals/plans`, { headers: getHeaders(), credentials: 'include' }),
        fetch(`/api/v1/properties/${selectedPropertyId}/meals/subscriptions`, { headers: getHeaders(), credentials: 'include' }),
        fetch(`/api/v1/properties/${selectedPropertyId}/meals/charges`, { headers: getHeaders(), credentials: 'include' }),
        fetch(`/api/v1/properties/${selectedPropertyId}/meals/matrix?date=${matrixDate}`, { headers: getHeaders(), credentials: 'include' }),
      ]);

      if (sumRes.ok) {
        const sumJson = await sumRes.json();
        setSummary(sumJson?.data || sumJson);
      }
      if (planRes.ok) {
        const pJson = await planRes.json();
        const raw = pJson?.data || pJson;
        setPlans(Array.isArray(raw) ? raw : []);
      }
      if (subRes.ok) {
        const sJson = await subRes.json();
        const raw = sJson?.data || sJson;
        setSubscriptions(Array.isArray(raw) ? raw : []);
      }
      if (chgRes.ok) {
        const cJson = await chgRes.json();
        const raw = cJson?.data || cJson;
        setCharges(Array.isArray(raw) ? raw : []);
      }
      if (matRes.ok) {
        const mJson = await matRes.json();
        const raw = mJson?.data || mJson;
        setMatrix(Array.isArray(raw) ? raw : []);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch meals data');
    } finally {
      setLoading(false);
    }
  }, [selectedPropertyId, matrixDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handler: Create Meal Plan
  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planName.trim() || !planPrice) return;

    setSavingPlan(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/v1/properties/${selectedPropertyId}/meals/plans`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          name: planName.trim(),
          description: planDesc.trim() || undefined,
          price: parseFloat(planPrice),
          billingFrequency: planFreq,
          hasBreakfast,
          hasLunch,
          hasDinner,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to create meal plan');
      }

      setShowPlanModal(false);
      setPlanName('');
      setPlanDesc('');
      setPlanPrice('');
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSavingPlan(false);
    }
  };

  // Handler: Create Subscription
  const handleCreateSub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subTenantId || !subPlanId) return;

    setSavingSub(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/v1/properties/${selectedPropertyId}/meals/subscriptions`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          tenantId: subTenantId,
          mealPlanId: subPlanId,
          startDate: new Date(subStartDate).toISOString(),
          endDate: subEndDate ? new Date(subEndDate).toISOString() : null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to subscribe tenant');
      }

      setShowSubModal(false);
      setSubTenantId('');
      setSubPlanId('');
      setSubEndDate('');
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSavingSub(false);
    }
  };

  // Handler: Mark Single Attendance in Matrix
  const handleMarkAttendance = async (
    tenantId: string,
    mealType: MealType,
    currentStatus: MealRecordStatus | null | undefined
  ) => {
    const nextStatus =
      currentStatus === MealRecordStatus.CONSUMED
        ? MealRecordStatus.SKIPPED
        : currentStatus === MealRecordStatus.SKIPPED
        ? MealRecordStatus.EXCUSED
        : currentStatus === MealRecordStatus.EXCUSED
        ? MealRecordStatus.NOT_AVAILABLE
        : MealRecordStatus.CONSUMED;

    try {
      const res = await fetch(`/api/v1/properties/${selectedPropertyId}/meals/records`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          tenantId,
          mealDate: new Date(matrixDate).toISOString(),
          mealType,
          status: nextStatus,
        }),
      });

      if (res.ok) {
        // Optimistically update matrix state
        setMatrix((prev) =>
          prev.map((row) => {
            if (row.tenantId === tenantId) {
              const updated = { ...row };
              if (mealType === MealType.BREAKFAST) updated.breakfast = nextStatus;
              if (mealType === MealType.LUNCH) updated.lunch = nextStatus;
              if (mealType === MealType.DINNER) updated.dinner = nextStatus;
              return updated;
            }
            return row;
          })
        );
      }
    } catch (err) {
      console.error('Failed to mark attendance', err);
    }
  };

  // Handler: Bulk Mark All Consumed for Meal Type
  const handleBulkMarkConsumed = async (mealType: MealType) => {
    if (matrix.length === 0) return;
    setSavingAttendance(true);

    try {
      const records = matrix.map((row) => ({
        tenantId: row.tenantId,
        status: MealRecordStatus.CONSUMED,
      }));

      const res = await fetch(`/api/v1/properties/${selectedPropertyId}/meals/records/bulk`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          mealDate: new Date(matrixDate).toISOString(),
          mealType,
          records,
        }),
      });

      if (res.ok) {
        await loadData();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to bulk mark attendance');
    } finally {
      setSavingAttendance(false);
    }
  };

  // Handler: Generate Charges
  const handleGenerateCharges = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneratingCharges(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/v1/properties/${selectedPropertyId}/meals/charges/generate`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          periodStart: new Date(genPeriodStart).toISOString(),
          periodEnd: new Date(genPeriodEnd).toISOString(),
          billingMode: MealBillingMode.SUBSCRIPTION,
          autoInvoice: genAutoInvoice,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to generate meal charges');
      }

      setShowGenerateModal(false);
      await loadData();
      setActiveTab('charges');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setGeneratingCharges(false);
    }
  };

  const filteredMatrix = matrix.filter((row) => {
    if (!matrixSearch.trim()) return true;
    const q = matrixSearch.toLowerCase();
    return (
      row.tenantName.toLowerCase().includes(q) ||
      row.phone.includes(q) ||
      (row.roomNumber && row.roomNumber.toLowerCase().includes(q))
    );
  });

  const getStatusBadge = (status: MealRecordStatus | null | undefined) => {
    if (!status) {
      return (
        <span className="px-2 py-1 text-xs font-semibold rounded bg-slate-100 text-slate-400 border border-slate-200">
          Unmarked
        </span>
      );
    }
    switch (status) {
      case MealRecordStatus.CONSUMED:
        return (
          <span className="px-2 py-1 text-xs font-bold rounded bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
            <Check className="w-3 h-3 text-emerald-700" /> Consumed
          </span>
        );
      case MealRecordStatus.SKIPPED:
        return (
          <span className="px-2 py-1 text-xs font-semibold rounded bg-amber-100 text-amber-800 border border-amber-300">
            Skipped
          </span>
        );
      case MealRecordStatus.EXCUSED:
        return (
          <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-100 text-blue-800 border border-blue-300">
            Excused
          </span>
        );
      case MealRecordStatus.NOT_AVAILABLE:
        return (
          <span className="px-2 py-1 text-xs font-semibold rounded bg-rose-100 text-rose-800 border border-rose-300">
            Unavailable
          </span>
        );
    }
  };

  return (
    <AppShell activePath="/meals">
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        {/* Navigation Back Button */}
        <div className="flex items-center justify-between">
          <BackButton fallbackHref="/" label="Back to Dashboard" />
        </div>

        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-50 text-brand-teal border border-teal-200 rounded-xl">
                <UtensilsCrossed className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-brand-navy">
                  PG Meal Management
                </h1>
                <p className="text-sm text-surface-textSecondary">
                  Mess plans, tenant subscriptions, live daily attendance matrix & automated billing
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Property Selector */}
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
              <Building className="w-4 h-4 text-slate-400" />
              <select
                aria-label="Select PG Property"
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                className="text-sm font-medium text-slate-800 bg-transparent border-none focus:outline-none focus:ring-0 cursor-pointer"
              >
                {properties.length === 0 ? (
                  <option value="">No PG Properties</option>
                ) : (
                  properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))
                )}
              </select>
            </div>

            <button
              onClick={() => setShowSubModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 shadow-sm transition-colors"
            >
              <Users className="w-4 h-4 text-slate-500" />
              <span>Subscribe Tenant</span>
            </button>

            <button
              onClick={() => setShowPlanModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-teal text-white text-sm font-medium hover:bg-teal-700 shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Meal Plan</span>
            </button>
          </div>
        </div>

        {/* Global Error Banner */}
        {errorMsg && (
          <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-between text-rose-800 text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Plans</span>
            <p className="text-2xl font-bold text-slate-900 mt-1">{summary ? summary.activePlansCount : 0}</p>
          </div>

          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Subscriptions</span>
            <p className="text-2xl font-bold text-brand-teal mt-1">{summary ? summary.activeSubscriptionsCount : 0}</p>
          </div>

          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Breakfast</span>
              <Coffee className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-1">{summary ? summary.todayBreakfastCount : 0}</p>
            <p className="text-[11px] text-slate-400">Consumed today</p>
          </div>

          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Lunch</span>
              <Sun className="w-4 h-4 text-orange-500" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-1">{summary ? summary.todayLunchCount : 0}</p>
            <p className="text-[11px] text-slate-400">Consumed today</p>
          </div>

          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dinner</span>
              <Moon className="w-4 h-4 text-indigo-500" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-1">{summary ? summary.todayDinnerCount : 0}</p>
            <p className="text-[11px] text-slate-400">Consumed today</p>
          </div>

          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Meal Revenue</span>
            <p className="text-2xl font-bold text-emerald-600 mt-1">
              ₹{summary ? Number(summary.currentMealRevenue).toLocaleString('en-IN') : 0}
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-slate-200">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', name: 'Overview' },
              { id: 'matrix', name: `Daily Attendance Matrix (${matrix.length})` },
              { id: 'plans', name: `Meal Plans (${plans.length})` },
              { id: 'subscriptions', name: `Subscriptions (${subscriptions.length})` },
              { id: 'charges', name: `Charges & Invoices (${charges.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-brand-teal text-brand-teal'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* TAB CONTENTS */}
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-brand-teal mb-3" />
            <p className="text-sm font-medium">Loading meal management operations...</p>
          </div>
        ) : (
          <>
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Active Plans List */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-800 text-sm">Active Meal Packages</h3>
                    <button
                      onClick={() => setActiveTab('plans')}
                      className="text-xs font-medium text-brand-teal hover:underline"
                    >
                      View all
                    </button>
                  </div>
                  {plans.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">
                      No meal plans configured yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {plans.map((p) => (
                        <div key={p.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                          <div>
                            <h4 className="font-semibold text-slate-900 text-sm">{p.name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              {p.hasBreakfast && (
                                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200 rounded">
                                  Breakfast
                                </span>
                              )}
                              {p.hasLunch && (
                                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-orange-50 text-orange-800 border border-orange-200 rounded">
                                  Lunch
                                </span>
                              )}
                              {p.hasDinner && (
                                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-indigo-50 text-indigo-800 border border-indigo-200 rounded">
                                  Dinner
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-slate-900 text-base">₹{Number(p.price).toFixed(2)}</span>
                            <p className="text-[11px] text-slate-400">/{p.billingFrequency.toLowerCase()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Operations & Subscriptions Summary */}
                <div className="space-y-6">
                  <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-slate-900 text-sm">Meal Operations</h4>
                    </div>
                    <p className="text-xs text-slate-500">
                      Record daily resident meal attendance or generate monthly meal billing charges across active subscriptions.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => setActiveTab('matrix')}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-teal text-white text-xs font-semibold hover:bg-teal-700 transition-colors shadow-sm"
                      >
                        <UtensilsCrossed className="w-3.5 h-3.5" />
                        <span>Attendance Matrix</span>
                      </button>
                      <button
                        onClick={() => setShowGenerateModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 border border-slate-300 transition-colors"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Generate Charges</span>
                      </button>
                    </div>
                  </div>

                  {/* Active Subscriptions Summary */}
                  <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-slate-800 text-sm">Subscription Status</h4>
                      <button onClick={() => setActiveTab('subscriptions')} className="text-xs text-brand-teal hover:underline font-medium">
                        Manage
                      </button>
                    </div>
                    <p className="text-xs text-slate-500">
                      Currently <strong>{(subscriptions || []).filter((s) => s.status === MealSubscriptionStatus.ACTIVE).length}</strong> active tenant subscriptions enrolled in mess plans.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* DAILY ATTENDANCE MATRIX TAB */}
            {activeTab === 'matrix' && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden space-y-4">
                <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <input
                        type="date"
                        aria-label="Attendance Date"
                        value={matrixDate}
                        onChange={(e) => setMatrixDate(e.target.value)}
                        className="text-sm font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-teal"
                      />
                    </div>
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search tenant or room..."
                        value={matrixSearch}
                        onChange={(e) => setMatrixSearch(e.target.value)}
                        className="pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-teal w-48"
                      />
                    </div>
                  </div>

                  {/* Bulk Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleBulkMarkConsumed(MealType.BREAKFAST)}
                      disabled={savingAttendance}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
                    >
                      Bulk Breakfast
                    </button>
                    <button
                      onClick={() => handleBulkMarkConsumed(MealType.LUNCH)}
                      disabled={savingAttendance}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded bg-orange-50 text-orange-800 border border-orange-200 hover:bg-orange-100"
                    >
                      Bulk Lunch
                    </button>
                    <button
                      onClick={() => handleBulkMarkConsumed(MealType.DINNER)}
                      disabled={savingAttendance}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100"
                    >
                      Bulk Dinner
                    </button>
                  </div>
                </div>

                {filteredMatrix.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-sm">
                    No active tenants found for this property on the selected date.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs">
                        <th className="py-3 px-4 font-semibold">Tenant</th>
                        <th className="py-3 px-4 font-semibold">Room / Floor</th>
                        <th className="py-3 px-4 font-semibold">Active Plan</th>
                        <th className="py-3 px-4 font-semibold text-center">Breakfast</th>
                        <th className="py-3 px-4 font-semibold text-center">Lunch</th>
                        <th className="py-3 px-4 font-semibold text-center">Dinner</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredMatrix.map((row) => (
                        <tr key={row.tenantId} className="hover:bg-slate-50">
                          <td className="py-3.5 px-4">
                            <p className="font-semibold text-slate-900">{row.tenantName}</p>
                            <p className="text-xs text-slate-400">{row.phone}</p>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 text-xs">
                            {row.roomNumber ? `Room ${row.roomNumber} (F${row.floorNumber || 0})` : '—'}
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            {row.subscription ? (
                              <span className="font-medium text-slate-800">{row.subscription.planName}</span>
                            ) : (
                              <span className="text-slate-400">No active plan</span>
                            )}
                          </td>
                          {/* Breakfast Button */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => handleMarkAttendance(row.tenantId, MealType.BREAKFAST, row.breakfast)}
                              className="cursor-pointer hover:opacity-80 transition-opacity inline-block"
                            >
                              {getStatusBadge(row.breakfast)}
                            </button>
                          </td>
                          {/* Lunch Button */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => handleMarkAttendance(row.tenantId, MealType.LUNCH, row.lunch)}
                              className="cursor-pointer hover:opacity-80 transition-opacity inline-block"
                            >
                              {getStatusBadge(row.lunch)}
                            </button>
                          </td>
                          {/* Dinner Button */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => handleMarkAttendance(row.tenantId, MealType.DINNER, row.dinner)}
                              className="cursor-pointer hover:opacity-80 transition-opacity inline-block"
                            >
                              {getStatusBadge(row.dinner)}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* PLANS TAB */}
            {activeTab === 'plans' && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800 text-sm">Meal Packages</h3>
                  <button
                    onClick={() => setShowPlanModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-teal text-white text-xs font-medium hover:bg-teal-700"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Plan</span>
                  </button>
                </div>
                {plans.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-sm">
                    No meal plans created yet.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs">
                        <th className="py-3 px-4 font-semibold">Plan Name</th>
                        <th className="py-3 px-4 font-semibold">Price (₹)</th>
                        <th className="py-3 px-4 font-semibold">Billing Frequency</th>
                        <th className="py-3 px-4 font-semibold">Meals Included</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {plans.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="py-3.5 px-4 font-semibold text-slate-900">{p.name}</td>
                          <td className="py-3.5 px-4 font-bold text-slate-900">₹{Number(p.price).toFixed(2)}</td>
                          <td className="py-3.5 px-4 text-slate-600">{p.billingFrequency}</td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              {p.hasBreakfast && (
                                <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-50 text-amber-800 border border-amber-200">
                                  Breakfast
                                </span>
                              )}
                              {p.hasLunch && (
                                <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-orange-50 text-orange-800 border border-orange-200">
                                  Lunch
                                </span>
                              )}
                              {p.hasDinner && (
                                <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-indigo-50 text-indigo-800 border border-indigo-200">
                                  Dinner
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-800">
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* SUBSCRIPTIONS TAB */}
            {activeTab === 'subscriptions' && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800 text-sm">Tenant Meal Subscriptions</h3>
                  <button
                    onClick={() => setShowSubModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-teal text-white text-xs font-medium hover:bg-teal-700"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Subscribe Tenant</span>
                  </button>
                </div>
                {subscriptions.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-sm">
                    No active subscriptions.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs">
                        <th className="py-3 px-4 font-semibold">Tenant</th>
                        <th className="py-3 px-4 font-semibold">Subscribed Plan</th>
                        <th className="py-3 px-4 font-semibold">Start Date</th>
                        <th className="py-3 px-4 font-semibold">End Date</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {subscriptions.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="py-3.5 px-4 font-semibold text-slate-900">
                            {s.tenant ? `${s.tenant.firstName} ${s.tenant.lastName}` : '—'}
                          </td>
                          <td className="py-3.5 px-4 text-slate-700">
                            {s.mealPlan?.name || '—'} (₹{s.mealPlan?.price})
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            {new Date(s.startDate).toLocaleDateString('en-IN')}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            {s.endDate ? new Date(s.endDate).toLocaleDateString('en-IN') : 'Ongoing'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-800">
                              {s.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* CHARGES TAB */}
            {activeTab === 'charges' && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800 text-sm">Meal Invoices & Charges</h3>
                  <button
                    onClick={() => setShowGenerateModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-teal text-white text-xs font-medium hover:bg-teal-700"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Generate Charges</span>
                  </button>
                </div>
                {charges.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-sm">
                    No meal charges recorded.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs">
                        <th className="py-3 px-4 font-semibold">Period</th>
                        <th className="py-3 px-4 font-semibold">Tenant</th>
                        <th className="py-3 px-4 font-semibold">Plan</th>
                        <th className="py-3 px-4 font-semibold text-right">Amount (₹)</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                        <th className="py-3 px-4 font-semibold">Invoice</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {charges.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className="py-3.5 px-4 text-slate-600 text-xs">
                            {new Date(c.periodStart).toLocaleDateString('en-IN')} - {new Date(c.periodEnd).toLocaleDateString('en-IN')}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-900">
                            {c.tenant ? `${c.tenant.firstName} ${c.tenant.lastName}` : '—'}
                          </td>
                          <td className="py-3.5 px-4 text-slate-700">
                            {c.mealPlan?.name || 'Meal Package'}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                            ₹{Number(c.amount).toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                              c.status === 'INVOICED' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {c.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            {c.invoice ? (
                              <Link href="/invoices" className="font-semibold text-brand-teal hover:underline">
                                {c.invoice.invoiceNumber}
                              </Link>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        )}

        {/* MODAL: CREATE PLAN */}
        {showPlanModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-base">Create Meal Plan</h3>
                <button onClick={() => setShowPlanModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreatePlan} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Plan Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Standard 3-Meal Package"
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 3500.00"
                    value={planPrice}
                    onChange={(e) => setPlanPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Billing Frequency</label>
                  <select
                    value={planFreq}
                    onChange={(e) => setPlanFreq(e.target.value as BillingFrequency)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  >
                    <option value={BillingFrequency.MONTHLY}>Monthly</option>
                    <option value={BillingFrequency.DAILY}>Daily</option>
                    <option value={BillingFrequency.QUARTERLY}>Quarterly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">Meals Included</label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasBreakfast}
                        onChange={(e) => setHasBreakfast(e.target.checked)}
                        className="w-4 h-4 text-brand-teal rounded border-slate-300"
                      />
                      Breakfast
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasLunch}
                        onChange={(e) => setHasLunch(e.target.checked)}
                        className="w-4 h-4 text-brand-teal rounded border-slate-300"
                      />
                      Lunch
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasDinner}
                        onChange={(e) => setHasDinner(e.target.checked)}
                        className="w-4 h-4 text-brand-teal rounded border-slate-300"
                      />
                      Dinner
                    </label>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowPlanModal(false)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingPlan}
                    className="px-4 py-2 rounded-lg bg-brand-teal text-white text-sm font-medium hover:bg-teal-700 flex items-center gap-2"
                  >
                    {savingPlan && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Save Plan</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: SUBSCRIBE TENANT */}
        {showSubModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-base">Subscribe Tenant to Meal Plan</h3>
                <button onClick={() => setShowSubModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSub} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Select Tenant *</label>
                  <select
                    required
                    value={subTenantId}
                    onChange={(e) => setSubTenantId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  >
                    <option value="">Select Tenant...</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.firstName} {t.lastName} ({t.phone})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Select Meal Plan *</label>
                  <select
                    required
                    value={subPlanId}
                    onChange={(e) => setSubPlanId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  >
                    <option value="">Select Meal Plan...</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (₹{p.price}/{p.billingFrequency.toLowerCase()})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={subStartDate}
                    onChange={(e) => setSubStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">End Date (Optional)</label>
                  <input
                    type="date"
                    value={subEndDate}
                    onChange={(e) => setSubEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowSubModal(false)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingSub}
                    className="px-4 py-2 rounded-lg bg-brand-teal text-white text-sm font-medium hover:bg-teal-700 flex items-center gap-2"
                  >
                    {savingSub && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Confirm Subscription</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: GENERATE CHARGES */}
        {showGenerateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-base">Generate Meal Charges</h3>
                <button onClick={() => setShowGenerateModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleGenerateCharges} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Period Start *</label>
                    <input
                      type="date"
                      required
                      value={genPeriodStart}
                      onChange={(e) => setGenPeriodStart(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Period End *</label>
                    <input
                      type="date"
                      required
                      value={genPeriodEnd}
                      onChange={(e) => setGenPeriodEnd(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="genAutoInvoiceCheck"
                      checked={genAutoInvoice}
                      onChange={(e) => setGenAutoInvoice(e.target.checked)}
                      className="w-4 h-4 text-brand-teal rounded border-slate-300"
                    />
                    <label htmlFor="genAutoInvoiceCheck" className="text-xs font-semibold text-slate-800 cursor-pointer">
                      Auto-issue CORE-011 Invoices & Ledger Entries
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Directly bills all subscribed PG tenants and creates balanced double-entry ledger entries.
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowGenerateModal(false)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={generatingCharges}
                    className="px-4 py-2 rounded-lg bg-brand-teal text-white text-sm font-medium hover:bg-teal-700 flex items-center gap-2"
                  >
                    {generatingCharges && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Confirm & Generate</span>
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
