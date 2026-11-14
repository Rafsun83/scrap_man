import { dhakaToday } from './time.js';

describe('dhakaToday', () => {
  it('rolls over at midnight Dhaka time, not UTC', () => {
    // 18:30 UTC is 00:30 the next day in Dhaka (UTC+6)
    expect(dhakaToday(new Date('2026-11-12T18:30:00Z'))).toBe('2026-11-13');
    expect(dhakaToday(new Date('2026-11-12T17:30:00Z'))).toBe('2026-11-12');
  });
});
