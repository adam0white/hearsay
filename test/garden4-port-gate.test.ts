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
  expect(eligible.expectedHeads).toEqual({ [castId]: 'rev', local: null });
  expect(eligible.skipped.map((entry) => entry.castId)).toEqual([castId]);
});

it('retains only refusal metadata through useful play and replay and prevents source capture', async () => {
  const { freshGarden, chooseGarden, advanceGarden } = await import('../src/sim/garden4.ts');
  const { exportGarden, importGarden } = await import('../src/sim/garden4-export.ts');
  const { captureGardenSource, requireGardenWrite } = await import('../src/sim/garden4-continuity.ts');
  const castId = 'hf.cast.hatice.hearsay';
  const garden = freshGarden(17, undefined, {
    version: 'hearsay-hf4-batch/1',
    claims: [],
    skipped: [{ castId, reason: 'Their saved history cannot continue here.', revision: 'a'.repeat(64) }],
  });
  expect(chooseGarden(garden, { type: 'silence' })).toBe(true);
  advanceGarden(garden, 365);
  const restored = importGarden(JSON.stringify(exportGarden(garden)));
  expect(exportGarden(restored)).toEqual(exportGarden(garden));
  expect(restored.chapter?.skipped).toEqual(garden.chapter?.skipped);
  expect(restored.chapter?.claims).toEqual([]);
  expect(() => requireGardenWrite(restored, castId)).toThrow('skipped');
  expect(() => captureGardenSource(restored, 'hatice')).toThrow('skipped');
  restored.people.hatice.body.alive = false;
  expect(() => requireGardenWrite(restored, castId)).toThrow('skipped');
  expect(() => requireGardenWrite(restored, 'hf.cast.riza.voice')).not.toThrow();
});
