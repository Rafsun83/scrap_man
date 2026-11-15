import type { Notification } from '../api/types';
import { categories } from '../test/render';
import { notificationView } from './notificationText';

const base = { id: 'se:1', at: '2026-11-15T04:20:00Z', read: false, pickupId: 'p1', displayNo: 'BW-1052' };
const n = (type: Notification['type'], data: Notification['data']): Notification => ({ ...base, type, data });
const now = new Date('2026-11-15T05:00:00Z');

describe('notification text', () => {
  it('writes the prototype sentences in Bangla', () => {
    expect(notificationView(n('PICKUP_PAID', { method: 'BKASH', amount: 710, collectorName: 'জসিম উদ্দিন', categoryCodes: ['IRON'] }), 'bn', categories)).toMatchObject({
      title: '৳৭১০ বিকাশ-এ পাঠানো হয়েছে',
      body: 'জসিম উদ্দিন আপনার বিক্রির টাকা দিয়েছেন। লোহা।',
      tone: 'money',
      href: '/pickup/p1',
    });
    expect(notificationView(n('PICKUP_PAID', { method: 'CASH', amount: 520 }), 'bn', categories).title).toBe('৳৫২০ হাতে ক্যাশে পেয়েছেন');
    expect(notificationView(n('PICKUP_ACCEPTED', { collectorName: 'জসিম উদ্দিন' }), 'bn', categories).title).toBe('জসিম উদ্দিন অনুরোধ গ্রহণ করেছেন');
  });

  it('tells a first weigh from a re-weigh', () => {
    const first = notificationView(n('PICKUP_WEIGHED', { weighVersion: 1, amount: 605, totalKg: 14.5, categoryCodes: ['IRON', 'NEWSPAPER'] }), 'en', categories);
    expect(first).toMatchObject({ title: 'Check the weights: ৳605', body: 'Iron, Old newspaper, 14.5 kg. Approve if they are right.' });
    expect(notificationView(n('PICKUP_WEIGHED', { weighVersion: 2, amount: 650 }), 'en', categories).title).toBe('New weights are in: ৳650');
  });

  it('sends expired requests to a new request and rates to the rate board', () => {
    expect(notificationView(n('PICKUP_EXPIRED', {}), 'bn', categories).href).toBe('/sell/items');
    const today = notificationView({ ...n('RATES_PUBLISHED', { effectiveDate: '2026-11-15' }), pickupId: null }, 'bn', categories, now);
    expect(today).toMatchObject({ title: 'আজকের দর প্রকাশিত হয়েছে', href: '/rates' });
    const older = notificationView({ ...n('RATES_PUBLISHED', { effectiveDate: '2026-11-11' }), pickupId: null }, 'bn', categories, now);
    expect(older.title).toBe('১১ নভেম্বর-এর দর প্রকাশিত হয়েছে');
  });

  it('explains dispute outcomes and names an unknown collector', () => {
    expect(notificationView(n('DISPUTE_RESOLVED', { disputeType: 'PAYMENT', outcome: 'PAY_AGAIN' }), 'bn', categories).body).toBe('সংগ্রাহক আবার টাকা পাঠাবেন।');
    expect(notificationView(n('PICKUP_ACCEPTED', { collectorName: null }), 'en', categories).title).toBe('Collector accepted your request');
  });
});
