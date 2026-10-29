import { expect, it } from 'vitest';
import { gardenPace } from '../src/ui/garden-ui-pace.ts';

it('slows automatic or chosen running pace for reading, then restores it without pausing', () => {
  expect(gardenPace(null, false)).toBe(4);
  expect(gardenPace(null, true)).toBe(1);
  expect(gardenPace(12, true)).toBe(1);
  expect(gardenPace(12, false)).toBe(12);
  expect(gardenPace(0, true)).toBe(0);
});
