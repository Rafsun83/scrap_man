import { moneyUtil } from './money.util.js';

const { hasAtMostDecimals, lineAmountPaisa, paisaToDb, tenthsToDb, toPaisa, toTenths } = moneyUtil;

describe('money', () => {
  it('multiplies kg by rate without floating-point drift', () => {
    expect(lineAmountPaisa(9.5, 50)).toBe(47_500);
    expect(lineAmountPaisa('0.1', '0.07')).toBe(1); // 0.007 taka rounds up to 1 paisa
    expect(lineAmountPaisa(3.3, 33.33)).toBe(10_999); // 109.989 -> 109.99
    expect(lineAmountPaisa(1.1, 160)).toBe(17_600);
  });

  it('converts to the database formats', () => {
    expect(paisaToDb(62_500)).toBe('625.00');
    expect(tenthsToDb(145)).toBe('14.5');
    expect(toPaisa('18.10')).toBe(1810);
    expect(toTenths(0.3)).toBe(3);
  });

  it('checks decimal places', () => {
    expect(hasAtMostDecimals(9.5, 1)).toBe(true);
    expect(hasAtMostDecimals(9.55, 1)).toBe(false);
    expect(hasAtMostDecimals(0.3, 1)).toBe(true);
    expect(hasAtMostDecimals(12.34, 2)).toBe(true);
  });
});
