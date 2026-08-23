'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
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
} from 'lucide-react';

export default function FinancialsDashboardPage() {
  const { user } = useAuth();

  const [orgSummary, setOrgSummary] = useState<OrganizationFinancialSummaryDto | null>(null);
  const [properties, setProperties] = useState<any[]>([]);
  const [propertySummaries, setPropertySummaries] = useState<
    (PropertyFinancialSummaryDto & { propertyName: string; propertyCode: string })[]
  >([]);

  const [loading, setLoading] = useState(true);

  const getHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('propertyos_token') : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const fetchFinancials = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Org summary
      const orgRes = await fetch('/api/v1/financials/organization', {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (orgRes.ok) {
        const json = await orgRes.json();
        if (json.data) setOrgSummary(json.data);
      }

      // 2. Fetch Properties
      const propRes = await fetch('/api/v1/properties', {
        headers: getHeaders(),
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
                  headers: getHeaders(),
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

  const calculateCollectionRate = (invoiced: string, collected: string) => {
    const inv = Number(invoiced) || 0;
    const col = Number(collected) || 0;
    if (inv === 0) return 100;
    return Math.min(Math.round((col / inv) * 100), 100);
  };

  return (
    <AppShell activePath="/financials">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Zap className="w-7 h-7 text-brand-teal" />
              Financials & Analytics
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Portfolio revenue metrics, collection efficiencies, delinquency tracking, and property breakdown
            </p>
          </div>
        </div>

        {/* Global Financial Metrics */}
        {loading ? (
          <div className="p-12 flex justify-center items-center text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-brand-teal" />
            <span>Loading financial analytics...</span>
          </div>
        ) : orgSummary && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold uppercase tracking-wider">Gross Invoiced</span>
                  <ReceiptText className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  ₹{Number(orgSummary.totalRevenueInvoiced).toLocaleString()}
                </p>
                <div className="text-xs text-slate-400 flex items-center gap-1">
                  <span className="font-semibold text-slate-700">{orgSummary.totalInvoiceCount}</span> total invoices issued
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold uppercase tracking-wider">Collections</span>
                  <CircleDollarSign className="w-5 h-5 text-emerald-500" />
                </div>
                <p className="text-2xl font-bold text-emerald-600">
                  ₹{Number(orgSummary.totalPaymentsCollected).toLocaleString()}
                </p>
                <div className="text-xs text-slate-400 flex items-center gap-1">
                  <span className="font-semibold text-emerald-600">
                    {calculateCollectionRate(orgSummary.totalRevenueInvoiced, orgSummary.totalPaymentsCollected)}%
                  </span>{' '}
                  collection rate
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold uppercase tracking-wider">Outstanding</span>
                  <Clock className="w-5 h-5 text-amber-500" />
                </div>
                <p className="text-2xl font-bold text-amber-600">
                  ₹{Number(orgSummary.totalOutstanding).toLocaleString()}
                </p>
                <div className="text-xs text-amber-600 flex items-center gap-1">
                  <span>₹{Number(orgSummary.totalOverdue).toLocaleString()} overdue</span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold uppercase tracking-wider">Security Deposits</span>
                  <Shield className="w-5 h-5 text-purple-500" />
                </div>
                <p className="text-2xl font-bold text-purple-600">
                  ₹{Number(orgSummary.totalDepositsHeld).toLocaleString()}
                </p>
                <div className="text-xs text-slate-400 flex items-center gap-1">
                  <span>₹{Number(orgSummary.totalRefundsIssued).toLocaleString()} refunded</span>
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
                        <td colSpan={7} className="p-6 text-center text-slate-400 text-xs">
                          No property financial metrics available.
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
