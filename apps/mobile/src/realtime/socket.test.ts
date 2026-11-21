import { QueryClient } from '@tanstack/react-query';
import { handleEvent } from './socket';

jest.mock('socket.io-client', () => ({ io: jest.fn() }));

describe('live events', () => {
  it('refetches the pickup and the lists for a pickup event', () => {
    const qc = new QueryClient();
    const spy = jest.spyOn(qc, 'invalidateQueries');
    handleEvent(qc, 'pickup.weighed', { pickupId: 'p1', displayNo: 'BW-1', status: 'WEIGHED', at: '' });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['pickup', 'p1'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['me', 'pickups'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['me', 'notifications'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['me', 'summary'] });
  });

  it('refetches today\u2019s rates and the feed when rates are published', () => {
    const qc = new QueryClient();
    const spy = jest.spyOn(qc, 'invalidateQueries');
    handleEvent(qc, 'rates.published', { effectiveDate: '2026-11-21', at: '' });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['rates', 'today'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['me', 'notifications'] });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('refetches for dispute events and expiry', () => {
    const qc = new QueryClient();
    const spy = jest.spyOn(qc, 'invalidateQueries');
    handleEvent(qc, 'dispute.resolved', { pickupId: 'p2' });
    handleEvent(qc, 'request.expired', { pickupId: 'p3' });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['pickup', 'p2'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['pickup', 'p3'] });
  });

  it('keeps the nearby list current without refetching', () => {
    const qc = new QueryClient();
    const spy = jest.spyOn(qc, 'invalidateQueries');
    const req = (id: string, distanceM: number) => ({ id, distanceM, area: 'Mirpur', categoryCodes: ['IRON'] });
    // Nothing happens before the list is loaded.
    handleEvent(qc, 'request.created', req('a', 900));
    expect(qc.getQueryData(['collector', 'nearby'])).toBeUndefined();

    qc.setQueryData(['collector', 'nearby'], [req('a', 900)]);
    handleEvent(qc, 'request.created', req('b', 300));
    handleEvent(qc, 'request.created', req('a', 800)); // widened: sent again, replaced
    expect((qc.getQueryData(['collector', 'nearby']) as { id: string }[]).map((r) => r.id)).toEqual(['b', 'a']);
    handleEvent(qc, 'request.taken', { pickupId: 'b', reason: 'ACCEPTED' });
    expect((qc.getQueryData(['collector', 'nearby']) as { id: string }[]).map((r) => r.id)).toEqual(['a']);
    expect(spy).not.toHaveBeenCalled();
  });

  it("refetches the collector's profile on a decision and the ledger on payment", () => {
    const qc = new QueryClient();
    const spy = jest.spyOn(qc, 'invalidateQueries');
    handleEvent(qc, 'collector.verification', { userId: 'c1', verificationStatus: 'APPROVED', verificationNote: null, at: '' });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['collector', 'profile'] });
    handleEvent(qc, 'pickup.paid', { pickupId: 'p1' });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['collector', 'ledger'] });
  });

  it('stores collector.location without a refetch', () => {
    const qc = new QueryClient();
    const spy = jest.spyOn(qc, 'invalidateQueries');
    handleEvent(qc, 'collector.location', { pickupId: 'p1', lat: 23.8, lng: 90.4, at: 'now' });
    expect(spy).not.toHaveBeenCalled();
  });
});
