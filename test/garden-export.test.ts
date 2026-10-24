import { expect, it } from 'vitest';
import { advanceGarden, chooseGarden, freshGarden } from '../src/sim/garden.ts';
import { exportGarden, importGarden } from '../src/sim/garden-export.ts';

it('round-trips current pinned play and rejects altered choices and legacy runs', () => {
  const g = freshGarden(17);
  chooseGarden(g, { type: 'listen', person: 'riza', approach: 'invite' });
  advanceGarden(g, 375);
  const e = exportGarden(g);
  expect(importGarden(JSON.stringify(e))).toEqual(g);
  e.inputs[0]!.input = { type: 'silence' };
  expect(() => importGarden(JSON.stringify(e))).toThrow(/match/);
  expect(() => importGarden(JSON.stringify({ game: 'hearsay', version: 5 }))).toThrow(/Start fresh/);
});
it('replays an atomic admission header attached after preflight, including existing live files', async () => {
  const { hash } = await import('../src/sim/hash.ts');
  const g = freshGarden(17);
  // Startup preflights complete actors before the central CAS returns its header.
  g.chapter = { version: 'hearsay-batch/1', mapping: 'hearsay-calendar/1', inputs: [], claims: [] };
  advanceGarden(g, 376);
  const e = exportGarden(g);
  // The first public cast build used serialized property order for its change detector.
  e.fingerprint = hash(JSON.stringify(e.state)).toString(16);
  const restored = importGarden(JSON.stringify(e));
  expect(restored).toEqual(g);
  expect(exportGarden(restored).fingerprint).toBe(exportGarden(g).fingerprint);
});
