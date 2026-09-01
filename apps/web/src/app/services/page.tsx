'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { BackButton } from '@/components/ui/BackButton';
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
  Wrench,
  Plus,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Phone,
  Calendar,
  IndianRupee,
  MapPin,
  User,
  ShieldAlert,
  Trash2,
  UserCheck,
  Building,
  Check,
  X,
  ChevronRight,
  Info,
  Layers,
  Flame,
  Droplets,
  Zap,
  Hammer,
  Tv,
  Brush,
  Bug,
  Shirt,
  Truck,
  ShieldCheck,
  Trash,
  Trees,
  Package,
  HelpCircle,
  ChevronDown,
  RefreshCw,
  Eye,
  FileText,
  Lock,
} from 'lucide-react';

// Domain Classification
export type ServiceDomain = 'MAINTENANCE' | 'FACILITY';

interface ServiceCategoryInfo {
  label: string;
  domain: ServiceDomain;
  icon: any;
  accent: 'blue' | 'teal';
  color: string;
  badgeColor: string;
  description: string;
  examples: string;
}

const CATEGORY_REGISTRY: Record<ServiceRequestCategory, ServiceCategoryInfo> = {
  [ServiceRequestCategory.PLUMBING]: {
    label: 'Plumbing & Sanitation',
    domain: 'MAINTENANCE',
    icon: Droplets,
    accent: 'blue',
    color: 'text-blue-600',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    description: 'Pipe leaks, pressure balancing, drain cleaning, tap & sanitary fixture replacements.',
    examples: 'Pipe leaks, clogged drains, toilet repairs, valve replacements',
  },
  [ServiceRequestCategory.ELECTRICAL]: {
    label: 'Electrical & Power',
    domain: 'MAINTENANCE',
    icon: Zap,
    accent: 'blue',
    color: 'text-amber-600',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    description: 'Circuit breakers, switchboards, wiring faults, lighting fixtures, and power backup.',
    examples: 'MCB trips, short circuits, switch replacement, power sockets',
  },
  [ServiceRequestCategory.CARPENTRY]: {
    label: 'Carpentry & Locks',
    domain: 'MAINTENANCE',
    icon: Hammer,
    accent: 'blue',
    color: 'text-orange-600',
    badgeColor: 'bg-orange-50 text-orange-700 border-orange-200',
    description: 'Door locks, window latches, wardrobe hinges, bed frames, and civil woodwork.',
    examples: 'Door alignment, lock replacements, bed repair, shelf installation',
  },
  [ServiceRequestCategory.APPLIANCE_REPAIR]: {
    label: 'Appliance & HVAC',
    domain: 'MAINTENANCE',
    icon: Tv,
    accent: 'blue',
    color: 'text-indigo-600',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    description: 'Air conditioners, water heaters/geysers, washing machines, RO purifiers, and refrigerators.',
    examples: 'AC cooling issues, geyser thermostat, RO filter servicing, washing machine repair',
  },
  [ServiceRequestCategory.PAINTING]: {
    label: 'Painting & Civil Touchups',
    domain: 'MAINTENANCE',
    icon: Brush,
    accent: 'blue',
    color: 'text-sky-600',
    badgeColor: 'bg-sky-50 text-sky-700 border-sky-200',
    description: 'Wall touch-ups, moisture dampness isolation, masonry patching, and seasonal repaint.',
    examples: 'Wall dampness, patchy paint, door polishing, crack plastering',
  },
  [ServiceRequestCategory.HOUSEKEEPING]: {
    label: 'Housekeeping & Cleaning',
    domain: 'FACILITY',
    icon: Sparkles,
    accent: 'teal',
    color: 'text-brand-teal',
    badgeColor: 'bg-teal-50 text-brand-teal border-teal-200',
    description: 'Daily common area cleaning, deep sanitization, room turnover, and floor care.',
    examples: 'Deep cleaning, corridor mop, move-in sanitization, trash clearance',
  },
  [ServiceRequestCategory.PEST_CONTROL]: {
    label: 'Pest Control & Vector Care',
    domain: 'FACILITY',
    icon: Bug,
    accent: 'teal',
    color: 'text-rose-600',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    description: 'Targeted treatments, bed bug eradication, rodent management, and perimeter sprays.',
    examples: 'Cockroach gel treatment, bed bug fumigation, termite barriers',
  },
  [ServiceRequestCategory.LAUNDRY]: {
    label: 'Linen & Laundry Ops',
    domain: 'FACILITY',
    icon: Shirt,
    accent: 'teal',
    color: 'text-cyan-600',
    badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    description: 'Property linen washing, curtains, mattress protector cycles, and dry cleaning coordination.',
    examples: 'Linen cycles, mattress wash, curtain sterilization',
  },
  [ServiceRequestCategory.PACKING_MOVING]: {
    label: 'Move Logistics & Storage',
    domain: 'FACILITY',
    icon: Truck,
    accent: 'teal',
    color: 'text-emerald-600',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    description: 'Occupant check-in/out heavy luggage handling, unit turnover shifts, and storage logistics.',
    examples: 'Heavy furniture move, luggage transit, room reallocation',
  },
  [ServiceRequestCategory.OTHER]: {
    label: 'General Facility Services',
    domain: 'FACILITY',
    icon: Info,
    accent: 'teal',
    color: 'text-slate-600',
    badgeColor: 'bg-slate-50 text-slate-700 border-slate-200',
    description: 'Security guard liaison, grounds upkeep, waste management, and consumable replenishment.',
    examples: 'Water tank cleaning, security guard roster, waste disposal, consumable supplies',
  },
};

