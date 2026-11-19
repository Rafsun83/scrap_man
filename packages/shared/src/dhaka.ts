import { localDigits, type Lang } from './i18n.js';

/**
 * Dhaka calendar and clock, built by hand: Dhaka is UTC+6 all year (no daylight saving), so local parts are UTC
 * parts shifted by 6 hours. No reliance on the device's or browser's locale data (Bangla locales are uneven).
 */
const OFFSET_MS = 6 * 60 * 60 * 1000;

export type DhakaParts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

/** month is 1-12, weekday 0 (Sunday) to 6. */
export function dhakaParts(at: Date): DhakaParts {
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

export const MONTHS = {
  bn: ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
} as const;
export const MONTHS_SHORT = {
  bn: ['জানু.', 'ফেব্রু.', 'মার্চ', 'এপ্রি.', 'মে', 'জুন', 'জুলাই', 'আগ.', 'সেপ্টে.', 'অক্টো.', 'নভে.', 'ডিসে.'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
} as const;
export const WEEKDAYS = {
  bn: ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
} as const;
export const WEEKDAYS_SHORT = {
  bn: ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
} as const;

/** A YYYY-MM-DD date as noon Dhaka time, so its parts never slip a day; anything else as an instant. */
export function toDhakaDate(value: string | Date): Date {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T06:00:00Z`) : new Date(value);
}

export type DateStyle = { year?: boolean; shortMonth?: boolean };

/** "১১ নভেম্বর" / "11 November"; with options "11 Nov 2026". */
export function formatDhakaDate(value: string | Date, lang: Lang, style: DateStyle = {}): string {
  const p = dhakaParts(toDhakaDate(value));
  const month = (style.shortMonth ? MONTHS_SHORT : MONTHS)[lang][p.month - 1];
  return `${localDigits(p.day, lang)} ${month}${style.year ? ` ${localDigits(p.year, lang)}` : ''}`;
}

/** "বুধবার, ১১ নভেম্বর" / "Wednesday, 11 November" (with `year`, the year too). */
export function formatDhakaLongDate(value: string | Date, lang: Lang, style: DateStyle = {}): string {
  const at = toDhakaDate(value);
  return `${WEEKDAYS[lang][dhakaParts(at).weekday]}, ${formatDhakaDate(at, lang, style)}`;
}

/** Bangla time of day as people say it: সকাল ১০:২০, বিকেল ৪:০৫. */
export function bnDayPeriod(hour: number): string {
  if (hour < 4) return 'রাত';
  if (hour < 6) return 'ভোর';
  if (hour < 12) return 'সকাল';
  if (hour < 15) return 'দুপুর';
  if (hour < 18) return 'বিকেল';
  if (hour < 20) return 'সন্ধ্যা';
  return 'রাত';
}

/** "সকাল ১০:২০" / "10:20 am" in Dhaka time. */
export function formatDhakaTime(value: string | Date, lang: Lang): string {
  const p = dhakaParts(new Date(value));
  const hm = `${p.hour % 12 === 0 ? 12 : p.hour % 12}:${pad(p.minute)}`;
  return lang === 'bn' ? `${bnDayPeriod(p.hour)} ${localDigits(hm, lang)}` : `${hm} ${p.hour < 12 ? 'am' : 'pm'}`;
}
