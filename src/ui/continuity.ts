/** Browser continuity lifecycle. Loaded histories keep their own accepted head. */
import {
  createPersona,
  type PersonaEnvelope,
  personaChannel,
  validatePersona,
  watchPersonaCheckpoint,
} from '@adam0white/lab-client';
import { personaControls } from '@adam0white/lab-kit';
import { newGame } from '../sim/game';
import type { ContinuityEntry, ContinuityState, OneCastRow } from '../sim/one-cast';
import {
  createAuthoredDeryaCheckpoint,
  createOneCastOpening,
  createOneCastReturn,
  ONE_CAST,
  type OneCastId,
  prepareOneCastAdmission,
} from '../sim/one-cast';
import type { Game } from '../sim/types';
import { downloadRun } from './feedback';
import { lab } from './lab';
import { get, put } from './store';
export type ContinuityGame = Game & { continuity?: ContinuityState };
export const shelf = personaChannel();
let current: () => ContinuityGame | undefined = () => undefined;
let store: () => void = () => {};
let pending: Promise<void> = Promise.resolve();
let bridgeStatus = '';
let pendingArrival: {
  admission: import('../sim/one-cast').OneCastAdmission;
  scope: 'shared' | 'file';
  seed: number;
} | null = null;
let loadArrival: ((game: ContinuityGame) => Promise<void>) | undefined;
let candidate: PersonaEnvelope | null = null;
let conflict: {
  entry?: ContinuityEntry;
  envelope: PersonaEnvelope;
  game: ContinuityGame;
  prefix?: ContinuityGame;
  checkpoint?: Game['s']['people'][string];
} | null = null;
const build = () => lab.build().c ?? 'development';
const message = (error: unknown) =>
  error instanceof Error ? error.message : 'Continuity unavailable. Keep a local file.';
const recordingKey = (g: ContinuityGame) =>
  [
    ...(g.continuity?.entries.map((e) => e.head.branchId) ?? []),
    ...(g.continuity?.source ? [g.continuity.source.head.branchId] : []),
  ]
    .sort()
    .join(':') || null;
