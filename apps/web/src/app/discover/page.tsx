'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import {
  PropertyDiscoveryDto,
  DiscoveryCitySummaryDto,
  PropertyType,
  RoomSharingType,
  DiscoverySortBy,
  ApiResponse,
} from '@propertyos/types';
import {
  Search,
  MapPin,
  Building2,
  BedDouble,
  Home,
  SlidersHorizontal,
  Navigation,
  Sparkles,
  Check,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  X,
  Phone,
  ShieldCheck,
  Wifi,
  AirVent,
  Utensils,
  Car,
  Zap,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

const COMMON_AMENITIES = [
  'High-Speed WiFi',
  'Air Conditioning',
  'Food/Mess Included',
  'Power Backup',
  'Security / CCTV',
  'Covered Parking',
  'Washing Machine',
  'Housekeeping',
];

export default function DiscoveryPage() {
  const [properties, setProperties] = useState<PropertyDiscoveryDto[]>([]);
  const [cities, setCities] = useState<DiscoveryCitySummaryDto[]>([]);
  const [featured, setFeatured] = useState<PropertyDiscoveryDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [minRent, setMinRent] = useState<string>('');
  const [maxRent, setMaxRent] = useState<string>('');
  const [selectedSharingTypes, setSelectedSharingTypes] = useState<RoomSharingType[]>([]);
  const [selectedUnitTypes, setSelectedUnitTypes] = useState<string[]>([]);
  const [selectedFurnishing, setSelectedFurnishing] = useState<string>('');
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sortBy, setSortBy] = useState<DiscoverySortBy>(DiscoverySortBy.NEWEST);

  // Geolocation State
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoRadius, setGeoRadius] = useState<number>(10);
  const [isLocating, setIsLocating] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Fetch Cities and Featured Properties on Mount
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [citiesRes, featuredRes] = await Promise.all([
          fetch(`${API_BASE}/discovery/cities`),
          fetch(`${API_BASE}/discovery/featured?limit=4`),
        ]);

        if (citiesRes.ok) {
          const json = await citiesRes.json();
          if (json.success && json.data) setCities(json.data);
        }
        if (featuredRes.ok) {
          const json = await featuredRes.json();
          if (json.success && json.data) setFeatured(json.data);
        }
      } catch (err) {
        console.warn('Error fetching discovery metadata:', err);
      }
    };
    fetchMetadata();
  }, []);

  // Main Discovery Query Fetcher
  const fetchDiscoveryResults = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', currentPage.toString());
      params.set('limit', '12');
      params.set('sortBy', sortBy);

      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      if (selectedCity.trim()) params.set('city', selectedCity.trim());
      if (selectedType !== 'ALL') params.set('propertyType', selectedType);
      if (minRent) params.set('minRent', minRent);
      if (maxRent) params.set('maxRent', maxRent);
      if (availableOnly) params.set('availableOnly', 'true');
      if (selectedFurnishing) params.set('furnishingStatus', selectedFurnishing);

      if (selectedSharingTypes.length > 0) {
        params.set('sharingTypes', selectedSharingTypes.join(','));
      }
      if (selectedUnitTypes.length > 0) {
        params.set('unitTypes', selectedUnitTypes.join(','));
      }
      if (selectedAmenities.length > 0) {
        params.set('amenities', selectedAmenities.join(','));
      }

      if (userCoords) {
        params.set('latitude', userCoords.lat.toString());
        params.set('longitude', userCoords.lng.toString());
        params.set('radiusKm', geoRadius.toString());
      }

      const res = await fetch(`${API_BASE}/discovery?${params.toString()}`);
      if (res.ok) {
        const json: ApiResponse<PropertyDiscoveryDto[]> = await res.json();
        if (json.success && json.data) {
          setProperties(json.data);
          if (json.meta) {
            setTotalPages(json.meta.totalPages || 1);
            setTotalCount(json.meta.total || 0);
          }
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson?.error?.message || errJson?.message || 'Failed to fetch discovery results');
      }
    } catch {
      setError('Unable to reach PropertyOS discovery service. Please check your network connection.');
    } finally {
      setIsLoading(false);
    }
  }, [
    currentPage,
    sortBy,
    searchTerm,
    selectedCity,
    selectedType,
    minRent,
    maxRent,
    availableOnly,
    selectedFurnishing,
    selectedSharingTypes,
    selectedUnitTypes,
    selectedAmenities,
    userCoords,
    geoRadius,
  ]);

  useEffect(() => {
    fetchDiscoveryResults();
  }, [fetchDiscoveryResults]);

  // Request Browser Geolocation
  const handleNearMeClick = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setSortBy(DiscoverySortBy.DISTANCE_ASC);
        setCurrentPage(1);
        setIsLocating(false);
      },
      (err) => {
        alert('Could not retrieve your location: ' + err.message);
        setIsLocating(false);
      },
      { timeout: 10000 }
    );
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedCity('');
    setSelectedType('ALL');
    setMinRent('');
    setMaxRent('');
    setSelectedSharingTypes([]);
    setSelectedUnitTypes([]);
    setSelectedFurnishing('');
    setSelectedAmenities([]);
    setAvailableOnly(false);
    setUserCoords(null);
    setSortBy(DiscoverySortBy.NEWEST);
    setCurrentPage(1);
  };

  const toggleAmenity = (name: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name]
    );
    setCurrentPage(1);
  };

  const toggleSharingType = (type: RoomSharingType) => {
    setSelectedSharingTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
    setCurrentPage(1);
  };

  const toggleUnitType = (unit: string) => {
    setSelectedUnitTypes((prev) =>
      prev.includes(unit) ? prev.filter((u) => u !== unit) : [...prev, unit]
    );
    setCurrentPage(1);
  };

  const activeFiltersCount =
    (selectedCity ? 1 : 0) +
    (selectedType !== 'ALL' ? 1 : 0) +
    (minRent || maxRent ? 1 : 0) +
    selectedSharingTypes.length +
    selectedUnitTypes.length +
    (selectedFurnishing ? 1 : 0) +
    selectedAmenities.length +
    (availableOnly ? 1 : 0) +
    (userCoords ? 1 : 0);

  return (
    <AppShell>
      <div className="space-y-8 pb-16">
        {/* ========================================================================= */}
        {/* 1. HERO SEARCH HEADER */}
        {/* ========================================================================= */}
        <div className="relative rounded-2xl bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 p-6 md:p-10 text-white shadow-xl overflow-hidden border border-indigo-800/40">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 -mb-12 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-semibold tracking-wide">
              <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
              <span>Omnichannel Property Discovery</span>
            </div>
            <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-white leading-tight">
              Find Verified PG, Co-Living & Rental Homes Across India
            </h1>
            <p className="text-slate-300 text-sm md:text-base leading-relaxed">
              Explore real-time vacancies, transparent pricing, and comprehensive room and unit inventory with instant host connectivity.
            </p>
          </div>

          {/* Search Bar & Primary Filters */}
          <div className="relative z-10 mt-6 pt-4 border-t border-indigo-800/50">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/15">
              {/* Keyword Search */}
              <div className="md:col-span-5 relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input
                  type="text"
                  placeholder="Search by property, locality, or landmark..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              {/* City Selector */}
              <div className="md:col-span-3 relative">
                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
                <select
                  value={selectedCity}
                  onChange={(e) => {
                    setSelectedCity(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-10 pr-8 py-2.5 bg-slate-900/80 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-400 appearance-none"
                >
                  <option value="">All Cities in India</option>
                  {cities.map((c) => (
                    <option key={c.city} value={c.city}>
                      {c.city} ({c.activePropertiesCount} active)
                    </option>
                  ))}
                </select>
              </div>

              {/* Property Type Tabs */}
              <div className="md:col-span-4 flex items-center gap-2">
                <div className="flex bg-slate-900/90 p-1 rounded-lg border border-slate-700 w-full text-xs font-medium">
                  <button
                    onClick={() => { setSelectedType('ALL'); setCurrentPage(1); }}
                    className={`flex-1 py-1.5 rounded-md transition-colors ${
                      selectedType === 'ALL' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => { setSelectedType(PropertyType.PG); setCurrentPage(1); }}
                    className={`flex-1 py-1.5 rounded-md transition-colors ${
                      selectedType === PropertyType.PG ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    PG / Hostel
                  </button>
                  <button
                    onClick={() => { setSelectedType(PropertyType.RENTAL_HOUSE); setCurrentPage(1); }}
                    className={`flex-1 py-1.5 rounded-md transition-colors ${
                      selectedType === PropertyType.RENTAL_HOUSE ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Rentals
                  </button>
                </div>

                {/* Near Me Button */}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleNearMeClick}
                  disabled={isLocating}
                  className="whitespace-nowrap px-3 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-400/30"
                  title="Find properties within 10km of current location"
                >
                  <Navigation className={`w-3.5 h-3.5 mr-1.5 ${isLocating ? 'animate-spin' : ''}`} />
                  {userCoords ? 'Near Me' : 'Near Me'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. CONTROLS, QUICK FILTERS & STATS */}
        {/* ========================================================================= */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Drawer Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFilterDrawerOpen(!isFilterDrawerOpen)}
              className="relative text-xs font-semibold"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
              Advanced Filters
              {activeFiltersCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 bg-indigo-600 text-white rounded-full text-[10px] font-bold">
                  {activeFiltersCount}
                </span>
              )}
            </Button>

            {/* Available Only Toggle */}
            <button
              onClick={() => {
                setAvailableOnly(!availableOnly);
                setCurrentPage(1);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                availableOnly
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${availableOnly ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              Available Only
            </button>

            {/* Quick Sharing Type Filter (when PG or ALL) */}
            {(selectedType === 'ALL' || selectedType === PropertyType.PG) && (
              <div className="hidden lg:flex items-center gap-1">
                {[
                  { label: 'Single', value: RoomSharingType.SINGLE },
                  { label: 'Double', value: RoomSharingType.DOUBLE },
                  { label: 'Triple', value: RoomSharingType.TRIPLE },
                ].map((s) => (
                  <button
                    key={s.value}
                    onClick={() => toggleSharingType(s.value)}
                    className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                      selectedSharingTypes.includes(s.value)
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}

            {/* Quick Unit Type Filter (when Rental or ALL) */}
            {(selectedType === 'ALL' || selectedType === PropertyType.RENTAL_HOUSE) && (
              <div className="hidden lg:flex items-center gap-1">
                {['1BHK', '2BHK', '3BHK'].map((u) => (
                  <button
                    key={u}
                    onClick={() => toggleUnitType(u)}
                    className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                      selectedUnitTypes.includes(u)
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            )}

            {activeFiltersCount > 0 && (
              <button
                onClick={handleResetFilters}
                className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 font-medium px-2 py-1"
              >
                Reset All
              </button>
            )}
          </div>

          {/* Results Summary & Sorting */}
          <div className="flex items-center justify-between md:justify-end gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span>
              Showing <strong className="text-slate-800 dark:text-white">{properties.length}</strong> of{' '}
              <strong className="text-slate-800 dark:text-white">{totalCount}</strong> verified properties
            </span>

            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as DiscoverySortBy);
                  setCurrentPage(1);
                }}
                className="bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value={DiscoverySortBy.NEWEST}>Newest First</option>
                <option value={DiscoverySortBy.RENT_ASC}>Rent: Low to High</option>
                <option value={DiscoverySortBy.RENT_DESC}>Rent: High to Low</option>
                <option value={DiscoverySortBy.NAME_ASC}>Name (A-Z)</option>
                {userCoords && <option value={DiscoverySortBy.DISTANCE_ASC}>Closest Distance</option>}
              </select>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. EXPANDABLE ADVANCED FILTERS PANEL */}
        {/* ========================================================================= */}
        {isFilterDrawerOpen && (
          <div className="bg-slate-50 dark:bg-slate-900/60 p-5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Refine Discovery Criteria</h3>
              <button
                onClick={() => setIsFilterDrawerOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Budget / Rent Range */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Monthly Rent (₹)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={minRent}
                    onChange={(e) => { setMinRent(e.target.value); setCurrentPage(1); }}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:ring-1 focus:ring-indigo-500"
                  />
                  <span className="text-slate-400 text-xs">-</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={maxRent}
                    onChange={(e) => { setMaxRent(e.target.value); setCurrentPage(1); }}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Furnishing Status */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Furnishing
                </label>
                <select
                  value={selectedFurnishing}
                  onChange={(e) => { setSelectedFurnishing(e.target.value); setCurrentPage(1); }}
                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Any Furnishing</option>
                  <option value="FULLY_FURNISHED">Fully Furnished</option>
                  <option value="SEMI_FURNISHED">Semi Furnished</option>
                  <option value="UNFURNISHED">Unfurnished</option>
                </select>
              </div>

              {/* Geo Search Radius */}
              {userCoords && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Radius: {geoRadius} km
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    step="1"
                    value={geoRadius}
                    onChange={(e) => { setGeoRadius(Number(e.target.value)); setCurrentPage(1); }}
                    className="w-full accent-indigo-600"
                  />
                </div>
              )}
            </div>

            {/* Amenities Checklist */}
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Required Amenities (Must include all selected)
              </label>
              <div className="flex flex-wrap gap-2">
                {COMMON_AMENITIES.map((amenity) => {
                  const isSelected = selectedAmenities.includes(amenity);
                  return (
                    <button
                      key={amenity}
                      onClick={() => toggleAmenity(amenity)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                      {amenity}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 4. RESULTS GRID & PROPERTY CARDS */}
        {/* ========================================================================= */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm animate-pulse"
              >
                <div className="h-48 bg-slate-200 dark:bg-slate-800" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
                  <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-full mt-4" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-10 text-center rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50">
            <h3 className="text-base font-bold text-rose-800 dark:text-rose-200">Error Loading Properties</h3>
            <p className="text-sm text-rose-600 dark:text-rose-400 mt-1">{error}</p>
            <Button variant="outline" size="sm" onClick={() => fetchDiscoveryResults()} className="mt-4">
              Try Again
            </Button>
          </div>
        ) : properties.length === 0 ? (
          <div className="p-12 text-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-800 dark:text-white">No Properties Matched Your Filters</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              We couldn’t find any active properties matching your exact search terms or budget. Try broadening your criteria or resetting filters.
            </p>
            <Button variant="outline" size="sm" onClick={handleResetFilters} className="mt-2">
              Reset All Filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map((property) => {
              const isPG = property.propertyType === PropertyType.PG;
              const primaryImage =
                property.images && property.images.length > 0
                  ? property.images[0]
                  : 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80';

              return (
                <div
                  key={property.id}
                  className="group flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-all hover:border-indigo-300 dark:hover:border-indigo-700"
                >
                  {/* Image & Badges */}
                  <div className="relative h-48 w-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <img
                      src={primaryImage}
                      alt={property.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Top Badges */}
                    <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase shadow-sm ${
                          isPG
                            ? 'bg-indigo-600 text-white'
                            : 'bg-emerald-600 text-white'
                        }`}
                      >
                        {isPG ? <BedDouble className="w-3 h-3" /> : <Home className="w-3 h-3" />}
                        {isPG ? 'PG / Hostel' : 'Rental House'}
                      </span>
                    </div>

                    {/* Availability Pill */}
                    <div className="absolute top-3 right-3">
                      {property.hasAvailability ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-500/90 backdrop-blur-md text-white shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          {isPG
                            ? `${property.availableCapacity} Bed${property.availableCapacity > 1 ? 's' : ''} Left`
                            : `${property.availableCapacity} Unit${property.availableCapacity > 1 ? 's' : ''} Left`}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-900/80 backdrop-blur-md text-slate-300">
                          Sold Out
                        </span>
                      )}
                    </div>

                    {/* Price Overlay */}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950/80 to-transparent p-3 pt-6">
                      <div className="text-white">
                        <span className="text-xs text-slate-300">Starting from</span>
                        <div className="text-lg font-black tracking-tight">
                          ₹{property.startingRent.toLocaleString('en-IN')}{' '}
                          <span className="text-xs font-normal text-slate-300">/ mo</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 p-4 space-y-3 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-slate-900 dark:text-white text-base group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                          {property.name}
                        </h3>
                      </div>

                      {/* Locality & Distance */}
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                          {property.locality ? `${property.locality}, ` : ''}{property.city}
                        </span>
                        {property.distanceKm !== null && property.distanceKm !== undefined && (
                          <span className="text-indigo-600 dark:text-indigo-400 font-semibold shrink-0">
                            • {property.distanceKm} km away
                          </span>
                        )}
                      </div>

                      {/* Room/Unit Badges */}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {isPG
                          ? property.availableSharingTypes.map((st) => (
                              <span
                                key={st}
                                className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-medium"
                              >
                                {st} Sharing
                              </span>
                            ))
                          : property.availableUnitTypes.map((ut) => (
                              <span
                                key={ut}
                                className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-medium"
                              >
                                {ut}
                              </span>
                            ))}
                      </div>
                    </div>

                    {/* Amenities Preview */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex flex-wrap gap-1.5 items-center text-[11px] text-slate-600 dark:text-slate-400">
                        {property.amenities.slice(0, 3).map((a) => (
                          <span
                            key={a.id}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700"
                          >
                            <ShieldCheck className="w-3 h-3 text-indigo-500" />
                            {a.name}
                          </span>
                        ))}
                        {property.amenities.length > 3 && (
                          <span className="text-[10px] text-slate-400">
                            +{property.amenities.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action */}
                    <div className="pt-2">
                      <Link href={`/discover/${property.id}`} className="w-full block">
                        <Button
                          variant="primary"
                          size="sm"
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs py-2 shadow-sm"
                        >
                          View Details & Availability
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 5. PAGINATION CONTROLS */}
        {/* ========================================================================= */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800 text-xs">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || isLoading}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>

            <span className="text-slate-600 dark:text-slate-400">
              Page <strong className="text-slate-900 dark:text-white">{currentPage}</strong> of{' '}
              <strong className="text-slate-900 dark:text-white">{totalPages}</strong>
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || isLoading}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
