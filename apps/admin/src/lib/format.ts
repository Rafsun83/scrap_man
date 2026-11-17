import { formatKg, formatTaka, localDigits, WORK_AREAS, type Category, type Lang } from '@bw/shared'

export { formatKg, formatTaka, localDigits }

const PHONE_RE = /^\+8801[3-9][0-9]{8}$/

/** Bangla or ASCII digits, with or without 0 / 880 / +880, to the API's +8801XXXXXXXXX. Null if not a BD mobile. */
export function normalizePhone(input: string): string | null {
  let local = input.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d))).replace(/[^0-9]/g, '')
  if (local.startsWith('880')) local = local.slice(3)
  if (local.startsWith('0')) local = local.slice(1)
  const phone = `+880${local}`
  return PHONE_RE.test(phone) ? phone : null
}

/** "01712-345456" style, in the reader's digits. */
export function formatPhone(phone: string | null | undefined, lang: Lang): string {
  if (!phone) return '—'
  const m = /^\+880(\d{4})(\d{6})$/.exec(phone)
  return localDigits(m ? `0${m[1]}-${m[2]}` : phone, lang)
}

/** Dhaka is UTC+6 all year, so its calendar parts are UTC parts shifted by 6 hours (no browser locale data needed). */
function dhakaParts(at: Date) {
  const d = new Date(at.getTime() + 6 * 3_600_000)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate(), hour: d.getUTCHours(), minute: d.getUTCMinutes(), weekday: d.getUTCDay() }
}

const MONTHS = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  bn: ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'],
}
const WEEKDAYS = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  bn: ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'],
}

/** A YYYY-MM-DD date as noon in Dhaka, so it never slips a day; anything else as an instant. */
const toDate = (value: string | Date) => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T06:00:00Z`) : new Date(value))

/** "11 Nov 2026" / "১১ নভেম্বর ২০২৬" in Dhaka time. */
export function formatDate(value: string | Date, lang: Lang): string {
  const p = dhakaParts(toDate(value))
  const month = lang === 'en' ? MONTHS.en[p.month].slice(0, 3) : MONTHS.bn[p.month]
  return localDigits(`${p.day} `, lang) + month + localDigits(` ${p.year}`, lang)
}

/** "Wednesday, 11 November 2026" / "বুধবার, ১১ নভেম্বর ২০২৬" in Dhaka time. */
export function formatLongDate(value: string | Date, lang: Lang): string {
  const p = dhakaParts(toDate(value))
  return `${WEEKDAYS[lang][p.weekday]}, ${localDigits(p.day, lang)} ${MONTHS[lang][p.month]} ${localDigits(p.year, lang)}`
}

/** Bangla time of day as people say it: সকাল ১০:২০, বিকেল ৪:০৫ (same words as the apps). */
function bnPeriod(hour: number): string {
  if (hour < 4) return 'রাত'
  if (hour < 6) return 'ভোর'
  if (hour < 12) return 'সকাল'
  if (hour < 15) return 'দুপুর'
  if (hour < 18) return 'বিকেল'
  if (hour < 20) return 'সন্ধ্যা'
  return 'রাত'
}

/** "10:05 AM" / "সকাল ১০:০৫" in Dhaka time. */
export function formatTime(value: string | Date, lang: Lang): string {
  const p = dhakaParts(new Date(value))
  const hm = `${p.hour % 12 === 0 ? 12 : p.hour % 12}:${String(p.minute).padStart(2, '0')}`
  return lang === 'bn' ? `${bnPeriod(p.hour)} ${localDigits(hm, lang)}` : `${hm} ${p.hour < 12 ? 'AM' : 'PM'}`
}

/** Time today, or date and time for other days. */
export function formatWhen(value: string, lang: Lang, now: Date = new Date()): string {
  return dhakaDate(new Date(value)) === dhakaDate(now) ? formatTime(value, lang) : `${formatDate(value, lang)}, ${formatTime(value, lang)}`
}

/** YYYY-MM-DD in Dhaka. */
export function dhakaDate(at: Date = new Date()): string {
  const p = dhakaParts(at)
  return `${p.year}-${String(p.month + 1).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** Minutes and hours since `since`, as numbers for the duration strings. */
export function sinceParts(since: string, now: Date = new Date()): { minutes: number; h: number; m: number } {
  const minutes = Math.max(0, Math.floor((now.getTime() - Date.parse(since)) / 60_000))
  return { minutes, h: Math.floor(minutes / 60), m: minutes % 60 }
}

export function workAreaNames(codes: string[], lang: Lang): string {
  return codes.map((c) => WORK_AREAS.find((a) => a.code === c)?.[lang] ?? c).join(', ')
}

/** Money and weight, or a dash when there is none yet. */
export const money = (n: number | null | undefined, lang: Lang) => (n == null ? '—' : formatTaka(n, lang))
export const kg = (n: number | null | undefined, lang: Lang) => (n == null ? '—' : formatKg(n, lang))

/** A per-kg rate with its paisa when it has any: ৳30, ৳30.50. */
export function rate(n: number | null | undefined, lang: Lang): string {
  if (n == null) return '—'
  return `৳${localDigits(Number.isInteger(n) ? String(n) : n.toFixed(2), lang)}`
}

/** A category's name in the reader's language, or its code. */
export function categoryName(categories: Category[] | undefined, code: string, lang: 'bn' | 'en') {
  const c = categories?.find((x) => x.code === code)
  return (lang === 'bn' ? c?.nameBn : c?.nameEn) ?? code
}
