import { distanceM, etaMinutes, formatPhone, initials, insideBangladesh, localPhone, normalizePhone } from './format';
import { previewEstimate } from './estimate';

describe('phone numbers', () => {
  it.each([
    ['01712345456', '+8801712345456'],
    ['1712345456', '+8801712345456'],
    ['+880 1712-345456', '+8801712345456'],
    ['8801712345456', '+8801712345456'],
    ['০১৭১২৩৪৫৪৫৬', '+8801712345456'],
  ])('reads %s', (input, phone) => {
    expect(normalizePhone(input)).toBe(phone);
  });

  it.each(['', '0171234545', '01212345456', '017123454567'])('refuses %s', (input) => {
    expect(normalizePhone(input)).toBeNull();
  });

  it('formats for display', () => {
    expect(formatPhone('+8801712345456', 'bn')).toBe('+৮৮০ ১৭১২-৩৪৫৪৫৬');
    expect(localPhone('+8801712345456', 'en')).toBe('01712345456');
  });
});

describe('estimate preview', () => {
  it('matches the API for the same inputs (apps/api/src/pickups/estimate.spec.ts)', () => {
    expect(previewEstimate('FROM_5_TO_15', [50, 30, 35])).toEqual({ min: 190, max: 580 });
    expect(previewEstimate('UNDER_5', [50])).toEqual({ min: 100, max: 250 });
    expect(previewEstimate('UNSURE', [])).toBeNull();
  });
});

describe('distance and arrival', () => {
  it('measures about 1.9 km between Mirpur 10 and Mirpur 1', () => {
    const m = distanceM({ lat: 23.8069, lng: 90.3687 }, { lat: 23.7957, lng: 90.3537 });
    expect(m).toBeGreaterThan(1800);
    expect(m).toBeLessThan(2000);
  });

  it('never promises less than 2 minutes', () => {
    expect(etaMinutes(10)).toBe(2);
    expect(etaMinutes(1000)).toBe(8);
  });
});

it('makes initials from Bangla and English names', () => {
  expect(initials('রাশেদা বেগম')).toBe('রব');
  expect(initials('Jasim Uddin Khan')).toBe('JU');
  expect(initials(null)).toBe('?');
});

it('accepts only points inside Bangladesh', () => {
  expect(insideBangladesh({ lat: 23.8, lng: 90.4 })).toBe(true);
  expect(insideBangladesh({ lat: 90.4, lng: 23.8 })).toBe(false);
});
