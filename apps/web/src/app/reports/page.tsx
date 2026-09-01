'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { BackButton } from '@/components/ui/BackButton';
import { useAuth } from '@/lib/auth-context';
import {
  PnlStatementDto,
  OccupancyReportDto,
  PropertyComparisonReportDto,
  CashFlowReportDto,
  ExpenseCategoryType,
  PropertyType,
} from '@propertyos/types';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Building2,
  PieChart,
  CircleDollarSign,
  TrendingUp,
  TrendingDown,
  Receipt,
  Bed,
  Home,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  RefreshCw,
  Loader2,
  Users,
  CheckCircle2,
  BarChart3,
  Percent,
} from 'lucide-react';

const EXPENSE_CATEGORY_COLORS: Record<string, { bg: string; text: string; fill: string }> = {
  SALARY: { bg: 'bg-purple-50', text: 'text-purple-700', fill: 'bg-purple-500' },
  ELECTRICITY: { bg: 'bg-amber-50', text: 'text-amber-700', fill: 'bg-amber-500' },
  WATER: { bg: 'bg-sky-50', text: 'text-sky-700', fill: 'bg-sky-500' },
  FOOD: { bg: 'bg-orange-50', text: 'text-orange-700', fill: 'bg-orange-500' },
  MAINTENANCE: { bg: 'bg-red-50', text: 'text-red-700', fill: 'bg-red-500' },
  CLEANING: { bg: 'bg-teal-50', text: 'text-teal-700', fill: 'bg-teal-500' },
  INTERNET: { bg: 'bg-indigo-50', text: 'text-indigo-700', fill: 'bg-indigo-500' },
  SUPPLIES: { bg: 'bg-emerald-50', text: 'text-emerald-700', fill: 'bg-emerald-500' },
  PROPERTY_TAX: { bg: 'bg-rose-50', text: 'text-rose-700', fill: 'bg-rose-500' },
  OTHER: { bg: 'bg-slate-100', text: 'text-slate-700', fill: 'bg-slate-500' },
};

const REVENUE_CATEGORY_COLORS: Record<string, { bg: string; text: string; fill: string }> = {
  RENT: { bg: 'bg-emerald-50', text: 'text-emerald-700', fill: 'bg-emerald-600' },
  ELECTRICITY: { bg: 'bg-amber-50', text: 'text-amber-700', fill: 'bg-amber-500' },
  MEAL: { bg: 'bg-orange-50', text: 'text-orange-700', fill: 'bg-orange-500' },
  MAINTENANCE: { bg: 'bg-blue-50', text: 'text-blue-700', fill: 'bg-blue-500' },
  SECURITY_DEPOSIT: { bg: 'bg-indigo-50', text: 'text-indigo-700', fill: 'bg-indigo-500' },
  LATE_FEE: { bg: 'bg-rose-50', text: 'text-rose-700', fill: 'bg-rose-500' },
  OTHER: { bg: 'bg-slate-100', text: 'text-slate-700', fill: 'bg-slate-500' },
};

