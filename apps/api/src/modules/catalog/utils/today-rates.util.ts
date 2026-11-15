import type { TodayRatesDto } from '../dtos/today-rates.dto.js';
import type { RateRow } from '../repositories/catalog.repository.js';

const toNumber = (v: string | null) => (v === null ? null : Number(v));

/** Shapes rate rows into the contract's TodayRates, with the change from the previous rate. */
function build(rows: RateRow[], today: string): TodayRatesDto {
  const dated = rows.filter((r) => r.effective_date !== null);
  const effectiveDate = dated.length ? dated.map((r) => r.effective_date!).sort().at(-1)! : today;
  const published = rows.map((r) => r.published_at).filter((d): d is Date => d !== null);
  const publishedAt = published.length
    ? new Date(Math.max(...published.map((d) => d.getTime()))).toISOString()
    : null;

  return {
    effectiveDate,
    publishedAt,
    rates: rows.map((r) => {
      const rate = r.pricing_type === 'PER_KG' ? toNumber(r.rate_per_kg) : null;
      const prev = toNumber(r.prev_rate);
      return {
        categoryCode: r.code,
        ratePerKg: rate,
        changeFromYesterday: rate !== null && prev !== null ? Math.round((rate - prev) * 100) / 100 : null,
      };
    }),
  };
}

export const todayRatesUtil = { build } as const;
