/** Current edition files replay the captured opening. Shelf state and wall time are never consulted. */
import { restore } from '@adam0white/human-framework';
import { canonicalPersona } from '@adam0white/lab-client';
import { type GardenRun, replayGarden } from './garden.ts';
import { GARDEN_CAST, GARDEN_EDITION, GARDEN_IDS } from './garden-cast.ts';
import { hash } from './hash.ts';
export interface GardenExport {
  game: 'hearsay';
  edition: typeof GARDEN_EDITION;
  seed: number;
  minute: number;
  initialPeople: GardenRun['initialPeople'];
  inputs: GardenRun['inputs'];
  state: GardenRun;
  fingerprint: string;
}
export function exportGarden(g: GardenRun): GardenExport {
  return {
    game: 'hearsay',
    edition: g.edition,
    seed: g.seed,
    minute: g.minute,
    initialPeople: structuredClone(g.initialPeople),
    inputs: structuredClone(g.inputs),
    state: structuredClone(g),
    fingerprint: hash(canonicalPersona(g)).toString(16),
  };
}
export function importGarden(text: string): GardenRun {
  if (text.length > 8 * 1024 * 1024) throw new Error('Run file exceeds 8 MiB.');
  const e = JSON.parse(text) as GardenExport;
  if (e?.game !== 'hearsay' || e.edition !== GARDEN_EDITION)
    throw new Error(
      'This is an older or unsupported Hearsay edition. Keep the file for inspection. Start fresh.',
    );
  if (
    !Number.isSafeInteger(e.seed) ||
    !Number.isSafeInteger(e.minute) ||
    e.minute < 360 ||
    e.minute > 14 * 1440 ||
    !Array.isArray(e.inputs) ||
    e.inputs.length > 20000 ||
    !e.initialPeople ||
    Object.keys(e.initialPeople).sort().join() !== [...GARDEN_IDS].sort().join()
  )
    throw new Error('Invalid pinned run.');
  for (const id of GARDEN_IDS) {
    const p = e.initialPeople[id];
    const c = GARDEN_CAST[id];
    restore(p);
    if (p.id !== id || p.name !== c.name || p.life.sex !== c.sex || p.now !== 360)
      throw new Error('Pinned person identity mismatch.');
  }
  let previous = 360;
  for (const row of e.inputs) {
    if (!row || !Number.isSafeInteger(row.at) || row.at < previous || row.at > e.minute)
      throw new Error('Invalid input clock.');
    previous = row.at;
  }
  const run = replayGarden(e.seed, e.inputs, e.minute, e.initialPeople, e.state.chapter);
  if (
    (hash(canonicalPersona(run)).toString(16) !== e.fingerprint &&
      hash(JSON.stringify(e.state)).toString(16) !== e.fingerprint) ||
    canonicalPersona(run) !== canonicalPersona(e.state)
  )
    throw new Error(
      'This file does not replay the same way in this version of Hearsay. It may come from an older version. The file was not loaded. Start fresh.',
    );
  return run;
}
