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
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

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



  const fetchProperties = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      queryParams.set('page', currentPage.toString());
      queryParams.set('pageSize', '9');

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

  return (
    <AppShell activePath="/properties">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-brand-navy tracking-tight">Properties</h1>
            <p className="text-xs text-surface-textSecondary mt-1">
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
              className="px-3 py-2 bg-surface-subtle border border-surface-border rounded-lg text-xs text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-teal"
            >
              <option value="ACTIVE">Active Properties</option>
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

              return (
                <div
                  key={property.id}
                  className={`bg-brand-white rounded-2xl border transition-all duration-200 hover:shadow-md flex flex-col justify-between overflow-hidden ${
                    isArchived
                      ? 'border-slate-300 opacity-80'
                      : 'border-surface-border hover:border-brand-teal/40'
                  }`}
                >
                  <div className="p-6 space-y-4">
                    {/* Top Badges */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {property.code}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                            isPG
                              ? 'bg-teal-50 text-brand-teal border-teal-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}
                        >
                          {isPG ? 'PG / Co-Living' : 'Whole-Unit Rental'}
                        </span>
                        {isArchived && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-300">
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
                        <MapPin className="w-3.5 h-3.5 shrink-0 text-brand-teal" />
                        <span className="truncate">
                          {property.locality ? `${property.locality}, ` : ''}
                          {property.city}, {property.state} — {property.postalCode}
                        </span>
                      </div>
                    </div>

                    {/* Description */}
                    {property.description && (
                      <p className="text-xs text-surface-textSecondary line-clamp-2 leading-relaxed">
                        {property.description}
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

                  {/* Card Footer */}
                  <div className="px-6 py-3 bg-surface-subtle border-t border-surface-border flex items-center justify-between">
                    <span className="text-[11px] text-surface-textSecondary">
                      {isPG ? 'Room & Bed Inventory' : 'Unit & Lease Inventory'}
                    </span>
                    <Link
                      href={`/properties/${property.id}`}
                      className="text-xs font-bold text-brand-navy hover:text-brand-teal flex items-center gap-1 transition-colors"
                    >
                      Manage Property
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
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
    </AppShell>
  );
}
