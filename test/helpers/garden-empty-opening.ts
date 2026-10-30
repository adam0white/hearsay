import { castForGame } from '@adam0white/lab-client';
import { freshGarden } from '../../src/sim/garden4.ts';
import { admitGardenBatch, eligibleGardenBatch } from '../../src/sim/garden4-continuity.ts';

/** A new run after the app's successful empty-shelf opening, before any gameplay.
 * There are no incoming claims or refusals. This never repairs a loaded old run. */
export function freshEmptyShelfGarden(seed: number) {
  const eligible = eligibleGardenBatch({
    expectedHeads: Object.fromEntries(castForGame('hearsay').map(({ castId }) => [castId, null])),
    inputs: [],
    blocked: [],
  });
  return freshGarden(seed, admitGardenBatch(eligible), {
    version: 'hearsay-hf4-batch/1',
    claims: [],
    skipped: eligible.skipped,
  });
}
