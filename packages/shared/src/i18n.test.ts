import { describe, expect, it } from 'vitest';
import { formatKg, formatTaka, t, toBanglaDigits } from './i18n.js';

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
});
