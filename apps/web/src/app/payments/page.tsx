'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { BackButton } from '@/components/ui/BackButton';
import { useAuth } from '@/lib/auth-context';
import { getLocalDateString } from '@/lib/date-utils';
import {
  PaymentDto,
  PaymentMethod,
  PaymentStatus,
  InvoiceDto,
} from '@propertyos/types';
import {
  CircleDollarSign,
  Plus,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  CreditCard,
  Building,
  User,
  Calendar,
  Loader2,
  X,
  ArrowRight,
  Layers,
} from 'lucide-react';

export default function PaymentsPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [payments, setPayments] = useState<PaymentDto[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Record Payment Modal State
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [tenantId, setTenantId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.UPI);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [paymentDate, setPaymentDate] = useState(getLocalDateString());
  const [notes, setNotes] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  // Allocate Payment Modal State
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentDto | null>(null);
  const [tenantInvoices, setTenantInvoices] = useState<InvoiceDto[]>([]);
  const [targetInvoiceId, setTargetInvoiceId] = useState('');
  const [allocAmount, setAllocAmount] = useState('');
  const [allocating, setAllocating] = useState(false);

  const getHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('propertyos_token') : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams();
      if (methodFilter !== 'ALL') params.append('paymentMethod', methodFilter);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);

      const res = await fetch(`/api/v1/payments?${params.toString()}`, {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) setPayments(json.data);
      } else {
        setErrorMsg('Failed to load payments');
      }
    } catch {
      setErrorMsg('Network error loading payments');
    } finally {
      setLoading(false);
    }
  }, [methodFilter, statusFilter]);

  const fetchTenants = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/tenants', {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) setTenants(json.data);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchPayments();
    fetchTenants();
  }, [fetchPayments, fetchTenants]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPayment(true);
    try {
      const res = await fetch('/api/v1/payments', {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          tenantId,
          amount,
          paymentMethod,
          referenceNumber: referenceNumber || undefined,
          paymentDate,
          notes: notes || undefined,
        }),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        setShowRecordModal(false);
        setTenantId('');
        setAmount('');
        setReferenceNumber('');
        setNotes('');
        await fetchPayments();
      } else {
        alert(json.message || 'Failed to record payment');
      }
    } catch (err: any) {
      alert(err.message || 'Network error');
    } finally {
      setSavingPayment(false);
    }
  };

  const openAllocateModal = async (payment: PaymentDto) => {
    setSelectedPayment(payment);
    setTargetInvoiceId('');
    setAllocAmount(payment.unallocatedAmount || payment.amount);
    setShowAllocateModal(true);

    // Fetch open invoices for this tenant
    try {
      const res = await fetch(`/api/v1/invoices?tenantId=${payment.tenantId}`, {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          // Filter to invoices with outstanding balance
          const openInvoices = json.data.filter(
            (inv: InvoiceDto) => Number(inv.outstandingAmount) > 0
          );
          setTenantInvoices(openInvoices);
          if (openInvoices.length > 0) {
            setTargetInvoiceId(openInvoices[0].id);
          }
        }
      }
    } catch {}
  };

  const handleAllocatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayment || !targetInvoiceId) return;

    setAllocating(true);
    try {
      const res = await fetch(`/api/v1/payments/${selectedPayment.id}/allocate`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          invoiceId: targetInvoiceId,
          amount: allocAmount,
        }),
      });

      const json = await res.json();
      if (res.ok) {
        setShowAllocateModal(false);
        setSelectedPayment(null);
        await fetchPayments();
      } else {
        alert(json.message || 'Failed to allocate payment');
      }
    } catch (err: any) {
      alert(err.message || 'Network error');
    } finally {
      setAllocating(false);
    }
  };

  const getStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case PaymentStatus.RECORDED:
        return <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700 font-semibold">RECORDED</span>;
      case PaymentStatus.PARTIALLY_ALLOCATED:
        return <span className="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700 font-semibold">PARTIALLY ALLOCATED</span>;
      case PaymentStatus.ALLOCATED:
        return <span className="px-2 py-0.5 rounded text-xs bg-emerald-100 text-emerald-700 font-semibold">ALLOCATED</span>;
      case PaymentStatus.REFUNDED:
        return <span className="px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700 font-semibold">REFUNDED</span>;
      case PaymentStatus.VOID:
        return <span className="px-2 py-0.5 rounded text-xs bg-slate-200 text-slate-500 font-semibold line-through">VOID</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700 font-semibold">{status}</span>;
    }
  };

  return (
    <AppShell activePath="/payments">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="mb-2">
              <BackButton fallbackHref="/" label="Back to Dashboard" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <CircleDollarSign className="w-7 h-7 text-brand-teal" />
              Payments & Receipts
            </h1>
            <p className="text-sm text-slate-500">
              Record incoming tenant receipts and safely allocate funds to outstanding invoices
            </p>
          </div>
          <button
            onClick={() => setShowRecordModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-teal hover:bg-teal-700 text-white rounded-lg text-sm font-semibold transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Record Payment
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex items-center gap-3">
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-brand-teal"
            >
              <option value="ALL">All Payment Methods</option>
              <option value={PaymentMethod.UPI}>UPI</option>
              <option value={PaymentMethod.BANK_TRANSFER}>Bank Transfer</option>
              <option value={PaymentMethod.CASH}>Cash</option>
              <option value={PaymentMethod.CARD}>Card</option>
              <option value={PaymentMethod.CHEQUE}>Cheque</option>
              <option value={PaymentMethod.OTHER}>Other</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-brand-teal"
            >
              <option value="ALL">All Statuses</option>
              <option value={PaymentStatus.RECORDED}>RECORDED</option>
              <option value={PaymentStatus.PARTIALLY_ALLOCATED}>PARTIALLY ALLOCATED</option>
              <option value={PaymentStatus.ALLOCATED}>ALLOCATED</option>
              <option value={PaymentStatus.REFUNDED}>REFUNDED</option>
            </select>
          </div>
        </div>

        {/* Payments Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 flex justify-center items-center text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-brand-teal" />
              <span>Loading payments...</span>
            </div>
          ) : payments.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <CircleDollarSign className="w-12 h-12 mx-auto mb-3 opacity-40 text-slate-500" />
              <p className="font-semibold text-slate-700">No payment receipts recorded</p>
              <p className="text-xs text-slate-400 mt-1">Record tenant payments to clear outstanding invoices</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase bg-slate-50">
                    <th className="p-3.5">Payment Date</th>
                    <th className="p-3.5">Tenant</th>
                    <th className="p-3.5">Method</th>
                    <th className="p-3.5">Reference #</th>
                    <th className="p-3.5 text-right">Total Amount</th>
                    <th className="p-3.5 text-right">Allocated</th>
                    <th className="p-3.5 text-right">Unallocated</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3.5 text-slate-600">
                        {new Date(payment.paymentDate).toLocaleDateString()}
                      </td>
                      <td className="p-3.5">
                        <p className="font-semibold text-slate-900">
                          {payment.tenant?.firstName} {payment.tenant?.lastName}
                        </p>
                        <p className="text-xs text-slate-400">{payment.tenant?.phone}</p>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700 font-medium">
                          {payment.paymentMethod}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-xs text-slate-600">
                        {payment.referenceNumber || '—'}
                      </td>
                      <td className="p-3.5 text-right font-bold text-slate-900">
                        ₹{Number(payment.amount).toLocaleString()}
                      </td>
                      <td className="p-3.5 text-right font-semibold text-emerald-600">
                        ₹{Number(payment.allocatedAmount || 0).toLocaleString()}
                      </td>
                      <td className="p-3.5 text-right font-semibold text-amber-600">
                        ₹{Number(payment.unallocatedAmount || 0).toLocaleString()}
                      </td>
                      <td className="p-3.5">{getStatusBadge(payment.status)}</td>
                      <td className="p-3.5 text-right">
                        {Number(payment.unallocatedAmount) > 0 && payment.status !== PaymentStatus.VOID && (
                          <button
                            onClick={() => openAllocateModal(payment)}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-brand-teal text-white hover:bg-teal-700 rounded text-xs font-semibold transition"
                          >
                            <Layers className="w-3.5 h-3.5" />
                            Allocate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* RECORD PAYMENT MODAL */}
        {showRecordModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <CircleDollarSign className="w-5 h-5 text-brand-teal" />
                  Record Tenant Payment
                </h3>
                <button onClick={() => setShowRecordModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleRecordPayment} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tenant *</label>
                  <select
                    required
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="10000.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-brand-teal"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-brand-teal"
                    >
                      <option value={PaymentMethod.UPI}>UPI</option>
                      <option value={PaymentMethod.BANK_TRANSFER}>Bank Transfer</option>
                      <option value={PaymentMethod.CASH}>Cash</option>
                      <option value={PaymentMethod.CARD}>Card</option>
                      <option value={PaymentMethod.CHEQUE}>Cheque</option>
                      <option value={PaymentMethod.OTHER}>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Date</label>
                    <input
                      type="date"
                      required
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-brand-teal"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Reference / Transaction ID (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UPI-TXN-987654321"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-brand-teal"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Notes (Optional)</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-brand-teal"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowRecordModal(false)}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingPayment}
                    className="px-4 py-2 bg-brand-teal hover:bg-teal-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
                  >
                    {savingPayment && <Loader2 className="w-4 h-4 animate-spin" />}
                    Record Payment
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ALLOCATE PAYMENT MODAL */}
        {showAllocateModal && selectedPayment && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-brand-teal" />
                  Allocate Funds to Invoice
                </h3>
                <button onClick={() => setShowAllocateModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1">
                <p>
                  <span className="font-semibold text-slate-700">Available to Allocate:</span>{' '}
                  <span className="font-bold text-brand-teal">₹{Number(selectedPayment.unallocatedAmount).toLocaleString()}</span>
                </p>
                <p className="text-slate-500">Tenant: {selectedPayment.tenant?.firstName} {selectedPayment.tenant?.lastName}</p>
              </div>

              <form onSubmit={handleAllocatePayment} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Invoice</label>
                  {tenantInvoices.length === 0 ? (
                    <p className="text-xs text-amber-600 py-2">No open invoices with outstanding balance found for this tenant.</p>
                  ) : (
                    <select
                      required
                      value={targetInvoiceId}
                      onChange={(e) => {
                        setTargetInvoiceId(e.target.value);
                        const inv = tenantInvoices.find((i) => i.id === e.target.value);
                        if (inv) {
                          const available = Number(selectedPayment.unallocatedAmount);
                          const needed = Number(inv.outstandingAmount);
                          setAllocAmount(String(Math.min(available, needed)));
                        }
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-brand-teal"
                    >
                      {tenantInvoices.map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.invoiceNumber} — Outstanding: ₹{Number(inv.outstandingAmount).toLocaleString()}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Allocation Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={Number(selectedPayment.unallocatedAmount)}
                    required
                    value={allocAmount}
                    onChange={(e) => setAllocAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-brand-teal"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAllocateModal(false)}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={allocating || tenantInvoices.length === 0}
                    className="px-4 py-2 bg-brand-teal hover:bg-teal-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
                  >
                    {allocating && <Loader2 className="w-4 h-4 animate-spin" />}
                    Confirm Allocation
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
