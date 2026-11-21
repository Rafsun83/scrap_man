import type { NearbyCollectorDto } from '../dtos/nearby-collectors.dto.js';

const DISTANCE_STEP_M = 100;
const BEARING_STEP_DEG = 30;
/** Dots shown on the household's radar at most; `count` still has everyone. */
export const RADAR_MAX_DOTS = 30;

/**
 * Blurs one collector's position so a household cannot pinpoint them before accept: distance to the nearest
 * 100 m (at least 100, never past the radius) and direction to the nearest 30 degrees.
 */
function blur(distanceM: number, bearingDeg: number, radiusM: number): NearbyCollectorDto {
  const distance = Math.min(Math.max(Math.round(distanceM / DISTANCE_STEP_M) * DISTANCE_STEP_M, DISTANCE_STEP_M), radiusM);
  const bearing = ((Math.round(bearingDeg / BEARING_STEP_DEG) * BEARING_STEP_DEG) % 360 + 360) % 360;
  return { distanceM: distance, bearingDeg: bearing };
}

export const radarUtil = { blur } as const;
