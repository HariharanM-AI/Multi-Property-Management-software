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
}

interface Floor {
  id: string;
  floorNumber: number;
  name: string;
  rooms: Room[];
}

interface Room {
  id: string;
  roomNumber: string;
  beds: Bed[];
}

interface Bed {
  id: string;
  bedNumber: string;
  status: string;
  monthlyRent: number;
}

interface Lease {
  id: string;
  rentalUnitId: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  status: string;
  rentalUnit?: {
    id: string;
    unitNumber: string;
  };
}

interface OnboardingStatus {
  tenantId: string;
  tenantProfileComplete: boolean;
  emergencyContactComplete: boolean;
  kycRequired: boolean;
  kycVerified: boolean;
  activePgStayPresent: boolean;
  activeLeasePresent: boolean;
  readyForCheckIn: boolean;
  missingItems: string[];
}

interface CheckInRecord {
  id: string;
  tenantId: string;
  propertyId: string;
  bedId?: string | null;
  rentalUnitId?: string | null;
  leaseId?: string | null;
  checkInDate: string;
  expectedCheckoutDate?: string | null;
  status: 'INITIATED' | 'READY' | 'CHECKED_IN' | 'CANCELLED';
  emergencyContactConfirmed: boolean;
  kycConfirmed: boolean;
  notes?: string | null;
  createdAt: string;
  completedAt?: string | null;
  cancelledAt?: string | null;
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
    status: string;
  };
}

