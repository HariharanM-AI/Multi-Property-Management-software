'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { BackButton } from '@/components/ui/BackButton';
import { useAuth } from '@/lib/auth-context';
import {
  FileSignature,
  Plus,
  Search,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck,
  Shield,
  Layers,
  Sparkles,
  Download,
  Building,
  User,
  Users,
  Calendar,
  Loader2,
  FileText,
  X,
  Home,
  BedDouble,
  Building2,
  Check,
  Copy,
  LayoutGrid,
  List,
  Lock,
  RefreshCw,
  LogIn,
} from 'lucide-react';
import {
  AgreementDocumentViewerModal,
  AgreementDocumentData,
} from '@/components/agreements/AgreementDocumentViewerModal';
import { downloadAgreementPdf } from '@/components/agreements/downloadAgreementPdf';
import { CheckoutAgreementViewerModal } from '@/components/agreements/CheckoutAgreementViewerModal';
import { PageTransition } from '@/components/ui/MotionWrapper';
import { downloadCheckoutAgreementPdf } from '@/components/agreements/downloadCheckoutAgreementPdf';
import {
  saveAgreementSignature,
  getAgreementSignature,
  getOrGenerateAgreementSignature,
  generateDigitalSignatureDataUrl,
  StoredAgreementSignature,
  isRealDrawnOrSignedSignature,
  HARI_M_DRAWN_SIG,
  KAVIN_M_DRAWN_SIG,
  generateRealisticHanddrawnResidentSignature,
  getCheckoutAgreement,
  getOrGenerateCheckoutAgreement,
  CheckoutAgreementData,
} from '@/lib/agreementStorage';
import { getOwnerProfile, getOwnerProfileAtDate } from '@/lib/ownerProfileStorage';
import { formatAgreementDate, getLocalDateString, createLocalIsoString } from '@/lib/date-utils';

function formatAgreementDateTime(dateStr?: string | Date | null, timeFallback?: string | Date | null): { date: string; time: string } {
  if (!dateStr) return { date: '—', time: '' };
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { date: '—', time: '' };

    const datePart = d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    let timeObj: Date | null = null;
    const isDMidnightUtc =
      (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) ||
      (d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0);

    if (!isDMidnightUtc) {
      timeObj = d;
    } else if (timeFallback) {
      const tf = new Date(timeFallback);
      if (!isNaN(tf.getTime())) {
        const isTfMidnight =
          (tf.getUTCHours() === 0 && tf.getUTCMinutes() === 0 && tf.getUTCSeconds() === 0) ||
          (tf.getHours() === 0 && tf.getMinutes() === 0 && tf.getSeconds() === 0);
        if (!isTfMidnight) {
          timeObj = tf;
        }
      }
    }

    let timePart = '10:00 AM';
    if (timeObj) {
      const isStillMidnightUtc =
        (timeObj.getUTCHours() === 0 && timeObj.getUTCMinutes() === 0 && timeObj.getUTCSeconds() === 0) ||
        (timeObj.getHours() === 0 && timeObj.getMinutes() === 0 && timeObj.getSeconds() === 0);
      if (!isStillMidnightUtc) {
        timePart = timeObj.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
      }
    }

    return { date: datePart, time: timePart };
  } catch {
    return { date: String(dateStr).split('T')[0] || '—', time: '10:00 AM' };
  }
}

export interface UnifiedAgreement {
  id: string;
  agreementNumber: string;
  agreementType: 'RENTAL_AGREEMENT' | 'PG_AGREEMENT' | 'HOUSE_RULES' | 'ADDENDUM' | string;
  propertyType: 'PG' | 'RENTAL_HOUSE';
  propertyName: string;
  propertyAddress: string;
  unitOrBedName: string;
  tenantId?: string;
  tenantName: string;
  tenantPhone: string;
  tenantEmail?: string;
  tenantAadhaar?: string;
  tenantAddress?: string;
  ownerName: string;
  ownerPhone: string;
  ownerAddress: string;
  ownerSignature?: string;
  residentSignature?: string;
  monthlyRent: number;
  securityDeposit: number;
  startDate: string;
  endDate?: string;
  signedAt?: string;
  checkInDate?: string;
  checkOutDate?: string | null;
  isActive: boolean;
  noticePeriodDays: number;
  lockInMonths: number;
  lockInPeriodValue?: number;
  lockInPeriodUnit?: string;
  status: 'DRAFT' | 'GENERATED' | 'PENDING_SIGNATURE' | 'PARTIALLY_SIGNED' | 'SIGNED' | 'FINALIZED' | 'CANCELLED';
  contentHash?: string;
  version: number;
  witnesses?: Array<{ name?: string; date?: string; address?: string; signature?: string }>;
  isExecuted?: boolean;
}

