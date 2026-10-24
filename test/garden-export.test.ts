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
