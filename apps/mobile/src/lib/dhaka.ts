import { BOOKING_DAYS_AHEAD, SLOT_HOURS, TIME_SLOTS, localDigits, type Lang, type TimeSlot } from '@bw/shared';

/** Dhaka is UTC+6 all year (no daylight saving), so local parts are UTC parts shifted by 6 hours. */
const OFFSET_MS = 6 * 60 * 60 * 1000;

type Parts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

export function dhakaParts(at: Date): Parts {
  const d = new Date(at.getTime() + OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    weekday: d.getUTCDay(),
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Today's date in Dhaka as YYYY-MM-DD (the API's slotDate format). */
export function dhakaToday(now: Date = new Date()): string {
  const p = dhakaParts(now);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

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

const MONTHS = {
  bn: ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
const MONTHS_SHORT = {
  bn: ['জানু.', 'ফেব্রু.', 'মার্চ', 'এপ্রি.', 'মে', 'জুন', 'জুলাই', 'আগ.', 'সেপ্টে.', 'অক্টো.', 'নভে.', 'ডিসে.'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};
const WEEKDAYS = {
  bn: ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};
const WEEKDAYS_SHORT = {
  bn: ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

/** A YYYY-MM-DD date as noon Dhaka time, so its parts never slip a day. */
function fromDateString(date: string): Date {
  return new Date(`${date}T06:00:00Z`);
}

/** "১১ নভেম্বর" / "11 November". */
export function formatDate(value: string | Date, lang: Lang): string {
  const p = dhakaParts(typeof value === 'string' && value.length === 10 ? fromDateString(value) : new Date(value));
  return lang === 'bn' ? `${localDigits(p.day, lang)} ${MONTHS.bn[p.month - 1]}` : `${p.day} ${MONTHS.en[p.month - 1]}`;
}

/** "বুধবার, ১১ নভেম্বর" / "Wednesday, 11 November". */
export function formatLongDate(value: string | Date, lang: Lang): string {
  const at = typeof value === 'string' && value.length === 10 ? fromDateString(value) : new Date(value);
  return `${WEEKDAYS[lang][dhakaParts(at).weekday]}, ${formatDate(at, lang)}`;
}

/** Day button sub-label: "বুধ, ১১ নভে." / "Wed, 11 Nov". */
export function formatShortDay(date: string, lang: Lang): string {
  const p = dhakaParts(fromDateString(date));
  return `${WEEKDAYS_SHORT[lang][p.weekday]}, ${localDigits(p.day, lang)} ${MONTHS_SHORT[lang][p.month - 1]}`;
}

export function weekdayName(date: string, lang: Lang): string {
  return WEEKDAYS[lang][dhakaParts(fromDateString(date)).weekday];
}

/** Bangla time of day word for an hour, as people say it: সকাল ১০:২০, বিকেল ৪:০৫. */
function bnPeriod(hour: number): string {
  if (hour < 4) return 'রাত';
  if (hour < 6) return 'ভোর';
  if (hour < 12) return 'সকাল';
  if (hour < 15) return 'দুপুর';
  if (hour < 18) return 'বিকেল';
  if (hour < 20) return 'সন্ধ্যা';
  return 'রাত';
}

/** "সকাল ১০:২০" / "10:20 am" in Dhaka time. */
export function formatTime(value: string | Date, lang: Lang): string {
  const p = dhakaParts(new Date(value));
  const h12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  const hm = `${h12}:${pad(p.minute)}`;
  return lang === 'bn' ? `${bnPeriod(p.hour)} ${localDigits(hm, lang)}` : `${hm} ${p.hour < 12 ? 'am' : 'pm'}`;
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