export default function ReportsPage() {
  const { user } = useAuth();

  // State
  const [pnlData, setPnlData] = useState<PnlStatementDto | null>(null);
  const [occupancyData, setOccupancyData] = useState<OccupancyReportDto | null>(null);
  const [comparisonData, setComparisonData] = useState<PropertyComparisonReportDto | null>(null);
  const [cashFlowData, setCashFlowData] = useState<CashFlowReportDto | null>(null);
  const [properties, setProperties] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<'MONTHLY' | 'QUARTERLY' | 'ALL_TIME'>('MONTHLY');
  const [activeTab, setActiveTab] = useState<'PNL' | 'OCCUPANCY' | 'COMPARISON' | 'CASH_FLOW'>('PNL');

  // Format INR Currency Helper
  const formatInr = (val: string | number | undefined | null): string => {
    if (val === undefined || val === null) return '₹ 0.00';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return '₹ 0.00';
    return `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Fetch Properties
  const fetchProperties = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/properties', { credentials: 'include' });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setProperties(json.data);
      }
    } catch (err) {
      console.error('Failed to load properties for reports:', err);
    }
  }, []);

  // Fetch All Financial Reports
  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (selectedPropertyId) {
        params.append('propertyId', selectedPropertyId);
      }

      const [pnlRes, occRes, compRes, cashRes] = await Promise.all([
        fetch(`/api/v1/reports/pnl?${params.toString()}`, { credentials: 'include' }),
        fetch(`/api/v1/reports/occupancy?${params.toString()}`, { credentials: 'include' }),
        fetch(`/api/v1/reports/property-comparison?${params.toString()}`, { credentials: 'include' }),
        fetch(`/api/v1/reports/cash-flow?${params.toString()}`, { credentials: 'include' }),
      ]);

      const [pnlJson, occJson, compJson, cashJson] = await Promise.all([
        pnlRes.json(),
        occRes.json(),
        compRes.json(),
        cashRes.json(),
      ]);

      if (pnlJson.success) setPnlData(pnlJson.data);
      if (occJson.success) setOccupancyData(occJson.data);
      if (compJson.success) setComparisonData(compJson.data);
      if (cashJson.success) setCashFlowData(cashJson.data);

      if (!pnlJson.success && pnlJson.error) {
        setError(pnlJson.error.message || 'Failed to load Profit & Loss statement.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect to reporting service.');
    } finally {
      setLoading(false);
    }
  }, [selectedPropertyId]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // CSV Export Handler
  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      if (selectedPropertyId) params.append('propertyId', selectedPropertyId);

      let reportType = 'pnl';
      if (activeTab === 'OCCUPANCY') reportType = 'occupancy';
      else if (activeTab === 'COMPARISON') reportType = 'property-comparison';
      else if (activeTab === 'CASH_FLOW') reportType = 'cash-flow';

      params.append('type', reportType);
      params.append('format', 'csv');

      const res = await fetch(`/api/v1/reports/export?${params.toString()}`, {
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to export CSV report');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `propertyos_${reportType}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 pb-12">
        {/* Navigation Back Button */}
        <div className="flex items-center justify-between">
          <BackButton fallbackHref="/" label="Back to Dashboard" />
        </div>

        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-teal-50 text-teal-700 rounded-lg border border-teal-200">
                <FileSpreadsheet className="w-6 h-6 text-teal-700" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Profit & Loss & Financial Analytics
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  Authoritative real-time operating profit, income statements, expense breakdown, and occupancy metrics.
                </p>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Property Filter */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm">
              <Building2 className="w-4 h-4 text-slate-400" />
              <select
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                className="bg-transparent border-none text-slate-700 font-medium focus:ring-0 cursor-pointer text-sm outline-none"
              >
                <option value="">All Portfolio Properties</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Refresh Button */}
            <button
              onClick={fetchReports}
              disabled={loading}
              className="p-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg border border-slate-200 transition-colors"
              title="Refresh Analytics"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {/* Export CSV Button */}
            <button
              onClick={handleExportCsv}
              disabled={exporting || loading}
              className="inline-flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white px-4 py-2 rounded-lg font-medium text-sm shadow-sm transition-colors disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>Export CSV Report</span>
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
              <p className="text-sm font-medium">{error}</p>
            </div>
            <button
              onClick={fetchReports}
              className="text-xs bg-rose-100 hover:bg-rose-200 px-3 py-1.5 rounded-md font-semibold text-rose-800 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Executive KPI Summary StatCards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Invoiced Revenue */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Invoiced Revenue
              </span>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-slate-900">
                {loading ? (
                  <div className="h-7 w-28 bg-slate-100 animate-pulse rounded" />
                ) : (
                  formatInr(pnlData?.totalRevenueInvoiced)
                )}
              </div>
              <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                <span>Accrual billings issued</span>
              </div>
            </div>
          </div>

          {/* Card 2: Realized Collections */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Realized Collections
              </span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <CircleDollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-emerald-700">
                {loading ? (
                  <div className="h-7 w-28 bg-slate-100 animate-pulse rounded" />
                ) : (
                  formatInr(pnlData?.totalRevenueCollected)
                )}
              </div>
              <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                <span>Actual cash received</span>
              </div>
            </div>
          </div>

          {/* Card 3: Total Operational Expenses */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Operational Expenses
              </span>
              <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-rose-700">
                {loading ? (
                  <div className="h-7 w-28 bg-slate-100 animate-pulse rounded" />
                ) : (
                  formatInr(pnlData?.totalExpenses)
                )}
              </div>
              <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                <span>Total operational outlays</span>
              </div>
            </div>
          </div>

          {/* Card 4: Net Operating Profit (NOI) */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Net Operating Income (NOI)
              </span>
              <div
                className={`p-2 rounded-lg ${
                  (pnlData?.operatingMarginPercentage ?? 0) >= 0
                    ? 'bg-teal-50 text-teal-700'
                    : 'bg-rose-50 text-rose-700'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div
                className={`text-2xl font-bold ${
                  parseFloat(pnlData?.netOperatingIncome || '0') >= 0
                    ? 'text-teal-800'
                    : 'text-rose-700'
                }`}
              >
                {loading ? (
                  <div className="h-7 w-28 bg-slate-100 animate-pulse rounded" />
                ) : (
                  formatInr(pnlData?.netOperatingIncome)
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-xs font-medium">
                <span
                  className={`px-1.5 py-0.5 rounded font-semibold ${
                    (pnlData?.operatingMarginPercentage ?? 0) >= 0
                      ? 'bg-teal-100 text-teal-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {pnlData?.operatingMarginPercentage ?? 0}% Margin
                </span>
                <span className="text-slate-400">Cash basis</span>
              </div>
            </div>
          </div>
        </div>

        {/* Analytics Section Tabs */}
        <div className="flex border-b border-slate-200 bg-white px-4 pt-3 rounded-t-xl gap-2">
          <button
            onClick={() => setActiveTab('PNL')}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'PNL'
                ? 'border-teal-700 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <PieChart className="w-4 h-4" />
            <span>P&L Statement & Breakdowns</span>
          </button>
          <button
            onClick={() => setActiveTab('OCCUPANCY')}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'OCCUPANCY'
                ? 'border-teal-700 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Bed className="w-4 h-4" />
            <span>Occupancy & Capacity</span>
          </button>
          <button
            onClick={() => setActiveTab('COMPARISON')}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'COMPARISON'
                ? 'border-teal-700 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Property Comparison</span>
          </button>
          <button
            onClick={() => setActiveTab('CASH_FLOW')}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'CASH_FLOW'
                ? 'border-teal-700 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Cash Flow Statement</span>
          </button>
        </div>

        {/* TAB 1: P&L Statement & Category Breakdowns */}
        {activeTab === 'PNL' && (
          <div className="space-y-6">
            {/* Revenue vs Expense Category Breakdown Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue Breakdown */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <h2 className="font-bold text-slate-900">Revenue Breakdown by Source</h2>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    {pnlData?.revenueBreakdown.length || 0} Sources
                  </span>
                </div>

                <div className="mt-4 space-y-4">
                  {pnlData?.revenueBreakdown.length === 0 ? (
                    <div className="py-8 text-center text-sm text-slate-400">
                      No invoiced revenue lines recorded for this period.
                    </div>
                  ) : (
                    pnlData?.revenueBreakdown.map((rev) => {
                      const color = REVENUE_CATEGORY_COLORS[rev.category] || REVENUE_CATEGORY_COLORS.OTHER;
                      return (
                        <div key={rev.category} className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-slate-700">{rev.category}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-slate-400">{rev.count} items</span>
                              <span className="font-bold text-slate-900">{formatInr(rev.amount)}</span>
                              <span className="text-xs font-semibold text-emerald-700 w-12 text-right">
                                {rev.percentage}%
                              </span>
                            </div>
                          </div>
                          {/* Progress bar */}
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${color.fill} rounded-full transition-all duration-500`}
                              style={{ width: `${Math.min(rev.percentage, 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Expense Breakdown */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-rose-500" />
                    <h2 className="font-bold text-slate-900">Expense Breakdown by Category</h2>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    {pnlData?.expenseBreakdown.length || 0} Categories
                  </span>
                </div>

                <div className="mt-4 space-y-4">
                  {pnlData?.expenseBreakdown.length === 0 ? (
                    <div className="py-8 text-center text-sm text-slate-400">
                      No operational expenses recorded for this period.
                    </div>
                  ) : (
                    pnlData?.expenseBreakdown.map((exp) => {
                      const color = EXPENSE_CATEGORY_COLORS[exp.category] || EXPENSE_CATEGORY_COLORS.OTHER;
                      return (
                        <div key={exp.category} className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-slate-700">{exp.category}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-slate-400">{exp.count} bills</span>
                              <span className="font-bold text-slate-900">{formatInr(exp.amount)}</span>
                              <span className="text-xs font-semibold text-rose-700 w-12 text-right">
                                {exp.percentage}%
                              </span>
                            </div>
                          </div>
                          {/* Progress bar */}
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${color.fill} rounded-full transition-all duration-500`}
                              style={{ width: `${Math.min(exp.percentage, 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Monthly Trend Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <h2 className="font-bold text-slate-900">Monthly Financial Progression</h2>
                </div>
                <span className="text-xs text-slate-500">Trailing 12-Month Performance</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-600">
                    <tr>
                      <th className="px-5 py-3.5">Month</th>
                      <th className="px-5 py-3.5">Invoiced (₹)</th>
                      <th className="px-5 py-3.5">Collected (₹)</th>
                      <th className="px-5 py-3.5">Expenses (₹)</th>
                      <th className="px-5 py-3.5">Net Profit (₹)</th>
                      <th className="px-5 py-3.5 text-right">Margin (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pnlData?.trends.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-slate-400">
                          No historical trend data available.
                        </td>
                      </tr>
                    ) : (
                      pnlData?.trends.map((t) => {
                        const isProfitable = parseFloat(t.netOperatingIncome) >= 0;
                        return (
                          <tr key={t.period} className="hover:bg-slate-50/75 transition-colors">
                            <td className="px-5 py-3 font-semibold text-slate-800">{t.period}</td>
                            <td className="px-5 py-3 text-slate-600">{formatInr(t.invoicedRevenue)}</td>
                            <td className="px-5 py-3 font-medium text-emerald-700">
                              {formatInr(t.collectedRevenue)}
                            </td>
                            <td className="px-5 py-3 text-rose-700">{formatInr(t.expenses)}</td>
                            <td
                              className={`px-5 py-3 font-bold ${
                                isProfitable ? 'text-teal-800' : 'text-rose-700'
                              }`}
                            >
                              {formatInr(t.netOperatingIncome)}
                            </td>
                            <td className="px-5 py-3 text-right">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${
                                  t.profitMarginPercentage >= 0
                                    ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}
                              >
                                {t.profitMarginPercentage}%
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Occupancy & Capacity Analytics */}
        {activeTab === 'OCCUPANCY' && (
          <div className="space-y-6">
            {/* Occupancy Rate KPI Widgets */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Blended Portfolio Occupancy */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm text-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Blended Portfolio Occupancy
                </span>
                <div className="text-4xl font-extrabold text-teal-800 mt-2">
                  {occupancyData?.blendedOccupancyRate ?? 0}%
                </div>
                <p className="text-xs text-slate-500 mt-1">Across all PG beds & rental units</p>
              </div>

              {/* PG Bed Utilization */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm text-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  PG Bed Occupancy Rate
                </span>
                <div className="text-4xl font-extrabold text-blue-700 mt-2">
                  {occupancyData?.pgMetrics.occupancyRate ?? 0}%
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {occupancyData?.pgMetrics.occupiedBeds || 0} occupied of{' '}
                  {occupancyData?.pgMetrics.totalBeds || 0} total beds
                </p>
              </div>

              {/* Rental Unit Utilization */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm text-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Rental Unit Occupancy Rate
                </span>
                <div className="text-4xl font-extrabold text-emerald-700 mt-2">
                  {occupancyData?.rentalMetrics.occupancyRate ?? 0}%
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {occupancyData?.rentalMetrics.occupiedUnits || 0} leased of{' '}
                  {occupancyData?.rentalMetrics.totalUnits || 0} total units
                </p>
              </div>
            </div>

            {/* Property Breakdown Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-500" />
                  <h2 className="font-bold text-slate-900">Property Capacity Breakdown</h2>
                </div>
                <span className="text-xs text-slate-500">
                  {occupancyData?.propertyBreakdown.length || 0} Properties
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-600">
                    <tr>
                      <th className="px-5 py-3.5">Property</th>
                      <th className="px-5 py-3.5">Type</th>
                      <th className="px-5 py-3.5">Total Capacity</th>
                      <th className="px-5 py-3.5">Occupied</th>
                      <th className="px-5 py-3.5">Available</th>
                      <th className="px-5 py-3.5 text-right">Occupancy Rate (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {occupancyData?.propertyBreakdown.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-slate-400">
                          No active properties found in this organization.
                        </td>
                      </tr>
                    ) : (
                      occupancyData?.propertyBreakdown.map((p) => (
                        <tr key={p.propertyId} className="hover:bg-slate-50/75 transition-colors">
                          <td className="px-5 py-3">
                            <div className="font-bold text-slate-900">{p.propertyName}</div>
                            <div className="text-xs text-slate-400">{p.propertyCode}</div>
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className={`px-2 py-0.5 text-xs font-semibold rounded ${
                                p.propertyType === 'PG'
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              {p.propertyType}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-slate-700 font-medium">{p.totalCapacity}</td>
                          <td className="px-5 py-3 text-emerald-700 font-bold">{p.occupiedCapacity}</td>
                          <td className="px-5 py-3 text-slate-500">{p.availableCapacity}</td>
                          <td className="px-5 py-3 text-right font-bold text-teal-800">
                            {p.occupancyRate}%
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Multi-Property Performance Comparison */}
        {activeTab === 'COMPARISON' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-slate-500" />
                <h2 className="font-bold text-slate-900">Multi-Property Comparative Financials</h2>
              </div>
              <span className="text-xs text-slate-500">Cross-Portfolio Performance Ranking</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-600">
                  <tr>
                    <th className="px-5 py-3.5">Property</th>
                    <th className="px-5 py-3.5">Type</th>
                    <th className="px-5 py-3.5">Invoiced (₹)</th>
                    <th className="px-5 py-3.5">Collected (₹)</th>
                    <th className="px-5 py-3.5">Expenses (₹)</th>
                    <th className="px-5 py-3.5">Net Operating Income (₹)</th>
                    <th className="px-5 py-3.5">Margin (%)</th>
                    <th className="px-5 py-3.5 text-right">Occupancy (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {comparisonData?.properties.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-slate-400">
                        No property financial comparisons available.
                      </td>
                    </tr>
                  ) : (
                    comparisonData?.properties.map((p) => {
                      const isPositive = parseFloat(p.netOperatingIncome) >= 0;
                      return (
                        <tr key={p.propertyId} className="hover:bg-slate-50/75 transition-colors">
                          <td className="px-5 py-3">
                            <div className="font-bold text-slate-900">{p.propertyName}</div>
                            <div className="text-xs text-slate-400">{p.propertyCode}</div>
                          </td>
                          <td className="px-5 py-3">
                            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-100 text-slate-700">
                              {p.propertyType}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-slate-700">{formatInr(p.totalRevenueInvoiced)}</td>
                          <td className="px-5 py-3 font-medium text-emerald-700">
                            {formatInr(p.totalRevenueCollected)}
                          </td>
                          <td className="px-5 py-3 text-rose-700">{formatInr(p.totalExpenses)}</td>
                          <td
                            className={`px-5 py-3 font-bold ${
                              isPositive ? 'text-teal-800' : 'text-rose-700'
                            }`}
                          >
                            {formatInr(p.netOperatingIncome)}
                          </td>
                          <td className="px-5 py-3 font-semibold text-slate-700">
                            {p.operatingMarginPercentage}%
                          </td>
                          <td className="px-5 py-3 text-right font-bold text-teal-800">
                            {p.occupancyRate}%
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: Realized Cash Flow Statement */}
        {activeTab === 'CASH_FLOW' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Realized Cash Inflows
                </span>
                <div className="text-3xl font-bold text-emerald-700 mt-2">
                  {formatInr(cashFlowData?.realizedInflows)}
                </div>
                <p className="text-xs text-slate-500 mt-1">Tenant payments received</p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Realized Cash Outflows
                </span>
                <div className="text-3xl font-bold text-rose-700 mt-2">
                  {formatInr(cashFlowData?.realizedOutflows)}
                </div>
                <p className="text-xs text-slate-500 mt-1">Direct operational expenses paid</p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Net Realized Cash Flow
                </span>
                <div
                  className={`text-3xl font-bold mt-2 ${
                    parseFloat(cashFlowData?.netCashFlow || '0') >= 0
                      ? 'text-teal-800'
                      : 'text-rose-700'
                  }`}
                >
                  {formatInr(cashFlowData?.netCashFlow)}
                </div>
                <p className="text-xs text-slate-500 mt-1">Cash Inflows - Cash Outflows</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
