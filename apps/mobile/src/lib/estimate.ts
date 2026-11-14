import { WEIGHT_BAND_KG, type WeightBand } from '@bw/shared';

/**
 * Preview of the payout range on the schedule screen, before the request exists. It mirrors the API's
 * estimatePayout (apps/api/src/pickups/estimate.ts): the band's kg range times the average per-kg rate
 * of the chosen categories, rounded out to 10 taka. Once the pickup is created the server's `estimate`
 * is what the app shows.
 */
export function previewEstimate(band: WeightBand, perKgRates: number[]): { min: number; max: number } | null {
  if (perKgRates.length === 0) return null;
  const avg = perKgRates.reduce((a, b) => a + b, 0) / perKgRates.length;
  const kg = WEIGHT_BAND_KG[band];
  return {
    min: Math.floor((kg.min * avg) / 10) * 10,
    max: Math.ceil((kg.max * avg) / 10) * 10,
  };
}
