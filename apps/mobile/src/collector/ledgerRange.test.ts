import { rangeFor } from './ledgerRange';

describe('ledger ranges', () => {
  // 2026-11-16 is a Monday; 10:00 in Dhaka is 04:00 UTC.
  const monday = new Date('2026-11-16T04:00:00Z');

  it('today is one Dhaka day', () => {
    expect(rangeFor('TODAY', monday)).toEqual({ from: '2026-11-16', to: '2026-11-16' });
    // 23:30 UTC on the 15th is already the 16th in Dhaka.
    expect(rangeFor('TODAY', new Date('2026-11-15T23:30:00Z'))).toEqual({ from: '2026-11-16', to: '2026-11-16' });
  });

  it('the week starts on Saturday', () => {
    expect(rangeFor('WEEK', monday)).toEqual({ from: '2026-11-14', to: '2026-11-16' });
    expect(rangeFor('WEEK', new Date('2026-11-14T04:00:00Z'))).toEqual({ from: '2026-11-14', to: '2026-11-14' });
    expect(rangeFor('WEEK', new Date('2026-11-20T04:00:00Z'))).toEqual({ from: '2026-11-14', to: '2026-11-20' });
  });

  it('the month starts on the 1st', () => {
    expect(rangeFor('MONTH', monday)).toEqual({ from: '2026-11-01', to: '2026-11-16' });
  });
});
