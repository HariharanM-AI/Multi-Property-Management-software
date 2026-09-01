'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { BackButton } from '@/components/ui/BackButton';
import { useAuth } from '@/lib/auth-context';
import {
  OrganizationFinancialSummaryDto,
  PropertyFinancialSummaryDto,
} from '@propertyos/types';
import {
  Zap,
  TrendingUp,
  Building,
  CircleDollarSign,
  ReceiptText,
  Clock,
  AlertCircle,
  Shield,
  Loader2,
  Users,
  ArrowUpRight,
  BarChart3,
  Percent,
  Plus,
  LogIn,
  FileSpreadsheet,
} from 'lucide-react';

export default function FinancialsDashboardPage() {
  const { user, isAuthenticated } = useAuth();

  const [orgSummary, setOrgSummary] = useState<OrganizationFinancialSummaryDto | null>(null);
  const [properties, setProperties] = useState<any[]>([]);
  const [propertySummaries, setPropertySummaries] = useState<
    (PropertyFinancialSummaryDto & { propertyName: string; propertyCode: string })[]
  >([]);

  const [loading, setLoading] = useState(true);

  const fetchFinancials = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Org summary
      const orgRes = await fetch('/api/v1/financials/organization', {
        credentials: 'include',
      });
      if (orgRes.ok) {
        const json = await orgRes.json();
        if (json.data) setOrgSummary(json.data);
      }

      // 2. Fetch Properties
      const propRes = await fetch('/api/v1/properties', {
        credentials: 'include',
      });
      if (propRes.ok) {
        const pJson = await propRes.json();
        if (pJson.data) {
          setProperties(pJson.data);

          // Fetch financial summary for each property
          const summaries = await Promise.all(
            pJson.data.map(async (prop: any) => {
              try {
                const sRes = await fetch(`/api/v1/financials/property/${prop.id}`, {
                  credentials: 'include',
                });
                if (sRes.ok) {
                  const sJson = await sRes.json();
                  return {
                    ...sJson.data,
                    propertyName: prop.name,
                    propertyCode: prop.code,
                  };
                }
              } catch {}
              return null;
            })
          );

          setPropertySummaries(summaries.filter(Boolean) as any);
        }
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFinancials();
  }, [fetchFinancials]);

  const calculateCollectionRate = (invoiced: string = '0', collected: string = '0') => {
    const inv = Number(invoiced) || 0;
    const col = Number(collected) || 0;
    if (inv === 0) return 100;
    return Math.min(Math.round((col / inv) * 100), 100);
  };

  const displaySummary = orgSummary || {
    organizationId: '',
    totalRevenueInvoiced: '0',
    totalPaymentsCollected: '0',
    totalOutstanding: '0',
    totalOverdue: '0',
    totalDepositsHeld: '0',
    totalRefundsIssued: '0',
    totalInvoiceCount: 0,
    totalPaymentCount: 0,
  };

  return (
    <AppShell activePath="/financials">
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Navigation Back Button */}
        <div className="flex items-center justify-between">
          <BackButton fallbackHref="/" label="Back to Dashboard" />
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-brand-teal flex items-center justify-center font-bold">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  Financials & Analytics
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Portfolio revenue metrics, collection efficiencies, delinquency tracking, and property breakdown
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/invoices"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
            >
              <ReceiptText className="w-3.5 h-3.5" />
              Invoices
            </Link>
            <Link
              href="/billing"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-teal hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Billing Cycle
            </Link>
          </div>
        </div>

        {/* Unauthenticated Guest Alert Banner */}
        {!user && !loading && (
          <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-brand-teal shrink-0" />
              <div className="text-xs">
                <span className="font-bold block">Viewing Financials in Guest Mode</span>
                <span className="text-slate-300">
                  Sign in with your organization account to view live real-time double-entry ledger analytics and property revenue breakdowns.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/login"
                className="px-3.5 py-1.5 bg-brand-teal hover:bg-teal-600 text-white text-xs font-bold rounded-lg transition"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg transition border border-slate-700"
              >
                Register Org
              </Link>
            </div>
          </div>
        )}

        {/* Global Financial Metrics */}
        {loading ? (
          <div className="p-12 flex justify-center items-center text-slate-400 gap-2 bg-white rounded-2xl border border-slate-200">
            <Loader2 className="w-6 h-6 animate-spin text-brand-teal" />
            <span>Loading financial analytics...</span>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold uppercase tracking-wider">Gross Invoiced</span>
                  <ReceiptText className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  ₹{Number(displaySummary.totalRevenueInvoiced).toLocaleString()}
                </p>
                <div className="text-xs text-slate-400 flex items-center gap-1">
                  <span className="font-semibold text-slate-700">{displaySummary.totalInvoiceCount}</span> total invoices issued
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold uppercase tracking-wider">Collections</span>
                  <CircleDollarSign className="w-5 h-5 text-emerald-500" />
                </div>
                <p className="text-2xl font-bold text-emerald-600">
                  ₹{Number(displaySummary.totalPaymentsCollected).toLocaleString()}
                </p>
                <div className="text-xs text-slate-400 flex items-center gap-1">
                  <span className="font-semibold text-emerald-600">
                    {calculateCollectionRate(displaySummary.totalRevenueInvoiced, displaySummary.totalPaymentsCollected)}%
                  </span>{' '}
                  collection rate
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold uppercase tracking-wider">Outstanding</span>
                  <Clock className="w-5 h-5 text-amber-500" />
                </div>
                <p className="text-2xl font-bold text-amber-600">
                  ₹{Number(displaySummary.totalOutstanding).toLocaleString()}
                </p>
                <div className="text-xs text-amber-600 flex items-center gap-1">
                  <span>₹{Number(displaySummary.totalOverdue).toLocaleString()} overdue</span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold uppercase tracking-wider">Security Deposits</span>
                  <Shield className="w-5 h-5 text-purple-500" />
                </div>
                <p className="text-2xl font-bold text-purple-600">
                  ₹{Number(displaySummary.totalDepositsHeld).toLocaleString()}
                </p>
                <div className="text-xs text-slate-400 flex items-center gap-1">
                  <span>₹{Number(displaySummary.totalRefundsIssued).toLocaleString()} refunded</span>
                </div>
              </div>
            </div>

            {/* Property Breakdown Table */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <Building className="w-5 h-5 text-brand-teal" />
                    Property Financial Performance
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Invoicing, collections, and delinquency metrics per property</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase bg-slate-50">
                      <th className="p-3.5">Property</th>
                      <th className="p-3.5 text-center">Active Tenants</th>
                      <th className="p-3.5 text-right">Invoiced</th>
                      <th className="p-3.5 text-right">Collected</th>
                      <th className="p-3.5 text-right">Outstanding</th>
                      <th className="p-3.5 text-right">Overdue</th>
                      <th className="p-3.5 text-center">Collection Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {propertySummaries.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400 text-xs space-y-2">
                          <FileSpreadsheet className="w-8 h-8 mx-auto text-slate-300" />
                          <p className="font-medium text-slate-600">No property financial transactions recorded yet.</p>
                          <p className="text-[11px] text-slate-400">
                            When invoices, rent collections, or utility charges are processed for your properties, itemized double-entry performance metrics will appear here.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      propertySummaries.map((p) => {
                        const rate = calculateCollectionRate(p.totalInvoiced, p.totalCollected);
                        return (
                          <tr key={p.propertyId} className="hover:bg-slate-50/80 transition">
                            <td className="p-3.5">
                              <p className="font-semibold text-slate-900">{p.propertyName}</p>
                              <p className="text-xs font-mono text-slate-400">{p.propertyCode}</p>
                            </td>
                            <td className="p-3.5 text-center">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                                <Users className="w-3 h-3" />
                                {p.activeTenantCount}
                              </span>
                            </td>
                            <td className="p-3.5 text-right font-semibold text-slate-900">
                              ₹{Number(p.totalInvoiced).toLocaleString()}
                            </td>
                            <td className="p-3.5 text-right font-semibold text-emerald-600">
                              ₹{Number(p.totalCollected).toLocaleString()}
                            </td>
                            <td className="p-3.5 text-right font-semibold text-amber-600">
                              ₹{Number(p.outstandingAmount).toLocaleString()}
                            </td>
                            <td className="p-3.5 text-right font-semibold text-rose-600">
                              {Number(p.overdueAmount) > 0 ? `₹${Number(p.overdueAmount).toLocaleString()}` : '—'}
                            </td>
                            <td className="p-3.5 text-center">
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                  rate >= 80
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : rate >= 50
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-rose-100 text-rose-700'
                                }`}
                              >
                                {rate}%
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
      </div>
    </AppShell>
  );
}
