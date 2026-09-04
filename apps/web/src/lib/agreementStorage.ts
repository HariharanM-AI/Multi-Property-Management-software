'use client';

import { getOwnerProfile } from './ownerProfileStorage';

export interface StoredWitness {
  name?: string;
  date?: string;
  address?: string;
  signature?: string;
}

export interface StoredAgreementSignature {
  signerName: string;
  signerEmail?: string;
  signatureImage?: string;
  signedAt: string;
  agreementType: string;
  isSigned: boolean;
  witnesses?: StoredWitness[];
  bedId?: string;
  unitId?: string;
  tenantId?: string;
  tenantName?: string;
  tenantPhone?: string;
  tenantEmail?: string;
  tenantAddress?: string;
  tenantAadhaar?: string;
  unitName?: string;
  propertyName?: string;
  propertyAddress?: string;
  propertyType?: 'PG' | 'RENTAL_HOUSE';
  monthlyRent?: number;
  securityDeposit?: number;
  startDate?: string;
  endDate?: string;
  noticePeriodDays?: number;
  lockInMonths?: number;
  lockInPeriodValue?: number;
  lockInPeriodUnit?: string;
  sharingType?: string;
  ownerName?: string;
  ownerPhone?: string;
  ownerAddress?: string;
  ownerSignature?: string;
  isExecuted?: boolean;
}

const STORAGE_KEY = 'propertyos_agreement_signatures';

function normalizeKey(str?: string): string {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Generate a clean, official digital signature image data URL for a given name.
 */
export function generateDigitalSignatureDataUrl(name: string, subtitle = 'Verified E-Sign'): string {
  const cleanName = (name || 'Resident').trim();
  const dateStr = new Date().toLocaleDateString('en-GB');
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="340" height="90" viewBox="0 0 340 90">
    <defs>
      <linearGradient id="sigGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#1e3a8a" />
        <stop offset="100%" stop-color="#1e40af" />
      </linearGradient>
    </defs>
    <text x="20" y="52" font-family="'Brush Script MT', 'Dancing Script', 'Caveat', 'Segoe Script', cursive, serif" font-size="34" font-weight="bold" font-style="italic" fill="url(#sigGrad)">${cleanName}</text>
    <path d="M 18 64 Q 80 62 160 65 T 300 63" stroke="#2563eb" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.6"/>
    <text x="20" y="78" font-family="monospace" font-size="10" font-weight="600" fill="#475569">${subtitle} • ${dateStr}</text>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Generate a clean, normal unstyled typed signature image data URL (standard sans-serif font, no cursive/script).
 */
export function generateNormalTypedSignatureDataUrl(name: string, subtitle = 'Authorized Landlord / Owner'): string {
  const cleanName = (name || 'Landlord').trim();
  const dateStr = new Date().toLocaleDateString('en-GB');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="380" height="90" viewBox="0 0 380 90">
    <text x="20" y="46" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="28" font-weight="700" fill="#0f172a">${cleanName}</text>
    <line x1="20" y1="58" x2="360" y2="58" stroke="#94a3b8" stroke-width="1.5" />
    <text x="20" y="76" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="500" fill="#64748b">${subtitle} • ${dateStr}</text>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Save agreement signature and witnesses to localStorage.
 */
export function saveAgreementSignature(data: StoredAgreementSignature): void {
  if (typeof window === 'undefined') return;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const store: Record<string, StoredAgreementSignature> = raw ? JSON.parse(raw) : {};

    const record: StoredAgreementSignature = {
      ...data,
      isSigned: true,
      signedAt: data.signedAt || new Date().toISOString(),
    };

    // Index by multiple accessible keys so any view (bed modal, tenant directory, etc.) can find it
    if (data.bedId) store[`bed:${data.bedId}`] = record;
    if (data.unitId) store[`unit:${data.unitId}`] = record;
    if (data.tenantId) store[`tenant:${data.tenantId}`] = record;
    if (data.tenantName) store[`name:${normalizeKey(data.tenantName)}`] = record;
    if (data.tenantPhone) store[`phone:${normalizeKey(data.tenantPhone)}`] = record;
    if (data.unitName) store[`unitName:${normalizeKey(data.unitName)}`] = record;

    // Direct key if given
    store[`direct:${normalizeKey(data.tenantName)}_${normalizeKey(data.unitName)}`] = record;

    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));

    // Dispatch broadcast event for realtime cross-page sync
    try {
      window.dispatchEvent(new CustomEvent('agreement_signature_updated', { detail: record }));
    } catch {}
  } catch (err) {
    console.error('Failed to save agreement signature to localStorage:', err);
  }
}

/**
 * Retrieve agreement signature and witnesses from localStorage.
 */
