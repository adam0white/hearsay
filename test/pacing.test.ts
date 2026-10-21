import { expect, it } from 'vitest';
import { automaticPace } from '../src/ui/pacing';

it('moves empty stretches briskly, slows for company and holds pending responses', () => {
  expect(automaticPace(false, false)).toBe(20);
  expect(automaticPace(false, true)).toBe(5);
  expect(automaticPace(true, true)).toBe(0);
  expect(automaticPace(true, false)).toBe(0);
});
