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
import {
  LogIn,
  CheckCircle2,
  Clock,
  Ban,
  Building2,
  User,
  Plus,
  RefreshCw,
  Calendar,
  AlertTriangle,
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
  }, [wizardPropertyId, properties]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [checkInsRes, propsRes, tenantsRes] = await Promise.all([
        fetch('/api/v1/check-ins', { credentials: 'include' }).then((r) => r.json()).catch(() => ({ data: [] })),
        fetch('/api/v1/properties', { credentials: 'include' }).then((r) => r.json()).catch(() => ({ data: [] })),
        fetch('/api/v1/tenants', { credentials: 'include' }).then((r) => r.json()).catch(() => ({ data: [] })),
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
      const res = await fetch(url, { credentials: 'include' });
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
      const res = await fetch(`/api/v1/properties/${propertyId}/floors`, { credentials: 'include' });
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
      const res = await fetch(`/api/v1/properties/${propertyId}/leases`, { credentials: 'include' });
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
        credentials: 'include',
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
        credentials: 'include',
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
        credentials: 'include',
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
        credentials: 'include',
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

  const filterTabs = [
    { id: 'ALL', label: 'All' },
    { id: 'INITIATED', label: 'Initiated' },
    { id: 'READY', label: 'Ready' },
    { id: 'CHECKED_IN', label: 'Checked In' },
    { id: 'CANCELLED', label: 'Cancelled' },
  ];

  return (
    <AppShell activePath="/check-ins">
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        {/* Page Header */}
        <PageHeader
          title="Digital Check-In & Onboarding"
          subtitle="Manage digital tenant check-in workflows, space allocation, and onboarding verification"
          icon={LogIn}
          actions={
            <div className="flex items-center gap-2.5">
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  resetWizard();
                  setIsWizardOpen(true);
                }}
                className="gap-2 font-semibold shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Start Digital Check-In</span>
              </Button>
            </div>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <StatCard
            label="Total Check-Ins"
            value={totalCount}
            subtext="All recorded records"
            icon={LogIn}
            variant="default"
          />
          <StatCard
            label="Checked In"
            value={checkedInCount}
            subtext="Active tenant stays"
            icon={CheckCircle2}
            variant="teal"
          />
          <StatCard
            label="Ready to Check In"
            value={readyCount}
            subtext="Verified for move-in"
            icon={Clock}
            variant="blue"
          />
          <StatCard
            label="Initiated / Pending"
            value={initiatedCount}
            subtext="Awaiting KYC/docs"
            icon={AlertTriangle}
            variant="amber"
          />
          <StatCard
            label="Cancelled"
            value={cancelledCount}
            subtext="Revoked workflows"
            icon={Ban}
            variant="rose"
          />
        </div>

        {/* Filter Bar */}
        <FilterBar
          tabs={filterTabs}
          activeTab={filterStatus}
          onTabChange={setFilterStatus}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search tenant, property, phone..."
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

        {/* Check-In Table */}
        <div className="bg-brand-white border border-surface-border rounded-xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-surface-textSecondary space-y-3">
              <RefreshCw className="w-7 h-7 animate-spin mx-auto text-brand-teal" />
              <p className="text-xs font-medium">Loading check-in records...</p>
            </div>
          ) : filteredCheckIns.length === 0 ? (
            <EmptyState
              icon={LogIn}
              title="No check-in records found"
              description="There are no check-in records matching the selected filter criteria. Start a new digital check-in workflow or clear active filters."
              actionLabel="Start Digital Check-In"
              onAction={() => {
                resetWizard();
                setIsWizardOpen(true);
              }}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-brand-navy">
                <thead className="bg-surface-subtle text-[11px] uppercase text-surface-textSecondary font-semibold border-b border-surface-border">
                  <tr>
                    <th className="px-5 py-3">Tenant</th>
                    <th className="px-5 py-3">Property</th>
                    <th className="px-5 py-3">Assigned Space</th>
                    <th className="px-5 py-3">Check-In Date</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {filteredCheckIns.map((item) => {
                    const isPg = item.property?.propertyType === 'PG';
                    return (
                      <tr key={item.id} className="hover:bg-surface-subtle/70 transition-colors">
                        <td className="px-5 py-3.5">
                          <Link
                            href={`/tenants/${item.tenantId}`}
                            className="font-semibold text-brand-teal hover:underline"
                          >
                            {item.tenant ? `${item.tenant.firstName} ${item.tenant.lastName}` : item.tenantId}
                          </Link>
                          <div className="text-[11px] text-surface-textSecondary mt-0.5">
                            {item.tenant?.phone}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-medium text-brand-navy">{item.property?.name || '—'}</div>
                          <div className="text-[10px] uppercase font-semibold text-surface-textSecondary mt-0.5">
                            {item.property?.propertyType}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          {isPg ? (
                            item.bed ? (
                              <div>
                                <span className="font-semibold text-brand-navy">Bed {item.bed.bedNumber}</span>
                                <span className="text-surface-textSecondary text-[11px] ml-1.5">
                                  (Room {item.bed.room?.roomNumber || '—'}, Fl. {item.bed.room?.floor?.floorNumber ?? '—'})
                                </span>
                              </div>
                            ) : (
                              <span className="text-surface-disabled italic">Unassigned Bed</span>
                            )
                          ) : (
                            <div>
                              <span className="font-semibold text-brand-navy">
                                {item.rentalUnit?.unitNumber || 'Whole Unit'}
                              </span>
                              {item.lease && (
                                <span className="text-surface-textSecondary text-[11px] ml-1.5">
                                  (₹{item.lease.monthlyRent.toLocaleString('en-IN')}/mo)
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-medium text-brand-navy">
                            {new Date(item.checkInDate).toLocaleDateString()}
                          </div>
                          {item.expectedCheckoutDate && (
                            <div className="text-[10px] text-surface-textSecondary mt-0.5">
                              Exp: {new Date(item.expectedCheckoutDate).toLocaleDateString()}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {item.status === 'INITIATED' && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleMarkReady(item.id)}
                                isLoading={actionLoading === item.id}
                              >
                                Mark Ready
                              </Button>
                            )}
                            {item.status === 'READY' && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleCompleteCheckIn(item.id)}
                                isLoading={actionLoading === item.id}
                              >
                                Complete Check-In
                              </Button>
                            )}
                            {(item.status === 'INITIATED' || item.status === 'READY') && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCancelCheckIn(item.id)}
                                isLoading={actionLoading === item.id}
                                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                              >
                                Cancel
                              </Button>
                            )}
                            {item.status === 'CHECKED_IN' && (
                              <span className="text-xs text-brand-teal font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Active Stay</span>
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Digital Check-In Wizard Modal */}
      <Modal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        title="Start Digital Check-In"
        subtitle="Assign space, verify onboarding readiness, and initiate tenant stay"
        maxWidth="2xl"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsWizardOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateCheckIn}
              isLoading={wizardLoading}
              disabled={onboardingStatus ? !onboardingStatus.readyForCheckIn : false}
            >
              Initiate Check-In
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateCheckIn} className="space-y-4 text-xs">
          {wizardError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {wizardError}
            </div>
          )}

          {/* Select Tenant */}
          <div>
            <label className="block text-brand-navy font-semibold mb-1">Select Tenant *</label>
            <select
              required
              value={wizardTenantId}
              onChange={(e) => setWizardTenantId(e.target.value)}
              className="w-full bg-surface-subtle border border-surface-border rounded-lg px-3 py-2 text-xs text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
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
            <div className="bg-surface-subtle p-4 rounded-xl border border-surface-border space-y-2">
              <div className="font-semibold text-brand-navy text-xs">
                Onboarding Readiness Checklist:
              </div>
              {evaluatingReadiness ? (
                <div className="text-surface-textSecondary text-xs">
                  Evaluating tenant profile and KYC status...
                </div>
              ) : onboardingStatus ? (
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className={onboardingStatus.tenantProfileComplete ? 'text-emerald-700' : 'text-rose-700'}>
                    {onboardingStatus.tenantProfileComplete ? '✓ Profile Complete' : '✕ Incomplete Profile'}
                  </div>
                  <div className={onboardingStatus.emergencyContactComplete ? 'text-emerald-700' : 'text-rose-700'}>
                    {onboardingStatus.emergencyContactComplete ? '✓ Emergency Contact' : '✕ Missing Emergency Info'}
                  </div>
                  <div className={onboardingStatus.kycVerified ? 'text-emerald-700' : 'text-rose-700'}>
                    {onboardingStatus.kycVerified ? '✓ KYC Verified' : '✕ KYC Pending/Missing'}
                  </div>
                  <div className={!onboardingStatus.activePgStayPresent ? 'text-emerald-700' : 'text-rose-700'}>
                    {!onboardingStatus.activePgStayPresent ? '✓ No Active PG Stay' : '✕ Active Stay Exists'}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Select Property */}
          <div>
            <label className="block text-brand-navy font-semibold mb-1">Select Property *</label>
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
              className="w-full bg-surface-subtle border border-surface-border rounded-lg px-3 py-2 text-xs text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
            >
              <option value="">-- Choose Property --</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.propertyType === 'PG' ? 'Co-Living / PG' : 'Whole-Unit Rental'})
                </option>
              ))}
            </select>
          </div>

          {/* Cascading Floor -> Room -> Bed Selection (PG) */}
          {selectedProp?.propertyType === 'PG' && (
            <div className="bg-teal-50/50 p-4 rounded-xl border border-teal-200/60 space-y-3">
              <div className="font-semibold text-brand-teal text-xs">
                Select PG Space (Floor → Room → Available Bed)
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-brand-navy mb-1">Floor *</label>
                  <select
                    required
                    value={selectedFloorId}
                    onChange={(e) => {
                      setSelectedFloorId(e.target.value);
                      setSelectedRoomId('');
                      setWizardBedId('');
                    }}
                    className="w-full bg-brand-white border border-surface-border rounded-lg px-2.5 py-1.5 text-xs text-brand-navy focus:outline-none focus:border-brand-teal"
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
                  <label className="block text-xs font-semibold text-brand-navy mb-1">Room *</label>
                  <select
                    required
                    value={selectedRoomId}
                    onChange={(e) => {
                      setSelectedRoomId(e.target.value);
                      setWizardBedId('');
                    }}
                    disabled={!selectedFloorId}
                    className="w-full bg-brand-white border border-surface-border rounded-lg px-2.5 py-1.5 text-xs text-brand-navy focus:outline-none focus:border-brand-teal disabled:opacity-50"
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
                  <label className="block text-xs font-semibold text-brand-navy mb-1">Bed *</label>
                  <select
                    required
                    value={wizardBedId}
                    onChange={(e) => setWizardBedId(e.target.value)}
                    disabled={!selectedRoomId || availableBeds.length === 0}
                    className="w-full bg-brand-white border border-surface-border rounded-lg px-2.5 py-1.5 text-xs text-brand-navy focus:outline-none focus:border-brand-teal disabled:opacity-50"
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

          {/* Select Active Lease (Rental House) */}
          {selectedProp?.propertyType === 'RENTAL_HOUSE' && (
            <div className="bg-teal-50/50 p-4 rounded-xl border border-teal-200/60 space-y-2">
              <div className="font-semibold text-brand-teal text-xs">
                Select Active Lease
              </div>
              <select
                required
                value={wizardLeaseId}
                onChange={(e) => setWizardLeaseId(e.target.value)}
                className="w-full bg-brand-white border border-surface-border rounded-lg px-3 py-2 text-xs text-brand-navy focus:outline-none focus:border-brand-teal"
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-brand-navy font-semibold mb-1">Check-In Date *</label>
              <input
                type="date"
                required
                value={wizardCheckInDate}
                onChange={(e) => setWizardCheckInDate(e.target.value)}
                className="w-full bg-surface-subtle border border-surface-border rounded-lg px-3 py-2 text-xs text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
              />
            </div>
            <div>
              <label className="block text-brand-navy font-semibold mb-1">Expected Checkout Date</label>
              <input
                type="date"
                value={wizardExpectedCheckoutDate}
                onChange={(e) => setWizardExpectedCheckoutDate(e.target.value)}
                className="w-full bg-surface-subtle border border-surface-border rounded-lg px-3 py-2 text-xs text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-brand-navy font-semibold mb-1">Notes & Special Instructions</label>
            <textarea
              rows={2}
              placeholder="e.g. Key handover, parking sticker issued..."
              value={wizardNotes}
              onChange={(e) => setWizardNotes(e.target.value)}
              className="w-full bg-surface-subtle border border-surface-border rounded-lg px-3 py-2 text-xs text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
            />
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
