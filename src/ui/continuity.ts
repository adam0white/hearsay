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
// Central historical consent remains known while DNT/GPC suppresses a recording identity.
let linkageKnown = false;
let gateSerial = 0;
let gatedGame: ContinuityGame | undefined;
let gatedFile = false;
let manualDenied: ContinuityGame | undefined;
let choices: Promise<void> = Promise.resolve();
/** Invalidate before any asynchronous run/load/reset work. Never consult gated playerId. */
export function invalidateContinuity(): void {
  ++gateSerial;
  gatedGame = undefined;
  gatedFile = false;
  linkageKnown = false;
  lab.setPersonaRecording('pending-history');
  lab.allowPersonaRecording(false);
}
if (typeof window !== 'undefined') {
  const identityChanged = () => {
    const g = gatedGame;
    const file = gatedFile || Boolean(g?.continuity?.entries.some((e) => e.scope === 'file'));
    invalidateContinuity();
    void gateContinuity(g, file).catch(() => {});
  };
  window.addEventListener('hf-lab-preference', identityChanged);
  window.addEventListener('storage', (event) => {
    if (
      event.key === null ||
      ['hf-lab-player', 'hf-lab-recording-off', 'hf-lab-events-off:hearsay'].includes(event.key)
    )
      identityChanged();
  });
}
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
type RecordingReply = {
  sameEpoch: boolean;
  branchId?: string;
  revision?: string;
  recordingEpoch?: string | null;
};
const headsOf = (g: ContinuityGame) => [
  ...(g.continuity?.entries.map((e) => e.head) ?? []),
  ...(g.continuity?.source ? [g.continuity.source.head] : []),
];
const selected = (g: ContinuityGame) =>
  headsOf(g)
    .map((h) => `${h.castId}/${h.branchId}/${h.revision}`)
    .join(':');
const echoes = (reply: RecordingReply, head: PersonaEnvelope) =>
  reply.branchId === head.branchId && reply.revision === head.revision;
const owns = (serial: number, g: ContinuityGame, pin: string) =>
  serial === gateSerial && gatedGame === g && selected(g) === pin;
