import { BOOKING_DAYS_AHEAD, SLOT_HOURS, type TimeSlot } from '@bw/shared';
import { AppError } from '../../../common/errors.js';
import { dhakaToday } from '../../../common/time.js';

/** Dhaka is UTC+6 all year (no daylight saving). */
const DHAKA_UTC_OFFSET_H = 6;

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The booked window as UTC instants, e.g. 2026-11-15 MORNING is 03:00Z to 06:00Z. */
function slotWindow(date: string, slot: TimeSlot): { start: Date; end: Date } {
  const [y, m, d] = date.split('-').map(Number);
  const hours = SLOT_HOURS[slot];
  return {
    start: new Date(Date.UTC(y, m - 1, d, hours.start - DHAKA_UTC_OFFSET_H)),
    end: new Date(Date.UTC(y, m - 1, d, hours.end - DHAKA_UTC_OFFSET_H)),
  };
}

/** Checks a requested slot is today or within the next few days and has not ended yet. Returns its end. */
function bookableSlotEnd(date: string, slot: TimeSlot, now: Date): Date {
  const today = dhakaToday(now);
  const last = addDays(today, BOOKING_DAYS_AHEAD);
  if (date < today || date > last) {
    throw AppError.validation(`Pick a day from today to ${last}.`, { slotDate: date });
  }
  const { end } = slotWindow(date, slot);
  if (end <= now) {
    throw AppError.validation('That time slot has already ended today. Pick a later slot or another day.', {
      slotDate: date,
      slot,
    });
  }
  return end;
}

export const slotUtil = { addDays, slotWindow, bookableSlotEnd } as const;
