'use client';

import { AuthUser } from '@propertyos/types';
import { generateDigitalSignatureDataUrl } from './agreementStorage';

export interface OwnerProfileData {
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  organizationName: string;
  signature: string;
  signMode: 'draw' | 'type';
  typedName?: string;
  role: string;
  updatedAt: string;
}

const STORAGE_KEY = 'propertyos_owner_profile';
export const OWNER_PROFILE_UPDATED_EVENT = 'propertyos_owner_profile_updated';

export const DEFAULT_STREET = '#12, Royal Palm Residency, Indiranagar';
export const DEFAULT_CITY = 'Bengaluru';
export const DEFAULT_STATE = 'Karnataka';
export const DEFAULT_POSTAL_CODE = '560038';
export const DEFAULT_ADDRESS = '#12, Royal Palm Residency, Indiranagar, Bengaluru, Karnataka - 560038';

/**
 * Combines separate address components into a standardized full permanent address string.
 */
export function formatFullAddress(street?: string, city?: string, state?: string, postalCode?: string): string {
  const parts: string[] = [];
  if (street?.trim()) parts.push(street.trim());
  if (city?.trim()) parts.push(city.trim());
  if (state?.trim() && postalCode?.trim()) {
    parts.push(`${state.trim()} - ${postalCode.trim()}`);
  } else {
    if (state?.trim()) parts.push(state.trim());
    if (postalCode?.trim()) parts.push(postalCode.trim());
  }
  return parts.join(', ') || DEFAULT_ADDRESS;
}

/**
 * Helper to extract initial street, city, state, postalCode from an existing combined address string.
 */
export function parseAddressComponents(fullAddress?: string) {
  if (!fullAddress) {
    return {
      streetAddress: DEFAULT_STREET,
      city: DEFAULT_CITY,
      state: DEFAULT_STATE,
      postalCode: DEFAULT_POSTAL_CODE,
    };
  }

  // Example: "#12, Royal Palm Residency, Indiranagar, Bengaluru, Karnataka - 560038"
  const pinMatch = fullAddress.match(/[-–]\s*([0-9]{6})/);
  const postalCode = pinMatch ? pinMatch[1] : '';
  const withoutPin = fullAddress.replace(/[-–]\s*[0-9]{6}/, '').trim().replace(/,\s*$/, '');
  const segments = withoutPin.split(',').map((s) => s.trim()).filter(Boolean);

  if (segments.length >= 3) {
    const state = segments[segments.length - 1];
    const city = segments[segments.length - 2];
    const streetAddress = segments.slice(0, segments.length - 2).join(', ');
    return { streetAddress, city, state, postalCode: postalCode || DEFAULT_POSTAL_CODE };
  } else if (segments.length === 2) {
    return { streetAddress: segments[0], city: segments[1], state: DEFAULT_STATE, postalCode: postalCode || DEFAULT_POSTAL_CODE };
  }

  return {
    streetAddress: fullAddress,
    city: DEFAULT_CITY,
    state: DEFAULT_STATE,
    postalCode: postalCode || DEFAULT_POSTAL_CODE,
  };
}

/**
 * Retrieves the owner's legal profile, merging stored preferences with the active session user.
 */
