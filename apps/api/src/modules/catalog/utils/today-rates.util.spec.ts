import type { RateRow } from '../repositories/catalog.repository.js';
import { todayRatesUtil } from './today-rates.util.js';

const row = (o: Partial<RateRow>): RateRow => ({
  code: 'IRON',
  pricing_type: 'PER_KG',
  rate_per_kg: null,
  prev_rate: null,
  effective_date: null,
  published_at: null,
  ...o,
});

describe('todayRatesUtil.build', () => {
  it('computes the change from the previous rate', () => {
    const out = todayRatesUtil.build(
      [
        row({ code: 'IRON', rate_per_kg: '50.00', prev_rate: '48.00', effective_date: '2026-11-13', published_at: new Date('2026-11-13T02:00:00Z') }),
        row({ code: 'PLASTIC', rate_per_kg: '35.00', prev_rate: '36.00', effective_date: '2026-11-13', published_at: new Date('2026-11-13T02:05:00Z') }),
      ],
      '2026-11-13',
    );
    expect(out.effectiveDate).toBe('2026-11-13');
    expect(out.publishedAt).toBe('2026-11-13T02:05:00.000Z');
    expect(out.rates).toEqual([
      { categoryCode: 'IRON', ratePerKg: 50, changeFromYesterday: 2 },
      { categoryCode: 'PLASTIC', ratePerKg: 35, changeFromYesterday: -1 },
    ]);
  });

  it('gives electronics no per-kg rate', () => {
    const out = todayRatesUtil.build([row({ code: 'ELECTRONICS', pricing_type: 'ON_INSPECTION' })], '2026-11-13');
    expect(out.rates[0]).toEqual({ categoryCode: 'ELECTRONICS', ratePerKg: null, changeFromYesterday: null });
  });

  it('falls back to today when nothing is published yet', () => {
    const out = todayRatesUtil.build([row({})], '2026-11-13');
    expect(out).toMatchObject({ effectiveDate: '2026-11-13', publishedAt: null });
  });
});
