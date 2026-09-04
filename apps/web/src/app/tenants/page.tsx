'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { BackButton } from '@/components/ui/BackButton';
import { useAuth } from '@/lib/auth-context';
import { TenantDto, TenantStatus, KycDocumentType } from '@propertyos/types';
import {
  Users,
  Search,
  CheckCircle2,
  Phone,
  Mail,
  Building2,
  BedDouble,
  Home,
  Calendar,
  X,
  Loader2,
  Edit,
  UserMinus,
  ArrowUpRight,
  Building,
  UserCheck,
  Eye,
  AlertCircle,
  RefreshCw,
  UploadCloud,
  FileCheck,
  FileText,
  User,
  ShieldCheck,
  MapPin,
  Briefcase,
  PhoneCall,
  Save,
  Lock,
  Sparkles,
  FileSignature,
  Download,
} from 'lucide-react';
import {
  AgreementDocumentViewerModal,
  AgreementDocumentData,
} from '@/components/agreements/AgreementDocumentViewerModal';
import { formatIdProofDisplay } from '@/components/agreements/AgreementSignModal';
import {
  saveAgreementSignature,
  getOrGenerateAgreementSignature,
  generateDigitalSignatureDataUrl,
} from '@/lib/agreementStorage';
import { getOwnerProfile, onOwnerProfileChange, OwnerProfileData } from '@/lib/ownerProfileStorage';
import { getLocalDateString, createLocalIsoString, formatAgreementDate } from '@/lib/date-utils';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

interface ExtendedTenantDto extends TenantDto {
  gender?: string | null;
  currentStay?: {
    id: string;
    checkInDate: string;
    monthlyRent: number;
    bedId: string;
    bedNumber: string;
    roomId: string;
    roomNumber: string;
    floorName: string;
    propertyId: string;
    propertyName: string;
  } | null;
  currentLease?: {
    id: string;
    status?: string;
    startDate: string;
    endDate: string;
    monthlyRent: number;
    unitNumber: string;
    propertyId: string;
    propertyName: string;
  } | null;
  stayHistories?: {
    id: string;
    checkInDate: string;
    checkOutDate?: string | null;
    monthlyRent: number;
    bedId: string;
    bedNumber: string;
    roomId?: string;
    roomNumber?: string;
    propertyId?: string;
    propertyName?: string;
    createdAt?: string | Date;
  }[];
  leases?: {
    id: string;
    status: string;
    startDate: string;
    endDate?: string | null;
    monthlyRent: number;
    rentalUnitId?: string;
    unitNumber?: string;
    propertyId?: string;
    propertyName?: string;
    createdAt?: string | Date;
    updatedAt?: string | Date;
  }[];
  stayHistoriesCount?: number;
  pastStaysCount?: number;
  documents?: {
    id: string;
    documentType: string;
    documentNumber?: string | null;
    fileUrl?: string | null;
  }[];
}

// Individual Tenancy / Stay Record
interface TenancyRecord {
  recordId: string;
  tenantId: string;
  tenantName: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  gender?: string | null;
  status: 'CHECKED_IN' | 'CHECKED_OUT';
  isActiveStay: boolean;
  propertyId: string;
  propertyName: string;
  unitOrBedNumber: string;
  isRentalUnit: boolean;
  checkInDate: string | Date | null;
  checkOutDate: string | Date | null;
  monthlyRent: number;
  securityDeposit: number;
  actionTimestamp: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  tenantData: ExtendedTenantDto;
}

