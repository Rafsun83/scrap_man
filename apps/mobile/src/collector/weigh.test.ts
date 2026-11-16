import { categories } from '../test/render';
import { initialLines, parseKg, parseTaka, previewTotals, rateLookup, stepKg, toWeightLines } from './weigh';

describe('weigh maths', () => {
  it('steps by 0.5 kg, keeps 0.1 kg, never below zero', () => {
    expect(stepKg(0, 1)).toBe(0.5);
    expect(stepKg(9.3, 1)).toBe(9.8);
    expect(stepKg(0.3, -1)).toBe(0);
    expect(stepKg(0.1 + 0.2, 1)).toBe(0.8);
  });

  it('reads typed weights in Bangla or ASCII digits, to 0.1 kg', () => {
    expect(parseKg('৯.৫')).toBe(9.5);
    expect(parseKg('12,5')).toBe(12.5);
    expect(parseKg('7')).toBe(7);
    expect(parseKg('2.25')).toBeNull();
    expect(parseKg('abc')).toBeNull();
    expect(parseKg('10000')).toBeNull();
    expect(parseTaka('২৫০')).toBe(250);
    expect(parseTaka('99.999')).toBeNull();
  });

  it('prefers the rate locked at accept, then today\'s rate for items found at the door', () => {
    const rateOf = rateLookup([{ categoryCode: 'IRON', rate: 50 }], [
      { categoryCode: 'IRON', ratePerKg: 99 },
      { categoryCode: 'CARTON', ratePerKg: 18 },
    ]);
    expect(rateOf('IRON')).toBe(50);
    expect(rateOf('CARTON')).toBe(18);
    expect(rateOf('GOLD')).toBeNull();
  });

  it('previews totals rounded like the server', () => {
    const rateOf = rateLookup([{ categoryCode: 'IRON', rate: 50 }, { categoryCode: 'NEWSPAPER', rate: 30.33 }], []);
    const lines = [
      { categoryCode: 'IRON', kg: 9.5, quoted: '' },
      { categoryCode: 'NEWSPAPER', kg: 0.3, quoted: '' },
      { categoryCode: 'ELECTRONICS', kg: 3, quoted: '২৫০' },
    ];
    const p = previewTotals(lines, categories, rateOf);
    expect(p.amounts).toEqual([475, 9.1, 250]);
    expect(p.totalKg).toBe(12.8);
    expect(p.totalAmount).toBe(734.1);
  });

  it('builds the API lines, skipping zero weights and requiring a quote for inspection items', () => {
    const lines = [
      { categoryCode: 'IRON', kg: 9.5, quoted: '' },
      { categoryCode: 'NEWSPAPER', kg: 0, quoted: '' },
      { categoryCode: 'ELECTRONICS', kg: 3, quoted: '' },
    ];
    expect(toWeightLines(lines, categories)).toBeNull();
    lines[2].quoted = '250';
    expect(toWeightLines(lines, categories)).toEqual([
      { categoryCode: 'IRON', kg: 9.5 },
      { categoryCode: 'ELECTRONICS', kg: 3, quotedAmount: 250 },
    ]);
    expect(toWeightLines([{ categoryCode: 'IRON', kg: 0, quoted: '' }], categories)).toBeNull();
  });

  it('starts from the request items, with the previous weights on a re-weigh', () => {
    expect(initialLines({ categoryCodes: ['IRON', 'NEWSPAPER'], lines: [] })).toEqual([
      { categoryCode: 'IRON', kg: 0, quoted: '' },
      { categoryCode: 'NEWSPAPER', kg: 0, quoted: '' },
    ]);
    expect(
      initialLines({
        categoryCodes: ['IRON'],
        lines: [
          { categoryCode: 'IRON', kg: 9.5, rate: 50, amount: 475 },
          { categoryCode: 'ELECTRONICS', kg: 3, rate: null, amount: 250 },
        ],
      }),
    ).toEqual([
      { categoryCode: 'IRON', kg: 9.5, quoted: '' },
      { categoryCode: 'ELECTRONICS', kg: 3, quoted: '250' },
    ]);
  });
});
