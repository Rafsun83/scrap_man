import { describe, expect, it } from 'vitest';
import { WORK_AREA_CODES, WORK_AREAS } from './enums.js';

describe('work areas', () => {
  it('have unique codes and both names', () => {
    expect(new Set(WORK_AREA_CODES).size).toBe(WORK_AREAS.length);
    for (const area of WORK_AREAS) {
      expect(area.bn.trim()).not.toBe('');
      expect(area.en.trim()).not.toBe('');
    }
  });
});
