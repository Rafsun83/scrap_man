import type { Category, Pickup } from '../api/types';

/** One line on the weigh screen as the collector edits it. */
export type DraftLine = { categoryCode: string; kg: number; quoted: string };

export const KG_STEP = 0.5;
/** weigh_lines.kg is numeric(8,1). */
export const MAX_KG = 9999.9;

const toTenths = (kg: number) => Math.round(kg * 10);

/** The stepper: ±0.5 kg, never below 0, kept to 0.1 kg. */
export function stepKg(kg: number, direction: 1 | -1): number {
  const next = toTenths(kg) + direction * toTenths(KG_STEP);
  return Math.min(toTenths(MAX_KG), Math.max(0, next)) / 10;
}

/** Bangla or ASCII digits, "," or "." as the decimal mark. Null when it is not a weight to 0.1 kg. */
export function parseKg(text: string): number | null {
  const ascii = text.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d))).replace(',', '.').trim();
  if (!/^\d+(\.\d)?$/.test(ascii)) return null;
  const kg = Number(ascii);
  return kg <= MAX_KG ? kg : null;
}

/** Taka with at most 2 decimals, Bangla digits allowed. Null otherwise. */
export function parseTaka(text: string): number | null {
  const ascii = text.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d))).replace(',', '.').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(ascii)) return null;
  return Number(ascii);
}

type RateOf = (code: string) => number | null;

/** The rate for each code: the one locked at accept, else (an item found at the door) today's rate. */
export function rateLookup(lockedRates: Pickup['lockedRates'], todayRates: { categoryCode?: string; ratePerKg?: number | null }[] | undefined): RateOf {
  return (code) => {
    const locked = lockedRates?.find((r) => r.categoryCode === code);
    if (locked) return locked.rate;
    const today = todayRates?.find((r) => r.categoryCode === code);
    return today?.ratePerKg ?? null;
  };
}

function isInspection(categories: Category[] | undefined, code: string) {
  return categories?.find((c) => c.code === code)?.pricingType === 'ON_INSPECTION';
}

/** Live preview of each line and the totals, rounded like the server (paisa and tenths of a kg). */
export function previewTotals(lines: DraftLine[], categories: Category[] | undefined, rateOf: RateOf) {
  let tenths = 0;
  let paisa = 0;
  const amounts = lines.map((l) => {
    if (l.kg <= 0) return 0;
    tenths += toTenths(l.kg);
    let linePaisa = 0;
    if (isInspection(categories, l.categoryCode)) {
      const quoted = parseTaka(l.quoted);
      linePaisa = quoted === null ? 0 : Math.round(quoted * 100);
    } else {
      const rate = rateOf(l.categoryCode);
      linePaisa = rate === null ? 0 : Math.round((toTenths(l.kg) * Math.round(rate * 100)) / 10);
    }
    paisa += linePaisa;
    return linePaisa / 100;
  });
  return { amounts, totalKg: tenths / 10, totalAmount: paisa / 100 };
}

/** One line of the contract's WeightsInput. */
export type WeightLine = { categoryCode: string; kg: number; quotedAmount?: number };

/** The contract's WeightsInput lines, or null while something is missing (no weight, or an inspection item without a price). */
export function toWeightLines(lines: DraftLine[], categories: Category[] | undefined): WeightLine[] | null {
  const weighed = lines.filter((l) => l.kg > 0);
  if (weighed.length === 0) return null;
  const out: WeightLine[] = [];
  for (const l of weighed) {
    if (isInspection(categories, l.categoryCode)) {
      const quoted = parseTaka(l.quoted);
      if (quoted === null) return null;
      out.push({ categoryCode: l.categoryCode, kg: l.kg, quotedAmount: quoted });
    } else {
      out.push({ categoryCode: l.categoryCode, kg: l.kg });
    }
  }
  return out;
}

/** Starting lines: the request's items, with the previous round's weights when re-weighing (C10). */
export function initialLines(p: Pick<Pickup, 'categoryCodes' | 'lines'>): DraftLine[] {
  const codes = [...p.categoryCodes];
  for (const l of p.lines) if (!codes.includes(l.categoryCode)) codes.push(l.categoryCode);
  return codes.map((code) => {
    const prev = p.lines.find((l) => l.categoryCode === code);
    return { categoryCode: code, kg: prev?.kg ?? 0, quoted: prev && prev.rate == null ? String(prev.amount) : '' };
  });
}
