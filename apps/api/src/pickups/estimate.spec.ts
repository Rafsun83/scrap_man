import { estimatePayout } from './estimate.js';

describe('estimatePayout', () => {
  it('uses the band range and the average rate', () => {
    // Prototype sample: iron 50, newspaper 30, plastic 35 for 5-15 kg
    expect(estimatePayout('FROM_5_TO_15', [50, 30, 35])).toEqual({ min: 190, max: 580 });
    expect(estimatePayout('UNDER_5', [50])).toEqual({ min: 100, max: 250 });
  });

  it('has no estimate for electronics only', () => {
    expect(estimatePayout('UNSURE', [])).toBeNull();
  });
});
