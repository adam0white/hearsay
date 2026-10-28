/** A current export retains the complete HF archive and the ordered garden inputs. */
import { canonicalPersona } from '@adam0white/lab-client';
import { checkpointGarden, GARDEN_EDITION, type GardenRun, gardenAuthors, replayGarden } from './garden4.ts';
import { hash } from './hash.ts';
export interface GardenExport {
  game: 'hearsay';
  edition: typeof GARDEN_EDITION;
  seed: number;
  minute: number;
  initialPeople: GardenRun['initialPeople'];
  inputs: GardenRun['inputs'];
  config?: GardenRun['config'];
  state: GardenRun;
  fingerprint: string;
}
export type GardenCompactExport = GardenExport;
export function exportGarden(g: GardenRun, _compact = false): GardenExport {
  const state = structuredClone({ ...g, engine: checkpointGarden(g) });
  return {
    game: 'hearsay',
    edition: GARDEN_EDITION,
    seed: g.seed,
    minute: g.minute,
    initialPeople: structuredClone(g.initialPeople),
    inputs: structuredClone(g.inputs),
    ...(g.config ? { config: structuredClone(g.config) } : {}),
    state,
    fingerprint: hash(canonicalPersona(state)).toString(16),
  };
}
export function importGarden(text: string): GardenRun {
  if (text.length > 64 * 1024 * 1024) throw Error('This run exceeds the 64 MiB limit. Keep the file.');
  const e = JSON.parse(text) as GardenExport;
  if (e?.game !== 'hearsay' || e.edition !== GARDEN_EDITION)
    throw Error('This is an older or unsupported Hearsay edition. Keep the file. Start fresh.');
  if (
    !Number.isSafeInteger(e.seed) ||
    !Number.isSafeInteger(e.minute) ||
    e.minute < 360 ||
    e.minute > 14 * 1440 ||
    !Array.isArray(e.inputs) ||
    e.inputs.length > 20000 ||
    !Array.isArray(e.initialPeople) ||
    !e.state?.engine
  )
    throw Error('Invalid pinned garden run.');
  if (
    e.initialPeople
      .map((p) => p.id)
      .sort()
      .join() !==
    gardenAuthors()
      .map((p) => p.id)
      .sort()
      .join()
  )
    throw Error('The garden cast is incompatible. Keep the file. Start fresh.');
  let previous = 360;
  for (const row of e.inputs) {
    if (!row || !Number.isSafeInteger(row.at) || row.at < previous || row.at > e.minute)
      throw Error('Invalid input clock.');
    previous = row.at;
  }
  // Rebuild through the public Run API once. The complete state comparison below
  // includes every HF archive and host-checkpoint field, so a separate restoration
  // would reconstruct the same journal again without adding validation.
  const g = replayGarden(e.seed, e.inputs, e.minute, e.initialPeople, e.state.chapter, e.config);
  const actual = exportGarden(g);
  if (actual.fingerprint !== e.fingerprint || canonicalPersona(actual.state) !== canonicalPersona(e.state))
    throw Error('This game file does not replay exactly on this version. Keep the file. Start fresh.');
  return g;
}
