'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { StatCard } from '@/components/ui/StatCard';
import { useAuth } from '@/lib/auth-context';
import {
  ServiceRequestDto,
  ServiceRequestSummaryDto,
  ServiceRequestCategory,
  ServiceRequestPriority,
  ServiceRequestStatus,
  ServiceRequestSlot,
  UserRole,
} from '@propertyos/types';
import {
  Sparkles,
  Plus,
  Search,
  Wrench,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Phone,
  Calendar,
  IndianRupee,
  MapPin,
  User,
  ShieldAlert,
  Trash2,
  Edit3,
  UserCheck,
  Building,
  Filter,
  Check,
  X,
  ChevronRight,
  Info,
} from 'lucide-react';

const CATEGORY_LABELS: Record<ServiceRequestCategory, { label: string; icon: any; color: string }> = {
  [ServiceRequestCategory.PLUMBING]: { label: 'Plumbing', icon: Wrench, color: 'bg-blue-50 text-blue-700 border-blue-200' },
  [ServiceRequestCategory.ELECTRICAL]: { label: 'Electrical', icon: Sparkles, color: 'bg-amber-50 text-amber-700 border-amber-200' },
  [ServiceRequestCategory.HOUSEKEEPING]: { label: 'Housekeeping', icon: Sparkles, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  [ServiceRequestCategory.CARPENTRY]: { label: 'Carpentry', icon: Wrench, color: 'bg-orange-50 text-orange-700 border-orange-200' },
  [ServiceRequestCategory.APPLIANCE_REPAIR]: { label: 'Appliance / AC', icon: Wrench, color: 'bg-purple-50 text-purple-700 border-purple-200' },
  [ServiceRequestCategory.PEST_CONTROL]: { label: 'Pest Control', icon: ShieldAlert, color: 'bg-rose-50 text-rose-700 border-rose-200' },
  [ServiceRequestCategory.PAINTING]: { label: 'Painting', icon: Sparkles, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  [ServiceRequestCategory.LAUNDRY]: { label: 'Laundry', icon: Sparkles, color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  [ServiceRequestCategory.PACKING_MOVING]: { label: 'Packing & Moving', icon: Building, color: 'bg-teal-50 text-teal-700 border-teal-200' },
  [ServiceRequestCategory.OTHER]: { label: 'Other', icon: Info, color: 'bg-slate-50 text-slate-700 border-slate-200' },
};

const PRIORITY_BADGES: Record<ServiceRequestPriority, { label: string; color: string }> = {
  [ServiceRequestPriority.URGENT]: { label: 'Urgent', color: 'bg-red-100 text-red-800 border-red-200 font-bold animate-pulse' },
  [ServiceRequestPriority.HIGH]: { label: 'High', color: 'bg-amber-100 text-amber-800 border-amber-200 font-semibold' },
  [ServiceRequestPriority.MEDIUM]: { label: 'Medium', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  [ServiceRequestPriority.LOW]: { label: 'Low', color: 'bg-slate-100 text-slate-700 border-slate-200' },
};

const STATUS_BADGES: Record<ServiceRequestStatus, { label: string; color: string }> = {
  [ServiceRequestStatus.PENDING]: { label: 'Pending Triage', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  [ServiceRequestStatus.SCHEDULED]: { label: 'Scheduled', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  [ServiceRequestStatus.IN_PROGRESS]: { label: 'In Progress', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  [ServiceRequestStatus.COMPLETED]: { label: 'Completed', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  [ServiceRequestStatus.CANCELLED]: { label: 'Cancelled', color: 'bg-slate-100 text-slate-500 border-slate-200' },
};

export default function ServicesPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ServiceRequestDto[]>([]);
  const [summary, setSummary] = useState<ServiceRequestSummaryDto | null>(null);
  const [properties, setProperties] = useState<any[]>([]);
  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & State
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequestDto | null>(null);
  const [detailDrawerRequest, setDetailDrawerRequest] = useState<ServiceRequestDto | null>(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    propertyId: '',
    serviceCategory: ServiceRequestCategory.PLUMBING,
    priority: ServiceRequestPriority.MEDIUM,
    title: '',
    description: '',
    contactPhone: '',
    locationDetails: '',
    preferredSlot: ServiceRequestSlot.ANYTIME,
    preferredDate: '',
    estimatedCost: '',
    isPaidByTenant: false,
  });

  const [assignForm, setAssignForm] = useState({
    assignedStaffId: '',
    assignedVendorName: '',
    assignedVendorPhone: '',
    scheduledDate: '',
    notes: '',
  });

  const [completeForm, setCompleteForm] = useState({
    actualCost: '',
    resolutionNotes: '',
    isPaidByTenant: false,
  });

  const [cancelReason, setCancelReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isManager = useMemo(() => {
    if (!user) return false;
    return (
      user.roles.includes(UserRole.OWNER) ||
      user.roles.includes(UserRole.PROPERTY_MANAGER) ||
      user.roles.includes(UserRole.WARDEN)
    );
  }, [user]);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [reqRes, sumRes, propRes, staffRes] = await Promise.all([
        fetch('/api/v1/services/requests?limit=50', { credentials: 'include' }),
        fetch('/api/v1/services/summary', { credentials: 'include' }),
        fetch('/api/v1/properties', { credentials: 'include' }),
        fetch('/api/v1/staff', { credentials: 'include' }),
      ]);

      if (reqRes.ok) {
        const json = await reqRes.json();
        setRequests(json.data || []);
      }
      if (sumRes.ok) {
        const sumJson = await sumRes.json();
        setSummary(sumJson);
      }
      if (propRes.ok) {
        const propJson = await propRes.json();
        setProperties(propJson.data || propJson || []);
        if (propJson.data?.length > 0 && !createForm.propertyId) {
          setCreateForm((prev) => ({ ...prev, propertyId: propJson.data[0].id }));
        }
      }
      if (staffRes.ok) {
        const staffJson = await staffRes.json();
        setStaffMembers(staffJson.data || staffJson || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load service desk data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (selectedPropertyId && r.propertyId !== selectedPropertyId) return false;
      if (selectedCategory !== 'ALL' && r.serviceCategory !== selectedCategory) return false;
      if (selectedStatus !== 'ALL' && r.status !== selectedStatus) return false;
      if (selectedPriority !== 'ALL' && r.priority !== selectedPriority) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = r.title.toLowerCase().includes(q);
        const matchesDesc = r.description.toLowerCase().includes(q);
        const matchesLoc = r.locationDetails?.toLowerCase().includes(q);
        const matchesName = r.requesterName.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesLoc && !matchesName) return false;
      }
      return true;
    });
  }, [requests, selectedPropertyId, selectedCategory, selectedStatus, selectedPriority, searchQuery]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload: any = {
        propertyId: createForm.propertyId,
        serviceCategory: createForm.serviceCategory,
        priority: createForm.priority,
        title: createForm.title.trim(),
        description: createForm.description.trim(),
        preferredSlot: createForm.preferredSlot,
        isPaidByTenant: createForm.isPaidByTenant,
      };
      if (createForm.contactPhone.trim()) payload.contactPhone = createForm.contactPhone.trim();
      if (createForm.locationDetails.trim()) payload.locationDetails = createForm.locationDetails.trim();
      if (createForm.preferredDate) payload.preferredDate = new Date(createForm.preferredDate).toISOString();
      if (createForm.estimatedCost) payload.estimatedCost = parseFloat(createForm.estimatedCost);

      const res = await fetch('/api/v1/services/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to submit service request.');
      }

      setIsCreateModalOpen(false);
      setCreateForm({
        propertyId: properties[0]?.id || '',
        serviceCategory: ServiceRequestCategory.PLUMBING,
        priority: ServiceRequestPriority.MEDIUM,
        title: '',
        description: '',
        contactPhone: '',
        locationDetails: '',
        preferredSlot: ServiceRequestSlot.ANYTIME,
        preferredDate: '',
        estimatedCost: '',
        isPaidByTenant: false,
      });
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;
    setIsSubmitting(true);
    try {
      const payload: any = {};
      if (assignForm.assignedStaffId) payload.assignedStaffId = assignForm.assignedStaffId;
      if (assignForm.assignedVendorName) payload.assignedVendorName = assignForm.assignedVendorName.trim();
      if (assignForm.assignedVendorPhone) payload.assignedVendorPhone = assignForm.assignedVendorPhone.trim();
      if (assignForm.scheduledDate) payload.scheduledDate = new Date(assignForm.scheduledDate).toISOString();
      if (assignForm.notes) payload.notes = assignForm.notes.trim();

      const res = await fetch(`/api/v1/services/requests/${selectedRequest.id}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to assign request.');
      }

      setIsAssignModalOpen(false);
      setSelectedRequest(null);
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;
    setIsSubmitting(true);
    try {
      const payload: any = {
        status: ServiceRequestStatus.COMPLETED,
        resolutionNotes: completeForm.resolutionNotes.trim(),
        isPaidByTenant: completeForm.isPaidByTenant,
      };
      if (completeForm.actualCost) payload.actualCost = parseFloat(completeForm.actualCost);

      const res = await fetch(`/api/v1/services/requests/${selectedRequest.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to complete request.');
      }

      setIsCompleteModalOpen(false);
      setSelectedRequest(null);
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/services/requests/${selectedRequest.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status: ServiceRequestStatus.CANCELLED,
          cancellationReason: cancelReason.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to cancel request.');
      }

      setIsCancelModalOpen(false);
      setSelectedRequest(null);
      setCancelReason('');
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartService = async (req: ServiceRequestDto) => {
    try {
      const res = await fetch(`/api/v1/services/requests/${req.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: ServiceRequestStatus.IN_PROGRESS }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to start service.');
      }
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (req: ServiceRequestDto) => {
    if (!confirm(`Are you sure you want to delete service request "${req.title}"?`)) return;
    try {
      const res = await fetch(`/api/v1/services/requests/${req.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to delete service request.');
      }
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <AppShell activePath="/services">
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Sparkles className="w-6 h-6 text-brand-teal" />
              Local Service Desk
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              On-demand facility tasks, resident maintenance requests, and vendor dispatching.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-teal text-white rounded-lg font-medium text-sm hover:bg-teal-700 transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              New Service Request
            </button>
          </div>
        </div>

        {/* KPI StatCards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            label="Total Requests"
            value={summary?.totalRequests || 0}
            icon={Sparkles}
            subtext="All facility tasks"
            variant="default"
          />
          <StatCard
            label="Pending Triage"
            value={summary?.pendingRequests || 0}
            icon={Clock}
            subtext="Awaiting assignment"
            variant="amber"
          />
          <StatCard
            label="Active / Scheduled"
            value={(summary?.scheduledRequests || 0) + (summary?.inProgressRequests || 0)}
            icon={Wrench}
            subtext="In queue or execution"
            variant="blue"
          />
          <StatCard
            label="Completed"
            value={summary?.completedRequests || 0}
            icon={CheckCircle2}
            subtext="Fulfillments"
            variant="emerald"
          />
          <StatCard
            label="Actual Cost (₹)"
            value={`₹${summary?.totalActualCost || '0.00'}`}
            icon={IndianRupee}
            subtext="Fulfilled service expenses"
            variant="teal"
          />
        </div>

        {/* Category Pills Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition border ${
              selectedCategory === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            All Categories
          </button>
          {Object.entries(CATEGORY_LABELS).map(([cat, info]) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition border ${
                  isSelected
                    ? 'bg-brand-teal text-white border-brand-teal shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {info.label}
              </button>
            );
          })}
        </div>

        {/* Controls & Filter Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by title, location, resident..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
              />
            </div>

            {/* Dropdowns */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
              {properties.length > 1 && (
                <select
                  value={selectedPropertyId}
                  onChange={(e) => setSelectedPropertyId(e.target.value)}
                  className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                >
                  <option value="">All Properties</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}

              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-teal"
              >
                <option value="ALL">All Priorities</option>
                <option value="URGENT">Urgent</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-teal"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending Triage</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        {/* Requests List / Cards Grid */}
        {isLoading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <div className="w-8 h-8 border-4 border-brand-teal border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-500 font-medium">Loading service desk requests...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Sparkles className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No service requests found</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-4">
              {searchQuery || selectedCategory !== 'ALL' || selectedStatus !== 'ALL'
                ? 'Try adjusting your filters or search terms.'
                : 'No service requests submitted yet. Click below to create one.'}
            </p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-teal text-white rounded-lg font-medium text-sm hover:bg-teal-700 transition"
            >
              <Plus className="w-4 h-4" />
              New Service Request
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredRequests.map((req) => {
              const catInfo = CATEGORY_LABELS[req.serviceCategory] || CATEGORY_LABELS[ServiceRequestCategory.OTHER];
              const CatIcon = catInfo.icon;
              const priorityInfo = PRIORITY_BADGES[req.priority] || PRIORITY_BADGES[ServiceRequestPriority.MEDIUM];
              const statusInfo = STATUS_BADGES[req.status] || STATUS_BADGES[ServiceRequestStatus.PENDING];

              return (
                <div
                  key={req.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between overflow-hidden"
                >
                  {/* Card Header */}
                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${catInfo.color}`}>
                        <CatIcon className="w-3.5 h-3.5" />
                        {catInfo.label}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded text-[11px] border ${priorityInfo.color}`}>
                          {priorityInfo.label}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[11px] border font-medium ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                    </div>

                    {/* Title & Desc */}
                    <div>
                      <h4
                        onClick={() => setDetailDrawerRequest(req)}
                        className="text-base font-bold text-slate-900 hover:text-brand-teal cursor-pointer transition line-clamp-1"
                      >
                        {req.title}
                      </h4>
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                        {req.description}
                      </p>
                    </div>

                    {/* Location & Property Badge */}
                    <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-semibold text-slate-800">{req.property?.name || 'Property'}</span>
                      {req.room && <span className="text-slate-500">• Room {req.room.roomNumber}</span>}
                      {req.rentalUnit && <span className="text-slate-500">• Unit {req.rentalUnit.unitNumber}</span>}
                      {req.locationDetails && <span className="text-slate-500 truncate">• {req.locationDetails}</span>}
                    </div>

                    {/* Requester Contact */}
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-medium">{req.requesterName}</span>
                        <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-500 rounded font-semibold">
                          {req.requesterRole}
                        </span>
                      </div>
                      {req.contactPhone && (
                        <a
                          href={`tel:${req.contactPhone}`}
                          className="text-brand-teal hover:underline flex items-center gap-1 font-medium"
                        >
                          <Phone className="w-3 h-3" />
                          {req.contactPhone}
                        </a>
                      )}
                    </div>

                    {/* Scheduling & Staff */}
                    <div className="space-y-1 text-xs text-slate-600">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Slot:</span>
                        <span className="font-medium text-slate-700">{req.preferredSlot}</span>
                      </div>
                      {req.scheduledDate && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Scheduled:</span>
                          <span className="font-semibold text-blue-700">
                            {new Date(req.scheduledDate).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      )}
                      {req.assignedStaff && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Technician:</span>
                          <span className="font-semibold text-slate-800 flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5 text-brand-teal" />
                            {req.assignedStaff.name} ({req.assignedStaff.roleTitle})
                          </span>
                        </div>
                      )}
                      {req.assignedVendorName && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Vendor:</span>
                          <span className="font-semibold text-slate-800">
                            {req.assignedVendorName}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Financials / Cost Tag */}
                    {(req.estimatedCost || req.actualCost) && (
                      <div className="flex items-center justify-between text-xs bg-teal-50/60 border border-teal-100/80 p-2 rounded-lg">
                        <span className="text-teal-900 font-medium">
                          {req.actualCost ? `Actual: ₹${req.actualCost}` : `Est: ₹${req.estimatedCost}`}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                          req.isPaidByTenant ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {req.isPaidByTenant ? 'Billed to Tenant' : 'Property Expense'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Actions Footer */}
                  <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setDetailDrawerRequest(req)}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
                    >
                      View Timeline
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center gap-1.5">
                      {isManager && req.status === ServiceRequestStatus.PENDING && (
                        <button
                          onClick={() => {
                            setSelectedRequest(req);
                            setIsAssignModalOpen(true);
                          }}
                          className="px-2.5 py-1 bg-brand-teal text-white rounded text-xs font-medium hover:bg-teal-700 transition"
                        >
                          Assign
                        </button>
                      )}

                      {isManager && req.status === ServiceRequestStatus.SCHEDULED && (
                        <button
                          onClick={() => handleStartService(req)}
                          className="px-2.5 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition"
                        >
                          Start Task
                        </button>
                      )}

                      {isManager && req.status === ServiceRequestStatus.IN_PROGRESS && (
                        <button
                          onClick={() => {
                            setSelectedRequest(req);
                            setCompleteForm({
                              actualCost: req.estimatedCost || '',
                              resolutionNotes: '',
                              isPaidByTenant: req.isPaidByTenant,
                            });
                            setIsCompleteModalOpen(true);
                          }}
                          className="px-2.5 py-1 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700 transition"
                        >
                          Complete
                        </button>
                      )}

                      {(req.status === ServiceRequestStatus.PENDING || req.status === ServiceRequestStatus.SCHEDULED) && (
                        <button
                          onClick={() => {
                            setSelectedRequest(req);
                            setIsCancelModalOpen(true);
                          }}
                          className="px-2 py-1 text-slate-500 hover:text-red-600 rounded text-xs font-medium transition"
                          title="Cancel request"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {isManager && (
                        <button
                          onClick={() => handleDelete(req)}
                          className="px-2 py-1 text-slate-400 hover:text-red-600 rounded text-xs font-medium transition"
                          title="Delete request"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal: Create Service Request */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 space-y-4 my-8">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-brand-teal" />
                  New Service Request
                </h3>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                {/* Property Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Property <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={createForm.propertyId}
                    onChange={(e) => setCreateForm({ ...createForm, propertyId: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-teal focus:outline-none"
                  >
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.propertyType === 'PG' ? 'PG / Hostel' : 'Rental House'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Service Category & Priority */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                    <select
                      value={createForm.serviceCategory}
                      onChange={(e) => setCreateForm({ ...createForm, serviceCategory: e.target.value as ServiceRequestCategory })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-teal focus:outline-none"
                    >
                      {Object.entries(CATEGORY_LABELS).map(([cat, info]) => (
                        <option key={cat} value={cat}>
                          {info.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Priority</label>
                    <select
                      value={createForm.priority}
                      onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value as ServiceRequestPriority })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-teal focus:outline-none"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Title / Issue Summary <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Washbasin tap leakage, AC servicing"
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-teal focus:outline-none"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Detailed Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Describe the issue and requirements clearly..."
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-teal focus:outline-none"
                  />
                </div>

                {/* Location Details & Contact Phone */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Room / Location Details</label>
                    <input
                      type="text"
                      placeholder="e.g. Room 204 or Common Kitchen"
                      value={createForm.locationDetails}
                      onChange={(e) => setCreateForm({ ...createForm, locationDetails: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-teal focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Contact Phone</label>
                    <input
                      type="tel"
                      placeholder="e.g. 9876543210"
                      value={createForm.contactPhone}
                      onChange={(e) => setCreateForm({ ...createForm, contactPhone: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-teal focus:outline-none"
                    />
                  </div>
                </div>

                {/* Preferred Slot & Date */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Preferred Slot</label>
                    <select
                      value={createForm.preferredSlot}
                      onChange={(e) => setCreateForm({ ...createForm, preferredSlot: e.target.value as ServiceRequestSlot })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-teal focus:outline-none"
                    >
                      <option value="ANYTIME">Anytime</option>
                      <option value="MORNING">Morning (09:00 - 12:00)</option>
                      <option value="AFTERNOON">Afternoon (12:00 - 15:00)</option>
                      <option value="EVENING">Evening (15:00 - 19:00)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Preferred Date</label>
                    <input
                      type="date"
                      value={createForm.preferredDate}
                      onChange={(e) => setCreateForm({ ...createForm, preferredDate: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-teal focus:outline-none"
                    />
                  </div>
                </div>

                {/* Estimated Cost & Billing Checkbox */}
                <div className="grid grid-cols-2 gap-3 items-center pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Est. Budget / Cost (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g. 500"
                      value={createForm.estimatedCost}
                      onChange={(e) => setCreateForm({ ...createForm, estimatedCost: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-teal focus:outline-none"
                    />
                  </div>
                  <div className="pt-5">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={createForm.isPaidByTenant}
                        onChange={(e) => setCreateForm({ ...createForm, isPaidByTenant: e.target.checked })}
                        className="rounded text-brand-teal focus:ring-brand-teal w-4 h-4"
                      />
                      Charge to resident
                    </label>
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-brand-teal text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition disabled:opacity-50"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Assign Staff / Vendor */}
        {isAssignModalOpen && selectedRequest && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-brand-teal" />
                  Assign Service Request
                </h3>
                <button
                  onClick={() => {
                    setIsAssignModalOpen(false);
                    setSelectedRequest(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAssignSubmit} className="space-y-4">
                <p className="text-xs text-slate-500 font-medium">
                  Assign internal staff technician or external service vendor to <span className="font-bold text-slate-800">"{selectedRequest.title}"</span>.
                </p>

                {/* Staff Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Internal Staff Technician</label>
                  <select
                    value={assignForm.assignedStaffId}
                    onChange={(e) => setAssignForm({ ...assignForm, assignedStaffId: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-teal focus:outline-none"
                  >
                    <option value="">None / External Vendor</option>
                    {staffMembers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.roleTitle})
                      </option>
                    ))}
                  </select>
                </div>

                {/* External Vendor Details */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Vendor Name</label>
                    <input
                      type="text"
                      placeholder="e.g. QuickFix Plumbing"
                      value={assignForm.assignedVendorName}
                      onChange={(e) => setAssignForm({ ...assignForm, assignedVendorName: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-teal focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Vendor Phone</label>
                    <input
                      type="tel"
                      placeholder="e.g. 9876500000"
                      value={assignForm.assignedVendorPhone}
                      onChange={(e) => setAssignForm({ ...assignForm, assignedVendorPhone: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-teal focus:outline-none"
                    />
                  </div>
                </div>

                {/* Scheduled Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Scheduled Date & Time</label>
                  <input
                    type="datetime-local"
                    value={assignForm.scheduledDate}
                    onChange={(e) => setAssignForm({ ...assignForm, scheduledDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-teal focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAssignModalOpen(false);
                      setSelectedRequest(null);
                    }}
                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-brand-teal text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving...' : 'Confirm Assignment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Complete Service Request */}
        {isCompleteModalOpen && selectedRequest && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Complete Service Request
                </h3>
                <button
                  onClick={() => {
                    setIsCompleteModalOpen(false);
                    setSelectedRequest(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCompleteSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Actual Service Cost (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 450.00"
                    value={completeForm.actualCost}
                    onChange={(e) => setCompleteForm({ ...completeForm, actualCost: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-teal focus:outline-none"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={completeForm.isPaidByTenant}
                      onChange={(e) => setCompleteForm({ ...completeForm, isPaidByTenant: e.target.checked })}
                      className="rounded text-brand-teal focus:ring-brand-teal w-4 h-4"
                    />
                    Charge this cost to the resident
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Resolution Notes <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="e.g. Replaced rubber valve and tightened pipe connection. Tested for 15 mins."
                    value={completeForm.resolutionNotes}
                    onChange={(e) => setCompleteForm({ ...completeForm, resolutionNotes: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-teal focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCompleteModalOpen(false);
                      setSelectedRequest(null);
                    }}
                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-50"
                  >
                    {isSubmitting ? 'Completing...' : 'Mark as Completed'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Cancel Service Request */}
        {isCancelModalOpen && selectedRequest && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-600" />
                  Cancel Service Request
                </h3>
                <button
                  onClick={() => {
                    setIsCancelModalOpen(false);
                    setSelectedRequest(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCancelSubmit} className="space-y-4">
                <p className="text-xs text-slate-600 font-medium">
                  Are you sure you want to cancel <span className="font-bold text-slate-900">"{selectedRequest.title}"</span>?
                </p>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Reason for Cancellation <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="e.g. Issue resolved independently, requested by tenant"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-red-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCancelModalOpen(false);
                      setSelectedRequest(null);
                    }}
                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
                  >
                    {isSubmitting ? 'Cancelling...' : 'Confirm Cancellation'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Detail Drawer */}
        {detailDrawerRequest && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-end z-50">
            <div className="bg-white w-full max-w-lg h-full shadow-2xl p-6 overflow-y-auto space-y-6 flex flex-col justify-between">
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="space-y-1">
                    <span className="text-xs font-mono text-slate-400 uppercase">
                      ID: {detailDrawerRequest.id.slice(0, 8)}
                    </span>
                    <h3 className="text-xl font-bold text-slate-900">{detailDrawerRequest.title}</h3>
                  </div>
                  <button
                    onClick={() => setDetailDrawerRequest(null)}
                    className="text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Status & Category */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="space-y-1">
                    <span className="text-xs text-slate-400 font-medium">Category</span>
                    <p className="text-sm font-bold text-slate-800">{detailDrawerRequest.serviceCategory}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <span className="text-xs text-slate-400 font-medium">Status</span>
                    <p className="text-sm font-bold text-brand-teal">{detailDrawerRequest.status}</p>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Description</h4>
                  <p className="text-sm text-slate-700 bg-white p-3 rounded-lg border border-slate-100 leading-relaxed">
                    {detailDrawerRequest.description}
                  </p>
                </div>

                {/* Details Grid */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Request Details</h4>
                  <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-slate-400">Property:</span>
                      <p className="font-semibold text-slate-800">{detailDrawerRequest.property?.name || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Location:</span>
                      <p className="font-semibold text-slate-800">{detailDrawerRequest.locationDetails || 'Common Area'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Requester:</span>
                      <p className="font-semibold text-slate-800">{detailDrawerRequest.requesterName} ({detailDrawerRequest.requesterRole})</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Phone:</span>
                      <p className="font-semibold text-slate-800">{detailDrawerRequest.contactPhone || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Preferred Slot:</span>
                      <p className="font-semibold text-slate-800">{detailDrawerRequest.preferredSlot}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Scheduled Date:</span>
                      <p className="font-semibold text-slate-800">
                        {detailDrawerRequest.scheduledDate
                          ? new Date(detailDrawerRequest.scheduledDate).toLocaleString('en-IN')
                          : 'Not scheduled'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Resolution Notes if completed */}
                {detailDrawerRequest.resolutionNotes && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Resolution Notes</h4>
                    <p className="text-sm text-slate-800 bg-emerald-50/60 p-3 rounded-lg border border-emerald-100 leading-relaxed">
                      {detailDrawerRequest.resolutionNotes}
                    </p>
                  </div>
                )}

                {/* Cancellation Reason if cancelled */}
                {detailDrawerRequest.cancellationReason && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-red-700 uppercase tracking-wider">Cancellation Reason</h4>
                    <p className="text-sm text-slate-800 bg-red-50/60 p-3 rounded-lg border border-red-100 leading-relaxed">
                      {detailDrawerRequest.cancellationReason}
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100">
                <button
                  onClick={() => setDetailDrawerRequest(null)}
                  className="w-full py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition"
                >
                  Close Drawer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
