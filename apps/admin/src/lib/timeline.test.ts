import type { PickupEvent } from '@bw/shared'
import { describe, expect, it } from 'vitest'
import { eventLabel } from './timeline'

const ev = (from: PickupEvent['from'], to: PickupEvent['to'], meta: Record<string, unknown> | null = null, actorName: string | null = 'Sohel Rana'): PickupEvent => ({
  id: '1',
  at: '',
  from,
  to,
  actorRole: actorName ? 'COLLECTOR' : null,
  actorName,
  meta,
})

describe('timeline lines', () => {
  it('reads like the prototype', () => {
    expect(eventLabel(ev(null, 'REQUESTED', null, 'Rasheda'), 'en')).toBe('requested by Rasheda')
    expect(eventLabel(ev('REQUESTED', 'ACCEPTED'), 'en')).toBe('accepted by Sohel Rana')
    expect(eventLabel(ev('ACCEPTED', 'ARRIVED'), 'en')).toBe('pickup code matched')
    expect(eventLabel(ev('ARRIVED', 'WEIGHED', { version: 1, totalKg: '14.0', totalAmount: '600.00' }), 'en')).toBe('weighed by Sohel Rana: 14 kg, ৳600')
    expect(eventLabel(ev('WEIGHED', 'DISPUTED'), 'en')).toBe('household rejected the weights')
    expect(eventLabel(ev('CONFIRMED', 'COMPLETED', { method: 'BKASH', trxId: 'X' }), 'en')).toBe('paid by bKash')
    expect(eventLabel(ev('ACCEPTED', 'REQUESTED', { release: true }), 'en')).toBe('given back by Sohel Rana')
    expect(eventLabel(ev('REQUESTED', 'REQUESTED', { searchRadiusM: 3000 }, null), 'en')).toBe('search widened to 3 km')
    expect(eventLabel(ev('REQUESTED', 'EXPIRED', null, null), 'en')).toBe('expired: nobody accepted')
  })

  it('in Bangla with Bangla digits', () => {
    expect(eventLabel(ev('ARRIVED', 'WEIGHED', { totalKg: '14.5', totalAmount: '625.00' }), 'bn')).toBe('ওজন করেছেন Sohel Rana: ১৪.৫ কেজি, ৳৬২৫')
    expect(eventLabel(ev('CONFIRMED', 'COMPLETED', { method: 'CASH' }), 'bn')).toBe('হাতে ক্যাশ-এ পরিশোধ হয়েছে')
  })
})
