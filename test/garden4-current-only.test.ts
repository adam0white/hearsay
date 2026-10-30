import { expect, it } from 'vitest';
import { advanceGarden, freshGarden, replayGarden } from '../src/sim/garden4.ts';
import { exportGarden, importGarden } from '../src/sim/garden4-export.ts';

it('starts with the current conversation and refuses unmarked history', () => {
  const garden = freshGarden(17);
  const old = exportGarden(garden);
  delete old.config;
  delete old.state.config;
  expect(() => importGarden(JSON.stringify(old))).toThrow(/Keep the file.*Start fresh/);
  expect(() => replayGarden(old.seed, old.inputs, old.minute, old.initialPeople, old.state.chapter)).toThrow(
    /Start fresh/,
  );
  expect(garden.config).toEqual({ dialogue: 'garden-talk/1' });
  old.config = { dialogue: 'garden-talk/old' } as unknown as typeof garden.config;
  expect(() => importGarden(JSON.stringify(old))).toThrow(/Keep the file.*Start fresh/);
});

it('replays and continues a current full file exactly', () => {
  const garden = freshGarden(17);
  advanceGarden(garden, 365);
  const restored = importGarden(JSON.stringify(exportGarden(garden)));
  advanceGarden(garden, 370);
  advanceGarden(restored, 370);
  expect(exportGarden(restored)).toEqual(exportGarden(garden));
});
