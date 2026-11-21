import type { NearbyCollector } from '../../api/types';

/** Radar geometry in px: 260 square, home badge 50 across in the middle, collector dots 30 across. */
export const RADAR = { size: 260, home: 50, dot: 30 } as const;

const CENTER = RADAR.size / 2;
/** Dot centres stay clear of the home badge and inside the outer ring. */
const INNER = RADAR.home / 2 + RADAR.dot / 2 + 4;
const OUTER = CENTER - RADAR.dot / 2;
/** Collectors in the same blurred spot are fanned out by this many degrees so every dot shows. */
const FAN_DEG = 12;

/**
 * Top-left positions for the collector dots: distance from the address maps onto the space between the home
 * badge and the outer ring, direction 0 = up (north), clockwise.
 */
export function radarDots(collectors: NearbyCollector[], radiusM: number): { left: number; top: number }[] {
  const seen = new Map<string, number>();
  return collectors.map((c) => {
    const spot = `${c.distanceM}:${c.bearingDeg}`;
    const n = seen.get(spot) ?? 0;
    seen.set(spot, n + 1);
    // 0, +12, -12, +24, -24 ... degrees around the shared spot
    const fan = n === 0 ? 0 : Math.ceil(n / 2) * FAN_DEG * (n % 2 === 1 ? 1 : -1);
    const r = INNER + Math.min(Math.max(c.distanceM / Math.max(radiusM, 1), 0), 1) * (OUTER - INNER);
    const a = ((c.bearingDeg + fan) * Math.PI) / 180;
    return {
      left: Math.round(CENTER + r * Math.sin(a) - RADAR.dot / 2),
      top: Math.round(CENTER - r * Math.cos(a) - RADAR.dot / 2),
    };
  });
}
