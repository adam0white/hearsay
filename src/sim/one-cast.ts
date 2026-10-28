/** Host-authored semantic boundary. Whole source worlds never enter the shared shelf. */
import {
  type Affordance,
  admitPersona,
  begin,
  createPerson,
  decide,
  finish,
  type Person,
  type PersonaProjectionSnapshot,
  projectPersona,
  snapshot,
  validatePersonaProjection,
} from '@adam0white/hf-legacy';
import {
  boundedPersonaJson,
  canonicalPersona,
  createPersona,
  type PersonaEnvelope,
  validatePersona,
} from '@adam0white/lab-client';

export const ONE_CAST_ADAPTER = 'hearsay-one-cast/1';
export const ONE_CAST = {
  'hf.cast.dilan.murmur': {
    probe: 'dilan',
    sourceGame: 'murmur',
    sourceId: 'dilan',
    targetId: 'dilan-delivery',
    incoming: 'murmur-hearsay/1',
    returning: 'hearsay-murmur/1',
    age: 33,
    factKind: 'delivery-work',
  },
  'hf.cast.derya.stairwell': {
    probe: 'derya',
    sourceGame: 'stairwell',
    sourceId: 'derya',
    targetId: 'derya',
    incoming: 'stairwell-hearsay/1',
    returning: 'hearsay-stairwell/1',
    age: 44,
    factKind: 'night-work',
  },
} as const;
/** Authored visitor opening. Imported runs retain the exact source birth clock via the supplied projection. */
export function makeDilanOpening(seed: number, minute = 420, projection?: PersonaProjectionSnapshot): Person {
  const person = createPerson({
    id: 'dilan-delivery',
    lexicon: { plainEnglish: true },
    name: 'Dilan',
    seed,
    now: minute,
    bornAt: projection ? projection.life.bornAt + minute - projection.source.now : -33 * 365 * 1440,
    sex: 'female',
    traits: {
      honesty: 0.68,
      conscientiousness: 0.48,
      emotionality: 0.62,
      extraversion: 0.45,
      agreeableness: 0.6,
    },
  });
  if (projection) {
    if (projection.family) person.family = structuredClone(projection.family);
    if (projection.bonds) person.bonds = structuredClone(projection.bonds);
  }
  return person;
}
export type OneCastId = keyof typeof ONE_CAST;
export interface OneCastFact {
  id: string;
  kind: 'delivery-work' | 'night-work' | 'private-disclosure' | 'hearsay-encounter';
  sourceGame: string;
  episodeId: string;
  disclosed: boolean;
  outcome?: string;
}
export interface OneCastCheckpoint {
  sourceSchema: Person['schema'];
  sourceNow: number;
  sourceRng: Person['rng'];
  checkpointDigest: string;
}
export interface OneCastAdmission {
  adapter: typeof ONE_CAST_ADAPTER;
  mapping: string;
  targetBuild: string;
  openingMinute: number;
  castId: OneCastId;
  envelope: PersonaEnvelope;
  /** Complete detached initial Person, used directly by replay. */
  person: Person;
  history: OneCastFact[];
  checkpoint: OneCastCheckpoint;
  limitations: string[];
}
export type OneCastRow = {
  v: 1;
  probe: 'dilan' | 'derya';
  arm: 'fresh' | 'biography' | 'continuing';
  scope: 'shared' | 'local' | 'file';
  castId: string;
  branchId: string;
  revision: string;
  parentRevision: string | null;
  stage: string;
  outcome: string;
};
export type ContinuityEntry = {
  admission: OneCastAdmission;
  head: PersonaEnvelope;
  scope: OneCastRow['scope'];
  encounter?: OneCastEncounter;
  lastCheckpoint?: Person;
};
export type ContinuityState = {
  entries: ContinuityEntry[];
  rows: OneCastRow[];
  source?: { head: PersonaEnvelope; scope: 'shared' | 'local' | 'file'; lastCheckpoint?: Person };
};
function envelopeOmissions(lines: string[]): string[] {
  return lines.length <= 64
    ? lines
    : [
        ...lines.slice(0, 63),
        `${lines.length - 63} further omissions are listed in transfer.person.limitations; full checkpoints stay source-side.`,
      ];
}
const fail = (message: string): never => {
  throw new Error(`This person could not continue. ${message}`);
};
const hash = /^[a-f0-9]{64}$/;
const token = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
function cast(id: string): OneCastId {
  if (!Object.hasOwn(ONE_CAST, id)) fail('This character is not supported.');
  return id as OneCastId;
}
/** SHA-256 of the complete, canonical HF Person snapshot, not just its portable projection. */
export async function checkpointPerson(person: Person): Promise<OneCastCheckpoint> {
  const full = snapshot(person);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalPersona(full)));
  return {
    sourceSchema: person.schema,
    sourceNow: person.now,
    sourceRng: structuredClone(person.rng),
    checkpointDigest: [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2, '0')).join(''),
  };
}
function readHistory(value: unknown, projection: PersonaProjectionSnapshot, game: string): OneCastFact[] {
  if (!Array.isArray(value) || value.length > 8)
    fail('The history must be a list with no more than eight entries.');
  return (value as unknown[]).map((unknownFact) => {
    const f = unknownFact as OneCastFact;
    if (
      !f ||
      typeof f !== 'object' ||
      Object.keys(f).some(
        (k) => !['id', 'kind', 'sourceGame', 'episodeId', 'disclosed', 'outcome'].includes(k),
      ) ||
      !token.test(f.id) ||
      !token.test(f.episodeId) ||
      f.sourceGame !== game ||
      typeof f.disclosed !== 'boolean' ||
      !['delivery-work', 'night-work', 'private-disclosure', 'hearsay-encounter'].includes(f.kind) ||
      (f.outcome !== undefined && !token.test(f.outcome)) ||
      !projection.episodes.some((e) => e.id === f.episodeId)
    )
      fail('The history does not have valid records of what this person experienced.');
    return structuredClone(f);
  });
}
function readCheckpoint(value: unknown, projection: PersonaProjectionSnapshot): OneCastCheckpoint {
  const c = value as OneCastCheckpoint;
  if (
    !c ||
    typeof c !== 'object' ||
    Object.keys(c).sort().join(',') !== 'checkpointDigest,sourceNow,sourceRng,sourceSchema' ||
    String(c.sourceSchema) !== String(projection.source.schema) ||
    c.sourceNow !== projection.source.now ||
    canonicalPersona(c.sourceRng) !== canonicalPersona(projection.rng) ||
    !hash.test(c.checkpointDigest)
  )
    fail('The saved person’s checkpoint details are invalid.');
  return structuredClone(c);
}
/** Validate first, then claim the shelf head before starting the returned pinned run. */
export async function prepareOneCastAdmission(
  input: unknown,
  opening: Person,
  options: { targetBuild: string },
): Promise<OneCastAdmission> {
  const envelope = await validatePersona(input);
  const castId = cast(envelope.castId),
    contract = ONE_CAST[castId];
  if (
    envelope.castRevision !== '1' ||
    envelope.source.game !== contract.sourceGame ||
    !['2.14.1', '2.21.0'].includes(envelope.source.engine)
  )
    fail('The original game or character revision is not supported.');
  const allowed = ['person', 'history', 'checkpoint', 'admission', 'departure'];
  if (Object.keys(envelope.transfer).some((k) => !allowed.includes(k)))
    fail('The file contains an unsupported source transfer field.');
  const projection = validatePersonaProjection(envelope.transfer.person);
  if (
    (envelope.source.engine === '2.21.0' && projection.source.engine !== '2.21.0') ||
    projection.mappingVersion !== contract.incoming ||
    projection.source.id !== contract.sourceId ||
    projection.commitments.length ||
    Object.keys(projection.skills).length ||
    projection.episodes.length > 1
  )
    fail('The rules for carrying this person into Hearsay, or an obligation in the file, are not supported.');
  const history = readHistory(envelope.transfer.history, projection, contract.sourceGame);
  if (history.some((f) => f.kind !== contract.factKind && f.kind !== 'private-disclosure'))
    fail('The history contains a kind of fact that this character cannot carry into Hearsay.');
  const checkpoint = readCheckpoint(envelope.transfer.checkpoint, projection);
  const admitted = admitPersona(projection, opening, {
    mappingVersion: contract.incoming,
    sourceId: contract.sourceId,
    targetId: contract.targetId,
  });
  return {
    adapter: ONE_CAST_ADAPTER,
    mapping: contract.incoming,
    targetBuild: options.targetBuild,
    openingMinute: opening.now,
    castId,
    envelope: structuredClone(envelope),
    person: snapshot(admitted.person),
    history,
    checkpoint,
    limitations: admitted.report.limitations,
  };
}
export type OneCastEncounterChoice = 'support' | 'pry' | 'leave';
export interface OneCastEncounter {
  choice: OneCastEncounterChoice;
  at: number;
  accepted: boolean;
  usedFact: string | null;
  disclosedFact: string | null;
  chosenAffordance: string;
  episodeId: string | null;
  text: string;
}
/** Run ordinary HF assent. A remembered work fact changes the offer's stated meaning gain. */
export function encounterOneCast(
  initial: Person,
  admission: OneCastAdmission,
  choice: OneCastEncounterChoice,
  minute: number,
): { person: Person; encounter: OneCastEncounter } {
  if (minute < 1440 || minute < initial.now)
    fail('Play through the tea-garden loop before this conversation.');
  if (initial.id !== ONE_CAST[admission.castId].targetId || initial.activity)
    fail('The visitor has a different identity or is busy with another activity.');
  const person = snapshot(initial);
  const fact = admission.history.find((f) => f.kind === ONE_CAST[admission.castId].factKind);
  const offers: Affordance[] = [
    {
      id: 'one-cast-leave',
      action: 'leave',
      label: 'Continue to the chapter boundary',
      duration: 0,
      effort: 0,
      advertises: { autonomy: 0.015 },
    },
  ];
  if (choice !== 'leave')
    offers.push({
      id: 'one-cast-talk',
      action: 'talk',
      label: choice === 'pry' ? 'Answer a private question' : 'Share one ordinary exchange',
      duration: 0,
      effort: 0.01,
      with: ['hatice'],
      advertises:
        choice === 'support'
          ? { belonging: 0.08, meaning: fact ? 0.12 : 0.01 }
          : { belonging: -0.08, autonomy: -0.12 },
      ...(choice === 'pry' ? { norms: [{ normId: 'backbiting', relation: 'violates' as const }] } : {}),
    });
  const decision = decide(person, offers, { now: minute });
  const selected = offers.find((o) => o.id === decision.chosenAffordanceId);
  if (!selected) return fail('The simulation did not select an action for this conversation.');
  const activity = begin(person, selected, decision);
  if (!activity) fail('The simulation did not begin the selected conversation.');
  const accepted = selected.id === 'one-cast-talk';
  finish(person, {
    affordanceId: selected.id,
    action: selected.action,
    status: 'completed',
    at: minute,
    needs: selected.advertises,
    percepts: [
      {
        at: minute,
        channel: 'social',
        kind: 'one-cast-encounter',
        actorId: 'hatice',
        valence: accepted && choice === 'support' ? 0.4 : -0.1,
        salience: 1,
        summary:
          accepted && choice === 'support'
            ? 'Hatice respected my work and offered a short exchange.'
            : 'I ended the exchange and kept my boundary.',
      },
    ],
  });
  const disclosed = accepted && choice === 'support' && fact?.disclosed ? fact.id : null;
  return {
    person,
    encounter: {
      choice,
      at: minute,
      accepted,
      usedFact: choice === 'support' ? (fact?.id ?? null) : null,
      disclosedFact: disclosed,
      chosenAffordance: selected.id,
      episodeId:
        person.memory.episodes.findLast((e) => e.action === 'one-cast-encounter' && e.at === minute)?.id ??
        null,
      text:
        accepted && choice === 'support'
          ? admission.castId === 'hf.cast.dilan.murmur'
            ? 'Dilan stays for a short exchange before returning to her route.'
            : 'Derya stays for a short exchange after her night work, before going to sleep.'
          : 'She ends the exchange. Her work and private life remain hers to discuss.',
    },
  };
}
/** A return is a portable boundary receipt; the source host must have its saved departure prefix. */
export async function createOneCastReturn(
  person: Person,
  admission: OneCastAdmission,
  options: {
    targetBuild: string;
    rules?: 4 | 5;
    parentRevision: string;
    encounter: OneCastEncounter;
    assignmentEnded?: boolean;
    branchId?: string;
  },
): Promise<PersonaEnvelope> {
  if (!hash.test(options.parentRevision))
    fail('The saved story needs a valid reference before this person can return.');
  if (admission.castId === 'hf.cast.derya.stairwell' && !options.assignmentEnded)
    fail('The temporary assignment has not been released as complete.');
  if (options.encounter.at > person.now) fail('The conversation has not happened yet.');
  const contract = ONE_CAST[admission.castId];
  const episode = person.memory.episodes.findLast(
    (e) => e.action === 'one-cast-encounter' && e.at === options.encounter.at,
  );
  const projection = projectPersona(person, {
    version: contract.returning,
    skills: {},
    episodes: episode
      ? {
          [episode.id]: {
            id: 'hearsay-encounter',
            ...(episode.action ? { action: 'talk' } : {}),
            ...(episode.actorId ? { actorId: 'hearsay-hatice' } : {}),
            ...(episode.targetId ? { targetId: contract.sourceId } : {}),
            ...(episode.placeId ? { placeId: 'hearsay-tea-garden' } : {}),
            ...(episode.voiceId ? { voiceId: 'hearsay-hatice' } : {}),
            tags: [],
          },
        }
      : {},
  });
  const history: OneCastFact[] = options.encounter.episodeId
    ? [
        {
          id: 'hearsay-encounter',
          kind: 'hearsay-encounter',
          sourceGame: 'hearsay',
          episodeId: episode ? 'hearsay-encounter' : options.encounter.episodeId,
          disclosed: true,
          outcome: options.encounter.accepted ? 'accepted' : 'declined',
        },
      ]
    : [];
  const body = {
    format: 'hf-persona/1' as const,
    castId: admission.castId,
    castRevision: '1',
    branchId: options.branchId ?? admission.envelope.branchId,
    parentRevision: options.parentRevision,
    source: {
      game: 'hearsay',
      build: options.targetBuild,
      engine: person.engine,
      rules: String(options.rules ?? 5),
    },
    transfer: {
      person: projection,
      history,
      checkpoint: await checkpointPerson(person),
      admission: {
        adapter: ONE_CAST_ADAPTER,
        mapping: contract.returning,
        openingMinute: person.now,
        sourceRevision: admission.envelope.revision,
        sourceCheckpointDigest: admission.checkpoint.checkpointDigest,
      },
    },
    limitations: envelopeOmissions([
      'return requires locally saved source departure prefix; no world rewind',
      ...(!episode ? ['encounter episode no longer retained; result preserved as a host receipt only'] : []),
      ...projection.limitations,
    ]),
  };
  boundedPersonaJson(body);
  return createPersona(body);
}

