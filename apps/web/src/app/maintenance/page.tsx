'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/Sidebar';
import { PropertyType } from '@propertyos/types';
import {
  Wrench,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Filter,
  Plus,
  Search,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  User,
  IndianRupee,
  RefreshCw,
  XCircle,
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
        setTickets(json.data || []);
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
      alert('Please fill out all required fields.');
      return;
    }

    setIsSubmitting(true);
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
      alert(e.message || 'An error occurred while creating the ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentProperty = properties.find((p) => p.id === selectedPropertyId);
  const currentPropertyType = currentProperty?.propertyType === 'RENTAL_HOUSE' ? PropertyType.RENTAL_HOUSE : PropertyType.PG;

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans antialiased overflow-hidden">
      {/* Sidebar */}
      <Sidebar currentPropertyType={currentPropertyType} activePath="/maintenance" />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-900/50">
        {/* Top Navbar */}
        <header className="h-16 px-8 border-b border-slate-800 bg-slate-900/80 backdrop-blur flex items-center justify-between shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-white tracking-tight">Maintenance & Work Orders</h1>
              <p className="text-xs text-slate-400">Manage issue tickets, staff assignments, and work completion</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Property Selector */}
            <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
              <Building2 className="w-4 h-4 text-teal-400" />
              <select
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                className="bg-transparent text-sm font-medium text-slate-200 outline-none cursor-pointer"
              >
                <option value="" className="bg-slate-800">All Properties</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id} className="bg-slate-800">
                    {p.name} ({p.propertyType})
                  </option>
                ))}
              </select>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => fetchMaintenanceData()}
              className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition border border-slate-700"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Create Ticket Button */}
            <button
              onClick={() => {
                setFormData((prev) => ({ ...prev, propertyId: selectedPropertyId || (properties[0]?.id ?? '') }));
                setIsCreateOpen(true);
              }}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-lg shadow-teal-900/30 transition border border-teal-500/30"
            >
              <Plus className="w-4 h-4" />
              <span>Create Request</span>
            </button>
          </div>
        </header>

        <div className="p-8 space-y-6 max-w-7xl mx-auto w-full">
          {/* KPI Analytics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Open Tickets</span>
                <Clock className="w-4 h-4 text-blue-400" />
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold text-white">{summary.openTickets}</span>
                <p className="text-[11px] text-slate-400 mt-0.5">Awaiting assignment</p>
              </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">In Progress</span>
                <Wrench className="w-4 h-4 text-amber-400" />
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold text-white">{summary.inProgressTickets}</span>
                <p className="text-[11px] text-slate-400 mt-0.5">Being worked on</p>
              </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Urgent Issues</span>
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold text-rose-400">{summary.urgentTickets}</span>
                <p className="text-[11px] text-slate-400 mt-0.5">Priority attention</p>
              </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Needs Verify</span>
                <CheckCircle2 className="w-4 h-4 text-purple-400" />
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold text-white">{summary.awaitingVerificationTickets}</span>
                <p className="text-[11px] text-slate-400 mt-0.5">Completed by staff</p>
              </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Avg Resolution</span>
                <Calendar className="w-4 h-4 text-teal-400" />
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold text-white">{summary.avgResolutionHours}h</span>
                <p className="text-[11px] text-slate-400 mt-0.5">Average turnaround</p>
              </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Actual Cost</span>
                <IndianRupee className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold text-emerald-400">₹{parseFloat(summary.totalActualCost || '0').toLocaleString('en-IN')}</span>
                <p className="text-[11px] text-slate-400 mt-0.5">Est: ₹{parseFloat(summary.totalEstimatedCost || '0').toLocaleString('en-IN')}</p>
              </div>
            </div>
          </div>

          {/* Filter Toolbar & Status Tabs */}
          <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Status Tabs */}
            <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-800 overflow-x-auto max-w-full">
              {[
                { id: 'ALL', label: 'All' },
                { id: 'OPEN', label: 'Open' },
                { id: 'ASSIGNED', label: 'Assigned' },
                { id: 'IN_PROGRESS', label: 'In Progress' },
                { id: 'COMPLETED', label: 'Completed' },
                { id: 'VERIFIED', label: 'Verified' },
                { id: 'CLOSED', label: 'Closed' },
                { id: 'CANCELLED', label: 'Cancelled' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Dropdown Filters & Search */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-60">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search tickets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500 cursor-pointer"
              >
                <option value="ALL">All Priorities</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500 cursor-pointer"
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
          </div>

          {/* Tickets Data Table */}
          <div className="bg-slate-800/40 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            {loading ? (
              <div className="p-12 text-center text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-teal-400 mb-3" />
                <p className="text-sm">Loading maintenance work orders...</p>
              </div>
            ) : tickets.length === 0 ? (
              <div className="p-16 text-center text-slate-400">
                <Wrench className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-slate-200">No maintenance tickets found</h3>
                <p className="text-xs text-slate-500 mt-1">There are no work orders matching the selected filter criteria.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-900/80 text-xs uppercase text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-3.5">Ticket #</th>
                      <th className="px-6 py-3.5">Issue Details</th>
                      <th className="px-6 py-3.5">Location / Target</th>
                      <th className="px-6 py-3.5">Priority</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5">Assigned Staff</th>
                      <th className="px-6 py-3.5">Cost (₹)</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {tickets.map((ticket) => {
                      const priorityColor =
                        ticket.priority === 'URGENT'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          : ticket.priority === 'HIGH'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : ticket.priority === 'MEDIUM'
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                          : 'bg-slate-500/10 text-slate-400 border-slate-500/30';

                      const statusColor =
                        ticket.status === 'CLOSED' || ticket.status === 'VERIFIED'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : ticket.status === 'COMPLETED'
                          ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                          : ticket.status === 'IN_PROGRESS'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : ticket.status === 'ASSIGNED'
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                          : ticket.status === 'CANCELLED'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          : 'bg-slate-500/10 text-slate-300 border-slate-500/30';

                      const locationName =
                        ticket.room?.roomNumber
                          ? `Room ${ticket.room.roomNumber}${ticket.bed?.bedNumber ? ` (Bed ${ticket.bed.bedNumber})` : ''}`
                          : ticket.rentalUnit?.unitNumber
                          ? `Unit ${ticket.rentalUnit.unitNumber}`
                          : ticket.floor?.name || ticket.locationDetails || 'Common Area';

                      return (
                        <tr key={ticket.id} className="hover:bg-slate-800/30 transition">
                          <td className="px-6 py-4 font-mono text-xs font-medium text-teal-400">
                            {ticket.ticketNumber}
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-white text-sm">{ticket.title}</div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] uppercase font-semibold">
                                {ticket.category}
                              </span>
                              <span>•</span>
                              <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-xs">
                            <div className="font-medium text-slate-200">{ticket.property?.name}</div>
                            <div className="text-slate-400 text-[11px] mt-0.5">{locationName}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${priorityColor}`}>
                              {ticket.priority}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${statusColor}`}>
                              {ticket.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs">
                            {ticket.assignedTo ? (
                              <div className="flex items-center gap-1.5 text-slate-200">
                                <User className="w-3.5 h-3.5 text-slate-400" />
                                <span>{ticket.assignedTo.firstName} {ticket.assignedTo.lastName}</span>
                              </div>
                            ) : (
                              <span className="text-slate-500 italic">Unassigned</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-xs font-mono">
                            {ticket.actualCost ? (
                              <span className="text-emerald-400 font-semibold">₹{ticket.actualCost}</span>
                            ) : ticket.estimatedCost ? (
                              <span className="text-slate-400">Est: ₹{ticket.estimatedCost}</span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Link
                              href={`/maintenance/${ticket.id}`}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-teal-400 hover:text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 px-3 py-1.5 rounded-lg border border-teal-500/20 transition"
                            >
                              <span>Manage</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
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
      </main>

      {/* Create Maintenance Request Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-lg">
                <Wrench className="w-5 h-5 text-teal-400" />
                <span>Create Maintenance Request</span>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4 text-xs">
              {/* Property Selector */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Property *</label>
                <select
                  required
                  value={formData.propertyId}
                  onChange={(e) => setFormData({ ...formData, propertyId: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-teal-500"
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
                  <label className="block text-slate-300 font-semibold mb-1">Target Type</label>
                  <select
                    value={formData.targetType}
                    onChange={(e) => setFormData({ ...formData, targetType: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-teal-500"
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
                    <label className="block text-slate-300 font-semibold mb-1">Room</label>
                    <select
                      value={formData.roomId}
                      onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-teal-500"
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
                    <label className="block text-slate-300 font-semibold mb-1">Rental Unit</label>
                    <select
                      value={formData.rentalUnitId}
                      onChange={(e) => setFormData({ ...formData, rentalUnitId: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-teal-500"
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
                  <label className="block text-slate-300 font-semibold mb-1">Category *</label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-teal-500"
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
                  <label className="block text-slate-300 font-semibold mb-1">Priority *</label>
                  <select
                    required
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-teal-500"
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
                <label className="block text-slate-300 font-semibold mb-1">Issue Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Geyser not heating water"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Detailed Description *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe the issue, location, and symptoms..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Location & Estimated Cost */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Location Details</label>
                  <input
                    type="text"
                    placeholder="e.g. Bathroom 2, 3rd floor corridor"
                    value={formData.locationDetails}
                    onChange={(e) => setFormData({ ...formData, locationDetails: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Estimated Cost (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 1200.00"
                    value={formData.estimatedCost}
                    onChange={(e) => setFormData({ ...formData, estimatedCost: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-teal-600 hover:bg-teal-500 text-white font-semibold px-5 py-2 rounded-lg transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
