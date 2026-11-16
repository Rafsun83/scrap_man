import { addDays, dhakaParts, dhakaToday } from '../lib/dhaka';

export type LedgerRange = 'TODAY' | 'WEEK' | 'MONTH';

/**
 * Dhaka dates for C9's tabs. The week starts on Saturday, as the working week does in Bangladesh;
 * the month starts on the 1st. Both end today.
 */
export function rangeFor(range: LedgerRange, now: Date = new Date()): { from: string; to: string } {
  const today = dhakaToday(now);
  if (range === 'TODAY') return { from: today, to: today };
  if (range === 'WEEK') {
    const sinceSaturday = (dhakaParts(now).weekday + 1) % 7; // Sat = 0 … Fri = 6
    return { from: addDays(today, -sinceSaturday), to: today };
  }
  return { from: `${today.slice(0, 8)}01`, to: today };
}
