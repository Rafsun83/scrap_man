import { WEIGHT_BAND_KG, type WeightBand } from '@bw/shared';

/**
 * Rough payout range for a request: the band's kg range times the average per-kg rate of the
 * chosen categories, rounded out to 10 taka. Null when no chosen category has a per-kg rate
 * (electronics only), because those are priced on inspection.
 */
export function estimatePayout(band: WeightBand, perKgRates: number[]): { min: number; max: number } | null {
  if (perKgRates.length === 0) return null;
  const avg = perKgRates.reduce((a, b) => a + b, 0) / perKgRates.length;
  const kg = WEIGHT_BAND_KG[band];
  return {
    min: Math.floor((kg.min * avg) / 10) * 10,
    max: Math.ceil((kg.max * avg) / 10) * 10,
  };
}
