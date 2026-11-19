import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { handleAdminEvent } from './realtime'

const keysOf = (spy: { mock: { calls: unknown[][] } }) => spy.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown }).queryKey))

describe('admin live events', () => {
  it('a pickup event refreshes the pickup, its timeline, the table, the counts and the map', () => {
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    handleAdminEvent(qc, 'pickup.weighed', { pickupId: 'p1' })
    expect(keysOf(spy)).toEqual(
      expect.arrayContaining(['["admin","overview"]', '["admin","map"]', '["admin","pickups"]', '["admin","pickup","p1"]', '["admin","pickup","p1","events"]']),
    )
  })

  it('a dispute event also refreshes the disputes', () => {
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    handleAdminEvent(qc, 'dispute.opened', { pickupId: 'p2', id: 'd1' })
    expect(keysOf(spy)).toEqual(expect.arrayContaining(['["admin","disputes"]', '["admin","pickup","p2"]']))
  })

  it('a new application refreshes the queue and the badge', () => {
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    handleAdminEvent(qc, 'collector.applied', { userId: 'c1', name: 'Jasim', at: '' })
    expect(keysOf(spy)).toEqual(expect.arrayContaining(['["admin","collectors"]', '["admin","overview"]']))
  })

  it('a new ops alert refreshes the alerts; pickup events refresh them too', () => {
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    handleAdminEvent(qc, 'ops.alert', { id: 'CONFIRMED_UNPAID:p1', kind: 'CONFIRMED_UNPAID' })
    expect(keysOf(spy)).toEqual(['["admin","alerts"]'])
    handleAdminEvent(qc, 'pickup.paid', { pickupId: 'p1' })
    expect(keysOf(spy)).toContain('["admin","alerts"]')
  })

  it('ignores collector pings (the map polls)', () => {
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    handleAdminEvent(qc, 'collector.location', { pickupId: 'p1', lat: 1, lng: 2, at: '' })
    expect(spy).not.toHaveBeenCalled()
  })
})
