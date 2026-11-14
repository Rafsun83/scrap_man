/** Rate rows as read from the database; numeric columns arrive as strings. */
export interface RateRow {
  code: string;
  pricing_type: 'PER_KG' | 'ON_INSPECTION';
  rate_per_kg: string | null;
  prev_rate: string | null;
  effective_date: string | null;
  published_at: Date | null;
}

const toNumber = (v: string | null) => (v === null ? null : Number(v));

/** Shapes rate rows into the contract's response, with the change from the previous rate. */
export function buildTodayRates(rows: RateRow[], today: string) {
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
