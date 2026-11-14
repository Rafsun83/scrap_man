import { PICKUP_STATUSES } from '@bw/shared';
import { allowedDisputeTypes, badgeTone, currentScalePhoto, screenFor, trackingSteps } from './pickupView';

describe('screenFor', () => {
  it('maps every status to a household screen', () => {
    expect(Object.fromEntries(PICKUP_STATUSES.map((s) => [s, screenFor(s)]))).toEqual({
      REQUESTED: 'SEARCHING',
      ACCEPTED: 'TRACKING',
      ARRIVED: 'TRACKING',
      WEIGHED: 'CONFIRM',
      DISPUTED: 'DISPUTED',
      CONFIRMED: 'PAYMENT',
      COMPLETED: 'RECEIPT',
      CANCELLED: 'ENDED',
      EXPIRED: 'ENDED',
    });
  });
});

it('marks tracking progress', () => {
  expect(trackingSteps('ACCEPTED')).toEqual(['done', 'current', 'todo', 'todo']);
  expect(trackingSteps('ARRIVED')).toEqual(['done', 'done', 'current', 'todo']);
});

describe('allowedDisputeTypes', () => {
  const base = { acceptedAt: '2026-11-14T04:00:00Z', openDispute: null, payment: null };

  it('allows WEIGHT only while WEIGHED', () => {
    expect(allowedDisputeTypes({ ...base, status: 'WEIGHED' })).toEqual(['WEIGHT', 'BEHAVIOUR', 'OTHER']);
    expect(allowedDisputeTypes({ ...base, status: 'ARRIVED' })).toEqual(['BEHAVIOUR', 'OTHER']);
  });

  it('allows PAYMENT only once paid', () => {
    const payment = { method: 'BKASH' as const, amount: 710, walletNumber: null, trxId: 'ABC123', status: 'PAID' as const, paidAt: '' };
    expect(allowedDisputeTypes({ ...base, status: 'COMPLETED', payment })).toEqual(['PAYMENT', 'BEHAVIOUR', 'OTHER']);
  });

  it('allows nothing before accept or while a dispute is open', () => {
    expect(allowedDisputeTypes({ ...base, status: 'REQUESTED', acceptedAt: null })).toEqual([]);
    const openDispute = { id: 'd' } as never;
    expect(allowedDisputeTypes({ ...base, status: 'WEIGHED', openDispute })).toEqual([]);
  });
});

it('colours badges by outcome', () => {
  expect(badgeTone('COMPLETED')).toBe('done');
  expect(badgeTone('EXPIRED')).toBe('cancelled');
  expect(badgeTone('WEIGHED')).toBe('active');
});

it('finds the scale photo of the latest round', () => {
  const photos = [
    { id: 'a', kind: 'SCALE' as const, weighVersion: 1, url: 'u1', createdAt: '' },
    { id: 'b', kind: 'ITEMS' as const, weighVersion: null, url: 'u2', createdAt: '' },
    { id: 'c', kind: 'SCALE' as const, weighVersion: 2, url: 'u3', createdAt: '' },
  ];
  expect(currentScalePhoto({ photos, weighVersion: 2 })?.id).toBe('c');
  expect(currentScalePhoto({ photos, weighVersion: null })).toBeNull();
});
