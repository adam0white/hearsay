/** HF owns people. This host owns action availability and attended local transport. */
import {
  type ActionResolution,
  createPerson,
  createRun,
  DEFAULT_NORMS,
  type DeepReadonly,
  exportRun,
  type HostRequest,
  type Input,
  inspect,
  type Offer,
  type Payloads,
  type PersonAuthoring,
  type Result,
  type Run,
  type RunArchive,
  type RunSpec,
  restoreRun,
  type StepResult,
  step,
} from '@adam0white/human-framework';
export const MINUTE = 60_000;
const START = 360 * MINUTE,
  DAY = 86400000 as const,
  END = 14 * DAY;
type NormTag = Offer['norms'][number];
type Inspection = ReturnType<typeof inspect> extends Result<infer T> ? T : never;
type HostView = Extract<Inspection['people'][number], { kind: 'host' }>;
type HostParts = { [P in HostView['parts'][number] as P['select']]: P['value'] };
const HOST = { type: 'host' as const, id: 'hearsay' };
// Place identities must remain known when supported memories return to this garden.
// This finite vocabulary includes scheduled places and actualGardenLocation's alternatives.
const PLACES = [
  ['garden', 'garden'],
  ['hospital', 'hospital'],
  ['temporary-lodging', 'temporary lodging (morning sleep)'],
  ['lodging', 'lodging'],
  ['fountain', 'fountain'],
  ['delivery-route', 'delivery route'],
  ['own-evening', 'own evening'],
  ['school-kitchen', 'school kitchen'],
  ['agency-appointment', 'agency appointment'],
  ['bread-round', 'bread round'],
  ['produce-round', 'produce round'],
  ['market-stall', 'market stall'],
  ['quiet-corner', 'a quiet corner'],
  ['derya-home', 'flat 5, Lale Apartmanı'],
  ['other-tea-stop', 'another tea stop'],
] as const;

