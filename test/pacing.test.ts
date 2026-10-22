import { expect, it } from 'vitest';
import { automaticPace } from '../src/ui/pacing';

it('uses the chosen rate and holds pending responses at every speed', () => {
  for (const speed of [1, 5, 20]) {
    expect(automaticPace(false, speed)).toBe(speed);
    expect(automaticPace(true, speed)).toBe(0);
  }
});

it('skips at eighty minutes per second until a pending response holds time', () => {
  expect(automaticPace(false, 5, true)).toBe(80);
  expect(automaticPace(true, 5, true)).toBe(0);
});
