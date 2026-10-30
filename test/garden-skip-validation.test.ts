import { canonicalPersona } from '@adam0white/lab-client';
import { expect, it } from 'vitest';
import { freshGarden } from '../src/sim/garden4.ts';
import { exportGarden, importGarden } from '../src/sim/garden4-export.ts';
import { hash } from '../src/sim/hash.ts';

it('refuses malformed metadata even with a recomputed complete fingerprint', () => {
  const packet = exportGarden(
    freshGarden(17, undefined, {
      version: 'hearsay-hf4-batch/1',
      claims: [],
      skipped: [],
    }),
  );
  const original = JSON.stringify(packet);
  for (const skipped of [{}, [null], [{ castId: 'unknown', reason: 'test' }]]) {
    const candidate = structuredClone(packet);
    candidate.state.chapter!.skipped = skipped as never;
    candidate.fingerprint = hash(canonicalPersona(candidate.state)).toString(16);
    expect(() => importGarden(JSON.stringify(candidate))).toThrow(/Keep the original.*Start fresh/);
    expect(JSON.stringify(packet)).toBe(original);
  }
  expect(exportGarden(importGarden(original))).toEqual(packet);
});

it('does not grant outgoing authority to a compatible file without skip metadata', async () => {
  const { requireGardenWrite } = await import('../src/sim/garden4-continuity.ts');
  const original = exportGarden(freshGarden(17));
  const restored = importGarden(JSON.stringify(original));
  expect(exportGarden(restored)).toEqual(original);
  expect(() => requireGardenWrite(restored, 'hf.cast.hatice.hearsay')).toThrow(/no saved skip record/);
});
