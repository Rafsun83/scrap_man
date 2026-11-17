import { OUTCOMES_BY_DISPUTE_TYPE, type AdminDispute, type DisputeOutcome, type DisputeType, type PickupStatus } from '@bw/shared'

const ACTIVE: ReadonlySet<PickupStatus> = new Set(['REQUESTED', 'ACCEPTED', 'ARRIVED', 'WEIGHED', 'DISPUTED', 'CONFIRMED'])

/**
 * The resolutions the API accepts for this dispute (OUTCOMES_BY_DISPUTE_TYPE). CANCEL is left out once the
 * pickup is finished, since a completed pickup cannot be cancelled.
 */
export function outcomesFor(type: DisputeType, pickupStatus: PickupStatus): DisputeOutcome[] {
  return OUTCOMES_BY_DISPUTE_TYPE[type].filter((o) => o !== 'CANCEL' || ACTIVE.has(pickupStatus))
}

/** After TEAM_REWEIGH the pickup stays DISPUTED with no open dispute until an admin enters weights. */
export function needsTeamWeigh(p: { status: PickupStatus; openDispute: unknown }, lastOutcome: DisputeOutcome | null): boolean {
  return p.status === 'DISPUTED' && !p.openDispute && lastOutcome === 'TEAM_REWEIGH'
}

/** Open = not resolved yet, or resolved with TEAM_REWEIGH while the pickup still waits for the team's weights. */
export function isOpen(d: AdminDispute): boolean {
  return d.status !== 'RESOLVED' || (d.outcome === 'TEAM_REWEIGH' && d.pickupStatus === 'DISPUTED')
}
