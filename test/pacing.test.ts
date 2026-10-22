import { expect, it } from 'vitest';
import { automaticPace } from '../src/ui/pacing';

it('uses the chosen rate and holds pending responses at every speed', () => {
  for (const speed of [1, 5, 20, 80]) {
    expect(automaticPace(false, speed)).toBe(speed);
    expect(automaticPace(true, speed)).toBe(0);
  }
});
