import { radarUtil } from './radar.util.js';

describe('radarUtil.blur', () => {
  it('rounds distance to 100 m and direction to 30 degrees', () => {
    expect(radarUtil.blur(437, 47, 1000)).toEqual({ distanceM: 400, bearingDeg: 60 });
    expect(radarUtil.blur(451, 44, 1000)).toEqual({ distanceM: 500, bearingDeg: 30 });
  });

  it('never shows a collector on the address or past the radius', () => {
    expect(radarUtil.blur(12, 0, 1000).distanceM).toBe(100);
    expect(radarUtil.blur(990, 0, 1000).distanceM).toBe(1000);
    expect(radarUtil.blur(2990, 0, 3000).distanceM).toBe(3000);
    expect(radarUtil.blur(1000, 0, 1000).distanceM).toBe(1000);
  });

  it('wraps direction into 0..330', () => {
    expect(radarUtil.blur(300, 355, 1000).bearingDeg).toBe(0);
    expect(radarUtil.blur(300, 344, 1000).bearingDeg).toBe(330);
  });
});
