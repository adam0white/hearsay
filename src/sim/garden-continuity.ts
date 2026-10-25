/** Explicit semantic boundary. Public canonical profiles never stand in for lived state. */
import {
  admitCalendarPersona,
  type CalendarPersonaSnapshot,
  DEFAULT_NORMS,
  isContinuingCommitment,
  type Person,
  projectCalendarPersona,
  restore,
  snapshot,
  validateCalendarPersona,
} from '@adam0white/human-framework';
import {
  canonicalCast,
  canonicalPersona,
  type LifePreparation,
  lifeAdmission,
  type PersonaEnvelope,
  preparePersonaLife,
} from '@adam0white/lab-client';
import type { GardenRun } from './garden.ts';
import { GARDEN_CAST, GARDEN_IDS, type GardenPerson, gardenOpening } from './garden-cast.ts';
import { prepareGardenDeparture } from './garden-departure.ts';

export interface GardenChapter {
  version: 'hearsay-batch/1';
  inputs: LifePreparation[];
  claims: PersonaEnvelope[];
  mapping: 'hearsay-calendar/1';
}
export interface SourceArchive {
  digest: string;
  prefix: GardenRun;
  person: GardenPerson;
}
export const gardenId = (castId: string): GardenPerson => {
  const id = GARDEN_IDS.find((id) => GARDEN_CAST[id].castId === castId);
  if (!id) throw new Error('This person has no Hearsay role.');
  return id;
};
const identity = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, id]));
const calendarActions = new Set([
  'pray',
  'pray-home',
  'pray-qada',
  'pray-eid',
  'eat',
  'drink',
  'tea',
  'work-market',
  'sleep',
  'rest',
]);
/** No arbitrary source-role registration: these are the two authored Voice visits. */
export const GARDEN_ADAPTERS = {
  voice: { riza: 'hf.cast.riza.voice', osman: 'hf.cast.osman.voice' },
} as const;
export function projectGardenPerson(person: Person): CalendarPersonaSnapshot {
  const retained = person.agenda.commitments.filter((c) => isContinuingCommitment(person.agenda, c));
  const owed = person.agenda.owed ?? [];
  return projectCalendarPersona(person, {
    version: 'hearsay-calendar/1',
    skills: person.id === 'osman' && person.skills.trade ? { trade: 'trade' } : {},
    calendar: {
      version: 'hf-persona-calendar-map/1',
      offset: 0,
      sourceNorms: DEFAULT_NORMS,
      references: {
        commitments: identity([
          ...retained.flatMap((c) => [c.id, ...(c.makeUpOf ? [c.makeUpOf] : [])]),
          ...owed.flatMap((d) => [d.ofId, ...(d.scheduledAs ? [d.scheduledAs] : [])]),
        ]),
        chains: identity(retained.flatMap((c) => (c.chain ? [c.chain] : []))),
        actions: identity([
          ...retained.flatMap((c) => [...c.actions, ...(c.violatedBy ?? [])]),
          ...owed.flatMap((d) => [...d.actions, ...(d.violatedBy ?? [])]),
        ]),
        entities: identity(
          retained.flatMap((c) => [c.toId, c.targetId].filter((x): x is string => x !== undefined)),
        ),
        norms: identity(DEFAULT_NORMS.map((n) => n.id)),
      },
    },
  });
}
function shiftCalendar(portable: CalendarPersonaSnapshot, now: number) {
  const p = structuredClone(portable),
    offset = now - p.person.source.now;
  p.calendar.offset = offset;
  for (const c of p.calendar.commitments) {
    c.from += offset;
    c.until += offset;
    if (c.recurUntil !== undefined) c.recurUntil += offset;
    if (c.exempt) c.exempt.at += offset;
  }
  for (const d of p.calendar.owed) {
    d.at += offset;
    if (d.lapseSince !== undefined) d.lapseSince += offset;
  }
  if (p.calendar.lapse) p.calendar.lapse.since += offset;
  return p;
}
export function admitGardenPerson(
  input: LifePreparation,
  seed: number,
  archives: SourceArchive[] = [],
): Person {
  const parent = input.parent,
    id = gardenId(parent.castId),
    canonical = canonicalCast(parent.castId);
  if (parent.castRevision !== canonical.revision || parent.terminal)
    throw new Error(
      'This character’s story is closed or uses an older edition. Keep the archive or start a new chapter on this device.',
    );
  if (canonicalPersona(preparePersonaLife(parent, input.clockMs).life) !== canonicalPersona(input.life))
    throw new Error('This person’s history does not match the time recorded in the file.');
  const opening = gardenOpening(id, seed);
  let person: Person;
  if (parent.transfer.castPassport === 'authored-cast/1') person = opening;
  else {
    const own = parent.source.game === 'hearsay' && parent.transfer.castPassport === 'hearsay-cast/1';
    const voice =
      parent.source.game === 'voice' &&
      parent.transfer.castPassport === 'site-cast/1' &&
      (id === 'riza' || id === 'osman') &&
      GARDEN_ADAPTERS.voice[id] === parent.castId;
    if ((!own && !voice) || parent.transfer.sourceRole !== id)
      throw new Error(
        'Hearsay has no semantic adapter to carry this person’s saved history into the garden. Keep the original chapter or start a new chapter on this device.',
      );
    const portable = validateCalendarPersona(parent.transfer.person);
    const checkpoint = parent.transfer.checkpoint as
      | { schema: unknown; sourceMinute: unknown; rng: unknown; sha256: string }
      | undefined;
    if (
      !['2.17.0', '2.21.0', '2.23.0'].includes(parent.source.engine) ||
      (own && parent.source.engine === '2.23.0' && parent.source.rules !== 'hearsay-cast-6') ||
      portable.person.source.engine !== parent.source.engine ||
      !checkpoint ||
      checkpoint.schema !== portable.person.source.schema ||
      checkpoint.sourceMinute !== portable.person.source.now ||
      canonicalPersona(checkpoint.rng) !== canonicalPersona(portable.person.rng) ||
      !/^[a-f0-9]{64}$/.test(checkpoint.sha256) ||
      portable.person.source.id !== id ||
      portable.person.mappingVersion !== (voice ? 'site-cast-calendar/1' : 'hearsay-calendar/1')
    )
      throw new Error(
        'The file lacks a valid receipt for the complete saved person, or its rules for carrying that person into the garden are incompatible.',
      );
    for (const n of portable.calendar.norms)
      if (!DEFAULT_NORMS.some((known) => canonicalPersona(known) === canonicalPersona(n)))
        throw new Error('The original game uses a rule about conduct whose meaning Hearsay cannot verify.');
    for (const c of [...portable.calendar.commitments, ...portable.calendar.owed]) {
      if ([...c.actions, ...(c.violatedBy ?? [])].some((a) => !calendarActions.has(a)))
        throw new Error(
          'A duty from the original game requires an action that is unavailable in the garden.',
        );
      if (
        'targetId' in c &&
        c.targetId &&
        c.targetId !== 'self' &&
        !GARDEN_IDS.includes(c.targetId as GardenPerson)
      )
        throw new Error('A duty requires a person who remains in the original game.');
      if ('toId' in c && c.toId && c.toId !== 'self' && !GARDEN_IDS.includes(c.toId as GardenPerson))
        throw new Error('This person owes an obligation to someone outside this chapter.');
    }
    const age = portable.person.source.now - portable.person.life.bornAt;
    if (age < canonical.age * 525600 || age > (canonical.age + 200) * 525600)
      throw new Error('This person’s age is outside the supported range.');
    const source = own ? archives.find((a) => a.digest === checkpoint.sha256 && a.person === id) : undefined;
    if (own && !source)
      throw new Error(
        'The original Hearsay archive is unavailable on this device. Keep the original game’s saved files or start a new chapter here.',
      );
    // Full Hearsay source state is recovered only from its matching local prefix. Voice's
    // unsupported social memories/market skill remain in the named source archive.
    if (
      source &&
      canonicalPersona(projectGardenPerson(source.prefix.people[id])) !== canonicalPersona(portable)
    )
      throw new Error('The saved original chapter does not match the person’s passport.');
    const target = opening;
    target.now = 360;
    target.life.bornAt = portable.person.life.bornAt + 360 - portable.person.source.now;
    target.body.fitness = portable.person.health.fitness;
    const shifted = shiftCalendar(portable, 360);
    const omitted = Object.keys(shifted.person.skills).filter((skill) => id !== 'osman' || skill !== 'trade');
    for (const skill of omitted) delete shifted.person.skills[skill];
    if (omitted.length)
      shifted.person.limitations.push(
        `Voice source archive retains unmapped skills: ${omitted.join(', ')}. No garden trade qualification granted.`,
      );
    // Calendar replacement only on this detached, validated new opening. No source duty is cleared.
    target.agenda.commitments = [];
    delete target.agenda.owed;
    delete target.agenda.lapse;
    const admitted = admitCalendarPersona(shifted, target, {
      mappingVersion: voice ? 'site-cast-calendar/1' : 'hearsay-calendar/1',
      sourceId: id,
      targetId: id,
      targetNorms: portable.calendar.norms,
    }).person;
    if (source) {
      // Versioned same-host zero-duration clock translation. Retain the complete
      // source Person, including beliefs, social stores, needs and episodes.
      const retained = shiftSourcePerson(source.prefix.people[id], 360 - portable.person.source.now);
      retained.agenda.commitments = admitted.agenda.commitments;
      if (admitted.agenda.owed) retained.agenda.owed = admitted.agenda.owed;
      else delete retained.agenda.owed;
      if (admitted.agenda.lapse) retained.agenda.lapse = admitted.agenda.lapse;
      else delete retained.agenda.lapse;
      retained.conscience.norms = admitted.conscience.norms;
      person = restore(retained);
      if (canonicalPersona(person) !== canonicalPersona(retained))
        throw new Error(
          'Hearsay cannot adjust the complete saved person to the garden’s clock without changing other information. Keep the original chapter.',
        );
    } else person = admitted;
  }
  const admission = lifeAdmission(input, 'hearsay');
  person.agenda.goals.push({
    id: `life-work:${input.life.clock.watermark}`,
    label: admission.assignment,
    serves: ['competence'],
    advancedBy: [
      { action: id === 'hatice' ? 'chat' : id === 'osman' ? 'work-market' : 'work', amount: 0.25 },
    ],
    importance: 0.25,
    progress: 0,
    status: 'active',
    adoptedAt: person.now,
  });
  for (const event of input.life.events.filter((e) => e.kind === 'contact')) {
    const peer = canonicalCast(event.detail);
    person.memory.episodes.push({
      id: `cast-note:${parent.branchId}:${event.slot}`,
      at: person.now,
      kind: 'cast-notice',
      actorId: peer.castId,
      valence: 0,
      salience: 0.4,
      summary: `${person.name} read ${peer.name}’s public work note: ${peer.work}. This grants no reciprocal familiarity.`,
      tags: ['social', 'work'],
    });
  }
  return person;
}
export async function captureGardenSource(g: GardenRun, id: GardenPerson) {
  const departure = prepareGardenDeparture(g, id),
    raw = snapshot(departure.person);
  const person = projectGardenPerson(raw);
  const digest = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalPersona(raw)))),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
  return {
    transfer: {
      castPassport: 'hearsay-cast/1',
      sourceRole: id,
      person,
      checkpoint: { schema: raw.schema, sourceMinute: raw.now, rng: raw.rng, sha256: digest },
    },
    archive: { digest, prefix: departure.sourcePrefix, person: id } satisfies SourceArchive,
    limitations: [
      `Full Hearsay source prefix retained locally; ${person.person.limitations.length} detailed projection omissions remain in the passport and archive.`,
      ...departure.limitations,
    ].map((line) => line.slice(0, 500)),
  };
}

