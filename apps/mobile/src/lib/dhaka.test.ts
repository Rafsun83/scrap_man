import { addDays, bookableDays, dhakaToday, firstOpenSlot, formatDate, formatShortDay, formatTime, greetingKey, relativeDay, slotEnd } from './dhaka';

// 2026-11-14 10:30 in Dhaka is 04:30Z.
const at = (iso: string) => new Date(iso);

describe('Dhaka dates', () => {
  it('uses the Dhaka day, not UTC', () => {
    expect(dhakaToday(at('2026-11-14T17:59:00Z'))).toBe('2026-11-14');
    expect(dhakaToday(at('2026-11-14T18:00:00Z'))).toBe('2026-11-15'); // midnight in Dhaka
  });

  it('adds days across months', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
  });

  it('ends slots at the same instants as the API', () => {
    expect(slotEnd('2026-11-15', 'MORNING').toISOString()).toBe('2026-11-15T06:00:00.000Z');
    expect(slotEnd('2026-11-15', 'AFTERNOON').toISOString()).toBe('2026-11-15T12:00:00.000Z');
  });
});

describe('bookable slots', () => {
  it('offers today and the next two days', () => {
    const days = bookableDays(at('2026-11-14T04:30:00Z'));
    expect(days.map((d) => d.date)).toEqual(['2026-11-14', '2026-11-15', '2026-11-16']);
  });

  it('keeps a slot open until it ends, then closes it', () => {
    const before = bookableDays(at('2026-11-14T05:59:00Z'))[0]; // 11:59 Dhaka
    expect(before.slots.map((s) => s.open)).toEqual([true, true, true]);
    const after = bookableDays(at('2026-11-14T06:00:00Z'))[0]; // 12:00 Dhaka
    expect(after.slots.map((s) => s.open)).toEqual([false, true, true]);
  });

  it('defaults to tomorrow morning once today is over', () => {
    const days = bookableDays(at('2026-11-14T12:30:00Z')); // 18:30 Dhaka
    expect(days[0].slots.every((s) => !s.open)).toBe(true);
    expect(firstOpenSlot(days)).toEqual({ date: '2026-11-15', slot: 'MORNING' });
  });
});

describe('display', () => {
  it('formats dates in Bangla and English', () => {
    expect(formatDate('2026-11-11', 'bn')).toBe('১১ নভেম্বর');
    expect(formatDate('2026-11-11', 'en')).toBe('11 November');
    expect(formatShortDay('2026-11-11', 'bn')).toBe('বুধ, ১১ নভে.');
    expect(formatShortDay('2026-11-12', 'en')).toBe('Thu, 12 Nov');
  });

  it('formats times as people say them in Dhaka', () => {
    expect(formatTime('2026-11-11T04:20:00Z', 'bn')).toBe('সকাল ১০:২০');
    expect(formatTime('2026-11-11T10:05:00Z', 'bn')).toBe('বিকেল ৪:০৫');
    expect(formatTime('2026-11-11T10:05:00Z', 'en')).toBe('4:05 pm');
  });

  it('names today and tomorrow, otherwise the weekday', () => {
    const now = at('2026-11-14T04:30:00Z');
    expect(relativeDay('2026-11-14', 'bn', now)).toBe('today');
    expect(relativeDay('2026-11-15', 'bn', now)).toBe('tomorrow');
    expect(relativeDay('2026-11-16', 'bn', now)).toBe('সোমবার');
  });

  it('greets by Dhaka hour', () => {
    expect(greetingKey(at('2026-11-14T03:00:00Z'))).toBe('greetMorning');
    expect(greetingKey(at('2026-11-14T10:00:00Z'))).toBe('greetAfternoon');
  });
});
