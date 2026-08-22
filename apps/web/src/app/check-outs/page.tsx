'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';

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
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [wizardPropertyId, setWizardPropertyId] = useState<string>('');
  const [wizardTenantId, setWizardTenantId] = useState<string>('');
  const [wizardCheckoutDate, setWizardCheckoutDate] = useState<string>(
    new Date().toISOString().split('T')[0]
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
        fetch('/api/v1/checkouts'),
        fetch('/api/v1/properties'),
        fetch('/api/v1/tenants'),
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

  // Wizard Open
  const handleOpenWizard = () => {
    setIsWizardOpen(true);
    setWizardStep(1);
    setWizardPropertyId(properties[0]?.id || '');
    setWizardTenantId('');
    setWizardCheckoutDate(new Date().toISOString().split('T')[0]);
    setWizardReason('');
    setWizardError(null);
  };

  // Submit Checkout Initiation
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

  // Mark Checkout Ready
  const handleMarkReady = async (checkoutId: string) => {
    setActionLoading(checkoutId);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/v1/checkouts/${checkoutId}/ready`, {
        method: 'POST',
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

  // Complete Checkout (occupancy release)
  const handleCompleteCheckout = async (checkoutId: string) => {
    setActionLoading(checkoutId);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/v1/checkouts/${checkoutId}/complete`, {
        method: 'POST',
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

  // Cancel Checkout
  const handleCancelCheckout = async (checkoutId: string) => {
    const reason = prompt('Please enter a cancellation reason:');
    if (reason === null) return;

    setActionLoading(checkoutId);
    try {
      const res = await fetch(`/api/v1/checkouts/${checkoutId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  // Edit Settlement Modal Handlers
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

  return (
    <AppShell activePath="/check-outs">
      <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto', color: '#1e293b' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#0f172a', margin: '0 0 6px 0' }}>
              Digital Check-Out & Settlement
            </h1>
            <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
              Manage tenant move-outs, room & bed inventory release, lease terminations, and deterministic deposit settlements.
            </p>
          </div>
          <button
            onClick={handleOpenWizard}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              backgroundColor: '#0d9488',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(13, 148, 136, 0.2)',
            }}
          >
            <span>+ Start Digital Check-Out</span>
          </button>
        </div>

        {/* Action Message Banner */}
        {actionMessage && (
          <div
            style={{
              padding: '14px 18px',
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              color: '#166534',
              fontSize: '14px',
              marginBottom: '24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>✓ {actionMessage}</span>
            <button
              onClick={() => setActionMessage(null)}
              style={{ background: 'none', border: 'none', color: '#166534', cursor: 'pointer', fontWeight: 'bold' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* KPI Metrics */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            marginBottom: '28px',
          }}
        >
          <div
            style={{
              padding: '20px',
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <p style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', margin: '0 0 8px 0' }}>
              TOTAL CHECK-OUTS
            </p>
            <p style={{ fontSize: '26px', fontWeight: '700', color: '#0f172a', margin: 0 }}>{totalCount}</p>
          </div>

          <div
            style={{
              padding: '20px',
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <p style={{ fontSize: '13px', fontWeight: '600', color: '#0d9488', margin: '0 0 8px 0' }}>
              COMPLETED CHECK-OUTS
            </p>
            <p style={{ fontSize: '26px', fontWeight: '700', color: '#0d9488', margin: 0 }}>{completedCount}</p>
          </div>

          <div
            style={{
              padding: '20px',
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <p style={{ fontSize: '13px', fontWeight: '600', color: '#d97706', margin: '0 0 8px 0' }}>
              PENDING SETTLEMENT
            </p>
            <p style={{ fontSize: '26px', fontWeight: '700', color: '#d97706', margin: 0 }}>
              {pendingSettlementCount}
            </p>
          </div>

          <div
            style={{
              padding: '20px',
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <p style={{ fontSize: '13px', fontWeight: '600', color: '#2563eb', margin: '0 0 8px 0' }}>
              TOTAL REFUNDED DEPOSITS
            </p>
            <p style={{ fontSize: '26px', fontWeight: '700', color: '#2563eb', margin: 0 }}>
              ₹{totalRefundableAmount.toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        {/* Filter Controls */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            padding: '16px 20px',
            marginBottom: '24px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '16px',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
            {['ALL', 'INITIATED', 'SETTLEMENT_PENDING', 'READY', 'COMPLETED', 'CANCELLED'].map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  border: filterStatus === st ? '1px solid #0d9488' : '1px solid #e2e8f0',
                  backgroundColor: filterStatus === st ? '#f0fdfa' : '#ffffff',
                  color: filterStatus === st ? '#0d9488' : '#64748b',
                  cursor: 'pointer',
                }}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Search & Property Select */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <select
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                color: '#334155',
                backgroundColor: '#ffffff',
              }}
            >
              <option value="">All Properties</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.propertyType})
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Search tenant or property..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                width: '240px',
              }}
            />
          </div>
        </div>

        {/* Checkouts Table */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              Loading checkout records...
            </div>
          ) : filteredCheckouts.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              <p style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 6px 0' }}>No check-out records found</p>
              <p style={{ fontSize: '13px', margin: 0 }}>
                Click "+ Start Digital Check-Out" to initiate a move-out for an active tenant.
              </p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '14px 18px', fontWeight: '600' }}>Tenant</th>
                  <th style={{ padding: '14px 18px', fontWeight: '600' }}>Property & Type</th>
                  <th style={{ padding: '14px 18px', fontWeight: '600' }}>Occupancy</th>
                  <th style={{ padding: '14px 18px', fontWeight: '600' }}>Checkout Date</th>
                  <th style={{ padding: '14px 18px', fontWeight: '600' }}>Settlement</th>
                  <th style={{ padding: '14px 18px', fontWeight: '600' }}>Status</th>
                  <th style={{ padding: '14px 18px', fontWeight: '600', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCheckouts.map((checkout) => {
                  const statusColors: Record<string, { bg: string; text: string; border: string }> = {
                    INITIATED: { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
                    SETTLEMENT_PENDING: { bg: '#fffbeb', text: '#d97706', border: '#fde68a' },
                    READY: { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' },
                    COMPLETED: { bg: '#f8fafc', text: '#334155', border: '#cbd5e1' },
                    CANCELLED: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
                  };
                  const color = statusColors[checkout.status] || statusColors.INITIATED;

                  return (
                    <tr
                      key={checkout.id}
                      style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s' }}
                    >
                      <td style={{ padding: '14px 18px' }}>
                        <Link
                          href={`/tenants/${checkout.tenantId}`}
                          style={{ fontWeight: '600', color: '#0f172a', textDecoration: 'none' }}
                        >
                          {checkout.tenant?.firstName} {checkout.tenant?.lastName}
                        </Link>
                        <p style={{ margin: '2px 0 0 0', color: '#64748b', fontSize: '12px' }}>
                          {checkout.tenant?.phone}
                        </p>
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <p style={{ margin: 0, fontWeight: '500', color: '#1e293b' }}>{checkout.property?.name}</p>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: '600',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: checkout.property?.propertyType === 'PG' ? '#f0fdfa' : '#f5f3ff',
                            color: checkout.property?.propertyType === 'PG' ? '#0d9488' : '#7c3aed',
                            display: 'inline-block',
                            marginTop: '2px',
                          }}
                        >
                          {checkout.property?.propertyType === 'PG' ? 'PG / Co-Living' : 'Whole-Unit'}
                        </span>
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        {checkout.bed ? (
                          <span>
                            Bed {checkout.bed.bedNumber} (Rm {checkout.bed.room?.roomNumber})
                          </span>
                        ) : checkout.rentalUnit ? (
                          <span>Unit {checkout.rentalUnit.unitNumber}</span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>N/A</span>
                        )}
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <p style={{ margin: 0, fontWeight: '500' }}>
                          {new Date(checkout.checkoutDate).toLocaleDateString('en-IN')}
                        </p>
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        {checkout.settlement ? (
                          <div>
                            {checkout.settlement.amountRefundable > 0 ? (
                              <span style={{ color: '#16a34a', fontWeight: '600' }}>
                                Refund: ₹{checkout.settlement.amountRefundable.toLocaleString('en-IN')}
                              </span>
                            ) : checkout.settlement.amountDue > 0 ? (
                              <span style={{ color: '#dc2626', fontWeight: '600' }}>
                                Due: ₹{checkout.settlement.amountDue.toLocaleString('en-IN')}
                              </span>
                            ) : (
                              <span style={{ color: '#64748b', fontWeight: '600' }}>Settled (₹0)</span>
                            )}
                            <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>
                              Deposit: ₹{checkout.settlement.securityDeposit.toLocaleString('en-IN')}
                            </p>
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>None</span>
                        )}
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '700',
                            backgroundColor: color.bg,
                            color: color.text,
                            border: `1px solid ${color.border}`,
                            display: 'inline-block',
                          }}
                        >
                          {checkout.status.replace('_', ' ')}
                        </span>
                      </td>

                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          {/* Settlement Details / Edit Button */}
                          <button
                            onClick={() => handleOpenEditSettlement(checkout)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#ffffff',
                              color: '#334155',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                            }}
                          >
                            Settlement
                          </button>

                          {/* Mark Ready Button */}
                          {(checkout.status === 'INITIATED' || checkout.status === 'SETTLEMENT_PENDING') && (
                            <button
                              disabled={actionLoading === checkout.id}
                              onClick={() => handleMarkReady(checkout.id)}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: '1px solid #16a34a',
                                backgroundColor: '#f0fdf4',
                                color: '#16a34a',
                                fontSize: '12px',
                                fontWeight: '600',
                                cursor: 'pointer',
                              }}
                            >
                              Mark Ready
                            </button>
                          )}

                          {/* Complete Checkout Button */}
                          {checkout.status === 'READY' && (
                            <button
                              disabled={actionLoading === checkout.id}
                              onClick={() => handleCompleteCheckout(checkout.id)}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: 'none',
                                backgroundColor: '#0d9488',
                                color: '#ffffff',
                                fontSize: '12px',
                                fontWeight: '600',
                                cursor: 'pointer',
                              }}
                            >
                              Complete Move-Out
                            </button>
                          )}

                          {/* Cancel Button */}
                          {checkout.status !== 'COMPLETED' && checkout.status !== 'CANCELLED' && (
                            <button
                              disabled={actionLoading === checkout.id}
                              onClick={() => handleCancelCheckout(checkout.id)}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid #fecaca',
                                backgroundColor: '#fff5f5',
                                color: '#dc2626',
                                fontSize: '12px',
                                fontWeight: '600',
                                cursor: 'pointer',
                              }}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* 5-Step Checkout Wizard Modal */}
        {isWizardOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px',
            }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                width: '100%',
                maxWidth: '650px',
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: '28px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                  Digital Check-Out Wizard
                </h2>
                <button
                  onClick={() => setIsWizardOpen(false)}
                  style={{ background: 'none', border: 'none', fontSize: '18px', color: '#64748b', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              {wizardError && (
                <div
                  style={{
                    padding: '12px 16px',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '6px',
                    color: '#dc2626',
                    fontSize: '13px',
                    marginBottom: '16px',
                  }}
                >
                  {wizardError}
                </div>
              )}

              <form onSubmit={handleInitiateCheckout}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Property Select */}
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                      Property *
                    </label>
                    <select
                      value={wizardPropertyId}
                      onChange={(e) => setWizardPropertyId(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                      }}
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
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                      Tenant (Active Occupants) *
                    </label>
                    <select
                      value={wizardTenantId}
                      onChange={(e) => setWizardTenantId(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                      }}
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
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                      Check-Out Date *
                    </label>
                    <input
                      type="date"
                      value={wizardCheckoutDate}
                      onChange={(e) => setWizardCheckoutDate(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                      }}
                    />
                  </div>

                  {/* Reason */}
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                      Reason for Move-Out (Optional)
                    </label>
                    <textarea
                      rows={3}
                      value={wizardReason}
                      onChange={(e) => setWizardReason(e.target.value)}
                      placeholder="e.g., Job relocation, lease term completion..."
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                        resize: 'vertical',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                  <button
                    type="button"
                    onClick={() => setIsWizardOpen(false)}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      color: '#475569',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={wizardLoading}
                    style={{
                      padding: '10px 22px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: '#0d9488',
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    {wizardLoading ? 'Initiating...' : 'Initiate Move-Out'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Settlement Inspector / Edit Modal */}
        {selectedCheckoutForEdit && selectedCheckoutForEdit.settlement && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px',
            }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                width: '100%',
                maxWidth: '600px',
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: '28px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                    Settlement Calculation
                  </h2>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>
                    Tenant: {selectedCheckoutForEdit.tenant?.firstName} {selectedCheckoutForEdit.tenant?.lastName}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedCheckoutForEdit(null)}
                  style={{ background: 'none', border: 'none', fontSize: '18px', color: '#64748b', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              {/* Settlement Summary Breakdown Box */}
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '20px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                  <span style={{ color: '#64748b' }}>Security Deposit:</span>
                  <span style={{ fontWeight: '600' }}>
                    ₹{selectedCheckoutForEdit.settlement.securityDeposit.toLocaleString('en-IN')}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                  <span style={{ color: '#64748b' }}>Deductions:</span>
                  <span style={{ fontWeight: '600', color: '#dc2626' }}>
                    - ₹{Number(editDeductions).toLocaleString('en-IN')}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                  <span style={{ color: '#64748b' }}>Outstanding Rent & Maintenance:</span>
                  <span style={{ fontWeight: '600', color: '#dc2626' }}>
                    - ₹{(Number(editRent) + Number(editMaintenance)).toLocaleString('en-IN')}
                  </span>
                </div>
                <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '10px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: '700' }}>
                  <span>Net Settlement Result:</span>
                  {Math.max(
                    Math.max(selectedCheckoutForEdit.settlement.securityDeposit - editDeductions, 0) -
                      (Number(editRent) + Number(editMaintenance)),
                    0
                  ) > 0 ? (
                    <span style={{ color: '#16a34a' }}>
                      Refundable: ₹
                      {Math.max(
                        Math.max(selectedCheckoutForEdit.settlement.securityDeposit - editDeductions, 0) -
                          (Number(editRent) + Number(editMaintenance)),
                        0
                      ).toLocaleString('en-IN')}
                    </span>
                  ) : (
                    <span style={{ color: '#dc2626' }}>
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
              {selectedCheckoutForEdit.status !== 'COMPLETED' && selectedCheckoutForEdit.status !== 'CANCELLED' ? (
                <form onSubmit={handleSaveSettlement}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                        Outstanding Rent (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editRent}
                        onChange={(e) => setEditRent(Number(e.target.value))}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                        Maintenance Charges (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editMaintenance}
                        onChange={(e) => setEditMaintenance(Number(e.target.value))}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                        Damage Deductions (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editDeductions}
                        onChange={(e) => setEditDeductions(Number(e.target.value))}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                        Settlement Notes
                      </label>
                      <textarea
                        rows={2}
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="e.g. Wall painting deduction, deep cleaning charges..."
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedCheckoutForEdit(null)}
                      style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff' }}
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      disabled={editSaving}
                      style={{
                        padding: '8px 18px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: '#0d9488',
                        color: '#fff',
                        fontWeight: '600',
                      }}
                    >
                      {editSaving ? 'Saving...' : 'Save & Recalculate'}
                    </button>
                  </div>
                </form>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedCheckoutForEdit(null)}
                    style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff' }}
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
