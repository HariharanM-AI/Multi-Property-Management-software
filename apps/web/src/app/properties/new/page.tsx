'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth-context';
import {
  PropertyType,
  STANDARD_AMENITIES_CATALOG,
  CreatePropertyDto,
  ApiResponse,
  PropertyDto,
} from '@propertyos/types';
import {
  Building2,
  BedDouble,
  Home,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  MapPin,
  Sparkles,
  Info,
  AlertCircle,
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

export default function NewPropertyPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [step, setStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<CreatePropertyDto>({
    propertyType: PropertyType.PG,
    name: '',
    description: '',
    address: '',
    addressLine1: '',
    addressLine2: '',
    locality: '',
    city: 'Bengaluru',
    district: 'Bengaluru Urban',
    state: 'Karnataka',
    country: 'India',
    postalCode: '',
    latitude: undefined,
    longitude: undefined,
    contactPhone: '',
    contactEmail: '',
    amenityIds: ['wifi', 'power_backup', 'cctv', 'ro_water'],
  });



  const handleAmenityToggle = (amenityId: string) => {
    const current = formData.amenityIds || [];
    if (current.includes(amenityId)) {
      setFormData({ ...formData, amenityIds: current.filter((id) => id !== amenityId) });
    } else {
      setFormData({ ...formData, amenityIds: [...current, amenityId] });
    }
  };

  const handleNext = () => {
    setErrorMessage(null);

    // Validation per step
    if (step === 2) {
      if (!formData.name.trim() || formData.name.trim().length < 2) {
        setErrorMessage('Property name must be at least 2 characters.');
        return;
      }
      if (formData.contactPhone && !/^[6-9]\d{9}$/.test(formData.contactPhone.trim())) {
        setErrorMessage('Contact phone must be a valid 10-digit Indian mobile number.');
        return;
      }
    }

    if (step === 3) {
      if (!formData.address.trim()) {
        setErrorMessage('Street address is required.');
        return;
      }
      if (!formData.city.trim()) {
        setErrorMessage('City is required.');
        return;
      }
      if (!formData.state.trim()) {
        setErrorMessage('State is required.');
        return;
      }
      if (!/^[1-9][0-9]{5}$/.test(formData.postalCode.trim())) {
        setErrorMessage('Please enter a valid 6-digit Indian PIN code (e.g. 560102).');
        return;
      }
    }

    setStep((s) => Math.min(5, s + 1));
  };

  const handlePrevious = () => {
    setErrorMessage(null);
    setStep((s) => Math.max(1, s - 1));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload: CreatePropertyDto = {
        ...formData,
        name: formData.name.trim(),
        address: formData.address.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        postalCode: formData.postalCode.trim(),
        contactPhone: formData.contactPhone?.trim() || undefined,
        contactEmail: formData.contactEmail?.trim() || undefined,
        latitude: formData.latitude ? Number(formData.latitude) : undefined,
        longitude: formData.longitude ? Number(formData.longitude) : undefined,
      };

      const res = await fetch(`${API_BASE}/properties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const json: ApiResponse<PropertyDto> = await res.json();

      if (res.ok && json.success && json.data) {
        router.push(`/properties/${json.data.id}`);
      } else {
        const errorDetail = json.error?.details?.[0]?.message;
        setErrorMessage(errorDetail || json.error?.message || 'Failed to create property.');
      }
    } catch {
      setErrorMessage('Network error while creating property.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepsList = [
    { num: 1, title: 'Operating Model' },
    { num: 2, title: 'Basic Info' },
    { num: 3, title: 'Location' },
    { num: 4, title: 'Amenities' },
    { num: 5, title: 'Review & Confirm' },
  ];

  return (
    <AppShell activePath="/properties">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-surface-textSecondary">
          <Link href="/properties" className="hover:text-brand-navy font-medium">
            Properties
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-brand-navy font-semibold">New Property</span>
        </div>

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-brand-navy tracking-tight">Add New Property</h1>
          <p className="text-xs text-surface-textSecondary mt-1">
            Register a residential property under your organization with dual operating model support.
          </p>
        </div>

        {/* Step Indicator */}
        <div className="bg-brand-white p-4 rounded-xl border border-surface-border shadow-sm">
          <div className="flex items-center justify-between">
            {stepsList.map((s, index) => (
              <React.Fragment key={s.num}>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      step === s.num
                        ? 'bg-brand-teal text-brand-white shadow-sm'
                        : step > s.num
                        ? 'bg-teal-50 text-brand-teal border border-teal-200'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {step > s.num ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                  </div>
                  <span
                    className={`text-xs font-semibold hidden sm:inline ${
                      step === s.num ? 'text-brand-navy' : 'text-surface-textSecondary'
                    }`}
                  >
                    {s.title}
                  </span>
                </div>
                {index < stepsList.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 hidden sm:block ${
                      step > s.num ? 'bg-brand-teal' : 'bg-slate-200'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-300 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-brand-navy shrink-0 mt-0.5" />
            <div className="text-xs text-brand-navy leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {/* Step Form Container */}
        <div className="bg-brand-white rounded-2xl border border-surface-border p-8 shadow-sm">
          {/* STEP 1: OPERATING MODEL */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-brand-navy">Select Operating Model</h2>
                <p className="text-xs text-surface-textSecondary mt-1">
                  How will this property be managed? The operating model is immutable after creation.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* PG / Co-Living Option */}
                <div
                  onClick={() => setFormData({ ...formData, propertyType: PropertyType.PG })}
                  className={`p-6 rounded-2xl border-2 cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                    formData.propertyType === PropertyType.PG
                      ? 'border-brand-teal bg-teal-50/20 shadow-md ring-1 ring-brand-teal'
                      : 'border-surface-border hover:border-slate-300 bg-brand-white'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-200 text-brand-teal flex items-center justify-center">
                      <BedDouble className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-bold text-brand-navy">PG / Co-Living / Hostel</h3>
                        {formData.propertyType === PropertyType.PG && (
                          <CheckCircle2 className="w-5 h-5 text-brand-teal" />
                        )}
                      </div>
                      <p className="text-xs text-surface-textSecondary mt-2 leading-relaxed">
                        Best for shared accommodation, student hostels, and co-living facilities with per-bed pricing.
                      </p>
                    </div>
                    <ul className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-700">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                        Room- & bed-level inventory & sharing
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                        Meal plan & mess management support
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                        Sub-metered electricity bill splitting
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Whole-Unit Rental Option */}
                <div
                  onClick={() => setFormData({ ...formData, propertyType: PropertyType.RENTAL_HOUSE })}
                  className={`p-6 rounded-2xl border-2 cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                    formData.propertyType === PropertyType.RENTAL_HOUSE
                      ? 'border-blue-600 bg-blue-50/20 shadow-md ring-1 ring-blue-600'
                      : 'border-surface-border hover:border-slate-300 bg-brand-white'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
                      <Home className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-bold text-brand-navy">Whole-Unit Rental House</h3>
                        {formData.propertyType === PropertyType.RENTAL_HOUSE && (
                          <CheckCircle2 className="w-5 h-5 text-blue-600" />
                        )}
                      </div>
                      <p className="text-xs text-surface-textSecondary mt-2 leading-relaxed">
                        Best for apartments, flats, independent villas, and commercial rental houses leased as full units.
                      </p>
                    </div>
                    <ul className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-700">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        Unit-level leasing (1BHK, 2BHK, Villa)
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        Security deposit & deduction tracking
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        Annual rent escalation schedules
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5 text-xs text-slate-600">
                <Info className="w-4 h-4 text-brand-navy shrink-0 mt-0.5" />
                <span>
                  <strong>Immutable Model Notice:</strong> Once created, property operating model cannot be altered
                  arbitrarily to maintain data integrity across future room/unit inventories.
                </span>
              </div>
            </div>
          )}

          {/* STEP 2: BASIC INFO */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-brand-navy">Basic Information</h2>
                <p className="text-xs text-surface-textSecondary mt-1">
                  Specify display name, description, and primary property manager contact.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-brand-navy">
                    Property Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. GreenGlen PG Residency or Indiranagar Heights"
                    className="mt-1 block w-full px-3.5 py-2.5 bg-brand-white border border-surface-border rounded-lg text-sm text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-brand-navy">Description</label>
                  <textarea
                    rows={3}
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of the property, landmarks, or target audience..."
                    className="mt-1 block w-full px-3.5 py-2 bg-brand-white border border-surface-border rounded-lg text-sm text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-brand-navy">
                      Manager Contact Phone
                    </label>
                    <input
                      type="text"
                      value={formData.contactPhone || ''}
                      onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                      placeholder="e.g. 9845012345 (10 digits)"
                      className="mt-1 block w-full px-3.5 py-2.5 bg-brand-white border border-surface-border rounded-lg text-sm text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-brand-navy">
                      Manager Contact Email
                    </label>
                    <input
                      type="email"
                      value={formData.contactEmail || ''}
                      onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                      placeholder="e.g. manager@property.in"
                      className="mt-1 block w-full px-3.5 py-2.5 bg-brand-white border border-surface-border rounded-lg text-sm text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: LOCATION */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-brand-navy">Location & Coordinates</h2>
                <p className="text-xs text-surface-textSecondary mt-1">
                  Specify street address, locality, city, and optional GPS coordinates.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-brand-navy">
                    Street Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="e.g. #42, 14th Main Road, Sector 4"
                    className="mt-1 block w-full px-3.5 py-2.5 bg-brand-white border border-surface-border rounded-lg text-sm text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-brand-navy">Locality / Area</label>
                    <input
                      type="text"
                      value={formData.locality || ''}
                      onChange={(e) => setFormData({ ...formData, locality: e.target.value })}
                      placeholder="e.g. HSR Layout or Koramangala"
                      className="mt-1 block w-full px-3.5 py-2.5 bg-brand-white border border-surface-border rounded-lg text-sm text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-brand-navy">
                      PIN Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.postalCode}
                      onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                      placeholder="e.g. 560102"
                      className="mt-1 block w-full px-3.5 py-2.5 bg-brand-white border border-surface-border rounded-lg text-sm text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-brand-navy">
                      City <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="Bengaluru"
                      className="mt-1 block w-full px-3.5 py-2.5 bg-brand-white border border-surface-border rounded-lg text-sm text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-brand-navy">
                      State <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      placeholder="Karnataka"
                      className="mt-1 block w-full px-3.5 py-2.5 bg-brand-white border border-surface-border rounded-lg text-sm text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-brand-navy">
                      Latitude (-90 to 90)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formData.latitude ?? ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          latitude: e.target.value ? parseFloat(e.target.value) : undefined,
                        })
                      }
                      placeholder="12.9116"
                      className="mt-1 block w-full px-3.5 py-2.5 bg-brand-white border border-surface-border rounded-lg text-sm text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-brand-navy">
                      Longitude (-180 to 180)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formData.longitude ?? ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          longitude: e.target.value ? parseFloat(e.target.value) : undefined,
                        })
                      }
                      placeholder="77.6389"
                      className="mt-1 block w-full px-3.5 py-2.5 bg-brand-white border border-surface-border rounded-lg text-sm text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: AMENITIES */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-brand-navy">Property Amenities</h2>
                <p className="text-xs text-surface-textSecondary mt-1">
                  Select available utilities, facilities, and services at this property.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {STANDARD_AMENITIES_CATALOG.map((amenity) => {
                  const isSelected = formData.amenityIds?.includes(amenity.id);
                  const Icon = ICON_MAP[amenity.icon] || Sparkles;

                  return (
                    <div
                      key={amenity.id}
                      onClick={() => handleAmenityToggle(amenity.id)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all duration-150 flex flex-col justify-between ${
                        isSelected
                          ? 'border-brand-teal bg-teal-50/40 text-brand-navy shadow-sm'
                          : 'border-surface-border hover:border-slate-300 bg-brand-white text-surface-textSecondary'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Icon
                          className={`w-5 h-5 ${isSelected ? 'text-brand-teal' : 'text-slate-400'}`}
                        />
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-brand-teal" />}
                      </div>
                      <div className="mt-3">
                        <p className="text-xs font-semibold leading-snug">{amenity.name}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{amenity.category}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 5: REVIEW & SUBMIT */}
          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-brand-navy">Review & Confirm</h2>
                <p className="text-xs text-surface-textSecondary mt-1">
                  Verify your property configuration before creating the record.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-surface-subtle border border-surface-border space-y-4 text-xs">
                <div className="flex items-center justify-between pb-3 border-b border-surface-border">
                  <span className="text-surface-textSecondary">Operating Model</span>
                  <span
                    className={`font-bold px-2.5 py-0.5 rounded-full border ${
                      formData.propertyType === PropertyType.PG
                        ? 'bg-teal-50 text-brand-teal border-teal-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}
                  >
                    {formData.propertyType === PropertyType.PG
                      ? 'PG / Co-Living'
                      : 'Whole-Unit Rental'}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-3 border-b border-surface-border">
                  <span className="text-surface-textSecondary">Property Name</span>
                  <strong className="text-brand-navy font-bold text-sm">{formData.name}</strong>
                </div>

                <div className="flex items-center justify-between pb-3 border-b border-surface-border">
                  <span className="text-surface-textSecondary">Location</span>
                  <span className="text-brand-navy font-medium text-right max-w-xs">
                    {formData.address}, {formData.locality ? `${formData.locality}, ` : ''}
                    {formData.city}, {formData.state} — {formData.postalCode}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-3 border-b border-surface-border">
                  <span className="text-surface-textSecondary">Contact</span>
                  <span className="text-brand-navy font-medium">
                    {formData.contactPhone || 'Not specified'} | {formData.contactEmail || 'Not specified'}
                  </span>
                </div>

                <div className="flex items-start justify-between">
                  <span className="text-surface-textSecondary">Selected Amenities</span>
                  <span className="text-brand-navy font-semibold text-right">
                    {formData.amenityIds?.length || 0} amenities configured
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-teal-50/50 border border-teal-200 text-xs text-brand-teal flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 text-brand-teal" />
                <span>
                  A unique concurrency-safe property reference code (e.g. <strong>PROP-000001</strong>) will be
                  automatically assigned.
                </span>
              </div>
            </div>
          )}

          {/* Wizard Action Controls */}
          <div className="mt-8 pt-6 border-t border-surface-border flex items-center justify-between">
            {step > 1 ? (
              <Button variant="outline" size="md" onClick={handlePrevious} disabled={isSubmitting}>
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
            ) : (
              <Link href="/properties">
                <Button variant="outline" size="md">
                  Cancel
                </Button>
              </Link>
            )}

            {step < 5 ? (
              <Button variant="primary" size="md" onClick={handleNext} className="gap-1 font-semibold">
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                onClick={handleSubmit}
                isLoading={isSubmitting}
                className="gap-2 font-semibold shadow-sm"
              >
                <Building2 className="w-4 h-4" />
                Create Property
              </Button>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
