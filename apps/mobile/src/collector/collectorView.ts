import type { CollectorProfile, Pickup } from '../api/types';

/** Where the collector app opens: sign-up (C6), waiting or rejected (C7), or the work tabs. */
export function collectorRoute(profile: CollectorProfile | null): 'JOIN' | 'PENDING' | 'WORK' {
  if (!profile) return 'JOIN';
  return profile.verificationStatus === 'APPROVED' ? 'WORK' : 'PENDING';
}

/** Which collector screen shows an assigned pickup. */
export type JobScreen = 'ARRIVE' | 'WEIGH' | 'WAIT_CONFIRM' | 'REWEIGH' | 'REVIEW' | 'PAY' | 'PAY_AGAIN' | 'DONE' | 'ENDED';

export function jobScreenFor(p: Pick<Pickup, 'status' | 'openDispute' | 'payment'>): JobScreen {
  switch (p.status) {
    case 'ACCEPTED':
      return 'ARRIVE'; // C3
    case 'ARRIVED':
      return 'WEIGH'; // C4
    case 'WEIGHED':
      return 'WAIT_CONFIRM';
    case 'DISPUTED':
      // The first weight dispute comes back to the collector (C10); later ones, and a team re-weigh, wait for staff.
      return p.openDispute?.type === 'WEIGHT' && p.openDispute.status === 'REWEIGH' ? 'REWEIGH' : 'REVIEW';
    case 'CONFIRMED':
      return 'PAY'; // C5
    case 'COMPLETED':
      // A REPORTED payment with no open payment dispute means staff decided PAY_AGAIN.
      return p.payment?.status === 'REPORTED' && p.openDispute?.type !== 'PAYMENT' ? 'PAY_AGAIN' : 'DONE';
    default:
      return 'ENDED'; // cancelled, expired, or given back
  }
}

const ACTIVE = new Set(['ACCEPTED', 'ARRIVED', 'WEIGHED', 'DISPUTED', 'CONFIRMED']);

/** C8: active pickups booked for today (or overdue) vs later days. */
export function splitActive<T extends Pick<Pickup, 'status' | 'slotDate'>>(pickups: T[], today: string) {
  const active = pickups.filter((p) => ACTIVE.has(p.status));
  return {
    today: active.filter((p) => p.slotDate <= today),
    upcoming: active.filter((p) => p.slotDate > today),
  };
}

/** The pickup the collector is working on now (shown as a banner on C1), if any. */
export function currentJob<T extends Pick<Pickup, 'status' | 'slotDate'>>(pickups: T[]): T | null {
  return pickups.find((p) => ACTIVE.has(p.status)) ?? null;
}
