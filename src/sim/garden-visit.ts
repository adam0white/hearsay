/** Task2 only: inert, file-origin, same-clock Derya garden7 visit over one accepted
 * task1 development capture. No shelf, ownership, ordinary entry, fortnight,
 * nursing assignment, source return, clock translation or private Person writes.
 * Public HF World/driver owns decide/begin/tick/finish and joint assent. */
import {
  type Affordance,
  type CommunityState,
  communityState,
  createCommunity,
  type Percept,
  type Person,
  restore,
  type SimEvent,
  snapshot,
  stepCommunity,
  type World,
} from '@adam0white/hf-legacy';
import {
  boundedPersonaJson,
  canonicalPersona,
  type PersonaEnvelope,
  validatePersona,
  validatePersonaLife,
} from '@adam0white/lab-client';
import { GARDEN_CAST, GARDEN_IDS, type GardenPerson, gardenLocation, gardenOpening } from './garden-cast.ts';

export const VISIT_GAME = 'hearsay-cast/7';
export const VISIT_OPTION = 'garden7/derya-aligned-visit1';
export const VISIT_START = 930;
export const VISIT_CLOSE = 990;
export const VISIT_RETURN_BEFORE = 1170;
const PINS = {
  packet: 'd07744d1026bee773860fa453c1bbd428ea04025583934b19bca68b21360c4ff',
  predecessor: '07c66193b91a1787b68bfb0bb99fa79ae6bc1530f2a5313a3ead8684f6e03316',
  prefix: 'f89a9ba3785b952d06b67362fe19dce72ba90eb0f38c2da8eb6b7e906e5e083b',
  world: '0a7dafcdd09ed4f1a15b373af8204683411a178513af2e994c413426b9f65d68',
  raw: 'f1e1988d49a52a4f7883f1ad7c6479ae9ebcc8eba34e1efd232ba17d269d07fc',
};
export type VisitResources = Record<string, unknown>;
export interface VisitSourceInput {
  packet: unknown;
  predecessor: unknown;
  prefix: unknown;
  world: unknown;
}
export interface VisitSourceRefs {
  packet: string;
  predecessor: string;
  prefix: string;
  world: string;
  raw: string;
  life: string;
}
export type VisitInput = { type: 'invite' | 'water' | 'quiet' | 'close' };
export interface VisitRecordedInput {
  at: number;
  input: VisitInput;
}
export interface VisitRun {
  game: typeof VISIT_GAME;
  option: typeof VISIT_OPTION;
  seed: 7;
  origin: 'controlled-local-file';
  accepted: false;
  submitted: false;
  coarsePreparation: 'zero-elapsed-retained-life/1';
  resources: VisitResources;
  source: VisitSourceRefs;
  initialPeople: Record<GardenPerson, string>;
  opening: string;
  closing: string | null;
  inputs: VisitRecordedInput[];
  minute: number;
  phase: 'visiting' | 'closing' | 'closed' | 'missed-window';
  actualEnd: number | null;
  closingRequested: number | null;
  invitation: { at: number; delivered: boolean; available: boolean } | null;
  waterOffered: boolean;
  people: Record<GardenPerson, Person>;
  community: CommunityState;
  events: SimEvent[];
}
export const visitFail = (message: string): never => {
  throw new Error(`Garden visit: ${message}`);
};
export function visitEqual(a: unknown, b: unknown, message: string): void {
  if (canonicalPersona(a) !== canonicalPersona(b)) visitFail(message);
}
export async function visitSHA(value: unknown): Promise<string> {
  boundedPersonaJson(value);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalPersona(value)));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}
export async function visitStore(resources: VisitResources, value: unknown): Promise<string> {
  const detached = structuredClone(value);
  const digest = await visitSHA(detached);
  resources[digest] = detached;
  return digest;
}
/** Independent original-E pins plus exact accepted source12 producer output.
 * The packet pin deliberately restricts this prototype to the actual dirty build;
 * a future trusted controller needs its own contract, not a widened authenticity check. */
