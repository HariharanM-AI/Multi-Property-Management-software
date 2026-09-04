'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import {
  PropertyDiscoveryDetailDto,
  PropertyType,
  ApiResponse,
} from '@propertyos/types';
import {
  Building2,
  MapPin,
  BedDouble,
  Home,
  ShieldCheck,
  Phone,
  Mail,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  Share2,
  Calendar,
  Sparkles,
  Info,
  Maximize2,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

import { getCleanPropertyDescription } from '@/lib/propertyUtils';

export default function PropertyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [property, setProperty] = useState<PropertyDiscoveryDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchDetail = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(`${API_BASE}/discovery/${id}`);
        if (res.ok) {
          const json: ApiResponse<PropertyDiscoveryDetailDto> = await res.json();
          if (json.success && json.data) {
            setProperty(json.data);
            if (json.data.images && json.data.images.length > 0) {
              setSelectedImage(json.data.images[0]);
            }
          }
        } else if (res.status === 404) {
          setError('This property is not available or is no longer listed for public discovery.');
        } else {
          setError('Failed to load property details. Please try again.');
        }
      } catch {
        setError('Network error while retrieving property information.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetail();
  }, [id]);

  if (isLoading) {
    return (
      <AppShell>
        <div className="max-w-6xl mx-auto space-y-6 pb-16 animate-pulse">
          <div className="h-6 bg-slate-200 dark:bg-slate-800 w-1/4 rounded" />
          <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 h-64 bg-slate-200 dark:bg-slate-800 rounded-xl" />
            <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !property) {
    return (
      <AppShell>
        <div className="max-w-xl mx-auto my-16 p-10 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <Building2 className="w-14 h-14 text-slate-300 dark:text-slate-600 mx-auto" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Property Not Available</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{error || 'Property not found.'}</p>
          <Link href="/discover" className="inline-block mt-4">
            <Button variant="primary" size="md">
              <ChevronLeft className="w-4 h-4 mr-1.5" />
              Back to Discovery
            </Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  const isPG = property.propertyType === PropertyType.PG;
  const allImages = property.images && property.images.length > 0
    ? property.images
    : ['https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1200&q=80'];

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-8 pb-20">
        {/* ========================================================================= */}
        {/* 1. BREADCRUMB NAVIGATION */}
        {/* ========================================================================= */}
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Link href="/discover" className="hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1">
            <ChevronLeft className="w-3.5 h-3.5" />
            All Properties
          </Link>
          <span>/</span>
          <span>{property.city}</span>
          {property.locality && (
            <>
              <span>/</span>
              <span>{property.locality}</span>
            </>
          )}
          <span>/</span>
          <span className="text-slate-900 dark:text-white font-medium truncate">{property.name}</span>
        </div>

        {/* ========================================================================= */}
        {/* 2. PHOTO GALLERY & HERO */}
        {/* ========================================================================= */}
        <div className="space-y-3">
          <div className="relative h-80 md:h-[420px] w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md">
            <img
              src={selectedImage || allImages[0]}
              alt={property.name}
              className="w-full h-full object-cover"
            />

            {/* Badges Over Hero */}
            <div className="absolute top-4 left-4 flex flex-wrap gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider shadow-lg ${
                  isPG ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white'
                }`}
              >
                {isPG ? <BedDouble className="w-3.5 h-3.5" /> : <Home className="w-3.5 h-3.5" />}
                {isPG ? 'PG / Hostel Facility' : 'Whole-Unit Rental'}
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900/80 backdrop-blur-md text-white border border-white/20">
                Code: {property.code}
              </span>
            </div>

            <div className="absolute top-4 right-4">
              {property.hasAvailability ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-white shadow-lg">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  {isPG
                    ? `${property.availableCapacity} Bed${property.availableCapacity > 1 ? 's' : ''} Available`
                    : `${property.availableCapacity} Unit${property.availableCapacity > 1 ? 's' : ''} Available`}
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 text-white shadow-lg">
                  Fully Occupied
                </span>
              )}
            </div>
          </div>

          {/* Thumbnail Gallery Strip */}
          {allImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {allImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(img)}
                  className={`relative h-20 w-28 shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                    selectedImage === img
                      ? 'border-indigo-600 ring-2 ring-indigo-600/30'
                      : 'border-slate-200 dark:border-slate-800 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 3. MAIN CONTENT GRID (2 COLUMNS) */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Details & Inventory */}
          <div className="lg:col-span-2 space-y-8">
            {/* Title & Basic Info */}
            <div className="space-y-2">
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {property.name}
              </h1>
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <MapPin className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  {property.address}, {property.locality ? `${property.locality}, ` : ''}{property.city},{' '}
                  {property.state} — {property.postalCode}
                </span>
              </div>
              <div className="text-xs text-slate-500 pt-1">
                Managed by <strong className="text-slate-800 dark:text-slate-200">{property.organizationName}</strong>
              </div>
            </div>

            {/* Description */}
            {getCleanPropertyDescription(property.description) && (
              <div className="space-y-2 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">About the Property</h3>
                <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {getCleanPropertyDescription(property.description)}
                </p>
              </div>
            )}

            {/* Amenities Grid */}
            <div className="space-y-3 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                Verified Amenities & Facilities
              </h3>
              {property.amenities.length === 0 ? (
                <p className="text-xs text-slate-400">Standard residential facilities available on request.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                  {property.amenities.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200"
                    >
                      <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>{a.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ===================================================================== */}
            {/* LIVE INVENTORY BREAKDOWN */}
            {/* ===================================================================== */}
            <div className="space-y-4 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  {isPG ? <BedDouble className="w-4 h-4 text-indigo-600" /> : <Home className="w-4 h-4 text-emerald-600" />}
                  {isPG ? 'Available Rooms & Bed Sharing' : 'Available Whole-Unit Flats & Villas'}
                </h3>
                <span className="text-xs text-slate-500 font-medium">
                  {property.availableCapacity} of {property.totalCapacity} available
                </span>
              </div>

              {isPG ? (
                // PG Rooms & Beds Breakdown
                <div className="space-y-3">
                  {!property.availableRooms || property.availableRooms.length === 0 ? (
                    <p className="text-xs text-slate-400 p-4 text-center bg-slate-50 dark:bg-slate-800 rounded-lg">
                      No room inventory currently available.
                    </p>
                  ) : (
                    property.availableRooms.map((room) => (
                      <div
                        key={room.id}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-bold text-slate-900 dark:text-white">
                              Room {room.roomNumber}{' '}
                              {room.floorNumber !== null && (
                                <span className="text-xs text-slate-400 font-normal">
                                  (Floor {room.floorNumber})
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500">
                              {room.sharingType} Sharing • Base ₹{room.baseRent.toLocaleString('en-IN')}/mo
                            </div>
                          </div>
                          <div>
                            {room.availableBedsCount > 0 ? (
                              <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                {room.availableBedsCount} Bed{room.availableBedsCount > 1 ? 's' : ''} Vacant
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                Room Full
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Bed Pill Roster */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-200 dark:border-slate-700">
                          {room.beds.map((b) => {
                            const isAvail = b.status === 'AVAILABLE';
                            return (
                              <div
                                key={b.id}
                                className={`p-2 rounded-lg border text-xs flex items-center justify-between ${
                                  isAvail
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-200 font-semibold'
                                    : 'bg-slate-100 border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500'
                                }`}
                              >
                                <span>Bed {b.bedNumber}</span>
                                <span>₹{b.monthlyRent.toLocaleString('en-IN')}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                // Whole-Unit Rental Breakdown
                <div className="space-y-3">
                  {!property.availableUnits || property.availableUnits.length === 0 ? (
                    <p className="text-xs text-slate-400 p-4 text-center bg-slate-50 dark:bg-slate-800 rounded-lg">
                      No rental units currently listed.
                    </p>
                  ) : (
                    property.availableUnits.map((unit) => {
                      const isAvail = unit.status === 'AVAILABLE';
                      return (
                        <div
                          key={unit.id}
                          className={`p-4 rounded-xl border space-y-2 ${
                            isAvail
                              ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                              : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 opacity-60'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-bold text-slate-900 dark:text-white">
                                {unit.unitNumber} ({unit.unitType})
                              </div>
                              <div className="text-xs text-slate-500">
                                {unit.furnishingStatus.replace('_', ' ')}
                                {unit.superBuiltupAreaSqFt ? ` • ${unit.superBuiltupAreaSqFt} sq.ft` : ''}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-base font-black text-slate-900 dark:text-white">
                                ₹{unit.monthlyRent.toLocaleString('en-IN')}{' '}
                                <span className="text-xs font-normal text-slate-400">/mo</span>
                              </div>
                              <div className="text-[10px] text-slate-400">
                                Deposit: ₹{unit.securityDeposit.toLocaleString('en-IN')}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Sticky Contact & Booking Card */}
          <div className="space-y-6">
            <div className="sticky top-6 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg space-y-6">
              {/* Pricing Header */}
              <div className="space-y-1 pb-4 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Starting Rent
                </span>
                <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  ₹{property.startingRent.toLocaleString('en-IN')}{' '}
                  <span className="text-sm font-normal text-slate-400">/ month</span>
                </div>
                {property.maxRent > property.startingRent && (
                  <p className="text-xs text-slate-500">
                    Pricing ranges up to ₹{property.maxRent.toLocaleString('en-IN')} depending on inventory type.
                  </p>
                )}
              </div>

              {/* Verified Host Assurance */}
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 text-xs text-indigo-900 dark:text-indigo-200">
                <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Verified PropertyOS Operator</div>
                  <div className="text-[11px] text-indigo-700 dark:text-indigo-300 mt-0.5">
                    Direct rental agreement with verified lease parameters and double-entry accounting.
                  </div>
                </div>
              </div>

              {/* CTAs */}
              <div className="space-y-3">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => setShowContactModal(true)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 text-sm shadow-md"
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Contact Host / Schedule Visit
                </Button>

                {property.contactPhone && (
                  <a
                    href={`tel:${property.contactPhone}`}
                    className="w-full block"
                  >
                    <Button
                      variant="outline"
                      size="md"
                      className="w-full text-xs font-semibold"
                    >
                      Call Host: {property.contactPhone}
                    </Button>
                  </a>
                )}
              </div>

              {/* Address Quick Card */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 space-y-1">
                <div className="font-semibold text-slate-700 dark:text-slate-300">Property Location:</div>
                <div>{property.address}</div>
                <div>{property.city}, {property.state} — {property.postalCode}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. CONTACT INQUIRY MODAL */}
        {/* ========================================================================= */}
        {showContactModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Host Contact Information</h3>
                <button
                  onClick={() => setShowContactModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg space-y-1">
                  <div className="text-xs text-slate-400">Property Management Operator</div>
                  <div className="font-bold text-slate-900 dark:text-white">{property.organizationName}</div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <Phone className="w-5 h-5 text-indigo-600" />
                  <div>
                    <div className="text-xs text-slate-400">Phone Number</div>
                    <div className="font-semibold">{property.contactPhone || 'Available upon formal inquiry'}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <Mail className="w-5 h-5 text-indigo-600" />
                  <div>
                    <div className="text-xs text-slate-400">Email Address</div>
                    <div className="font-semibold">{property.contactEmail || 'inquiry@propertyos.in'}</div>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setShowContactModal(false)}
                  className="w-full"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