export default function CheckInsPage() {
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');

  // Wizard State
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardTenantId, setWizardTenantId] = useState('');
  const [wizardPropertyId, setWizardPropertyId] = useState('');
  const [wizardBedId, setWizardBedId] = useState('');
  const [wizardLeaseId, setWizardLeaseId] = useState('');
  const [wizardCheckInDate, setWizardCheckInDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [wizardExpectedCheckoutDate, setWizardExpectedCheckoutDate] = useState('');
  const [wizardNotes, setWizardNotes] = useState('');
  const [wizardError, setWizardError] = useState('');
  const [wizardLoading, setWizardLoading] = useState(false);

  // Cascading PG selection state
  const [propertyFloors, setPropertyFloors] = useState<Floor[]>([]);
  const [selectedFloorId, setSelectedFloorId] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [propertyLeases, setPropertyLeases] = useState<Lease[]>([]);

  // Readiness State
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);
  const [evaluatingReadiness, setEvaluatingReadiness] = useState(false);

  // Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (wizardTenantId) {
      fetchTenantReadiness(wizardTenantId, wizardPropertyId);
    } else {
      setOnboardingStatus(null);
    }
  }, [wizardTenantId, wizardPropertyId]);

  useEffect(() => {
    if (wizardPropertyId) {
      const prop = properties.find((p) => p.id === wizardPropertyId);
      if (prop?.propertyType === 'PG') {
        fetchFloors(wizardPropertyId);
      } else if (prop?.propertyType === 'RENTAL_HOUSE') {
        fetchLeases(wizardPropertyId);
      }
    } else {
      setPropertyFloors([]);
      setPropertyLeases([]);
    }
  }, [wizardPropertyId]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [checkInsRes, propsRes, tenantsRes] = await Promise.all([
        fetch('/api/v1/check-ins').then((r) => r.json()).catch(() => ({ data: [] })),
        fetch('/api/v1/properties').then((r) => r.json()).catch(() => ({ data: [] })),
        fetch('/api/v1/tenants').then((r) => r.json()).catch(() => ({ data: [] })),
      ]);

      setCheckIns(checkInsRes.data || []);
      setProperties(propsRes.data || []);
      setTenants(tenantsRes.data || []);
    } catch (err) {
      console.error('Failed to load check-in dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTenantReadiness = async (tenantId: string, propertyId?: string) => {
    setEvaluatingReadiness(true);
    try {
      const url = propertyId
        ? `/api/v1/tenants/${tenantId}/onboarding-status?propertyId=${propertyId}`
        : `/api/v1/tenants/${tenantId}/onboarding-status`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setOnboardingStatus(data.data);
      }
    } catch (err) {
      console.error('Failed to evaluate tenant onboarding status', err);
    } finally {
      setEvaluatingReadiness(false);
    }
  };

  const fetchFloors = async (propertyId: string) => {
    try {
      const res = await fetch(`/api/v1/properties/${propertyId}/floors`);
      const data = await res.json();
      if (data.success) {
        setPropertyFloors(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load floors', err);
    }
  };

  const fetchLeases = async (propertyId: string) => {
    try {
      const res = await fetch(`/api/v1/properties/${propertyId}/leases`);
      const data = await res.json();
      if (data.success) {
        setPropertyLeases(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load leases', err);
    }
  };

  const handleCreateCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setWizardError('');
    setWizardLoading(true);

    try {
      const selectedProp = properties.find((p) => p.id === wizardPropertyId);
      const isPg = selectedProp?.propertyType === 'PG';

      const payload: any = {
        tenantId: wizardTenantId,
        checkInDate: new Date(wizardCheckInDate).toISOString(),
        expectedCheckoutDate: wizardExpectedCheckoutDate
          ? new Date(wizardExpectedCheckoutDate).toISOString()
          : undefined,
        emergencyContactConfirmed: true,
        notes: wizardNotes || undefined,
      };

      if (isPg) {
        if (!wizardBedId) {
          throw new Error('Please select an available bed for PG check-in');
        }
        payload.bedId = wizardBedId;
      } else {
        if (!wizardLeaseId) {
          throw new Error('Please select an active lease for whole-unit check-in');
        }
        payload.leaseId = wizardLeaseId;
      }

      const res = await fetch(`/api/v1/properties/${wizardPropertyId}/check-ins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error?.message || 'Failed to initiate check-in');
      }

      setIsWizardOpen(false);
      resetWizard();
      setActionMessage('Check-in initiated successfully!');
      fetchInitialData();
    } catch (err: any) {
      setWizardError(err.message || 'Error creating check-in record');
    } finally {
      setWizardLoading(false);
    }
  };

  const handleMarkReady = async (checkInId: string) => {
    setActionLoading(checkInId);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/v1/check-ins/${checkInId}/ready`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error?.message || 'Failed to mark ready');
      }
      setActionMessage('Check-in is verified and ready for completion!');
      fetchInitialData();
    } catch (err: any) {
      alert(err.message || 'Error transitioning check-in to ready');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCompleteCheckIn = async (checkInId: string) => {
    setActionLoading(checkInId);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/v1/check-ins/${checkInId}/complete`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error?.message || 'Failed to complete check-in');
      }
      setActionMessage('Tenant successfully checked in and occupancy recorded!');
      fetchInitialData();
    } catch (err: any) {
      alert(err.message || 'Error completing check-in');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelCheckIn = async (checkInId: string) => {
    const reason = prompt('Please enter a cancellation reason (optional):');
    if (reason === null) return;

    setActionLoading(checkInId);
    try {
      const res = await fetch(`/api/v1/check-ins/${checkInId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error?.message || 'Failed to cancel check-in');
      }
      setActionMessage('Check-in was cancelled successfully.');
      fetchInitialData();
    } catch (err: any) {
      alert(err.message || 'Error cancelling check-in');
    } finally {
      setActionLoading(null);
    }
  };

  const resetWizard = () => {
    setWizardStep(1);
    setWizardTenantId('');
    setWizardPropertyId('');
    setWizardBedId('');
    setWizardLeaseId('');
    setSelectedFloorId('');
    setSelectedRoomId('');
    setWizardCheckInDate(new Date().toISOString().split('T')[0]);
    setWizardExpectedCheckoutDate('');
    setWizardNotes('');
    setWizardError('');
    setOnboardingStatus(null);
  };

  // Filtered check-ins list
  const filteredCheckIns = checkIns.filter((c) => {
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
  const totalCount = checkIns.length;
  const checkedInCount = checkIns.filter((c) => c.status === 'CHECKED_IN').length;
  const readyCount = checkIns.filter((c) => c.status === 'READY').length;
  const initiatedCount = checkIns.filter((c) => c.status === 'INITIATED').length;
  const cancelledCount = checkIns.filter((c) => c.status === 'CANCELLED').length;

  const selectedProp = properties.find((p) => p.id === wizardPropertyId);
  const selectedFloor = propertyFloors.find((f) => f.id === selectedFloorId);
  const selectedRoom = selectedFloor?.rooms.find((r) => r.id === selectedRoomId);
  const availableBeds = selectedRoom?.beds.filter((b) => b.status === 'AVAILABLE') || [];

  return (
    <AppShell activePath="/check-ins">
      <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto', color: '#1e293b' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#0f172a', margin: '0 0 6px 0' }}>
            Digital Check-In & Onboarding
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
            Manage digital tenant check-in workflows, PG bed assignments, lease occupancy, and onboarding readiness.
          </p>
        </div>
        <button
          onClick={() => {
            resetWizard();
            setIsWizardOpen(true);
          }}
          style={{
            backgroundColor: '#2563eb',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 4px rgba(37,99,235,0.2)',
          }}
        >
          <span style={{ fontSize: '18px' }}>+</span> Start Digital Check-In
        </button>
      </div>

      {actionMessage && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#ecfdf5',
            color: '#065f46',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px',
            fontWeight: '500',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>✓ {actionMessage}</span>
          <button
            onClick={() => setActionMessage(null)}
            style={{ background: 'none', border: 'none', color: '#065f46', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Total Check-Ins</div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#0f172a', marginTop: '6px' }}>{totalCount}</div>
        </div>
        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '13px', color: '#10b981', fontWeight: '600', textTransform: 'uppercase' }}>Checked In</div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#10b981', marginTop: '6px' }}>{checkedInCount}</div>
        </div>
        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '13px', color: '#3b82f6', fontWeight: '600', textTransform: 'uppercase' }}>Ready to Check In</div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#3b82f6', marginTop: '6px' }}>{readyCount}</div>
        </div>
        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '13px', color: '#f59e0b', fontWeight: '600', textTransform: 'uppercase' }}>Initiated / Pending</div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#f59e0b', marginTop: '6px' }}>{initiatedCount}</div>
        </div>
        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '13px', color: '#ef4444', fontWeight: '600', textTransform: 'uppercase' }}>Cancelled</div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#64748b', marginTop: '6px' }}>{cancelledCount}</div>
        </div>
      </div>

      {/* Filter Tabs and Search Bar */}
      <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Status Tabs */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { label: 'All', value: 'ALL' },
            { label: 'Initiated', value: 'INITIATED' },
            { label: 'Ready', value: 'READY' },
            { label: 'Checked In', value: 'CHECKED_IN' },
            { label: 'Cancelled', value: 'CANCELLED' },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilterStatus(tab.value)}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: filterStatus === tab.value ? '#2563eb' : '#f1f5f9',
                color: filterStatus === tab.value ? '#ffffff' : '#64748b',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Property Filter */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select
            value={selectedPropertyId}
            onChange={(e) => setSelectedPropertyId(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              backgroundColor: '#ffffff',
              color: '#334155',
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

      {/* Check-In Table */}
      <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '14px 20px', fontWeight: '600', color: '#475569' }}>Tenant</th>
              <th style={{ padding: '14px 20px', fontWeight: '600', color: '#475569' }}>Property</th>
              <th style={{ padding: '14px 20px', fontWeight: '600', color: '#475569' }}>Assigned Space</th>
              <th style={{ padding: '14px 20px', fontWeight: '600', color: '#475569' }}>Check-In Date</th>
              <th style={{ padding: '14px 20px', fontWeight: '600', color: '#475569' }}>Status</th>
              <th style={{ padding: '14px 20px', fontWeight: '600', color: '#475569', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                  Loading check-in records...
                </td>
              </tr>
            ) : filteredCheckIns.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  No check-in records found matching the selected filters.
                </td>
              </tr>
            ) : (
              filteredCheckIns.map((item) => {
                const isPg = item.property?.propertyType === 'PG';
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 20px' }}>
                      <Link
                        href={`/tenants/${item.tenantId}`}
                        style={{ color: '#2563eb', fontWeight: '600', textDecoration: 'none' }}
                      >
                        {item.tenant ? `${item.tenant.firstName} ${item.tenant.lastName}` : item.tenantId}
                      </Link>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                        {item.tenant?.phone}
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ fontWeight: '500', color: '#1e293b' }}>{item.property?.name || '—'}</div>
                      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>
                        {item.property?.propertyType}
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      {isPg ? (
                        item.bed ? (
                          <div>
                            <span style={{ fontWeight: '600', color: '#0f172a' }}>Bed {item.bed.bedNumber}</span>
                            <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '6px' }}>
                              (Room {item.bed.room?.roomNumber || '—'}, Fl. {item.bed.room?.floor?.floorNumber ?? '—'})
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>Unassigned Bed</span>
                        )
                      ) : (
                        <div>
                          <span style={{ fontWeight: '600', color: '#0f172a' }}>
                            {item.rentalUnit?.unitNumber || 'Whole Unit'}
                          </span>
                          {item.lease && (
                            <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '6px' }}>
                              (₹{item.lease.monthlyRent.toLocaleString('en-IN')}/mo)
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ color: '#334155', fontWeight: '500' }}>
                        {new Date(item.checkInDate).toLocaleDateString()}
                      </div>
                      {item.expectedCheckoutDate && (
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          Exp: {new Date(item.expectedCheckoutDate).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          backgroundColor:
                            item.status === 'CHECKED_IN'
                              ? '#dcfce7'
                              : item.status === 'READY'
                              ? '#dbeafe'
                              : item.status === 'INITIATED'
                              ? '#fef3c7'
                              : '#f1f5f9',
                          color:
                            item.status === 'CHECKED_IN'
                              ? '#15803d'
                              : item.status === 'READY'
                              ? '#1d4ed8'
                              : item.status === 'INITIATED'
                              ? '#b45309'
                              : '#64748b',
                        }}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        {item.status === 'INITIATED' && (
                          <button
                            onClick={() => handleMarkReady(item.id)}
                            disabled={actionLoading === item.id}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#3b82f6',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                            }}
                          >
                            Mark Ready
                          </button>
                        )}
                        {item.status === 'READY' && (
                          <button
                            onClick={() => handleCompleteCheckIn(item.id)}
                            disabled={actionLoading === item.id}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#10b981',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                            }}
                          >
                            Complete Check-In
                          </button>
                        )}
                        {(item.status === 'INITIATED' || item.status === 'READY') && (
                          <button
                            onClick={() => handleCancelCheckIn(item.id)}
                            disabled={actionLoading === item.id}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#fee2e2',
                              color: '#b91c1c',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                            }}
                          >
                            Cancel
                          </button>
                        )}
                        {item.status === 'CHECKED_IN' && (
                          <span style={{ fontSize: '12px', color: '#10b981', fontWeight: '500' }}>
                            ✓ Active Stay
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Digital Check-In Wizard Modal */}
      {isWizardOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '640px',
              padding: '28px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px 0' }}>
                  Start Digital Check-In
                </h2>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                  Assign space, verify onboarding readiness, and initiate tenant stay.
                </p>
              </div>
              <button
                onClick={() => setIsWizardOpen(false)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  fontSize: '16px',
                  color: '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>

            {wizardError && (
              <div
                style={{
                  padding: '12px',
                  backgroundColor: '#fef2f2',
                  color: '#991b1b',
                  borderRadius: '8px',
                  fontSize: '13px',
                  marginBottom: '16px',
                }}
              >
                {wizardError}
              </div>
            )}

            <form onSubmit={handleCreateCheckIn}>
              {/* Step 1: Select Tenant */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Select Tenant *
                </label>
                <select
                  required
                  value={wizardTenantId}
                  onChange={(e) => setWizardTenantId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    backgroundColor: '#ffffff',
                  }}
                >
                  <option value="">-- Choose Tenant --</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.firstName} {t.lastName} ({t.phone}) - {t.status}
                    </option>
                  ))}
                </select>
              </div>

              {/* Onboarding Readiness Visualizer */}
              {wizardTenantId && (
                <div
                  style={{
                    background: '#f8fafc',
                    padding: '14px 16px',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    marginBottom: '18px',
                    fontSize: '13px',
                  }}
                >
                  <div style={{ fontWeight: '600', color: '#1e293b', marginBottom: '8px' }}>
                    Onboarding Readiness Checklist:
                  </div>
                  {evaluatingReadiness ? (
                    <div style={{ color: '#64748b' }}>Evaluating tenant profile and KYC status...</div>
                  ) : onboardingStatus ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div style={{ color: onboardingStatus.tenantProfileComplete ? '#15803d' : '#b91c1c' }}>
                        {onboardingStatus.tenantProfileComplete ? '✓ Profile Complete' : '✕ Incomplete Profile'}
                      </div>
                      <div style={{ color: onboardingStatus.emergencyContactComplete ? '#15803d' : '#b91c1c' }}>
                        {onboardingStatus.emergencyContactComplete ? '✓ Emergency Contact' : '✕ Missing Emergency Info'}
                      </div>
                      <div style={{ color: onboardingStatus.kycVerified ? '#15803d' : '#b91c1c' }}>
                        {onboardingStatus.kycVerified ? '✓ KYC Verified' : '✕ KYC Pending/Missing'}
                      </div>
                      <div style={{ color: !onboardingStatus.activePgStayPresent ? '#15803d' : '#b91c1c' }}>
                        {!onboardingStatus.activePgStayPresent ? '✓ No Active PG Stay' : '✕ Active Stay Exists'}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Step 2: Select Property */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Select Property *
                </label>
                <select
                  required
                  value={wizardPropertyId}
                  onChange={(e) => {
                    setWizardPropertyId(e.target.value);
                    setWizardBedId('');
                    setWizardLeaseId('');
                    setSelectedFloorId('');
                    setSelectedRoomId('');
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    backgroundColor: '#ffffff',
                  }}
                >
                  <option value="">-- Choose Property --</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.propertyType === 'PG' ? 'Co-Living / PG' : 'Whole-Unit Rental'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 3 (PG): Cascading Floor -> Room -> Bed Selection */}
              {selectedProp?.propertyType === 'PG' && (
                <div style={{ background: '#eff6ff', padding: '16px', borderRadius: '10px', marginBottom: '18px' }}>
                  <div style={{ fontWeight: '600', color: '#1e40af', marginBottom: '12px', fontSize: '13px' }}>
                    Select PG Space (Floor → Room → Available Bed)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                        Floor *
                      </label>
                      <select
                        required
                        value={selectedFloorId}
                        onChange={(e) => {
                          setSelectedFloorId(e.target.value);
                          setSelectedRoomId('');
                          setWizardBedId('');
                        }}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      >
                        <option value="">Floor</option>
                        {propertyFloors.map((f) => (
                          <option key={f.id} value={f.id}>
                            Floor {f.floorNumber}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                        Room *
                      </label>
                      <select
                        required
                        value={selectedRoomId}
                        onChange={(e) => {
                          setSelectedRoomId(e.target.value);
                          setWizardBedId('');
                        }}
                        disabled={!selectedFloorId}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      >
                        <option value="">Room</option>
                        {selectedFloor?.rooms.map((r) => (
                          <option key={r.id} value={r.id}>
                            Room {r.roomNumber}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                        Bed *
                      </label>
                      <select
                        required
                        value={wizardBedId}
                        onChange={(e) => setWizardBedId(e.target.value)}
                        disabled={!selectedRoomId || availableBeds.length === 0}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      >
                        <option value="">Bed</option>
                        {availableBeds.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.bedNumber} (₹{Number(b.monthlyRent).toLocaleString('en-IN')})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3 (Whole-Unit): Select Active Lease */}
              {selectedProp?.propertyType === 'RENTAL_HOUSE' && (
                <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '10px', marginBottom: '18px' }}>
                  <div style={{ fontWeight: '600', color: '#166534', marginBottom: '10px', fontSize: '13px' }}>
                    Select Active Lease (CORE-006)
                  </div>
                  <select
                    required
                    value={wizardLeaseId}
                    onChange={(e) => setWizardLeaseId(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  >
                    <option value="">-- Choose Active Lease --</option>
                    {propertyLeases
                      .filter((l) => l.status === 'ACTIVE')
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          Unit {l.rentalUnit?.unitNumber || 'Whole Unit'} — ₹{Number(l.monthlyRent).toLocaleString('en-IN')}/mo ({new Date(l.startDate).toLocaleDateString()} to {new Date(l.endDate).toLocaleDateString()})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Dates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '18px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Check-In Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={wizardCheckInDate}
                    onChange={(e) => setWizardCheckInDate(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Expected Checkout Date
                  </label>
                  <input
                    type="date"
                    value={wizardExpectedCheckoutDate}
                    onChange={(e) => setWizardExpectedCheckoutDate(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  />
                </div>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Notes & Special Instructions
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Key handover, parking sticker issued..."
                  value={wizardNotes}
                  onChange={(e) => setWizardNotes(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', resize: 'vertical' }}
                />
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsWizardOpen(false)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
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
                  disabled={wizardLoading || (onboardingStatus ? !onboardingStatus.readyForCheckIn : false)}
                  style={{
                    padding: '10px 22px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor:
                      onboardingStatus && !onboardingStatus.readyForCheckIn ? '#94a3b8' : '#2563eb',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor:
                      onboardingStatus && !onboardingStatus.readyForCheckIn ? 'not-allowed' : 'pointer',
                  }}
                >
                  {wizardLoading ? 'Initiating...' : 'Initiate Check-In'}
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