const clone = <T>(v: T): T => structuredClone(v);
const need = <T>(r: Result<T>): T => {
  if (!r.ok) throw new Error(`${r.error.code} ${r.error.path}: ${r.error.message}`);
  return r.value;
};
export type GardenOffer = {
  id: string;
  action: string;
  label: string;
  duration: number;
  effort?: number;
  focus?: number;
  mode?: 'awake' | 'sleep';
  targetId?: string;
  placeId?: string;
  with?: readonly string[];
  advertises?: Record<string, number>;
  norms?: readonly NormTag[];
  fulfills?: readonly string[];
};
export type GardenActivity = {
  id: string;
  affordanceId: string;
  action: string;
  targetId?: string;
  endsAt: number;
  start: number;
};
export type GardenActor = {
  id: string;
  name: string;
  now: number;
  body: HostParts['body']['state'] & { alive: boolean };
  traits: HostParts['traits'];
  memory: { beliefs: HostParts['beliefs']; sourceTrust: HostParts['sourceTrust'] };
  agenda: HostParts['agenda'];
  skills: Record<string, HostParts['skills'][number]>;
  relationships: HostParts['relationships']['ties'];
  activity?: GardenActivity;
};
type Active = { id: string; person: string; offer: Offer; start: number };
type Host = {
  revision: number;
  active: Active[];
  completed: number;
  outcomes: {
    id: string;
    person: string;
    action: string;
    status: 'completed' | 'failed' | 'interrupted';
    start: number;
    end: number;
  }[];
};
// Full offers and actual outcomes remain in the archive inputs and host checkpoint.
// The world only needs references to the current host actions, not repeated copies.
const hostState = (host: Host) => ({
  completed: host.completed,
  active: host.active.map(({ id }) => id),
  outcomes: host.outcomes.map(({ id }) => id),
});
export type GardenSession = {
  run: Run;
  identities: string[];
  clock: number;
  serial: number;
  offerRevision: Record<string, number>;
  offers: Record<string, Offer[]>;
  host: Host;
  available?: (person: string, offer: Offer, stage: 'start' | 'finish' | 'interrupt') => boolean;
  attending?: (speaker: string, recipient: string) => boolean;
};
export type GardenCheckpoint = {
  archive: RunArchive;
  clock: number;
  serial: number;
  offerRevision: Record<string, number>;
  offers: Record<string, Offer[]>;
  host: Host;
};
function normProvenance(id: string) {
  const norm = DEFAULT_NORMS.find((n) => n.id === id);
  if (!norm) throw new Error(`Missing framework norm ${id}`);
  return norm.provenance;
}
export function authorGardenPerson(
  id: string,
  name: string,
  sex: 'male' | 'female',
  age: number,
  traits: Record<string, number>,
  values: Record<string, number>,
): PersonAuthoring {
  return {
    id,
    identity: { name, sex, birthAt: START - age * 365 * DAY },
    biography: [],
    origin: {
      kind: 'authored',
      basis: { kind: 'evidence', id: `author:${id}` },
      traits: { kind: 'explicit-authoring', evidence: { kind: 'evidence', id: `traits:${id}` } },
    },
    state: {
      traits: {
        honesty: 0.5,
        emotionality: 0.5,
        extraversion: 0.5,
        agreeableness: 0.5,
        conscientiousness: 0.5,
        openness: 0.5,
        ...traits,
      },
      values: {
        benevolence: 0.5,
        universalism: 0.5,
        tradition: 0.5,
        conformity: 0.5,
        security: 0.5,
        achievement: 0.5,
        power: 0.5,
        hedonism: 0.5,
        stimulation: 0.5,
        selfDirection: 0.5,
        ...values,
      },
      body: {
        satiety: 0.8,
        hydration: 0.85,
        sleepPressure: 0.2,
        exertion: 0,
        fitness: 0.5,
        health: 1,
        pain: 0,
        sleepDebtHours: 0,
        depletion: 0,
        circadianPeakMs: 16 * 60 * MINUTE,
        asleep: false,
        since: START,
        doze: {
          context: { posture: 'upright', stimulation: 0.5 },
          basis: { kind: 'authored', author: 'hearsay', at: START },
        },
        bladder: { fill: 0, pending: 0 },
        injuries: [],
        illnesses: [],
        exposures: [],
      },
      needs: {
        safety: 0.8,
        belonging: 0.7,
        esteem: 0.6,
        autonomy: 0.7,
        competence: 0.6,
        leisure: 0.6,
        meaning: 0.6,
      },
      skills: [],
      heldNorms: [
        {
          normId: 'backbiting',
          standing: 'forbidden',
          conviction: 0.5,
          provenance: normProvenance('backbiting'),
        },
        {
          normId: 'lying',
          standing: 'forbidden',
          conviction: 0.8,
          provenance: normProvenance('lying'),
        },
      ],
      beliefs: [],
      consequences: [],
      sourceTrust: id === 'hatice' ? [] : [{ sourceId: 'hatice', trust: 0.65 }],
      context: {
        scarcity: { kind: 'prior', value: 0, basis: 'authored:garden' },
        smoking: { kind: 'unobserved' },
      },
      relationships: [],
      voices: [],
      agenda: {
        exemptions: { traveling: { kind: 'unobserved' }, illnessSeverity: { kind: 'unobserved' } },
        commitments: [],
        goals: [],
        precommitments: [],
        owed: [],
      },
      family: { contactCovered: [], aptitudes: {} },
      groups: [],
      reserve: {},
      retention: { trace: 32, chronicleDays: 120 },
      habits: [],
      expectations: [],
      affect: { mood: { valence: 0, arousal: 0.3 }, regulation: 0.3, emotions: [] },
      promptings: { reading: 'none', responses: [] },
      review: { style: 'accounting', atMsOfDay: 21 * 60 * MINUTE },
      bonds: { courtships: [], marriages: [] },
    },
  };
}
export function createGardenSession(seed: number, people: readonly PersonAuthoring[]): GardenSession {
  const actionIds = [
    'tell',
    'rest',
    'eat',
    'drink',
    'sleep',
    'work',
    'work-market',
    'chat',
    'reflect',
    'pray',
    'pray-fajr',
    'pray-dhuhr',
    'pray-asr',
    'pray-maghrib',
    'pray-isha',
  ];
  const spec: RunSpec = {
    id: 'hearsay-garden',
    seed,
    start: START,
    host: { id: 'hearsay', edition: 'hearsay-hf4/1', schema: 'hearsay-hf4/1' },
    definitions: {
      actions: actionIds.map((id) => ({
        id,
        label: id,
        demands: { effort: 0, focus: 0, mode: id === 'sleep' ? 'sleep' : 'awake', requires: {} },
        tags: [],
        norms: [],
      })),
      norms: DEFAULT_NORMS,
      marriageCustoms: [],
      skills: [],
      skillTransfers: [],
      methods: [],
      routines: [],
      sources: [HOST, ...people.map((p) => ({ type: 'person' as const, id: p.id }))],
      lexicon: {
        names: Object.fromEntries(people.map((p) => [p.id, p.identity.name])),
        roles: {},
        prefer: 'name',
        actions: {},
      },
      calendar: {
        id: 'garden-days',
        epoch: { id: 'garden-opening', simulationAt: 0, dayIndex: 0, msOfDay: 0 },
        dayMs: DAY,
        days: Array.from({ length: 16 }, (_, dayIndex) => ({ dayIndex, start: dayIndex * DAY, windows: [] })),
      },
      reputationTraits: [{ id: 'nosy', affection: -0.03, trust: -0.03, respect: -0.03 }],
    },
    lifecycle: { kinPremises: [], kinScopes: [] },
    world: {
      revision: 0,
      facts: PLACES.map(([key, place]) => ({
        id: `place:${key}`,
        subject: place,
        predicate: 'place-kind',
        value: key === 'garden' ? 'garden' : 'place',
        at: START,
        provenance: { source: HOST.id, evidenceId: `authored-place:${key}` },
      })),
      hostState: { completed: 0, active: [], outcomes: [] },
    },
  };
  const run = need(createRun(spec));
  for (const p of people) need(createPerson(run, p));
  return {
    run,
    identities: people.map((p) => p.id),
    clock: START - 1,
    serial: 0,
    offerRevision: {},
    offers: {},
    host: { revision: 0, active: [], completed: 0, outcomes: [] },
  };
}
export function gardenEvidenceId(s: GardenSession): string {
  return `garden:evidence:${++s.serial}`;
}
function envelope(s: GardenSession, kind: Input['kind'], payload: unknown, at: number): Input {
  return {
    id: `garden:input:${String(++s.serial).padStart(12, '0')}`,
    at,
    source: HOST,
    kind,
    payload,
  } as Input;
}
function receipt(s: GardenSession, h: Host, r: DeepReadonly<HostRequest>): Input {
  const base = { requestId: r.id, requestHash: r.requestHash, worldRevision: h.revision };
  if (r.kind === 'communication')
    return envelope(
      s,
      'communication.resolved',
      {
        ...base,
        speaker: r.speaker,
        emittedItemIds: r.items.map((i) => i.id),
        received: r.recipients
          .filter((p) => s.attending?.(r.speaker, p) ?? true)
          .map((recipient) => ({
            recipient,
            evidenceId: `received:${r.id}:${recipient}`,
            attention: 1,
            itemIds: r.items.map((i) => i.id),
          })),
      },
      r.boundaryAt,
    );
  const action = { ...base, person: r.person, activityId: r.activityId, stage: r.stage };
  const offer = s.offers[r.person]?.find((o) => o.id === r.offerId);
  if (
    r.stage === 'start' &&
    (!offer || r.boundaryAt + offer.durationMs > END || s.available?.(r.person, offer, 'start') === false)
  )
    return envelope(
      s,
      'action.resolved',
      { ...action, disposition: 'rejected', observations: [] },
      r.boundaryAt,
    );
  let outcome: ActionResolution['outcome'];
  if (r.stage === 'start') {
    if (!offer) throw new Error('Missing admitted offer');
    h.active.push({ id: r.activityId, person: r.person, offer: clone(offer), start: r.boundaryAt });
  } else {
    const index = h.active.findIndex((a) => a.id === r.activityId && a.person === r.person);
    const a = h.active[index];
    if (!a) throw new Error('Missing accepted garden action');
    h.active.splice(index, 1);
    const status =
      r.stage === 'interrupt'
        ? 'interrupted'
        : s.available?.(r.person, a.offer, 'finish') === false
          ? 'failed'
          : 'completed';
    if (status === 'completed') h.completed++;
    // Each person can have only one active action; keep its latest actual result for the host.
    // Every receipt remains in the framework archive history.
    h.outcomes = h.outcomes.filter((outcome) => outcome.person !== a.person);
    h.outcomes.push({
      id: a.id,
      person: a.person,
      action: a.offer.actionId,
      status,
      start: a.start,
      end: r.boundaryAt,
    });
    outcome = {
      activityId: a.id,
      offerId: a.offer.id,
      actionId: a.offer.actionId,
      ...(a.offer.target ? { target: a.offer.target } : {}),
      start: a.start,
      end: r.boundaryAt,
      status,
      evidenceId: `outcome:${r.id}`,
      summary: 'The garden recorded the actual action outcome.',
      actual: {
        exposures: [],
        observedProgress: [],
        ...(status === 'completed'
          ? {
              ...(a.offer.actionId === 'eat'
                ? { consumed: { food: 0.5 } }
                : a.offer.actionId === 'drink'
                  ? { consumed: { water: 0.5 } }
                  : {}),
              psychological: Object.fromEntries(
                Object.entries(a.offer.expected.needs).filter(([key]) =>
                  ['safety', 'belonging', 'esteem', 'autonomy', 'competence', 'leisure', 'meaning'].includes(
                    key,
                  ),
                ),
              ),
            }
          : {}),
      },
      fulfills: a.offer.fulfills,
      advances: [],
    };
  }
  const expectedRevision = h.revision++;
  return envelope(
    s,
    'action.resolved',
    {
      ...action,
      disposition: outcome?.status ?? 'accepted',
      observations: [],
      ...(outcome ? { outcome } : {}),
      worldChange: {
        expectedRevision,
        revision: h.revision,
        put: [],
        remove: [],
        hostState: hostState(h),
      },
    },
    r.boundaryAt,
  );
}
function serve(s: GardenSession, until: number, inputs: readonly Input[] = []) {
  const events: DeepReadonly<StepResult>['events'][number][] = [];
  let batch = inputs,
    staged: Host | undefined;
  for (let count = 0; count < 10000; count++) {
    const result = need(step(s.run, { until, inputs: batch }));
    if (staged) {
      s.host = staged;
      staged = undefined;
    }
    s.clock = result.at;
    events.push(...result.events);
    if (result.boundary.type === 'until') return { ...result, events };
    staged = clone(s.host);
    const candidate = staged;
    batch = [...result.boundary.requests]
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map((r) => receipt(s, candidate, r));
  }
  throw new Error('Garden HF boundary budget exhausted');
}
export function advanceGardenSession(s: GardenSession, minute: number) {
  const at = minute * MINUTE;
  if (at > s.clock) serve(s, at);
}
export function gardenEvidence<K extends keyof Payloads>(s: GardenSession, kind: K, payload: Payloads[K]) {
  const at = s.clock + 1;
  return serve(s, at, [envelope(s, kind, payload, at)]);
}
export function decideGardenAction(s: GardenSession, person: string, offers: readonly GardenOffer[]) {
  const revision = (s.offerRevision[person] ?? 0) + 1;
  s.offerRevision[person] = revision;
  // Offers start at the next actual HF input boundary, not the rounded garden minute.
  // Keep their real durations: the chapter ending cannot settle unfinished work.
  const converted: Offer[] = offers
    .filter((o) => s.clock + 1 + o.duration * MINUTE <= END)
    .map((o) => ({
      id: o.id,
      actionId: o.action,
      label: o.label,
      person,
      durationMs: o.duration * MINUTE,
      ...(o.targetId ? { target: o.targetId } : {}),
      ...(o.placeId ? { place: o.placeId } : {}),
      participants: o.with ?? [],
      alongside: [],
      demands: { effort: o.effort ?? 0, focus: o.focus ?? 0, mode: o.mode ?? 'awake', requires: {} },
      tags: o.action === 'rest' ? ['rest'] : [],
      norms: o.norms ?? [],
      expected: { needs: o.advertises ?? {}, followedBy: [], provenance: ['authored:garden'] },
      fulfills: o.fulfills ?? [],
      advances: [],
      diminishes: [],
    }));
  s.offers[person] = converted;
  const at = s.clock + 1;
  serve(s, at, [
    envelope(s, 'offers.received', { person, revision, offers: converted }, at),
    envelope(
      s,
      'decision.requested',
      { person, reason: 'Garden opportunity', treatment: 'ordinary', offerRevision: revision },
      at,
    ),
  ]);
  const a = s.host.active.find((a) => a.person === person);
  const decision = { chosen: a?.offer.id, activity: a ? activity(a) : undefined };
  // Each explicit host opportunity permits one decision. Keep the accepted action intact,
  // but withdraw future choices so HF cannot restart a stale offer after it finishes.
  const consumedRevision = revision + 1;
  s.offerRevision[person] = consumedRevision;
  s.offers[person] = [];
  const consumedAt = s.clock + 1;
  serve(s, consumedAt, [
    envelope(s, 'offers.received', { person, revision: consumedRevision, offers: [] }, consumedAt),
  ]);
  return decision;
}
const activity = (a: Active): GardenActivity => ({
  id: a.id,
  affordanceId: a.offer.id,
  action: a.offer.actionId,
  ...(a.offer.target ? { targetId: a.offer.target } : {}),
  start: a.start / MINUTE,
  endsAt: (a.start + a.offer.durationMs) / MINUTE,
});
export function interruptGardenAction(s: GardenSession, person: string, reason = 'Host interruption') {
  const a = s.host.active.find((a) => a.person === person);
  if (a) gardenEvidence(s, 'activity.interrupted', { person, activityId: a.id, reason });
}
export function gardenConfirm(s: GardenSession, person: string, prop: string, value: boolean) {
  const id = gardenEvidenceId(s);
  gardenEvidence(s, 'fact.confirmed', { person, evidenceId: id, prop, value, observationId: id });
}
export function gardenSocial(
  s: GardenSession,
  person: string,
  other: string,
  event: Payloads['social.received']['event'],
  multiplier?: number,
) {
  gardenEvidence(s, 'social.received', {
    person,
    other,
    event,
    evidenceId: gardenEvidenceId(s),
    ...(multiplier === undefined
      ? {}
      : {
          sourceTrustResponse: {
            sourceId: other,
            multiplier,
            basis: { author: 'hearsay', ruleId: 'garden-social-consequence', edition: 'hearsay-hf4/1' },
          },
        }),
  });
}
export function converseGarden(
  s: GardenSession,
  speaker: string,
  listener: string,
  topicIds: readonly string[],
  maxClaims = 1,
) {
  return gardenEvidence(s, 'conversation.requested', {
    speaker,
    listener,
    topicIds,
    maxClaims,
    temptations: [],
    loyalWarning: false,
  });
}
export function sessionPeople(s: GardenSession): Record<string, GardenActor> {
  const people = s.identities;
  const view = need(
    inspect(s.run, {
      perspective: { kind: 'host' },
      people,
      select: ['summary', 'body', 'beliefs', 'sourceTrust', 'traits', 'agenda', 'skills', 'relationships'],
    }),
  );
  return Object.fromEntries(
    view.people.map((p) => {
      if (p.kind !== 'host') throw new Error('Host projection unavailable');
      const parts = Object.fromEntries(p.parts.map((x) => [x.select, x.value])) as unknown as HostParts;
      const a = s.host.active.find((a) => a.person === p.id);
      return [
        p.id,
        {
          id: p.id,
          name: parts.summary.name,
          now: view.at / MINUTE,
          body: { ...parts.body.state, alive: parts.summary.alive },
          traits: parts.traits,
          memory: { beliefs: parts.beliefs, sourceTrust: parts.sourceTrust },
          agenda: {
            ...parts.agenda,
            commitments: parts.agenda.commitments.map((c) => ({
              ...c,
              from: c.from / MINUTE,
              until: c.until / MINUTE,
            })),
          },
          skills: Object.fromEntries(parts.skills.map((skill) => [skill.id, skill])),
          relationships: parts.relationships.ties,
          ...(a ? { activity: activity(a) } : {}),
        },
      ];
    }),
  );
}
export function checkpointGardenSession(s: GardenSession): GardenCheckpoint {
  return {
    archive: clone(exportRun(s.run)) as RunArchive,
    clock: s.clock,
    serial: s.serial,
    offerRevision: clone(s.offerRevision),
    offers: clone(s.offers),
    host: clone(s.host),
  };
}
const stable = (value: unknown): string =>
  JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
