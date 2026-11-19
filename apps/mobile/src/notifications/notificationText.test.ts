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

  it('tells households about a no-show and sends them to a new request', () => {
    expect(notificationView(n('PICKUP_NO_SHOW', { collectorName: 'জসিম' }), 'bn', categories)).toMatchObject({
      title: 'জসিম এসে কাউকে পাননি',
      href: '/sell/items',
      tone: 'alert',
    });
  });

  describe('collector feed', () => {
    const view = (type: Notification['type'], data: Notification['data'], lang: 'bn' | 'en' = 'bn') =>
      notificationView(n(type, data), lang, categories, now, 'COLLECTOR');

    it('opens the job screen, not the household pickup screen', () => {
      expect(view('PICKUP_CONFIRMED', { householdName: 'রাশেদা', amount: 710, method: 'BKASH' })).toMatchObject({
        title: 'রাশেদা ওজন মেনে নিয়েছেন: ৳৭১০',
        body: 'বিকাশ-এ টাকা দিয়ে পিকআপ শেষ করুন।',
        href: '/job/p1',
      });
      expect(view('PICKUP_CANCELLED', {}).href).toBe('/job/p1');
      expect(view('RATES_PUBLISHED', { effectiveDate: '2026-11-15' }).href).toBe('/requests');
    });

    it('says whether a weight dispute is the re-weigh or with staff', () => {
      expect(view('PICKUP_DISPUTED', { householdName: 'Rasheda', disputeStatus: 'REWEIGH' }, 'en')).toMatchObject({
        title: 'Rasheda disputed the weights',
        body: 'Weigh again in front of the household.',
      });
      expect(view('PICKUP_DISPUTED', { disputeStatus: 'ADMIN_REVIEW' }, 'en').body).toBe(
        'The BhangariWala team will review it; wait for their decision.',
      );
    });

    it('covers the decision, payment reports and ratings', () => {
      expect(view('APPLICATION_REJECTED', { note: 'Selfie is blurred' }, 'en')).toMatchObject({ body: 'Selfie is blurred', href: '/pending' });
      expect(view('APPLICATION_APPROVED', {}, 'en').href).toBe('/requests');
      expect(view('PAYMENT_REPORTED', { householdName: 'Rasheda', amount: 480, method: 'BKASH' }, 'en')).toMatchObject({
        title: 'Rasheda says the money did not arrive',
        body: '৳480 by bKash. The BhangariWala team is checking.',
      });
      expect(view('RATED', { householdName: 'রাশেদা', stars: 5 }).title).toBe('রাশেদা ৫ স্টার দিয়েছেন');
    });
  });
});
