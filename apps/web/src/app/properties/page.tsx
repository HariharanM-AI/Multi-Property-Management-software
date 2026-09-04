'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth-context';
import {
  PropertyDto,
  PropertyType,
  PropertyStatus,
  ApiResponse,
} from '@propertyos/types';
import {
  Building2,
  Plus,
  Search,
  Filter,
  MapPin,
  BedDouble,
  Home,
  CheckCircle2,
  Archive,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  Trash2,
  AlertTriangle,
  X,
  Loader2,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

import { BackButton } from '@/components/ui/BackButton';
import { getCleanPropertyDescription } from '@/lib/propertyUtils';

export default function PropertiesListPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [properties, setProperties] = useState<PropertyDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ACTIVE');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Delete Property Modal State
  const [deleteTargetProperty, setDeleteTargetProperty] = useState<PropertyDto | null>(null);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccessMsg, setDeleteSuccessMsg] = useState<string | null>(null);

  const fetchProperties = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      queryParams.set('page', currentPage.toString());
      queryParams.set('pageSize', '12');

      if (searchTerm.trim()) {
        queryParams.set('search', searchTerm.trim());
      }
      if (selectedType !== 'ALL') {
        queryParams.set('propertyType', selectedType);
      }
      if (selectedStatus !== 'ALL') {
        queryParams.set('status', selectedStatus);
      }

      const res = await fetch(`${API_BASE}/properties?${queryParams.toString()}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (res.ok) {
        const json: ApiResponse<PropertyDto[]> = await res.json();
        if (json.success && json.data) {
          setProperties(json.data);
          if (json.meta) {
            setTotalPages(json.meta.totalPages || 1);
            setTotalCount(json.meta.total || 0);
          }
        }
      }
    } catch {
      // Graceful fallback in offline / local development mode
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, [currentPage, selectedType, selectedStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchProperties();
  };

  const handleConfirmDeleteProperty = async () => {
    if (!deleteTargetProperty) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`${API_BASE}/properties/${deleteTargetProperty.id}/archive`, {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        const deletedName = deleteTargetProperty.name;
        setDeleteTargetProperty(null);
        setDeleteConfirmationInput('');
        setDeleteSuccessMsg(`Property "${deletedName}" has been removed successfully.`);
        fetchProperties();
        setTimeout(() => setDeleteSuccessMsg(null), 5000);
      } else {
        const errJson = await res.json().catch(() => ({}));
        setDeleteError(errJson.error?.message || 'Failed to remove property. Please try again.');
      }
    } catch {
      setDeleteError('Network error while processing property removal.');
    } finally {
      setIsDeleting(false);
    }
  };

  const isDeleteConfirmed =
    deleteConfirmationInput.trim().toUpperCase() === 'DELETE' ||
    (deleteTargetProperty &&
      deleteConfirmationInput.trim().toLowerCase() === deleteTargetProperty.name.trim().toLowerCase());

  return (
    <AppShell activePath="/properties">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="mb-2">
              <BackButton fallbackHref="/" label="Back to Dashboard" />
            </div>
            <h1 className="text-2xl font-bold text-brand-navy tracking-tight">Properties</h1>
            <p className="text-xs text-surface-textSecondary">
              Manage your residential real estate assets across PG and Whole-Unit Rental operating models.
            </p>
          </div>
          <Link href="/properties/new">
            <Button variant="primary" size="md" className="gap-2 font-semibold shadow-sm">
              <Plus className="w-4 h-4" />
              Add Property
            </Button>
          </Link>
        </div>

        {/* Delete Success Alert */}
        {deleteSuccessMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{deleteSuccessMsg}</span>
          </div>
        )}

        {/* Filters and Search Bar */}
        <div className="bg-brand-white p-4 rounded-xl border border-surface-border shadow-sm flex flex-col md:flex-row items-center gap-4 justify-between">
          <form onSubmit={handleSearchSubmit} className="w-full md:w-80 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-surface-textSecondary" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, code, city..."
              className="block w-full pl-9 pr-4 py-2 bg-surface-subtle border border-surface-border rounded-lg text-xs text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal"
            />
          </form>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Operating Model Filter */}
            <div className="flex items-center rounded-lg border border-surface-border p-0.5 bg-surface-subtle text-xs">
              <button
                onClick={() => {
                  setSelectedType('ALL');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  selectedType === 'ALL'
                    ? 'bg-brand-white text-brand-navy shadow-sm'
                    : 'text-surface-textSecondary hover:text-brand-navy'
                }`}
              >
                All Models
              </button>
              <button
                onClick={() => {
                  setSelectedType(PropertyType.PG);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  selectedType === PropertyType.PG
                    ? 'bg-brand-white text-brand-teal shadow-sm'
                    : 'text-surface-textSecondary hover:text-brand-navy'
                }`}
              >
                PG / Co-Living
              </button>
              <button
                onClick={() => {
                  setSelectedType(PropertyType.RENTAL_HOUSE);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  selectedType === PropertyType.RENTAL_HOUSE
                    ? 'bg-brand-white text-blue-600 shadow-sm'
                    : 'text-surface-textSecondary hover:text-brand-navy'
                }`}
              >
                Whole-Unit Rental
              </button>
            </div>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-surface-subtle border border-surface-border rounded-lg text-xs font-medium text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-teal"
            >
              <option value="ACTIVE">Active Properties</option>
              <option value="INACTIVE">Inactive Properties</option>
              <option value="UNDER_MAINTENANCE">Under Maintenance</option>
              <option value="ARCHIVED">Archived Properties</option>
              <option value="ALL">All Statuses</option>
            </select>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-300 text-xs text-brand-navy flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-brand-navy shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Properties Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="bg-brand-white rounded-2xl border border-surface-border p-6 animate-pulse space-y-4"
              >
                <div className="h-4 bg-slate-100 rounded w-1/3" />
                <div className="h-6 bg-slate-100 rounded w-3/4" />
                <div className="h-4 bg-slate-100 rounded w-1/2" />
                <div className="h-16 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        ) : properties.length === 0 ? (
          <div className="bg-brand-white rounded-2xl border border-surface-border p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 text-brand-teal flex items-center justify-center mx-auto">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-brand-navy">No Properties Found</h3>
              <p className="text-xs text-surface-textSecondary mt-1 max-w-sm mx-auto">
                {searchTerm || selectedType !== 'ALL' || selectedStatus !== 'ACTIVE'
                  ? 'No properties match the selected filters. Try broadening your search criteria.'
                  : 'Your organization has not registered any properties yet. Add your first PG or Rental property to begin.'}
              </p>
            </div>
            <Link href="/properties/new">
              <Button variant="primary" size="sm" className="gap-2 font-semibold">
                <Plus className="w-4 h-4" />
                Create Property
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map((property) => {
              const isPG = property.propertyType === PropertyType.PG;
              const isArchived = property.status === PropertyStatus.ARCHIVED;

              // Theme palette: PG (Teal) vs House Rental (Blue)
              const cardTheme = {
                hoverBorder: isPG ? 'hover:border-teal-400/80 hover:shadow-teal-900/5' : 'hover:border-blue-400/80 hover:shadow-blue-900/5',
                badgeBg: isPG ? 'bg-teal-50 text-teal-800 border-teal-200' : 'bg-blue-50 text-blue-800 border-blue-200',
                pinColor: isPG ? 'text-teal-600' : 'text-blue-600',
                manageBtn: isPG ? 'bg-brand-teal hover:bg-teal-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white',
                footerAccent: isPG ? 'text-slate-600' : 'text-slate-600 font-medium',
              };

              return (
                <div
                  key={property.id}
                  className={`bg-brand-white rounded-2xl border transition-all duration-200 hover:shadow-md flex flex-col justify-between overflow-hidden ${
                    isArchived
                      ? 'border-slate-300 opacity-80'
                      : `border-surface-border ${cardTheme.hoverBorder}`
                  }`}
                >
                  <div className="p-6 space-y-4">
                    {/* Top Badges */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${cardTheme.badgeBg}`}
                        >
                          {isPG ? 'PG / Co-Living' : 'Whole-Unit Rental'}
                        </span>
                        {property.status === PropertyStatus.INACTIVE && (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                            Inactive
                          </span>
                        )}
                        {property.status === PropertyStatus.UNDER_MAINTENANCE && (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-800 border border-orange-200">
                            Under Maintenance
                          </span>
                        )}
                        {isArchived && (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-300">
                            Archived
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Property Name */}
                    <div>
                      <h3 className="text-base font-bold text-brand-navy tracking-tight">
                        {property.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-surface-textSecondary mt-1">
                        <MapPin className={`w-3.5 h-3.5 shrink-0 ${cardTheme.pinColor}`} />
                        <span className="truncate">
                          {property.locality ? `${property.locality}, ` : ''}
                          {property.city}, {property.state} — {property.postalCode}
                        </span>
                      </div>
                    </div>

                    {/* Description */}
                    {getCleanPropertyDescription(property.description) && (
                      <p className="text-xs text-surface-textSecondary line-clamp-2 leading-relaxed">
                        {getCleanPropertyDescription(property.description)}
                      </p>
                    )}

                    {/* Amenities Pill Summary */}
                    {property.amenities && property.amenities.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                        {property.amenities.slice(0, 3).map((pa) => (
                          <span
                            key={pa.id}
                            className="text-[10px] font-medium px-2 py-0.5 rounded bg-surface-subtle text-slate-600 border border-surface-border"
                          >
                            {pa.name}
                          </span>
                        ))}
                        {property.amenities.length > 3 && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface-subtle text-slate-400">
                            +{property.amenities.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card Footer with Delete Option and Manage link */}
                  <div className="px-5 py-3 bg-surface-subtle border-t border-surface-border flex items-center justify-between gap-3">
                    <span className={`text-[11px] truncate ${cardTheme.footerAccent}`}>
                      {isPG ? 'Room & Bed Inventory' : 'Unit & Lease Inventory'}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDeleteTargetProperty(property);
                          setDeleteConfirmationInput('');
                          setDeleteError(null);
                        }}
                        title={`Delete ${property.name}`}
                        className="gap-1.5 text-xs font-bold text-slate-600 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 bg-white px-2.5 py-1.5 h-8 rounded-xl border border-slate-200 shadow-2xs shrink-0 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                        <span>Delete</span>
                      </Button>
                      <Link
                        href={`/properties/${property.id}`}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 h-8 rounded-xl text-xs font-bold shadow-2xs transition shrink-0 ${cardTheme.manageBtn}`}
                      >
                        <span>Manage</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="bg-brand-white p-4 rounded-xl border border-surface-border flex items-center justify-between text-xs">
            <span className="text-surface-textSecondary">
              Showing page <strong className="text-brand-navy">{currentPage}</strong> of{' '}
              <strong className="text-brand-navy">{totalPages}</strong> ({totalCount} total properties)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* DELETE PROPERTY APPROVAL & DISCLAIMER CONFIRMATION MODAL                   */}
      {/* ========================================================================= */}
      {deleteTargetProperty && (
        <div className="fixed inset-0 z-50 bg-brand-navy/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold border border-rose-200">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Delete Property</h3>
                  <p className="text-xs text-slate-500">Security Approval Required</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTargetProperty(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Disclaimer & Warning Notice */}
            <div className="p-4 rounded-xl bg-rose-50/80 border border-rose-200 text-xs text-rose-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-rose-800">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
                <span>Permanent Deletion Warning</span>
              </div>
              <p className="text-slate-700 leading-relaxed">
                You are about to remove <strong>{deleteTargetProperty.name}</strong> (Code: <code>{deleteTargetProperty.code}</code>).
                All configured floors, rooms, beds, assigned leases, tenant stays, and media files under this property will be decommissioned.
              </p>
              <p className="font-semibold text-rose-700">
                ⚠️ This action cannot be reversed without administrative intervention.
              </p>
            </div>

            {/* Property Snapshot */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Property Name:</span>
                <span className="font-bold text-slate-800">{deleteTargetProperty.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Operating Model:</span>
                <span className="font-semibold text-brand-teal">
                  {deleteTargetProperty.propertyType === PropertyType.PG ? 'PG / Co-Living' : 'Whole-Unit Rental'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Location:</span>
                <span className="text-slate-700 truncate max-w-[240px]">
                  {deleteTargetProperty.city}, {deleteTargetProperty.state}
                </span>
              </div>
            </div>

            {/* Error in modal if any */}
            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-100/80 border border-rose-300 text-xs text-rose-800 font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            {/* Confirmation Input */}
            <div className="space-y-2 text-xs">
              <label className="font-semibold text-slate-700 block">
                To confirm removal, please type <strong className="text-rose-700 font-mono">DELETE</strong> or the property name below:
              </label>
              <input
                type="text"
                value={deleteConfirmationInput}
                onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                placeholder={`Type DELETE or "${deleteTargetProperty.name}"`}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            {/* Modal Actions */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeleteTargetProperty(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleConfirmDeleteProperty}
                disabled={!isDeleteConfirmed || isDeleting}
                isLoading={isDeleting}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs"
              >
                Delete Property
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
