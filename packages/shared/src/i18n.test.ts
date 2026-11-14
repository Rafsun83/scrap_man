import { describe, expect, it } from 'vitest';
import { formatKg, formatTaka, localDigits, strings, t, toBanglaDigits } from './i18n.js';

describe('i18n helpers', () => {
  it('converts digits to Bangla', () => {
    expect(toBanglaDigits('BW-1052')).toBe('BW-১০৫২');
  });

  it('formats taka with South Asian grouping', () => {
    expect(formatTaka(1860)).toBe('৳১,৮৬০');
    expect(formatTaka(19750, 'en')).toBe('৳19,750');
  });

  it('formats kilograms with one decimal', () => {
    expect(formatKg(17.5)).toBe('১৭.৫ কেজি');
    expect(formatKg(42, 'en')).toBe('42 kg');
  });

  it('returns strings by language', () => {
    expect(t('appName')).toBe('ভাঙ্গারিওয়ালা');
    expect(t('appName', 'en')).toBe('BhangariWala');
  });

  it('fills placeholders and leaves unknown ones', () => {
    expect(t('greetName', 'en', { greeting: 'Good morning', name: 'Rasheda' })).toBe('Good morning, Rasheda');
    expect(t('stepOf', 'bn', { step: '১' })).toBe('ধাপ ১/{total}');
  });

  it('has the same keys in Bangla and English, none empty', () => {
    const bn = Object.keys(strings.bn).sort();
    const en = Object.keys(strings.en).sort();
    expect(en).toEqual(bn);
    for (const lang of ['bn', 'en'] as const) {
      for (const [key, value] of Object.entries(strings[lang])) {
        expect(value.trim(), `${lang}.${key}`).not.toBe('');
      }
    }
  });

  it('uses the same placeholders in both languages', () => {
    const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(strings.bn) as (keyof typeof strings.bn)[]) {
      expect(names(strings.en[key]), key).toEqual(names(strings.bn[key]));
    }
  });

  it('shows local digits only in Bangla', () => {
    expect(localDigits(42)).toBe('৪২');
    expect(localDigits(42, 'en')).toBe('42');
  });
});
