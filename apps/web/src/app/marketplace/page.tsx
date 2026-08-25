'use client';

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  UserRole,
  PropertyDto,
  MarketplaceListingDto,
  MarketplaceCategory,
  MarketplaceItemCondition,
  MarketplaceListingStatus,
  MarketplaceSortBy,
  MarketplaceSummaryDto,
} from '@propertyos/types';
import {
  ShoppingBag,
  Search,
  Plus,
  Trash2,
  Edit2,
  Tag,
  Building2,
  Clock,
  User,
  Phone,
  MapPin,
  CheckCircle2,
  Clock3,
  XCircle,
  Sparkles,
  Loader2,
  AlertCircle,
  Image as ImageIcon,
  ArrowUpDown,
  Filter,
  X,
  Check,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

const CATEGORY_CONFIG: Record<
  MarketplaceCategory,
  { label: string; color: string; bgColor: string }
> = {
  [MarketplaceCategory.FURNITURE]: {
    label: 'Furniture',
    color: 'text-amber-700 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
  },
  [MarketplaceCategory.ELECTRONICS]: {
    label: 'Electronics',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800',
  },
  [MarketplaceCategory.APPLIANCES]: {
    label: 'Appliances',
    color: 'text-indigo-700 dark:text-indigo-400',
    bgColor: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800',
  },
  [MarketplaceCategory.BOOKS]: {
    label: 'Books & Study',
    color: 'text-emerald-700 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
  },
  [MarketplaceCategory.VEHICLES]: {
    label: 'Vehicles / Cycles',
    color: 'text-cyan-700 dark:text-cyan-400',
    bgColor: 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-800',
  },
  [MarketplaceCategory.CLOTHING]: {
    label: 'Clothing & Fashion',
    color: 'text-purple-700 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800',
  },
  [MarketplaceCategory.SPORTS]: {
    label: 'Sports & Fitness',
    color: 'text-orange-700 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800',
  },
  [MarketplaceCategory.OTHER]: {
    label: 'Other Items',
    color: 'text-slate-700 dark:text-slate-300',
    bgColor: 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700',
  },
};

const CONDITION_CONFIG: Record<
  MarketplaceItemCondition,
  { label: string; badgeColor: string }
> = {
  [MarketplaceItemCondition.BRAND_NEW]: {
    label: 'Brand New',
    badgeColor: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
  },
  [MarketplaceItemCondition.LIKE_NEW]: {
    label: 'Like New',
    badgeColor: 'bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-700',
  },
  [MarketplaceItemCondition.GOOD]: {
    label: 'Good Condition',
    badgeColor: 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700',
  },
  [MarketplaceItemCondition.FAIR]: {
    label: 'Fair',
    badgeColor: 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700',
  },
  [MarketplaceItemCondition.POOR]: {
    label: 'Used / For Parts',
    badgeColor: 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-700',
  },
};

export default function MarketplacePage() {
  const { user } = useAuth();
  const [, startTransition] = useTransition();

  // State
  const [properties, setProperties] = useState<PropertyDto[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [listings, setListings] = useState<MarketplaceListingDto[]>([]);
  const [summary, setSummary] = useState<MarketplaceSummaryDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedCondition, setSelectedCondition] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<MarketplaceSortBy>(MarketplaceSortBy.NEWEST);
  const [myListingsOnly, setMyListingsOnly] = useState(false);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingListing, setEditingListing] = useState<MarketplaceListingDto | null>(null);
  const [selectedListingDetail, setSelectedListingDetail] = useState<MarketplaceListingDto | null>(null);

  // Form State
  const [formPropertyId, setFormPropertyId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formIsNegotiable, setFormIsNegotiable] = useState(false);
  const [formCategory, setFormCategory] = useState<MarketplaceCategory>(MarketplaceCategory.OTHER);
  const [formCondition, setFormCondition] = useState<MarketplaceItemCondition>(MarketplaceItemCondition.GOOD);
  const [formLocationNote, setFormLocationNote] = useState('');
  const [formContactPhone, setFormContactPhone] = useState('');
  const [formImagesText, setFormImagesText] = useState('');

  const isModerator =
    user?.roles.some((r) =>
      [UserRole.OWNER, UserRole.PROPERTY_MANAGER, UserRole.WARDEN].includes(r)
    ) ?? false;

  // Fetch Properties
  useEffect(() => {
    async function loadProperties() {
      try {
        const res = await fetch(`${API_BASE}/properties`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          const props = Array.isArray(data) ? data : data.data || [];
          setProperties(props);
          if (props.length > 0 && !selectedPropertyId) {
            setSelectedPropertyId(props[0].id);
            setFormPropertyId(props[0].id);
          }
        }
      } catch (err) {
        console.error('Error fetching properties:', err);
      }
    }
    loadProperties();
  }, []);

  // Fetch Listings & Summary
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedPropertyId) params.append('propertyId', selectedPropertyId);
      if (selectedCategory !== 'ALL') params.append('category', selectedCategory);
      if (selectedCondition !== 'ALL') params.append('condition', selectedCondition);
      if (selectedStatus !== 'ALL') params.append('status', selectedStatus);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (sortBy) params.append('sortBy', sortBy);
      if (myListingsOnly && user?.id) params.append('sellerId', user.id);

      const [listingsRes, summaryRes] = await Promise.all([
        fetch(`${API_BASE}/marketplace/listings?${params.toString()}`, {
          credentials: 'include',
        }),
        fetch(
          `${API_BASE}/marketplace/summary${
            selectedPropertyId ? `?propertyId=${selectedPropertyId}` : ''
          }`,
          { credentials: 'include' }
        ),
      ]);

      if (listingsRes.ok) {
        const listingsJson = await listingsRes.json();
        const data = Array.isArray(listingsJson) ? listingsJson : listingsJson.data || [];
        setListings(data);
      } else {
        const errJson = await listingsRes.json().catch(() => ({}));
        setError(errJson.message || 'Failed to fetch marketplace listings.');
      }

      if (summaryRes.ok) {
        const summaryJson = await summaryRes.json();
        setSummary(summaryJson.data || summaryJson);
      }
    } catch (err) {
      console.error('Error fetching marketplace data:', err);
      setError('Network connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [
    selectedPropertyId,
    selectedCategory,
    selectedCondition,
    selectedStatus,
    searchQuery,
    sortBy,
    myListingsOnly,
    user?.id,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Create Listing
  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError(null);
    try {
      const images = formImagesText
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const res = await fetch(`${API_BASE}/marketplace/listings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          propertyId: formPropertyId || selectedPropertyId,
          title: formTitle.trim(),
          description: formDescription.trim(),
          price: parseFloat(formPrice),
          isNegotiable: formIsNegotiable,
          category: formCategory,
          condition: formCondition,
          locationNote: formLocationNote.trim() || undefined,
          contactPhone: formContactPhone.trim() || undefined,
          images: images.length > 0 ? images : undefined,
        }),
      });

      if (res.ok) {
        setSuccessMessage('Listing published successfully!');
        setIsCreateModalOpen(false);
        resetForm();
        fetchData();
      } else {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.message || 'Failed to create listing.');
      }
    } catch {
      setError('Network error while creating listing.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Update Listing
  const handleUpdateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingListing) return;
    setActionLoading(true);
    setError(null);
    try {
      const images = formImagesText
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const res = await fetch(`${API_BASE}/marketplace/listings/${editingListing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: formTitle.trim(),
          description: formDescription.trim(),
          price: parseFloat(formPrice),
          isNegotiable: formIsNegotiable,
          category: formCategory,
          condition: formCondition,
          locationNote: formLocationNote.trim() || undefined,
          contactPhone: formContactPhone.trim() || undefined,
          images: images.length > 0 ? images : [],
        }),
      });

      if (res.ok) {
        setSuccessMessage('Listing updated successfully!');
        setIsEditModalOpen(false);
        setEditingListing(null);
        resetForm();
        fetchData();
      } else {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.message || 'Failed to update listing.');
      }
    } catch {
      setError('Network error while updating listing.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Status Update (Advisory Locked)
  const handleUpdateStatus = async (
    listingId: string,
    targetStatus: MarketplaceListingStatus
  ) => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/marketplace/listings/${listingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: targetStatus }),
      });

      if (res.ok) {
        setSuccessMessage(`Listing marked as ${targetStatus.toLowerCase()}!`);
        fetchData();
      } else {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.message || 'Failed to update status.');
      }
    } catch {
      setError('Network error while updating status.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Delete Listing
  const handleDeleteListing = async (listingId: string) => {
    if (!confirm('Are you sure you want to remove this listing?')) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/marketplace/listings/${listingId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        setSuccessMessage('Listing removed successfully.');
        if (selectedListingDetail?.id === listingId) {
          setSelectedListingDetail(null);
        }
        fetchData();
      } else {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.message || 'Failed to delete listing.');
      }
    } catch {
      setError('Network error while deleting listing.');
    } finally {
      setActionLoading(false);
    }
  };

  const openEditModal = (listing: MarketplaceListingDto) => {
    setEditingListing(listing);
    setFormPropertyId(listing.propertyId);
    setFormTitle(listing.title);
    setFormDescription(listing.description);
    setFormPrice(listing.price);
    setFormIsNegotiable(listing.isNegotiable);
    setFormCategory(listing.category);
    setFormCondition(listing.condition);
    setFormLocationNote(listing.locationNote || '');
    setFormContactPhone(listing.sellerPhone || '');
    setFormImagesText((listing.images || []).join('\n'));
    setIsEditModalOpen(true);
  };

  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormPrice('');
    setFormIsNegotiable(false);
    setFormCategory(MarketplaceCategory.OTHER);
    setFormCondition(MarketplaceItemCondition.GOOD);
    setFormLocationNote('');
    setFormContactPhone('');
    setFormImagesText('');
  };

  const formatPrice = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return '₹0';
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2.5 rounded-xl bg-teal-600 text-white shadow-md shadow-teal-500/20">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Resident Marketplace
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Buy, sell, and discover pre-loved goods within your residential community.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {properties.length > 1 && (
              <div className="relative">
                <select
                  value={selectedPropertyId}
                  onChange={(e) => setSelectedPropertyId(e.target.value)}
                  className="px-3.5 py-2 pr-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-medium focus:ring-2 focus:ring-teal-500 outline-none shadow-sm cursor-pointer"
                >
                  <option value="">All Assigned Properties</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <Building2 className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}

            <button
              onClick={() => {
                resetForm();
                setIsCreateModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold shadow-md shadow-teal-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>List an Item</span>
            </button>
          </div>
        </div>
      </div>

      {/* Notifications / Alerts */}
      <div className="max-w-7xl mx-auto">
        {error && (
          <div className="mb-4 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex items-center justify-between text-rose-800 dark:text-rose-200 text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-emerald-800 dark:text-emerald-200 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-500 hover:text-emerald-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div className="max-w-7xl mx-auto mb-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Active Listings
            </p>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
              {summary?.activeListings ?? 0}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-600 dark:text-teal-400">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Active Value
            </p>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
              {formatPrice(summary?.totalActiveValue ?? '0')}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Tag className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Reserved Items
            </p>
            <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
              {summary?.reservedListings ?? 0}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Clock3 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Sold & Completed
            </p>
            <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
              {summary?.soldListings ?? 0}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="max-w-7xl mx-auto mb-6 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search items by title, description, seller..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all"
            />
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Condition Filter */}
            <select
              value={selectedCondition}
              onChange={(e) => setSelectedCondition(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer"
            >
              <option value="ALL">All Conditions</option>
              {Object.values(MarketplaceItemCondition).map((cond) => (
                <option key={cond} value={cond}>
                  {CONDITION_CONFIG[cond].label}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value={MarketplaceListingStatus.ACTIVE}>Active</option>
              <option value={MarketplaceListingStatus.RESERVED}>Reserved</option>
              <option value={MarketplaceListingStatus.SOLD}>Sold</option>
            </select>

            {/* Sort Filter */}
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-medium">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as MarketplaceSortBy)}
                className="bg-transparent outline-none cursor-pointer"
              >
                <option value={MarketplaceSortBy.NEWEST}>Newest First</option>
                <option value={MarketplaceSortBy.PRICE_ASC}>Price: Low to High</option>
                <option value={MarketplaceSortBy.PRICE_DESC}>Price: High to Low</option>
              </select>
            </div>

            {/* My Listings Toggle */}
            <button
              onClick={() => setMyListingsOnly(!myListingsOnly)}
              className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                myListingsOnly
                  ? 'bg-teal-500 text-white border-teal-600 shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              My Listings
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === 'ALL'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            All Categories
          </button>
          {Object.values(MarketplaceCategory).map((cat) => {
            const config = CATEGORY_CONFIG[cat];
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {config.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid View */}
      <div className="max-w-7xl mx-auto">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 py-12">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="h-80 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 animate-pulse space-y-4"
              >
                <div className="w-full h-40 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-600 mx-auto mb-4">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              No Listings Found
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
              {searchQuery || selectedCategory !== 'ALL' || selectedStatus !== 'ALL'
                ? 'No items match your active search and filter criteria. Try resetting filters.'
                : 'There are no active second-hand items listed in this community yet. Be the first to list one!'}
            </p>
            <button
              onClick={() => {
                resetForm();
                setIsCreateModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold shadow-md shadow-teal-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>List an Item Now</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((listing) => {
              const isOwner = user?.id === listing.sellerId;
              const canEdit = isOwner || isModerator;
              const catConfig = CATEGORY_CONFIG[listing.category] || CATEGORY_CONFIG[MarketplaceCategory.OTHER];
              const condConfig = CONDITION_CONFIG[listing.condition] || CONDITION_CONFIG[MarketplaceItemCondition.GOOD];

              return (
                <div
                  key={listing.id}
                  className={`flex flex-col justify-between rounded-2xl bg-white dark:bg-slate-900 border transition-all duration-200 overflow-hidden shadow-sm hover:shadow-md ${
                    listing.status === MarketplaceListingStatus.SOLD
                      ? 'border-slate-200 dark:border-slate-800 opacity-75'
                      : listing.status === MarketplaceListingStatus.RESERVED
                      ? 'border-amber-300 dark:border-amber-700/60'
                      : 'border-slate-200 dark:border-slate-800 hover:border-teal-500/50'
                  }`}
                >
                  {/* Top Image or Placeholder */}
                  <div className="relative w-full h-48 bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                    {listing.images && listing.images.length > 0 ? (
                      <img
                        src={listing.images[0]}
                        alt={listing.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback if image fails
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <ImageIcon className="w-10 h-10 stroke-[1.5]" />
                        <span className="text-xs font-medium">{catConfig.label}</span>
                      </div>
                    )}

                    {/* Status Badge */}
                    <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                      {listing.status === MarketplaceListingStatus.RESERVED && (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-500 text-white font-bold text-xs shadow">
                          RESERVED
                        </span>
                      )}
                      {listing.status === MarketplaceListingStatus.SOLD && (
                        <span className="px-2.5 py-1 rounded-lg bg-slate-700 text-white font-bold text-xs shadow">
                          SOLD
                        </span>
                      )}
                      {listing.status === MarketplaceListingStatus.ACTIVE && (
                        <span className="px-2.5 py-1 rounded-lg bg-teal-600 text-white font-bold text-xs shadow">
                          ACTIVE
                        </span>
                      )}
                    </div>

                    {/* Price Tag Overlay */}
                    <div className="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md text-white font-bold text-sm shadow-lg border border-white/10">
                      {formatPrice(listing.price)}
                      {listing.isNegotiable && (
                        <span className="ml-1.5 text-[10px] text-teal-300 font-normal uppercase">
                          (Nego)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Category & Condition Tags */}
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${catConfig.bgColor} ${catConfig.color}`}
                        >
                          {catConfig.label}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${condConfig.badgeColor}`}
                        >
                          {condConfig.label}
                        </span>
                      </div>

                      {/* Title & Description */}
                      <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-1 mb-1.5">
                        {listing.title}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-4">
                        {listing.description}
                      </p>
                    </div>

                    {/* Metadata & Seller Snapshot */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {listing.sellerName}
                          </span>
                          {listing.sellerRole === UserRole.TENANT && (
                            <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-400">
                              Resident
                            </span>
                          )}
                        </div>
                        {listing.locationNote && (
                          <div className="flex items-center gap-1 text-[11px] text-slate-500">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span className="truncate max-w-[110px]">{listing.locationNote}</span>
                          </div>
                        )}
                      </div>

                      {listing.propertyName && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-400">
                          <Building2 className="w-3 h-3" />
                          <span>{listing.propertyName}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="p-4 bg-slate-50/80 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setSelectedListingDetail(listing)}
                      className="text-xs font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 cursor-pointer"
                    >
                      View Details
                    </button>

                    <div className="flex items-center gap-1.5">
                      {canEdit && (
                        <>
                          {listing.status === MarketplaceListingStatus.ACTIVE && (
                            <button
                              onClick={() =>
                                handleUpdateStatus(listing.id, MarketplaceListingStatus.RESERVED)
                              }
                              disabled={actionLoading}
                              className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 text-[11px] font-semibold transition-all cursor-pointer"
                            >
                              Reserve
                            </button>
                          )}

                          {listing.status === MarketplaceListingStatus.RESERVED && (
                            <button
                              onClick={() =>
                                handleUpdateStatus(listing.id, MarketplaceListingStatus.SOLD)
                              }
                              disabled={actionLoading}
                              className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-semibold transition-all cursor-pointer"
                            >
                              Mark Sold
                            </button>
                          )}

                          {listing.status === MarketplaceListingStatus.SOLD && (
                            <button
                              onClick={() =>
                                handleUpdateStatus(listing.id, MarketplaceListingStatus.ACTIVE)
                              }
                              disabled={actionLoading}
                              className="px-2.5 py-1 rounded-lg bg-teal-100 hover:bg-teal-200 dark:bg-teal-950/60 dark:hover:bg-teal-900/60 text-teal-800 dark:text-teal-300 text-[11px] font-semibold transition-all cursor-pointer"
                            >
                              Re-list
                            </button>
                          )}

                          <button
                            onClick={() => openEditModal(listing)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer"
                            title="Edit Listing"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteListing(listing.id)}
                            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-all cursor-pointer"
                            title="Delete Listing"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}

                      {!isOwner && listing.sellerPhone && (
                        <a
                          href={`tel:${listing.sellerPhone}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm transition-all"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Call</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Listing Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-teal-600" />
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                  List an Item for Sale
                </h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateListing} className="p-6 space-y-4">
              {properties.length > 1 && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    Property Location *
                  </label>
                  <select
                    value={formPropertyId}
                    onChange={(e) => setFormPropertyId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                  >
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Item Title *
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={255}
                  placeholder="e.g. Ergonomic Study Chair, Study Lamp, Mini Fridge"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    Category *
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as MarketplaceCategory)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer"
                  >
                    {Object.values(MarketplaceCategory).map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_CONFIG[c].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    Condition *
                  </label>
                  <select
                    value={formCondition}
                    onChange={(e) =>
                      setFormCondition(e.target.value as MarketplaceItemCondition)
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer"
                  >
                    {Object.values(MarketplaceItemCondition).map((cond) => (
                      <option key={cond} value={cond}>
                        {CONDITION_CONFIG[cond].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    Price (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={10000000}
                    step="any"
                    placeholder="e.g. 1500"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>

                <div className="pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={formIsNegotiable}
                      onChange={(e) => setFormIsNegotiable(e.target.checked)}
                      className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                    />
                    <span>Price is Negotiable</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Description *
                </label>
                <textarea
                  required
                  minLength={5}
                  maxLength={2000}
                  rows={3}
                  placeholder="Describe the item condition, dimensions, reason for selling, pickup instructions..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    Location / Room Note
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    placeholder="e.g. Room 204, Tower B"
                    value={formLocationNote}
                    onChange={(e) => setFormLocationNote(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    Contact Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    pattern="[6-9][0-9]{9}"
                    placeholder="10-digit mobile number"
                    value={formContactPhone}
                    onChange={(e) => setFormContactPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Image URLs (1 per line, max 5)
                </label>
                <textarea
                  rows={2}
                  placeholder="https://example.com/item-photo.jpg"
                  value={formImagesText}
                  onChange={(e) => setFormImagesText(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs focus:ring-2 focus:ring-teal-500 outline-none font-mono"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold shadow-md shadow-teal-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Publish Listing</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Listing Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-teal-600" />
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                  Edit Listing
                </h3>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateListing} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Item Title *
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={255}
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as MarketplaceCategory)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer"
                  >
                    {Object.values(MarketplaceCategory).map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_CONFIG[c].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    Condition
                  </label>
                  <select
                    value={formCondition}
                    onChange={(e) =>
                      setFormCondition(e.target.value as MarketplaceItemCondition)
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer"
                  >
                    {Object.values(MarketplaceItemCondition).map((cond) => (
                      <option key={cond} value={cond}>
                        {CONDITION_CONFIG[cond].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    Price (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={10000000}
                    step="any"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>

                <div className="pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={formIsNegotiable}
                      onChange={(e) => setFormIsNegotiable(e.target.checked)}
                      className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                    />
                    <span>Price is Negotiable</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Description *
                </label>
                <textarea
                  required
                  minLength={5}
                  maxLength={2000}
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    Location / Room Note
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    value={formLocationNote}
                    onChange={(e) => setFormLocationNote(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    pattern="[6-9][0-9]{9}"
                    value={formContactPhone}
                    onChange={(e) => setFormContactPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Image URLs (1 per line)
                </label>
                <textarea
                  rows={2}
                  value={formImagesText}
                  onChange={(e) => setFormImagesText(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs focus:ring-2 focus:ring-teal-500 outline-none font-mono"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold shadow-md shadow-teal-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Listing Detail Modal */}
      {selectedListingDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8">
            <div className="relative w-full h-64 bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
              {selectedListingDetail.images && selectedListingDetail.images.length > 0 ? (
                <img
                  src={selectedListingDetail.images[0]}
                  alt={selectedListingDetail.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <ImageIcon className="w-12 h-12 stroke-[1.5]" />
                  <span className="text-sm font-medium">No Image Provided</span>
                </div>
              )}
              <button
                onClick={() => setSelectedListingDetail(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-slate-900/70 text-white hover:bg-slate-900 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${
                        CATEGORY_CONFIG[selectedListingDetail.category]?.bgColor
                      } ${CATEGORY_CONFIG[selectedListingDetail.category]?.color}`}
                    >
                      {CATEGORY_CONFIG[selectedListingDetail.category]?.label}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${
                        CONDITION_CONFIG[selectedListingDetail.condition]?.badgeColor
                      }`}
                    >
                      {CONDITION_CONFIG[selectedListingDetail.condition]?.label}
                    </span>
                  </div>
                  <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
                    {selectedListingDetail.title}
                  </h2>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-teal-600 dark:text-teal-400">
                    {formatPrice(selectedListingDetail.price)}
                  </p>
                  {selectedListingDetail.isNegotiable && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Negotiable
                    </p>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Description
                </h4>
                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line">
                  {selectedListingDetail.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400" />
                  <span>
                    Seller: <strong>{selectedListingDetail.sellerName}</strong>
                  </span>
                </div>
                {selectedListingDetail.locationNote && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span>Location: {selectedListingDetail.locationNote}</span>
                  </div>
                )}
                {selectedListingDetail.sellerPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span>Contact: {selectedListingDetail.sellerPhone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>
                    Listed:{' '}
                    {new Date(selectedListingDetail.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>

              {selectedListingDetail.sellerPhone && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                  <a
                    href={`tel:${selectedListingDetail.sellerPhone}`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold shadow-md shadow-teal-600/20 transition-all"
                  >
                    <Phone className="w-4 h-4" />
                    <span>Call Seller ({selectedListingDetail.sellerPhone})</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