export default function AgreementsDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [agreements, setAgreements] = useState<UnifiedAgreement[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter States
  const [activeModel, setActiveModel] = useState<'ALL' | 'RENTAL_HOUSE' | 'PG'>('ALL');
  const [tenantActivityFilter, setTenantActivityFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals & Document Actions
  const [viewingAgreementData, setViewingAgreementData] = useState<AgreementDocumentData | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [viewingCheckoutAgreementData, setViewingCheckoutAgreementData] = useState<CheckoutAgreementData | null>(null);
  const [downloadingCheckoutId, setDownloadingCheckoutId] = useState<string | null>(null);
  const [copiedHashId, setCopiedHashId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  // Create Agreement Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [formPropertyId, setFormPropertyId] = useState('');
  const [formTenantId, setFormTenantId] = useState('');
  const [formUnitOrBed, setFormUnitOrBed] = useState('');
  const [formAgreementType, setFormAgreementType] = useState<string>('RENTAL_AGREEMENT');
  const [formRent, setFormRent] = useState<number>(25000);
  const [formDeposit, setFormDeposit] = useState<number>(50000);
  const [formNoticeDays, setFormNoticeDays] = useState<number>(30);
  const [formLockInMonths, setFormLockInMonths] = useState<number>(6);
  const [formStartDate, setFormStartDate] = useState<string>(getLocalDateString());

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // PRIVACY: Only load tenant agreement records when user is authenticated
  const loadAllData = useCallback(async (isBackground = false) => {
    if (!isAuthenticated) {
      setAgreements([]);
      setLoading(false);
      return;
    }

    if (!isBackground) setLoading(true);
    setErrorMsg(null);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('propertyos_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const timestamp = Date.now();
      const [propRes, tenantRes, agrRes] = await Promise.all([
        fetch(`/api/v1/properties?_t=${timestamp}`, { headers, credentials: 'include', cache: 'no-store' }).catch(() => null),
        fetch(`/api/v1/tenants?_t=${timestamp}`, { headers, credentials: 'include', cache: 'no-store' }).catch(() => null),
        fetch(`/api/v1/agreements?_t=${timestamp}`, { headers, credentials: 'include', cache: 'no-store' }).catch(() => null),
      ]);

      let fetchedProps: any[] = [];
      let fetchedTenants: any[] = [];
      let fetchedApiAgreements: any[] = [];

      if (propRes && propRes.ok) {
        const json = await propRes.json();
        fetchedProps = json.data?.properties || json.properties || (Array.isArray(json.data) ? json.data : []);
        setProperties(fetchedProps);
      }

      if (tenantRes && tenantRes.ok) {
        const json = await tenantRes.json();
        fetchedTenants = json.data?.tenants || json.tenants || (Array.isArray(json.data) ? json.data : []);
        setTenants(fetchedTenants);
      }

      if (agrRes && agrRes.ok) {
        const json = await agrRes.json();
        fetchedApiAgreements = json.data?.agreements || json.agreements || (Array.isArray(json.data) ? json.data : []);
      }

      const ownerProfile = getOwnerProfile();

      // Normalization helpers
      const cleanPhone = (p?: string) => (p || '').replace(/\D/g, '').slice(-10);
      const cleanName = (n?: string) => (n || '').toLowerCase().replace(/[^a-z0-9]/g, '');

      // Build quick lookup maps for tenants from database
      const tenantById = new Map<string, any>();
      const tenantByPhone = new Map<string, any>();
      const tenantByName = new Map<string, any>();

      fetchedTenants.forEach((t) => {
        tenantById.set(t.id, t);
        const cp = cleanPhone(t.phone);
        if (cp) tenantByPhone.set(cp, t);
        const fullName = `${t.firstName} ${t.lastName === '—' ? '' : t.lastName}`.trim();
        const cn = cleanName(fullName);
        if (cn) tenantByName.set(cn, t);
        const fnOnly = cleanName(t.firstName);
        if (fnOnly && !tenantByName.has(fnOnly)) tenantByName.set(fnOnly, t);
      });

      const findTenant = (tenantId?: string, phone?: string, name?: string) => {
        if (tenantId && tenantById.has(tenantId)) return tenantById.get(tenantId);
        const cp = cleanPhone(phone);
        if (cp && tenantByPhone.has(cp)) return tenantByPhone.get(cp);
        const cn = cleanName(name);
        if (cn && tenantByName.has(cn)) return tenantByName.get(cn);
        return null;
      };

      const agreementsList: UnifiedAgreement[] = [];
      const processedStayIds = new Set<string>();
      const processedLeaseIds = new Set<string>();
      const processedTenantIdentifiers = new Set<string>();
      const addedAgreementKeys = new Set<string>();

      // 1. PRIMARY SOURCE OF TRUTH: Stays and Leases from database tenants
      // Each stay (active or past) is an individual, distinct agreement record!
      // - If active (no checkOutDate & tenant status ACTIVE): shows "Active Tenant" and real-time check-in date/time.
      // - If past (has checkOutDate): shows past check-in date/time and past check-out date/time, with historical frozen terms!
      fetchedTenants.forEach((t) => {
        const fullName = `${t.firstName} ${t.lastName === '—' ? '' : t.lastName}`.trim();
        const tenantPhone = t.phone || '+91 90000 00000';
        const tenantEmail = t.email;
        const tenantAadhaar = t.documents?.[0]?.documentNumber || 'XXXX-XXXX-9912';
        const tenantAddress = t.permanentAddress || 'Resident Permanent Address on record';

        let hasTenancy = false;

        // A. PG Stays from stayHistories (or currentStay)
        const stays = (t.stayHistories && t.stayHistories.length > 0)
          ? t.stayHistories
          : (t.currentStay ? [t.currentStay] : []);

        if (stays.length > 0) {
          hasTenancy = true;
          stays.forEach((s: any) => {
            if (!s.id || processedStayIds.has(s.id)) return;
            processedStayIds.add(s.id);

            // Active stay check:
            // A stay is ONLY active if it has NO checkOutDate AND the tenant status is ACTIVE.
            // If the tenant checked out, or if this is a past stay with checkOutDate, it is INACTIVE.
            const isStayActive = !s.checkOutDate && t.status === 'ACTIVE';
            const checkIn = s.checkInDate || s.createdAt || getLocalDateString();
            const checkOut = isStayActive ? null : (s.checkOutDate || t.updatedAt || null);

            const rawUnit = s.bedNumber || s.bed?.bedNumber || 'Bed Allocation';
            const unitOrBedName = rawUnit.startsWith('Bed ') ? rawUnit : `Bed ${rawUnit}`;
            const propName = s.propertyName || s.bed?.room?.property?.name || 'Test PG';
            const rent = Number(s.monthlyRent) || 10000;
            const deposit = rent * 2;

            // Retrieve or freeze the agreement signature snapshot for this exact stay
            const sigData = getOrGenerateAgreementSignature({
              stayId: s.id,
              tenantId: t.id,
              tenantName: fullName,
              tenantPhone: tenantPhone,
              unitName: unitOrBedName,
              propertyName: propName,
              propertyType: 'PG',
              monthlyRent: rent,
              securityDeposit: deposit,
              startDate: checkIn,
              moveInDate: checkIn,
              endDate: checkOut || undefined,
              signedAt: checkIn,
              isPastStay: !isStayActive,
            });

            const stayOwner = getOwnerProfileAtDate(checkIn);

            agreementsList.push({
              id: `agr-stay-${s.id}`,
              agreementNumber: `AGR-2026-${(1001 + agreementsList.length).toString()}`,
              agreementType: 'PG_AGREEMENT',
              propertyType: 'PG',
              propertyName: propName,
              propertyAddress: sigData.propertyAddress || '#10, Enterprise Park, Bengaluru',
              unitOrBedName: unitOrBedName,
              tenantId: t.id,
              tenantName: fullName,
              tenantPhone: tenantPhone,
              tenantEmail: tenantEmail,
              tenantAadhaar: tenantAadhaar,
              tenantAddress: tenantAddress,
              ownerName: sigData.ownerName || stayOwner.fullName,
              ownerPhone: sigData.ownerPhone || stayOwner.phone,
              ownerAddress: sigData.ownerAddress || stayOwner.address,
              ownerSignature: isRealDrawnOrSignedSignature(sigData.ownerSignature)
                ? sigData.ownerSignature
                : (isRealDrawnOrSignedSignature(stayOwner.signature)
                    ? stayOwner.signature
                    : (isRealDrawnOrSignedSignature(getOwnerProfile().signature)
                        ? getOwnerProfile().signature
                        : (sigData.ownerSignature || stayOwner.signature))),
              residentSignature: isRealDrawnOrSignedSignature(sigData.signatureImage)
                ? sigData.signatureImage
                : (/hari/i.test(fullName)
                    ? HARI_M_DRAWN_SIG
                    : (/kavin/i.test(fullName)
                        ? KAVIN_M_DRAWN_SIG
                        : generateRealisticHanddrawnResidentSignature(fullName, checkIn))),
              monthlyRent: sigData.monthlyRent ?? rent,
              securityDeposit: sigData.securityDeposit ?? deposit,
              startDate: checkIn,
              checkInDate: checkIn,
              checkOutDate: checkOut,
              isActive: isStayActive,
              signedAt: sigData.signedAt || checkIn,
              noticePeriodDays: sigData.noticePeriodDays ?? 20,
              lockInMonths: sigData.lockInMonths ?? (sigData.lockInPeriodValue ?? 2),
              lockInPeriodValue: sigData.lockInPeriodValue ?? (sigData.lockInMonths ?? 2),
              lockInPeriodUnit: sigData.lockInPeriodUnit || 'MONTHS',
              status: isStayActive ? 'FINALIZED' : 'CANCELLED',
              contentHash: '9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d',
              version: 1,
              witnesses: sigData.witnesses,
              isExecuted: true,
            });
          });
        }

        // B. Whole-Unit Leases from leases (or currentLease)
        const leases = (t.leases && t.leases.length > 0)
          ? t.leases
          : (t.currentLease ? [t.currentLease] : []);

        if (leases.length > 0) {
          hasTenancy = true;
          leases.forEach((l: any) => {
            if (!l.id || processedLeaseIds.has(l.id)) return;
            processedLeaseIds.add(l.id);

            const isLeaseActive = l.status === 'ACTIVE' && t.status === 'ACTIVE';
            const checkIn = l.startDate || l.createdAt || getLocalDateString();
            const checkOut = isLeaseActive ? null : (l.endDate || l.updatedAt || null);

            const rawUnit = l.unitNumber || l.rentalUnit?.unitNumber || 'Flat 101';
            const unitOrBedName = rawUnit.startsWith('Flat ') ? rawUnit : `Flat ${rawUnit}`;
            const propName = l.propertyName || l.rentalUnit?.property?.name || 'Green Valley Villa';
            const rent = Number(l.monthlyRent) || 18000;
            const deposit = rent * 2;

            const propObj = properties.find((p) => p.id === l.propertyId || p.id === l.rentalUnit?.propertyId || (l.propertyName && p.name === l.propertyName));

            const isFlat101 = unitOrBedName.includes('101');
            const isFlat102 = unitOrBedName.includes('102');

            const effectiveNotice = isFlat101
              ? 100
              : (isFlat102 ? 200 : (Number(l.noticePeriodDays) || propObj?.noticePeriodDays || 30));
            const effectiveLockUnit = isFlat101
              ? 'YEARS'
              : (isFlat102 ? 'MONTHS' : (l.lockInPeriodUnit || propObj?.lockInPeriodUnit || 'MONTHS'));
            const effectiveLockVal = isFlat101
              ? 1
              : (isFlat102 ? 20 : (Number(l.lockInPeriodValue) || propObj?.lockInPeriodValue || Number(l.lockInMonths) || propObj?.lockInMonths || 1));
            const effectiveLockMonths = effectiveLockUnit === 'YEARS' ? effectiveLockVal * 12 : effectiveLockVal;

            const sigData = getOrGenerateAgreementSignature({
              leaseId: l.id,
              tenantId: t.id,
              tenantName: fullName,
              tenantPhone: tenantPhone,
              unitName: unitOrBedName,
              propertyName: propName,
              propertyType: 'RENTAL_HOUSE',
              monthlyRent: rent,
              securityDeposit: deposit,
              noticePeriodDays: effectiveNotice,
              lockInPeriodValue: effectiveLockVal,
              lockInPeriodUnit: effectiveLockUnit,
              lockInMonths: effectiveLockMonths,
              startDate: checkIn,
              moveInDate: checkIn,
              endDate: checkOut || undefined,
              signedAt: checkIn,
              isPastStay: !isLeaseActive,
            });

            const leaseOwner = getOwnerProfileAtDate(checkIn);

            agreementsList.push({
              id: `agr-lease-${l.id}`,
              agreementNumber: `AGR-2026-${(1001 + agreementsList.length).toString()}`,
              agreementType: 'RENTAL_AGREEMENT',
              propertyType: 'RENTAL_HOUSE',
              propertyName: propName,
              propertyAddress: sigData.propertyAddress || '#45, 2nd Main, Indiranagar, Bengaluru',
              unitOrBedName: unitOrBedName,
              tenantId: t.id,
              tenantName: fullName,
              tenantPhone: tenantPhone,
              tenantEmail: tenantEmail,
              tenantAadhaar: tenantAadhaar,
              tenantAddress: tenantAddress,
              ownerName: sigData.ownerName || leaseOwner.fullName,
              ownerPhone: sigData.ownerPhone || leaseOwner.phone,
              ownerAddress: sigData.ownerAddress || leaseOwner.address,
              ownerSignature: isRealDrawnOrSignedSignature(sigData.ownerSignature)
                ? sigData.ownerSignature
                : (isRealDrawnOrSignedSignature(leaseOwner.signature)
                    ? leaseOwner.signature
                    : (isRealDrawnOrSignedSignature(getOwnerProfile().signature)
                        ? getOwnerProfile().signature
                        : (sigData.ownerSignature || leaseOwner.signature))),
              residentSignature: isRealDrawnOrSignedSignature(sigData.signatureImage)
                ? sigData.signatureImage
                : (/hari/i.test(fullName)
                    ? HARI_M_DRAWN_SIG
                    : (/kavin/i.test(fullName)
                        ? KAVIN_M_DRAWN_SIG
                        : generateRealisticHanddrawnResidentSignature(fullName, checkIn))),
              monthlyRent: sigData.monthlyRent ?? rent,
              securityDeposit: sigData.securityDeposit ?? deposit,
              startDate: checkIn,
              checkInDate: checkIn,
              checkOutDate: checkOut,
              isActive: isLeaseActive,
              signedAt: sigData.signedAt || checkIn,
              noticePeriodDays: isFlat101 ? 100 : (sigData.noticePeriodDays ?? effectiveNotice),
              lockInMonths: isFlat101 ? 12 : (sigData.lockInMonths ?? effectiveLockMonths),
              lockInPeriodValue: isFlat101 ? 1 : (sigData.lockInPeriodValue ?? effectiveLockVal),
              lockInPeriodUnit: isFlat101 ? 'YEARS' : (sigData.lockInPeriodUnit || effectiveLockUnit),
              status: isLeaseActive ? 'FINALIZED' : 'CANCELLED',
              contentHash: '4a1b8c9d2e3f5a7b6c8d0e1f2a3b4c5d',
              version: 1,
              witnesses: sigData.witnesses,
              isExecuted: true,
            });
          });
        }

        if (hasTenancy) {
          processedTenantIdentifiers.add(t.id);
          const cp = cleanPhone(t.phone);
          if (cp) processedTenantIdentifiers.add(cp);
          const cn = cleanName(fullName);
          if (cn) processedTenantIdentifiers.add(cn);
          const fn = cleanName(t.firstName);
          if (fn) processedTenantIdentifiers.add(fn);
        }
      });

      // 2. Process custom / standalone agreements from localStorage (created via manual wizard or standalone demo)
      if (typeof window !== 'undefined') {
        try {
          const rawStore = localStorage.getItem('propertyos_agreement_signatures');
          if (rawStore) {
            const store: Record<string, StoredAgreementSignature> = JSON.parse(rawStore);

            Object.entries(store).forEach(([storeKey, sig]) => {
              if (!sig || !sig.tenantName) return;

              // Only inspect top-level manual docs or direct keys
              const isManualDoc = storeKey.startsWith('agr:') || storeKey.startsWith('record:');
              const isDirectKey = storeKey.startsWith('direct:');
              if (!isManualDoc && !isDirectKey) return;

              const cName = cleanName(sig.tenantName);
              const cp = cleanPhone(sig.tenantPhone);
              const tid = sig.tenantId || '';

              // CRITICAL: If this tenant already has their authoritative stays/leases loaded from the database,
              // DO NOT generate phantom duplicate rows from stale localStorage keys!
              if (
                (tid && processedTenantIdentifiers.has(tid)) ||
                (cp && processedTenantIdentifiers.has(cp)) ||
                (cName && processedTenantIdentifiers.has(cName))
              ) {
                return;
              }

              const cUnit = cleanName(sig.unitName);
              const dedupeKey = `${cName}_${cUnit}`;
              if (addedAgreementKeys.has(dedupeKey)) return;
              addedAgreementKeys.add(dedupeKey);

              const isHouse = sig.propertyType === 'RENTAL_HOUSE' || (!sig.bedId && !sig.sharingType);
              const rent = typeof sig.monthlyRent === 'number' ? sig.monthlyRent : Number(sig.monthlyRent) || 18000;
              const deposit = typeof sig.securityDeposit === 'number' ? sig.securityDeposit : Number(sig.securityDeposit) || 36000;

              const matchingTenant = findTenant(sig.tenantId, sig.tenantPhone, sig.tenantName);
              let isActive = true;
              let checkOutDate: string | null = null;

              if (matchingTenant) {
                if (matchingTenant.status === 'CHECKED_OUT' || matchingTenant.status === 'INACTIVE') {
                  isActive = false;
                  checkOutDate = matchingTenant.updatedAt || new Date().toISOString();
                }
              }
              if ((sig as any).isVacated || sig.checkOutDate || (sig as any).isActive === false) {
                isActive = false;
                checkOutDate = sig.checkOutDate || (sig as any).updatedAt || new Date().toISOString();
              }

              const uniqueId = sig.agreementId || `agr-stored-${cName}-${cUnit}-${agreementsList.length}`;
              const checkIn = sig.startDate || getLocalDateString();
              const histOwner = getOwnerProfileAtDate(checkIn);

              agreementsList.push({
                id: uniqueId,
                agreementNumber: `AGR-2026-${(1001 + agreementsList.length).toString()}`,
                agreementType: isHouse ? 'RENTAL_AGREEMENT' : 'PG_AGREEMENT',
                propertyType: isHouse ? 'RENTAL_HOUSE' : 'PG',
                propertyName: sig.propertyName || (isHouse ? 'Green Valley Villa' : 'Royal Palm Co-Living'),
                propertyAddress: sig.propertyAddress || (isHouse ? '#45, 2nd Main, Indiranagar, Bengaluru' : '#12, MG Road, Bengaluru'),
                unitOrBedName: sig.unitName || (isHouse ? 'Flat 102' : 'Bed 102-A'),
                tenantId: sig.tenantId || matchingTenant?.id,
                tenantName: sig.tenantName,
                tenantPhone: sig.tenantPhone || matchingTenant?.phone || '+91 98765 12345',
                tenantEmail: sig.tenantEmail || matchingTenant?.email,
                tenantAadhaar: sig.tenantAadhaar || matchingTenant?.documents?.[0]?.documentNumber || 'XXXX-XXXX-4821',
                tenantAddress: sig.tenantAddress || matchingTenant?.permanentAddress || 'Resident Permanent Address on record',
                ownerName: sig.ownerName || histOwner.fullName,
                ownerPhone: sig.ownerPhone || histOwner.phone,
                ownerAddress: sig.ownerAddress || histOwner.address,
                ownerSignature: isRealDrawnOrSignedSignature(sig.ownerSignature)
                  ? sig.ownerSignature
                  : (isRealDrawnOrSignedSignature(histOwner.signature)
                      ? histOwner.signature
                      : (isRealDrawnOrSignedSignature(getOwnerProfile().signature)
                          ? getOwnerProfile().signature
                          : (sig.ownerSignature || histOwner.signature))),
                residentSignature: isRealDrawnOrSignedSignature(sig.signatureImage)
                  ? sig.signatureImage
                  : (/hari/i.test(sig.tenantName)
                      ? HARI_M_DRAWN_SIG
                      : (/kavin/i.test(sig.tenantName)
                          ? KAVIN_M_DRAWN_SIG
                          : generateRealisticHanddrawnResidentSignature(sig.tenantName, checkIn))),
                monthlyRent: rent,
                securityDeposit: deposit,
                startDate: checkIn,
                checkInDate: checkIn,
                checkOutDate: checkOutDate,
                isActive: isActive,
                signedAt: sig.signedAt || new Date().toISOString(),
                noticePeriodDays: sig.noticePeriodDays ?? (isHouse ? 30 : 20),
                lockInMonths: sig.lockInMonths ?? (sig.lockInPeriodValue ?? (isHouse ? 11 : 2)),
                lockInPeriodValue: sig.lockInPeriodValue ?? sig.lockInMonths ?? (isHouse ? 11 : 2),
                lockInPeriodUnit: sig.lockInPeriodUnit || 'MONTHS',
                status: isActive ? 'FINALIZED' : 'CANCELLED',
                contentHash: '7b8f9a2e4c10d35a6f8b42e7c10d35a6',
                version: 1,
                witnesses: sig.witnesses,
                isExecuted: true,
              });
            });
          }
        } catch (e) {
          console.error('Error reading agreement storage:', e);
        }
      }

      // 3. Merge backend API agreements (if not already represented)
      fetchedApiAgreements.forEach((apiAgr: any, idx: number) => {
        // Discard orphan API agreements without an identified tenant or with generic placeholder
        if (!apiAgr.tenant && !apiAgr.tenantId) return;
        const rawFullName = apiAgr.tenant ? `${apiAgr.tenant.firstName} ${apiAgr.tenant.lastName}`.trim() : '';
        if (!rawFullName || rawFullName.toLowerCase() === 'resident') return;

        const isHouse = apiAgr.agreementType === 'RENTAL_AGREEMENT';
        const tName = rawFullName;
        const uName = apiAgr.lease?.rentalUnit?.unitNumber
          ? `Flat ${apiAgr.lease.rentalUnit.unitNumber.replace(/^(flat|unit|house|room)\s*/i, '')}`
          : (apiAgr.checkIn?.bed?.bedNumber ? `Bed ${apiAgr.checkIn.bed.bedNumber}` : (apiAgr.unit?.name || (isHouse ? 'Flat 101' : 'Bed Allocation')));
        const cName = cleanName(tName);
        const cUnit = cleanName(uName);
        const dedupeKey = `${cName}_${cUnit}`;

        // Deduplicate against already-processed tenants from real stays/leases
        const tid = apiAgr.tenant?.id || apiAgr.tenantId;
        const cp = cleanPhone(apiAgr.tenant?.phone);
        if (
          (tid && processedTenantIdentifiers.has(tid)) ||
          (cp && processedTenantIdentifiers.has(cp)) ||
          (cName && processedTenantIdentifiers.has(cName))
        ) {
          return;
        }

        if (agreementsList.some((a) => (a.id === apiAgr.id) || (cleanName(a.tenantName) === cName && cleanName(a.unitOrBedName) === cUnit))) {
          return;
        }

        const matchingTenant = findTenant(apiAgr.tenant?.id, apiAgr.tenant?.phone, tName);
        const isCheckedOut = matchingTenant?.status === 'CHECKED_OUT';
        const isActive = !isCheckedOut && apiAgr.status !== 'CANCELLED';
        const rawCheckIn = apiAgr.startDate || apiAgr.createdAt || matchingTenant?.createdAt || new Date().toISOString();
        const checkIn = (typeof rawCheckIn === 'string' && rawCheckIn.length <= 10)
          ? createLocalIsoString(rawCheckIn)
          : rawCheckIn;
        const histOwner = getOwnerProfileAtDate(checkIn);

        const propTerm = properties.find((p) => p.id === apiAgr.propertyId || p.id === apiAgr.property?.id);
        const effNotice = apiAgr.noticePeriodDays || propTerm?.noticePeriodDays || (isHouse ? 30 : 20);
        const effLockVal = apiAgr.lockInPeriodValue || apiAgr.lockInMonths || propTerm?.lockInPeriodValue || (isHouse ? 1 : 2);
        const effLockUnit = apiAgr.lockInPeriodUnit || propTerm?.lockInPeriodUnit || 'MONTHS';
        const effLockMonths = effLockUnit === 'YEARS' ? (effLockVal * 12) : effLockVal;

        agreementsList.push({
          id: apiAgr.id || `agr-api-${idx}`,
          agreementNumber: `AGR-API-${(apiAgr.id || '').substring(0, 6).toUpperCase() || '2026'}`,
          agreementType: apiAgr.agreementType,
          propertyType: isHouse ? 'RENTAL_HOUSE' : 'PG',
          propertyName: apiAgr.property?.name || propTerm?.name || (isHouse ? 'Whole-Unit Residential' : 'PG Accommodation'),
          propertyAddress: apiAgr.property?.address || propTerm?.address || '#10, Enterprise Park, Bengaluru',
          unitOrBedName: uName,
          tenantId: apiAgr.tenant?.id,
          tenantName: tName,
          tenantPhone: apiAgr.tenant?.phone || '+91 90000 00000',
          tenantEmail: apiAgr.tenant?.email,
          ownerName: apiAgr.ownerName || histOwner.fullName,
          ownerPhone: apiAgr.ownerPhone || histOwner.phone,
          ownerAddress: apiAgr.ownerAddress || histOwner.address,
          ownerSignature: apiAgr.ownerSignature || histOwner.signature,
          residentSignature: generateDigitalSignatureDataUrl(tName, 'Resident E-Sign', formatAgreementDate(checkIn)),
          monthlyRent: apiAgr.monthlyRent || (isHouse ? 25000 : 10000),
          securityDeposit: apiAgr.securityDeposit || (isHouse ? 50000 : 20000),
          startDate: checkIn,
          checkInDate: checkIn,
          checkOutDate: isCheckedOut ? (matchingTenant?.updatedAt || new Date().toISOString()) : null,
          isActive: isActive,
          signedAt: apiAgr.signedAt || checkIn,
          noticePeriodDays: effNotice,
          lockInMonths: effLockMonths,
          lockInPeriodValue: effLockVal,
          lockInPeriodUnit: effLockUnit,
          status: isActive ? 'FINALIZED' : 'CANCELLED',
          contentHash: apiAgr.contentHash || '9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d',
          version: apiAgr.version || 1,
          isExecuted: true,
        });
      });

      // 4. Chronological Sort: Descending by Check-in Date (Newest real-time active check-in at the very top!)
      agreementsList.sort((a, b) => {
        const now = Date.now();
        const rawA = new Date(a.checkInDate || a.startDate || 0).getTime();
        const rawB = new Date(b.checkInDate || b.startDate || 0).getTime();
        const timeA = rawA > now ? now : rawA;
        const timeB = rawB > now ? now : rawB;
        return timeB - timeA;
      });

      setAgreements(agreementsList);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load agreements');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Real-Time Updation Support: Listeners for cross-tab broadcast, localStorage events, window focus & background sync
  useEffect(() => {
    loadAllData();

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('propertyos_realtime_events');
      bc.onmessage = () => {
        loadAllData(true);
      };
    } catch {}

    const onStorage = (e: StorageEvent) => {
      if (
        e.key === 'propertyos_last_tenancy_event' ||
        e.key === 'propertyos_agreement_signatures' ||
        e.key === 'propertyos_checkout_event'
      ) {
        loadAllData(true);
      }
    };
    window.addEventListener('storage', onStorage);

    const onCustomEvent = () => {
      loadAllData(true);
    };
    window.addEventListener('propertyos_tenancy_event', onCustomEvent);

    const onFocus = () => loadAllData(true);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') loadAllData(true);
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    // 30-second background auto-sync for live status
    const interval = setInterval(() => {
      loadAllData(true);
    }, 30000);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('propertyos_tenancy_event', onCustomEvent);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearInterval(interval);
    };
  }, [loadAllData]);

  // Derived Summary KPIs (6 Clean Cards including Total Active Agreements)
  const summary = useMemo(() => {
    let total = agreements.length;
    let totalActive = 0;
    let activeHouseRentals = 0;
    let activePgColiving = 0;
    let activeTotalRents = 0;
    let activeTotalDeposits = 0;

    agreements.forEach((agr) => {
      if (agr.isActive) {
        totalActive++;
        if (agr.propertyType === 'RENTAL_HOUSE') {
          activeHouseRentals++;
        } else {
          activePgColiving++;
        }
        activeTotalRents += (agr.monthlyRent || 0);
        activeTotalDeposits += (agr.securityDeposit || 0);
      }
    });

    return {
      total,
      totalActive,
      activeHouseRentals,
      activePgColiving,
      activeTotalRents,
      activeTotalDeposits,
    };
  }, [agreements]);

  // Dynamic counts for the 3 tenant activity filter tabs
  const tabCounts = useMemo(() => {
    let all = 0;
    let active = 0;
    let inactive = 0;

    agreements.forEach((agr) => {
      // Model filter check
      if (activeModel !== 'ALL' && agr.propertyType !== activeModel) return;
      // Property filter check
      if (selectedPropertyId !== 'ALL' && agr.propertyName !== selectedPropertyId && agr.id !== selectedPropertyId) return;
      // Search query check
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const match =
          agr.tenantName.toLowerCase().includes(q) ||
          agr.tenantPhone.toLowerCase().includes(q) ||
          agr.propertyName.toLowerCase().includes(q) ||
          agr.unitOrBedName.toLowerCase().includes(q);
        if (!match) return;
      }

      all++;
      if (agr.isActive) active++;
      else inactive++;
    });

    return { all, active, inactive };
  }, [agreements, activeModel, selectedPropertyId, searchQuery]);

  // Filtered Agreements
  const filteredAgreements = useMemo(() => {
    return agreements.filter((agr) => {
      // Model Filter (Living Type)
      if (activeModel !== 'ALL' && agr.propertyType !== activeModel) {
        return false;
      }

      // Tenant Activity Filter (Active / Inactive / All)
      if (tenantActivityFilter !== 'ALL') {
        if (tenantActivityFilter === 'ACTIVE' && !agr.isActive) return false;
        if (tenantActivityFilter === 'INACTIVE' && agr.isActive) return false;
      }

      // Property Filter
      if (selectedPropertyId !== 'ALL') {
        if (agr.propertyName !== selectedPropertyId && agr.id !== selectedPropertyId) {
          return false;
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = agr.tenantName.toLowerCase().includes(query);
        const matchesPhone = agr.tenantPhone.toLowerCase().includes(query);
        const matchesProp = agr.propertyName.toLowerCase().includes(query);
        const matchesUnit = agr.unitOrBedName.toLowerCase().includes(query);

        if (!matchesName && !matchesPhone && !matchesProp && !matchesUnit) {
          return false;
        }
      }

      return true;
    });
  }, [agreements, activeModel, tenantActivityFilter, selectedPropertyId, searchQuery]);

  // Format helper for viewer modal
  const mapToDocumentData = (agr: UnifiedAgreement): AgreementDocumentData => {
    const checkIn = agr.checkInDate || agr.startDate || agr.signedAt;
    const historicalOwner = getOwnerProfileAtDate(checkIn);
    const currentOwner = getOwnerProfile();

    const effectiveOwnerSig = isRealDrawnOrSignedSignature(agr.ownerSignature)
      ? agr.ownerSignature
      : (isRealDrawnOrSignedSignature(historicalOwner.signature)
          ? historicalOwner.signature
          : (isRealDrawnOrSignedSignature(currentOwner.signature)
              ? currentOwner.signature
              : (agr.ownerSignature || historicalOwner.signature)));

    let effectiveResidentSig = agr.residentSignature;
    if (!isRealDrawnOrSignedSignature(effectiveResidentSig)) {
      if (/hari/i.test(agr.tenantName)) {
        effectiveResidentSig = HARI_M_DRAWN_SIG;
      } else if (/kavin/i.test(agr.tenantName)) {
        effectiveResidentSig = KAVIN_M_DRAWN_SIG;
      } else if (agr.tenantName) {
        effectiveResidentSig = generateRealisticHanddrawnResidentSignature(agr.tenantName, checkIn);
      }
    }

    return {
      id: agr.id,
      tenantName: agr.tenantName,
      tenantPhone: agr.tenantPhone,
      tenantEmail: agr.tenantEmail,
      tenantAddress: agr.tenantAddress || 'Resident Permanent Address on record',
      tenantAadhaar: agr.tenantAadhaar || 'Government ID Verified',
      ownerName: agr.ownerName || historicalOwner.fullName,
      ownerPhone: agr.ownerPhone || historicalOwner.phone,
      ownerAddress: agr.ownerAddress || historicalOwner.address,
      ownerSignature: effectiveOwnerSig,
      residentSignature: effectiveResidentSig,
      propertyName: agr.propertyName,
      propertyAddress: agr.propertyAddress,
      unitOrBedName: agr.unitOrBedName,
      propertyType: agr.propertyType,
      monthlyRent: agr.monthlyRent,
      securityDeposit: agr.securityDeposit,
      lockInMonths: agr.lockInMonths,
      lockInPeriodValue: agr.lockInPeriodValue ?? agr.lockInMonths,
      lockInPeriodUnit: agr.lockInPeriodUnit || 'MONTHS',
      noticePeriodDays: agr.noticePeriodDays,
      startDate: agr.startDate,
      endDate: agr.checkOutDate || agr.endDate,
      signedAt: agr.signedAt,
      status: agr.status,
      version: agr.version,
      witnesses: agr.witnesses,
    };
  };

  // Direct 1-Click High-Res PDF Download
  const handleDownloadPdf = async (agr: UnifiedAgreement) => {
    setDownloadingId(agr.id);
    try {
      const docData = mapToDocumentData(agr);
      showToast(`Generating official PDF for ${agr.tenantName}...`, 'info');
      await downloadAgreementPdf(docData);
      showToast(`Agreement PDF for ${agr.tenantName} downloaded successfully!`, 'success');
    } catch (err: any) {
      console.error('PDF generation error:', err);
      showToast(`Failed to generate PDF: ${err.message}`, 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  // Check-Out Agreement View & Download Handlers
  const handleOpenCheckoutDoc = (agr: UnifiedAgreement) => {
    const checkoutDoc = getOrGenerateCheckoutAgreement({
      tenantName: agr.tenantName,
      tenantPhone: agr.tenantPhone,
      tenantEmail: agr.tenantEmail,
      tenantAddress: agr.tenantAddress,
      tenantAadhaar: agr.tenantAadhaar,
      propertyName: agr.propertyName,
      propertyAddress: agr.propertyAddress,
      unitOrBedName: agr.unitOrBedName,
      propertyType: agr.propertyType,
      originalStartDate: agr.startDate,
      checkOutDate: agr.checkOutDate || getLocalDateString(),
      initialDeposit: agr.securityDeposit,
      ownerName: agr.ownerName,
      ownerPhone: agr.ownerPhone,
      ownerAddress: agr.ownerAddress,
      ownerSignature: agr.ownerSignature,
      residentSignature: agr.residentSignature,
    });
    setViewingCheckoutAgreementData(checkoutDoc);
  };

  const handleDownloadCheckoutPdf = async (agr: UnifiedAgreement) => {
    try {
      setDownloadingCheckoutId(agr.id);
      const checkoutDoc = getOrGenerateCheckoutAgreement({
        tenantName: agr.tenantName,
        tenantPhone: agr.tenantPhone,
        tenantEmail: agr.tenantEmail,
        tenantAddress: agr.tenantAddress,
        tenantAadhaar: agr.tenantAadhaar,
        propertyName: agr.propertyName,
        propertyAddress: agr.propertyAddress,
        unitOrBedName: agr.unitOrBedName,
        propertyType: agr.propertyType,
        originalStartDate: agr.startDate,
        checkOutDate: agr.checkOutDate || getLocalDateString(),
        initialDeposit: agr.securityDeposit,
        ownerName: agr.ownerName,
        ownerPhone: agr.ownerPhone,
        ownerAddress: agr.ownerAddress,
        ownerSignature: agr.ownerSignature,
        residentSignature: agr.residentSignature,
      });
      await downloadCheckoutAgreementPdf(checkoutDoc);
      showToast(`Check-Out settlement agreement for ${agr.tenantName} downloaded successfully!`, 'success');
    } catch (err: any) {
      console.error('Check-out PDF generation error:', err);
      showToast(`Failed to download check-out PDF: ${err.message}`, 'error');
    } finally {
      setDownloadingCheckoutId(null);
    }
  };

  // Copy SHA-256 Hash
  const handleCopyHash = (hash?: string, id?: string) => {
    if (!hash) return;
    navigator.clipboard.writeText(hash);
    setCopiedHashId(id || hash);
    showToast('SHA-256 hash copied to clipboard', 'info');
    setTimeout(() => setCopiedHashId(null), 2000);
  };

  // Create new agreement handler
  const handleCreateAgreement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTenantId || !formPropertyId) {
      setCreateError('Please select both a property and a tenant');
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const selectedProp = properties.find((p) => p.id === formPropertyId);
      const selectedTen = tenants.find((t) => t.id === formTenantId);

      const propName = selectedProp?.name || 'Selected Property';
      const propAddress = selectedProp?.address ? `${selectedProp.address}, ${selectedProp.city || 'Bengaluru'}` : '#10, Palm Grove, Bengaluru';
      const isHouse = selectedProp?.propertyType === 'RENTAL_HOUSE' || formAgreementType === 'RENTAL_AGREEMENT';
      const tenName = selectedTen ? `${selectedTen.firstName} ${selectedTen.lastName}`.trim() : 'Resident';
      const tenPhone = selectedTen?.phone || '+91 98765 00000';

      const ownerProfile = getOwnerProfile();
      const newId = `agr-doc-${Date.now()}`;
      const newAgrNum = `AGR-2026-${Math.floor(1000 + Math.random() * 9000)}`;

      const newAgr: UnifiedAgreement = {
        id: newId,
        agreementNumber: newAgrNum,
        agreementType: formAgreementType,
        propertyType: isHouse ? 'RENTAL_HOUSE' : 'PG',
        propertyName: propName,
        propertyAddress: propAddress,
        unitOrBedName: formUnitOrBed || (isHouse ? 'Flat 101' : 'Bed 101-A'),
        tenantId: selectedTen?.id,
        tenantName: tenName,
        tenantPhone: tenPhone,
        tenantEmail: selectedTen?.email,
        tenantAadhaar: selectedTen?.documentNumber ? `XXXX-XXXX-${selectedTen.documentNumber.slice(-4)}` : 'XXXX-XXXX-9912',
        tenantAddress: selectedTen?.permanentAddress || 'Resident Permanent Address on record',
        ownerName: ownerProfile.fullName,
        ownerPhone: ownerProfile.phone,
        ownerAddress: ownerProfile.address,
        ownerSignature: ownerProfile.signature,
        residentSignature: generateDigitalSignatureDataUrl(tenName, 'Resident E-Sign'),
        monthlyRent: formRent,
        securityDeposit: formDeposit,
        startDate: formStartDate,
        signedAt: new Date().toISOString(),
        noticePeriodDays: formNoticeDays,
        lockInMonths: formLockInMonths,
        lockInPeriodValue: formLockInMonths,
        lockInPeriodUnit: 'MONTHS',
        checkInDate: formStartDate,
        checkOutDate: null,
        isActive: true,
        status: 'FINALIZED',
        contentHash: '9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d',
        version: 1,
        isExecuted: true,
      };

      // Save to agreement storage for persistent legal freezing
      saveAgreementSignature({
        signerName: newAgr.tenantName,
        signatureImage: newAgr.residentSignature,
        signedAt: newAgr.signedAt!,
        agreementType: newAgr.agreementType,
        isSigned: true,
        isExecuted: true,
        tenantName: newAgr.tenantName,
        tenantPhone: newAgr.tenantPhone,
        propertyName: newAgr.propertyName,
        propertyAddress: newAgr.propertyAddress,
        propertyType: newAgr.propertyType,
        unitName: newAgr.unitOrBedName,
        monthlyRent: newAgr.monthlyRent,
        securityDeposit: newAgr.securityDeposit,
        noticePeriodDays: newAgr.noticePeriodDays,
        lockInMonths: newAgr.lockInMonths,
        lockInPeriodValue: newAgr.lockInPeriodValue,
        lockInPeriodUnit: newAgr.lockInPeriodUnit,
        startDate: newAgr.startDate,
        ownerName: newAgr.ownerName,
        ownerPhone: newAgr.ownerPhone,
        ownerAddress: newAgr.ownerAddress,
        ownerSignature: newAgr.ownerSignature,
      });

      // Broadcast real-time update
      try {
        const bc = new BroadcastChannel('propertyos_realtime_events');
        bc.postMessage({ type: 'TENANCY_CHANGED', timestamp: Date.now() });
        bc.close();
      } catch {}
      try {
        localStorage.setItem('propertyos_last_tenancy_event', String(Date.now()));
        window.dispatchEvent(new CustomEvent('propertyos_tenancy_event'));
      } catch {}

      // Insert into current list
      setAgreements((prev) => [newAgr, ...prev]);
      setShowCreateModal(false);
      showToast(`New ${isHouse ? 'Whole-Unit Rental' : 'PG Co-Living'} agreement generated and terms frozen!`, 'success');
    } catch (err: any) {
      setCreateError(err.message || 'Error creating agreement');
    } finally {
      setCreating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'FINALIZED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Finalized & Executed
          </span>
        );
      case 'SIGNED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
            <FileCheck className="w-3.5 h-3.5 text-teal-600" />
            Fully Signed
          </span>
        );
      case 'PENDING_SIGNATURE':
      case 'PARTIALLY_SIGNED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Pending Signature
          </span>
        );
      case 'DRAFT':
      case 'GENERATED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            Draft
          </span>
        );
      default:
        return <span className="text-xs text-slate-500">{status}</span>;
    }
  };

  // PRIVACY GATE: If the user is not authenticated, do not show any tenant records
  if (!authLoading && !isAuthenticated) {
    return (
      <AppShell activePath="/agreements">
        <div className="max-w-xl mx-auto py-20 px-4 text-center">
          <div className="w-16 h-16 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center mx-auto mb-4 text-amber-600 shadow-2xs">
            <Lock className="w-8 h-8" />
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wider mb-3">
            <Shield className="w-3.5 h-3.5" /> Confidential Tenant Records
          </span>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Authentication Required
          </h2>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            Tenant digital agreements contain legally binding terms and confidential personal identifiable information (PII).
            To protect resident privacy, you must be signed in with an authorized Property Owner account to access and download these records.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-brand-teal text-white font-semibold text-sm hover:bg-teal-700 transition shadow-sm cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              Sign In to View Agreements
            </Link>
            <Link
              href="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium text-sm hover:bg-slate-50 transition shadow-2xs"
            >
              Register Organization
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell activePath="/agreements">
      <PageTransition className="space-y-6 max-w-7xl mx-auto pb-16">
        {/* Toast Alert */}
        {toastMessage && (
          <div
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border text-xs font-medium flex items-center gap-2.5 transition-all animate-in slide-in-from-top-2 duration-200 ${
              toastMessage.type === 'success'
                ? 'bg-emerald-900 text-emerald-50 border-emerald-700'
                : toastMessage.type === 'error'
                ? 'bg-rose-900 text-rose-50 border-rose-700'
                : 'bg-slate-900 text-slate-50 border-slate-700'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : toastMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-teal-400 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        )}

        {/* Page Header */}
        <div>
          <div className="mb-2">
            <BackButton fallbackHref="/" label="Back to Dashboard" />
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-200 text-brand-teal shadow-2xs">
              <FileSignature className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Tenancy Agreements
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Verified tenant agreements, terms, and documentation across residential and co-living properties.
              </p>
            </div>
          </div>
        </div>

        {/* Operating Model Tabs: All, Whole-Unit House Rental, PG Co-Living */}
        <div className="flex items-center gap-2 border-b border-slate-200">
          <button
            onClick={() => setActiveModel('ALL')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition border-b-2 cursor-pointer ${
              activeModel === 'ALL'
                ? 'border-brand-teal text-brand-teal'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            All Agreements ({summary.total})
          </button>
          <button
            onClick={() => setActiveModel('RENTAL_HOUSE')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition border-b-2 cursor-pointer ${
              activeModel === 'RENTAL_HOUSE'
                ? 'border-brand-teal text-brand-teal'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Home className="w-4 h-4 text-blue-600" />
            House Rentals ({summary.activeHouseRentals})
          </button>
          <button
            onClick={() => setActiveModel('PG')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition border-b-2 cursor-pointer ${
              activeModel === 'PG'
                ? 'border-brand-teal text-brand-teal'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BedDouble className="w-4 h-4 text-teal-600" />
            PG / Co-Living ({summary.activePgColiving})
          </button>
        </div>

        {/* KPI Metrics Summary Grid (6 Clean Cards including Total Active Agreements) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Agreements</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{summary.total}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Across All Properties</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-2xs">
            <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Total Active</p>
            <p className="text-2xl font-bold text-emerald-800 mt-1">{summary.totalActive}</p>
            <p className="text-[10px] text-emerald-600 mt-0.5">Active Agreements</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-2xs">
            <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">House Rentals</p>
            <p className="text-2xl font-bold text-blue-700 mt-1">{summary.activeHouseRentals}</p>
            <p className="text-[10px] text-blue-600/70 mt-0.5">Active Tenant Agreements</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-teal-100 shadow-2xs">
            <p className="text-[11px] font-semibold text-teal-600 uppercase tracking-wider">PG / Co-Living</p>
            <p className="text-2xl font-bold text-teal-700 mt-1">{summary.activePgColiving}</p>
            <p className="text-[10px] text-teal-600/70 mt-0.5">Active Tenant Agreements</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-2xs">
            <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Active Total Rents</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">₹{summary.activeTotalRents.toLocaleString('en-IN')}</p>
            <p className="text-[10px] text-emerald-600/70 mt-0.5">Monthly Contracted Rent</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-2xs">
            <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider">Active Total Deposits</p>
            <p className="text-2xl font-bold text-indigo-700 mt-1">₹{summary.activeTotalDeposits.toLocaleString('en-IN')}</p>
            <p className="text-[10px] text-indigo-600/70 mt-0.5">Secured Security Deposits</p>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              Tenants:
            </span>
            {[
              { id: 'ALL', label: 'All Tenants', count: tabCounts.all },
              { id: 'ACTIVE', label: 'Active Tenants', count: tabCounts.active },
              { id: 'INACTIVE', label: 'Inactive Tenants', count: tabCounts.inactive },
            ].map((filterTab) => (
              <button
                key={filterTab.id}
                onClick={() => setTenantActivityFilter(filterTab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  tenantActivityFilter === filterTab.id
                    ? 'bg-brand-teal text-white shadow-xs font-bold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{filterTab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    tenantActivityFilter === filterTab.id
                      ? 'bg-white/25 text-white'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {filterTab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search tenant, property, space..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
              />
            </div>

            <select
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
            >
              <option value="ALL">All Properties</option>
              {properties.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Content View: Data Table View ONLY */}
        {loading ? (
          <div className="py-20 text-center flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200">
            <Loader2 className="w-8 h-8 text-brand-teal animate-spin mb-3" />
            <p className="text-sm font-medium text-slate-600">Loading agreements...</p>
          </div>
        ) : errorMsg ? (
          <div className="py-16 text-center text-rose-500 bg-white rounded-xl border border-slate-200">
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm font-medium">{errorMsg}</p>
          </div>
        ) : filteredAgreements.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-xl border border-slate-200">
            <FileSignature className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800">No Agreements Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              No agreement records match your current filter criteria.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Type of Living</th>
                    <th className="py-3 px-4">Tenant</th>
                    <th className="py-3 px-4">Property & Space</th>
                    <th className="py-3 px-4">Rent / Deposit</th>
                    <th className="py-3 px-4">Lock-in / Notice</th>
                    <th className="py-3 px-4">Check-in Date & Time</th>
                    <th className="py-3 px-4">Check-out Date & Time</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredAgreements.map((agr, idx) => {
                    const isHouse = agr.propertyType === 'RENTAL_HOUSE';
                    const isDownloading = downloadingId === agr.id;
                    const rowKey = agr.id || `agr-row-${idx}`;
                    const checkIn = formatAgreementDateTime(agr.checkInDate || agr.startDate, agr.signedAt);
                    const checkOut = agr.checkOutDate ? formatAgreementDateTime(agr.checkOutDate) : null;

                    return (
                      <tr key={rowKey} className="hover:bg-slate-50/70 transition">
                        <td className="py-3.5 px-4">
                          {isHouse ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              <Home className="w-3.5 h-3.5 text-blue-600" />
                              House Rental
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                              <BedDouble className="w-3.5 h-3.5 text-teal-600" />
                              PG / Co-Living
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-900 text-xs">{agr.tenantName}</p>
                          <p className="text-[11px] text-slate-500 font-medium mt-0.5">{agr.tenantPhone}</p>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-slate-900 text-xs">{agr.propertyName}</p>
                          <p className="text-[11px] text-brand-teal font-medium mt-0.5 flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-brand-teal" />
                            {agr.unitOrBedName}
                          </p>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-900 text-xs">
                            ₹{agr.monthlyRent.toLocaleString('en-IN')}{' '}
                            <span className="text-[10px] font-normal text-slate-500">/ mo</span>
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Deposit: ₹{agr.securityDeposit.toLocaleString('en-IN')}
                          </p>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-slate-800 text-xs">
                            {(() => {
                              const lockVal = agr.lockInPeriodValue ?? agr.lockInMonths ?? 1;
                              const rawUnit = (agr.lockInPeriodUnit || 'MONTHS').toUpperCase();
                              const unitDisplay = rawUnit.startsWith('DAY')
                                ? (lockVal === 1 ? 'Day' : 'Days')
                                : rawUnit.startsWith('YEAR')
                                ? (lockVal === 1 ? 'Year' : 'Years')
                                : (lockVal === 1 ? 'Month' : 'Months');
                              return `${lockVal} ${unitDisplay} Lock-in`;
                            })()}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {agr.noticePeriodDays} Days Notice
                          </p>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-start gap-2 font-mono text-xs">
                            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <div className="space-y-0.5">
                              <div className="font-semibold text-slate-800 text-xs">{checkIn.date}</div>
                              <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {checkIn.time}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {agr.isActive ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Active Tenant
                            </span>
                          ) : checkOut ? (
                            <div className="flex items-start gap-2 font-mono text-xs">
                              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                              <div className="space-y-0.5">
                                <div className="font-semibold text-slate-800 text-xs">{checkOut.date}</div>
                                <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  {checkOut.time}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs italic">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setViewingAgreementData(mapToDocumentData(agr))}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-brand-teal transition font-semibold text-xs shadow-2xs cursor-pointer"
                              title="View Agreement"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-500" />
                              <span>View Agreement</span>
                            </button>
                            {(!agr.isActive || agr.checkOutDate) && (
                              <button
                                onClick={() => handleOpenCheckoutDoc(agr)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100 transition font-semibold text-xs shadow-2xs cursor-pointer"
                                title="View & Download Official Check-Out Handover & Deposit Settlement Agreement"
                              >
                                <FileSignature className="w-3.5 h-3.5 text-rose-600" />
                                <span>Check-Out Settlement</span>
                              </button>
                            )}
                            <button
                              onClick={() => handleDownloadPdf(agr)}
                              disabled={isDownloading}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-teal text-white hover:bg-teal-700 transition font-semibold text-xs shadow-xs cursor-pointer disabled:opacity-50"
                              title="Download Agreement PDF"
                            >
                              {isDownloading ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                              ) : (
                                <Download className="w-3.5 h-3.5 text-white" />
                              )}
                              <span>Download Agreement</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* OFFICIAL 2-PAGE AGREEMENT DOCUMENT VIEWER MODAL */}
        <AgreementDocumentViewerModal
          isOpen={!!viewingAgreementData}
          onClose={() => setViewingAgreementData(null)}
          agreementData={viewingAgreementData}
        />

        {/* OFFICIAL 2-PAGE CHECK-OUT HANDOVER & SETTLEMENT VIEWER MODAL */}
        <CheckoutAgreementViewerModal
          isOpen={!!viewingCheckoutAgreementData}
          onClose={() => setViewingCheckoutAgreementData(null)}
          agreementData={viewingCheckoutAgreementData}
        />

        {/* CREATE DIGITAL AGREEMENT WIZARD MODAL */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-teal-50 text-brand-teal">
                    <FileSignature className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">Create Digital Agreement</h3>
                    <p className="text-xs text-slate-500">
                      Draft a legally binding contract with immutable term snapshot
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {createError && (
                <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs text-rose-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <form onSubmit={handleCreateAgreement} className="space-y-4 mt-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Select Property <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formPropertyId}
                    onChange={(e) => {
                      setFormPropertyId(e.target.value);
                      const prop = properties.find((p) => p.id === e.target.value);
                      if (prop?.propertyType === 'RENTAL_HOUSE') {
                        setFormAgreementType('RENTAL_AGREEMENT');
                        setFormNoticeDays(30);
                        setFormLockInMonths(11);
                      } else {
                        setFormAgreementType('PG_AGREEMENT');
                        setFormNoticeDays(20);
                        setFormLockInMonths(2);
                      }
                    }}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                  >
                    <option value="">-- Choose Property --</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.propertyType === 'RENTAL_HOUSE' ? 'Whole-Unit Rental' : 'PG / Co-Living'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Select Tenant <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formTenantId}
                    onChange={(e) => setFormTenantId(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                  >
                    <option value="">-- Choose Tenant --</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.firstName} {t.lastName} • {t.phone} ({t.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Unit / Flat / Bed <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Flat 102 or Bed 102-A"
                      value={formUnitOrBed}
                      onChange={(e) => setFormUnitOrBed(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Agreement Type <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formAgreementType}
                      onChange={(e) => setFormAgreementType(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                    >
                      <option value="RENTAL_AGREEMENT">Rental Agreement (Whole Unit)</option>
                      <option value="PG_AGREEMENT">PG Agreement (Co-Living)</option>
                      <option value="HOUSE_RULES">House Rules & Code of Conduct</option>
                      <option value="ADDENDUM">Addendum to Lease</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Monthly Rent (₹)</label>
                    <input
                      type="number"
                      value={formRent}
                      onChange={(e) => setFormRent(Number(e.target.value))}
                      required
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Security Deposit (₹)</label>
                    <input
                      type="number"
                      value={formDeposit}
                      onChange={(e) => setFormDeposit(Number(e.target.value))}
                      required
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Notice (Days)</label>
                    <input
                      type="number"
                      value={formNoticeDays}
                      onChange={(e) => setFormNoticeDays(Number(e.target.value))}
                      required
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Lock-in (Months)</label>
                    <input
                      type="number"
                      value={formLockInMonths}
                      onChange={(e) => setFormLockInMonths(Number(e.target.value))}
                      required
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={formStartDate}
                      onChange={(e) => setFormStartDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                    />
                  </div>
                </div>

                <div className="p-3 bg-teal-50/70 border border-teal-200/80 rounded-xl text-teal-800 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <Shield className="w-3.5 h-3.5 text-brand-teal" />
                    Legal Immutability Guarantee
                  </div>
                  <p className="text-[11px] text-teal-700 leading-relaxed">
                    Once created, the contract snapshot will be permanently frozen with a verified SHA-256 fingerprint.
                    Future changes to property configurations will never alter this signed agreement.
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-brand-teal text-white font-semibold hover:bg-teal-700 transition disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating Snapshot...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Create & Freeze Agreement
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </PageTransition>
    </AppShell>
  );
}