const sharedHeads = (g: ContinuityGame) => [
  ...(g.continuity?.entries.filter((e) => e.scope === 'shared').map((e) => e.head) ?? []),
  ...(g.continuity?.source?.scope === 'shared' ? [g.continuity.source.head] : []),
];
export async function gateContinuity(g: ContinuityGame | undefined, file = false): Promise<void> {
  const serial = ++gateSerial;
  gatedGame = g;
  gatedFile = file;
  const key = g ? recordingKey(g) : 'pending-history';
  lab.setPersonaRecording(key || null);
  const localAssociation = lab.personaRecordingAllowed;
  linkageKnown = false;
  if (key) lab.allowPersonaRecording(false);
  const pin = g ? selected(g) : '';
  await shelf.ready;
  if (serial !== gateSerial) return;
  if (!g?.continuity?.entries.length && !g?.continuity?.source) {
    if (g?.initialPeople) lab.setPersonaRecording('invalid-history');
    return;
  }
  if (file || manualDenied === g) return;
  const shared = sharedHeads(g);
  const hasLocal = headsOf(g).length !== shared.length;
  if (hasLocal && !localAssociation) return;
  if (!shared.length) {
    if (localAssociation) {
      linkageKnown = true;
      lab.allowPersonaRecording(true);
    }
    return;
  }
  try {
    const heads = shared;
    const associations = await Promise.all(
      heads.map((head) =>
        shelf.request<RecordingReply>({ action: 'recording', castId: head.castId, envelope: head }),
      ),
    );
    if (!owns(serial, g, pin) || manualDenied === g) return;
    if (associations.every((a, i) => a.sameEpoch && echoes(a, heads[i]!))) {
      linkageKnown = true;
      lab.allowPersonaRecording(true);
    }
  } catch {
    /* A failed association keeps every upload blocked. */
  }
}
/** Choices are FIFO; a newer choice invalidates every older local callback immediately. */
export function chooseContinuityRecording(value: boolean): Promise<void> {
  const serial = ++gateSerial;
  const g = current();
  gatedGame = g;
  linkageKnown = false;
  if (!g) return Promise.resolve();
  manualDenied = value ? undefined : g;
  lab.setPersonaRecording(recordingKey(g));
  lab.allowPersonaRecording(false);
  const pin = selected(g);
  const heads = sharedHeads(g);
  const valid = () => owns(serial, g, pin) && current() === g;
  const task = choices
    .catch(() => {})
    .then(async () => {
      if (!valid()) return;
      await shelf.ready;
      if (!valid()) return;
      for (const head of heads) {
        const epoch = await shelf.request<RecordingReply>({
          action: 'recording',
          castId: head.castId,
          envelope: head,
        });
        if (!valid()) return;
        if (!echoes(epoch, head) || !('recordingEpoch' in epoch))
          throw new Error('Recording choice could not verify the pinned history.');
        const request = {
          action: 'recording' as const,
          castId: head.castId,
          envelope: head,
          allowRecording: value,
          recordingEpoch: epoch.recordingEpoch,
        };
        const reply = await shelf.request<RecordingReply>(request);
        if (!valid()) return;
        if (!echoes(reply, head) || reply.sameEpoch !== value)
          throw new Error('Recording identity changed. Choose again.');
      }
      if (!valid()) return;
      linkageKnown = value;
      lab.allowPersonaRecording(value);
    });
  choices = task.catch(() => {});
  return task;
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
            ? await shelf.request<PersonaEnvelope | null>({
                action: 'get',
                castId,
              })
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
      const admission = await prepareOneCastAdmission(envelope, compatible, {
        targetBuild: build(),
      });
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
        source: {
          game: 'hearsay',
          build: build(),
          engine: '2.14.1',
          rules: '4',
        },
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
  const queuedGeneration = gateSerial;
  pending = pending.then(async () => {
    if (current() !== g || queuedGeneration !== gateSerial) return;
    if (
      g.s.deryaAssignmentReleased &&
      !g.continuity?.entries.some((e) => e.admission.castId === 'hf.cast.derya.stairwell')
    ) {
      let attempted: PersonaEnvelope | undefined;
      let attemptedPrefix: ContinuityGame | undefined;
      try {
        const attempt = gateSerial;
        const prior = g.continuity?.source?.head;
        const author =
          !prior && current() === g && gatedGame === g && lab.personaRecordingAllowed && lab.telemetryOn;
        const epoch =
          !prior && shelf.enabled
            ? await shelf.request<{ recordingEpoch?: string | null }>({ action: 'recording' })
            : undefined;
        if (attempt !== gateSerial || current() !== g) return;
        const prefix = structuredClone(g);
        attemptedPrefix = prefix;
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
          if (attempt !== gateSerial || current() !== g) return;
          attempted = envelope;
          const scope = g.continuity?.source?.scope ?? 'shared';
          if (scope === 'file') {
            const { acceptLocalPersona } = await import('./local-persona');
            await acceptLocalPersona(envelope);
          } else {
            const request = {
              action: 'put' as const,
              envelope,
              authored: Boolean(
                author &&
                  attempt === gateSerial &&
                  current() === g &&
                  gatedGame === g &&
                  epoch &&
                  'recordingEpoch' in epoch,
              ),
              recordingEpoch: epoch?.recordingEpoch,
            };
            await shelf.request(request);
          }
          // A sent write can finish after a reset. Keep its receipt in its local prefix only.
          const owner = current() === g && attempt === gateSerial;
          const record = owner ? g : prefix;
          record.continuity ??= { entries: [], rows: [] };
          record.continuity.source = {
            head: envelope,
            scope,
            lastCheckpoint: structuredClone(person),
          };
          record.continuity.rows.push({
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
          prefix.continuity = structuredClone(record.continuity);
          await put('persona-departure:' + envelope.branchId, prefix);
          if (owner && current() === g && attempt === gateSerial) await gateContinuity(g, scope === 'file');
          if (owner && current() === g && gatedGame === g) store();
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
    recordingAllowed:
      !(current()?.continuity?.entries.length || current()?.continuity?.source) ||
      linkageKnown ||
      lab.personaRecordingAllowed,
    allowRecording(value) {
      void chooseContinuityRecording(value).catch((error) => {
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
          g.continuity.source = {
            head: envelope,
            scope: 'file',
            lastCheckpoint: structuredClone(person),
          };
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
          if (current() === g) {
            await gateContinuity(g, true);
            if (current() === g) store();
          }
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
          const fork = await createPersona({
            ...body,
            branchId: crypto.randomUUID(),
            parentRevision: null,
          });
          if (held.scope === 'file') {
            const { acceptLocalPersona } = await import('./local-persona');
            await acceptLocalPersona(fork, { fork: true });
          } else await shelf.request({ action: 'put', envelope: fork, fork: true });
          const claim = await createPersona({
            ...body,
            branchId: fork.branchId,
            parentRevision: fork.revision,
            source: {
              game: 'hearsay',
              build: build(),
              engine: '2.14.1',
              rules: '4',
            },
          });
          if (held.scope === 'file') {
            const { acceptLocalPersona } = await import('./local-persona');
            await acceptLocalPersona(claim);
          } else await shelf.request({ action: 'put', envelope: claim });
          const admission = { ...held.admission, envelope: fork };
          const entry: ContinuityEntry = {
            admission,
            head: claim,
            scope: held.scope,
          };
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
          const fork = await createPersona({
            ...body,
            branchId: crypto.randomUUID(),
            parentRevision: null,
          });
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
