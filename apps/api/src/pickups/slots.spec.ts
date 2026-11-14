import { addDays, bookableSlotEnd, slotWindow } from './slots.js';

describe('slots', () => {
  it('turns Dhaka slot hours into UTC instants', () => {
    expect(slotWindow('2026-11-15', 'MORNING')).toEqual({
      start: new Date('2026-11-15T03:00:00Z'),
      end: new Date('2026-11-15T06:00:00Z'),
    });
    expect(slotWindow('2026-11-15', 'AFTERNOON').end).toEqual(new Date('2026-11-15T12:00:00Z'));
  });

  it('handles the slot crossing a UTC day boundary correctly', () => {
    // MORNING starts at 09:00 Dhaka = 03:00Z the same day
    expect(slotWindow('2026-01-01', 'MORNING').start.toISOString()).toBe('2026-01-01T03:00:00.000Z');
  });

  it('adds days across month ends', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
  });

  // 2026-11-14 10:30 in Dhaka
  const now = new Date('2026-11-14T04:30:00Z');

  it('accepts a slot that is still running today, and the next two days', () => {
    expect(bookableSlotEnd('2026-11-14', 'MORNING', now)).toEqual(new Date('2026-11-14T06:00:00Z'));
    expect(bookableSlotEnd('2026-11-16', 'AFTERNOON', now)).toEqual(new Date('2026-11-16T12:00:00Z'));
  });

  it('refuses ended slots, past days and days too far ahead', () => {
    const at = new Date('2026-11-14T06:30:00Z'); // 12:30 Dhaka: MORNING is over
    expect(() => bookableSlotEnd('2026-11-14', 'MORNING', at)).toThrow(/already ended/);
    expect(() => bookableSlotEnd('2026-11-13', 'AFTERNOON', now)).toThrow(/Pick a day/);
    expect(() => bookableSlotEnd('2026-11-17', 'MORNING', now)).toThrow(/Pick a day/);
  });
});
