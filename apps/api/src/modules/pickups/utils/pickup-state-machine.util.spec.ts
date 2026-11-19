import { PICKUP_STATUSES, type PickupStatus } from '@bw/shared';
import type { Actor } from '../types/pickup-record.types.js';
import { pickupStateMachineUtil } from './pickup-state-machine.util.js';

const { assertTransition, canTransition } = pickupStateMachineUtil;

const ACTORS: Actor[] = ['HOUSEHOLD', 'COLLECTOR', 'ADMIN', 'SYSTEM'];

/** The table in CLAUDE.md, written out as [from, to, who]. */
const ALLOWED: [PickupStatus, PickupStatus, Actor][] = [
  ['REQUESTED', 'ACCEPTED', 'COLLECTOR'],
  ['REQUESTED', 'REQUESTED', 'SYSTEM'],
  ['REQUESTED', 'EXPIRED', 'SYSTEM'],
  ['REQUESTED', 'CANCELLED', 'HOUSEHOLD'],
  ['REQUESTED', 'CANCELLED', 'ADMIN'],
  ['ACCEPTED', 'CANCELLED', 'HOUSEHOLD'],
  ['ACCEPTED', 'CANCELLED', 'ADMIN'],
  ['ACCEPTED', 'CANCELLED', 'COLLECTOR'], // household not home (no-show), M6
  ['ARRIVED', 'CANCELLED', 'ADMIN'],
  ['WEIGHED', 'CANCELLED', 'ADMIN'],
  ['DISPUTED', 'CANCELLED', 'ADMIN'],
  ['CONFIRMED', 'CANCELLED', 'ADMIN'],
  ['ACCEPTED', 'REQUESTED', 'COLLECTOR'],
  ['ACCEPTED', 'ARRIVED', 'COLLECTOR'],
  ['ARRIVED', 'WEIGHED', 'COLLECTOR'],
  ['WEIGHED', 'CONFIRMED', 'HOUSEHOLD'],
  ['WEIGHED', 'DISPUTED', 'HOUSEHOLD'],
  ['DISPUTED', 'WEIGHED', 'COLLECTOR'],
  ['DISPUTED', 'WEIGHED', 'ADMIN'],
  ['CONFIRMED', 'COMPLETED', 'COLLECTOR'],
];

describe('pickup state machine', () => {
  const key = (f: string, t: string, a: string) => `${f}>${t}>${a}`;
  const allowed = new Set(ALLOWED.map(([f, t, a]) => key(f, t, a)));

  it('allows exactly the moves in the table, for exactly those actors', () => {
    for (const from of PICKUP_STATUSES) {
      for (const to of PICKUP_STATUSES) {
        for (const actor of ACTORS) {
          expect(canTransition(from, to, actor), key(from, to, actor)).toBe(allowed.has(key(from, to, actor)));
        }
      }
    }
  });

  it('never leaves a final status', () => {
    for (const from of ['COMPLETED', 'CANCELLED', 'EXPIRED'] as const) {
      for (const to of PICKUP_STATUSES) {
        for (const actor of ACTORS) expect(canTransition(from, to, actor)).toBe(false);
      }
    }
  });

  it('refuses with INVALID_STATE and says what the pickup is doing', () => {
    expect(() => assertTransition('COMPLETED', 'CANCELLED', 'HOUSEHOLD')).toThrow(
      expect.objectContaining({ code: 'INVALID_STATE', status: 409, details: { status: 'COMPLETED' } }),
    );
    expect(() => assertTransition('ARRIVED', 'CANCELLED', 'HOUSEHOLD')).toThrow(/with the collector at the door/);
  });
});
