'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { FilterBar } from '@/components/ui/FilterBar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { getLocalDateString } from '@/lib/date-utils';
import {
  LogOut,
  CheckCircle2,
  Clock,
  Ban,
  Building2,
  Plus,
  RefreshCw,
  IndianRupee,
  ReceiptText,
} from 'lucide-react';

interface Property {
  id: string;
  name: string;
  code: string;
  propertyType: 'PG' | 'RENTAL_HOUSE';
}

interface Tenant {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  status: string;
  stays?: any[];
  leases?: any[];
}

interface Settlement {
  id: string;
  securityDeposit: number;
  outstandingRent: number;
  maintenanceCharges: number;
  deductions: number;
  refundableAmount: number;
  amountDue: number;
  amountRefundable: number;
  status: 'DRAFT' | 'FINALIZED' | 'VOID';
  notes?: string | null;
}

interface CheckoutRecord {
  id: string;
  tenantId: string;
  propertyId: string;
  bedId?: string | null;
  rentalUnitId?: string | null;
  leaseId?: string | null;
  stayHistoryId?: string | null;
  checkoutDate: string;
  status: 'INITIATED' | 'SETTLEMENT_PENDING' | 'READY' | 'COMPLETED' | 'CANCELLED';
  reason?: string | null;
  createdAt: string;
  completedAt?: string | null;
  cancelledAt?: string | null;
  settlement?: Settlement | null;
  tenant?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string | null;
  };
  property?: {
    id: string;
    name: string;
    code: string;
    propertyType: string;
  };
  bed?: {
    id: string;
    bedNumber: string;
    room?: {
      id: string;
      roomNumber: string;
      floor?: {
        id: string;
        floorNumber: number;
      };
    };
  };
  rentalUnit?: {
    id: string;
    unitNumber: string;
  };
  lease?: {
    id: string;
    startDate: string;
    endDate: string;
    monthlyRent: number;
    securityDeposit: number;
    status: string;
  };
}