/** Exact HF2.17 Person timestamp fields. Durations and time-of-day values never shift. */
function shiftSourcePerson(source: Person, offset: number): Person {
  const fields = new Set([
    'now',
    'at',
    'since',
    'from',
    'to',
    'until',
    'tendedAt',
    'lastAt',
    'lastUpdated',
    'checkedAt',
    'lastBreakAt',
    'lastPracticed',
    'lastWithheldAt',
    'recalledAt',
    'updatedAt',
    'firstAt',
    'lastInteraction',
    'deceasedAt',
    'seenAt',
    'recurUntil',
    'adoptedAt',
    'deadline',
    'lastAdvancedAt',
    'lapseSince',
    'lastWornAt',
    'startedAt',
    'chargedAt',
    'endedAt',
    'agedTo',
    'bornAt',
    'endsAt',
    'reviewAt',
    'thresholdAt',
    'conceivedAt',
    'dueAt',
    'engagedAt',
    'availableFrom',
    'availableUntil',
    'expiresAt',
    'receivedAt',
    'triggeredAt',
    'lastUsedAt',
  ]);
  const walk = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(walk)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value).map(([key, child]) => [
              key,
              fields.has(key) && typeof child === 'number' ? child + offset : walk(child),
            ]),
          )
        : value;
  return walk(snapshot(source)) as Person;
}