export default function TenantsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [tenants, setTenants] = useState<ExtendedTenantDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'CHECKED_IN' | 'CHECKED_OUT'>('ALL');
  const [propertyFilter, setPropertyFilter] = useState<string>('ALL');
  const [propertiesList, setPropertiesList] = useState<{ id: string; name: string }[]>([]);
  const [fullPropertiesMap, setFullPropertiesMap] = useState<Map<string, any>>(new Map());

  // Modals
  const [selectedEditTenant, setSelectedEditTenant] = useState<ExtendedTenantDto | null>(null);
  const [viewingAgreementData, setViewingAgreementData] = useState<AgreementDocumentData | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<OwnerProfileData>(() => getOwnerProfile(user));

  useEffect(() => {
    setOwnerProfile(getOwnerProfile(user));
    const unsubscribe = onOwnerProfileChange((updated) => {
      setOwnerProfile(updated);
    });
    return unsubscribe;
  }, [user]);

  // Action states
  const [processingAction, setProcessingAction] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const calculateAge = (dobString?: string | null): string => {
    if (!dobString) return '';
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return '';
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age >= 0 ? String(age) : '';
  };

  // Edit Form State matching Image 3 structure
  const [editFormData, setEditFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    dateOfBirth: '',
    age: '',
    documentType: 'AADHAAR_CARD',
    documentNumber: '',
    permanentAddress: '',
    permanentCity: '',
    permanentState: '',
    permanentPostalCode: '',
    occupation: '',
    employerOrCollege: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: '',
  });

  const [selectedDocFile, setSelectedDocFile] = useState<File | null>(null);

  const fetchTenantsAndProperties = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      else setRefreshing(true);

      const timestamp = Date.now();
      const [tenantsRes, propsRes] = await Promise.all([
        fetch(`${API_BASE}/tenants?_t=${timestamp}`, {
          credentials: 'include',
          cache: 'no-store',
        }),
        fetch(`${API_BASE}/properties?_t=${timestamp}`, {
          credentials: 'include',
          cache: 'no-store',
        }),
      ]);

      if (tenantsRes.ok) {
        const json = await tenantsRes.json();
        setTenants(json.data || []);
      }

      if (propsRes.ok) {
        const pJson = await propsRes.json();
        const pMap = new Map<string, { id: string; name: string }>();
        const fullMap = new Map<string, any>();
        (pJson.data || []).forEach((p: any) => {
          if (p && p.id) {
            fullMap.set(p.id, p);
            if (p.name) fullMap.set(p.name.toLowerCase().trim(), p);
            if (!pMap.has(p.id)) {
              pMap.set(p.id, { id: p.id, name: p.name });
            }
          }
        });
        setFullPropertiesMap(fullMap);
        setPropertiesList(Array.from(pMap.values()));
      }
    } catch (err) {
      console.error('Failed to load tenants data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTenantsAndProperties();

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('propertyos_realtime_events');
      bc.onmessage = () => {
        fetchTenantsAndProperties(true);
      };
    } catch {}

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'propertyos_last_tenancy_event') {
        fetchTenantsAndProperties(true);
      }
    };
    window.addEventListener('storage', onStorage);

    const onCustomEvent = () => {
      fetchTenantsAndProperties(true);
    };
    window.addEventListener('propertyos_tenancy_event', onCustomEvent);

    // 2-second polling interval for live real-time synchronization
    const interval = setInterval(() => {
      fetchTenantsAndProperties(true);
    }, 2000);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('propertyos_tenancy_event', onCustomEvent);
      clearInterval(interval);
    };
  }, [fetchTenantsAndProperties]);

  // Real-time automatic revalidation when window gets focused or tab becomes visible
  useEffect(() => {
    const onFocus = () => fetchTenantsAndProperties(true);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchTenantsAndProperties(true);
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [fetchTenantsAndProperties]);

  // Format Dates and Times cleanly (e.g. "28 Aug 2026, 08:20 PM")
  const formatDateTime = (dateStr?: string | Date | null, timeFallback?: string | Date | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '—';

      const datePart = d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      let timeObj: Date | null = null;
      const isMidnightUtc =
        (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) ||
        (d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0);

      if (!isMidnightUtc) {
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

      if (!timeObj && timeFallback) {
        const tf = new Date(timeFallback);
        if (!isNaN(tf.getTime())) timeObj = tf;
      }

      const timePart = timeObj
        ? timeObj.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          })
        : null;

      return (
        <div className="space-y-0.5">
          <div className="font-semibold text-slate-800 text-xs">{datePart}</div>
          {timePart && <div className="text-[10px] text-slate-500 font-mono">{timePart}</div>}
        </div>
      );
    } catch {
      return String(dateStr).split('T')[0] || '—';
    }
  };

  // Smart sanitization to avoid duplicated "Flat Flat 102" or "Bed Bed 101"
  const formatBedOrUnit = (rawName?: string, isRental?: boolean) => {
    if (!rawName || rawName === '—' || rawName === 'No active bed') return '—';
    const cleaned = rawName.trim();
    if (/^(flat|unit|house|villa|apt|apartment|suite|bed)\b/i.test(cleaned)) {
      return cleaned;
    }
    return isRental ? `Flat ${cleaned}` : `Bed ${cleaned}`;
  };

  // All Real-Time Tenancy Records (Interleaved Chronological Check-Ins & Check-Outs)
  const allTenancyRecords = useMemo<TenancyRecord[]>(() => {
    const records: TenancyRecord[] = [];

    const getSafeTime = (dateVal?: string | Date | null, fallbackDateVal?: string | Date | null): number => {
      if (dateVal) {
        const d = new Date(dateVal);
        const t = d.getTime();
        if (!isNaN(t) && t > 0) return t;
      }
      if (fallbackDateVal) {
        const f = new Date(fallbackDateVal);
        const ft = f.getTime();
        if (!isNaN(ft) && ft > 0) return ft;
      }
      return 0;
    };

    tenants.forEach((t) => {
      const fullName = `${t.firstName} ${t.lastName === '—' ? '' : t.lastName}`.trim();

      // 1. Process PG Stays from stayHistories
      if (t.stayHistories && t.stayHistories.length > 0) {
        t.stayHistories.forEach((s) => {
          const rent = Number(s.monthlyRent) || 0;
          // Check-in action timestamp: exact creation or checkin date
          const checkInTime = getSafeTime(s.createdAt) || getSafeTime(s.checkInDate) || Date.now();
          const isActive = !s.checkOutDate && (t.status === 'ACTIVE' || !s.checkOutDate);

          // Check-In Event Record
          records.push({
            recordId: `stay-checkin-${s.id}`,
            tenantId: t.id,
            tenantName: fullName,
            firstName: t.firstName,
            lastName: t.lastName,
            phone: t.phone,
            email: t.email,
            gender: t.gender,
            status: 'CHECKED_IN',
            isActiveStay: isActive,
            propertyId: s.propertyId || '',
            propertyName: s.propertyName || '—',
            unitOrBedNumber: formatBedOrUnit(s.bedNumber, false),
            isRentalUnit: false,
            checkInDate: s.checkInDate || s.createdAt || null,
            checkOutDate: isActive ? null : (s.checkOutDate || null),
            monthlyRent: rent,
            securityDeposit: rent * 2,
            actionTimestamp: checkInTime,
            createdAt: s.createdAt,
            updatedAt: t.updatedAt,
            tenantData: t,
          });

          // Check-Out Event Record (only if vacated)
          if (s.checkOutDate) {
            let checkOutTime = getSafeTime(s.checkOutDate) || (checkInTime + 1000);
            if (checkOutTime <= checkInTime) {
              checkOutTime = checkInTime + 1000;
            }

            records.push({
              recordId: `stay-checkout-${s.id}`,
              tenantId: t.id,
              tenantName: fullName,
              firstName: t.firstName,
              lastName: t.lastName,
              phone: t.phone,
              email: t.email,
              gender: t.gender,
              status: 'CHECKED_OUT',
              isActiveStay: false,
              propertyId: s.propertyId || '',
              propertyName: s.propertyName || '—',
              unitOrBedNumber: formatBedOrUnit(s.bedNumber, false),
              isRentalUnit: false,
              checkInDate: s.checkInDate || s.createdAt || null,
              checkOutDate: s.checkOutDate,
              monthlyRent: rent,
              securityDeposit: rent * 2,
              actionTimestamp: checkOutTime,
              createdAt: s.createdAt,
              updatedAt: s.checkOutDate,
              tenantData: t,
            });
          }
        });
      } else if (t.currentStay) {
        const rent = Number(t.currentStay.monthlyRent) || 0;
        const checkInTime = getSafeTime(t.currentStay.checkInDate, t.createdAt) || Date.now();
        records.push({
          recordId: `current-stay-${t.currentStay.id || t.id}`,
          tenantId: t.id,
          tenantName: fullName,
          firstName: t.firstName,
          lastName: t.lastName,
          phone: t.phone,
          email: t.email,
          gender: t.gender,
          status: 'CHECKED_IN',
          isActiveStay: true,
          propertyId: t.currentStay.propertyId || '',
          propertyName: t.currentStay.propertyName || '—',
          unitOrBedNumber: formatBedOrUnit(t.currentStay.bedNumber, false),
          isRentalUnit: false,
          checkInDate: t.currentStay.checkInDate || null,
          checkOutDate: null,
          monthlyRent: rent,
          securityDeposit: rent * 2,
          actionTimestamp: checkInTime,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          tenantData: t,
        });
      }

      // 2. Process Whole-Unit Leases
      if (t.leases && t.leases.length > 0) {
        t.leases.forEach((l) => {
          const isActive = l.status === 'ACTIVE';
          const rent = Number(l.monthlyRent) || 0;
          // Check-in action timestamp: exact creation or start date
          const checkInTime = getSafeTime(l.createdAt) || getSafeTime(l.startDate) || Date.now();

          const nowMs = Date.now();
          const endDateMs = getSafeTime(l.endDate);
          // If endDate is more than 24 hours in the future, it's the scheduled future expiry, not the checkout date
          const isFutureScheduledEnd = endDateMs > (nowMs + 86400000);
          const actualCheckOutDate = (!isFutureScheduledEnd && endDateMs > 0) ? l.endDate : (l.updatedAt || l.startDate);

          // Lease Check-In Record
          records.push({
            recordId: `lease-checkin-${l.id}`,
            tenantId: t.id,
            tenantName: fullName,
            firstName: t.firstName,
            lastName: t.lastName,
            phone: t.phone,
            email: t.email,
            gender: t.gender,
            status: 'CHECKED_IN',
            isActiveStay: isActive,
            propertyId: l.propertyId || '',
            propertyName: l.propertyName || '—',
            unitOrBedNumber: formatBedOrUnit(l.unitNumber, true),
            isRentalUnit: true,
            checkInDate: l.startDate || l.createdAt || null,
            checkOutDate: isActive ? null : (actualCheckOutDate || null),
            monthlyRent: rent,
            securityDeposit: rent * 2,
            actionTimestamp: checkInTime,
            createdAt: l.createdAt,
            updatedAt: t.updatedAt,
            tenantData: t,
          });

          // Lease Termination / Check-Out Record
          if (!isActive && l.status !== 'NOTICE') {
            let checkOutTime = (!isFutureScheduledEnd && endDateMs > 0) ? endDateMs : (getSafeTime(l.updatedAt) || (checkInTime + 1000));
            if (checkOutTime <= checkInTime) {
              checkOutTime = checkInTime + 1000;
            }

            records.push({
              recordId: `lease-checkout-${l.id}`,
              tenantId: t.id,
              tenantName: fullName,
              firstName: t.firstName,
              lastName: t.lastName,
              phone: t.phone,
              email: t.email,
              gender: t.gender,
              status: 'CHECKED_OUT',
              isActiveStay: false,
              propertyId: l.propertyId || '',
              propertyName: l.propertyName || '—',
              unitOrBedNumber: formatBedOrUnit(l.unitNumber, true),
              isRentalUnit: true,
              checkInDate: l.startDate || l.createdAt || null,
              checkOutDate: actualCheckOutDate || null,
              monthlyRent: rent,
              securityDeposit: rent * 2,
              actionTimestamp: checkOutTime,
              createdAt: l.createdAt,
              updatedAt: l.updatedAt,
              tenantData: t,
            });
          }
        });
      } else if (t.currentLease) {
        const rent = Number(t.currentLease.monthlyRent) || 0;
        const actionTime = getSafeTime(t.currentLease.startDate, t.createdAt) || Date.now();
        records.push({
          recordId: `current-lease-${t.currentLease.id || t.id}`,
          tenantId: t.id,
          tenantName: fullName,
          firstName: t.firstName,
          lastName: t.lastName,
          phone: t.phone,
          email: t.email,
          gender: t.gender,
          status: 'CHECKED_IN',
          isActiveStay: true,
          propertyId: t.currentLease.propertyId || '',
          propertyName: t.currentLease.propertyName || '—',
          unitOrBedNumber: formatBedOrUnit(t.currentLease.unitNumber, true),
          isRentalUnit: true,
          checkInDate: t.currentLease.startDate || null,
          checkOutDate: null,
          monthlyRent: rent,
          securityDeposit: rent * 2,
          actionTimestamp: actionTime,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          tenantData: t,
        });
      }
    });

    return records.sort((a, b) => b.actionTimestamp - a.actionTimestamp);
  }, [tenants]);

  // Strict Filter for Table Records
  const filteredRecords = useMemo(() => {
    return allTenancyRecords.filter((rec) => {
      // 1. Tab filter
      if (activeTab === 'CHECKED_IN' && rec.status !== 'CHECKED_IN') return false;
      if (activeTab === 'CHECKED_OUT' && rec.status !== 'CHECKED_OUT') return false;

      // 2. Exact Property ID filter (Strict property match, avoiding partial name match)
      if (propertyFilter !== 'ALL' && rec.propertyId !== propertyFilter) {
        return false;
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          rec.tenantName.toLowerCase().includes(q) ||
          rec.phone.toLowerCase().includes(q) ||
          (rec.email || '').toLowerCase().includes(q) ||
          rec.unitOrBedNumber.toLowerCase().includes(q) ||
          rec.propertyName.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [allTenancyRecords, activeTab, propertyFilter, searchQuery]);

  // Tab Badge Counts for All Tenancies, Checked In, Checked Out
  const tabCounts = useMemo(() => {
    const propertyScoped =
      propertyFilter === 'ALL'
        ? allTenancyRecords
        : allTenancyRecords.filter((r) => r.propertyId === propertyFilter);
    return {
      ALL: propertyScoped.length,
      CHECKED_IN: propertyScoped.filter((r) => r.status === 'CHECKED_IN').length,
      CHECKED_OUT: propertyScoped.filter((r) => r.status === 'CHECKED_OUT').length,
    };
  }, [allTenancyRecords, propertyFilter]);

  // Deduplicated Tenant Metrics (No Duplicates)
  const metrics = useMemo(() => {
    // Only count tenants who actually have at least 1 check-in or stay record
    const tenantsWithRecords = tenants.filter(
      (t) =>
        (t.stayHistories && t.stayHistories.length > 0) ||
        (t.leases && t.leases.length > 0) ||
        Boolean(t.currentStay) ||
        Boolean(t.currentLease)
    );

    const relevantTenants =
      propertyFilter === 'ALL'
        ? tenantsWithRecords
        : tenantsWithRecords.filter(
            (t) =>
              (t.stayHistories && t.stayHistories.some((s) => s.propertyId === propertyFilter)) ||
              (t.leases && t.leases.some((l) => l.propertyId === propertyFilter)) ||
              t.currentStay?.propertyId === propertyFilter ||
              t.currentLease?.propertyId === propertyFilter
          );

    const checkedInTenants = relevantTenants.filter((t) => {
      if (propertyFilter === 'ALL') {
        return (
          t.status === TenantStatus.ACTIVE ||
          Boolean(t.currentStay) ||
          (t.stayHistories && t.stayHistories.some((s: any) => !s.checkOutDate)) ||
          t.currentLease?.status === 'ACTIVE' ||
          (t.leases && t.leases.some((l: any) => l.status === 'ACTIVE'))
        );
      }
      return (
        (t.status === TenantStatus.ACTIVE &&
          ((t.stayHistories && t.stayHistories.some((s: any) => s.propertyId === propertyFilter && !s.checkOutDate)) ||
            t.currentStay?.propertyId === propertyFilter)) ||
        (t.currentLease?.propertyId === propertyFilter && t.currentLease?.status === 'ACTIVE') ||
        (t.leases && t.leases.some((l: any) => l.propertyId === propertyFilter && l.status === 'ACTIVE'))
      );
    });

    const checkedOutTenants = relevantTenants.filter(
      (t) => !checkedInTenants.some((active) => active.id === t.id)
    );

    return {
      totalTenants: relevantTenants.length,
      checkedIn: checkedInTenants.length,
      checkedOut: checkedOutTenants.length,
    };
  }, [tenants, propertyFilter]);

  // Edit Modal Handlers
  const handleOpenEditModal = (t: ExtendedTenantDto) => {
    setSelectedEditTenant(t);
    setSelectedDocFile(null);

    const doc = t.documents && t.documents[0];
    const dobFormatted = t.dateOfBirth ? getLocalDateString(t.dateOfBirth) : '';
    
    let docType = 'AADHAAR_CARD';
    if (doc?.documentType) {
      const dt = String(doc.documentType).toUpperCase();
      if (dt.includes('PAN')) docType = 'PAN_CARD';
      else if (dt.includes('PASS')) docType = 'PASSPORT';
      else if (dt.includes('DRIV')) docType = 'DRIVING_LICENSE';
      else if (dt.includes('VOTE')) docType = 'VOTER_ID';
      else if (dt.includes('AADHAAR')) docType = 'AADHAAR_CARD';
      else docType = 'OTHER';
    }

    const docNum = doc?.documentNumber || (t as any).documentNumber || (t as any).governmentIdNumber || '';

    setEditFormData({
      firstName: t.firstName || '',
      lastName: t.lastName === '—' ? '' : t.lastName || '',
      phone: t.phone || '',
      email: t.email || '',
      dateOfBirth: dobFormatted,
      age: calculateAge(dobFormatted),
      documentType: docType,
      documentNumber: docNum,
      permanentAddress: t.permanentAddress || '',
      permanentCity: t.permanentCity || '',
      permanentState: t.permanentState || '',
      permanentPostalCode: t.permanentPostalCode || '',
      occupation: t.occupation || '',
      employerOrCollege: t.employerOrCollege || '',
      emergencyContactName: t.emergencyContactName || '',
      emergencyContactPhone: t.emergencyContactPhone || '',
      emergencyContactRelation: t.emergencyContactRelation || '',
    });
  };

  const handleOpenAgreementDoc = (rec: TenancyRecord) => {
    const t = rec.tenantData;
    const doc = t.documents?.find(
      (d) =>
        d.documentType?.includes('AADHAAR') ||
        d.documentType?.includes('PAN') ||
        d.documentType?.includes('PASS')
    );
    const docNum = doc?.documentNumber || (t as any).documentNumber || (t as any).governmentIdNumber;
    const docType = doc?.documentType || 'Aadhaar Card';

    const prop =
      (rec.propertyId && fullPropertiesMap.get(rec.propertyId)) ||
      (rec.propertyName && fullPropertiesMap.get(rec.propertyName.toLowerCase().trim()));

    const userName = ownerProfile.fullName;
    const fallbackOwnerName = ownerProfile.fullName || prop?.ownerName?.trim() || (userName && userName !== '—' ? userName : 'Landlord');
    const fallbackOwnerPhone = ownerProfile.phone || prop?.ownerPhone || prop?.contactPhone || user?.phone || '';
    const fallbackOwnerAddress =
      ownerProfile.address ||
      prop?.ownerAddress ||
      (prop
        ? `${prop.address}, ${prop.city || 'Bengaluru'}, ${prop.state || 'Karnataka'}`
        : '#12, Royal Palm Residency, Indiranagar, Bengaluru, Karnataka - 560038');
    const fallbackOwnerSignature =
      ownerProfile.signature || prop?.ownerSignature || '';

    const effectiveBedId = t.currentStay?.bedId || (rec.unitOrBedNumber.toLowerCase().includes('bed') ? rec.unitOrBedNumber : undefined);
    const effectiveUnitId = (t.currentLease as any)?.rentalUnitId || (t.currentLease as any)?.id;

    const propDisplayAddress = prop?.address
      ? `${prop.address}, ${prop.city || 'Coimbatore'}, ${prop.state || 'Tamil Nadu'}`
      : `${rec.propertyName !== '—' ? rec.propertyName : (rec.isRentalUnit ? 'Residential Property' : 'Test PG')}, Coimbatore, Tamil Nadu`;

    const sigPkg = getOrGenerateAgreementSignature({
      bedId: effectiveBedId,
      unitId: effectiveUnitId,
      tenantId: t.id,
      tenantName: rec.tenantName,
      tenantPhone: rec.phone,
      unitName: rec.unitOrBedNumber,
      emergencyContactName: t.emergencyContactName,
      emergencyContactPhone: t.emergencyContactPhone,
      moveInDate: rec.checkInDate ? getLocalDateString(rec.checkInDate) : undefined,
      startDate: rec.checkInDate ? getLocalDateString(rec.checkInDate) : undefined,
      monthlyRent: rec.monthlyRent,
      securityDeposit: rec.securityDeposit,
      noticePeriodDays: prop?.noticePeriodDays ?? 30,
      lockInMonths: prop?.lockInMonths ?? 1,
      lockInPeriodValue: prop?.lockInPeriodValue ?? prop?.lockInMonths ?? 1,
      lockInPeriodUnit: prop?.lockInPeriodUnit || 'MONTHS',
      propertyName: rec.propertyName !== '—' ? rec.propertyName : prop?.name,
      propertyAddress: propDisplayAddress,
      propertyType: rec.isRentalUnit ? 'RENTAL_HOUSE' : 'PG',
      ownerName: fallbackOwnerName,
      ownerPhone: fallbackOwnerPhone,
      ownerAddress: fallbackOwnerAddress,
      ownerSignature: fallbackOwnerSignature,
    });

    // LEGAL IMMUTABILITY: Prioritize frozen agreement snapshot values so future property/profile updates do not alter past documents
    const effectiveOwnerName = sigPkg.ownerName || fallbackOwnerName;
    const effectiveOwnerPhone = sigPkg.ownerPhone || fallbackOwnerPhone;
    const effectiveOwnerAddress = sigPkg.ownerAddress || fallbackOwnerAddress;
    const effectiveOwnerSignature = sigPkg.ownerSignature || fallbackOwnerSignature;
    const effectiveNoticePeriodDays = sigPkg.noticePeriodDays ?? (prop?.noticePeriodDays ?? 30);
    const effectiveLockInMonths = sigPkg.lockInMonths ?? (prop?.lockInMonths ?? 1);
    const effectiveLockInPeriodValue = sigPkg.lockInPeriodValue ?? (prop?.lockInPeriodValue ?? prop?.lockInMonths ?? 1);
    const effectiveLockInPeriodUnit = (sigPkg.lockInPeriodUnit as any) || (prop?.lockInPeriodUnit as any) || 'MONTHS';
    const effectiveMonthlyRent = sigPkg.monthlyRent || rec.monthlyRent || (rec.isRentalUnit ? 25000 : 10000);
    const effectiveSecurityDeposit = sigPkg.securityDeposit || rec.securityDeposit || (rec.monthlyRent ? rec.monthlyRent * 2 : (rec.isRentalUnit ? 50000 : 20000));

    const cleanUnitName = rec.unitOrBedNumber !== '—'
      ? (rec.isRentalUnit && !rec.unitOrBedNumber.match(/^(flat|unit|house|room)/i)
          ? `Flat ${rec.unitOrBedNumber}`
          : rec.unitOrBedNumber)
      : (rec.isRentalUnit ? 'Rental Flat' : 'Allocated Space');

    const effectiveStartDate = sigPkg.startDate || (rec.checkInDate ? getLocalDateString(rec.checkInDate) : getLocalDateString());
    const effectiveSignedAt = sigPkg.signedAt || (rec.checkInDate ? createLocalIsoString(rec.checkInDate) : new Date().toISOString());

    // Permanently lock and freeze the snapshot in persistent storage
    if (sigPkg.noticePeriodDays === undefined || sigPkg.lockInPeriodValue === undefined || !sigPkg.isExecuted) {
      saveAgreementSignature({
        ...sigPkg,
        bedId: effectiveBedId || sigPkg.bedId,
        unitId: effectiveUnitId || sigPkg.unitId,
        tenantId: t.id || sigPkg.tenantId,
        tenantName: sigPkg.tenantName || rec.tenantName,
        isExecuted: true,
        isSigned: true,
        noticePeriodDays: effectiveNoticePeriodDays,
        lockInMonths: effectiveLockInMonths,
        lockInPeriodValue: effectiveLockInPeriodValue,
        lockInPeriodUnit: effectiveLockInPeriodUnit,
        monthlyRent: effectiveMonthlyRent,
        securityDeposit: effectiveSecurityDeposit,
        startDate: effectiveStartDate,
        signedAt: effectiveSignedAt,
        propertyName: sigPkg.propertyName || (rec.propertyName !== '—' ? rec.propertyName : prop?.name),
        propertyAddress: sigPkg.propertyAddress || propDisplayAddress,
        propertyType: rec.isRentalUnit ? 'RENTAL_HOUSE' : 'PG',
        ownerName: effectiveOwnerName,
        ownerPhone: effectiveOwnerPhone,
        ownerAddress: effectiveOwnerAddress,
        ownerSignature: effectiveOwnerSignature,
      });
    }

    const agreement: AgreementDocumentData = {
      id: rec.recordId,
      tenantName: sigPkg.tenantName || rec.tenantName,
      tenantPhone: sigPkg.tenantPhone || rec.phone,
      tenantEmail: sigPkg.tenantEmail || rec.email || undefined,
      tenantAddress: sigPkg.tenantAddress || (t.permanentAddress
        ? `${t.permanentAddress}, ${t.permanentCity || 'Bengaluru'}, ${t.permanentState || 'Karnataka'} — ${t.permanentPostalCode || '560001'}`
        : 'Resident Address on Record'),
      tenantAadhaar: sigPkg.tenantAadhaar || (formatIdProofDisplay(docType, docNum) || 'Government Photo ID Verified'),
      ownerName: effectiveOwnerName,
      ownerPhone: effectiveOwnerPhone,
      ownerAddress: effectiveOwnerAddress,
      ownerSignature: effectiveOwnerSignature,
      residentSignature: sigPkg.signatureImage,
      witnesses: sigPkg.witnesses,
      propertyName: sigPkg.propertyName || (rec.propertyName !== '—' ? rec.propertyName : (prop?.name || (rec.isRentalUnit ? 'Residential Property' : 'Test PG'))),
      propertyAddress: sigPkg.propertyAddress || propDisplayAddress,
      unitOrBedName: sigPkg.unitName || cleanUnitName,
      propertyType: rec.isRentalUnit ? 'RENTAL_HOUSE' : 'PG',
      monthlyRent: effectiveMonthlyRent,
      securityDeposit: effectiveSecurityDeposit,
      lockInMonths: effectiveLockInMonths,
      lockInPeriodValue: effectiveLockInPeriodValue,
      lockInPeriodUnit: effectiveLockInPeriodUnit,
      noticePeriodDays: effectiveNoticePeriodDays,
      startDate: effectiveStartDate,
      endDate: sigPkg.endDate || (rec.checkOutDate ? getLocalDateString(rec.checkOutDate) : undefined),
      signedAt: effectiveSignedAt,
      status: rec.status,
    };

    setViewingAgreementData(agreement);
  };

  const handleSaveEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEditTenant) return;

    if (!editFormData.dateOfBirth) {
      setFeedbackMsg({ type: 'error', text: 'Date of Birth is mandatory. Please provide a valid date of birth.' });
      return;
    }

    if (!editFormData.documentNumber.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Document / ID Number is mandatory. Please provide the official ID number.' });
      return;
    }

    try {
      setProcessingAction(true);

      const updatePayload: any = {
        firstName: editFormData.firstName.trim(),
        lastName: editFormData.lastName.trim() || '—',
        phone: editFormData.phone.trim(),
        email: editFormData.email.trim() || null,
        dateOfBirth: editFormData.dateOfBirth ? new Date(editFormData.dateOfBirth).toISOString() : null,
        documentType: editFormData.documentType || 'AADHAAR',
        documentNumber: editFormData.documentNumber.trim() || null,
        permanentAddress: editFormData.permanentAddress.trim() || null,
        permanentCity: editFormData.permanentCity.trim() || null,
        permanentState: editFormData.permanentState.trim() || null,
        permanentPostalCode: editFormData.permanentPostalCode.trim() || null,
        occupation: editFormData.occupation.trim() || null,
        employerOrCollege: editFormData.employerOrCollege.trim() || null,
        emergencyContactName: editFormData.emergencyContactName.trim() || null,
        emergencyContactPhone: editFormData.emergencyContactPhone.trim() || null,
        emergencyContactRelation: editFormData.emergencyContactRelation.trim() || null,
      };

      const res = await fetch(`${API_BASE}/tenants/${selectedEditTenant.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updatePayload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        setFeedbackMsg({ type: 'error', text: errJson.message || 'Failed to update tenant profile' });
        setProcessingAction(false);
        return;
      }

      // If document file is attached, upload to KYC document endpoint
      if (selectedDocFile) {
        const formData = new FormData();
        formData.append('file', selectedDocFile);
        formData.append('documentType', editFormData.documentType);
        if (editFormData.documentNumber.trim()) {
          formData.append('documentNumber', editFormData.documentNumber.trim());
        }

        await fetch(`${API_BASE}/tenants/${selectedEditTenant.id}/documents`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        }).catch((err) => console.error('Document upload error:', err));
      }

      setFeedbackMsg({ type: 'success', text: 'Tenant profile and KYC details updated successfully.' });
      setSelectedEditTenant(null);
      fetchTenantsAndProperties(true);
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Network error while updating tenant profile' });
    } finally {
      setProcessingAction(false);
    }
  };

  return (
    <AppShell activePath="/tenants">
      {/* Full-width responsive container scaling seamlessly at any screen resolution and zoom level */}
      <div className="space-y-6 w-full px-4 sm:px-6 lg:px-8 pb-16">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="mb-2">
              <BackButton fallbackHref="/" label="Back to Dashboard" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Users className="w-7 h-7 text-brand-teal" />
              Tenant Directory
            </h1>
            <p className="text-xs text-slate-500">
              Live lifecycle directory of all active and historical tenant check-ins and check-outs across your properties.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/properties"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand-teal text-white font-semibold text-xs hover:bg-teal-700 transition shadow-sm"
            >
              <Building2 className="w-4 h-4" />
              Manage Properties
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Global Feedback Banner */}
        {feedbackMsg && (
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedbackMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600" />
              )}
              <span>{feedbackMsg.text}</span>
            </div>
            <button onClick={() => setFeedbackMsg(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Balanced & Polished KPI Metrics Banner (3 Clean, Proportionate Cards - Deduplicated Zero Duplicates) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
          {/* 1. Total Tenants */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between space-y-2 hover:border-slate-300 transition">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Tenants</span>
              <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-brand-teal">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900">{metrics.totalTenants}</p>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">Total registered occupants</p>
            </div>
          </div>

          {/* 2. Checked In */}
          <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-2xs flex flex-col justify-between space-y-2 hover:border-emerald-200 transition bg-gradient-to-br from-white to-emerald-50/20">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Checked In</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                <UserCheck className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-black text-emerald-700">{metrics.checkedIn}</p>
              <p className="text-[11px] text-emerald-600/90 font-medium mt-0.5">Currently active occupants</p>
            </div>
          </div>

          {/* 3. Checked Out */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between space-y-2 hover:border-slate-300 transition bg-gradient-to-br from-white to-slate-50/40">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Checked Out</span>
              <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
                <UserMinus className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-black text-slate-700">{metrics.checkedOut}</p>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">Past / vacated occupants</p>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3.5 w-full">
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by tenant name, phone, bed (e.g. 101-A), flat, or property..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-teal text-slate-800 placeholder-slate-400"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 shrink-0">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={propertyFilter}
                  onChange={(e) => setPropertyFilter(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Properties ({propertiesList.length})</option>
                  {propertiesList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Clean Tabs: All Tenancies | Checked In | Checked Out */}
          <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
            {[
              { id: 'ALL', label: 'All Tenancies', count: tabCounts.ALL },
              { id: 'CHECKED_IN', label: 'Checked In', count: tabCounts.CHECKED_IN },
              { id: 'CHECKED_OUT', label: 'Checked Out', count: tabCounts.CHECKED_OUT },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-lg font-semibold transition text-xs flex items-center gap-2 cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-brand-teal text-white shadow-2xs font-bold'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Directory Table (Full-Width, Status-First, Distinct Tenancy Record Rows) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden w-full">
          {loading ? (
            <div className="py-20 text-center text-slate-500 flex flex-col items-center justify-center space-y-2">
              <Loader2 className="w-8 h-8 text-brand-teal animate-spin" />
              <p className="text-xs font-semibold text-slate-700">Loading tenant directory...</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="py-16 text-center text-slate-500 space-y-3">
              <Users className="w-12 h-12 text-slate-300 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-800">No records found</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {searchQuery
                    ? `No record matches "${searchQuery}". Try a different name, phone, or bed number.`
                    : propertyFilter !== 'ALL'
                    ? 'No tenants have checked into this property yet.'
                    : 'Whenever you check in a tenant to a bed or flat in any property, each stay record will appear here in real time.'}
                </p>
              </div>
              <Link
                href="/properties"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-50 border border-teal-200 text-brand-teal text-xs font-bold hover:bg-teal-100 transition"
              >
                <BedDouble className="w-3.5 h-3.5" />
                Go to Properties to Add / Check-In Tenants
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50/90 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    {/* 1. Status Column First */}
                    <th className="px-5 py-4 w-32">Status</th>
                    <th className="px-4 py-4">Tenant Name</th>
                    <th className="px-4 py-4">Contact Details</th>
                    <th className="px-4 py-4">Property Name</th>
                    <th className="px-4 py-4">Bed / Unit</th>
                    <th className="px-4 py-4">Check-In Date</th>
                    <th className="px-4 py-4">Check-Out Date</th>
                    <th className="px-4 py-4">Rent & Deposit</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredRecords.map((rec) => {
                    const isCheckedIn = rec.status === 'CHECKED_IN';

                    return (
                      <tr key={rec.recordId} className="hover:bg-slate-50/80 transition">
                        {/* 1. Status Column (First Column - Checked In / Checked Out alone) */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          {isCheckedIn ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                              Checked In
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              Checked Out
                            </span>
                          )}
                        </td>

                        {/* 2. Tenant Name */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8.5 h-8.5 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                isCheckedIn
                                  ? 'bg-teal-50 border border-teal-200 text-brand-teal'
                                  : 'bg-slate-100 border border-slate-200 text-slate-600'
                              }`}
                            >
                              {(rec.firstName || 'T').charAt(0).toUpperCase()}
                              {(rec.lastName || '').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 text-xs">
                                {rec.tenantName}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                {rec.gender || 'Resident'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 3. Contact Details */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="space-y-0.5 text-xs">
                            <div className="flex items-center gap-1.5 text-slate-800 font-semibold font-mono">
                              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{rec.phone}</span>
                            </div>
                            {rec.email ? (
                              <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                                <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate max-w-[150px]">{rec.email}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px] italic">No email</span>
                            )}
                          </div>
                        </td>

                        {/* 4. Property Name */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          {rec.propertyName && rec.propertyName !== '—' ? (
                            <div className="flex items-center gap-1.5 text-slate-800 font-semibold">
                              <Building2 className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                              <span>{rec.propertyName}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs italic">—</span>
                          )}
                        </td>

                        {/* 5. Bed / Flat Number (Clean normalized format e.g. "Flat 102" or "Bed 201-A") */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          {rec.unitOrBedNumber && rec.unitOrBedNumber !== '—' ? (
                            <div
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-bold text-xs font-mono border ${
                                rec.isRentalUnit
                                  ? 'bg-blue-50 text-blue-900 border-blue-200'
                                  : 'bg-teal-50 text-teal-900 border-teal-200'
                              }`}
                            >
                              {rec.isRentalUnit ? (
                                <Home className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              ) : (
                                <BedDouble className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                              )}
                              <span>{rec.unitOrBedNumber}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs italic">No bed assigned</span>
                          )}
                        </td>

                        {/* 6. Check-In Date & Time */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          {rec.checkInDate ? (
                            <div className="flex items-start gap-2 font-mono text-xs">
                              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                              {formatDateTime(rec.checkInDate, rec.createdAt)}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs italic">—</span>
                          )}
                        </td>

                        {/* 7. Check-Out Date & Time (Active Tenant/Resident if staying, or checked-out date/time) */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          {rec.isActiveStay ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              {rec.isRentalUnit ? 'Active Tenant' : 'Active Tenant'}
                            </span>
                          ) : rec.checkOutDate ? (
                            <div className="flex items-start gap-2 font-mono text-xs">
                              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                              {formatDateTime(rec.checkOutDate, rec.updatedAt || rec.createdAt)}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs italic">—</span>
                          )}
                        </td>

                        {/* 8. Rent and Deposit */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          {rec.monthlyRent > 0 ? (
                            <div className="space-y-0.5 text-xs">
                              <div className="font-bold text-slate-900">
                                ₹{rec.monthlyRent.toLocaleString('en-IN')}/mo
                              </div>
                              <div className="text-[11px] text-slate-500">
                                Deposit: ₹{rec.securityDeposit.toLocaleString('en-IN')}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs italic">—</span>
                          )}
                        </td>

                        {/* 9. Actions (View Tenant, Agreement PDF, Edit Profile) */}
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenAgreementDoc(rec)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-bold text-xs transition shadow-2xs cursor-pointer ${
                                rec.isRentalUnit
                                  ? 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100 hover:border-blue-300'
                                  : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-300'
                              }`}
                              title={rec.isRentalUnit ? "View & Download House Rental Agreement PDF" : "View & Download PG Accommodation Agreement PDF"}
                            >
                              <FileText className={`w-3.5 h-3.5 ${rec.isRentalUnit ? 'text-blue-700' : 'text-emerald-700'}`} />
                              <span>Agreement PDF</span>
                            </button>

                            <Link
                              href={`/tenants/${rec.tenantId}`}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border font-semibold text-xs transition shadow-2xs ${
                                rec.isRentalUnit
                                  ? 'border-blue-200 bg-blue-50/70 text-blue-700 hover:bg-blue-100'
                                  : 'border-teal-200 bg-teal-50/70 text-brand-teal hover:bg-teal-100'
                              }`}
                              title="View Tenant Profile"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View Tenant
                            </Link>

                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(rec.tenantData)}
                              title="Edit Tenant Profile & KYC"
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-brand-teal hover:bg-teal-50 transition cursor-pointer"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* MODAL: EDIT RESIDENT PROFILE & KYC DIALOG (Matches PG Model Layout)       */}
        {/* ========================================================================= */}
        {selectedEditTenant && (
          <div className="fixed inset-0 z-50 bg-brand-navy/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 text-brand-teal flex items-center justify-center font-bold border border-teal-100">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">
                        Edit Profile — {selectedEditTenant.firstName} {selectedEditTenant.lastName === '—' ? '' : selectedEditTenant.lastName}
                      </h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        KYC Verified
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Update resident identity, official ID proof, address, and emergency contact.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEditTenant(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content (Matches PG Model 1-to-1) */}
              <form onSubmit={handleSaveEditProfile} className="space-y-4 overflow-y-auto pr-1 flex-1 text-xs">
                {/* SECTION 1: PERSONAL INFORMATION */}
                <div>
                  <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5 pb-1 border-b border-slate-200">
                    Personal Information
                  </h5>
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">
                          First Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Rahul"
                          value={editFormData.firstName}
                          onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-brand-teal"
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">
                          Last Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Sharma"
                          value={editFormData.lastName}
                          onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-brand-teal"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">
                          Phone Number <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="tel"
                          required
                          placeholder="10 digit mobile number"
                          value={editFormData.phone}
                          onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-brand-teal font-mono"
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Email Address</label>
                        <input
                          type="email"
                          placeholder="rahul@example.com"
                          value={editFormData.email}
                          onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-brand-teal"
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">
                          Date of Birth <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="date"
                          required
                          value={editFormData.dateOfBirth}
                          onChange={(e) => {
                            const dob = e.target.value;
                            setEditFormData({
                              ...editFormData,
                              dateOfBirth: dob,
                              age: calculateAge(dob),
                            });
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-brand-teal"
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">
                          Age <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          required
                          min="1"
                          max="120"
                          placeholder="e.g. 24"
                          value={editFormData.age}
                          onChange={(e) => setEditFormData({ ...editFormData, age: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-brand-teal"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 2: OFFICIAL PROOF & GOVERNMENT ID */}
                <div>
                  <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5 pb-1 border-b border-slate-200">
                    Official Proof & Government ID
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Official Document Type <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={editFormData.documentType}
                        onChange={(e) => setEditFormData({ ...editFormData, documentType: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-brand-teal cursor-pointer"
                      >
                        <option value="AADHAAR_CARD">Aadhaar Card (UIDAI)</option>
                        <option value="PAN_CARD">PAN Card</option>
                        <option value="PASSPORT">Passport</option>
                        <option value="DRIVING_LICENSE">Driving License</option>
                        <option value="VOTER_ID">Voter ID Card</option>
                        <option value="OTHER">Other Official ID</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Document / ID Number <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. XXXX-XXXX-4892 / ABCDE1234F"
                        value={editFormData.documentNumber}
                        onChange={(e) => setEditFormData({ ...editFormData, documentNumber: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-brand-teal font-mono"
                      />
                    </div>
                  </div>

                  {/* Document File Upload */}
                  <div className="mt-3">
                    <label className="font-semibold text-slate-700 block mb-1">
                      Upload Official Proof Document (Aadhaar / Passport / ID)
                    </label>
                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-3.5 bg-white hover:border-brand-teal/50 transition text-center">
                      <input
                        type="file"
                        ref={fileInputRef}
                        id="edit-profile-document-upload"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setSelectedDocFile(file);
                          }
                        }}
                      />
                      {selectedDocFile ? (
                        <div className="flex items-center justify-between bg-teal-50/70 p-2 rounded-lg border border-teal-200 text-left">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded bg-teal-100 text-brand-teal flex items-center justify-center font-bold">
                              <FileCheck className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-800">{selectedDocFile.name}</p>
                              <p className="text-[10px] text-slate-500">
                                {(selectedDocFile.size / 1024).toFixed(1)} KB • Ready for upload
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedDocFile(null)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label
                          htmlFor="edit-profile-document-upload"
                          className="cursor-pointer flex flex-col items-center justify-center gap-1"
                        >
                          <UploadCloud className="w-5 h-5 text-brand-teal" />
                          <span className="text-xs font-bold text-brand-navy">
                            Click to upload document or browse files
                          </span>
                          <span className="text-[10px] text-slate-400">PDF, JPG, PNG up to 10MB</span>
                        </label>
                      )}
                    </div>
                  </div>
                </div>

                {/* SECTION 3: PERMANENT ADDRESS */}
                <div>
                  <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5 pb-1 border-b border-slate-200">
                    Permanent Address
                  </h5>
                  <div className="space-y-3">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Street Address <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="House No, Street, Landmark"
                        value={editFormData.permanentAddress}
                        onChange={(e) => setEditFormData({ ...editFormData, permanentAddress: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-brand-teal"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">
                          City <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Bengaluru"
                          value={editFormData.permanentCity}
                          onChange={(e) => setEditFormData({ ...editFormData, permanentCity: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-brand-teal"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">
                          State <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Karnataka"
                          value={editFormData.permanentState}
                          onChange={(e) => setEditFormData({ ...editFormData, permanentState: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-brand-teal"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">
                          Postal Code <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 560001"
                          value={editFormData.permanentPostalCode}
                          onChange={(e) => setEditFormData({ ...editFormData, permanentPostalCode: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-brand-teal"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 4: PROFESSIONAL / EDUCATION DETAILS */}
                <div>
                  <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5 pb-1 border-b border-slate-200">
                    Professional / Education Details
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Occupation</label>
                      <input
                        type="text"
                        placeholder="e.g. Software Engineer / Student"
                        value={editFormData.occupation}
                        onChange={(e) => setEditFormData({ ...editFormData, occupation: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-brand-teal"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Employer or College Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Infosys / RV College"
                        value={editFormData.employerOrCollege}
                        onChange={(e) => setEditFormData({ ...editFormData, employerOrCollege: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-brand-teal"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 5: EMERGENCY CONTACT DETAILS */}
                <div>
                  <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5 pb-1 border-b border-slate-200">
                    Emergency Contact Details
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Contact Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Ramesh Sharma"
                        value={editFormData.emergencyContactName}
                        onChange={(e) => setEditFormData({ ...editFormData, emergencyContactName: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-brand-teal"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Contact Phone <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="e.g. 9876543210"
                        value={editFormData.emergencyContactPhone}
                        onChange={(e) => setEditFormData({ ...editFormData, emergencyContactPhone: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-brand-teal"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Relationship <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Father / Mother"
                        value={editFormData.emergencyContactRelation}
                        onChange={(e) => setEditFormData({ ...editFormData, emergencyContactRelation: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-brand-teal"
                      />
                    </div>
                  </div>
                </div>

                {/* Form Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedEditTenant(null)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg font-semibold text-xs transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={processingAction}
                    className="px-5 py-2 bg-brand-teal hover:bg-teal-700 text-white rounded-lg font-bold text-xs transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {processingAction ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* AGREEMENT DOCUMENT PDF VIEWER & DOWNLOADER MODAL */}
        <AgreementDocumentViewerModal
          isOpen={!!viewingAgreementData}
          onClose={() => setViewingAgreementData(null)}
          agreementData={viewingAgreementData}
        />
      </div>
    </AppShell>
  );
}