/** A fresh canonical nurse may leave only after the host records the relief assignment's release. */
export async function createAuthoredDeryaCheckpoint(
  person: Person,
  options: {
    targetBuild: string;
    rules?: 4 | 5;
    branchId: string;
    parentRevision: string | null;
    assignmentEnded?: boolean;
  },
): Promise<PersonaEnvelope> {
  if (!options.assignmentEnded) fail('The temporary assignment has not been released as complete.');
  if (person.id !== 'derya' || person.name !== 'Derya' || person.life.sex !== 'female')
    fail('This legacy or incompatible version of Derya cannot enter her current official story.');
  const age = (person.now - person.life.bornAt) / (365 * 1440);
  if (age < 44 || age >= 45) fail('Derya’s age does not match her official profile.');
  const understanding = person.conscience.norms.find((n) => n.normId === 'backbiting');
  if (understanding?.standing !== 'forbidden')
    fail('Derya’s official profile requires her to regard talking behind someone’s back as forbidden.');
  const projection = projectPersona(person, { version: 'hearsay-stairwell/1', skills: {} });
  return createPersona({
    format: 'hf-persona/1',
    castId: 'hf.cast.derya.stairwell',
    castRevision: '1',
    branchId: options.branchId,
    parentRevision: options.parentRevision,
    source: {
      game: 'hearsay',
      build: options.targetBuild,
      engine: person.engine,
      rules: String(options.rules ?? 5),
    },
    transfer: {
      person: projection,
      history: [],
      checkpoint: await checkpointPerson(person),
      departure: { adapter: ONE_CAST_ADAPTER, assignmentEnded: true, minute: person.now },
    },
    limitations: envelopeOmissions([
      'fresh canonical Hearsay chapter; no prior Stairwell experience claimed',
      ...projection.limitations,
    ]),
  });
}

/** The cast fixes age and clinical health. Approved fitness and the exact birth offset travel. */
export function createOneCastOpening(castId: OneCastId, opening: Person, input: unknown): Person {
  const projection = validatePersonaProjection(input);
  const contract = ONE_CAST[castId];
  const age = (projection.source.now - projection.life.bornAt) / (365 * 1440);
  if (
    projection.source.id !== contract.sourceId ||
    projection.life.sex !== 'female' ||
    age < contract.age ||
    age >= contract.age + 1 ||
    opening.id !== contract.targetId
  )
    fail('The person’s identity does not match the required opening profile.');
  if (
    projection.health.health !== opening.body.health ||
    projection.health.circadianPeak !== opening.body.circadianPeak
  )
    fail('The person’s health or daily sleep rhythm does not match the opening profile.');
  const target = snapshot(opening);
  target.life.bornAt = projection.life.bornAt + target.now - projection.source.now;
  target.body.fitness = projection.health.fitness;
  return target;
}