export function getOwnerProfile(authUser?: AuthUser | null): OwnerProfileData {
  const defaultFirstName = authUser?.firstName || 'Arun';
  const defaultLastName = authUser?.lastName || 'Sharma';
  const defaultFullName = authUser
    ? `${authUser.firstName} ${authUser.lastName}`.trim()
    : `${defaultFirstName} ${defaultLastName}`;
  const defaultEmail = authUser?.email || 'owner-a@propertyos.com';
  const defaultPhone = authUser?.phone || '9845011223';
  const defaultOrgName = authUser?.organizationName || 'Hari Buildings';
  const defaultSignature = generateDigitalSignatureDataUrl(defaultFullName, 'Authorized Landlord / Owner');

  if (typeof window === 'undefined') {
    return {
      firstName: defaultFirstName,
      lastName: defaultLastName,
      fullName: defaultFullName,
      email: defaultEmail,
      phone: defaultPhone,
      address: DEFAULT_ADDRESS,
      streetAddress: DEFAULT_STREET,
      city: DEFAULT_CITY,
      state: DEFAULT_STATE,
      postalCode: DEFAULT_POSTAL_CODE,
      organizationName: defaultOrgName,
      signature: defaultSignature,
      signMode: 'draw',
      role: authUser?.roles?.[0] || 'OWNER',
      updatedAt: new Date().toISOString(),
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Explicitly saved profile values in localStorage take precedence over stale session tokens
      let fName = parsed.firstName || authUser?.firstName || defaultFirstName;
      let lName = parsed.lastName || authUser?.lastName || defaultLastName;
      if (fName === 'Authorized' && lName === 'Owner') {
        fName = 'Arun';
        lName = 'Sharma';
      }
      const full = parsed.fullName && parsed.fullName !== 'Authorized Owner'
        ? parsed.fullName
        : (fName && lName ? `${fName} ${lName}`.trim() : (authUser ? `${authUser.firstName} ${authUser.lastName}`.trim() : defaultFullName));

      let orgName = parsed.organizationName || authUser?.organizationName || defaultOrgName;
      if (orgName === 'PropertyOS Enterprise' || orgName === 'My Organization') {
        orgName = 'Hari Buildings';
      }

      const parsedStreet = parsed.streetAddress || undefined;
      const parsedCity = parsed.city || undefined;
      const parsedState = parsed.state || undefined;
      const parsedPostal = parsed.postalCode || undefined;
      const parsedAddress = parsed.address || (parsedStreet ? formatFullAddress(parsedStreet, parsedCity, parsedState, parsedPostal) : DEFAULT_ADDRESS);

      const parsedComponents = parseAddressComponents(parsedAddress);

      return {
        firstName: fName,
        lastName: lName,
        fullName: full,
        email: parsed.email || authUser?.email || defaultEmail,
        phone: parsed.phone || authUser?.phone || defaultPhone,
        address: parsedAddress,
        streetAddress: parsedStreet || parsedComponents.streetAddress,
        city: parsedCity || parsedComponents.city,
        state: parsedState || parsedComponents.state,
        postalCode: parsedPostal || parsedComponents.postalCode,
        organizationName: orgName,
        signature: parsed.signature || defaultSignature,
        signMode: parsed.signMode || 'draw',
        typedName: parsed.typedName || full,
        role: parsed.role || authUser?.roles?.[0] || 'OWNER',
        updatedAt: parsed.updatedAt || new Date().toISOString(),
      };
    }
  } catch (err) {
    console.error('Error reading owner profile from storage:', err);
  }

  const initialProfile: OwnerProfileData = {
    firstName: defaultFirstName,
    lastName: defaultLastName,
    fullName: defaultFullName,
    email: defaultEmail,
    phone: defaultPhone,
    address: DEFAULT_ADDRESS,
    streetAddress: DEFAULT_STREET,
    city: DEFAULT_CITY,
    state: DEFAULT_STATE,
    postalCode: DEFAULT_POSTAL_CODE,
    organizationName: defaultOrgName,
    signature: defaultSignature,
    signMode: 'draw',
    typedName: defaultFullName,
    role: authUser?.roles?.[0] || 'OWNER',
    updatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialProfile));
  } catch (err) {
    console.error('Error seeding initial owner profile:', err);
  }

  return initialProfile;
}

export const OWNER_PROFILE_HISTORY_KEY = 'propertyos_owner_profile_history';

/**
 * Saves and broadcasts owner profile updates in real-time across the app.
 * Automatically archives the previous snapshot into owner profile history
 * so that existing/past legal agreements preserve their historical signing details.
 */
