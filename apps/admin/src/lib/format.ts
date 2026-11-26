import {
  dhakaToday,
  formatDhakaDate,
  formatDhakaLongDate,
  formatDhakaTime,
  formatKg,
  formatTaka,
  localDigits,
  WORK_AREAS,
  type Category,
  type Lang,
} from '@bw/shared'

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

/** "11 Nov 2026" / "১১ নভেম্বর ২০২৬" in Dhaka time (calendar from @bw/shared). */
export function formatDate(value: string | Date, lang: Lang): string {
  return formatDhakaDate(value, lang, { year: true, shortMonth: lang === 'en' })
}

/** "Wednesday, 11 November 2026" / "বুধবার, ১১ নভেম্বর ২০২৬". */
export function formatLongDate(value: string | Date, lang: Lang): string {
  return formatDhakaLongDate(value, lang, { year: true })
}

/** "10:05 am" / "সকাল ১০:০৫" in Dhaka time. */
export function formatTime(value: string | Date, lang: Lang): string {
  return formatDhakaTime(value, lang)
}

/** Time today, or date and time for other days. */
export function formatWhen(value: string, lang: Lang, now: Date = new Date()): string {
  return dhakaDate(new Date(value)) === dhakaDate(now) ? formatTime(value, lang) : `${formatDate(value, lang)}, ${formatTime(value, lang)}`
}

/** YYYY-MM-DD in Dhaka. */
export function dhakaDate(at: Date = new Date()): string {
  return dhakaToday(at)
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

/** Two initials for an avatar tile ("Farhana Rahman" → "FR"); falls back to the last two phone digits. */
export function initials(name: string | null | undefined, phone?: string | null): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase()
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (phone ?? '').slice(-2)
}
