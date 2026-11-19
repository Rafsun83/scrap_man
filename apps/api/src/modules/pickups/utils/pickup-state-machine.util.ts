import type { PickupStatus } from '@bw/shared';
import { AppError } from '../../../common/errors.js';
import type { Actor } from '../types/pickup-record.types.js';

interface Rule {
  from: readonly PickupStatus[];
  to: PickupStatus;
  by: readonly Actor[];
}

/** The pickup state machine from CLAUDE.md. Anything not listed is INVALID_STATE. */
const TRANSITIONS: readonly Rule[] = [
  { from: ['REQUESTED'], to: 'ACCEPTED', by: ['COLLECTOR'] },
  { from: ['REQUESTED'], to: 'REQUESTED', by: ['SYSTEM'] }, // radius widening
  { from: ['REQUESTED'], to: 'EXPIRED', by: ['SYSTEM'] },
  { from: ['REQUESTED', 'ACCEPTED'], to: 'CANCELLED', by: ['HOUSEHOLD', 'ADMIN'] },
  { from: ['ARRIVED', 'WEIGHED', 'DISPUTED', 'CONFIRMED'], to: 'CANCELLED', by: ['ADMIN'] },
  { from: ['ACCEPTED'], to: 'CANCELLED', by: ['COLLECTOR'] }, // household not home (no-show)
  { from: ['ACCEPTED'], to: 'REQUESTED', by: ['COLLECTOR'] }, // release
  { from: ['ACCEPTED'], to: 'ARRIVED', by: ['COLLECTOR'] },
  { from: ['ARRIVED'], to: 'WEIGHED', by: ['COLLECTOR'] },
  { from: ['WEIGHED'], to: 'CONFIRMED', by: ['HOUSEHOLD'] },
  { from: ['WEIGHED'], to: 'DISPUTED', by: ['HOUSEHOLD'] },
  { from: ['DISPUTED'], to: 'WEIGHED', by: ['COLLECTOR', 'ADMIN'] },
  { from: ['CONFIRMED'], to: 'COMPLETED', by: ['COLLECTOR'] },
];

const READABLE: Record<PickupStatus, string> = {
  REQUESTED: 'waiting for a collector',
  ACCEPTED: 'accepted by a collector',
  ARRIVED: 'with the collector at the door',
  WEIGHED: 'waiting for the household to check the weights',
  DISPUTED: 'under dispute',
  CONFIRMED: 'waiting for payment',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
};

function canTransition(from: PickupStatus, to: PickupStatus, by: Actor): boolean {
  return TRANSITIONS.some((r) => r.to === to && r.from.includes(from) && r.by.includes(by));
}

function assertTransition(from: PickupStatus, to: PickupStatus, by: Actor): void {
  if (!canTransition(from, to, by)) {
    throw AppError.invalidState(`This pickup is ${READABLE[from]}, so that cannot be done now. Refresh to see the latest.`, {
      status: from,
    });
  }
}

function describeStatus(status: PickupStatus): string {
  return READABLE[status];
}

export const pickupStateMachineUtil = { TRANSITIONS, canTransition, assertTransition, describeStatus } as const;