export function saveOwnerProfile(updates: Partial<OwnerProfileData>, authUser?: AuthUser | null): OwnerProfileData {
  const current = getOwnerProfile(authUser);

  const updatedFirstName = updates.firstName !== undefined ? updates.firstName.trim() : current.firstName;
  const updatedLastName = updates.lastName !== undefined ? updates.lastName.trim() : current.lastName;
  const updatedFullName = updates.fullName !== undefined
    ? updates.fullName.trim()
    : `${updatedFirstName} ${updatedLastName}`.trim();

  const updatedStreet = updates.streetAddress !== undefined ? updates.streetAddress.trim() : current.streetAddress;
  const updatedCity = updates.city !== undefined ? updates.city.trim() : current.city;
  const updatedState = updates.state !== undefined ? updates.state.trim() : current.state;
  const updatedPostal = updates.postalCode !== undefined ? updates.postalCode.trim() : current.postalCode;

  let combinedAddress = updates.address !== undefined ? updates.address.trim() : current.address;
  if (updates.streetAddress !== undefined || updates.city !== undefined || updates.state !== undefined || updates.postalCode !== undefined) {
    combinedAddress = formatFullAddress(updatedStreet, updatedCity, updatedState, updatedPostal);
  }

  const nowIso = new Date().toISOString();

  const newProfile: OwnerProfileData = {
    ...current,
    ...updates,
    firstName: updatedFirstName,
    lastName: updatedLastName,
    fullName: updatedFullName,
    email: updates.email !== undefined ? updates.email.trim() : current.email,
    phone: updates.phone !== undefined ? updates.phone.trim() : current.phone,
    streetAddress: updatedStreet,
    city: updatedCity,
    state: updatedState,
    postalCode: updatedPostal,
    address: combinedAddress,
    organizationName: updates.organizationName !== undefined ? updates.organizationName.trim() : current.organizationName,
    signature: updates.signature || current.signature,
    signMode: updates.signMode || current.signMode,
    typedName: updates.typedName || current.typedName || updatedFullName,
    updatedAt: nowIso,
  };

  if (typeof window !== 'undefined') {
    try {
      // 1. Archive the previous profile into history
      const rawHist = localStorage.getItem(OWNER_PROFILE_HISTORY_KEY);
      const history: Array<{ profile: OwnerProfileData; effectiveFrom: string; effectiveUntil: string }> = rawHist ? JSON.parse(rawHist) : [];
      
      // If this is the first edit or current.updatedAt is undefined / matches now,
      // the baseline profile was effective since the system inception (e.g. 2026-08-01)
      const effectiveFrom = current.updatedAt && new Date(current.updatedAt).getTime() < (new Date(nowIso).getTime() - 60000)
        ? current.updatedAt
        : (history.length > 0 ? (history[history.length - 1].effectiveUntil || '2026-08-01T00:00:00.000Z') : '2026-08-01T00:00:00.000Z');

      history.push({
        profile: { ...current },
        effectiveFrom,
        effectiveUntil: nowIso,
      });
      localStorage.setItem(OWNER_PROFILE_HISTORY_KEY, JSON.stringify(history));

      // 2. Save active profile
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newProfile));
      // Dispatch in current window
      window.dispatchEvent(
        new CustomEvent(OWNER_PROFILE_UPDATED_EVENT, { detail: newProfile })
      );
    } catch (err) {
      console.error('Error saving owner profile to storage:', err);
    }
  }

  return newProfile;
}

