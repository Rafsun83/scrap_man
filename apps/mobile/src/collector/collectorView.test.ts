import { makePickup } from '../test/render';
import { collectorRoute, currentJob, jobScreenFor, splitActive } from './collectorView';

const profile = (verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED') => ({ verificationStatus }) as never;
const dispute = (type: string, status: string) => ({ type, status }) as never;

describe('collector routing', () => {
  it('opens sign-up, waiting, or the work tabs', () => {
    expect(collectorRoute(null)).toBe('JOIN');
    expect(collectorRoute(profile('PENDING'))).toBe('PENDING');
    expect(collectorRoute(profile('REJECTED'))).toBe('PENDING');
    expect(collectorRoute(profile('APPROVED'))).toBe('WORK');
  });

  it('picks the job screen from the status', () => {
    expect(jobScreenFor(makePickup({ status: 'ACCEPTED' }))).toBe('ARRIVE');
    expect(jobScreenFor(makePickup({ status: 'ARRIVED' }))).toBe('WEIGH');
    expect(jobScreenFor(makePickup({ status: 'WEIGHED' }))).toBe('WAIT_CONFIRM');
    expect(jobScreenFor(makePickup({ status: 'CONFIRMED' }))).toBe('PAY');
    expect(jobScreenFor(makePickup({ status: 'CANCELLED' }))).toBe('ENDED');
    expect(jobScreenFor(makePickup({ status: 'REQUESTED' }))).toBe('ENDED');
  });

  it('sends the first weight dispute back to the collector, later ones to staff', () => {
    expect(jobScreenFor(makePickup({ status: 'DISPUTED', openDispute: dispute('WEIGHT', 'REWEIGH') }))).toBe('REWEIGH');
    expect(jobScreenFor(makePickup({ status: 'DISPUTED', openDispute: dispute('WEIGHT', 'ADMIN_REVIEW') }))).toBe('REVIEW');
    // Team re-weigh: the dispute is resolved but the pickup stays DISPUTED until staff weigh.
    expect(jobScreenFor(makePickup({ status: 'DISPUTED', openDispute: null }))).toBe('REVIEW');
  });

  it('asks to pay again only after staff decide PAY_AGAIN', () => {
    const payment = (status: 'PAID' | 'REPORTED' | 'VERIFIED') =>
      ({ method: 'BKASH', amount: 625, walletNumber: '+8801712345678', trxId: 'ABC123', status, paidAt: '' }) as const;
    expect(jobScreenFor(makePickup({ status: 'COMPLETED', payment: payment('PAID') }))).toBe('DONE');
    expect(jobScreenFor(makePickup({ status: 'COMPLETED', payment: payment('REPORTED'), openDispute: dispute('PAYMENT', 'ADMIN_REVIEW') }))).toBe('DONE');
    expect(jobScreenFor(makePickup({ status: 'COMPLETED', payment: payment('REPORTED'), openDispute: null }))).toBe('PAY_AGAIN');
  });

  it('splits active pickups into today (and overdue) and upcoming', () => {
    const list = [
      makePickup({ id: 'a', status: 'ACCEPTED', slotDate: '2026-11-15' }),
      makePickup({ id: 'b', status: 'CONFIRMED', slotDate: '2026-11-16' }),
      makePickup({ id: 'c', status: 'ACCEPTED', slotDate: '2026-11-17' }),
      makePickup({ id: 'd', status: 'COMPLETED', slotDate: '2026-11-16' }),
    ];
    const { today, upcoming } = splitActive(list, '2026-11-16');
    expect(today.map((p) => p.id)).toEqual(['a', 'b']);
    expect(upcoming.map((p) => p.id)).toEqual(['c']);
    expect(currentJob(list)?.id).toBe('a');
    expect(currentJob([list[3]])).toBeNull();
  });
});
