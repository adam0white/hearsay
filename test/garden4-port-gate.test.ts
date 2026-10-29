import { portableWriteBlockers } from '@adam0white/lab-client';
import { expect, it } from 'vitest';
import { eligibleGardenBatch } from '../src/sim/garden4-continuity.ts';

it('skips only people whose portable writes are blocked', () => {
  const castId = 'hf.cast.riza.voice';
  expect(portableWriteBlockers(castId, 'hearsay').length).toBeGreaterThan(0);
  const batch = {
    expectedHeads: { [castId]: 'rev', local: null },
    inputs: [{ parent: { castId, transfer: { castPassport: 'hf-portable-person/2' } }, life: {} }],
    blocked: [],
  } as never;
  const eligible = eligibleGardenBatch(batch);
  expect(eligible.inputs).toEqual([]);
  expect(eligible.expectedHeads).toEqual({ local: null });
});
