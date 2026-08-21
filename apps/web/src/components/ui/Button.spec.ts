import { describe, it, expect } from 'vitest';
import { PropertyType } from '@propertyos/types';
import config from '@propertyos/config';

describe('Frontend UI & Brand Tokens', () => {
  it('should enforce the 3-color brand palette constants in config', () => {
    expect(config.brandColors.primaryBg).toBe('#FFFFFF');
    expect(config.brandColors.accentNavy).toBe('#0F172A');
    expect(config.brandColors.accentTeal).toBe('#0F766E');
    expect(config.brandColors.surface).toBe('#F8FAFC');
    expect(config.brandColors.border).toBe('#E2E8F0');
  });

  it('should verify supported property operating models', () => {
    expect(PropertyType.PG).toBe('PG');
    expect(PropertyType.RENTAL_HOUSE).toBe('RENTAL_HOUSE');
  });
});