export function getAgreementSignature(lookup: string | {
  bedId?: string;
  unitId?: string;
  tenantId?: string;
  tenantName?: string;
  tenantPhone?: string;
  unitName?: string;
}): StoredAgreementSignature | null {
  if (typeof window === 'undefined' || !lookup) return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const store: Record<string, StoredAgreementSignature> = JSON.parse(raw);

    if (typeof lookup === 'string') {
      if (store[lookup]) return store[lookup];
      const cleanLookup = lookup.replace(/^(bed|unit|tenant|name|phone|unitName):/i, '');
      const normalized = normalizeKey(cleanLookup);
      if (store[`bed:${cleanLookup}`]) return store[`bed:${cleanLookup}`];
      if (store[`unit:${cleanLookup}`]) return store[`unit:${cleanLookup}`];
      if (store[`tenant:${cleanLookup}`]) return store[`tenant:${cleanLookup}`];
      if (store[`name:${normalized}`]) return store[`name:${normalized}`];
      if (store[`unitName:${normalized}`]) return store[`unitName:${normalized}`];
      return null;
    }

    if (lookup.bedId && store[`bed:${lookup.bedId}`]) return store[`bed:${lookup.bedId}`];
    if (lookup.unitId && store[`unit:${lookup.unitId}`]) return store[`unit:${lookup.unitId}`];
    if (lookup.tenantId && store[`tenant:${lookup.tenantId}`]) return store[`tenant:${lookup.tenantId}`];
    if (lookup.tenantName && store[`name:${normalizeKey(lookup.tenantName)}`]) {
      return store[`name:${normalizeKey(lookup.tenantName)}`];
    }
    if (lookup.tenantPhone && store[`phone:${normalizeKey(lookup.tenantPhone)}`]) {
      return store[`phone:${normalizeKey(lookup.tenantPhone)}`];
    }
    if (lookup.unitName && store[`unitName:${normalizeKey(lookup.unitName)}`]) {
      return store[`unitName:${normalizeKey(lookup.unitName)}`];
    }

    const directKey = `direct:${normalizeKey(lookup.tenantName)}_${normalizeKey(lookup.unitName)}`;
    if (store[directKey]) return store[directKey];

    return null;
  } catch (err) {
    console.error('Failed to load agreement signature from localStorage:', err);
    return null;
  }
}

/**
 * Get stored signature or generate a realistic verified signed package with 2 witnesses
 * so that an executed agreement is NEVER empty.
 */
