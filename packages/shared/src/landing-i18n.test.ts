import { describe, expect, it } from 'vitest';
import { landingStrings, tl } from './landing-i18n.js';

describe('landing strings', () => {
  it('have the same keys in Bangla and English, none empty, same placeholders', () => {
    expect(Object.keys(landingStrings.en).sort()).toEqual(Object.keys(landingStrings.bn).sort());
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const [key, bn] of Object.entries(landingStrings.bn)) {
      const en = landingStrings.en[key as keyof typeof landingStrings.en];
      expect(bn.trim(), key).not.toBe('');
      expect(en.trim(), key).not.toBe('');
      expect(vars(en), key).toEqual(vars(bn));
    }
  });

  it('defaults to Bangla and fills placeholders', () => {
    expect(tl('navRates')).toBe('আজকের দর');
    expect(tl('navRates', 'en')).toBe("Today's rates");
    expect(tl('ratesUp', 'en', { amount: '৳2' })).toBe('৳2 more than yesterday');
  });
});
