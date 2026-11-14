/**
 * Money and weight arithmetic in whole units: paisa (1/100 taka) and tenths of a kg,
 * so totals never pick up floating-point errors.
 */
export const toPaisa = (taka: number | string): number => Math.round(Number(taka) * 100);
export const toTenths = (kg: number | string): number => Math.round(Number(kg) * 10);

/** kg x rate, rounded half up to the paisa. */
export function lineAmountPaisa(kg: number | string, ratePerKg: number | string): number {
  return Math.round((toTenths(kg) * toPaisa(ratePerKg)) / 10);
}

/** For numeric(12,2) columns. */
export const paisaToDb = (paisa: number): string => (paisa / 100).toFixed(2);
/** For numeric(8,1) columns. */
export const tenthsToDb = (tenths: number): string => (tenths / 10).toFixed(1);

/** Numbers in API responses; numeric columns arrive from Postgres as strings. */
export const num = (v: string | number | null | undefined): number | null =>
  v === null || v === undefined ? null : Number(v);

/** True when the number has at most `places` decimals (e.g. kg to 0.1, taka to 0.01). */
export function hasAtMostDecimals(n: number, places: number): boolean {
  const scaled = n * 10 ** places;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
}
