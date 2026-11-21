import { localDigits, type Category, type Lang, type Rate } from '@bw/shared'

/** The body of `GET /rates/today`. */
export type TodayRates = { effectiveDate?: string | null; publishedAt?: string | null; rates?: Rate[] }

export type RateRow = {
  code: string
  nameBn: string
  nameEn: string
  /** null: priced on inspection (electronics) or never priced. */
  ratePerKg: number | null
  onInspection: boolean
  changeFromYesterday: number | null
}

export type RateBoard = { effectiveDate: string | null; rows: RateRow[] }

/** Joins categories (display order) with today's rates. Categories without a rate stay in the list. */
export function buildRateBoard(categories: Category[], today: TodayRates): RateBoard {
  const byCode = new Map((today.rates ?? []).map((r) => [r.categoryCode, r]))
  const rows = categories.flatMap((c): RateRow[] => {
    if (!c.code) return []
    const rate = byCode.get(c.code)
    return [
      {
        code: c.code,
        nameBn: c.nameBn ?? c.code,
        nameEn: c.nameEn ?? c.code,
        ratePerKg: rate?.ratePerKg ?? null,
        onInspection: c.pricingType === 'ON_INSPECTION',
        changeFromYesterday: rate?.changeFromYesterday ?? null,
      },
    ]
  })
  return { effectiveDate: today.effectiveDate ?? null, rows }
}

/** True when at least one per-kg category has a published rate. */
export function hasPublishedRates(board: RateBoard): boolean {
  return board.rows.some((r) => r.ratePerKg !== null)
}

/** "৳৫০" or "৳৩৫.৫০": whole taka without decimals, paisa kept when there are any. */
export function formatRate(amount: number, lang: Lang): string {
  const text = Number.isInteger(amount) ? String(amount) : amount.toFixed(2)
  return '৳' + localDigits(text, lang)
}

export type Trend = 'up' | 'down' | 'same' | null

export function trendOf(change: number | null): Trend {
  if (change === null) return null
  if (change > 0) return 'up'
  if (change < 0) return 'down'
  return 'same'
}
