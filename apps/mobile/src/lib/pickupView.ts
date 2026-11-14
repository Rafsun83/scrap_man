import type { PickupStatus } from '@bw/shared';
import type { DisputeType, Pickup } from '../api/types';

/** Which household screen shows a pickup in each status. */
export type PickupScreen = 'SEARCHING' | 'TRACKING' | 'CONFIRM' | 'DISPUTED' | 'PAYMENT' | 'RECEIPT' | 'ENDED';

export function screenFor(status: PickupStatus): PickupScreen {
  switch (status) {
    case 'REQUESTED':
      return 'SEARCHING'; // H5
    case 'ACCEPTED':
    case 'ARRIVED':
      return 'TRACKING'; // H6
    case 'WEIGHED':
      return 'CONFIRM'; // H7
    case 'DISPUTED':
      return 'DISPUTED';
    case 'CONFIRMED':
      return 'PAYMENT'; // H8, waiting for the collector's payment
    case 'COMPLETED':
      return 'RECEIPT'; // H8
    case 'CANCELLED':
    case 'EXPIRED':
      return 'ENDED';
  }
}

export type StepState = 'done' | 'current' | 'todo';

/** H6 progress: accepted, on the way, weighing, payment. */
export function trackingSteps(status: PickupStatus): StepState[] {
  const current = status === 'ACCEPTED' ? 1 : status === 'ARRIVED' ? 2 : status === 'COMPLETED' ? 4 : 3;
  return [0, 1, 2, 3].map((i) => (i < current ? 'done' : i === current ? 'current' : 'todo'));
}

/**
 * Dispute types the household may send now, following the contract: WEIGHT while WEIGHED, PAYMENT while
 * COMPLETED (and only once the payment is recorded as PAID), BEHAVIOUR and OTHER any time after accept.
 * One open dispute per pickup, so none while one is open.
 */
export function allowedDisputeTypes(p: Pick<Pickup, 'status' | 'acceptedAt' | 'openDispute' | 'payment'>): DisputeType[] {
  if (p.openDispute) return [];
  if (!p.acceptedAt) return [];
  const types: DisputeType[] = [];
  if (p.status === 'WEIGHED') types.push('WEIGHT');
  if (p.status === 'COMPLETED' && p.payment?.status === 'PAID') types.push('PAYMENT');
  types.push('BEHAVIOUR', 'OTHER');
  return types;
}

/** Status badge colours for the history list. */
export function badgeTone(status: PickupStatus): 'done' | 'cancelled' | 'active' {
  if (status === 'COMPLETED') return 'done';
  if (status === 'CANCELLED' || status === 'EXPIRED') return 'cancelled';
  return 'active';
}

/** The scale photo for the round now shown (the latest weigh round). */
export function currentScalePhoto(p: Pick<Pickup, 'photos' | 'weighVersion'>) {
  return p.photos.find((ph) => ph.kind === 'SCALE' && ph.weighVersion === p.weighVersion) ?? null;
}
