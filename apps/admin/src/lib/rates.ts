import type { AdminRates } from '@bw/shared'

/** What the admin has typed per category code (PER_KG only). */
export type RateDraft = Record<string, string>

/** The draft as first shown: the published rate for the date, if any. */
export function draftFrom(data: AdminRates): RateDraft {
  const out: RateDraft = {}
  for (const r of data.rates) if (r.pricingType === 'PER_KG') out[r.categoryCode] = r.rate == null ? '' : String(r.rate)
  return out
}

/** "Copy previous rates": every per-kg category gets its previous rate where it has one. */
export function copyPrevious(data: AdminRates, draft: RateDraft): RateDraft {
  const out = { ...draft }
  for (const r of data.rates) if (r.pricingType === 'PER_KG' && r.previousRate != null) out[r.categoryCode] = String(r.previousRate)
  return out
}

/** A typed rate: above 0, at most 2 decimals; null when empty or not valid. */
export function parseRate(text: string): number | null {
  const ascii = text.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d))).replace(',', '.').trim()
  if (!/^\d+(\.\d{1,2})?$/.test(ascii)) return null
  const n = Number(ascii)
  return n > 0 && n <= 100_000 ? n : null
}

/** Categories whose typed value is not a valid rate (empty ones are skipped, not errors). */
export function invalidCodes(draft: RateDraft): string[] {
  return Object.entries(draft)
    .filter(([, v]) => v.trim() !== '' && parseRate(v) === null)
    .map(([code]) => code)
}

/** The rates to publish: every valid typed rate that differs from what is published for the date. */
export function changedRates(data: AdminRates, draft: RateDraft): { categoryCode: string; ratePerKg: number }[] {
  const out: { categoryCode: string; ratePerKg: number }[] = []
  for (const r of data.rates) {
    if (r.pricingType !== 'PER_KG') continue
    const typed = parseRate(draft[r.categoryCode] ?? '')
    if (typed !== null && typed !== r.rate) out.push({ categoryCode: r.categoryCode, ratePerKg: typed })
  }
  return out
}

/** Change from the previous rate, for the Change column; null when either side is missing. */
export function changeFromPrevious(previous: number | null | undefined, typed: number | null): number | null {
  if (previous == null || typed === null) return null
  return Math.round((typed - previous) * 100) / 100
}
