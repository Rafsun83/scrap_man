import { describe, expect, it } from 'vitest'
import { dhakaDate, formatDate, formatLongDate, formatPhone, formatTime, formatWhen, initials, normalizePhone, rate, sinceParts } from './format'

describe('admin formatting (Dhaka time, both languages)', () => {
  // 01:09 on 17 Nov in Dhaka is 19:09 on 16 Nov UTC.
  const at = '2026-11-16T19:09:00Z'

  it('formats times in Dhaka, with Bangla words and digits', () => {
    expect(formatTime(at, 'en')).toBe('1:09 am')
    expect(formatTime(at, 'bn')).toBe('রাত ১:০৯')
    expect(formatTime('2026-11-17T04:05:00Z', 'bn')).toBe('সকাল ১০:০৫')
    expect(formatTime('2026-11-17T10:30:00Z', 'en')).toBe('4:30 pm')
  })

  it('formats dates on the Dhaka calendar', () => {
    expect(formatDate(at, 'en')).toBe('17 Nov 2026')
    expect(formatDate('2026-11-17', 'bn')).toBe('১৭ নভেম্বর ২০২৬')
    expect(formatLongDate('2026-11-17', 'en')).toBe('Tuesday, 17 November 2026')
    expect(formatLongDate('2026-11-17', 'bn')).toBe('মঙ্গলবার, ১৭ নভেম্বর ২০২৬')
    expect(dhakaDate(new Date(at))).toBe('2026-11-17')
  })

  it('shows only the time for today', () => {
    const now = new Date('2026-11-17T02:00:00Z')
    expect(formatWhen(at, 'en', now)).toBe('1:09 am')
    expect(formatWhen('2026-11-15T10:00:00Z', 'en', now)).toBe('15 Nov 2026, 4:00 pm')
  })

  it('handles phones, rates and durations', () => {
    expect(normalizePhone('০১৭০০০০০০০০')).toBe('+8801700000000')
    expect(normalizePhone('12345')).toBeNull()
    expect(formatPhone('+8801712345456', 'bn')).toBe('০১৭১২-৩৪৫৪৫৬')
    expect(rate(30.5, 'en')).toBe('৳30.50')
    expect(rate(50, 'bn')).toBe('৳৫০')
    expect(sinceParts('2026-11-17T00:00:00Z', new Date('2026-11-17T02:05:00Z'))).toEqual({ minutes: 125, h: 2, m: 5 })
  })

  it('makes avatar initials from a name, or the phone when there is none', () => {
    expect(initials('Farhana Rahman')).toBe('FR')
    expect(initials('Md Abdul Karim')).toBe('MK')
    expect(initials('rubel')).toBe('RU')
    expect(initials(null, '+8801700000042')).toBe('42')
  })
})
