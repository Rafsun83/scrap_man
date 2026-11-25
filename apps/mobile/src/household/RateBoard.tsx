import { formatTaka, type Lang } from '@bw/shared';
import type { Category, Rate } from '../api/types';
import { categoryName } from '../lib/format';

export type RateRow = {
  code: string;
  name: string;
  /** Formatted price, or the "on inspection" label. */
  price: string;
  ratePerKg: number | null;
  change: number | null;
  onInspection: boolean;
};

/** Joins categories (names, pricing type) with today's rates, in category display order. */
export function rateRows(
  categories: Category[] | undefined,
  rates: Rate[] | undefined,
  lang: Lang,
  onInspectionLabel: string,
): RateRow[] {
  if (!categories) return [];
  return categories.map((c) => {
    const rate = rates?.find((r) => r.categoryCode === c.code);
    const onInspection = c.pricingType === 'ON_INSPECTION';
    const ratePerKg = rate?.ratePerKg ?? null;
    return {
      code: c.code!,
      name: categoryName(categories, c.code!, lang),
      price: onInspection ? onInspectionLabel : ratePerKg !== null ? formatTaka(ratePerKg, lang) : '–',
      ratePerKg,
      change: rate?.changeFromYesterday ?? null,
      onInspection,
    };
  });
}

/** True when at least one per-kg category has a published rate. */
export function ratesPublished(rows: RateRow[]): boolean {
  return rows.some((r) => !r.onInspection && r.ratePerKg !== null);
}

/** Short change-from-yesterday tag for a rate tile: "▲ ৳২", "▼ ৳১" or "—". Null when there is nothing to compare. */
export function rateChangeTag(row: RateRow, lang: Lang): { label: string; tone: 'done' | 'alert' | 'neutral' } | null {
  if (row.onInspection || row.ratePerKg === null || row.change === null) return null;
  if (row.change > 0) return { label: `▲ ${formatTaka(row.change, lang)}`, tone: 'done' };
  if (row.change < 0) return { label: `▼ ${formatTaka(-row.change, lang)}`, tone: 'alert' };
  return { label: '—', tone: 'neutral' };
}
