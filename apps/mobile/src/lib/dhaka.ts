import {
  addDays,
  BOOKING_DAYS_AHEAD,
  dhakaParts,
  dhakaToday,
  formatDhakaDate,
  formatDhakaLongDate,
  formatDhakaTime,
  localDigits,
  MONTHS_SHORT,
  SLOT_HOURS,
  TIME_SLOTS,
  WEEKDAYS,
  WEEKDAYS_SHORT,
  type Lang,
  type TimeSlot,
} from '@bw/shared';

/** The Dhaka calendar primitives live in @bw/shared (shared with the admin panel); the app-specific rules are here. */
export { addDays, dhakaParts, dhakaToday };

/** Dhaka is UTC+6 all year (no daylight saving). */
const OFFSET_MS = 6 * 60 * 60 * 1000;

/** End of a booked slot as an instant, matching the API's expiry (e.g. MORNING ends 12:00 Dhaka). */
export function slotEnd(date: string, slot: TimeSlot): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, SLOT_HOURS[slot].end) - OFFSET_MS);
}

export type BookableDay = { date: string; offset: number; slots: { slot: TimeSlot; open: boolean }[] };

/** Today plus BOOKING_DAYS_AHEAD days; a slot is open until it ends, as the API checks. */
export function bookableDays(now: Date = new Date()): BookableDay[] {
  const today = dhakaToday(now);
  return Array.from({ length: BOOKING_DAYS_AHEAD + 1 }, (_, offset) => {
    const date = addDays(today, offset);
    return {
      date,
      offset,
      slots: TIME_SLOTS.map((slot) => ({ slot, open: slotEnd(date, slot).getTime() > now.getTime() })),
    };
  });
}

/** The first day and slot still open, for the schedule screen's default choice. */
export function firstOpenSlot(days: BookableDay[]): { date: string; slot: TimeSlot } | null {
  for (const day of days) {
    const open = day.slots.find((s) => s.open);
    if (open) return { date: day.date, slot: open.slot };
  }
  return null;
}

/** A YYYY-MM-DD date as noon Dhaka time, so its parts never slip a day. */
function fromDateString(date: string): Date {
  return new Date(`${date}T06:00:00Z`);
}

/** "১১ নভেম্বর" / "11 November". */
export function formatDate(value: string | Date, lang: Lang): string {
  return formatDhakaDate(value, lang);
}

/** "বুধবার, ১১ নভেম্বর" / "Wednesday, 11 November". */
export function formatLongDate(value: string | Date, lang: Lang): string {
  return formatDhakaLongDate(value, lang);
}

/** Day button sub-label: "বুধ, ১১ নভে." / "Wed, 11 Nov". */
export function formatShortDay(date: string, lang: Lang): string {
  const p = dhakaParts(fromDateString(date));
  return `${WEEKDAYS_SHORT[lang][p.weekday]}, ${localDigits(p.day, lang)} ${MONTHS_SHORT[lang][p.month - 1]}`;
}

export function weekdayName(date: string, lang: Lang): string {
  return WEEKDAYS[lang][dhakaParts(fromDateString(date)).weekday];
}

/** "সকাল ১০:২০" / "10:20 am" in Dhaka time. */
export function formatTime(value: string | Date, lang: Lang): string {
  return formatDhakaTime(value, lang);
}

/** Relative day word for a slot date: আজ / আগামীকাল / weekday name. */
export function relativeDay(date: string, lang: Lang, now: Date = new Date()): 'today' | 'tomorrow' | string {
  const today = dhakaToday(now);
  if (date === today) return 'today';
  if (date === addDays(today, 1)) return 'tomorrow';
  return weekdayName(date, lang);
}

/** Greeting key for the current Dhaka hour. */
export function greetingKey(now: Date = new Date()) {
  const { hour } = dhakaParts(now);
  if (hour >= 4 && hour < 12) return 'greetMorning' as const;
  if (hour >= 12 && hour < 15) return 'greetNoon' as const;
  if (hour >= 15 && hour < 18) return 'greetAfternoon' as const;
  if (hour >= 18 && hour < 21) return 'greetEvening' as const;
  return 'greetNight' as const;
}
