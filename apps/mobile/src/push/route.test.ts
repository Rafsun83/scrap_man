import { pushRoute } from './route';

describe('push taps', () => {
  it('opens the household pickup, or the feed without one', () => {
    expect(pushRoute({ kind: 'WEIGHED', pickupId: 'p1' }, 'HOUSEHOLD')).toBe('/pickup/p1');
    expect(pushRoute({ kind: 'X' }, 'HOUSEHOLD')).toBe('/notifications');
  });

  it('opens the collector job, the nearby list for a new request, or the gate for a decision', () => {
    expect(pushRoute({ kind: 'CONFIRMED', pickupId: 'p1' }, 'COLLECTOR')).toBe('/job/p1');
    expect(pushRoute({ kind: 'NEW_REQUEST', pickupId: 'p1' }, 'COLLECTOR')).toBe('/requests');
    expect(pushRoute({ kind: 'APPROVED' }, 'COLLECTOR')).toBe('/collector');
    expect(pushRoute(undefined, 'COLLECTOR')).toBe('/requests');
  });
});