const PRIORITY_BADGES: Record<ServiceRequestPriority, { label: string; color: string }> = {
  [ServiceRequestPriority.URGENT]: { label: 'Urgent', color: 'bg-rose-50 text-rose-700 border-rose-200 font-bold' },
  [ServiceRequestPriority.HIGH]: { label: 'High', color: 'bg-amber-50 text-amber-700 border-amber-200 font-semibold' },
  [ServiceRequestPriority.MEDIUM]: { label: 'Medium', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  [ServiceRequestPriority.LOW]: { label: 'Low', color: 'bg-slate-50 text-slate-700 border-slate-200' },
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

  // Data states
  const [requests, setRequests] = useState<ServiceRequestDto[]>([]);
  const [summary, setSummary] = useState<ServiceRequestSummaryDto | null>(null);
  const [properties, setProperties] = useState<any[]>([]);
  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Table filters & view state
  const [domainFilter, setDomainFilter] = useState<'ALL' | 'MAINTENANCE' | 'FACILITY'>('ALL');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Action Drawer
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequestDto | null>(null);
  const [detailDrawerRequest, setDetailDrawerRequest] = useState<ServiceRequestDto | null>(null);

  // Action form states
  const [assignForm, setAssignForm] = useState({
    assignedStaffId: '',
    assignedVendorName: '',
    assignedVendorPhone: '',
    scheduledDate: '',
    notes: '',
  });
  const [completeForm, setCompleteForm] = useState({
    resolutionNotes: '',
    actualCost: '',
    isPaidByTenant: false,
  });
  const [cancelReason, setCancelReason] = useState('');
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);

  // Work Order Creation Form State
  const formRef = useRef<HTMLDivElement>(null);
  const [formDomain, setFormDomain] = useState<ServiceDomain>('MAINTENANCE');
  const [createForm, setCreateForm] = useState({
    propertyId: '',
    serviceCategory: ServiceRequestCategory.PLUMBING,
    priority: ServiceRequestPriority.MEDIUM,
    title: '',
    description: '',
    contactPhone: user?.phone || '',
    locationDetails: '',
    preferredSlot: ServiceRequestSlot.ANYTIME,
    preferredDate: '',
    estimatedCost: '',
    isPaidByTenant: false,
  });
  const [isCreating, setIsCreating] = useState(false);
  const [createSuccessMsg, setCreateSuccessMsg] = useState<string | null>(null);
  const [createErrorMsg, setCreateErrorMsg] = useState<string | null>(null);

  // Active FAQ tab
  const [faqTab, setFaqTab] = useState<'ALL' | 'MAINTENANCE' | 'FACILITY' | 'SLAS'>('ALL');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // Fetch initial data defensively
  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [reqRes, sumRes, propRes, staffRes] = await Promise.all([
        fetch('/api/v1/services/requests', { credentials: 'include' }).catch(() => ({ ok: false })),
        fetch('/api/v1/services/summary', { credentials: 'include' }).catch(() => ({ ok: false })),
        fetch('/api/v1/properties', { credentials: 'include' }).catch(() => ({ ok: false })),
        fetch('/api/v1/staff', { credentials: 'include' }).catch(() => ({ ok: false })),
      ]);

      if (reqRes.ok && 'json' in reqRes) {
        const json = await reqRes.json();
        const raw = json?.data || json;
        const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);
        setRequests(Array.isArray(list) ? list : []);
      }
      if (sumRes.ok && 'json' in sumRes) {
        const sumJson = await sumRes.json();
        setSummary(sumJson?.data || sumJson);
      }
      if (propRes.ok && 'json' in propRes) {
        const propJson = await propRes.json();
        const rawProps = propJson?.data || propJson;
        const propList = Array.isArray(rawProps) ? rawProps : (Array.isArray(rawProps?.data) ? rawProps.data : []);
        setProperties(Array.isArray(propList) ? propList : []);
        if (propList.length > 0 && !createForm.propertyId) {
          setCreateForm((prev) => ({ ...prev, propertyId: propList[0].id }));
        }
      }
      if (staffRes.ok && 'json' in staffRes) {
        const staffJson = await staffRes.json();
        const rawStaff = staffJson?.data || staffJson;
        const staffList = Array.isArray(rawStaff) ? rawStaff : (Array.isArray(rawStaff?.data) ? rawStaff.data : []);
        setStaffMembers(Array.isArray(staffList) ? staffList : []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load maintenance and facility services data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Update categories available for request form depending on selected domain
  const availableFormCategories = useMemo(() => {
    return Object.entries(CATEGORY_REGISTRY).filter(([_, info]) => info.domain === formDomain);
  }, [formDomain]);

  // Handle prefill and smooth scrolling from category cards
  const handlePrefillCategory = (category: ServiceRequestCategory, domain: ServiceDomain) => {
    setFormDomain(domain);
    setCreateForm((prev) => ({
      ...prev,
      serviceCategory: category,
      title: `Inspection & Service: ${CATEGORY_REGISTRY[category].label}`,
    }));
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Filtered requests list
  const filteredRequests = useMemo(() => {
    if (!Array.isArray(requests)) return [];
    return requests.filter((r) => {
      if (!r) return false;
      if (selectedPropertyId && r.propertyId !== selectedPropertyId) return false;
      if (domainFilter !== 'ALL') {
        const catInfo = CATEGORY_REGISTRY[r.serviceCategory];
        if (catInfo && catInfo.domain !== domainFilter) return false;
      }
      if (selectedCategory !== 'ALL' && r.serviceCategory !== selectedCategory) return false;
      if (selectedStatus !== 'ALL' && r.status !== selectedStatus) return false;
      if (selectedPriority !== 'ALL' && r.priority !== selectedPriority) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = r.title?.toLowerCase().includes(q) || false;
        const matchesDesc = r.description?.toLowerCase().includes(q) || false;
        const matchesLoc = r.locationDetails?.toLowerCase().includes(q) || false;
        const matchesName = r.requesterName?.toLowerCase().includes(q) || false;
        if (!matchesTitle && !matchesDesc && !matchesLoc && !matchesName) return false;
      }
      return true;
    });
  }, [requests, selectedPropertyId, domainFilter, selectedCategory, selectedStatus, selectedPriority, searchQuery]);

  // Handle Form Submission
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateErrorMsg(null);
    setCreateSuccessMsg(null);

    if (!createForm.propertyId) {
      setCreateErrorMsg('Please select a property.');
      return;
    }
    if (!createForm.title.trim()) {
      setCreateErrorMsg('Please enter a work order title.');
      return;
    }
    if (!createForm.description.trim()) {
      setCreateErrorMsg('Please enter a detailed description.');
      return;
    }

    setIsCreating(true);
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
        throw new Error(err.message || 'Failed to submit work order.');
      }

      setCreateSuccessMsg('Work order generated and recorded in operations queue successfully.');
      setCreateForm((prev) => ({
        ...prev,
        title: '',
        description: '',
        locationDetails: '',
        preferredDate: '',
        estimatedCost: '',
        isPaidByTenant: false,
      }));
      await fetchData();
    } catch (err: any) {
      setCreateErrorMsg(err.message || 'Error creating work order.');
    } finally {
      setIsCreating(false);
    }
  };

  // Handle Assign Request
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;
    setIsActionSubmitting(true);
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
        throw new Error(err.message || 'Failed to assign work order.');
      }

      setIsAssignModalOpen(false);
      setSelectedRequest(null);
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsActionSubmitting(false);
    }
  };

  // Handle Complete Request
  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;
    setIsActionSubmitting(true);
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
        throw new Error(err.message || 'Failed to complete work order.');
      }

      setIsCompleteModalOpen(false);
      setSelectedRequest(null);
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsActionSubmitting(false);
    }
  };

  // Handle Cancel Request
  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;
    setIsActionSubmitting(true);
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
        throw new Error(err.message || 'Failed to cancel work order.');
      }

      setIsCancelModalOpen(false);
      setSelectedRequest(null);
      setCancelReason('');
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsActionSubmitting(false);
    }
  };

  // Start Service status transition
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
        throw new Error(err.message || 'Failed to update work order status.');
      }
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Delete Request
  const handleDelete = async (req: ServiceRequestDto) => {
    if (!confirm(`Are you sure you want to delete work order "${req.title}"?`)) return;
    try {
      const res = await fetch(`/api/v1/services/requests/${req.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to delete work order.');
      }
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // FAQs data
  const faqs = [
    {
      category: 'MAINTENANCE',
      question: 'What is the operational scope of Maintenance Services?',
      answer:
        'Maintenance services cover the preservation, troubleshooting, repair, and restoration of physical property assets and infrastructure. This includes plumbing pipes, electrical distribution boards, HVAC cooling units, water heaters, modular furniture, and periodic structural/safety audits.',
    },
    {
      category: 'FACILITY',
      question: 'How do Facility Operations differ from Maintenance in PropertyOS?',
      answer:
        'While Maintenance focuses on asset longevity and corrective hardware repairs, Facility Operations focus on the day-to-day living and working environment. This includes recurring housekeeping, scheduled pest control barriers, on-site security coordination, waste segregation, water tank cleaning, and consumables logistics.',
    },
    {
      category: 'SLAS',
      question: 'How are priority levels and response targets handled in work orders?',
      answer:
        'Work orders are assigned deterministic priority levels: URGENT (critical safety/flooding/power loss), HIGH (essential appliances and room plumbing), MEDIUM (minor repairs and touchups), and LOW (cosmetic inspections). Property managers can monitor pending triage and assigned statuses from the live work orders table.',
    },
    {
      category: 'SLAS',
      question: 'How are tenant-reimbursable expenses recorded and billed?',
      answer:
        'When creating or completing a work order, the operator can toggle "Paid by Tenant". When enabled, the actual expense is automatically linked to the occupant profile and can be consolidated directly into their next monthly utility invoice or security deposit settlement.',
    },
    {
      category: 'MAINTENANCE',
      question: 'Can internal staff and external vendors both be assigned to work orders?',
      answer:
        'Yes. PropertyOS supports assigning tickets either to registered in-house staff members (from the Staff roster) or to specialized external vendors with recorded contact information, scheduled dates, and operational instructions.',
    },
    {
      category: 'FACILITY',
      question: 'How are recurring housekeeping and pest control schedules tracked?',
      answer:
        'Facility requests can be scheduled with designated date slots (Morning, Afternoon, Evening, or Anytime). Operators can review historical fulfillment costs and completion logs in the work order register and audit trail.',
    },
  ];

  const filteredFaqs = useMemo(() => {
    if (faqTab === 'ALL') return faqs;
    return faqs.filter((f) => f.category === faqTab);
  }, [faqTab, faqs]);

  return (
    <AppShell activePath="/services">
      <div className="space-y-8 max-w-7xl mx-auto pb-16">
        {/* 1. Header Section */}
        <div id="overview" className="scroll-mt-24">
          <div className="mb-3">
            <BackButton fallbackHref="/" label="Back to Dashboard" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-teal-50 text-brand-teal border border-teal-200 rounded-xl">
                <Wrench className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                  <span>Maintenance & Facility Operations</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-brand-teal border border-teal-200">
                    Operations Hub
                  </span>
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Coordinate property repairs, preventive maintenance, housekeeping, security, and facility operations from one workspace.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={fetchData}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 shadow-sm transition"
              >
                <RefreshCw className={`w-4 h-4 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>

              <button
                onClick={() => {
                  if (formRef.current) {
                    formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-teal text-white rounded-lg font-medium text-sm hover:bg-teal-700 transition shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>New Work Order</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2. Sticky Wayfinding Sub-Navigation */}
        <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2.5 shadow-xs">
          <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none text-xs font-semibold text-slate-600">
            <a
              href="#overview"
              className="px-3 py-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition shrink-0"
            >
              Overview & KPIs
            </a>
            <span className="text-slate-300">/</span>
            <a
              href="#maintenance"
              className="px-3 py-1.5 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition shrink-0 flex items-center gap-1.5"
            >
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              Maintenance Operations
            </a>
            <span className="text-slate-300">/</span>
            <a
              href="#facility"
              className="px-3 py-1.5 rounded-lg hover:bg-teal-50 hover:text-brand-teal transition shrink-0 flex items-center gap-1.5"
            >
              <span className="w-2 h-2 rounded-full bg-brand-teal" />
              Facility Operations
            </a>
            <span className="text-slate-300">/</span>
            <a
              href="#work-orders"
              className="px-3 py-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition shrink-0"
            >
              Work Orders Register
            </a>
            <span className="text-slate-300">/</span>
            <a
              href="#request-form"
              className="px-3 py-1.5 rounded-lg bg-teal-50 text-brand-teal hover:bg-teal-100 transition shrink-0 font-bold"
            >
              + Create Work Order
            </a>
            <span className="text-slate-300">/</span>
            <a
              href="#scenarios"
              className="px-3 py-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition shrink-0"
            >
              Operational Scenarios
            </a>
            <span className="text-slate-300">/</span>
            <a
              href="#faq"
              className="px-3 py-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition shrink-0"
            >
              FAQ & Guidance
            </a>
          </nav>
        </div>

        {/* 3. Real KPI StatCards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Work Orders</span>
              <Layers className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">{summary?.totalRequests || 0}</p>
            <p className="text-xs text-slate-500 mt-1">Recorded operational tasks</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Triage</span>
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-amber-600 mt-2">{summary?.pendingRequests || 0}</p>
            <p className="text-xs text-slate-500 mt-1">Awaiting staff/vendor assignment</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active / Scheduled</span>
              <Wrench className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-blue-600 mt-2">
              {(summary?.scheduledRequests || 0) + (summary?.inProgressRequests || 0)}
            </p>
            <p className="text-xs text-slate-500 mt-1">In progress or dispatched</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completed</span>
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-emerald-600 mt-2">{summary?.completedRequests || 0}</p>
            <p className="text-xs text-slate-500 mt-1">Fulfillments finalized</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Fulfilled Cost</span>
              <IndianRupee className="w-5 h-5 text-brand-teal" />
            </div>
            <p className="text-2xl font-bold text-brand-teal mt-2">₹{summary?.totalActualCost || '0.00'}</p>
            <p className="text-xs text-slate-500 mt-1">Settled operational expenses</p>
          </div>
        </div>

        {/* 4. Unified Services Synergy Overview */}
        <div className="bg-gradient-to-r from-slate-900 to-brand-navy rounded-2xl p-6 sm:p-8 text-white shadow-lg space-y-6">
          <div className="max-w-3xl space-y-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30 inline-block">
              Operational Synergy
            </span>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              Two Disciplines, One Unified Property Command Center
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              PropertyOS brings together physical asset preservation and routine daily facility care under an integrated workflow.
              Property operators maintain complete transparency over equipment uptime, vendor costs, staff allocation, and tenant satisfaction.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
            {/* Maintenance Scope Card */}
            <div className="bg-slate-800/60 p-5 rounded-xl border border-blue-500/30 space-y-2.5">
              <div className="flex items-center gap-2.5 text-blue-400 font-bold text-base">
                <Wrench className="w-5 h-5" />
                <h3>Maintenance Operations</h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Dedicated to <strong>asset infrastructure</strong>: plumbing lines, electrical wiring, AC/HVAC cooling units,
                carpentry, structural integrity, appliance repairs, and preventive lifecycle inspections.
              </p>
              <div className="flex items-center gap-2 pt-1 text-[11px] text-blue-300 font-medium">
                <span>Objective: Asset preservation & hardware uptime</span>
              </div>
            </div>

            {/* Facility Scope Card */}
            <div className="bg-slate-800/60 p-5 rounded-xl border border-teal-500/30 space-y-2.5">
              <div className="flex items-center gap-2.5 text-teal-300 font-bold text-base">
                <Sparkles className="w-5 h-5" />
                <h3>Facility Operations</h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Dedicated to <strong>daily environmental quality</strong>: common area housekeeping, move-out sanitization,
                pest control barriers, on-site security coordination, waste segregation, and consumable logistics.
              </p>
              <div className="flex items-center gap-2 pt-1 text-[11px] text-teal-300 font-medium">
                <span>Objective: Cleanliness, hygiene, safety & daily continuity</span>
              </div>
            </div>
          </div>
        </div>

        {/* 5. Maintenance Operations Section */}
        <section id="maintenance" className="scroll-mt-24 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div>
              <div className="flex items-center gap-2 text-blue-700 font-bold text-lg">
                <div className="p-1.5 rounded-lg bg-blue-50 border border-blue-200">
                  <Wrench className="w-5 h-5 text-blue-600" />
                </div>
                <h2>Maintenance Operations</h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Asset infrastructure, corrective fixes, appliance servicing, power distribution, and scheduled inspections.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 self-start sm:self-auto">
              Asset Preservation Domain
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(CATEGORY_REGISTRY)
              .filter(([_, info]) => info.domain === 'MAINTENANCE')
              .map(([key, info]) => {
                const Icon = info.icon;
                const cat = key as ServiceRequestCategory;
                return (
                  <div
                    key={key}
                    className="bg-white p-5 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className="text-[11px] font-mono text-slate-400 font-semibold">{key}</span>
                      </div>

                      <div>
                        <h3 className="font-bold text-slate-900 text-base">{info.label}</h3>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{info.description}</p>
                      </div>

                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-600">
                        <span className="font-semibold text-slate-700">Common Tasks: </span>
                        {info.examples}
                      </div>
                    </div>

                    <button
                      onClick={() => handlePrefillCategory(cat, 'MAINTENANCE')}
                      className="w-full py-2 px-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Request {info.label}</span>
                    </button>
                  </div>
                );
              })}
          </div>
        </section>

        {/* 6. Facility Operations Section */}
        <section id="facility" className="scroll-mt-24 space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div>
              <div className="flex items-center gap-2 text-teal-700 font-bold text-lg">
                <div className="p-1.5 rounded-lg bg-teal-50 border border-teal-200">
                  <Sparkles className="w-5 h-5 text-brand-teal" />
                </div>
                <h2>Facility Operations</h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Hospitality-grade cleanliness, scheduled housekeeping, pest control, security coordination, and vendor logistics.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-teal-50 text-brand-teal border border-teal-200 self-start sm:self-auto">
              Environmental Care Domain
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(CATEGORY_REGISTRY)
              .filter(([_, info]) => info.domain === 'FACILITY')
              .map(([key, info]) => {
                const Icon = info.icon;
                const cat = key as ServiceRequestCategory;
                return (
                  <div
                    key={key}
                    className="bg-white p-5 rounded-xl border border-slate-200 hover:border-teal-300 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="p-2.5 rounded-xl bg-teal-50 text-brand-teal border border-teal-200">
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className="text-[11px] font-mono text-slate-400 font-semibold">{key}</span>
                      </div>

                      <div>
                        <h3 className="font-bold text-slate-900 text-base">{info.label}</h3>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{info.description}</p>
                      </div>

                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-600">
                        <span className="font-semibold text-slate-700">Scope of Work: </span>
                        {info.examples}
                      </div>
                    </div>

                    <button
                      onClick={() => handlePrefillCategory(cat, 'FACILITY')}
                      className="w-full py-2 px-3 rounded-lg bg-teal-50 hover:bg-teal-100 text-brand-teal border border-teal-200 text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Book {info.label}</span>
                    </button>
                  </div>
                );
              })}
          </div>
        </section>

        {/* 7. Operational Work Orders Register */}
        <section id="work-orders" className="scroll-mt-24 space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-brand-teal" />
                Operational Work Orders Register ({filteredRequests.length})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Active tasks, staff assignments, vendor work logs, and status updates across your portfolio.
              </p>
            </div>

            {/* Domain Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start sm:self-auto text-xs font-semibold">
              <button
                onClick={() => setDomainFilter('ALL')}
                className={`px-3 py-1.5 rounded-md transition ${
                  domainFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Domains
              </button>
              <button
                onClick={() => setDomainFilter('MAINTENANCE')}
                className={`px-3 py-1.5 rounded-md transition flex items-center gap-1 ${
                  domainFilter === 'MAINTENANCE'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-blue-700'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-300" />
                Maintenance
              </button>
              <button
                onClick={() => setDomainFilter('FACILITY')}
                className={`px-3 py-1.5 rounded-md transition flex items-center gap-1 ${
                  domainFilter === 'FACILITY'
                    ? 'bg-brand-teal text-white shadow-2xs'
                    : 'text-slate-600 hover:text-teal-700'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-teal-300" />
                Facility
              </button>
            </div>
          </div>

          {/* Controls & Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
              {/* Search */}
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search title, location, resident..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent bg-white text-slate-800"
                />
              </div>

              {/* Dropdowns */}
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                {properties.length > 1 && (
                  <select
                    aria-label="Filter by Property"
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
                  aria-label="Filter by Category"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                >
                  <option value="ALL">All Categories</option>
                  {Object.entries(CATEGORY_REGISTRY)
                    .filter(([_, info]) => domainFilter === 'ALL' || info.domain === domainFilter)
                    .map(([catKey, info]) => (
                      <option key={catKey} value={catKey}>
                        {info.label}
                      </option>
                    ))}
                </select>

                <select
                  aria-label="Filter by Priority"
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
                  aria-label="Filter by Status"
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

                {(searchQuery ||
                  selectedPropertyId ||
                  selectedCategory !== 'ALL' ||
                  selectedPriority !== 'ALL' ||
                  selectedStatus !== 'ALL' ||
                  domainFilter !== 'ALL') && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedPropertyId('');
                      setSelectedCategory('ALL');
                      setSelectedPriority('ALL');
                      setSelectedStatus('ALL');
                      setDomainFilter('ALL');
                    }}
                    className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"
                    title="Clear filters"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Work Orders Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5">Work Order & Details</th>
                    <th className="px-5 py-3.5">Domain / Category</th>
                    <th className="px-5 py-3.5">Priority</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Assigned To</th>
                    <th className="px-5 py-3.5">Preferred Slot</th>
                    <th className="px-5 py-3.5">Cost (₹)</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-5 py-4"><div className="h-4 bg-slate-100 rounded w-36"></div></td>
                        <td className="px-5 py-4"><div className="h-5 bg-slate-100 rounded w-28"></div></td>
                        <td className="px-5 py-4"><div className="h-5 bg-slate-100 rounded w-16"></div></td>
                        <td className="px-5 py-4"><div className="h-5 bg-slate-100 rounded w-20"></div></td>
                        <td className="px-5 py-4"><div className="h-4 bg-slate-100 rounded w-24"></div></td>
                        <td className="px-5 py-4"><div className="h-4 bg-slate-100 rounded w-20"></div></td>
                        <td className="px-5 py-4"><div className="h-4 bg-slate-100 rounded w-16"></div></td>
                        <td className="px-5 py-4 text-right"><div className="h-7 bg-slate-100 rounded w-16 ml-auto"></div></td>
                      </tr>
                    ))
                  ) : filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-16 text-center text-slate-400">
                        <Wrench className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                        <p className="font-semibold text-slate-700">No work orders match the selected criteria</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Create a new work order or adjust your domain and category filters.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map((req) => {
                      const catInfo = CATEGORY_REGISTRY[req.serviceCategory] || CATEGORY_REGISTRY[ServiceRequestCategory.OTHER];
                      const prioBadge = PRIORITY_BADGES[req.priority] || PRIORITY_BADGES[ServiceRequestPriority.LOW];
                      const statusBadge = STATUS_BADGES[req.status] || STATUS_BADGES[ServiceRequestStatus.PENDING];

                      return (
                        <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-5 py-4">
                            <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                              <span>{req.title}</span>
                              {req.isPaidByTenant && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                                  Tenant Billable
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                              <span>{req.property?.name || 'Property'}</span>
                              {req.locationDetails && (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-0.5">
                                    <MapPin className="w-3 h-3 text-slate-400" />
                                    {req.locationDetails}
                                  </span>
                                </>
                              )}
                            </div>
                          </td>

                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${catInfo.badgeColor}`}>
                              {catInfo.label}
                            </span>
                          </td>

                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${prioBadge.color}`}>
                              {prioBadge.label}
                            </span>
                          </td>

                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${statusBadge.color}`}>
                              {statusBadge.label}
                            </span>
                          </td>

                          <td className="px-5 py-4 whitespace-nowrap text-xs">
                            {req.assignedStaff ? (
                              <div className="flex items-center gap-1.5">
                                <UserCheck className="w-3.5 h-3.5 text-brand-teal" />
                                <span className="font-medium text-slate-900">{req.assignedStaff.name}</span>
                              </div>
                            ) : req.assignedVendorName ? (
                              <div className="flex items-center gap-1.5">
                                <Building className="w-3.5 h-3.5 text-blue-600" />
                                <span className="font-medium text-slate-900">{req.assignedVendorName}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Unassigned</span>
                            )}
                          </td>

                          <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-600">
                            {req.preferredDate ? (
                              <div>
                                <div>{new Date(req.preferredDate).toLocaleDateString('en-IN')}</div>
                                <span className="text-[10px] text-slate-400">{req.preferredSlot}</span>
                              </div>
                            ) : (
                              <span>{req.preferredSlot}</span>
                            )}
                          </td>

                          <td className="px-5 py-4 whitespace-nowrap text-xs font-mono">
                            {req.actualCost ? (
                              <span className="font-bold text-slate-900">₹{req.actualCost}</span>
                            ) : req.estimatedCost ? (
                              <span className="text-slate-500">~₹{req.estimatedCost}</span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          <td className="px-5 py-4 text-right space-x-1.5 whitespace-nowrap">
                            {/* State transitions */}
                            {req.status === ServiceRequestStatus.PENDING && (
                              <button
                                onClick={() => {
                                  setSelectedRequest(req);
                                  setAssignForm({
                                    assignedStaffId: '',
                                    assignedVendorName: '',
                                    assignedVendorPhone: '',
                                    scheduledDate: '',
                                    notes: '',
                                  });
                                  setIsAssignModalOpen(true);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold transition shadow-2xs"
                              >
                                Assign
                              </button>
                            )}

                            {req.status === ServiceRequestStatus.SCHEDULED && (
                              <button
                                onClick={() => handleStartService(req)}
                                className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold transition shadow-2xs"
                              >
                                Start
                              </button>
                            )}

                            {(req.status === ServiceRequestStatus.SCHEDULED || req.status === ServiceRequestStatus.IN_PROGRESS) && (
                              <button
                                onClick={() => {
                                  setSelectedRequest(req);
                                  setCompleteForm({
                                    resolutionNotes: '',
                                    actualCost: req.estimatedCost || '',
                                    isPaidByTenant: req.isPaidByTenant,
                                  });
                                  setIsCompleteModalOpen(true);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold transition shadow-2xs"
                              >
                                Complete
                              </button>
                            )}

                            {req.status !== ServiceRequestStatus.COMPLETED && req.status !== ServiceRequestStatus.CANCELLED && (
                              <button
                                onClick={() => {
                                  setSelectedRequest(req);
                                  setCancelReason('');
                                  setIsCancelModalOpen(true);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs font-semibold transition shadow-2xs"
                              >
                                Cancel
                              </button>
                            )}

                            <button
                              onClick={() => setDetailDrawerRequest(req)}
                              className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition shadow-2xs inline-flex items-center gap-1"
                              title="Inspect Details"
                            >
                              <Eye className="w-3.5 h-3.5 text-brand-teal" />
                              <span>Inspect</span>
                            </button>

                            <button
                              onClick={() => handleDelete(req)}
                              className="p-1 text-slate-400 hover:text-rose-600 transition"
                              title="Delete Request"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 8. Unified Request Work Order Form Section */}
        <section id="request-form" ref={formRef} className="scroll-mt-24 pt-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-brand-teal" />
                  Generate Operational Work Order
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Submit a new service ticket for asset maintenance or facility operations with automated operator notifications.
                </p>
              </div>

              {/* Domain Toggle */}
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setFormDomain('MAINTENANCE');
                    setCreateForm((prev) => ({
                      ...prev,
                      serviceCategory: ServiceRequestCategory.PLUMBING,
                    }));
                  }}
                  className={`px-4 py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
                    formDomain === 'MAINTENANCE'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Maintenance Order</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormDomain('FACILITY');
                    setCreateForm((prev) => ({
                      ...prev,
                      serviceCategory: ServiceRequestCategory.HOUSEKEEPING,
                    }));
                  }}
                  className={`px-4 py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
                    formDomain === 'FACILITY'
                      ? 'bg-brand-teal text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Facility Order</span>
                </button>
              </div>
            </div>

            {/* Error / Success Messages */}
            {createErrorMsg && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{createErrorMsg}</span>
              </div>
            )}
            {createSuccessMsg && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{createSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Property Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Property <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={createForm.propertyId}
                    onChange={(e) => setCreateForm({ ...createForm, propertyId: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  >
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code || p.propertyType})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Service Category */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Service Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={createForm.serviceCategory}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, serviceCategory: e.target.value as ServiceRequestCategory })
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  >
                    {availableFormCategories.map(([key, info]) => (
                      <option key={key} value={key}>
                        {info.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Priority Level <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={createForm.priority}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, priority: e.target.value as ServiceRequestPriority })
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  >
                    <option value={ServiceRequestPriority.LOW}>Low — Cosmetic / Non-urgent</option>
                    <option value={ServiceRequestPriority.MEDIUM}>Medium — Normal workflow</option>
                    <option value={ServiceRequestPriority.HIGH}>High — Essential appliance / Room issue</option>
                    <option value={ServiceRequestPriority.URGENT}>Urgent — Critical leak / Power cut</option>
                  </select>
                </div>
              </div>

              {/* Title & Location */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Work Order Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AC cooling malfunction / Deep cleaning Room 204"
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">Location Details / Unit / Room</label>
                  <input
                    type="text"
                    placeholder="e.g. 2nd Floor Corridor, Room 204, Kitchen Area"
                    value={createForm.locationDetails}
                    onChange={(e) => setCreateForm({ ...createForm, locationDetails: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Detailed Scope / Problem Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe the issue, specific hardware models, safety hazards, or special cleaning instructions..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full p-3 text-sm rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                />
              </div>

              {/* Slots, Costs & Reimbursable Toggle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">Preferred Service Slot</label>
                  <select
                    value={createForm.preferredSlot}
                    onChange={(e) => setCreateForm({ ...createForm, preferredSlot: e.target.value as ServiceRequestSlot })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  >
                    <option value={ServiceRequestSlot.ANYTIME}>Anytime during work hours</option>
                    <option value={ServiceRequestSlot.MORNING}>Morning (09:00 AM – 12:00 PM)</option>
                    <option value={ServiceRequestSlot.AFTERNOON}>Afternoon (12:00 PM – 04:00 PM)</option>
                    <option value={ServiceRequestSlot.EVENING}>Evening (04:00 PM – 07:00 PM)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">Preferred Execution Date</label>
                  <input
                    type="date"
                    value={createForm.preferredDate}
                    onChange={(e) => setCreateForm({ ...createForm, preferredDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">Estimated Cost (₹ Optional)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={createForm.estimatedCost}
                    onChange={(e) => setCreateForm({ ...createForm, estimatedCost: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  />
                </div>

                <div className="pt-5 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isPaidByTenant"
                    checked={createForm.isPaidByTenant}
                    onChange={(e) => setCreateForm({ ...createForm, isPaidByTenant: e.target.checked })}
                    className="w-4 h-4 text-brand-teal rounded border-slate-300 focus:ring-brand-teal"
                  />
                  <label htmlFor="isPaidByTenant" className="text-xs font-medium text-slate-700 cursor-pointer">
                    Tenant Reimbursable (Bill to Occupant)
                  </label>
                </div>
              </div>

              {/* Form Action */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={isCreating}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-brand-teal hover:bg-teal-700 text-white font-semibold text-sm transition shadow-sm disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isCreating ? 'Submitting Work Order...' : 'Submit Work Order'}</span>
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* 9. Operational Scenarios Section */}
        <section id="scenarios" className="scroll-mt-24 space-y-4 pt-4">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Building className="w-5 h-5 text-brand-teal" />
              Illustrative Operational Scenarios
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Standard operating procedures and workflows supported within the PropertyOS unified hub.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-brand-teal uppercase tracking-wider">
                <span>Scenario 1</span>
                <span>•</span>
                <span>PG Turnover</span>
              </div>
              <h3 className="font-bold text-slate-900 text-base">Co-Living Rapid Room Turnover</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                When an occupant checks out, operators generate a combined Housekeeping sterilization ticket and an Appliance inspection
                work order. Staff complete both tickets in sequence to ready the bed for the next allocated resident within hours.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
                <span>Scenario 2</span>
                <span>•</span>
                <span>Rental Escalation</span>
              </div>
              <h3 className="font-bold text-slate-900 text-base">Whole-Unit Infrastructure Leak</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Emergency plumbing alerts are classified as URGENT. Operators immediately assign an external vendor, record the agreed
                service date, and log parts expenses into the property ledger upon completed inspection.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 uppercase tracking-wider">
                <span>Scenario 3</span>
                <span>•</span>
                <span>Preventive Cycle</span>
              </div>
              <h3 className="font-bold text-slate-900 text-base">Quarterly HVAC & Pest Audit</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Scheduled BullMQ background automations notify operators of upcoming seasonal air conditioner servicing and perimeter pest
                control cycles, minimizing costly emergency asset breakdowns.
              </p>
            </div>
          </div>
        </section>

        {/* 10. FAQ & Guidance Section */}
        <section id="faq" className="scroll-mt-24 space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-brand-teal" />
                Frequently Asked Questions & Operational Guidance
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Guidance on service boundaries, work-order SLAs, vendor assignments, and cost accounting.
              </p>
            </div>

            {/* FAQ Category Filter */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
              {(['ALL', 'MAINTENANCE', 'FACILITY', 'SLAS'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFaqTab(tab)}
                  className={`px-3 py-1.5 rounded-md transition ${
                    faqTab === tab ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab === 'ALL'
                    ? 'All'
                    : tab === 'MAINTENANCE'
                    ? 'Maintenance'
                    : tab === 'FACILITY'
                    ? 'Facility'
                    : 'SLAs & Billing'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredFaqs.map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div key={index} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    className="w-full p-4 text-left flex items-center justify-between gap-4 hover:bg-slate-50 transition"
                  >
                    <span className="font-semibold text-slate-900 text-sm">{faq.question}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180 text-brand-teal' : ''}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* 11. Modal: Assign Work Order */}
        {isAssignModalOpen && selectedRequest && (
          <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-base">Assign Work Order</h3>
                <button onClick={() => setIsAssignModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAssignSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">Assign to In-House Staff</label>
                  <select
                    value={assignForm.assignedStaffId}
                    onChange={(e) => setAssignForm({ ...assignForm, assignedStaffId: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-800"
                  >
                    <option value="">None / External Vendor</option>
                    {staffMembers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.roleTitle || 'Staff'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 block">External Vendor Name</label>
                    <input
                      type="text"
                      placeholder="e.g. QuickFix Services"
                      value={assignForm.assignedVendorName}
                      onChange={(e) => setAssignForm({ ...assignForm, assignedVendorName: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-800"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 block">Vendor Phone</label>
                    <input
                      type="text"
                      placeholder="+91 98765 43210"
                      value={assignForm.assignedVendorPhone}
                      onChange={(e) => setAssignForm({ ...assignForm, assignedVendorPhone: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-800"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">Scheduled Date</label>
                  <input
                    type="date"
                    value={assignForm.scheduledDate}
                    onChange={(e) => setAssignForm({ ...assignForm, scheduledDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-800"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">Internal Assignment Notes</label>
                  <textarea
                    rows={2}
                    placeholder="Instructions for technician or vendor..."
                    value={assignForm.notes}
                    onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
                    className="w-full p-2.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-800"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAssignModalOpen(false)}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isActionSubmitting}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition"
                  >
                    Confirm Assignment
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 12. Modal: Complete Work Order */}
        {isCompleteModalOpen && selectedRequest && (
          <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-base">Complete Work Order</h3>
                <button onClick={() => setIsCompleteModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCompleteSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">Resolution Notes</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Describe what was fixed, parts replaced, or cleaning finalized..."
                    value={completeForm.resolutionNotes}
                    onChange={(e) => setCompleteForm({ ...completeForm, resolutionNotes: e.target.value })}
                    className="w-full p-2.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-800"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">Actual Cost Incurred (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={completeForm.actualCost}
                    onChange={(e) => setCompleteForm({ ...completeForm, actualCost: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-800"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="completePaidByTenant"
                    checked={completeForm.isPaidByTenant}
                    onChange={(e) => setCompleteForm({ ...completeForm, isPaidByTenant: e.target.checked })}
                    className="w-4 h-4 text-brand-teal rounded border-slate-300 focus:ring-brand-teal"
                  />
                  <label htmlFor="completePaidByTenant" className="text-xs font-medium text-slate-700 cursor-pointer">
                    Charge expense to tenant ledger
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsCompleteModalOpen(false)}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isActionSubmitting}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
                  >
                    Finalize Completion
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 13. Modal: Cancel Work Order */}
        {isCancelModalOpen && selectedRequest && (
          <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-base">Cancel Work Order</h3>
                <button onClick={() => setIsCancelModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCancelSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">Cancellation Reason</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Reason for cancelling this work order..."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-800"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsCancelModalOpen(false)}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isActionSubmitting}
                    className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition"
                  >
                    Confirm Cancellation
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 14. Slide-Over Detail Drawer */}
        {detailDrawerRequest && (
          <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
            <div className="w-full max-w-xl bg-white border-l border-slate-200 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
              {/* Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-teal-50 text-brand-teal border border-teal-200">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Work Order Details</h3>
                    <p className="text-xs font-mono text-slate-500">{detailDrawerRequest.id}</p>
                  </div>
                </div>

                <button
                  onClick={() => setDetailDrawerRequest(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5 text-sm">
                {/* Meta Grid */}
                <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <span className="text-[11px] text-slate-500 uppercase font-semibold">Title</span>
                    <p className="font-semibold text-slate-900 mt-0.5">{detailDrawerRequest.title}</p>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 uppercase font-semibold">Category</span>
                    <p className="font-semibold text-slate-900 mt-0.5">{detailDrawerRequest.serviceCategory}</p>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 uppercase font-semibold">Priority</span>
                    <p className="mt-0.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${PRIORITY_BADGES[detailDrawerRequest.priority]?.color}`}>
                        {detailDrawerRequest.priority}
                      </span>
                    </p>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 uppercase font-semibold">Status</span>
                    <p className="mt-0.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${STATUS_BADGES[detailDrawerRequest.status]?.color}`}>
                        {detailDrawerRequest.status}
                      </span>
                    </p>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 uppercase font-semibold">Property</span>
                    <p className="text-xs text-slate-800 mt-0.5">{detailDrawerRequest.property?.name || '—'}</p>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 uppercase font-semibold">Location</span>
                    <p className="text-xs text-slate-800 mt-0.5">{detailDrawerRequest.locationDetails || '—'}</p>
                  </div>
                </div>

                {/* Description */}
                <div className="p-4 rounded-xl border border-slate-200 space-y-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Problem Description</h4>
                  <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">{detailDrawerRequest.description}</p>
                </div>

                {/* Assignment & Execution Info */}
                <div className="p-4 rounded-xl border border-slate-200 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-brand-teal" />
                    Assignment & Staff
                  </h4>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block">Assigned Staff:</span>
                      <span className="font-semibold text-slate-900">
                        {detailDrawerRequest.assignedStaff?.name || 'None'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Assigned Vendor:</span>
                      <span className="font-semibold text-slate-900">
                        {detailDrawerRequest.assignedVendorName || 'None'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Scheduled Date:</span>
                      <span className="text-slate-800 font-mono">
                        {detailDrawerRequest.scheduledDate
                          ? new Date(detailDrawerRequest.scheduledDate).toLocaleDateString('en-IN')
                          : 'Not scheduled'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Requester:</span>
                      <span className="font-semibold text-slate-900">
                        {detailDrawerRequest.requesterName} ({detailDrawerRequest.requesterRole})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Resolution & Financial Details */}
                <div className="p-4 rounded-xl border border-slate-200 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <IndianRupee className="w-4 h-4 text-brand-teal" />
                    Financial & Resolution
                  </h4>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block">Estimated Cost:</span>
                      <span className="font-mono text-slate-800">
                        {detailDrawerRequest.estimatedCost ? `₹${detailDrawerRequest.estimatedCost}` : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Actual Cost:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {detailDrawerRequest.actualCost ? `₹${detailDrawerRequest.actualCost}` : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Paid By Tenant:</span>
                      <span className="font-semibold text-brand-teal">
                        {detailDrawerRequest.isPaidByTenant ? 'Yes (Billable)' : 'No (Owner Expense)'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Completed At:</span>
                      <span className="font-mono text-slate-700">
                        {detailDrawerRequest.completedAt
                          ? new Date(detailDrawerRequest.completedAt).toLocaleString('en-IN')
                          : 'In progress'}
                      </span>
                    </div>
                  </div>

                  {detailDrawerRequest.resolutionNotes && (
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-slate-500 text-[11px] font-semibold block">Resolution Notes:</span>
                      <p className="text-xs text-slate-800 mt-0.5">{detailDrawerRequest.resolutionNotes}</p>
                    </div>
                  )}

                  {detailDrawerRequest.cancellationReason && (
                    <div className="pt-2 border-t border-slate-100 text-rose-700">
                      <span className="text-[11px] font-semibold block">Cancellation Reason:</span>
                      <p className="text-xs mt-0.5">{detailDrawerRequest.cancellationReason}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50/50">
                <button
                  onClick={() => setDetailDrawerRequest(null)}
                  className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition shadow-2xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