export async function validateVisitSource(input: VisitSourceInput) {
  const pinned = structuredClone(input);
  if (!pinned || Object.keys(pinned).sort().join(',') !== 'packet,predecessor,prefix,world')
    visitFail('invalid source bundle');
  for (const key of ['packet', 'predecessor', 'prefix', 'world'] as const) {
    if ((await visitSHA(pinned[key])) !== PINS[key]) visitFail(`immutable source ${key} binding mismatch`);
  }
  const packet = await validatePersona(pinned.packet);
  const predecessor = await validatePersona(pinned.predecessor);
  const transfer = packet.transfer;
  if (
    packet.castId !== 'hf.cast.derya.stairwell' ||
    packet.castRevision !== '2' ||
    packet.terminal ||
    packet.parentRevision !== null ||
    packet.branchId !== predecessor.branchId ||
    packet.source.game !== 'stairwell' ||
    packet.source.rules !== '12' ||
    packet.source.engine !== '2.23.0' ||
    transfer.phase !== 'departure' ||
    transfer.sourceRole !== 'derya' ||
    transfer.castPassport !== 'derya-aligned-visit/1'
  )
    visitFail('unsupported source producer contract');
  const complete = transfer.complete as { schema: string; engine: string; raw: Person; sha256: string };
  if (
    complete?.schema !== 'human/person@1' ||
    complete.engine !== '2.23.0' ||
    complete.sha256 !== PINS.raw ||
    (await visitSHA(complete.raw)) !== PINS.raw
  )
    visitFail('complete source checkpoint mismatch');
  const raw = complete.raw;
  if (raw.id !== 'derya' || raw.now !== VISIT_START || raw.activity)
    visitFail('source is not at arrival boundary');
  visitEqual(snapshot(restore(raw)), raw, 'source restore changed complete Person');
  const life = validatePersonaLife(transfer.life, packet.castId);
  visitEqual(life, predecessor.transfer.life, 'coarse life differs from immutable E');
  // Engine minutes are not the coarse-life clock. No preparation API or bornAt write occurs.
  visitEqual(
    life.clock,
    { version: 'hf-chapter-clock/1', watermark: 498065, seed: 3096170274 },
    'unsupported coarse-life anchor',
  );
  return { ...pinned, packet, predecessor, raw, life };
}
/** Rehydrate the exact source packet from a nonrecursive resource table. raw and life each occur once. */
export function visitSourceFromResources(resources: VisitResources, refs: VisitSourceRefs): VisitSourceInput {
  const packed = structuredClone(resources[refs.packet]) as PersonaEnvelope;
  if (!packed?.transfer) visitFail('missing packet resource');
  const complete = packed.transfer.complete as Record<string, unknown>;
  if (!complete || complete.rawRef !== refs.raw || packed.transfer.lifeRef !== refs.life)
    visitFail('source resource references mismatch');
  delete complete.rawRef;
  complete.raw = structuredClone(resources[refs.raw]);
  delete packed.transfer.lifeRef;
  packed.transfer.life = structuredClone(resources[refs.life]);
  const predecessor = structuredClone(resources[refs.predecessor]) as PersonaEnvelope;
  if (!predecessor?.transfer || predecessor.transfer.lifeRef !== refs.life)
    visitFail('predecessor life reference mismatch');
  delete predecessor.transfer.lifeRef;
  predecessor.transfer.life = structuredClone(resources[refs.life]);
  const world = structuredClone(resources[refs.world]) as { people: unknown[] };
  if (!Array.isArray(world?.people)) visitFail('missing retained source world');
  let restored = 0;
  world.people = world.people.map((row) => {
    const ref = row as { rawRef?: string };
    if (ref.rawRef === undefined) return row;
    if (Object.keys(ref).join(',') !== 'rawRef' || ref.rawRef !== refs.raw)
      visitFail('source-world actor reference mismatch');
    restored++;
    return structuredClone(resources[refs.raw]);
  });
  if (restored !== 1) visitFail('source-world must reference exactly one Derya');
  return { packet: packed, predecessor, prefix: resources[refs.prefix], world };
}
function localClaim(
  run: Pick<VisitRun, 'source' | 'resources' | 'opening' | 'minute'>,
  phase: 'garden-opening' | 'garden-closing',
  rawRef: string,
) {
  const packet = visitSourceFromResources(run.resources, run.source).packet as PersonaEnvelope;
  return {
    version: 'garden-visit-local-claim/1',
    phase,
    castId: packet.castId,
    castRevision: packet.castRevision,
    branchId: packet.branchId,
    parent: phase === 'garden-opening' ? run.source.packet : run.opening,
    at: run.minute,
    rawRef,
    lifeRef: run.source.life,
    sourcePrefix: run.source.prefix,
    departureRevision: packet.revision,
    accepted: false,
    submitted: false,
    origin: 'controlled-local-file',
    limitation:
      'Local chained record only. No shelf acceptance, ownership, source return or night-duty waiver.',
  };
}
export async function createGardenVisit(source: VisitSourceInput): Promise<VisitRun> {
  const accepted = await validateVisitSource(source);
  const resources: VisitResources = {};
  const raw = await visitStore(resources, accepted.raw);
  const life = await visitStore(resources, accepted.life);
  const packed = structuredClone(accepted.packet);
  const complete = packed.transfer.complete as Record<string, unknown>;
  delete complete.raw;
  complete.rawRef = raw;
  delete packed.transfer.life;
  packed.transfer.lifeRef = life;
  const packedPredecessor = structuredClone(accepted.predecessor);
  delete packedPredecessor.transfer.life;
  packedPredecessor.transfer.lifeRef = life;
  const packedWorld = structuredClone(accepted.world) as { people: Array<Person | { rawRef: string }> };
  packedWorld.people = packedWorld.people.map((p) => ('id' in p && p.id === 'derya' ? { rawRef: raw } : p));
  const refs: VisitSourceRefs = {
    packet: await visitStore(resources, packed),
    raw,
    life,
    predecessor: await visitStore(resources, packedPredecessor),
    prefix: await visitStore(resources, accepted.prefix),
    world: await visitStore(resources, packedWorld),
  };
  const initialPeople = {} as Record<GardenPerson, string>;
  for (const [i, id] of GARDEN_IDS.entries()) {
    // Derya is referenced here, then restored exactly once into the active collection.
    // Only the other seven use the public constructor. Source references remain opaque.
    initialPeople[id] =
      id === 'derya'
        ? raw
        : await visitStore(resources, snapshot(gardenOpening(id, 7 + i * 101, VISIT_START)));
  }
  return restoreGardenVisitStart(resources, refs, initialPeople);
}
/** Replay restores pinned initial snapshots. It never consults a constructor or shelf. */
export async function restoreGardenVisitStart(
  resources: VisitResources,
  sourceRefs: VisitSourceRefs,
  initialRefs: Record<GardenPerson, string>,
): Promise<VisitRun> {
  const table = structuredClone(resources);
  const refs = structuredClone(sourceRefs);
  const initialPeople = structuredClone(initialRefs);
  for (const [key, value] of Object.entries(table)) {
    if ((await visitSHA(value)) !== key) visitFail('initial resource digest mismatch');
  }
  await validateVisitSource(visitSourceFromResources(table, refs));
  if (Object.keys(initialPeople).sort().join(',') !== [...GARDEN_IDS].sort().join(','))
    visitFail('invalid initial people');
  const people = {} as Record<GardenPerson, Person>;
  for (const id of GARDEN_IDS) {
    const raw = table[initialPeople[id]] as Person;
    if (
      !raw ||
      raw.id !== id ||
      raw.now !== VISIT_START ||
      raw.schema !== 'human/person@1' ||
      raw.engine !== '2.23.0' ||
      raw.name !== GARDEN_CAST[id].name
    )
      visitFail('invalid initial person at930');
    people[id] = restore(raw);
    visitEqual(snapshot(people[id]), raw, 'initial Person restore changed state');
  }
  if (initialPeople.derya !== refs.raw) visitFail('incoming Derya initial reference mismatch');
  const run: VisitRun = {
    game: VISIT_GAME,
    option: VISIT_OPTION,
    seed: 7,
    origin: 'controlled-local-file',
    accepted: false,
    submitted: false,
    coarsePreparation: 'zero-elapsed-retained-life/1',
    resources: table,
    source: structuredClone(refs),
    initialPeople: structuredClone(initialPeople),
    opening: '',
    closing: null,
    inputs: [],
    minute: VISIT_START,
    phase: 'visiting',
    actualEnd: null,
    closingRequested: null,
    invitation: null,
    waterOffered: false,
    people,
    community: communityState(createCommunity(GARDEN_IDS.map((id) => people[id]))),
    events: [],
  };
  run.opening = await visitStore(table, localClaim(run, 'garden-opening', refs.raw));
  return run;
}
export function visitLocation(id: GardenPerson, at: number): string {
  return id === 'derya' ? 'garden' : gardenLocation(id, at);
}
function available(run: VisitRun): boolean {
  return ['derya', 'hatice'].every((key) => {
    const id = key as GardenPerson,
      p = run.people[id];
    return p.body.alive && !p.body.asleep && !p.activity && visitLocation(id, run.minute) === 'garden';
  });
}
/** Player inputs are Hatice's offers, never commands or Derya's assent. */
export function gardenVisitInput(value: VisitRun, input: VisitInput): VisitRun {
  const run = structuredClone(value);
  boundedPersonaJson(input);
  if (Object.keys(input).join(',') !== 'type' || !['invite', 'water', 'quiet', 'close'].includes(input.type))
    visitFail('unsupported visit input');
  if (run.phase !== 'visiting') visitFail('new offers are closed');
  if (input.type === 'close') {
    if (run.minute !== VISIT_CLOSE) visitFail('closing request must be at990');
    run.phase = 'closing';
    run.closingRequested = run.minute;
  } else {
    if (run.minute >= VISIT_CLOSE) visitFail('new optional offers stop at990');
    if (input.type === 'invite') {
      if (run.invitation) visitFail('this finite chapter permits one invitation');
      run.invitation = { at: run.minute, delivered: false, available: available(run) };
    }
    if (input.type === 'water') run.waterOffered = true;
  }
  run.inputs.push({ at: run.minute, input: structuredClone(input) });
  return run;
}
function rest(): Affordance {
  return {
    id: 'visit-rest',
    action: 'rest',
    label: 'Sit quietly for five minutes',
    duration: 5,
    effort: 0,
    advertises: { rest: 0.08, leisure: 0.02 },
    placeId: 'garden',
  };
}
function worldFor(run: VisitRun): World {
  // Per-step completion witnesses let both directions require the same real joint act,
  // including the first finisher whose public finish has already cleared activity.
  const completedJoint = new Set<string>();
  return {
    now: () => run.minute,
    affordancesFor(p) {
      const id = p.id as GardenPerson;
      if (!p.body.alive || p.body.asleep || (id === 'derya' && p.now >= VISIT_CLOSE)) return [];
      const location = visitLocation(id, p.now);
      const options: Affordance[] = [{ ...rest(), placeId: location }];
      if (id !== 'derya' || run.waterOffered)
        options.push({
          id: 'visit-water',
          action: 'drink',
          label: 'Drink water',
          duration: 5,
          effort: 0,
          advertises: { water: 0.3 },
          placeId: location,
        });
      if (id !== 'derya') {
        options.push({
          id: 'ordinary-meal',
          action: 'eat',
          label: 'Eat a meal',
          duration: 15,
          effort: 0,
          advertises: { food: 0.5 },
          placeId: location,
        });
        options.push({
          id: 'ordinary-work',
          action: id === 'osman' ? 'work-market' : 'work',
          label: GARDEN_CAST[id].job,
          duration: 15,
          effort: 0.03,
          advertises: { competence: 0.02, meaning: 0.01 },
          placeId: location,
        });
      }
      if (id === 'derya' && run.invitation?.available && run.invitation.at === p.now && available(run)) {
        options.push({
          id: 'invited-garden-talk',
          action: 'chat',
          label: 'Accept Hatice’s invitation to talk for five minutes',
          duration: 5,
          effort: 0.01,
          tags: ['joint', 'conversation'],
          with: ['hatice'],
          targetId: 'hatice',
          placeId: 'garden',
          advertises: { belonging: 0.04, leisure: 0.005 },
        });
      }
      return options;
    },
    perceptsFor(p): Percept[] {
      const invitation = run.invitation;
      if (p.id !== 'derya' || !invitation?.available || invitation.delivered || p.now !== invitation.at)
        return [];
      invitation.delivered = true;
      return [
        {
          at: p.now,
          channel: 'heard',
          kind: 'garden-invitation',
          actorId: 'hatice',
          targetId: 'derya',
          placeId: 'garden',
          salience: 0.5,
          summary: 'Hatice invites Derya to talk for five minutes. Derya may sit quietly instead.',
        },
      ];
    },
    resolve(p, activity, reason) {
      const completed = reason === 'ended' && p.now >= activity.endsAt;
      if (completed && activity.jointId) completedJoint.add(`${p.id}:${activity.jointId}`);
      return {
        at: p.now,
        affordanceId: activity.affordanceId,
        action: activity.action,
        ...(activity.targetId ? { targetId: activity.targetId } : {}),
        status: completed ? 'completed' : 'interrupted',
        needs: !completed
          ? {}
          : activity.action === 'rest'
            ? { rest: 0.08, leisure: 0.02 }
            : activity.action === 'drink'
              ? { water: 0.3 }
              : activity.action === 'eat'
                ? { food: 0.5 }
                : {},
      };
    },
    // An actual completed joint activity allows the public driver's two-way conversation.
    // No topic, belief, private confidence or synthetic listener reply is supplied by the host.
    converse: (speaker, listener, activity) =>
      !speaker.body.asleep &&
      !listener.body.asleep &&
      visitLocation(speaker.id as GardenPerson, speaker.now) === 'garden' &&
      visitLocation(listener.id as GardenPerson, speaker.now) === 'garden' &&
      activity.jointId !== undefined &&
      [speaker, listener].every(
        (p) => p.activity?.jointId === activity.jointId || completedJoint.has(`${p.id}:${activity.jointId}`),
      )
        ? undefined
        : false,
  };
}
export function visitClosingReason(run: VisitRun): string | null {
  const p = run.people.derya;
  if (!p.body.alive) return 'Derya is not alive; this is not travel.';
  if (p.activity) return 'Derya still has an active activity.';
  if (
    run.people.hatice.activity?.targetId === 'derya' ||
    run.community.joint.proposals.some(
      (x) => x.status === 'pending' && (x.proposerId === 'derya' || x.partnerIds.includes('derya')),
    )
  )
    return 'Derya still has an unresolved chat.';
  if (p.agenda.goals.some((g) => g.status === 'active') || p.projects?.currentGoalId)
    return 'Derya still has an active goal or project.';
  if (p.agenda.commitments.some((c) => c.status === 'pending') || (p.agenda.owed ?? []).length)
    return 'Derya still has an unsupported duty or debt.';
  return null;
}
/** One ordinary driver minute at a time. No force-finish and no clock/body/goal writes. */
export async function advanceGardenVisit(value: VisitRun, until: number): Promise<VisitRun> {
  let run = structuredClone(value);
  if (!Number.isInteger(until) || until < run.minute || until > VISIT_RETURN_BEFORE)
    visitFail('unsupported visit time bounds');
  while (run.minute < until && !['closed', 'missed-window'].includes(run.phase)) {
    if (run.minute === VISIT_CLOSE && run.phase === 'visiting')
      run = gardenVisitInput(run, { type: 'close' });
    const next = run.minute + 1;
    const community = createCommunity(
      GARDEN_IDS.map((id) => run.people[id]),
      run.community,
    );
    // World callbacks use each actor's public clock, not a preassigned Person timestamp.
    const world = worldFor(run);
    run.events.push(...stepCommunity(community, world, next));
    run.community = communityState(community);
    run.minute = next;
    if (run.minute === VISIT_CLOSE && run.phase === 'visiting')
      run = gardenVisitInput(run, { type: 'close' });
    if (run.phase === 'closing' && run.minute < VISIT_RETURN_BEFORE && !visitClosingReason(run)) {
      run.phase = 'closed';
      run.actualEnd = run.minute;
      const rawRef = await visitStore(run.resources, snapshot(run.people.derya));
      run.closing = await visitStore(run.resources, localClaim(run, 'garden-closing', rawRef));
    } else if (run.minute >= VISIT_RETURN_BEFORE) run.phase = 'missed-window';
  }
  return run;
}
