import { describe, expect, it } from 'vitest';
import { adminStrings, ta } from './admin-i18n.js';

describe('admin strings', () => {
  it('have the same keys in English and Bangla, none empty, same placeholders', () => {
    expect(Object.keys(adminStrings.bn).sort()).toEqual(Object.keys(adminStrings.en).sort());
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const [key, en] of Object.entries(adminStrings.en)) {
      const bn = adminStrings.bn[key as keyof typeof adminStrings.bn];
      expect(en.trim(), key).not.toBe('');
      expect(bn.trim(), key).not.toBe('');
      expect(vars(bn), key).toEqual(vars(en));
    }
  });

  it('defaults to English and fills placeholders', () => {
    expect(ta('navPickups')).toBe('Live pickups');
    expect(ta('navPickups', 'bn')).toBe('লাইভ পিকআপ');
    expect(ta('pickupTitle', 'en', { no: 'BW-1052' })).toBe('Pickup BW-1052');
  });
});
