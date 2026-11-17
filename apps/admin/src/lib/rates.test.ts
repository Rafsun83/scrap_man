import type { AdminRates } from '@bw/shared'
import { describe, expect, it } from 'vitest'
import { changedRates, changeFromPrevious, copyPrevious, draftFrom, invalidCodes, parseRate } from './rates'

const data: AdminRates = {
  date: '2026-11-17',
  publishedAt: null,
  publishedByName: null,
  rates: [
    { categoryCode: 'IRON', pricingType: 'PER_KG', rate: 50, previousRate: 48, previousDate: '2026-11-16' },
    { categoryCode: 'NEWSPAPER', pricingType: 'PER_KG', rate: null, previousRate: 30, previousDate: '2026-11-16' },
    { categoryCode: 'CARTON', pricingType: 'PER_KG', rate: null, previousRate: null, previousDate: null },
    { categoryCode: 'ELECTRONICS', pricingType: 'ON_INSPECTION', rate: null, previousRate: null, previousDate: null },
  ],
}

describe('rate editing (A2)', () => {
  it('starts from the published rates, per-kg categories only', () => {
    expect(draftFrom(data)).toEqual({ IRON: '50', NEWSPAPER: '', CARTON: '' })
  })

  it('copies the previous rates where there are any', () => {
    expect(copyPrevious(data, { IRON: '50', NEWSPAPER: '', CARTON: '20' })).toEqual({ IRON: '48', NEWSPAPER: '30', CARTON: '20' })
  })

  it('reads rates with up to 2 decimals, Bangla digits too', () => {
    expect(parseRate('৫২.৫০')).toBe(52.5)
    expect(parseRate('30')).toBe(30)
    expect(parseRate('0')).toBeNull()
    expect(parseRate('1.234')).toBeNull()
    expect(parseRate('abc')).toBeNull()
    expect(invalidCodes({ IRON: 'x', NEWSPAPER: '', CARTON: '18' })).toEqual(['IRON'])
  })

  it('publishes only what changed', () => {
    expect(changedRates(data, draftFrom(data))).toEqual([])
    expect(changedRates(data, { IRON: '50', NEWSPAPER: '31', CARTON: '' })).toEqual([{ categoryCode: 'NEWSPAPER', ratePerKg: 31 }])
    expect(changedRates(data, { IRON: '52', NEWSPAPER: '', CARTON: 'bad' })).toEqual([{ categoryCode: 'IRON', ratePerKg: 52 }])
  })

  it('shows the change from the previous rate', () => {
    expect(changeFromPrevious(48, 50)).toBe(2)
    expect(changeFromPrevious(30.5, 30)).toBe(-0.5)
    expect(changeFromPrevious(null, 30)).toBeNull()
    expect(changeFromPrevious(30, null)).toBeNull()
  })
})