export async function gateContinuity(g: ContinuityGame | undefined, file = false): Promise<void> {
  await shelf.ready;
  const key = g ? recordingKey(g) : 'pending-history';
  lab.setPersonaRecording(key || null);
  if (!g?.continuity?.entries.length && !g?.continuity?.source) {
    if (g?.initialPeople) lab.setPersonaRecording('invalid-history');
    return;
  }
  const localAssociation = lab.personaRecordingAllowed;
  lab.allowPersonaRecording(false);
  if (file) return;
  if (g.continuity?.entries.every((e) => e.scope === 'file') && !g.continuity.source && localAssociation) {
    lab.allowPersonaRecording(true);
    return;
  }
  try {
    const heads = [
      ...g.continuity.entries.map((e) => e.head),
      ...(g.continuity.source ? [g.continuity.source.head] : []),
    ];
    const associations = await Promise.all(
      heads.map((head) =>
        shelf.request<{ sameEpoch: boolean }>({ action: 'recording', castId: head.castId }),
      ),
    );
    if (associations.every((a) => a.sameEpoch)) lab.allowPersonaRecording(true);
  } catch {
    /* A failed association keeps every upload blocked. */
  }
}
export async function validateContinuity(g: ContinuityGame): Promise<void> {
  if (!g.continuity) {
    if (g.initialPeople || g.initialContinuity) throw new Error('The pinned continuity is missing.');
    return;
  }
  if (
    g.s.version !== 4 ||
    !Array.isArray(g.continuity.entries) ||
    g.continuity.entries.length > 2 ||
    !Array.isArray(g.continuity.rows) ||
    g.continuity.rows.length > 128
  )
    throw new Error('Unsupported continuity save.');
  if (g.continuity.source) await validatePersona(g.continuity.source.head);
  if (g.continuity.entries.length && (!g.initialContinuity || !g.initialPeople))
    throw new Error('The pinned continuity is missing.');
  for (const entry of g.continuity.entries) {
    await validatePersona(entry.head);
    await validatePersona(entry.admission.envelope);
    const fresh = newGame(g.s.seed, 4);
    const base =
      fresh.s.people[entry.admission.person.id] ??
      (await import('../sim/one-cast')).makeDilanOpening(g.s.seed, 360);
    const opening = createOneCastOpening(
      entry.admission.castId,
      base,
      entry.admission.envelope.transfer.person,
    );
    const admitted = await prepareOneCastAdmission(entry.admission.envelope, opening, {
      targetBuild: entry.admission.targetBuild,
    });
    if (JSON.stringify(admitted) !== JSON.stringify(entry.admission))
      throw new Error('The pinned admission does not validate.');
    if (
      JSON.stringify(
        g.initialContinuity?.entries.find((e) => e.admission.castId === entry.admission.castId)?.admission,
      ) !== JSON.stringify(entry.admission)
    )
      throw new Error('The pinned replay arrival differs.');
    if (
      entry.head.castId !== entry.admission.castId ||
      !g.initialPeople?.[entry.admission.person.id] ||
      JSON.stringify(g.initialPeople[entry.admission.person.id]) !== JSON.stringify(entry.admission.person)
    )
      throw new Error('The pinned arrival is incomplete.');
  }
}
function row(e: ContinuityEntry, envelope: PersonaEnvelope, stage: string): OneCastRow {
  return {
    v: 1,
    probe: ONE_CAST[e.admission.castId].probe,
    arm: 'continuing',
    scope: e.scope,
    castId: envelope.castId,
    branchId: envelope.branchId,
    revision: envelope.revision,
    parentRevision: envelope.parentRevision,
    stage,
    outcome: 'accepted',
  };
}
/** This only runs for a new fortnight; it never replaces a loaded Person. */
export async function arrive(seed: number, fresh = false): Promise<ContinuityGame> {
  await shelf.ready;
  lab.setPersonaRecording('pending-history');
  const opening = newGame(seed, 4);
  if (fresh || (!shelf.enabled && !candidate)) {
    await gateContinuity(opening);
    return opening;
  }
  const prepared: ContinuityEntry[] = [];
  for (const castId of Object.keys(ONE_CAST) as OneCastId[]) {
    let attemptedAdmission: typeof pendingArrival = null;
    try {
      const envelope =
        candidate?.castId === castId
          ? candidate
          : shelf.enabled
            ? await shelf.request<PersonaEnvelope | null>({ action: 'get', castId })
            : null;
      if (!envelope || envelope.source.game !== ONE_CAST[castId].sourceGame) continue;
      const departure = await get<ContinuityGame>('persona-departure:' + envelope.branchId);
      const oldSource = departure?.value.continuity?.entries.some(
        (e) => e.admission.envelope.revision === envelope.revision,
      );
      if (departure && !oldSource) {
        bridgeStatus =
          'Continuation return unavailable: this Hearsay chapter has already departed. Its saved source prefix is retained. Start a fresh authored fortnight to play another garden.';
        continue;
      }
      // Dilan's opening is authored by the adapter; Derya uses this edition's nurse.
      const { makeDilanOpening } = await import('../sim/one-cast');
      const person = opening.s.people[ONE_CAST[castId].targetId] ?? makeDilanOpening(seed, 360);
      const compatible = createOneCastOpening(castId, person, envelope.transfer.person);
      const admission = await prepareOneCastAdmission(envelope, compatible, { targetBuild: build() });
      const { revision, ...body } = envelope;
      const claim = await createPersona({
        ...body,
        parentRevision: revision,
        transfer: {
          ...body.transfer,
          admission: {
            adapter: 'hearsay-one-cast/1',
            mapping: admission.mapping,
            openingMinute: 360,
            targetBuild: build(),
            claimId: crypto.randomUUID(),
          },
        },
        source: { game: 'hearsay', build: build(), engine: '2.14.1', rules: '4' },
      });
      const scope = candidate?.revision === envelope.revision ? 'file' : 'shared';
      attemptedAdmission = { admission, scope, seed };
      // Claim before loading. A file also needs an explicit fork when it competes.
      if (scope === 'file') {
        const { acceptLocalPersona } = await import('./local-persona');
        await acceptLocalPersona(claim, { arrival: envelope });
      } else await shelf.request({ action: 'put', envelope: claim });
      prepared.push({ admission, head: claim, scope });
      candidate = null;
    } catch (error) {
      bridgeStatus = message(error);
      if (/conflict/i.test(bridgeStatus) && attemptedAdmission) pendingArrival = attemptedAdmission;
      lab.milestone('one cast bridgefail');
    }
  }
  const continuity: ContinuityState = {
    entries: prepared,
    rows: prepared.map((e) => row(e, e.head, 'admitted')),
  };
  const g: ContinuityGame = prepared.length
    ? newGame(
        seed,
        4,
        Object.fromEntries(prepared.map((e) => [e.admission.person.id, e.admission.person])),
        continuity,
      )
    : opening;
  await gateContinuity(
    g,
    prepared.some((e) => e.scope === 'file'),
  );
  if (prepared.length) {
    lab.milestone('one cast eligible');
    lab.milestone('one cast import');
  }
  return g;
}
export function checkpointContinuity(): Promise<void> {
  const g = current();
  if (
    !g ||
    g.s.version !== 4 ||
    (!shelf.enabled &&
      g.continuity?.source?.scope !== 'file' &&
      !g.continuity?.entries.some((e) => e.scope === 'file'))
  )
    return Promise.resolve();
  pending = pending.then(async () => {
    if (
      g.s.deryaAssignmentReleased &&
      !g.continuity?.entries.some((e) => e.admission.castId === 'hf.cast.derya.stairwell')
    ) {
      let attempted: PersonaEnvelope | undefined;
      let attemptedPrefix: ContinuityGame | undefined;
      try {
        const prefix = structuredClone(g);
        attemptedPrefix = prefix;
        const prior = g.continuity?.source?.head;
        const person = prefix.s.people.derya!;
        const envelope = await createAuthoredDeryaCheckpoint(person, {
          targetBuild: build(),
          branchId: prior?.branchId ?? crypto.randomUUID(),
          parentRevision: prior?.revision ?? null,
          assignmentEnded: true,
        });
        if (
          !prior ||
          JSON.stringify(prior.transfer.checkpoint) !== JSON.stringify(envelope.transfer.checkpoint)
        ) {
          attempted = envelope;
          const scope = g.continuity?.source?.scope ?? 'shared';
          if (scope === 'file') {
            const { acceptLocalPersona } = await import('./local-persona');
            await acceptLocalPersona(envelope);
          } else await shelf.request({ action: 'put', envelope, ...(!prior ? { authored: true } : {}) });
          g.continuity ??= { entries: [], rows: [] };
          g.continuity.source = { head: envelope, scope, lastCheckpoint: structuredClone(person) };
          g.continuity.rows.push({
            v: 1,
            probe: 'derya',
            arm: 'fresh',
            scope,
            castId: envelope.castId,
            branchId: envelope.branchId,
            revision: envelope.revision,
            parentRevision: envelope.parentRevision,
            stage: 'checkpoint',
            outcome: 'accepted',
          });
          prefix.continuity = structuredClone(g.continuity);
          await put('persona-departure:' + envelope.branchId, prefix);
          if (!prior && current() === g) {
            const recording = lab.personaRecordingAllowed;
            lab.setPersonaRecording(recordingKey(g));
            if (recording && lab.telemetryOn) {
              await shelf.request({ action: 'recording', castId: envelope.castId, allowRecording: true });
              lab.allowPersonaRecording(true);
            }
          }
          if (current() === g) store();
          bridgeStatus =
            'Derya’s assignment ended. Her checkpoint is saved; flat 5 remains her permanent home.';
        }
      } catch (error) {
        bridgeStatus = message(error);
        if (attempted && /conflict/i.test(bridgeStatus))
          conflict = {
            envelope: attempted,
            game: g,
            prefix: attemptedPrefix,
            checkpoint: attemptedPrefix?.s.people.derya,
          };
      }
    }

    for (const entry of g.continuity?.entries ?? []) {
      if (
        !entry.encounter ||
        (entry.admission.castId === 'hf.cast.derya.stairwell' && !g.s.deryaAssignmentReleased)
      )
        continue;
      let attempted: PersonaEnvelope | undefined;
      let attemptedPrefix: ContinuityGame | undefined;
      try {
        const prefix = structuredClone(g);
        attemptedPrefix = prefix;
        const person = prefix.s.people[entry.admission.person.id];
        if (!person) throw new Error('The continuing person is unavailable.');
        const envelope = await createOneCastReturn(person, entry.admission, {
          targetBuild: build(),
          parentRevision: entry.head.revision,
          branchId: entry.head.branchId,
          assignmentEnded: Boolean(g.s.deryaAssignmentReleased),
          encounter: entry.encounter,
        });
        if (
          entry.head.source.game === 'hearsay' &&
          JSON.stringify(entry.head.transfer.checkpoint) === JSON.stringify(envelope.transfer.checkpoint)
        )
          continue;
        attempted = envelope;
        if (entry.scope === 'file') {
          const { acceptLocalPersona } = await import('./local-persona');
          await acceptLocalPersona(envelope);
        } else await shelf.request({ action: 'put', envelope });
        entry.head = envelope;
        entry.lastCheckpoint = structuredClone(person);
        g.continuity?.rows.push(row(entry, envelope, 'checkpoint'));
        prefix.continuity = structuredClone(g.continuity);
        await put('persona-departure:' + envelope.branchId, prefix);

        bridgeStatus =
          'Chapter checkpoint saved in this browser. Source continuation requires its matching saved departure and source support.';
        conflict = null;
        if (current() === g) {
          store();
          lab.milestone('one cast source completion');
        }
      } catch (error) {
        bridgeStatus = message(error);
        if (/conflict/i.test(bridgeStatus) && attempted)
          conflict = {
            entry,
            envelope: attempted,
            game: g,
            prefix: attemptedPrefix,
            checkpoint: attemptedPrefix?.s.people[entry.admission.person.id],
          };
      }
    }
  });
  return pending;
}
export function installContinuity(
  getGame: () => ContinuityGame | undefined,
  save: () => void,
  load?: (game: ContinuityGame) => Promise<void>,
): void {
  loadArrival = load;
  current = getGame;
  store = save;
  watchPersonaCheckpoint(checkpointContinuity);
}
export function continuityPanel(): HTMLElement {
  const box = document.createElement('section');
  box.className = 'continuity-panel';
  const controls = personaControls({
    enabled: shelf.enabled,
    setEnabled(value) {
      shelf.setEnabled(value);
    },
    recordingAllowed: lab.personaRecordingAllowed,
    allowRecording(value) {
      void (async () => {
        const g = current();
        lab.setPersonaRecording(g ? recordingKey(g) : null);
        if (value && g?.continuity && shelf.enabled) {
          const shared = [
            ...g.continuity.entries.filter((e) => e.scope === 'shared').map((e) => e.head),
            ...(g.continuity.source ? [g.continuity.source.head] : []),
          ];
          for (const head of shared)
            await shelf.request({ action: 'recording', castId: head.castId, allowRecording: true });
        }
        lab.allowPersonaRecording(value);
      })().catch((error) => {
        status.textContent = message(error);
      });
    },
  });
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.textContent = bridgeStatus || 'Continuity uses this browser. A fresh fortnight is always available.';
  box.append(controls, status);
  const entries = current()?.continuity?.entries ?? [];
  if (entries.length) {
    const detail = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'What this arrival carries';
    detail.append(summary);
    const policy = document.createElement('p');
    policy.textContent =
      'The approved profile and attended fact carry over. This chapter supplies current hunger, tiredness and mood. Travel and recovery are not simulated. Source routines and relationships stay in their original chapter.';
    detail.append(policy);
    for (const entry of entries) {
      const p = document.createElement('p');
      p.textContent = entry.admission.limitations.join(' ');
      detail.append(p);
    }
    box.append(detail);
  }
  const add = (text: string, action: () => void) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.onclick = action;
    box.append(b);
  };
  add(
    'Keep a person file',
    () =>
      void (async () => {
        const entries = current()?.continuity?.entries;
        if (entries?.length) downloadRun(entries.at(-1)?.head);
        else if (current()?.continuity?.source) downloadRun(current()?.continuity?.source?.head);
        else {
          const g = current();
          if (!g?.s.deryaAssignmentReleased) {
            status.textContent = 'Derya’s relief assignment has not ended. Her source chapter remains here.';
            return;
          }
          const prefix = structuredClone(g);
          const person = prefix.s.people.derya;
          if (!person) throw new Error('Derya is unavailable.');
          const envelope = await createAuthoredDeryaCheckpoint(person, {
            targetBuild: build(),
            branchId: crypto.randomUUID(),
            parentRevision: null,
            assignmentEnded: true,
          });
          const { acceptLocalPersona } = await import('./local-persona');
          await acceptLocalPersona(envelope);
          g.continuity ??= { entries: [], rows: [] };
          g.continuity.source = { head: envelope, scope: 'file', lastCheckpoint: structuredClone(person) };
          g.continuity.rows.push({
            v: 1,
            probe: 'derya',
            arm: 'fresh',
            scope: 'file',
            castId: envelope.castId,
            branchId: envelope.branchId,
            revision: envelope.revision,
            parentRevision: envelope.parentRevision,
            stage: 'checkpoint',
            outcome: 'accepted',
          });
          prefix.continuity = structuredClone(g.continuity);
          await put('persona-departure:' + envelope.branchId, prefix);
          store();
          downloadRun(envelope);
        }
      })().catch((error) => {
        status.textContent = message(error);
      }),
  );
  add('Open a person file', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      try {
        const file = input.files?.[0];
        if (!file) return;
        if (file.size > 256 * 1024) throw new Error('Person file exceeds 256 KiB.');
        candidate = await validatePersona(JSON.parse(await file.text()));
        status.textContent =
          'Person file checked. Begin a new fortnight to admit it. Your loaded run stays unchanged.';
      } catch (error) {
        status.textContent = message(error);
      }
    };
    input.click();
  });
  add(
    'Save a chapter checkpoint',
    () =>
      void checkpointContinuity().then(() => {
        status.textContent = bridgeStatus;
      }),
  );
  if (pendingArrival)
    add(
      'Fork the arriving history',
      () =>
        void (async () => {
          const held = pendingArrival;
          if (!held || !loadArrival) return;
          const { revision: _revision, ...body } = held.admission.envelope;
          const fork = await createPersona({ ...body, branchId: crypto.randomUUID(), parentRevision: null });
          if (held.scope === 'file') {
            const { acceptLocalPersona } = await import('./local-persona');
            await acceptLocalPersona(fork, { fork: true });
          } else await shelf.request({ action: 'put', envelope: fork, fork: true });
          const claim = await createPersona({
            ...body,
            branchId: fork.branchId,
            parentRevision: fork.revision,
            source: { game: 'hearsay', build: build(), engine: '2.14.1', rules: '4' },
          });
          if (held.scope === 'file') {
            const { acceptLocalPersona } = await import('./local-persona');
            await acceptLocalPersona(claim);
          } else await shelf.request({ action: 'put', envelope: claim });
          const admission = { ...held.admission, envelope: fork };
          const entry: ContinuityEntry = { admission, head: claim, scope: held.scope };
          const g = newGame(
            held.seed,
            4,
            { [admission.person.id]: admission.person },
            { entries: [entry], rows: [row(entry, claim, 'admitted')] },
          );
          pendingArrival = null;
          candidate = null;
          await gateContinuity(g, held.scope === 'file');
          await loadArrival(g);
          status.textContent = 'Explicit fork admitted into a new fortnight.';
        })().catch((error) => {
          status.textContent = message(error);
        }),
    );
  if (conflict)
    add(
      'Fork this continuation',
      () =>
        void (async () => {
          const held = conflict;
          if (!held) return;
          const { revision: _revision, ...body } = held.envelope;
          const fork = await createPersona({ ...body, branchId: crypto.randomUUID(), parentRevision: null });
          const scope = held.entry?.scope ?? held.game.continuity?.source?.scope ?? 'shared';
          if (scope === 'file') {
            const { acceptLocalPersona } = await import('./local-persona');
            await acceptLocalPersona(fork, { fork: true });
          } else await shelf.request({ action: 'put', envelope: fork, fork: true });
          if (held.entry) {
            held.entry.head = fork;
            if (held.checkpoint) held.entry.lastCheckpoint = structuredClone(held.checkpoint);
            held.game.continuity?.rows.push(row(held.entry, fork, 'checkpoint'));
          } else {
            held.game.continuity ??= { entries: [], rows: [] };
            held.game.continuity.source = {
              head: fork,
              scope,
              ...(held.checkpoint ? { lastCheckpoint: structuredClone(held.checkpoint) } : {}),
            };
            held.game.continuity.rows.push({
              v: 1,
              probe: 'derya',
              arm: 'fresh',
              scope,
              castId: fork.castId,
              branchId: fork.branchId,
              revision: fork.revision,
              parentRevision: null,
              stage: 'checkpoint',
              outcome: 'accepted',
            });
          }
          if (held.prefix) {
            held.prefix.continuity = structuredClone(held.game.continuity);
            await put('persona-departure:' + fork.branchId, held.prefix);
          }
          conflict = null;
          await gateContinuity(current());
          store();
          status.textContent = 'Explicit fork saved as the active branch.';
        })().catch((error) => {
          status.textContent = message(error);
        }),
    );
  return box;
}
