'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/lib/auth-context';
import {
  BillingChargeDto,
  BillingScheduleDto,
  OrganizationFinancialSummaryDto,
  BillingFrequency,
  ChargeType,
  LedgerEntryDto,
} from '@propertyos/types';
import {
  ReceiptText,
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
  Pause,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  CreditCard,
  Building,
  User,
  Scale,
} from 'lucide-react';

export default function BillingDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'overview' | 'charges' | 'schedules' | 'ledger'>('overview');

  // Summary State
  const [financialSummary, setFinancialSummary] = useState<OrganizationFinancialSummaryDto | null>(null);
  const [charges, setCharges] = useState<BillingChargeDto[]>([]);
  const [schedules, setSchedules] = useState<BillingScheduleDto[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntryDto[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Generate Invoices Modal
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<{ count: number } | null>(null);

  // Create Charge Modal
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [chargeName, setChargeName] = useState('');
  const [chargeType, setChargeType] = useState<ChargeType>(ChargeType.RENT);
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeFreq, setChargeFreq] = useState<BillingFrequency>(BillingFrequency.MONTHLY);
  const [chargeDesc, setChargeDesc] = useState('');
  const [savingCharge, setSavingCharge] = useState(false);

  // Create Schedule Modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedTenantId, setSchedTenantId] = useState('');
  const [schedPropertyId, setSchedPropertyId] = useState('');
  const [schedChargeId, setSchedChargeId] = useState('');
  const [schedAmount, setSchedAmount] = useState('');
  const [schedFreq, setSchedFreq] = useState<BillingFrequency>(BillingFrequency.MONTHLY);
  const [schedStartDate, setSchedStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [savingSchedule, setSavingSchedule] = useState(false);

  const getHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('propertyos_token') : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/financials/organization', {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) setFinancialSummary(json.data);
      }
    } catch {}
  }, []);

  const fetchCharges = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/billing/charges', {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) setCharges(json.data);
      }
    } catch {}
  }, []);

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/billing/schedules', {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) setSchedules(json.data);
      }
    } catch {}
  }, []);

  const fetchLedger = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/ledger', {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) setLedgerEntries(json.data);
      }
    } catch {}
  }, []);

  const fetchDependencies = useCallback(async () => {
    try {
      const [propRes, tenantRes] = await Promise.all([
        fetch('/api/v1/properties', { headers: getHeaders(), credentials: 'include' }),
        fetch('/api/v1/tenants', { headers: getHeaders(), credentials: 'include' }),
      ]);
      if (propRes.ok) {
        const pJson = await propRes.json();
        if (pJson.data) setProperties(pJson.data);
      }
      if (tenantRes.ok) {
        const tJson = await tenantRes.json();
        if (tJson.data) setTenants(tJson.data);
      }
    } catch {}
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchOverview(),
      fetchCharges(),
      fetchSchedules(),
      fetchLedger(),
      fetchDependencies(),
    ]);
    setLoading(false);
  }, [fetchOverview, fetchCharges, fetchSchedules, fetchLedger, fetchDependencies]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Actions
  const handleGenerateInvoices = async () => {
    setGenerating(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/v1/billing/generate-due', {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ asOfDate }),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        setGenerateResult({ count: json.data.generatedCount });
        await loadData();
      } else {
        setErrorMsg(json.message || 'Failed to generate due invoices');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error occurred');
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCharge(true);
    try {
      const res = await fetch('/api/v1/billing/charges', {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          name: chargeName,
          chargeType,
          amount: chargeAmount,
          frequency: chargeFreq,
          description: chargeDesc,
        }),
      });
      if (res.ok) {
        setShowChargeModal(false);
        setChargeName('');
        setChargeAmount('');
        setChargeDesc('');
        await fetchCharges();
      }
    } catch {}
    setSavingCharge(false);
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSchedule(true);
    try {
      const res = await fetch('/api/v1/billing/schedules', {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          tenantId: schedTenantId,
          propertyId: schedPropertyId || undefined,
          chargeId: schedChargeId,
          amount: schedAmount || undefined,
          frequency: schedFreq,
          startDate: schedStartDate,
        }),
      });
      if (res.ok) {
        setShowScheduleModal(false);
        setSchedTenantId('');
        setSchedPropertyId('');
        setSchedChargeId('');
        setSchedAmount('');
        await fetchSchedules();
      }
    } catch {}
    setSavingSchedule(false);
  };

  const handleToggleSchedule = async (schedule: BillingScheduleDto) => {
    const action = schedule.active ? 'pause' : 'resume';
    try {
      await fetch(`/api/v1/billing/schedules/${schedule.id}/${action}`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
      });
      await fetchSchedules();
    } catch {}
  };

  return (
    <AppShell activePath="/billing">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <ReceiptText className="w-7 h-7 text-brand-teal" />
              Billing & Financial Engine
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Automated recurring schedules, invoicing, receipts, and double-entry general ledger
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setGenerateResult(null);
                setShowGenerateModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition shadow-sm"
            >
              <Play className="w-4 h-4" />
              Run Billing Cycle
            </button>
            <Link
              href="/invoices"
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-navy hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition shadow-sm"
            >
              <FileText className="w-4 h-4" />
              View Invoices
            </Link>
            <Link
              href="/payments"
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-teal hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition shadow-sm"
            >
              <CircleDollarSign className="w-4 h-4" />
              Record Payment
            </Link>
          </div>
        </div>

        {/* Global Financial KPI Cards */}
        {financialSummary && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Total Invoiced</span>
                <ReceiptText className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-xl font-bold text-slate-900">₹{Number(financialSummary.totalRevenueInvoiced).toLocaleString()}</p>
              <p className="text-[11px] text-slate-400 mt-1">{financialSummary.totalInvoiceCount} Total Invoices</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Total Collected</span>
                <CircleDollarSign className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-xl font-bold text-emerald-600">₹{Number(financialSummary.totalPaymentsCollected).toLocaleString()}</p>
              <p className="text-[11px] text-slate-400 mt-1">{financialSummary.totalPaymentCount} Payments Recorded</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Outstanding</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-xl font-bold text-amber-600">₹{Number(financialSummary.totalOutstanding).toLocaleString()}</p>
              <p className="text-[11px] text-slate-400 mt-1">Pending tenant payments</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Overdue</span>
                <AlertCircle className="w-4 h-4 text-rose-500" />
              </div>
              <p className="text-xl font-bold text-rose-600">₹{Number(financialSummary.totalOverdue).toLocaleString()}</p>
              <p className="text-[11px] text-rose-500 mt-1">Passed due date</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Deposits Held</span>
                <Shield className="w-4 h-4 text-purple-500" />
              </div>
              <p className="text-xl font-bold text-purple-600">₹{Number(financialSummary.totalDepositsHeld).toLocaleString()}</p>
              <p className="text-[11px] text-slate-400 mt-1">₹{Number(financialSummary.totalRefundsIssued).toLocaleString()} refunded</p>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-white px-4 rounded-t-xl">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition -mb-[2px] flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'border-brand-teal text-brand-teal font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Financial Overview
          </button>
          <button
            onClick={() => setActiveTab('charges')}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition -mb-[2px] flex items-center gap-2 ${
              activeTab === 'charges'
                ? 'border-brand-teal text-brand-teal font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            Charge Definitions ({charges.length})
          </button>
          <button
            onClick={() => setActiveTab('schedules')}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition -mb-[2px] flex items-center gap-2 ${
              activeTab === 'schedules'
                ? 'border-brand-teal text-brand-teal font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Recurring Schedules ({schedules.length})
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition -mb-[2px] flex items-center gap-2 ${
              activeTab === 'ledger'
                ? 'border-brand-teal text-brand-teal font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Scale className="w-4 h-4" />
            General Ledger ({ledgerEntries.length})
          </button>
        </div>

        {/* Tab Content */}
        {loading ? (
          <div className="p-12 flex justify-center items-center text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-brand-teal" />
            <span>Loading billing and financial engine...</span>
          </div>
        ) : (
          <div>
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Active Schedules Snapshot */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-brand-teal" />
                      Active Billing Schedules
                    </h3>
                    <button
                      onClick={() => setShowScheduleModal(true)}
                      className="text-xs text-brand-teal font-medium hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Schedule
                    </button>
                  </div>
                  {schedules.length === 0 ? (
                    <p className="text-sm text-slate-400 py-6 text-center">No billing schedules configured yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {schedules.slice(0, 5).map((sched) => (
                        <div
                          key={sched.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {sched.tenant?.firstName} {sched.tenant?.lastName}
                            </p>
                            <p className="text-xs text-slate-500">
                              {sched.charge?.name} • {sched.frequency}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-slate-900">₹{Number(sched.amount).toLocaleString()}</p>
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                                sched.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {sched.active ? 'ACTIVE' : 'PAUSED'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent General Ledger Activity */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                      <Scale className="w-4 h-4 text-brand-teal" />
                      Double-Entry Audit Stream
                    </h3>
                    <button
                      onClick={() => setActiveTab('ledger')}
                      className="text-xs text-brand-teal font-medium hover:underline flex items-center gap-1"
                    >
                      View All
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {ledgerEntries.length === 0 ? (
                    <p className="text-sm text-slate-400 py-6 text-center">No ledger entries recorded yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {ledgerEntries.slice(0, 5).map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 text-xs"
                        >
                          <div>
                            <span className="font-semibold text-slate-800">{entry.accountType}</span>
                            <p className="text-[11px] text-slate-400 truncate max-w-xs">{entry.description || entry.entryType}</p>
                          </div>
                          <div className="text-right">
                            {Number(entry.debitAmount) > 0 ? (
                              <span className="text-blue-600 font-bold">DR ₹{Number(entry.debitAmount).toLocaleString()}</span>
                            ) : (
                              <span className="text-emerald-600 font-bold">CR ₹{Number(entry.creditAmount).toLocaleString()}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CHARGES TAB */}
            {activeTab === 'charges' && (
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold text-slate-800">Charge Definitions</h3>
                    <p className="text-xs text-slate-500">Master templates for recurring or ad-hoc property charges</p>
                  </div>
                  <button
                    onClick={() => setShowChargeModal(true)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-teal text-white rounded-lg text-xs font-semibold hover:bg-teal-700 transition"
                  >
                    <Plus className="w-4 h-4" />
                    Add Charge
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase bg-slate-50">
                        <th className="p-3">Name</th>
                        <th className="p-3">Charge Type</th>
                        <th className="p-3">Default Amount</th>
                        <th className="p-3">Frequency</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {charges.map((charge) => (
                        <tr key={charge.id} className="hover:bg-slate-50/80">
                          <td className="p-3 font-semibold text-slate-900">{charge.name}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700 font-medium">
                              {charge.chargeType}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-slate-900">₹{Number(charge.amount).toLocaleString()}</td>
                          <td className="p-3 text-slate-600">{charge.frequency}</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                charge.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {charge.isActive ? 'ACTIVE' : 'ARCHIVED'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SCHEDULES TAB */}
            {activeTab === 'schedules' && (
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold text-slate-800">Recurring Billing Schedules</h3>
                    <p className="text-xs text-slate-500">Automated recurring billing cycles mapped to tenants</p>
                  </div>
                  <button
                    onClick={() => setShowScheduleModal(true)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-teal text-white rounded-lg text-xs font-semibold hover:bg-teal-700 transition"
                  >
                    <Plus className="w-4 h-4" />
                    New Schedule
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase bg-slate-50">
                        <th className="p-3">Tenant</th>
                        <th className="p-3">Property</th>
                        <th className="p-3">Charge</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Frequency</th>
                        <th className="p-3">Next Billing Date</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {schedules.map((schedule) => (
                        <tr key={schedule.id} className="hover:bg-slate-50/80">
                          <td className="p-3 font-semibold text-slate-900">
                            {schedule.tenant?.firstName} {schedule.tenant?.lastName}
                          </td>
                          <td className="p-3 text-slate-600">{schedule.property?.name || '—'}</td>
                          <td className="p-3 text-slate-800">{schedule.charge?.name}</td>
                          <td className="p-3 font-bold text-slate-900">₹{Number(schedule.amount).toLocaleString()}</td>
                          <td className="p-3 text-slate-600">{schedule.frequency}</td>
                          <td className="p-3 text-slate-600">
                            {schedule.nextBillingDate
                              ? new Date(schedule.nextBillingDate).toLocaleDateString()
                              : '—'}
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                schedule.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {schedule.active ? 'ACTIVE' : 'PAUSED'}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleToggleSchedule(schedule)}
                              className="px-2.5 py-1 text-xs font-semibold rounded border border-slate-200 hover:bg-slate-100 text-slate-700"
                            >
                              {schedule.active ? 'Pause' : 'Resume'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* GENERAL LEDGER TAB */}
            {activeTab === 'ledger' && (
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold text-slate-800">Double-Entry General Ledger</h3>
                    <p className="text-xs text-slate-500">Immutable, balanced audit entries for financial mutations</p>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                    Balanced Transaction Invariant Guaranteed
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase bg-slate-50">
                        <th className="p-3">Date</th>
                        <th className="p-3">Account</th>
                        <th className="p-3">Entry Type</th>
                        <th className="p-3">Reference</th>
                        <th className="p-3">Description</th>
                        <th className="p-3 text-right">Debit (DR)</th>
                        <th className="p-3 text-right">Credit (CR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ledgerEntries.map((entry) => (
                        <tr key={entry.id} className="hover:bg-slate-50/80 text-xs">
                          <td className="p-3 text-slate-600">{new Date(entry.createdAt).toLocaleDateString()}</td>
                          <td className="p-3 font-semibold text-slate-900">{entry.accountType}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700 font-medium">
                              {entry.entryType}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500 font-mono">{entry.reference || '—'}</td>
                          <td className="p-3 text-slate-700">{entry.description || '—'}</td>
                          <td className="p-3 text-right font-bold text-blue-600">
                            {Number(entry.debitAmount) > 0 ? `₹${Number(entry.debitAmount).toLocaleString()}` : '—'}
                          </td>
                          <td className="p-3 text-right font-bold text-emerald-600">
                            {Number(entry.creditAmount) > 0 ? `₹${Number(entry.creditAmount).toLocaleString()}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* RUN BILLING CYCLE MODAL */}
        {showGenerateModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <Play className="w-5 h-5 text-emerald-600" />
                  Run Automated Billing Cycle
                </h3>
                <button onClick={() => setShowGenerateModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-500">
                This will evaluate all active recurring schedules due on or before the specified date, automatically generate draft invoices, and advance schedule billing dates.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Billing As-Of Date</label>
                <input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-brand-teal"
                />
              </div>

              {generateResult && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  Successfully processed! {generateResult.count} invoice(s) generated.
                </div>
              )}

              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
                  {errorMsg}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleGenerateInvoices}
                  disabled={generating}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
                >
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Execute Cycle
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CREATE CHARGE MODAL */}
        {showChargeModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-brand-teal" />
                  Create Charge Definition
                </h3>
                <button onClick={() => setShowChargeModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateCharge} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Charge Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Monthly Standard Rent"
                    value={chargeName}
                    onChange={(e) => setChargeName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-brand-teal"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Charge Type</label>
                    <select
                      value={chargeType}
                      onChange={(e) => setChargeType(e.target.value as ChargeType)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-brand-teal"
                    >
                      <option value={ChargeType.RENT}>RENT</option>
                      <option value={ChargeType.MAINTENANCE}>MAINTENANCE</option>
                      <option value={ChargeType.UTILITY}>UTILITY</option>
                      <option value={ChargeType.SECURITY_DEPOSIT}>SECURITY_DEPOSIT</option>
                      <option value={ChargeType.OTHER}>OTHER</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Frequency</label>
                    <select
                      value={chargeFreq}
                      onChange={(e) => setChargeFreq(e.target.value as BillingFrequency)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-brand-teal"
                    >
                      <option value={BillingFrequency.MONTHLY}>MONTHLY</option>
                      <option value={BillingFrequency.WEEKLY}>WEEKLY</option>
                      <option value={BillingFrequency.DAILY}>DAILY</option>
                      <option value={BillingFrequency.QUARTERLY}>QUARTERLY</option>
                      <option value={BillingFrequency.YEARLY}>YEARLY</option>
                      <option value={BillingFrequency.ONE_TIME}>ONE_TIME</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Default Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="10000.00"
                    value={chargeAmount}
                    onChange={(e) => setChargeAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-brand-teal"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Description (Optional)</label>
                  <textarea
                    rows={2}
                    value={chargeDesc}
                    onChange={(e) => setChargeDesc(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-brand-teal"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowChargeModal(false)}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingCharge}
                    className="px-4 py-2 bg-brand-teal hover:bg-teal-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
                  >
                    {savingCharge && <Loader2 className="w-4 h-4 animate-spin" />}
                    Save Charge
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* CREATE SCHEDULE MODAL */}
        {showScheduleModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-brand-teal" />
                  Create Billing Schedule
                </h3>
                <button onClick={() => setShowScheduleModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSchedule} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tenant</label>
                  <select
                    required
                    value={schedTenantId}
                    onChange={(e) => setSchedTenantId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-brand-teal"
                  >
                    <option value="">Select Tenant</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.firstName} {t.lastName} ({t.phone})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Property (Optional)</label>
                  <select
                    value={schedPropertyId}
                    onChange={(e) => setSchedPropertyId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-brand-teal"
                  >
                    <option value="">Select Property</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Charge Definition</label>
                  <select
                    required
                    value={schedChargeId}
                    onChange={(e) => {
                      setSchedChargeId(e.target.value);
                      const found = charges.find((c) => c.id === e.target.value);
                      if (found) {
                        setSchedAmount(found.amount);
                        setSchedFreq(found.frequency);
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-brand-teal"
                  >
                    <option value="">Select Charge</option>
                    {charges.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — ₹{Number(c.amount).toLocaleString()} ({c.frequency})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={schedAmount}
                      onChange={(e) => setSchedAmount(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-brand-teal"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Frequency</label>
                    <select
                      value={schedFreq}
                      onChange={(e) => setSchedFreq(e.target.value as BillingFrequency)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-brand-teal"
                    >
                      <option value={BillingFrequency.MONTHLY}>MONTHLY</option>
                      <option value={BillingFrequency.WEEKLY}>WEEKLY</option>
                      <option value={BillingFrequency.DAILY}>DAILY</option>
                      <option value={BillingFrequency.QUARTERLY}>QUARTERLY</option>
                      <option value={BillingFrequency.YEARLY}>YEARLY</option>
                      <option value={BillingFrequency.ONE_TIME}>ONE_TIME</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={schedStartDate}
                    onChange={(e) => setSchedStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-brand-teal"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowScheduleModal(false)}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingSchedule}
                    className="px-4 py-2 bg-brand-teal hover:bg-teal-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
                  >
                    {savingSchedule && <Loader2 className="w-4 h-4 animate-spin" />}
                    Save Schedule
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
