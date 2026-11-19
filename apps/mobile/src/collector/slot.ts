import { SLOT_HOURS, type TimeSlot } from '@bw/shared';

/** When a booked slot starts, as an instant (Dhaka is UTC+6): the no-show report opens then. */
export function slotStart(date: string, slot: TimeSlot): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, SLOT_HOURS[slot].start - 6));
}
