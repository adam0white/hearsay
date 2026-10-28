/** Current edition files replay the captured opening. Shelf state and wall time are never consulted. */
import { restore } from '@adam0white/hf-legacy';
import { canonicalPersona } from '@adam0white/lab-client';
import { type GardenRun, replayGarden } from './garden.ts';
import { GARDEN_CAST, GARDEN_EDITION, GARDEN_IDS } from './garden-cast.ts';
import type { GardenChapter } from './garden-continuity.ts';
import type { GardenConfig } from './garden-dialogue.ts';
import { hash } from './hash.ts';
export interface GardenExport {
  game: 'hearsay';
  edition: typeof GARDEN_EDITION;
  seed: number;
  config?: GardenConfig;
  minute: number;
  initialPeople: GardenRun['initialPeople'];
  inputs: GardenRun['inputs'];
  state: GardenRun;
  fingerprint: string;
}
export type GardenCompactExport = Omit<GardenExport, 'state'> & {
  compact: true;
  chapter?: GardenChapter;
};
export function exportGarden(g: GardenRun): GardenExport;
export function exportGarden(g: GardenRun, compact: true): GardenCompactExport;
export function exportGarden(g: GardenRun, compact = false): GardenExport | GardenCompactExport {
  return {
    game: 'hearsay',
    edition: g.edition,
    seed: g.seed,
    ...(g.config ? { config: structuredClone(g.config) } : {}),
    minute: g.minute,
    initialPeople: structuredClone(g.initialPeople),
    inputs: structuredClone(g.inputs),
    ...(compact
      ? { compact: true as const, ...(g.chapter ? { chapter: structuredClone(g.chapter) } : {}) }
      : { state: structuredClone(g) }),
    fingerprint: hash(canonicalPersona(g)).toString(16),
  };
}
export function importGarden(text: string): GardenRun {
  if (text.length > 8 * 1024 * 1024) throw new Error('Run file exceeds 8 MiB.');
  const e = JSON.parse(text) as Partial<GardenExport & GardenCompactExport>;
  if (e?.game !== 'hearsay' || e.edition !== GARDEN_EDITION)
    throw new Error(
      'This is an older or unsupported Hearsay edition. Keep the file for inspection. Start fresh.',
    );
  const seed = e.seed,
    minute = e.minute;
  if (
    typeof seed !== 'number' ||
    !Number.isSafeInteger(seed) ||
    typeof minute !== 'number' ||
    !Number.isSafeInteger(minute) ||
    minute < 360 ||
    minute > 14 * 1440 ||
    !Array.isArray(e.inputs) ||
    e.inputs.length > 20000 ||
    (!e.state && e.compact !== true) ||
    (e.compact === true && e.state !== undefined) ||
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
    if (!row || !Number.isSafeInteger(row.at) || row.at < previous || row.at > minute)
      throw new Error('Invalid input clock.');
    previous = row.at;
  }
  const run = replayGarden(seed, e.inputs, minute, e.initialPeople, e.state?.chapter ?? e.chapter, e.config);
  if (
    (hash(canonicalPersona(run)).toString(16) !== e.fingerprint &&
      (!e.state || hash(JSON.stringify(e.state)).toString(16) !== e.fingerprint)) ||
    (e.state !== undefined && canonicalPersona(run) !== canonicalPersona(e.state))
  )
    throw new Error(
      'This file does not replay the same way in this version of Hearsay. It may come from an older version. The file was not loaded. Start fresh.',
    );
  return run;
}
