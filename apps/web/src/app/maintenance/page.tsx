'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Wrench,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Plus,
  Building2,
  Calendar,
  ArrowRight,
  User,
  IndianRupee,
  RefreshCw,
  LayoutList,
  Columns3,
} from 'lucide-react';

const API_BASE = '/api/v1';

export default function MaintenancePage() {
  const [properties, setProperties] = useState<any[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [tickets, setTickets] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({
    totalTickets: 0,
    openTickets: 0,
    assignedTickets: 0,
    inProgressTickets: 0,
    urgentTickets: 0,
    awaitingVerificationTickets: 0,
    completedTodayTickets: 0,
    closedTickets: 0,
    avgResolutionHours: 0,
    totalEstimatedCost: '0',
    totalActualCost: '0',
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    propertyId: '',
    targetType: 'PROPERTY',
    floorId: '',
    roomId: '',
    bedId: '',
    rentalUnitId: '',
    title: '',
    description: '',
    category: 'PLUMBING',
    priority: 'MEDIUM',
    locationDetails: '',
    estimatedCost: '',
    scheduledAt: '',
  });

  // Target Options for selected property in modal
  const [floors, setFloors] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [beds, setBeds] = useState<any[]>([]);
  const [rentalUnits, setRentalUnits] = useState<any[]>([]);

  const fetchProperties = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('propertyos_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/properties`, { headers, credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        const propList = json.data || [];
        setProperties(propList);
        if (propList.length > 0) {
          setSelectedPropertyId((prev) => prev || propList[0].id);
          setFormData((prev) => ({ ...prev, propertyId: prev.propertyId || propList[0].id }));
        }
      }
    } catch (e) {
      console.error('Failed to load properties:', e);
    }
  };

  const fetchMaintenanceData = useCallback(async () => {
    setLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('propertyos_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const queryParams = new URLSearchParams();
      if (selectedPropertyId) queryParams.append('propertyId', selectedPropertyId);
      if (activeTab !== 'ALL') queryParams.append('status', activeTab);
      if (priorityFilter !== 'ALL') queryParams.append('priority', priorityFilter);
      if (categoryFilter !== 'ALL') queryParams.append('category', categoryFilter);
      if (searchQuery) queryParams.append('search', searchQuery);

      const [ticketsRes, summaryRes] = await Promise.all([
        fetch(`${API_BASE}/maintenance/tickets?${queryParams.toString()}`, { headers, credentials: 'include' }),
        fetch(
          selectedPropertyId
            ? `${API_BASE}/properties/${selectedPropertyId}/maintenance/summary`
            : `${API_BASE}/maintenance/summary`,
          { headers, credentials: 'include' }
        ),
      ]);

      if (ticketsRes.ok) {
        const json = await ticketsRes.json();
        const list = Array.isArray(json.data) ? json.data : json.data?.data || [];
        setTickets(list);
      }
      if (summaryRes.ok) {
        const json = await summaryRes.json();
        setSummary(json.data || {});
      }
    } catch (e) {
      console.error('Failed to load maintenance data:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedPropertyId, activeTab, priorityFilter, categoryFilter, searchQuery]);

  useEffect(() => {
    fetchProperties();
  }, []);

  useEffect(() => {
    fetchMaintenanceData();
  }, [fetchMaintenanceData]);

  // Load modal target options when modal property changes
  const selectedModalProperty = useMemo(() => {
    return properties.find((p) => p.id === formData.propertyId);
  }, [properties, formData.propertyId]);

  useEffect(() => {
    if (!formData.propertyId) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('propertyos_token') : null;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    if (selectedModalProperty?.propertyType === 'PG') {
      fetch(`${API_BASE}/properties/${formData.propertyId}/floors`, { headers, credentials: 'include' })
        .then((r) => r.json())
        .then((d) => setFloors(d.data || []))
        .catch(() => {});
      fetch(`${API_BASE}/properties/${formData.propertyId}/rooms`, { headers, credentials: 'include' })
        .then((r) => r.json())
        .then((d) => setRooms(d.data || []))
        .catch(() => {});
    } else if (selectedModalProperty?.propertyType === 'RENTAL_HOUSE') {
      fetch(`${API_BASE}/properties/${formData.propertyId}/units`, { headers, credentials: 'include' })
        .then((r) => r.json())
        .then((d) => setRentalUnits(d.data || []))
        .catch(() => {});
    }
  }, [formData.propertyId, selectedModalProperty]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.propertyId || !formData.title || !formData.description) {
      setCreateError('Please fill out all required fields.');
      return;
    }

    setIsSubmitting(true);
    setCreateError(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('propertyos_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const payload: any = {
        propertyId: formData.propertyId,
        targetType: formData.targetType,
        title: formData.title,
        description: formData.description,
        category: formData.category,
        priority: formData.priority,
        locationDetails: formData.locationDetails || undefined,
        estimatedCost: formData.estimatedCost ? parseFloat(formData.estimatedCost) : undefined,
        scheduledAt: formData.scheduledAt || undefined,
      };

      if (formData.targetType === 'ROOM') payload.roomId = formData.roomId || undefined;
      if (formData.targetType === 'FLOOR') payload.floorId = formData.floorId || undefined;
      if (formData.targetType === 'BED') payload.bedId = formData.bedId || undefined;
      if (formData.targetType === 'RENTAL_UNIT') payload.rentalUnitId = formData.rentalUnitId || undefined;

      const res = await fetch(`${API_BASE}/maintenance/tickets`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to create ticket');
      }

      setIsCreateOpen(false);
      setFormData({
        propertyId: selectedPropertyId || (properties[0]?.id ?? ''),
        targetType: 'PROPERTY',
        floorId: '',
        roomId: '',
        bedId: '',
        rentalUnitId: '',
        title: '',
        description: '',
        category: 'PLUMBING',
        priority: 'MEDIUM',
        locationDetails: '',
        estimatedCost: '',
        scheduledAt: '',
      });
      fetchMaintenanceData();
    } catch (e: any) {
      setCreateError(e.message || 'An error occurred while creating the ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  const [viewMode, setViewMode] = useState<'LIST' | 'KANBAN'>('LIST');

  const KANBAN_COLUMNS = useMemo(
    () => [
      { id: 'OPEN', label: 'Open', dotColor: 'bg-blue-500', headerBg: 'bg-blue-50/60 text-blue-900 border-blue-200' },
      { id: 'ASSIGNED', label: 'Assigned', dotColor: 'bg-purple-500', headerBg: 'bg-purple-50/60 text-purple-900 border-purple-200' },
      { id: 'IN_PROGRESS', label: 'In Progress', dotColor: 'bg-amber-500', headerBg: 'bg-amber-50/60 text-amber-900 border-amber-200' },
      { id: 'COMPLETED', label: 'Completed', dotColor: 'bg-teal-500', headerBg: 'bg-teal-50/60 text-teal-900 border-teal-200' },
      { id: 'VERIFIED', label: 'Verified', dotColor: 'bg-emerald-500', headerBg: 'bg-emerald-50/60 text-emerald-900 border-emerald-200' },
      { id: 'CLOSED', label: 'Closed', dotColor: 'bg-slate-500', headerBg: 'bg-slate-50/60 text-slate-900 border-slate-200' },
    ],
    []
  );

  const kanbanData = useMemo(() => {
    const map: Record<string, any[]> = {
      OPEN: [],
      ASSIGNED: [],
      IN_PROGRESS: [],
      COMPLETED: [],
      VERIFIED: [],
      CLOSED: [],
    };
    const list = Array.isArray(tickets) ? tickets : (tickets as any)?.data || [];
    list.forEach((t: any) => {
      if (t && t.status && map[t.status]) {
        map[t.status].push(t);
      }
    });
    return map;
  }, [tickets]);

  const statusTabs = [
    { id: 'ALL', label: 'All' },
    { id: 'OPEN', label: 'Open' },
    { id: 'ASSIGNED', label: 'Assigned' },
    { id: 'IN_PROGRESS', label: 'In Progress' },
    { id: 'COMPLETED', label: 'Completed' },
    { id: 'VERIFIED', label: 'Verified' },
    { id: 'CLOSED', label: 'Closed' },
    { id: 'CANCELLED', label: 'Cancelled' },
  ];

  return (
    <AppShell activePath="/maintenance">
      <div className="space-y-6 w-full pb-16">
        {/* Page Header */}
        <PageHeader
          title="Maintenance & Work Orders"
          subtitle="Manage issue tickets, staff assignments, and resolution lifecycles"
          icon={Wrench}
          actions={
            <div className="flex flex-wrap items-center gap-2.5">
              {/* View Switcher Toggle */}
              <div className="flex items-center bg-surface-subtle border border-surface-border rounded-lg p-0.5 shadow-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('LIST')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                    viewMode === 'LIST'
                      ? 'bg-brand-white text-brand-teal shadow-xs border border-surface-border'
                      : 'text-surface-textSecondary hover:text-brand-navy'
                  }`}
                  title="List View"
                  aria-label="List View"
                >
                  <LayoutList className="w-3.5 h-3.5" />
                  <span>List</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('KANBAN')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                    viewMode === 'KANBAN'
                      ? 'bg-brand-white text-brand-teal shadow-xs border border-surface-border'
                      : 'text-surface-textSecondary hover:text-brand-navy'
                  }`}
                  title="Kanban Board View"
                  aria-label="Kanban Board View"
                >
                  <Columns3 className="w-3.5 h-3.5" />
                  <span>Kanban</span>
                </button>
              </div>

              {/* Property Selector */}
              <div className="flex items-center gap-2 bg-brand-white border border-surface-border rounded-lg px-3 py-1.5 shadow-xs">
                <Building2 className="w-4 h-4 text-brand-teal shrink-0" />
                <select
                  aria-label="Select Property"
                  value={selectedPropertyId}
                  onChange={(e) => setSelectedPropertyId(e.target.value)}
                  className="text-xs font-semibold text-brand-navy bg-transparent border-none outline-none cursor-pointer"
                >
                  <option value="">All Properties</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.propertyType})
                    </option>
                  ))}
                </select>
              </div>

              {/* Refresh Button */}
              <button
                onClick={() => fetchMaintenanceData()}
                className="p-2 rounded-lg bg-brand-white text-surface-textSecondary hover:text-brand-navy border border-surface-border transition shadow-xs"
                title="Refresh Data"
                aria-label="Refresh Data"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              {/* Create Request CTA */}
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  setFormData((prev) => ({ ...prev, propertyId: selectedPropertyId || (properties[0]?.id ?? '') }));
                  setCreateError(null);
                  setIsCreateOpen(true);
                }}
                className="gap-2 font-semibold shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Create Request</span>
              </Button>
            </div>
          }
        />

        {/* KPI Analytics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          <StatCard
            label="Open Tickets"
            value={summary.openTickets}
            subtext="Awaiting assignment"
            icon={Clock}
            variant="blue"
          />
          <StatCard
            label="In Progress"
            value={summary.inProgressTickets}
            subtext="Being worked on"
            icon={Wrench}
            variant="amber"
          />
          <StatCard
            label="Urgent Issues"
            value={summary.urgentTickets}
            subtext="Priority attention"
            icon={AlertTriangle}
            variant="rose"
          />
          <StatCard
            label="Needs Verify"
            value={summary.awaitingVerificationTickets}
            subtext="Completed by staff"
            icon={CheckCircle2}
            variant="teal"
          />
          <StatCard
            label="Avg Resolution"
            value={`${summary.avgResolutionHours}h`}
            subtext="Average turnaround"
            icon={Calendar}
            variant="default"
          />
          <StatCard
            label="Actual Cost"
            value={`₹${parseFloat(summary.totalActualCost || '0').toLocaleString('en-IN')}`}
            subtext={`Est: ₹${parseFloat(summary.totalEstimatedCost || '0').toLocaleString('en-IN')}`}
            icon={IndianRupee}
            variant="emerald"
          />
        </div>

        {/* Filter Toolbar & Status Tabs */}
        <FilterBar
          tabs={statusTabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search tickets by title, code..."
        >
          <div className="flex items-center gap-2">
            <select
              aria-label="Filter by Priority"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-surface-subtle border border-surface-border rounded-lg px-2.5 py-1.5 text-xs text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal cursor-pointer"
            >
              <option value="ALL">All Priorities</option>
              <option value="LOW">Low Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="HIGH">High Priority</option>
              <option value="URGENT">Urgent Priority</option>
            </select>

            <select
              aria-label="Filter by Category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-surface-subtle border border-surface-border rounded-lg px-2.5 py-1.5 text-xs text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              <option value="PLUMBING">Plumbing</option>
              <option value="ELECTRICAL">Electrical</option>
              <option value="CLEANING">Cleaning</option>
              <option value="FURNITURE">Furniture</option>
              <option value="APPLIANCE">Appliance</option>
              <option value="INTERNET">Internet</option>
              <option value="CARPENTRY">Carpentry</option>
              <option value="PAINTING">Painting</option>
              <option value="AC_SERVICE">AC Service</option>
              <option value="WATER">Water</option>
              <option value="SECURITY">Security</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </FilterBar>

        {/* View Mode Content */}
        {loading ? (
          <div className="bg-brand-white border border-surface-border rounded-xl p-12 text-center text-surface-textSecondary space-y-3 shadow-sm">
            <RefreshCw className="w-7 h-7 animate-spin mx-auto text-brand-teal" />
            <p className="text-xs font-medium">Loading maintenance work orders...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="bg-brand-white border border-surface-border rounded-xl overflow-hidden shadow-sm">
            <EmptyState
              icon={Wrench}
              title="No maintenance tickets found"
              description="There are no work orders matching the selected filter criteria. Create a new maintenance request or clear active filters."
              actionLabel="Create Request"
              onAction={() => {
                setFormData((prev) => ({ ...prev, propertyId: selectedPropertyId || (properties[0]?.id ?? '') }));
                setCreateError(null);
                setIsCreateOpen(true);
              }}
            />
          </div>
        ) : viewMode === 'KANBAN' ? (
          /* ================================================================ */
          /* KANBAN BOARD VIEW                                                */
          /* ================================================================ */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 overflow-x-auto pb-4">
            {KANBAN_COLUMNS.map((col) => {
              const colTickets = kanbanData[col.id] || [];
              return (
                <div
                  key={col.id}
                  className="bg-surface-subtle/80 border border-surface-border rounded-xl p-3 flex flex-col min-h-[460px] shadow-xs"
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-surface-border">
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-brand-navy">
                      <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`} />
                      <span>{col.label}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-brand-white border border-surface-border text-[11px] font-bold text-brand-navy shadow-2xs">
                      {colTickets.length}
                    </span>
                  </div>

                  {/* Column Tickets */}
                  <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[calc(100vh-320px)] pr-0.5">
                    {colTickets.length === 0 ? (
                      <div className="h-28 flex flex-col items-center justify-center text-center p-3 text-surface-textSecondary text-[11px] border border-dashed border-surface-border rounded-lg bg-brand-white/60">
                        <span>No tickets in {col.label.toLowerCase()}</span>
                      </div>
                    ) : (
                      colTickets.map((ticket) => {
                        const locationName =
                          ticket.room?.roomNumber
                            ? `Room ${ticket.room.roomNumber}${ticket.bed?.bedNumber ? ` (Bed ${ticket.bed.bedNumber})` : ''}`
                            : ticket.rentalUnit?.unitNumber
                            ? `Unit ${ticket.rentalUnit.unitNumber}`
                            : ticket.floor?.name || ticket.locationDetails || 'Common Area';

                        return (
                          <div
                            key={ticket.id}
                            className="bg-brand-white border border-surface-border rounded-xl p-3 shadow-xs hover:shadow-md hover:border-brand-teal/50 transition-all space-y-2"
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="font-mono text-[11px] font-bold text-brand-teal">
                                {ticket.ticketNumber}
                              </span>
                              <StatusBadge status={ticket.priority} />
                            </div>

                            <div>
                              <h4 className="text-xs font-semibold text-brand-navy line-clamp-2 leading-snug">
                                {ticket.title}
                              </h4>
                              <div className="flex items-center gap-1.5 mt-1 text-[10px] text-surface-textSecondary">
                                <span className="px-1.5 py-0.2 rounded bg-slate-100 uppercase font-semibold text-slate-700 border border-slate-200">
                                  {ticket.category}
                                </span>
                                <span>•</span>
                                <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>

                            <div className="text-[11px] text-surface-textSecondary space-y-0.5 pt-1.5 border-t border-surface-border/60">
                              <div className="font-medium text-brand-navy truncate">{ticket.property?.name}</div>
                              <div className="truncate text-[10px] text-surface-textSecondary">{locationName}</div>
                            </div>

                            <div className="flex items-center justify-between pt-1 text-[11px]">
                              <div className="flex items-center gap-1 text-brand-navy truncate max-w-[120px]">
                                {ticket.assignedTo ? (
                                  <>
                                    <User className="w-3 h-3 text-surface-textSecondary shrink-0" />
                                    <span className="truncate text-[10px]">
                                      {ticket.assignedTo.firstName} {ticket.assignedTo.lastName}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-[10px] text-surface-disabled italic">Unassigned</span>
                                )}
                              </div>

                              <Link
                                href={`/maintenance/${ticket.id}`}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-teal hover:text-teal-800 bg-teal-50 hover:bg-teal-100/80 px-2 py-0.5 rounded-md border border-teal-200 transition-colors shrink-0"
                              >
                                <span>Manage</span>
                                <ArrowRight className="w-2.5 h-2.5" />
                              </Link>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ================================================================ */
          /* LIST / TABLE VIEW                                                */
          /* ================================================================ */
          <div className="bg-brand-white border border-surface-border rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-brand-navy">
                <thead className="bg-surface-subtle text-[11px] uppercase text-surface-textSecondary font-semibold border-b border-surface-border">
                  <tr>
                    <th className="px-5 py-3">Ticket #</th>
                    <th className="px-5 py-3">Issue Details</th>
                    <th className="px-5 py-3">Location / Target</th>
                    <th className="px-5 py-3">Priority</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Assigned Staff</th>
                    <th className="px-5 py-3">Cost (₹)</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {(Array.isArray(tickets) ? tickets : []).map((ticket) => {
                    const locationName =
                      ticket.room?.roomNumber
                        ? `Room ${ticket.room.roomNumber}${ticket.bed?.bedNumber ? ` (Bed ${ticket.bed.bedNumber})` : ''}`
                        : ticket.rentalUnit?.unitNumber
                        ? `Unit ${ticket.rentalUnit.unitNumber}`
                        : ticket.floor?.name || ticket.locationDetails || 'Common Area';

                    return (
                      <tr key={ticket.id} className="hover:bg-surface-subtle/70 transition-colors">
                        <td className="px-5 py-3.5 font-mono font-bold text-brand-teal">
                          {ticket.ticketNumber}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-brand-navy text-xs">{ticket.title}</div>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-surface-textSecondary">
                            <span className="px-1.5 py-0.2 rounded bg-slate-100 text-[10px] uppercase font-semibold text-slate-700 border border-slate-200">
                              {ticket.category}
                            </span>
                            <span>•</span>
                            <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-xs">
                          <div className="font-medium text-brand-navy">{ticket.property?.name}</div>
                          <div className="text-surface-textSecondary text-[11px] mt-0.5">{locationName}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={ticket.priority} />
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={ticket.status} />
                        </td>
                        <td className="px-5 py-3.5 text-xs">
                          {ticket.assignedTo ? (
                            <div className="flex items-center gap-1.5 text-brand-navy">
                              <User className="w-3.5 h-3.5 text-surface-textSecondary" />
                              <span>{ticket.assignedTo.firstName} {ticket.assignedTo.lastName}</span>
                            </div>
                          ) : (
                            <span className="text-surface-disabled italic">Unassigned</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-xs font-mono">
                          {ticket.actualCost ? (
                            <span className="text-emerald-700 font-semibold">₹{ticket.actualCost}</span>
                          ) : ticket.estimatedCost ? (
                            <span className="text-surface-textSecondary">Est: ₹{ticket.estimatedCost}</span>
                          ) : (
                            <span className="text-surface-disabled">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Link
                            href={`/maintenance/${ticket.id}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-teal hover:text-teal-800 bg-teal-50 hover:bg-teal-100/80 px-2.5 py-1 rounded-lg border border-teal-200 transition-colors"
                          >
                            <span>Manage</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create Maintenance Request Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Maintenance Request"
        subtitle="Log a new issue ticket, assign targets, and record priority"
        maxWidth="xl"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateTicket}
              isLoading={isSubmitting}
            >
              Submit Request
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateTicket} className="space-y-4 text-xs">
          {createError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {createError}
            </div>
          )}

          {/* Property Selector */}
          <div>
            <label className="block text-brand-navy font-semibold mb-1">Property *</label>
            <select
              required
              value={formData.propertyId}
              onChange={(e) => setFormData({ ...formData, propertyId: e.target.value })}
              className="w-full bg-surface-subtle border border-surface-border rounded-lg px-3 py-2 text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
            >
              <option value="">Select Property</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.propertyType})
                </option>
              ))}
            </select>
          </div>

          {/* Target Selector */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-brand-navy font-semibold mb-1">Target Type</label>
              <select
                value={formData.targetType}
                onChange={(e) => setFormData({ ...formData, targetType: e.target.value })}
                className="w-full bg-surface-subtle border border-surface-border rounded-lg px-3 py-2 text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
              >
                <option value="PROPERTY">Whole Property / Common Area</option>
                {selectedModalProperty?.propertyType === 'PG' && (
                  <>
                    <option value="FLOOR">Floor</option>
                    <option value="ROOM">Room</option>
                    <option value="BED">Bed</option>
                  </>
                )}
                {selectedModalProperty?.propertyType === 'RENTAL_HOUSE' && (
                  <option value="RENTAL_UNIT">Rental Unit</option>
                )}
              </select>
            </div>

            {formData.targetType === 'ROOM' && (
              <div>
                <label className="block text-brand-navy font-semibold mb-1">Room</label>
                <select
                  value={formData.roomId}
                  onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
                  className="w-full bg-surface-subtle border border-surface-border rounded-lg px-3 py-2 text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                >
                  <option value="">Select Room</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      Room {r.roomNumber} ({r.sharingType})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {formData.targetType === 'RENTAL_UNIT' && (
              <div>
                <label className="block text-brand-navy font-semibold mb-1">Rental Unit</label>
                <select
                  value={formData.rentalUnitId}
                  onChange={(e) => setFormData({ ...formData, rentalUnitId: e.target.value })}
                  className="w-full bg-surface-subtle border border-surface-border rounded-lg px-3 py-2 text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                >
                  <option value="">Select Unit</option>
                  {rentalUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      Unit {u.unitNumber} ({u.unitType})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Category & Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-brand-navy font-semibold mb-1">Category *</label>
              <select
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full bg-surface-subtle border border-surface-border rounded-lg px-3 py-2 text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
              >
                <option value="PLUMBING">Plumbing</option>
                <option value="ELECTRICAL">Electrical</option>
                <option value="CLEANING">Cleaning</option>
                <option value="FURNITURE">Furniture</option>
                <option value="APPLIANCE">Appliance</option>
                <option value="INTERNET">Internet</option>
                <option value="CARPENTRY">Carpentry</option>
                <option value="PAINTING">Painting</option>
                <option value="AC_SERVICE">AC Service</option>
                <option value="WATER">Water</option>
                <option value="SECURITY">Security</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-brand-navy font-semibold mb-1">Priority *</label>
              <select
                required
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full bg-surface-subtle border border-surface-border rounded-lg px-3 py-2 text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent (Emergency)</option>
              </select>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-brand-navy font-semibold mb-1">Issue Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Geyser not heating water"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-surface-subtle border border-surface-border rounded-lg px-3 py-2 text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-brand-navy font-semibold mb-1">Detailed Description *</label>
            <textarea
              required
              rows={3}
              placeholder="Describe the issue, location, and symptoms..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-surface-subtle border border-surface-border rounded-lg px-3 py-2 text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
            />
          </div>

          {/* Location & Estimated Cost */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-brand-navy font-semibold mb-1">Location Details</label>
              <input
                type="text"
                placeholder="e.g. Bathroom 2, 3rd floor corridor"
                value={formData.locationDetails}
                onChange={(e) => setFormData({ ...formData, locationDetails: e.target.value })}
                className="w-full bg-surface-subtle border border-surface-border rounded-lg px-3 py-2 text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
              />
            </div>

            <div>
              <label className="block text-brand-navy font-semibold mb-1">Estimated Cost (₹)</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 1200.00"
                value={formData.estimatedCost}
                onChange={(e) => setFormData({ ...formData, estimatedCost: e.target.value })}
                className="w-full bg-surface-subtle border border-surface-border rounded-lg px-3 py-2 text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
              />
            </div>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
