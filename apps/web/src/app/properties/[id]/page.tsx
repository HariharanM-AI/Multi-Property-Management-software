'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth-context';
import {
  PropertyDto,
  PropertyType,
  PropertyStatus,
  STANDARD_AMENITIES_CATALOG,
  ApiResponse,
} from '@propertyos/types';
import {
  Building2,
  BedDouble,
  Home,
  MapPin,
  Phone,
  Mail,
  CheckCircle2,
  Archive,
  RotateCcw,
  Edit,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  Info,
  AlertCircle,
  FileText,
  UploadCloud,
  Layers,
  Users,
  Utensils,
  Zap,
  Receipt,
  FileSpreadsheet,
  Trash2,
  Wifi,
  Shield,
  UserCheck,
  Shirt,
  Wind,
  Flame,
  Car,
  ArrowUpDown,
  Droplet,
  Bath,
  Dumbbell,
  Box,
  Tv,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Wifi,
  Zap,
  Shield,
  UserCheck,
  Shirt,
  Wind,
  Flame,
  Car,
  ArrowUpDown,
  Droplet,
  Bath,
  Utensils,
  Sparkles,
  Dumbbell,
  Box,
  Tv,
};

export default function PropertyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = params.id as string;
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [property, setProperty] = useState<PropertyDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    address: '',
    locality: '',
    city: '',
    state: '',
    postalCode: '',
    contactPhone: '',
    contactEmail: '',
  });



  const fetchProperty = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`${API_BASE}/properties/${propertyId}`, {
        method: 'GET',
        credentials: 'include',
      });

      const json: ApiResponse<PropertyDto> = await res.json();

      if (res.ok && json.success && json.data) {
        setProperty(json.data);
        setEditFormData({
          name: json.data.name,
          description: json.data.description || '',
          address: json.data.address,
          locality: json.data.locality || '',
          city: json.data.city,
          state: json.data.state,
          postalCode: json.data.postalCode,
          contactPhone: json.data.contactPhone || '',
          contactEmail: json.data.contactEmail || '',
        });
      } else {
        setErrorMessage(json.error?.message || 'Property not found');
      }
    } catch {
      setErrorMessage('Network error while retrieving property');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && propertyId) {
      fetchProperty();
    }
  }, [isAuthenticated, propertyId]);

  const handleArchive = async () => {
    if (!confirm('Are you sure you want to archive this property? It will be hidden from active property listings.')) {
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`${API_BASE}/properties/${propertyId}/archive`, {
        method: 'POST',
        credentials: 'include',
      });

      const json: ApiResponse<any> = await res.json();

      if (res.ok && json.success) {
        setSuccessMessage('Property archived successfully.');
        fetchProperty();
      } else {
        setErrorMessage(json.error?.message || 'Failed to archive property');
      }
    } catch {
      setErrorMessage('Network error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async () => {
    setActionLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`${API_BASE}/properties/${propertyId}/restore`, {
        method: 'POST',
        credentials: 'include',
      });

      const json: ApiResponse<any> = await res.json();

      if (res.ok && json.success) {
        setSuccessMessage('Property restored successfully.');
        fetchProperty();
      } else {
        setErrorMessage(json.error?.message || 'Failed to restore property');
      }
    } catch {
      setErrorMessage('Network error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`${API_BASE}/properties/${propertyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editFormData),
      });

      const json: ApiResponse<PropertyDto> = await res.json();

      if (res.ok && json.success && json.data) {
        setProperty(json.data);
        setIsEditModalOpen(false);
        setSuccessMessage('Property updated successfully.');
      } else {
        setErrorMessage(json.error?.message || 'Failed to update property');
      }
    } catch {
      setErrorMessage('Network error');
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <AppShell activePath="/properties">
        <div className="max-w-6xl mx-auto space-y-6 animate-pulse">
          <div className="h-8 bg-slate-100 rounded w-1/3" />
          <div className="h-48 bg-slate-100 rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-64 bg-slate-100 rounded-2xl" />
            <div className="h-64 bg-slate-100 rounded-2xl" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (!property) {
    return (
      <AppShell activePath="/properties">
        <div className="max-w-4xl mx-auto p-12 bg-brand-white rounded-2xl border border-surface-border text-center space-y-4">
          <AlertCircle className="w-8 h-8 text-brand-navy mx-auto" />
          <h2 className="text-lg font-bold text-brand-navy">Property Not Found</h2>
          <p className="text-xs text-surface-textSecondary">
            {errorMessage || 'The requested property could not be located or belongs to another organization.'}
          </p>
          <Link href="/properties">
            <Button variant="primary" size="sm">
              Back to Properties
            </Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  const isPG = property.propertyType === PropertyType.PG;
  const isArchived = property.status === PropertyStatus.ARCHIVED;

  return (
    <AppShell activePath="/properties">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-surface-textSecondary">
          <Link href="/properties" className="hover:text-brand-navy font-medium">
            Properties
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-brand-navy font-semibold">{property.name}</span>
        </div>

        {/* Feedback Messages */}
        {successMessage && (
          <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-xs text-brand-teal flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-300 text-xs text-brand-navy flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Property Header Banner */}
        <div className="bg-brand-white rounded-2xl border border-surface-border p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                {property.code}
              </span>
              <span
                className={`text-xs font-bold px-3 py-0.5 rounded-full border ${
                  isPG
                    ? 'bg-teal-50 text-brand-teal border-teal-200'
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}
              >
                {isPG ? 'PG / Co-Living Operating Model' : 'Whole-Unit Rental Operating Model'}
              </span>
              {isArchived && (
                <span className="text-xs font-bold px-3 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-300">
                  Archived
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-brand-navy tracking-tight">{property.name}</h1>
            <div className="flex items-center gap-2 text-xs text-surface-textSecondary">
              <MapPin className="w-3.5 h-3.5 text-brand-teal shrink-0" />
              <span>
                {property.address}, {property.locality ? `${property.locality}, ` : ''}
                {property.city}, {property.state} — {property.postalCode}
              </span>
            </div>
          </div>

          {/* Header Action Controls */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!isArchived ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditModalOpen(true)}
                  className="gap-1.5"
                >
                  <Edit className="w-3.5 h-3.5" />
                  Edit Details
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleArchive}
                  isLoading={actionLoading}
                  className="gap-1.5 text-slate-600 hover:text-red-600 hover:border-red-300"
                >
                  <Archive className="w-3.5 h-3.5" />
                  Archive Property
                </Button>
              </>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={handleRestore}
                isLoading={actionLoading}
                className="gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restore Property
              </Button>
            )}
          </div>
        </div>

        {/* 2-Column Overview Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Column 1: Location & Contacts */}
          <div className="bg-brand-white rounded-2xl border border-surface-border p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-brand-navy flex items-center gap-2">
              <MapPin className="w-4 h-4 text-brand-teal" />
              Location & Contact Details
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-surface-textSecondary block">Full Address</span>
                <p className="text-brand-navy font-medium mt-0.5 leading-relaxed">
                  {property.address}
                  {property.addressLine1 && `, ${property.addressLine1}`}
                  {property.addressLine2 && `, ${property.addressLine2}`}
                  <br />
                  {property.locality && `${property.locality}, `}
                  {property.city}, {property.state} — {property.postalCode}
                </p>
              </div>

              {property.latitude && property.longitude && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-surface-textSecondary block">GPS Coordinates</span>
                  <span className="text-brand-navy font-mono text-[11px] mt-0.5 block">
                    Lat: {property.latitude}, Lng: {property.longitude}
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-surface-textSecondary" />
                  <span className="text-brand-navy font-medium">
                    {property.contactPhone || 'No phone registered'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-surface-textSecondary" />
                  <span className="text-brand-navy font-medium">
                    {property.contactEmail || 'No email registered'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Column 2 & 3: Amenities Catalog */}
          <div className="md:col-span-2 bg-brand-white rounded-2xl border border-surface-border p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-brand-navy flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-teal" />
                Configured Amenities ({property.amenities?.length || 0})
              </h3>
            </div>

            {property.amenities && property.amenities.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {property.amenities.map((pa) => {
                  const catalogItem = STANDARD_AMENITIES_CATALOG.find((a) => a.name === pa.name);
                  const Icon = catalogItem ? ICON_MAP[catalogItem.icon] || Sparkles : Sparkles;

                  return (
                    <div
                      key={pa.id}
                      className="p-3 rounded-xl bg-surface-subtle border border-surface-border flex items-center gap-2.5"
                    >
                      <div className="w-7 h-7 rounded-lg bg-brand-white border border-surface-border flex items-center justify-center text-brand-teal shrink-0 shadow-2xs">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-semibold text-brand-navy truncate">
                        {pa.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-surface-textSecondary">
                No specific amenities registered for this property yet.
              </p>
            )}
          </div>
        </div>

        {/* MODEL-SPECIFIC CAPABILITY FOUNDATION SECTION */}
        <div className="bg-brand-white rounded-2xl border border-surface-border p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-brand-navy">
                {isPG ? 'PG / Co-Living Operating Capabilities' : 'Whole-Unit Rental Operating Capabilities'}
              </h3>
              <p className="text-xs text-surface-textSecondary mt-0.5">
                Domain inventory workflows enabled by the property's operating model.
              </p>
            </div>
            <span
              className={`text-[11px] font-bold px-3 py-1 rounded-full border ${
                isPG
                  ? 'bg-teal-50 text-brand-teal border-teal-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}
            >
              {isPG ? 'Bed & Sharing Model' : 'Unit & Lease Model'}
            </span>
          </div>

          {isPG ? (
            /* PG Capabilities Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-surface-subtle border border-surface-border space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 text-brand-teal flex items-center justify-center">
                    <Layers className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    CORE-005
                  </span>
                </div>
                <h4 className="text-xs font-bold text-brand-navy">Floors & Rooms</h4>
                <p className="text-[11px] text-surface-textSecondary leading-relaxed">
                  Single, double, triple & dorm sharing room structures with floor plans.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-surface-subtle border border-surface-border space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 text-brand-teal flex items-center justify-center">
                    <BedDouble className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    CORE-005
                  </span>
                </div>
                <h4 className="text-xs font-bold text-brand-navy">Bed Inventory & Stays</h4>
                <p className="text-[11px] text-surface-textSecondary leading-relaxed">
                  Real-time bed availability, check-in/out timestamps, and occupancy rates.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-surface-subtle border border-surface-border space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 text-brand-teal flex items-center justify-center">
                    <Utensils className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    CORE-007
                  </span>
                </div>
                <h4 className="text-xs font-bold text-brand-navy">Meal & Mess Plans</h4>
                <p className="text-[11px] text-surface-textSecondary leading-relaxed">
                  Breakfast, lunch, dinner subscription tracking and daily meal headcount.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-surface-subtle border border-surface-border space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 text-brand-teal flex items-center justify-center">
                    <Zap className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    CORE-007
                  </span>
                </div>
                <h4 className="text-xs font-bold text-brand-navy">Sub-Metered Power</h4>
                <p className="text-[11px] text-surface-textSecondary leading-relaxed">
                  Per-room meter readings and automatic tenant split calculations.
                </p>
              </div>
            </div>
          ) : (
            /* Whole-Unit Rental Capabilities Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-surface-subtle border border-surface-border space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Home className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    CORE-006
                  </span>
                </div>
                <h4 className="text-xs font-bold text-brand-navy">Rental Units (1BHK/2BHK/Villa)</h4>
                <p className="text-[11px] text-surface-textSecondary leading-relaxed">
                  Whole-unit flat specifications, square footage, and furnishing status.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-surface-subtle border border-surface-border space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    CORE-006
                  </span>
                </div>
                <h4 className="text-xs font-bold text-brand-navy">Leases & Agreements</h4>
                <p className="text-[11px] text-surface-textSecondary leading-relaxed">
                  Fixed-term residential lease agreements with lock-in and notice periods.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-surface-subtle border border-surface-border space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    CORE-006
                  </span>
                </div>
                <h4 className="text-xs font-bold text-brand-navy">Security Deposit Ledger</h4>
                <p className="text-[11px] text-surface-textSecondary leading-relaxed">
                  Upfront deposit receipts, deduction logs, and move-out refund settlements.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-surface-subtle border border-surface-border space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    CORE-006
                  </span>
                </div>
                <h4 className="text-xs font-bold text-brand-navy">Rent Escalation</h4>
                <p className="text-[11px] text-surface-textSecondary leading-relaxed">
                  Annual percentage rent increase schedules and renewal triggers.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* MEDIA FOUNDATION SECTION */}
        <div className="bg-brand-white rounded-2xl border border-surface-border p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-brand-navy">Property Media & Documents</h3>
              <p className="text-xs text-surface-textSecondary mt-0.5">
                Upload photos, floor plans, and property compliance certificates (JPEG, PNG, WEBP, PDF).
              </p>
            </div>
          </div>

          <div className="p-8 rounded-2xl border-2 border-dashed border-slate-200 bg-surface-subtle text-center space-y-2">
            <UploadCloud className="w-8 h-8 text-brand-teal mx-auto" />
            <p className="text-xs font-semibold text-brand-navy">Drag & drop files or click to upload</p>
            <p className="text-[11px] text-surface-textSecondary max-w-sm mx-auto">
              Images up to 5 MB, Documents up to 25 MB. Server-side UUID file renaming and MIME validation enforced.
            </p>
          </div>
        </div>

        {/* EDIT DETAILS MODAL */}
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/60 backdrop-blur-xs p-4">
            <div className="bg-brand-white rounded-2xl border border-surface-border shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-surface-border">
                <h3 className="text-base font-bold text-brand-navy">Edit Property Details</h3>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="text-surface-textSecondary hover:text-brand-navy text-xs font-semibold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-brand-navy">Property Name</label>
                  <input
                    type="text"
                    required
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="mt-1 block w-full px-3.5 py-2 bg-brand-white border border-surface-border rounded-lg text-xs text-brand-navy focus:ring-2 focus:ring-brand-teal focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-brand-navy">Description</label>
                  <textarea
                    rows={2}
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    className="mt-1 block w-full px-3.5 py-2 bg-brand-white border border-surface-border rounded-lg text-xs text-brand-navy focus:ring-2 focus:ring-brand-teal focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-brand-navy">Street Address</label>
                  <input
                    type="text"
                    required
                    value={editFormData.address}
                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                    className="mt-1 block w-full px-3.5 py-2 bg-brand-white border border-surface-border rounded-lg text-xs text-brand-navy focus:ring-2 focus:ring-brand-teal focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-brand-navy">Locality</label>
                    <input
                      type="text"
                      value={editFormData.locality}
                      onChange={(e) => setEditFormData({ ...editFormData, locality: e.target.value })}
                      className="mt-1 block w-full px-3.5 py-2 bg-brand-white border border-surface-border rounded-lg text-xs text-brand-navy focus:ring-2 focus:ring-brand-teal focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-brand-navy">PIN Code</label>
                    <input
                      type="text"
                      required
                      value={editFormData.postalCode}
                      onChange={(e) => setEditFormData({ ...editFormData, postalCode: e.target.value })}
                      className="mt-1 block w-full px-3.5 py-2 bg-brand-white border border-surface-border rounded-lg text-xs text-brand-navy focus:ring-2 focus:ring-brand-teal focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-brand-navy">Contact Phone</label>
                    <input
                      type="text"
                      value={editFormData.contactPhone}
                      onChange={(e) => setEditFormData({ ...editFormData, contactPhone: e.target.value })}
                      className="mt-1 block w-full px-3.5 py-2 bg-brand-white border border-surface-border rounded-lg text-xs text-brand-navy focus:ring-2 focus:ring-brand-teal focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-brand-navy">Contact Email</label>
                    <input
                      type="email"
                      value={editFormData.contactEmail}
                      onChange={(e) => setEditFormData({ ...editFormData, contactEmail: e.target.value })}
                      className="mt-1 block w-full px-3.5 py-2 bg-brand-white border border-surface-border rounded-lg text-xs text-brand-navy focus:ring-2 focus:ring-brand-teal focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-surface-border flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={actionLoading}
                    className="font-semibold"
                  >
                    Save Changes
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
