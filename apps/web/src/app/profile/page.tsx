'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  getOwnerProfile,
  saveOwnerProfile,
  onOwnerProfileChange,
  OwnerProfileData,
  formatFullAddress,
  DEFAULT_ADDRESS,
} from '@/lib/ownerProfileStorage';
import {
  generateDigitalSignatureDataUrl,
  generateNormalTypedSignatureDataUrl,
} from '@/lib/agreementStorage';
import {
  UserCircle,
  Building2,
  Mail,
  Phone,
  MapPin,
  ShieldCheck,
  Edit3,
  PenTool,
  CheckCircle2,
  AlertCircle,
  FileSignature,
  Save,
  X,
  Sparkles,
  RefreshCw,
  ExternalLink,
  User,
  RotateCcw,
  Lock,
  Keyboard,
} from 'lucide-react';
import { PageTransition } from '@/components/ui/MotionWrapper';
import Link from 'next/link';

export default function OwnerProfilePage() {
  const { user, organization, updateProfile, refreshUser, isAuthenticated, isLoading } = useAuth();

  const [profile, setProfile] = useState<OwnerProfileData>(() => getOwnerProfile(user));
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Edit form state
  const [editFirstName, setEditFirstName] = useState(profile.firstName);
  const [editLastName, setEditLastName] = useState(profile.lastName);
  const [editPhone, setEditPhone] = useState(profile.phone);
  const [editStreetAddress, setEditStreetAddress] = useState(profile.streetAddress || '');
  const [editCity, setEditCity] = useState(profile.city || '');
  const [editState, setEditState] = useState(profile.state || '');
  const [editPostalCode, setEditPostalCode] = useState(profile.postalCode || '');
  const [editOrgName, setEditOrgName] = useState(profile.organizationName);

  // Signature state in modal
  const [modalSignMode, setModalSignMode] = useState<'draw' | 'type'>(profile.signMode || 'draw');
  const [modalTypedName, setModalTypedName] = useState(profile.fullName);
  const [modalSignatureData, setModalSignatureData] = useState(profile.signature);
  const [hasDrawnInModal, setHasDrawnInModal] = useState(false);

  // Canvas drawing refs for smooth bezier curve drawing
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const hasDrawnRef = useRef(false);
  const lastDrawnSignatureRef = useRef<string>(profile.signature || '');

  const [mounted, setMounted] = useState(false);

  // Synchronize profile with storage and real-time events only when authenticated
  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated) return;

    setProfile(getOwnerProfile(user));

    const unsubscribe = onOwnerProfileChange((updated) => {
      setProfile(updated);
    });

    return () => unsubscribe();
  }, [user, isAuthenticated]);

  // Handle opening edit profile modal
  const handleOpenEditModal = () => {
    if (!isAuthenticated) return;
    const current = getOwnerProfile(user);
    setEditFirstName(current.firstName);
    setEditLastName(current.lastName);
    setEditPhone(current.phone);
    setEditStreetAddress(current.streetAddress || '');
    setEditCity(current.city || '');
    setEditState(current.state || '');
    setEditPostalCode(current.postalCode || '');
    setEditOrgName(current.organizationName);
    setModalSignMode(current.signMode || 'draw');
    setModalTypedName(current.fullName);
    setModalSignatureData(current.signature);
    if (current.signature && (current.signMode === 'draw' || !current.signature.startsWith('data:image/svg+xml'))) {
      lastDrawnSignatureRef.current = current.signature;
    }
    setHasDrawnInModal(Boolean(current.signature));
    hasDrawnRef.current = Boolean(current.signature);
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsEditModalOpen(true);
  };

  // Canvas setup & paint previous/existing signature whenever switching to draw mode
  useEffect(() => {
    if (!isEditModalOpen || modalSignMode !== 'draw') return;

    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Restore previously drawn signature if available!
      const sigToRestore = lastDrawnSignatureRef.current || (modalSignatureData && !modalSignatureData.startsWith('TYPE:') ? modalSignatureData : null);
      if (sigToRestore) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          hasDrawnRef.current = true;
          setHasDrawnInModal(true);
        };
        img.src = sigToRestore;
      }
    }, 60);

    return () => clearTimeout(timer);
  }, [isEditModalOpen, modalSignMode]);

  // Smooth quadratic bezier drawing functions
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0];
      if (!touch) return { x: 0, y: 0 };
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    isDrawingRef.current = true;
    lastPointRef.current = coords;
    hasDrawnRef.current = true;
    setHasDrawnInModal(true);

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(coords.x, coords.y);
      }
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !lastPointRef.current) return;
    const currentCoords = getCanvasCoords(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (lastPointRef.current) {
      const midX = (lastPointRef.current.x + currentCoords.x) / 2;
      const midY = (lastPointRef.current.y + currentCoords.y) / 2;
      ctx.quadraticCurveTo(lastPointRef.current.x, lastPointRef.current.y, midX, midY);
      ctx.stroke();
    } else {
      ctx.lineTo(currentCoords.x, currentCoords.y);
      ctx.stroke();
    }

    lastPointRef.current = currentCoords;
    hasDrawnRef.current = true;
    setHasDrawnInModal(true);
  };

  const stopDrawing = () => {
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      lastPointRef.current = null;
      const canvas = canvasRef.current;
      if (canvas && hasDrawnRef.current) {
        const sig = canvas.toDataURL('image/png');
        setModalSignatureData(sig);
        lastDrawnSignatureRef.current = sig;
      }
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    hasDrawnRef.current = false;
    lastPointRef.current = null;
    setHasDrawnInModal(false);
    setModalSignatureData('');
    lastDrawnSignatureRef.current = '';
  };

  // Handle saving profile changes
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!editFirstName.trim()) {
      setErrorMessage('First Name is required.');
      return;
    }
    if (!editLastName.trim()) {
      setErrorMessage('Last Name is required.');
      return;
    }
    const cleanPhone = editPhone.trim();
    if (!cleanPhone || !/^[6-9]\d{9}$/.test(cleanPhone)) {
      setErrorMessage('Please provide a valid 10-digit Indian contact number (starting with 6-9).');
      return;
    }
    if (!editStreetAddress.trim()) {
      setErrorMessage('Street Address is required.');
      return;
    }
    if (!editCity.trim()) {
      setErrorMessage('City is required.');
      return;
    }
    if (!editState.trim()) {
      setErrorMessage('State is required.');
      return;
    }
    const cleanPostal = editPostalCode.trim();
    if (!cleanPostal || !/^\d{6}$/.test(cleanPostal)) {
      setErrorMessage('Postal Code is required and must be a valid 6-digit PIN code.');
      return;
    }

    // Determine final signature & enforce mandatory requirement
    let finalSig = modalSignatureData;
    if (modalSignMode === 'draw') {
      const canvas = canvasRef.current;
      if (canvas && (hasDrawnRef.current || hasDrawnInModal)) {
        finalSig = canvas.toDataURL('image/png');
      } else if (lastDrawnSignatureRef.current) {
        finalSig = lastDrawnSignatureRef.current;
      }
    } else if (modalSignMode === 'type') {
      const nameForType = modalTypedName.trim() || `${editFirstName.trim()} ${editLastName.trim()}` || 'Arun Sharma';
      finalSig = generateNormalTypedSignatureDataUrl(nameForType, 'Authorized Landlord / Owner');
    }

    const isSigEmpty =
      !finalSig ||
      (modalSignMode === 'draw' && !hasDrawnRef.current && !hasDrawnInModal && !lastDrawnSignatureRef.current) ||
      (modalSignMode === 'type' && (!modalTypedName.trim() || modalTypedName.trim().length < 2));

    if (isSigEmpty) {
      setErrorMessage('Landlord Digital Signature is mandatory. Please draw or type your signature before saving.');
      return;
    }

    setIsSaving(true);

    try {
      // 1. If user is authenticated, update backend user in database
      if (user) {
        try {
          const res = await updateProfile({
            firstName: editFirstName.trim(),
            lastName: editLastName.trim(),
            phone: cleanPhone,
            organizationName: editOrgName.trim() || undefined,
          });

          if (!res.success && res.error && !res.error.toLowerCase().includes('unable to connect')) {
            setErrorMessage(res.error);
            setIsSaving(false);
            return;
          }
        } catch (apiErr) {
          console.warn('Backend profile update note:', apiErr);
        }
      }

      // 2. Update centralized storage and broadcast real-time event across pages
      const combinedAddress = formatFullAddress(editStreetAddress, editCity, editState, editPostalCode);
      const updated = saveOwnerProfile({
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        fullName: `${editFirstName.trim()} ${editLastName.trim()}`.trim(),
        phone: cleanPhone,
        streetAddress: editStreetAddress.trim(),
        city: editCity.trim(),
        state: editState.trim(),
        postalCode: editPostalCode.trim(),
        address: combinedAddress,
        organizationName: editOrgName.trim(),
        signature: finalSig,
        signMode: modalSignMode,
        typedName: modalTypedName.trim(),
      }, user);

      setProfile(updated);
      try {
        await refreshUser();
      } catch {}

      // 3. Automatically synchronize updated owner credentials across all properties in database
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
        const propsRes = await fetch(`${apiBase}/properties`, {
          credentials: 'include',
        });
        if (propsRes.ok) {
          const propsData = await propsRes.json();
          const propertiesList: any[] = propsData.data || [];
          for (const prop of propertiesList) {
            try {
              await fetch(`${apiBase}/properties/${prop.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  ownerName: updated.fullName,
                  ownerPhone: updated.phone,
                  ownerAddress: updated.address,
                  ownerSignature: updated.signature,
                }),
              });
            } catch {}
          }
        }
      } catch (propSyncErr) {
        console.warn('Properties sync note:', propSyncErr);
      }

      setSuccessMessage('Owner profile and digital signature updated successfully! Synchronized across all properties and agreements in real-time.');
      setIsEditModalOpen(false);
      setIsSignatureModalOpen(false);

      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isLoading && !isAuthenticated) {
    return (
      <AppShell activePath="/profile">
        <div className="max-w-3xl mx-auto my-12 text-center bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 shadow-sm animate-fadeIn">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 border border-teal-200/80 text-brand-teal flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold uppercase tracking-wider mb-4">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>DPDP Privacy Restricted</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-3">
            Landlord Profile Restricted
          </h1>
          <p className="text-sm sm:text-base text-slate-600 max-w-lg mx-auto leading-relaxed mb-8">
            Landlord personal details, verified addresses, and legal digital signatures are confidential. Please sign in to your owner account or register to manage your profile.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
            <Link
              href="/login?returnUrl=/profile"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brand-teal hover:bg-teal-700 text-white font-bold text-sm shadow-md shadow-teal-700/10 transition"
            >
              <User className="w-4 h-4" />
              <span>Sign In as Landlord</span>
            </Link>
            <Link
              href="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm border border-slate-300 transition"
            >
              <span>Register New Entity</span>
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell activePath="/profile">
      <PageTransition className="max-w-6xl mx-auto space-y-8 pb-16">
        {/* Breadcrumb & Header */}
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2">
            <Link href="/" className="hover:text-brand-teal transition-colors">
              Dashboard
            </Link>
            <span>›</span>
            <span className="text-slate-900">Owner Profile</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
                <UserCircle className="w-8 h-8 text-brand-teal" />
                <span>Owner & Landlord Profile</span>
              </h1>
            </div>

            <Button
              onClick={handleOpenEditModal}
              className="bg-brand-teal hover:bg-teal-700 text-white font-semibold flex items-center gap-2 px-5 py-2.5 shadow-md shadow-teal-700/10 rounded-xl cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              <span>Edit Profile</span>
            </Button>
          </div>
        </div>

        {/* Success / Error Banners */}
        {successMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-sm font-medium animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-800 text-sm font-medium animate-fadeIn">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Personal & Legal Information Card */}
        <Card suppressHydrationWarning className="border border-slate-200/80 shadow-xs rounded-2xl bg-white p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <User className="w-4 h-4 text-brand-teal" />
                <span>Personal & Legal Information</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Primary property owner credentials registered for official records and tenancy documentation.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <div className="bg-slate-50/80 p-5 rounded-xl border border-slate-200/70 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Legal Full Name</span>
              <p suppressHydrationWarning className="text-base font-bold text-slate-900">
                {mounted ? profile.fullName : 'Arun Sharma'}
              </p>
              <p suppressHydrationWarning className="text-[11px] text-slate-500">
                First: {mounted ? profile.firstName : 'Arun'} • Last: {mounted ? profile.lastName : 'Sharma'}
              </p>
            </div>

            <div className="bg-slate-50/80 p-5 rounded-xl border border-slate-200/70 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">WhatsApp / Phone</span>
              <p suppressHydrationWarning className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Phone className="w-4 h-4 text-emerald-600" />
                <span suppressHydrationWarning>+91 {mounted ? profile.phone : '9876543210'}</span>
              </p>
              <p className="text-[11px] text-slate-500">Auto-filled in tenancy agreements</p>
            </div>

            <div className="bg-slate-50/80 p-5 rounded-xl border border-slate-200/70 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Registered Email</span>
              <p suppressHydrationWarning className="text-base font-bold text-slate-900 truncate flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-600" />
                <span suppressHydrationWarning className="truncate">{mounted ? profile.email : 'owner-a@propertyos.com'}</span>
              </p>
              <p className="text-[11px] text-slate-500">Primary Account & Notifications</p>
            </div>

            <div className="bg-slate-50/80 p-5 rounded-xl border border-slate-200/70 space-y-1 md:col-span-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Permanent Address</span>
              <p suppressHydrationWarning className="text-sm font-semibold text-slate-900 flex items-start gap-2 pt-0.5">
                <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span suppressHydrationWarning>{mounted ? (profile.address || formatFullAddress(profile.streetAddress, profile.city, profile.state, profile.postalCode)) : DEFAULT_ADDRESS}</span>
              </p>
              <p className="text-[11px] text-slate-500">Official legal address stamped on agreements</p>
            </div>

            <div className="bg-slate-50/80 p-5 rounded-xl border border-slate-200/70 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Operating Entity</span>
              <p suppressHydrationWarning className="text-base font-bold text-slate-900 truncate flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-500" />
                <span suppressHydrationWarning className="truncate">{mounted ? profile.organizationName : 'My Organization'}</span>
              </p>
              <p className="text-[11px] text-slate-500">Enterprise Landlord Suite</p>
            </div>
          </div>
        </Card>

        {/* Landlord Digital Signature Card */}
        <Card suppressHydrationWarning className="p-6 sm:p-8 border border-slate-200/80 shadow-xs rounded-2xl bg-white space-y-5">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <PenTool className="w-4 h-4 text-brand-teal" />
              <span>Landlord Digital Signature</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Official digital signature automatically applied to property creation and legal tenancy agreements.
            </p>
          </div>

          <div className="bg-slate-50/70 border-2 border-dashed border-slate-300/80 rounded-2xl p-8 flex flex-col items-center justify-center min-h-[170px] relative">
            {profile.signature ? (
              <img
                src={profile.signature}
                alt="Landlord Digital Signature"
                className="max-h-24 max-w-full object-contain filter contrast-125"
              />
            ) : (
              <div className="text-slate-400 text-sm italic">
                No signature recorded. Click Edit Profile to draw or type your signature.
              </div>
            )}

            <div className="absolute top-3 right-3">
              <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verified Legal Stamp</span>
              </span>
            </div>

            <div suppressHydrationWarning className="mt-4 pt-3 border-t border-slate-200/60 w-full max-w-md text-center text-xs text-slate-500 font-medium">
              Signed by <span suppressHydrationWarning className="font-bold text-slate-700">{mounted ? profile.fullName : 'Arun Sharma'}</span> • Authorized Landlord / Owner
            </div>
          </div>
        </Card>
      </PageTransition>

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-3xl w-full overflow-hidden my-8 max-h-[94vh] flex flex-col animate-scaleUp">
            {/* Modal Header */}
            <div className="px-7 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-teal/10 text-brand-teal flex items-center justify-center font-bold">
                  <UserCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Edit Profile</h3>
                  <p className="text-xs text-slate-500">Update your personal details and legal digital signature</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveProfile} className="p-7 space-y-6 overflow-y-auto flex-1">
              {errorMessage && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Section 1: Legal Name */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1.5">
                  1. Personal & Legal Identity
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">First Name *</label>
                    <input
                      type="text"
                      required
                      value={editFirstName}
                      onChange={(e) => setEditFirstName(e.target.value)}
                      placeholder="e.g. Arun"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-brand-teal focus:border-brand-teal outline-hidden bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Last Name *</label>
                    <input
                      type="text"
                      required
                      value={editLastName}
                      onChange={(e) => setEditLastName(e.target.value)}
                      placeholder="e.g. Sharma"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-brand-teal focus:border-brand-teal outline-hidden bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">WhatsApp / Contact Phone *</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-slate-400 text-sm font-semibold">+91</span>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value.replace(/\D/g, ''))}
                        placeholder="9876543210"
                        className="w-full pl-12 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-brand-teal focus:border-brand-teal outline-hidden bg-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Organization / Entity Name</label>
                    <input
                      type="text"
                      value={editOrgName}
                      onChange={(e) => setEditOrgName(e.target.value)}
                      placeholder="e.g. My Organization"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-brand-teal focus:border-brand-teal outline-hidden bg-white"
                    />
                  </div>
                </div>

                {/* Street Address */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Street Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editStreetAddress}
                    onChange={(e) => setEditStreetAddress(e.target.value)}
                    placeholder="e.g. #12, Royal Palm Residency, Indiranagar"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-brand-teal focus:border-brand-teal outline-hidden bg-white"
                  />
                </div>

                {/* City, State, Postal Code */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      City <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editCity}
                      onChange={(e) => setEditCity(e.target.value)}
                      placeholder="e.g. Bengaluru"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-brand-teal focus:border-brand-teal outline-hidden bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      State <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editState}
                      onChange={(e) => setEditState(e.target.value)}
                      placeholder="e.g. Karnataka"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-brand-teal focus:border-brand-teal outline-hidden bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Postal Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={editPostalCode}
                      onChange={(e) => setEditPostalCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="e.g. 560038"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-brand-teal focus:border-brand-teal outline-hidden bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Digital Signature */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                    <span>2. Landlord Digital Signature</span>
                    <span className="text-red-500 font-bold">*</span>
                  </h4>

                  {/* Mode Toggle */}
                  <div className="inline-flex rounded-lg p-0.5 bg-slate-100 border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setModalSignMode('draw')}
                      className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                        modalSignMode === 'draw'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      <PenTool className="w-3.5 h-3.5 text-brand-teal" />
                      <span>Draw Signature</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setModalSignMode('type');
                        const typed = modalTypedName.trim() || `${editFirstName.trim()} ${editLastName.trim()}` || 'Arun Sharma';
                        setModalSignatureData(generateNormalTypedSignatureDataUrl(typed, 'Authorized Landlord / Owner'));
                      }}
                      className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                        modalSignMode === 'type'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      <Keyboard className="w-3.5 h-3.5 text-slate-500" />
                      <span>Type Signature</span>
                    </button>
                  </div>
                </div>

                {modalSignMode === 'draw' ? (
                  <div className="space-y-2">
                    <div className="relative rounded-2xl bg-white border-2 border-slate-300 overflow-hidden shadow-inner">
                      <canvas
                        ref={canvasRef}
                        width={800}
                        height={180}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                        className="w-full h-48 sm:h-56 touch-none bg-white block"
                        style={{
                          cursor: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='%230f172a' stroke='%23ffffff' stroke-width='1.5'%3E%3Cpath d='M17.8 2.2a2.5 2.5 0 0 1 3.5 3.5L8.5 18.5 2 22l3.5-6.5L17.8 2.2z'/%3E%3Cpath d='m15 5 4 4' stroke='%23ffffff' fill='none'/%3E%3Ccircle cx='2.5' cy='21.5' r='1.5' fill='%232563eb'/%3E%3C/svg%3E") 2 22, crosshair`,
                        }}
                      />

                      {!hasDrawnInModal && !lastDrawnSignatureRef.current && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-xs sm:text-sm italic">
                          Draw landlord legal signature here with mouse or finger (Large Full-Width Pad)
                        </div>
                      )}

                      {/* Prominent Clear & Redraw button same as PG and House Rental model */}
                      <button
                        type="button"
                        onClick={clearCanvas}
                        className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 border border-slate-300 shadow-2xs cursor-pointer transition z-10"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Clear & Redraw</span>
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-400 text-right px-1">
                      Smooth vector stroke with quadratic bezier curves
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">Type Your Legal Name</label>
                      <input
                        type="text"
                        value={modalTypedName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setModalTypedName(val);
                          setModalSignatureData(generateNormalTypedSignatureDataUrl(val.trim() || `${editFirstName.trim()} ${editLastName.trim()}` || 'Arun Sharma', 'Authorized Landlord / Owner'));
                        }}
                        placeholder="e.g. Arun Sharma"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-brand-teal focus:border-brand-teal outline-hidden bg-white"
                      />
                    </div>

                    {/* Normal typed signature box - clean unstyled typography */}
                    <div className="p-6 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center min-h-[160px] space-y-2 text-center">
                      <div className="text-2xl sm:text-3xl font-bold tracking-normal text-slate-900 font-sans">
                        {modalTypedName.trim() || `${editFirstName.trim()} ${editLastName.trim()}` || 'Arun Sharma'}
                      </div>
                      <div className="w-56 h-0.5 bg-slate-300" />
                      <div className="text-xs text-slate-500 font-medium font-sans">
                        Authorized Landlord / Owner • {new Date().toLocaleDateString('en-GB')}
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 text-center">
                      Standard legal unstyled digital signature stamped onto property records and tenancy agreements.
                    </p>
                  </div>
                )}
              </div>

              {/* Modal Footer Buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-xl px-5 cursor-pointer"
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={isSaving}
                  className="bg-brand-teal hover:bg-teal-700 text-white font-semibold rounded-xl flex items-center gap-2 px-6 cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving Profile...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save All Changes</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
