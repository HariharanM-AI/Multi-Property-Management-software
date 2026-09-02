import { describe, it, expect } from 'vitest';
import {
  RegisterOwnerSchema,
  CreatePropertySchema,
  indianPhoneRegex,
  indianPinCodeRegex,
} from './index.js';
import { PropertyType } from '@propertyos/types';

describe('Shared Validation Schemas', () => {
  it('should validate Indian phone regex correctly', () => {
    expect(indianPhoneRegex.test('9876543210')).toBe(true);
    expect(indianPhoneRegex.test('+919876543210')).toBe(true);
    expect(indianPhoneRegex.test('1234567890')).toBe(false); // does not start with 6-9
    expect(indianPhoneRegex.test('98765')).toBe(false); // too short
  });

  it('should validate Indian PIN code regex correctly', () => {
    expect(indianPinCodeRegex.test('560102')).toBe(true);
    expect(indianPinCodeRegex.test('110001')).toBe(true);
    expect(indianPinCodeRegex.test('012345')).toBe(false); // starts with 0
    expect(indianPinCodeRegex.test('56010')).toBe(false); // 5 digits
  });

  it('should validate complete owner registration payload', () => {
    const payload = {
      organizationName: 'Omkar Living Spaces Pvt Ltd',
      firstName: 'Omkar',
      lastName: 'Patil',
      email: 'omkar.patil@example.com',
      phone: '9845012345',
      password: 'SecurePassword123@#$',
    };

    const parsed = RegisterOwnerSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it('should reject weak passwords in registration', () => {
    const payload = {
      organizationName: 'Omkar Living',
      firstName: 'Omkar',
      lastName: 'Patil',
      email: 'omkar@example.com',
      phone: '9845012345',
      password: 'weak',
    };

    const parsed = RegisterOwnerSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });

  it('should validate PG property creation payload', () => {
    const payload = {
      name: 'Sunrise Co-Living Residency',
      propertyType: PropertyType.PG,
      description: 'Premium co-living PG with high-speed internet and security',
      address: 'Plot 42, 14th Main, Sector 4, HSR Layout',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560102',
      latitude: 12.9121,
      longitude: 77.6446,
      contactPhone: '9876543210',
      contactEmail: 'contact@sunrisecoliving.in',
      ownerName: 'Arun Sharma',
      ownerAddress: 'Plot 42, 14th Main, HSR Layout, Bengaluru',
      ownerPhone: '9876543210',
      ownerSignature: 'DIGITAL_STAMP_DEFAULT',
    };

    const parsed = CreatePropertySchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });
});
