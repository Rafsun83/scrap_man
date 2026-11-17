import type { AdminDispute } from '@bw/shared'
import { describe, expect, it } from 'vitest'
import { isOpen, needsTeamWeigh, outcomesFor } from './disputes'

describe('dispute resolutions (A4)', () => {
  it('offers the outcomes the API accepts for the type', () => {
    expect(outcomesFor('WEIGHT', 'DISPUTED')).toEqual(['ACCEPT_WEIGHTS', 'TEAM_REWEIGH', 'CANCEL'])
    expect(outcomesFor('PAYMENT', 'COMPLETED')).toEqual(['PAYMENT_VERIFIED', 'PAY_AGAIN', 'SUSPEND_COLLECTOR'])
    expect(outcomesFor('BEHAVIOUR', 'ACCEPTED')).toEqual(['NO_ACTION', 'SUSPEND_COLLECTOR', 'CANCEL'])
  })

  it('does not offer cancelling a finished pickup', () => {
    expect(outcomesFor('OTHER', 'COMPLETED')).toEqual(['NO_ACTION', 'SUSPEND_COLLECTOR'])
  })

  it('asks for team weights only after TEAM_REWEIGH while the pickup waits', () => {
    expect(needsTeamWeigh({ status: 'DISPUTED', openDispute: null }, 'TEAM_REWEIGH')).toBe(true)
    expect(needsTeamWeigh({ status: 'DISPUTED', openDispute: {} }, 'TEAM_REWEIGH')).toBe(false)
    expect(needsTeamWeigh({ status: 'WEIGHED', openDispute: null }, 'TEAM_REWEIGH')).toBe(false)
    expect(needsTeamWeigh({ status: 'DISPUTED', openDispute: null }, 'ACCEPT_WEIGHTS')).toBe(false)
  })

  it('keeps a team re-weigh in the open tab until the weights are in', () => {
    const d = (over: Partial<AdminDispute>) => ({ status: 'RESOLVED', outcome: 'TEAM_REWEIGH', pickupStatus: 'DISPUTED', ...over }) as AdminDispute
    expect(isOpen(d({}))).toBe(true)
    expect(isOpen(d({ pickupStatus: 'WEIGHED' }))).toBe(false)
    expect(isOpen(d({ status: 'ADMIN_REVIEW', outcome: null }))).toBe(true)
    expect(isOpen(d({ outcome: 'CANCEL', pickupStatus: 'CANCELLED' }))).toBe(false)
  })
})