export const BASELINE_HISTORICAL_OWNER: OwnerProfileData = {
  firstName: 'Arun',
  lastName: 'Sharma',
  fullName: 'Arun Sharma',
  email: 'owner-a@propertyos.com',
  phone: '9845011223',
  address: DEFAULT_ADDRESS,
  streetAddress: DEFAULT_STREET,
  city: DEFAULT_CITY,
  state: DEFAULT_STATE,
  postalCode: DEFAULT_POSTAL_CODE,
  organizationName: 'Hari Buildings',
  signature: generateDigitalSignatureDataUrl('Arun Sharma', 'Authorized Landlord / Owner', '01/09/2026'),
  signMode: 'draw',
  role: 'OWNER',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

/**
 * Retrieves the owner profile snapshot that was legally effective at a specific past date/time.
 * If no date is passed, or if the date is now/future, returns the latest active profile.
 * If the date is before a recent profile change, returns the snapshot from that historical period.
 */
export function getOwnerProfileAtDate(dateInput?: string | Date | number | null, authUser?: AuthUser | null): OwnerProfileData {
  const current = getOwnerProfile(authUser);
  if (!dateInput) return current;

  const targetDate = new Date(dateInput);
  if (isNaN(targetDate.getTime())) return current;
  const targetTime = targetDate.getTime();

  // If the target date is after or at the time the current profile was last updated, use current profile
  const currentUpdateTime = new Date(current.updatedAt).getTime();
  if (!isNaN(currentUpdateTime) && targetTime >= currentUpdateTime) {
    return current;
  }

  if (typeof window === 'undefined') return current;

  try {
    const rawHist = localStorage.getItem(OWNER_PROFILE_HISTORY_KEY);
    if (rawHist) {
      const history: Array<{ profile: OwnerProfileData; effectiveFrom?: string; effectiveUntil?: string }> = JSON.parse(rawHist);
      if (Array.isArray(history) && history.length > 0) {
        // Sort chronologically
        history.sort((a, b) => {
          const aT = a.effectiveFrom ? new Date(a.effectiveFrom).getTime() : 0;
          const bT = b.effectiveFrom ? new Date(b.effectiveFrom).getTime() : 0;
          return aT - bT;
        });

        for (const item of history) {
          const from = item.effectiveFrom ? new Date(item.effectiveFrom).getTime() : 0;
          const until = item.effectiveUntil ? new Date(item.effectiveUntil).getTime() : Infinity;
          if (targetTime >= from && targetTime <= until) {
            return {
              ...item.profile,
              signature: item.profile.signature || generateDigitalSignatureDataUrl(item.profile.fullName || 'Arun Sharma', 'Authorized Landlord / Owner', targetDate.toLocaleDateString('en-GB')),
            };
          }
        }

        // If targetTime is older than all recorded changes, return the earliest historical snapshot
        if (history[0]?.profile) {
          return {
            ...history[0].profile,
            signature: history[0].profile.signature || generateDigitalSignatureDataUrl(history[0].profile.fullName || 'Arun Sharma', 'Authorized Landlord / Owner', targetDate.toLocaleDateString('en-GB')),
          };
        }
      }
    }
  } catch (err) {
    console.error('Error reading owner profile history:', err);
  }

  // Fallback: If no history array was found but target date is before the current update,
  // return the baseline historical profile from initial setup
  return {
    ...BASELINE_HISTORICAL_OWNER,
    signature: generateDigitalSignatureDataUrl('Arun Sharma', 'Authorized Landlord / Owner', targetDate.toLocaleDateString('en-GB')),
    updatedAt: new Date(targetTime).toISOString(),
  };
}

/**
 * Subscribes to real-time owner profile changes across components and browser tabs.
 */
export function onOwnerProfileChange(callback: (profile: OwnerProfileData) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleCustomEvent = (event: Event) => {
    const customEvent = event as CustomEvent<OwnerProfileData>;
    if (customEvent.detail) {
      callback(customEvent.detail);
    } else {
      callback(getOwnerProfile());
    }
  };

  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      callback(getOwnerProfile());
    }
  };

  window.addEventListener(OWNER_PROFILE_UPDATED_EVENT, handleCustomEvent);
  window.addEventListener('storage', handleStorageEvent);

  return () => {
    window.removeEventListener(OWNER_PROFILE_UPDATED_EVENT, handleCustomEvent);
    window.removeEventListener('storage', handleStorageEvent);
  };
}

