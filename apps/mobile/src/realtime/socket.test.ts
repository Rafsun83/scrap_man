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
  });

  it('refetches for dispute events and expiry', () => {
    const qc = new QueryClient();
    const spy = jest.spyOn(qc, 'invalidateQueries');
    handleEvent(qc, 'dispute.resolved', { pickupId: 'p2' });
    handleEvent(qc, 'request.expired', { pickupId: 'p3' });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['pickup', 'p2'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['pickup', 'p3'] });
  });

  it('ignores collector-only events', () => {
    const qc = new QueryClient();
    const spy = jest.spyOn(qc, 'invalidateQueries');
    handleEvent(qc, 'request.created', { id: 'p1' });
    handleEvent(qc, 'request.taken', { pickupId: 'p1', reason: 'ACCEPTED' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('stores collector.location without a refetch', () => {
    const qc = new QueryClient();
    const spy = jest.spyOn(qc, 'invalidateQueries');
    handleEvent(qc, 'collector.location', { pickupId: 'p1', lat: 23.8, lng: 90.4, at: 'now' });
    expect(spy).not.toHaveBeenCalled();
  });
});
