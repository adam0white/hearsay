/** Task2 native garden7 codec only. Complete pinned initial people and digest resources
 * reconstruct public-driver state without current constructors, shelf/network or wall time.
 * Full includes derived state; compact omits only that state. Neither confers ownership. */
import { restore, snapshot } from '@adam0white/human-framework';
import { boundedPersonaJson, checkRun } from '@adam0white/lab-client';
import {
  advanceGardenVisit,
  gardenVisitInput,
  restoreGardenVisitStart,
  VISIT_CLOSE,
  VISIT_GAME,
  VISIT_OPTION,
  VISIT_RETURN_BEFORE,
  VISIT_START,
  type VisitResources,
  type VisitRun,
  visitEqual,
  visitFail,
  visitSHA,
} from './garden-visit.ts';

export interface GardenVisitSave {
  game: typeof VISIT_GAME;
  version: 'garden-visit-native/1';
  option: typeof VISIT_OPTION;
  seed: 7;
  origin: 'controlled-local-file';
  accepted: false;
  submitted: false;
  coarsePreparation: VisitRun['coarsePreparation'];
  source: VisitRun['source'];
  resources: VisitResources;
  initialPeople: VisitRun['initialPeople'];
  opening: string;
  closing: string | null;
  inputs: VisitRun['inputs'];
  minute: number;
  closingRequested: number | null;
  actualEnd: number | null;
  phase: VisitRun['phase'];
  replaySHA256: string;
  state?: Pick<VisitRun, 'people' | 'community' | 'events' | 'invitation' | 'waterOffered'>;
}
/** Private header parser only. Complete validity requires the shared replay core below. */
async function parseGardenVisitHeader(value: unknown): Promise<GardenVisitSave> {
  const save = structuredClone(value) as GardenVisitSave;
  if (!save || typeof save !== 'object' || Array.isArray(save)) visitFail('invalid native JSON object');
  const { state, ...header } = save;
  const { resources, ...small } = header;
  boundedPersonaJson(small);
  if (
    Object.keys(header).sort().join(',') !==
      'accepted,actualEnd,closing,closingRequested,coarsePreparation,game,initialPeople,inputs,minute,opening,option,origin,phase,replaySHA256,resources,seed,source,submitted,version' ||
    save.game !== VISIT_GAME ||
    save.version !== 'garden-visit-native/1' ||
    save.option !== VISIT_OPTION ||
    save.seed !== 7 ||
    save.accepted !== false ||
    save.submitted !== false ||
    save.origin !== 'controlled-local-file' ||
    save.coarsePreparation !== 'zero-elapsed-retained-life/1' ||
    !/^[a-f0-9]{64}$/.test(save.replaySHA256)
  )
    visitFail('unsupported native version, option or ownership');
  if (
    !Number.isInteger(save.minute) ||
    save.minute < VISIT_START ||
    save.minute > VISIT_RETURN_BEFORE ||
    !['visiting', 'closing', 'closed', 'missed-window'].includes(save.phase) ||
    (save.actualEnd !== null &&
      (!Number.isInteger(save.actualEnd) ||
        save.actualEnd < VISIT_CLOSE ||
        save.actualEnd >= VISIT_RETURN_BEFORE ||
        save.actualEnd !== save.minute)) ||
    (save.phase === 'closed') !== (save.actualEnd !== null) ||
    (save.phase === 'closed') !== (typeof save.closing === 'string') ||
    save.closingRequested !== (save.minute >= VISIT_CLOSE ? VISIT_CLOSE : null)
  )
    visitFail('invalid native clock, phase or return bound');
  if (
    !resources ||
    typeof resources !== 'object' ||
    Array.isArray(resources) ||
    Object.keys(resources).length > 24
  )
    visitFail('invalid native resource table');
  for (const [key, resource] of Object.entries(resources)) {
    if (!/^[a-f0-9]{64}$/.test(key) || (await visitSHA(resource)) !== key)
      visitFail('native resource digest mismatch');
  }
  if (state !== undefined) {
    boundedPersonaJson(state);
    if (!state || typeof state !== 'object') visitFail('invalid native derived state');
  }
  return save;
}
/** Caller data is detached before the first await. Both public APIs use this complete check. */
async function validateAndReplayGardenVisit(
  value: unknown,
): Promise<{ save: GardenVisitSave; run: VisitRun }> {
  const save = await parseGardenVisitHeader(value);
  // Start with only the unique required source and initial resources; replay must reproduce
  // every additional local claim/raw resource. Extra injected or recursive envelopes refuse.
  const resources: VisitResources = {};
  if (
    !save.source ||
    Object.keys(save.source).sort().join(',') !== 'life,packet,predecessor,prefix,raw,world'
  )
    visitFail('invalid source references');
  for (const ref of [...Object.values(save.source), ...Object.values(save.initialPeople)]) {
    if (typeof ref !== 'string' || !(ref in save.resources)) visitFail('missing source or initial resource');
    resources[ref] = save.resources[ref];
  }
  let run = await restoreGardenVisitStart(resources, save.source, save.initialPeople);
  if (!Array.isArray(save.inputs) || save.inputs.length > 64) visitFail('invalid native inputs');
  let prior = VISIT_START;
  for (const recorded of save.inputs) {
    boundedPersonaJson(recorded);
    if (
      Object.keys(recorded).sort().join(',') !== 'at,input' ||
      !Number.isInteger(recorded.at) ||
      recorded.at < prior ||
      recorded.at > save.minute
    )
      visitFail('invalid input ordering');
    // advance handles automatic close at990; consume its exact recorded request once.
    run = await advanceGardenVisit(run, recorded.at);
    if (recorded.input.type === 'close' && run.closingRequested === VISIT_CLOSE) {
      if (recorded.at !== VISIT_CLOSE || run.inputs.filter((i) => i.input.type === 'close').length !== 1)
        visitFail('invalid closing input');
    } else run = gardenVisitInput(run, recorded.input);
    prior = recorded.at;
  }
  run = await advanceGardenVisit(run, save.minute);
  visitEqual(run.inputs, save.inputs, 'native input/closing request mismatch');
  visitEqual(run.resources, save.resources, 'native resources/claim chain mismatch');
  visitEqual(
    {
      opening: run.opening,
      closing: run.closing,
      actualEnd: run.actualEnd,
      closingRequested: run.closingRequested,
      phase: run.phase,
      minute: run.minute,
    },
    {
      opening: save.opening,
      closing: save.closing,
      actualEnd: save.actualEnd,
      closingRequested: save.closingRequested,
      phase: save.phase,
      minute: save.minute,
    },
    'native closing/state boundary mismatch',
  );
  // Independently exercise complete raw restore at the actual closing boundary too.
  if (run.phase === 'closed')
    visitEqual(
      snapshot(restore(snapshot(run.people.derya))),
      snapshot(run.people.derya),
      'closing raw restore mismatch',
    );
  if ((await visitSHA(run)) !== save.replaySHA256) visitFail('complete replay digest mismatch');
  if (save.state !== undefined)
    visitEqual(save.state, derivedState(run), 'complete native full state mismatch');
  return { save, run };
}
/** Validate the complete source, resource graph, native state and replay before returning detached data. */
export async function validateGardenVisitSave(value: unknown): Promise<GardenVisitSave> {
  return (await validateAndReplayGardenVisit(value)).save;
}
/** Replay and public validation enforce the same complete contract. */
export async function replayGardenVisit(value: unknown): Promise<VisitRun> {
  return (await validateAndReplayGardenVisit(value)).run;
}
function derivedState(run: VisitRun) {
  const { people, community, events, invitation, waterOffered } = run;
  return { people, community, events, invitation, waterOffered };
}
export async function exportGardenVisit(value: VisitRun, compact = false): Promise<GardenVisitSave> {
  const run = structuredClone(value);
  const {
    people: _people,
    community: _community,
    events: _events,
    invitation: _invitation,
    waterOffered: _waterOffered,
    ...header
  } = run;
  const save: GardenVisitSave = {
    ...header,
    version: 'garden-visit-native/1',
    replaySHA256: await visitSHA(run),
    ...(compact ? {} : { state: derivedState(run) }),
  };
  await replayGardenVisit(save);
  return save;
}
/** Public JSON and size/depth/complexity guards precede any Person restoration. */
export async function importGardenVisit(text: string): Promise<VisitRun> {
  if (new TextEncoder().encode(text).length > 4 * 1024 * 1024 || !checkRun(text))
    visitFail('native JSON exceeds size/depth/complexity bounds');
  const parsed: unknown = JSON.parse(text, (key, value) => {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) visitFail('unsafe native JSON key');
    return value;
  });
  return replayGardenVisit(parsed);
}
