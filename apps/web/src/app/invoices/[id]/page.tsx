'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { BackButton } from '@/components/ui/BackButton';
import { useAuth } from '@/lib/auth-context';
import {
  InvoiceDto,
  InvoiceStatus,
  LedgerEntryDto,
} from '@propertyos/types';
import {
  FileSpreadsheet,
  ArrowLeft,
  Send,
  XCircle,
  Printer,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building,
  User,
  Calendar,
  Loader2,
  CreditCard,
  Scale,
  Receipt,
} from 'lucide-react';

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params?.id as string;

  const [invoice, setInvoice] = useState<InvoiceDto | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const getHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('propertyos_token') : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const fetchInvoiceDetails = useCallback(async () => {
    if (!invoiceId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/invoices/${invoiceId}`, {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) setInvoice(json.data);
      } else {
        setErrorMsg('Invoice not found');
      }

      // Fetch ledger entries for this invoice
      const ledgerRes = await fetch(`/api/v1/ledger/invoice/${invoiceId}`, {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (ledgerRes.ok) {
        const lJson = await ledgerRes.json();
        if (lJson.data) setLedgerEntries(lJson.data);
      }
    } catch {
      setErrorMsg('Error loading invoice');
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    fetchInvoiceDetails();
  }, [fetchInvoiceDetails]);

  const handleIssueInvoice = async () => {
    if (!confirm('Are you sure you want to issue this invoice? Balanced double-entry ledger entries will be generated.')) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/invoices/${invoiceId}/issue`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        await fetchInvoiceDetails();
      } else {
        const json = await res.json();
        alert(json.message || 'Failed to issue invoice');
      }
    } catch (err: any) {
      alert(err.message || 'Network error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVoidInvoice = async () => {
    if (!confirm('Are you sure you want to void this invoice? This will cancel outstanding balances and record reversal ledger entries if issued.')) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/invoices/${invoiceId}/void`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        await fetchInvoiceDetails();
      } else {
        const json = await res.json();
        alert(json.message || 'Failed to void invoice');
      }
    } catch (err: any) {
      alert(err.message || 'Network error');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: InvoiceStatus) => {
    switch (status) {
      case InvoiceStatus.DRAFT:
        return <span className="px-3 py-1 rounded-full text-xs bg-slate-100 text-slate-700 font-bold">DRAFT</span>;
      case InvoiceStatus.ISSUED:
        return <span className="px-3 py-1 rounded-full text-xs bg-blue-100 text-blue-700 font-bold">ISSUED</span>;
      case InvoiceStatus.PARTIALLY_PAID:
        return <span className="px-3 py-1 rounded-full text-xs bg-amber-100 text-amber-700 font-bold">PARTIALLY PAID</span>;
      case InvoiceStatus.PAID:
        return <span className="px-3 py-1 rounded-full text-xs bg-emerald-100 text-emerald-700 font-bold">PAID</span>;
      case InvoiceStatus.OVERDUE:
        return <span className="px-3 py-1 rounded-full text-xs bg-rose-100 text-rose-700 font-bold">OVERDUE</span>;
      case InvoiceStatus.VOID:
      case InvoiceStatus.CANCELLED:
        return <span className="px-3 py-1 rounded-full text-xs bg-slate-200 text-slate-500 font-bold line-through">{status}</span>;
      default:
        return <span className="px-3 py-1 rounded-full text-xs bg-slate-100 text-slate-700 font-bold">{status}</span>;
    }
  };

  if (loading) {
    return (
      <AppShell activePath="/invoices">
        <div className="p-12 flex justify-center items-center text-slate-400 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-brand-teal" />
          <span>Loading invoice details...</span>
        </div>
      </AppShell>
    );
  }

  if (errorMsg || !invoice) {
    return (
      <AppShell activePath="/invoices">
        <div className="p-8 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">{errorMsg || 'Invoice not found'}</h2>
          <Link
            href="/invoices"
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-navy text-white rounded-lg text-sm font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Invoices
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell activePath="/invoices">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Back Link & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BackButton fallbackHref="/invoices" label="Back to Invoices" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Invoice {invoice.invoiceNumber}
                </h1>
                {getStatusBadge(invoice.status)}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Created on {new Date(invoice.createdAt).toLocaleDateString()} • Due on{' '}
                {new Date(invoice.dueDate).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>

            {invoice.status === InvoiceStatus.DRAFT && (
              <button
                onClick={handleIssueInvoice}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-teal hover:bg-teal-700 text-white rounded-lg text-xs font-semibold transition shadow-sm disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Issue Invoice
              </button>
            )}

            {(invoice.status === InvoiceStatus.DRAFT || invoice.status === InvoiceStatus.ISSUED || invoice.status === InvoiceStatus.OVERDUE) && (
              <button
                onClick={handleVoidInvoice}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold transition disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                Void Invoice
              </button>
            )}
          </div>
        </div>

        {/* Invoice Summary Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          {/* Metadata Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-6 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Billed To</span>
              <p className="text-base font-bold text-slate-900">
                {invoice.tenant?.firstName} {invoice.tenant?.lastName}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{invoice.tenant?.phone}</p>
              <p className="text-xs text-slate-500">{invoice.tenant?.email}</p>
            </div>

            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Property</span>
              <p className="text-base font-semibold text-slate-800">{invoice.property?.name || 'Whole Property'}</p>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{invoice.property?.code || '—'}</p>
            </div>

            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Dates</span>
              <div className="text-xs space-y-1 text-slate-600">
                <p>
                  <span className="font-semibold text-slate-800">Issue Date:</span>{' '}
                  {new Date(invoice.issueDate).toLocaleDateString()}
                </p>
                <p>
                  <span className="font-semibold text-slate-800">Due Date:</span>{' '}
                  {new Date(invoice.dueDate).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Itemized Charges</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase bg-slate-50">
                    <th className="p-3">Description</th>
                    <th className="p-3">Charge Type</th>
                    <th className="p-3 text-right">Quantity</th>
                    <th className="p-3 text-right">Unit Price</th>
                    <th className="p-3 text-right">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoice.lines?.map((line) => (
                    <tr key={line.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-semibold text-slate-900">{line.description}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700 font-medium">
                          {line.chargeType}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono text-slate-700">{line.quantity}</td>
                      <td className="p-3 text-right font-mono text-slate-700">₹{Number(line.unitAmount).toLocaleString()}</td>
                      <td className="p-3 text-right font-bold text-slate-900">₹{Number(line.totalAmount).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Balances Breakdown */}
          <div className="flex justify-end pt-4 border-t border-slate-100">
            <div className="w-72 space-y-2 text-sm text-right">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-semibold font-mono">₹{Number(invoice.subtotal).toLocaleString()}</span>
              </div>
              {Number(invoice.adjustments) !== 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Adjustments:</span>
                  <span className="font-semibold font-mono">₹{Number(invoice.adjustments).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
                <span>Total Amount:</span>
                <span className="text-brand-teal font-mono">₹{Number(invoice.totalAmount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm text-emerald-600">
                <span>Amount Paid:</span>
                <span className="font-semibold font-mono">₹{Number(invoice.paidAmount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-amber-600 pt-2 border-t border-slate-200">
                <span>Outstanding Balance:</span>
                <span className="font-mono">₹{Number(invoice.outstandingAmount).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {invoice.notes && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-600">
              <span className="font-semibold block text-slate-700 mb-0.5">Notes:</span>
              {invoice.notes}
            </div>
          )}
        </div>

        {/* Payment Allocations Section */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-brand-teal" />
            Applied Payment Receipts
          </h3>

          {!invoice.allocations || invoice.allocations.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No payment allocations recorded for this invoice yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase bg-slate-50">
                    <th className="p-3">Allocation Date</th>
                    <th className="p-3">Payment Ref</th>
                    <th className="p-3 text-right">Allocated Amount</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoice.allocations.map((alloc) => (
                    <tr key={alloc.id} className="hover:bg-slate-50/50">
                      <td className="p-3 text-slate-600">{new Date(alloc.createdAt).toLocaleDateString()}</td>
                      <td className="p-3 font-mono text-slate-800">{alloc.paymentId}</td>
                      <td className="p-3 text-right font-bold text-emerald-600">₹{Number(alloc.amount).toLocaleString()}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-xs bg-emerald-100 text-emerald-700 font-semibold">
                          {alloc.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Ledger Audit Entries */}
        {ledgerEntries.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Scale className="w-5 h-5 text-brand-teal" />
              General Ledger Entries for Invoice
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 font-semibold text-slate-500 uppercase bg-slate-50">
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Account</th>
                    <th className="p-2.5">Entry Type</th>
                    <th className="p-2.5">Description</th>
                    <th className="p-2.5 text-right">Debit (DR)</th>
                    <th className="p-2.5 text-right">Credit (CR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ledgerEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/50">
                      <td className="p-2.5 text-slate-600">{new Date(entry.createdAt).toLocaleDateString()}</td>
                      <td className="p-2.5 font-semibold text-slate-900">{entry.accountType}</td>
                      <td className="p-2.5">{entry.entryType}</td>
                      <td className="p-2.5 text-slate-600">{entry.description}</td>
                      <td className="p-2.5 text-right font-bold text-blue-600">
                        {Number(entry.debitAmount) > 0 ? `₹${Number(entry.debitAmount).toLocaleString()}` : '—'}
                      </td>
                      <td className="p-2.5 text-right font-bold text-emerald-600">
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
    </AppShell>
  );
}
