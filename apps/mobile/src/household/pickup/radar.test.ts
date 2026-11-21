import { RADAR, radarDots } from './radar';

const centre = (d: { left: number; top: number }) => ({ x: d.left + RADAR.dot / 2, y: d.top + RADAR.dot / 2 });

describe('radar dots', () => {
  it('puts north up and east right, nearer collectors closer to the home', () => {
    const [n, e, far] = radarDots(
      [
        { distanceM: 200, bearingDeg: 0 },
        { distanceM: 200, bearingDeg: 90 },
        { distanceM: 1000, bearingDeg: 180 },
      ],
      1000,
    );
    expect(centre(n).x).toBe(130);
    expect(centre(n).y).toBeLessThan(130);
    expect(centre(e).y).toBe(130);
    expect(centre(e).x).toBeGreaterThan(130);
    // the farthest sits on the outer ring, fully inside the radar
    expect(far.top + RADAR.dot).toBe(RADAR.size);
    expect(130 - centre(n).y).toBeLessThan(centre(far).y - 130);
  });

  it('never covers the home badge', () => {
    const [d] = radarDots([{ distanceM: 100, bearingDeg: 0 }], 3000);
    expect(130 - centre(d).y).toBeGreaterThanOrEqual(RADAR.home / 2 + RADAR.dot / 2);
  });

  it('fans out collectors in the same spot', () => {
    const dots = radarDots(
      [
        { distanceM: 500, bearingDeg: 30 },
        { distanceM: 500, bearingDeg: 30 },
        { distanceM: 500, bearingDeg: 30 },
      ],
      1000,
    );
    expect(new Set(dots.map((d) => `${d.left},${d.top}`)).size).toBe(3);
  });
});
