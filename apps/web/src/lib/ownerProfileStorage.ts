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
  const defaultPhone = authUser?.phone || '9876543210';
  const defaultOrgName = authUser?.organizationName || 'My Organization';
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
      const fName = parsed.firstName || authUser?.firstName || defaultFirstName;
      const lName = parsed.lastName || authUser?.lastName || defaultLastName;
      const full = parsed.fullName || (fName && lName ? `${fName} ${lName}`.trim() : (authUser ? `${authUser.firstName} ${authUser.lastName}`.trim() : defaultFullName));

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
        organizationName: parsed.organizationName || authUser?.organizationName || defaultOrgName,
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

/**
 * Saves and broadcasts owner profile updates in real-time across the app.
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
    updatedAt: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    try {
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
