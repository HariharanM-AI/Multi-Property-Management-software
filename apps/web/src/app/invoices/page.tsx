'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/lib/auth-context';
import {
  InvoiceDto,
  InvoiceSummaryDto,
  InvoiceStatus,
  ChargeType,
} from '@propertyos/types';
import {
  FileSpreadsheet,
  Plus,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  XCircle,
  Calendar,
  Loader2,
  X,
  Trash2,
  Send,
  Building,
  User,
} from 'lucide-react';

export default function InvoicesPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [summary, setSummary] = useState<InvoiceSummaryDto | null>(null);
  const [properties, setProperties] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [propertyFilter, setPropertyFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Create Invoice Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formTenantId, setFormTenantId] = useState('');
  const [formPropertyId, setFormPropertyId] = useState('');
  const [formIssueDate, setFormIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [formDueDate, setFormDueDate] = useState(
    new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0]
  );
  const [formNotes, setFormNotes] = useState('');
  const [formAdjustments, setFormAdjustments] = useState('0');
  const [lines, setLines] = useState<
    { description: string; chargeType: ChargeType; quantity: number; unitAmount: string }[]
  >([{ description: 'Rent for current cycle', chargeType: ChargeType.RENT, quantity: 1, unitAmount: '10000' }]);
  const [savingInvoice, setSavingInvoice] = useState(false);

  const getHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('propertyos_token') : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (propertyFilter !== 'ALL') params.append('propertyId', propertyFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await fetch(`/api/v1/invoices?${params.toString()}`, {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) setInvoices(json.data);
      } else {
        setErrorMsg('Failed to load invoices');
      }
    } catch {
      setErrorMsg('Network error loading invoices');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, propertyFilter, searchQuery]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/invoices/summary', {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) setSummary(json.data);
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

  useEffect(() => {
    fetchInvoices();
    fetchSummary();
    fetchDependencies();
  }, [fetchInvoices, fetchSummary, fetchDependencies]);

  // Line item helpers
  const addLine = () => {
    setLines([
      ...lines,
      { description: '', chargeType: ChargeType.MAINTENANCE, quantity: 1, unitAmount: '0' },
    ]);
  };

  const removeLine = (index: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const updateLine = (index: number, field: string, value: any) => {
    const updated = [...lines];
    (updated[index] as any)[field] = value;
    setLines(updated);
  };

  const calculateSubtotal = () => {
    return lines.reduce((sum, line) => {
      const qty = Number(line.quantity) || 0;
      const unit = Number(line.unitAmount) || 0;
      return sum + qty * unit;
    }, 0);
  };

  const calculateTotal = () => {
    const sub = calculateSubtotal();
    const adj = Number(formAdjustments) || 0;
    return Math.max(sub + adj, 0);
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingInvoice(true);
    try {
      const res = await fetch('/api/v1/invoices', {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          tenantId: formTenantId,
          propertyId: formPropertyId || undefined,
          issueDate: formIssueDate,
          dueDate: formDueDate,
          adjustments: formAdjustments,
          notes: formNotes || undefined,
          lines: lines.map((l) => ({
            description: l.description,
            chargeType: l.chargeType,
            quantity: Number(l.quantity),
            unitAmount: l.unitAmount,
          })),
        }),
      });

      const json = await res.json();
      if (res.ok && json.data) {
        setShowCreateModal(false);
        await fetchInvoices();
        await fetchSummary();
        router.push(`/invoices/${json.data.id}`);
      } else {
        alert(json.message || 'Failed to create invoice');
      }
    } catch (err: any) {
      alert(err.message || 'Network error');
    } finally {
      setSavingInvoice(false);
    }
  };

  const getStatusBadge = (status: InvoiceStatus) => {
    switch (status) {
      case InvoiceStatus.DRAFT:
        return <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700 font-semibold">DRAFT</span>;
      case InvoiceStatus.ISSUED:
        return <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700 font-semibold">ISSUED</span>;
      case InvoiceStatus.PARTIALLY_PAID:
        return <span className="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700 font-semibold">PARTIALLY PAID</span>;
      case InvoiceStatus.PAID:
        return <span className="px-2 py-0.5 rounded text-xs bg-emerald-100 text-emerald-700 font-semibold">PAID</span>;
      case InvoiceStatus.OVERDUE:
        return <span className="px-2 py-0.5 rounded text-xs bg-rose-100 text-rose-700 font-semibold">OVERDUE</span>;
      case InvoiceStatus.VOID:
      case InvoiceStatus.CANCELLED:
        return <span className="px-2 py-0.5 rounded text-xs bg-slate-200 text-slate-500 font-semibold line-through">{status}</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700 font-semibold">{status}</span>;
    }
  };

  return (
    <AppShell activePath="/invoices">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <FileSpreadsheet className="w-7 h-7 text-brand-teal" />
              Invoices & Receivables
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Issue tenant invoices, track payment progress, and manage receivable lifecycles
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-teal hover:bg-teal-700 text-white rounded-lg text-sm font-semibold transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create Invoice
          </button>
        </div>

        {/* Summary Stats */}
        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Invoiced</span>
              <p className="text-xl font-bold text-slate-900 mt-1">₹{Number(summary.totalInvoiced).toLocaleString()}</p>
              <p className="text-[11px] text-slate-400">{summary.count} Total Active Invoices</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Collected</span>
              <p className="text-xl font-bold text-emerald-600 mt-1">₹{Number(summary.totalPaid).toLocaleString()}</p>
              <p className="text-[11px] text-slate-400">Allocated payments</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Outstanding Balance</span>
              <p className="text-xl font-bold text-amber-600 mt-1">₹{Number(summary.totalOutstanding).toLocaleString()}</p>
              <p className="text-[11px] text-slate-400">Pending collections</p>
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="flex flex-1 w-full md:w-auto items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search invoice number or tenant..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-brand-teal"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-brand-teal"
            >
              <option value="ALL">All Statuses</option>
              <option value={InvoiceStatus.DRAFT}>DRAFT</option>
              <option value={InvoiceStatus.ISSUED}>ISSUED</option>
              <option value={InvoiceStatus.PARTIALLY_PAID}>PARTIALLY PAID</option>
              <option value={InvoiceStatus.PAID}>PAID</option>
              <option value={InvoiceStatus.OVERDUE}>OVERDUE</option>
              <option value={InvoiceStatus.VOID}>VOID</option>
            </select>

            <select
              value={propertyFilter}
              onChange={(e) => setPropertyFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-brand-teal"
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

        {/* Invoices Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 flex justify-center items-center text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-brand-teal" />
              <span>Loading invoices...</span>
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-40 text-slate-500" />
              <p className="font-semibold text-slate-700">No invoices found</p>
              <p className="text-xs text-slate-400 mt-1">Create your first invoice or run a billing cycle</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase bg-slate-50">
                    <th className="p-3.5">Invoice #</th>
                    <th className="p-3.5">Tenant</th>
                    <th className="p-3.5">Property</th>
                    <th className="p-3.5">Issue Date</th>
                    <th className="p-3.5">Due Date</th>
                    <th className="p-3.5 text-right">Total</th>
                    <th className="p-3.5 text-right">Paid</th>
                    <th className="p-3.5 text-right">Outstanding</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3.5 font-mono font-bold text-brand-navy">
                        <Link href={`/invoices/${inv.id}`} className="hover:underline hover:text-brand-teal">
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="p-3.5">
                        <p className="font-semibold text-slate-900">
                          {inv.tenant?.firstName} {inv.tenant?.lastName}
                        </p>
                        <p className="text-xs text-slate-400">{inv.tenant?.phone}</p>
                      </td>
                      <td className="p-3.5 text-slate-600">{inv.property?.name || '—'}</td>
                      <td className="p-3.5 text-slate-600">{new Date(inv.issueDate).toLocaleDateString()}</td>
                      <td className="p-3.5 text-slate-600">{new Date(inv.dueDate).toLocaleDateString()}</td>
                      <td className="p-3.5 text-right font-bold text-slate-900">
                        ₹{Number(inv.totalAmount).toLocaleString()}
                      </td>
                      <td className="p-3.5 text-right font-semibold text-emerald-600">
                        ₹{Number(inv.paidAmount).toLocaleString()}
                      </td>
                      <td className="p-3.5 text-right font-bold text-amber-600">
                        ₹{Number(inv.outstandingAmount).toLocaleString()}
                      </td>
                      <td className="p-3.5">{getStatusBadge(inv.status)}</td>
                      <td className="p-3.5 text-right">
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* CREATE INVOICE MODAL */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-brand-teal" />
                  Create New Invoice
                </h3>
                <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateInvoice} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Tenant *</label>
                    <select
                      required
                      value={formTenantId}
                      onChange={(e) => setFormTenantId(e.target.value)}
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
                      value={formPropertyId}
                      onChange={(e) => setFormPropertyId(e.target.value)}
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
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Issue Date</label>
                    <input
                      type="date"
                      required
                      value={formIssueDate}
                      onChange={(e) => setFormIssueDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-brand-teal"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date</label>
                    <input
                      type="date"
                      required
                      value={formDueDate}
                      onChange={(e) => setFormDueDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-brand-teal"
                    />
                  </div>
                </div>

                {/* Dynamic Line Items */}
                <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Line Items</h4>
                    <button
                      type="button"
                      onClick={addLine}
                      className="text-xs font-semibold text-brand-teal hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Line
                    </button>
                  </div>

                  {lines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-lg border border-slate-200">
                      <div className="col-span-4">
                        <input
                          type="text"
                          placeholder="Description"
                          required
                          value={line.description}
                          onChange={(e) => updateLine(idx, 'description', e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:border-brand-teal"
                        />
                      </div>
                      <div className="col-span-3">
                        <select
                          value={line.chargeType}
                          onChange={(e) => updateLine(idx, 'chargeType', e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:border-brand-teal"
                        >
                          <option value={ChargeType.RENT}>RENT</option>
                          <option value={ChargeType.MAINTENANCE}>MAINTENANCE</option>
                          <option value={ChargeType.UTILITY}>UTILITY</option>
                          <option value={ChargeType.SECURITY_DEPOSIT}>SECURITY_DEPOSIT</option>
                          <option value={ChargeType.OTHER}>OTHER</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          min="1"
                          required
                          placeholder="Qty"
                          value={line.quantity}
                          onChange={(e) => updateLine(idx, 'quantity', Number(e.target.value))}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:border-brand-teal"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          placeholder="Unit Amount"
                          value={line.unitAmount}
                          onChange={(e) => updateLine(idx, 'unitAmount', e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:border-brand-teal"
                        />
                      </div>
                      <div className="col-span-1 text-center">
                        {lines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            className="text-rose-500 hover:text-rose-700 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Calculations breakdown */}
                  <div className="border-t border-slate-200 pt-3 space-y-1.5 text-right text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal:</span>
                      <span className="font-semibold">₹{calculateSubtotal().toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Adjustments (Discounts / Extras):</span>
                      <input
                        type="number"
                        step="0.01"
                        value={formAdjustments}
                        onChange={(e) => setFormAdjustments(e.target.value)}
                        className="w-24 px-2 py-1 border border-slate-300 rounded text-xs text-right focus:outline-none focus:border-brand-teal"
                      />
                    </div>
                    <div className="flex justify-between text-base font-bold text-slate-900 pt-1 border-t border-slate-200">
                      <span>Total Amount:</span>
                      <span className="text-brand-teal">₹{calculateTotal().toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Terms (Optional)</label>
                  <textarea
                    rows={2}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-brand-teal"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingInvoice}
                    className="px-4 py-2 bg-brand-teal hover:bg-teal-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
                  >
                    {savingInvoice && <Loader2 className="w-4 h-4 animate-spin" />}
                    Create Draft Invoice
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