export function restoreGardenSession(c: GardenCheckpoint): GardenSession {
  const run = need(restoreRun(c.archive));
  if (
    !Number.isSafeInteger(c.serial) ||
    c.serial < 0 ||
    !Number.isSafeInteger(c.clock) ||
    (c.clock !== c.archive.current.at && !(c.archive.history.length === 0 && c.clock === START - 1)) ||
    c.host.revision !== c.archive.current.world.revision ||
    !Array.isArray(c.host.active) ||
    !Array.isArray(c.host.outcomes) ||
    stable(hostState(c.host)) !== stable(c.archive.current.world.hostState)
  )
    throw new Error('Incompatible garden host checkpoint. Keep the file and start fresh.');
  const identities = c.archive.initial.people.map((p) => p.id);
  for (const [person, revision] of Object.entries(c.offerRevision))
    if (
      !identities.includes(person) ||
      !Number.isSafeInteger(revision) ||
      revision < 1 ||
      !Array.isArray(c.offers[person])
    )
      throw new Error('Invalid garden offer revision');
  for (const [person, offers] of Object.entries(c.offers))
    if (
      !identities.includes(person) ||
      !Array.isArray(offers) ||
      offers.some((o) => o.person !== person || !Number.isSafeInteger(o.durationMs) || o.durationMs < 1)
    )
      throw new Error('Invalid garden offers');
  return {
    run,
    clock: c.clock,
    serial: c.serial,
    offerRevision: clone(c.offerRevision),
    offers: clone(c.offers),
    host: clone(c.host),
    identities,
  };
}

export function beliefEvidence(p: GardenActor, prop: string): number {
  const credence = p.memory.beliefs.find((b) => b.prop === prop)?.credence ?? 0.5;
  return Math.log(credence / (1 - credence));
}
export function trustOf(p: GardenActor, source: string): number {
  return p.memory.sourceTrust[source] ?? 0.5;
}

/** Speaking is actual host work: settle the deed before delivering its testimony. */
export function performGardenStatement(s: GardenSession, person: string, norms: readonly NormTag[]): boolean {
  const active = s.host.active.find((a) => a.person === person);
  if (active?.offer.actionId === 'chat') return false;
  if (active) interruptGardenAction(s, person, 'Speaking interrupts the current garden task');
  const decision = decideGardenAction(s, person, [
    {
      id: 'tell',
      action: 'tell',
      label: 'Speak to a garden visitor',
      duration: 1 / MINUTE,
      effort: 0,
      norms,
    },
  ]);
  if (decision.chosen !== 'tell' || !decision.activity) return false;
  const activityId = decision.activity.id;
  serve(s, s.clock + 1);
  return s.host.outcomes.some((o) => o.id === activityId && o.status === 'completed');
}