export default function CheckoutsPage() {
  const [checkouts, setCheckouts] = useState<CheckoutRecord[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Wizard Modal State
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardPropertyId, setWizardPropertyId] = useState<string>('');
  const [wizardTenantId, setWizardTenantId] = useState<string>('');
  const [wizardCheckoutDate, setWizardCheckoutDate] = useState<string>(
    getLocalDateString()
  );
  const [wizardReason, setWizardReason] = useState<string>('');
  const [wizardLoading, setWizardLoading] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);

  // Settlement Inspector / Edit Modal State
  const [selectedCheckoutForEdit, setSelectedCheckoutForEdit] = useState<CheckoutRecord | null>(null);
  const [editRent, setEditRent] = useState<number>(0);
  const [editMaintenance, setEditMaintenance] = useState<number>(0);
  const [editDeductions, setEditDeductions] = useState<number>(0);
  const [editNotes, setEditNotes] = useState<string>('');
  const [editSaving, setEditSaving] = useState(false);

  // Action status message
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [checkoutsRes, propsRes, tenantsRes] = await Promise.all([
        fetch('/api/v1/checkouts', { credentials: 'include' }),
        fetch('/api/v1/properties', { credentials: 'include' }),
        fetch('/api/v1/tenants', { credentials: 'include' }),
      ]);

      const checkoutsData = await checkoutsRes.json();
      const propsData = await propsRes.json();
      const tenantsData = await tenantsRes.json();

      if (checkoutsData.success) {
        setCheckouts(checkoutsData.data || []);
      }
      if (propsData.success) {
        setProperties(propsData.data || []);
      }
      if (tenantsData.success) {
        setTenants(tenantsData.data || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch checkout records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const handleOpenWizard = () => {
    setIsWizardOpen(true);
    setWizardPropertyId(properties[0]?.id || '');
    setWizardTenantId('');
    setWizardCheckoutDate(getLocalDateString());
    setWizardReason('');
    setWizardError(null);
  };

  const handleInitiateCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wizardPropertyId || !wizardTenantId || !wizardCheckoutDate) {
      setWizardError('Please fill in all required fields');
      return;
    }

    setWizardLoading(true);
    setWizardError(null);
    try {
      const res = await fetch(`/api/v1/properties/${wizardPropertyId}/checkouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tenantId: wizardTenantId,
          checkoutDate: wizardCheckoutDate,
          reason: wizardReason.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error?.message || 'Failed to initiate checkout');
      }

      setActionMessage('Checkout initiated successfully with draft settlement calculated!');
      setIsWizardOpen(false);
      fetchInitialData();
    } catch (err: any) {
      setWizardError(err.message || 'Error initiating checkout');
    } finally {
      setWizardLoading(false);
    }
  };

  const handleMarkReady = async (checkoutId: string) => {
    setActionLoading(checkoutId);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/v1/checkouts/${checkoutId}/ready`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error?.message || 'Failed to mark checkout as ready');
      }
      setActionMessage('Checkout marked as READY for completion.');
      fetchInitialData();
    } catch (err: any) {
      alert(err.message || 'Error marking checkout ready');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCompleteCheckout = async (checkoutId: string) => {
    setActionLoading(checkoutId);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/v1/checkouts/${checkoutId}/complete`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error?.message || 'Failed to complete checkout');
      }
      setActionMessage('Checkout successfully completed! Occupancy released and settlement finalized.');
      fetchInitialData();
    } catch (err: any) {
      alert(err.message || 'Error completing checkout');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelCheckout = async (checkoutId: string) => {
    const reason = prompt('Please enter a cancellation reason:');
    if (reason === null) return;

    setActionLoading(checkoutId);
    try {
      const res = await fetch(`/api/v1/checkouts/${checkoutId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error?.message || 'Failed to cancel checkout');
      }
      setActionMessage('Checkout was cancelled successfully.');
      fetchInitialData();
    } catch (err: any) {
      alert(err.message || 'Error cancelling checkout');
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenEditSettlement = (checkout: CheckoutRecord) => {
    setSelectedCheckoutForEdit(checkout);
    if (checkout.settlement) {
      setEditRent(checkout.settlement.outstandingRent || 0);
      setEditMaintenance(checkout.settlement.maintenanceCharges || 0);
      setEditDeductions(checkout.settlement.deductions || 0);
      setEditNotes(checkout.settlement.notes || '');
    }
  };

  const handleSaveSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCheckoutForEdit) return;

    setEditSaving(true);
    try {
      const res = await fetch(`/api/v1/checkouts/${selectedCheckoutForEdit.id}/settlement`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          outstandingRent: Number(editRent),
          maintenanceCharges: Number(editMaintenance),
          deductions: Number(editDeductions),
          notes: editNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error?.message || 'Failed to update settlement');
      }

      setActionMessage('Settlement updated and recalculated successfully!');
      setSelectedCheckoutForEdit(null);
      fetchInitialData();
    } catch (err: any) {
      alert(err.message || 'Error updating settlement');
    } finally {
      setEditSaving(false);
    }
  };

  // Filtered checkouts
  const filteredCheckouts = checkouts.filter((c) => {
    if (filterStatus !== 'ALL' && c.status !== filterStatus) return false;
    if (selectedPropertyId && c.propertyId !== selectedPropertyId) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const tenantName = `${c.tenant?.firstName || ''} ${c.tenant?.lastName || ''}`.toLowerCase();
      const phone = c.tenant?.phone?.toLowerCase() || '';
      const propName = c.property?.name?.toLowerCase() || '';
      return tenantName.includes(q) || phone.includes(q) || propName.includes(q);
    }
    return true;
  });

  // KPI Metrics
  const totalCount = checkouts.length;
  const completedCount = checkouts.filter((c) => c.status === 'COMPLETED').length;
  const pendingSettlementCount = checkouts.filter(
    (c) => c.status === 'INITIATED' || c.status === 'SETTLEMENT_PENDING' || c.status === 'READY'
  ).length;
  const totalRefundableAmount = checkouts
    .filter((c) => c.status === 'COMPLETED' && c.settlement)
    .reduce((sum, c) => sum + (c.settlement?.amountRefundable || 0), 0);

  const filterTabs = [
    { id: 'ALL', label: 'All' },
    { id: 'INITIATED', label: 'Initiated' },
    { id: 'SETTLEMENT_PENDING', label: 'Settlement Pending' },
    { id: 'READY', label: 'Ready' },
    { id: 'COMPLETED', label: 'Completed' },
    { id: 'CANCELLED', label: 'Cancelled' },
  ];

  return (
    <AppShell activePath="/check-outs">
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        {/* Page Header */}
        <PageHeader
          title="Digital Check-Out & Settlement"
          subtitle="Manage tenant move-outs, inventory release, lease terminations, and deterministic deposit settlements"
          icon={LogOut}
          showBack={true}
          backHref="/"
          backLabel="Back to Dashboard"
          actions={
            <Button
              variant="primary"
              size="md"
              onClick={handleOpenWizard}
              className="gap-2 font-semibold shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Start Digital Check-Out</span>
            </Button>
          }
        />

        {/* Action Message Alert */}
        {actionMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{actionMessage}</span>
            </div>
            <button
              onClick={() => setActionMessage(null)}
              className="text-emerald-700 hover:text-emerald-900 font-bold p-1 rounded-md"
            >
              ✕
            </button>
          </div>
        )}

        {/* KPI Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <StatCard
            label="Total Check-Outs"
            value={totalCount}
            subtext="All move-out records"
            icon={LogOut}
            variant="default"
          />
          <StatCard
            label="Completed Move-Outs"
            value={completedCount}
            subtext="Released occupancy"
            icon={CheckCircle2}
            variant="teal"
          />
          <StatCard
            label="Pending Settlement"
            value={pendingSettlementCount}
            subtext="In progress/Ready"
            icon={Clock}
            variant="amber"
          />
          <StatCard
            label="Total Refunded Deposits"
            value={`₹${totalRefundableAmount.toLocaleString('en-IN')}`}
            subtext="Finalized settlements"
            icon={IndianRupee}
            variant="emerald"
          />
        </div>

        {/* Filter Bar */}
        <FilterBar
          tabs={filterTabs}
          activeTab={filterStatus}
          onTabChange={setFilterStatus}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search tenant or property..."
        >
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-surface-textSecondary shrink-0" />
            <select
              aria-label="Filter by Property"
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="bg-surface-subtle border border-surface-border rounded-lg px-2.5 py-1.5 text-xs text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal cursor-pointer"
            >
              <option value="">All Properties</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.propertyType})
                </option>
              ))}
            </select>
          </div>
        </FilterBar>

        {/* Checkouts Table */}
        <div className="bg-brand-white border border-surface-border rounded-xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-surface-textSecondary space-y-3">
              <RefreshCw className="w-7 h-7 animate-spin mx-auto text-brand-teal" />
              <p className="text-xs font-medium">Loading checkout records...</p>
            </div>
          ) : filteredCheckouts.length === 0 ? (
            <EmptyState
              icon={LogOut}
              title="No check-out records found"
              description="There are no check-out records matching the selected filter criteria. Click 'Start Digital Check-Out' to initiate a move-out for an active tenant."
              actionLabel="Start Digital Check-Out"
              onAction={handleOpenWizard}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-brand-navy">
                <thead className="bg-surface-subtle text-[11px] uppercase text-surface-textSecondary font-semibold border-b border-surface-border">
                  <tr>
                    <th className="px-5 py-3">Tenant</th>
                    <th className="px-5 py-3">Property & Type</th>
                    <th className="px-5 py-3">Occupancy</th>
                    <th className="px-5 py-3">Checkout Date</th>
                    <th className="px-5 py-3">Settlement</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {filteredCheckouts.map((checkout) => (
                    <tr key={checkout.id} className="hover:bg-surface-subtle/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/tenants/${checkout.tenantId}`}
                          className="font-semibold text-brand-teal hover:underline"
                        >
                          {checkout.tenant?.firstName} {checkout.tenant?.lastName}
                        </Link>
                        <div className="text-[11px] text-surface-textSecondary mt-0.5">
                          {checkout.tenant?.phone}
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="font-medium text-brand-navy">{checkout.property?.name}</div>
                        <div className="text-[10px] uppercase font-semibold text-surface-textSecondary mt-0.5">
                          {checkout.property?.propertyType === 'PG' ? 'PG / Co-Living' : 'Whole-Unit'}
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        {checkout.bed ? (
                          <span>
                            Bed {checkout.bed.bedNumber} (Rm {checkout.bed.room?.roomNumber})
                          </span>
                        ) : checkout.rentalUnit ? (
                          <span>Unit {checkout.rentalUnit.unitNumber}</span>
                        ) : (
                          <span className="text-surface-disabled italic">N/A</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="font-medium text-brand-navy">
                          {new Date(checkout.checkoutDate).toLocaleDateString('en-IN')}
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        {checkout.settlement ? (
                          <div>
                            {checkout.settlement.amountRefundable > 0 ? (
                              <span className="text-emerald-700 font-semibold">
                                Refund: ₹{checkout.settlement.amountRefundable.toLocaleString('en-IN')}
                              </span>
                            ) : checkout.settlement.amountDue > 0 ? (
                              <span className="text-rose-700 font-semibold">
                                Due: ₹{checkout.settlement.amountDue.toLocaleString('en-IN')}
                              </span>
                            ) : (
                              <span className="text-surface-textSecondary font-semibold">Settled (₹0)</span>
                            )}
                            <div className="text-[10px] text-surface-textSecondary mt-0.5">
                              Deposit: ₹{checkout.settlement.securityDeposit.toLocaleString('en-IN')}
                            </div>
                          </div>
                        ) : (
                          <span className="text-surface-disabled italic">None</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5">
                        <StatusBadge status={checkout.status} />
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Settlement Details / Edit Button */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEditSettlement(checkout)}
                          >
                            Settlement
                          </Button>

                          {/* Mark Ready Button */}
                          {(checkout.status === 'INITIATED' || checkout.status === 'SETTLEMENT_PENDING') && (
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={actionLoading === checkout.id}
                              onClick={() => handleMarkReady(checkout.id)}
                            >
                              Mark Ready
                            </Button>
                          )}

                          {/* Complete Checkout Button */}
                          {checkout.status === 'READY' && (
                            <Button
                              variant="primary"
                              size="sm"
                              disabled={actionLoading === checkout.id}
                              onClick={() => handleCompleteCheckout(checkout.id)}
                            >
                              Complete Move-Out
                            </Button>
                          )}

                          {/* Cancel Button */}
                          {checkout.status !== 'COMPLETED' && checkout.status !== 'CANCELLED' && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={actionLoading === checkout.id}
                              onClick={() => handleCancelCheckout(checkout.id)}
                              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                            >
                              Cancel
                            </Button>
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
      </div>

      {/* Checkout Wizard Modal */}
      <Modal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        title="Start Digital Check-Out"
        subtitle="Initiate tenant move-out, prepare deposit settlement, and schedule vacancy"
        maxWidth="lg"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsWizardOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleInitiateCheckout}
              isLoading={wizardLoading}
            >
              Initiate Move-Out
            </Button>
          </>
        }
      >
        <form onSubmit={handleInitiateCheckout} className="space-y-4 text-xs">
          {wizardError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {wizardError}
            </div>
          )}

          {/* Property Select */}
          <div>
            <label className="block text-brand-navy font-semibold mb-1">Property *</label>
            <select
              value={wizardPropertyId}
              onChange={(e) => setWizardPropertyId(e.target.value)}
              required
              className="w-full bg-surface-subtle border border-surface-border rounded-lg px-3 py-2 text-xs text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.propertyType === 'PG' ? 'PG / Co-Living' : 'Whole-Unit'})
                </option>
              ))}
            </select>
          </div>

          {/* Tenant Select */}
          <div>
            <label className="block text-brand-navy font-semibold mb-1">Tenant (Active Occupants) *</label>
            <select
              value={wizardTenantId}
              onChange={(e) => setWizardTenantId(e.target.value)}
              required
              className="w-full bg-surface-subtle border border-surface-border rounded-lg px-3 py-2 text-xs text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
            >
              <option value="">-- Select Active Tenant --</option>
              {tenants
                .filter((t) => t.status === 'ACTIVE')
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.firstName} {t.lastName} ({t.phone})
                  </option>
                ))}
            </select>
          </div>

          {/* Checkout Date */}
          <div>
            <label className="block text-brand-navy font-semibold mb-1">Check-Out Date *</label>
            <input
              type="date"
              value={wizardCheckoutDate}
              onChange={(e) => setWizardCheckoutDate(e.target.value)}
              required
              className="w-full bg-surface-subtle border border-surface-border rounded-lg px-3 py-2 text-xs text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
            />
          </div>

          {/* Reason */}
          <div>
            <label className="block text-brand-navy font-semibold mb-1">Reason for Move-Out (Optional)</label>
            <textarea
              rows={3}
              value={wizardReason}
              onChange={(e) => setWizardReason(e.target.value)}
              placeholder="e.g. Job relocation, lease term completion..."
              className="w-full bg-surface-subtle border border-surface-border rounded-lg px-3 py-2 text-xs text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
            />
          </div>
        </form>
      </Modal>

      {/* Settlement Inspector / Edit Modal */}
      {selectedCheckoutForEdit && selectedCheckoutForEdit.settlement && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedCheckoutForEdit(null)}
          title="Settlement Calculation"
          subtitle={`Tenant: ${selectedCheckoutForEdit.tenant?.firstName} ${selectedCheckoutForEdit.tenant?.lastName}`}
          maxWidth="lg"
          footer={
            <>
              <Button variant="outline" size="sm" onClick={() => setSelectedCheckoutForEdit(null)}>
                Close
              </Button>
              {selectedCheckoutForEdit.status !== 'COMPLETED' && selectedCheckoutForEdit.status !== 'CANCELLED' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveSettlement}
                  isLoading={editSaving}
                >
                  Save & Recalculate
                </Button>
              )}
            </>
          }
        >
          <div className="space-y-4 text-xs">
            {/* Settlement Summary Breakdown Box */}
            <div className="bg-surface-subtle border border-surface-border rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-surface-textSecondary">Security Deposit:</span>
                <span className="font-semibold text-brand-navy">
                  ₹{selectedCheckoutForEdit.settlement.securityDeposit.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-surface-textSecondary">Deductions:</span>
                <span className="font-semibold text-rose-700">
                  - ₹{Number(editDeductions).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-surface-textSecondary">Outstanding Rent & Maintenance:</span>
                <span className="font-semibold text-rose-700">
                  - ₹{(Number(editRent) + Number(editMaintenance)).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="border-t border-surface-border pt-2 flex justify-between text-xs font-bold">
                <span>Net Settlement Result:</span>
                {Math.max(
                  Math.max(selectedCheckoutForEdit.settlement.securityDeposit - editDeductions, 0) -
                    (Number(editRent) + Number(editMaintenance)),
                  0
                ) > 0 ? (
                  <span className="text-emerald-700">
                    Refundable: ₹
                    {Math.max(
                      Math.max(selectedCheckoutForEdit.settlement.securityDeposit - editDeductions, 0) -
                        (Number(editRent) + Number(editMaintenance)),
                      0
                    ).toLocaleString('en-IN')}
                  </span>
                ) : (
                  <span className="text-rose-700">
                    Amount Due: ₹
                    {Math.max(
                      Number(editRent) +
                        Number(editMaintenance) -
                        Math.max(selectedCheckoutForEdit.settlement.securityDeposit - editDeductions, 0),
                      0
                    ).toLocaleString('en-IN')}
                  </span>
                )}
              </div>
            </div>

            {/* Edit Form */}
            {selectedCheckoutForEdit.status !== 'COMPLETED' && selectedCheckoutForEdit.status !== 'CANCELLED' && (
              <form onSubmit={handleSaveSettlement} className="space-y-3">
                <div>
                  <label className="block text-brand-navy font-semibold mb-1">
                    Outstanding Rent (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editRent}
                    onChange={(e) => setEditRent(Number(e.target.value))}
                    className="w-full bg-surface-subtle border border-surface-border rounded-lg px-3 py-2 text-xs text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                  />
                </div>

                <div>
                  <label className="block text-brand-navy font-semibold mb-1">
                    Maintenance Charges (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editMaintenance}
                    onChange={(e) => setEditMaintenance(Number(e.target.value))}
                    className="w-full bg-surface-subtle border border-surface-border rounded-lg px-3 py-2 text-xs text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                  />
                </div>

                <div>
                  <label className="block text-brand-navy font-semibold mb-1">
                    Damage Deductions (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editDeductions}
                    onChange={(e) => setEditDeductions(Number(e.target.value))}
                    className="w-full bg-surface-subtle border border-surface-border rounded-lg px-3 py-2 text-xs text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                  />
                </div>

                <div>
                  <label className="block text-brand-navy font-semibold mb-1">
                    Settlement Notes
                  </label>
                  <textarea
                    rows={2}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="e.g. Wall painting deduction, deep cleaning charges..."
                    className="w-full bg-surface-subtle border border-surface-border rounded-lg px-3 py-2 text-xs text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                  />
                </div>
              </form>
            )}
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