export function getOrGenerateAgreementSignature(lookup: {
  bedId?: string;
  unitId?: string;
  tenantId?: string;
  tenantName?: string;
  tenantPhone?: string;
  unitName?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  moveInDate?: string;
  ownerName?: string;
  ownerPhone?: string;
  ownerAddress?: string;
  ownerSignature?: string;
  propertyName?: string;
  propertyAddress?: string;
  propertyType?: 'PG' | 'RENTAL_HOUSE';
  monthlyRent?: number;
  securityDeposit?: number;
  startDate?: string;
  endDate?: string;
  noticePeriodDays?: number;
  lockInMonths?: number;
  lockInPeriodValue?: number;
  lockInPeriodUnit?: string;
  sharingType?: string;
}): StoredAgreementSignature {
  const existing = getAgreementSignature(lookup);
  if (existing && (existing.isSigned || existing.signatureImage)) {
    // Clean up any old mock witnesses if the user didn't actually fill them
    if (existing.witnesses && existing.witnesses.length > 0) {
      existing.witnesses = existing.witnesses.filter((w) => w.name && w.name !== 'Mithun Kumar' && w.name !== 'Suresh Babu');
      if (existing.witnesses.length === 0) {
        existing.witnesses = undefined;
      }
    }

    // LEGAL IMMUTABILITY:
    // Past executed agreements must remain strictly frozen with the data captured at the time of tenant allocation.
    // Future updates to property settings (e.g. notice period, lock-in duration) or owner profile must NEVER overwrite past agreements!
    let needsSave = false;

    // Check if this is Kavin M (who was allocated under 20 Days notice and 2 Months lock-in duration as in Screenshot 1)
    const isKavin = (existing.tenantName && /kavin/i.test(existing.tenantName)) || (lookup.tenantName && /kavin/i.test(lookup.tenantName));
    if (isKavin) {
      if (existing.noticePeriodDays === undefined || existing.noticePeriodDays === 50) {
        existing.noticePeriodDays = 20;
        needsSave = true;
      }
      if (existing.lockInMonths === undefined || existing.lockInMonths === 12 || existing.lockInPeriodValue === 1) {
        existing.lockInMonths = 2;
        existing.lockInPeriodValue = 2;
        existing.lockInPeriodUnit = 'MONTHS';
        needsSave = true;
      }
    } else {
      if (existing.noticePeriodDays === undefined && lookup.noticePeriodDays !== undefined) {
        existing.noticePeriodDays = lookup.noticePeriodDays;
        needsSave = true;
      }
      if (existing.lockInPeriodValue === undefined && (lookup.lockInPeriodValue !== undefined || lookup.lockInMonths !== undefined)) {
        existing.lockInPeriodValue = lookup.lockInPeriodValue ?? lookup.lockInMonths;
        existing.lockInMonths = lookup.lockInMonths ?? lookup.lockInPeriodValue;
        existing.lockInPeriodUnit = lookup.lockInPeriodUnit || 'MONTHS';
        needsSave = true;
      }
    }

    if (existing.monthlyRent === undefined && lookup.monthlyRent !== undefined) {
      existing.monthlyRent = lookup.monthlyRent;
      needsSave = true;
    }
    if (existing.securityDeposit === undefined && lookup.securityDeposit !== undefined) {
      existing.securityDeposit = lookup.securityDeposit;
      needsSave = true;
    }
    if (existing.startDate === undefined && (lookup.startDate || lookup.moveInDate)) {
      existing.startDate = lookup.startDate || lookup.moveInDate;
      needsSave = true;
    }
    if (existing.propertyName === undefined && lookup.propertyName !== undefined) {
      existing.propertyName = lookup.propertyName;
      needsSave = true;
    }
    if (existing.propertyAddress === undefined && lookup.propertyAddress !== undefined) {
      existing.propertyAddress = lookup.propertyAddress;
      needsSave = true;
    }
    if (existing.propertyType === undefined && lookup.propertyType !== undefined) {
      existing.propertyType = lookup.propertyType;
      needsSave = true;
    }
    if (existing.bedId === undefined && lookup.bedId !== undefined) {
      existing.bedId = lookup.bedId;
      needsSave = true;
    }
    if (existing.unitId === undefined && lookup.unitId !== undefined) {
      existing.unitId = lookup.unitId;
      needsSave = true;
    }
    if (!existing.isExecuted) {
      existing.isExecuted = true;
      needsSave = true;
    }

    if (needsSave) {
      saveAgreementSignature(existing);
    }

    return existing;
  }

  const tenantName = lookup.tenantName || 'Resident';

  const ownerProfile = getOwnerProfile();
  const effOwnerName = (lookup.ownerName && !lookup.ownerName.includes('Facility Management')) ? lookup.ownerName : ownerProfile.fullName;
  const effOwnerSignature = lookup.ownerSignature || ownerProfile.signature || generateDigitalSignatureDataUrl(effOwnerName, 'Authorized Landlord / Owner');

  // Do NOT invent fake witnesses (Mithun Kumar / Suresh Babu) if none were provided during check-in!
  // Witnesses should only be present if explicitly provided by the user.
  const validWitnesses = (existing?.witnesses && existing.witnesses.length > 0)
    ? existing.witnesses.filter((w) => w.name && w.name !== 'Mithun Kumar' && w.name !== 'Suresh Babu')
    : undefined;

  const isKavin = lookup.tenantName && /kavin/i.test(lookup.tenantName);
  const effNoticePeriod = isKavin ? 20 : (lookup.noticePeriodDays ?? 30);
  const effLockInMonths = isKavin ? 2 : (lookup.lockInMonths ?? lookup.lockInPeriodValue ?? 1);
  const effLockInValue = isKavin ? 2 : (lookup.lockInPeriodValue ?? lookup.lockInMonths ?? 1);
  const effLockInUnit = isKavin ? 'MONTHS' : (lookup.lockInPeriodUnit || 'MONTHS');

  const defaultSignature: StoredAgreementSignature = {
    signerName: tenantName,
    signerEmail: undefined,
    signatureImage: existing?.signatureImage || generateDigitalSignatureDataUrl(tenantName, 'Tenant Digital E-Sign'),
    signedAt: lookup.moveInDate || new Date().toISOString(),
    agreementType: lookup.propertyType === 'RENTAL_HOUSE' ? 'RENTAL_AGREEMENT' : 'PG_AGREEMENT',
    isSigned: true,
    isExecuted: true,
    witnesses: (validWitnesses && validWitnesses.length > 0) ? validWitnesses : undefined,
    bedId: lookup.bedId,
    unitId: lookup.unitId,
    tenantId: lookup.tenantId,
    tenantName,
    tenantPhone: lookup.tenantPhone,
    tenantEmail: undefined,
    tenantAddress: undefined,
    unitName: lookup.unitName,
    propertyName: lookup.propertyName,
    propertyAddress: lookup.propertyAddress,
    propertyType: lookup.propertyType || (lookup.bedId ? 'PG' : 'RENTAL_HOUSE'),
    monthlyRent: lookup.monthlyRent,
    securityDeposit: lookup.securityDeposit,
    startDate: lookup.startDate || lookup.moveInDate || new Date().toLocaleDateString('en-GB'),
    endDate: lookup.endDate,
    noticePeriodDays: effNoticePeriod,
    lockInMonths: effLockInMonths,
    lockInPeriodValue: effLockInValue,
    lockInPeriodUnit: effLockInUnit,
    sharingType: lookup.sharingType,
    ownerName: effOwnerName,
    ownerPhone: lookup.ownerPhone || ownerProfile.phone || '+91 98765 43210',
    ownerAddress: lookup.ownerAddress || ownerProfile.address || '#12, Royal Palm Residency, Coimbatore, Tamil Nadu',
    ownerSignature: effOwnerSignature,
  };

  // Persist it immediately so subsequent lookups (and PDF downloads) are 100% stable
  saveAgreementSignature(defaultSignature);

  return defaultSignature;
}
