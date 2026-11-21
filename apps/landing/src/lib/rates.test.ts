import type { Category } from '@bw/shared'
import { describe, expect, it } from 'vitest'
import { buildRateBoard, formatRate, hasPublishedRates, trendOf } from './rates'

const categories: Category[] = [
  { code: 'IRON', nameBn: 'লোহা', nameEn: 'Iron', pricingType: 'PER_KG', icon: 'iron' },
  { code: 'CARTON', nameBn: 'কার্টন', nameEn: 'Carton', pricingType: 'PER_KG', icon: 'carton' },
  { code: 'ELECTRONICS', nameBn: 'ইলেকট্রনিক্স', nameEn: 'Electronics', pricingType: 'ON_INSPECTION', icon: 'device' },
]

describe('buildRateBoard', () => {
  it('keeps category order and joins rates by code', () => {
    const board = buildRateBoard(categories, {
      effectiveDate: '2026-11-20',
      rates: [
        { categoryCode: 'CARTON', ratePerKg: 18, changeFromYesterday: -2 },
        { categoryCode: 'IRON', ratePerKg: 50, changeFromYesterday: 0 },
        { categoryCode: 'ELECTRONICS', ratePerKg: null, changeFromYesterday: null },
      ],
    })
    expect(board.effectiveDate).toBe('2026-11-20')
    expect(board.rows.map((r) => [r.code, r.ratePerKg, r.onInspection])).toEqual([
      ['IRON', 50, false],
      ['CARTON', 18, false],
      ['ELECTRONICS', null, true],
    ])
    expect(hasPublishedRates(board)).toBe(true)
  })

  it('reports no published rates when nothing is priced yet', () => {
    const board = buildRateBoard(categories, { effectiveDate: null, rates: [] })
    expect(board.rows).toHaveLength(3)
    expect(hasPublishedRates(board)).toBe(false)
  })
})

describe('formatRate and trendOf', () => {
  it('shows whole taka plainly and keeps paisa', () => {
    expect(formatRate(50, 'bn')).toBe('৳৫০')
    expect(formatRate(35.5, 'en')).toBe('৳35.50')
  })

  it('maps the change from yesterday to a trend', () => {
    expect(trendOf(2)).toBe('up')
    expect(trendOf(-1)).toBe('down')
    expect(trendOf(0)).toBe('same')
    expect(trendOf(null)).toBeNull()
  })
})
