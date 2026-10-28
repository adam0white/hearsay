/** HF4 garden edition. HF owns actors; this host records actual garden outcomes. */
import { inspect, type PersonAuthoring } from '@adam0white/human-framework';
import { canonicalCast } from '@adam0white/lab-client';
import { GARDEN_CAST, GARDEN_IDS, type GardenPerson, gardenLocation } from './garden-cast.ts';
import { type GardenConfig, gardenConversation, validateGardenConfig } from './garden-dialogue.ts';
import {
  advanceGardenSession,
  authorGardenPerson,
  beliefEvidence,
  checkpointGardenSession,
  converseGarden,
  createGardenSession,
  decideGardenAction,
  type GardenActor,
  type GardenCheckpoint,
  type GardenOffer,
  type GardenSession,
  gardenEvidence,
  gardenEvidenceId,
  gardenSocial,
  interruptGardenAction,
  MINUTE,
  performGardenStatement,
  restoreGardenSession,
  sessionPeople,
  trustOf,
} from './garden-hf4.ts';
import {
  actualGardenLocation,
  answerConfrontation,
  type LunchState,
  lunchOpening,
  type PlanChoice,
  planChoice,
  type ReputationTrait,
  reserveLunch,
  stakesStep,
} from './garden4-stakes.ts';
export const GARDEN_EDITION = 'hearsay-hf4/1' as const;

import type { GardenChapter } from './garden4-continuity.ts';

const sessions = new WeakMap<GardenRun, GardenSession>();
export function sessionOf(g: GardenRun): GardenSession {
  let s = sessions.get(g);
  if (!s) {
    if (!g.engine) throw Error('Missing HF4 run. Keep the file. Start fresh.');
    s = restoreGardenSession(g.engine);
    sessions.set(g, s);
  }
  return s;
}
export function refreshGarden(g: GardenRun) {
  g.people = sessionPeople(sessionOf(g)) as Record<GardenPerson, GardenActor>;
}
export function checkpointGarden(g: GardenRun) {
  g.engine = checkpointGardenSession(sessionOf(g));
  return g.engine;
}
export type GardenInput =
  | { type: 'reserve'; person: GardenPerson }
  | { type: 'plan'; choice: PlanChoice }
  | { type: 'confront'; person: GardenPerson; choice: 'own' | 'stand' }
  | { type: 'listen'; person: GardenPerson; approach: 'invite' | 'pry' }
  | { type: 'release'; person: GardenPerson }
  | { type: 'respond'; person: GardenPerson; choice: 'support' | 'keep' | 'spread' }
  | {
      type: 'tell' | 'defend' | 'ask' | 'amends';
      person: GardenPerson;
      about: GardenPerson;
      trait?: ReputationTrait;
    }
  | { type: 'silence' };
export interface GardenLine {
  at: number;
  kind: string;
  text: string;
  person?: GardenPerson;
}
export interface GardenDiscovery {
  at: number;
  fact: string;
  response?: 'support' | 'keep' | 'spread';
  outcome?: string;
}
export interface GardenRun {
  edition: 'hearsay-hf4/1';
  seed: number;
  config?: GardenConfig;
  chapter?: GardenChapter;
  lunch: LunchState;
  minute: number;
  initialPeople: PersonAuthoring[];
  engine?: GardenCheckpoint;
  people: Record<GardenPerson, GardenActor>;
  inputs: { at: number; input: GardenInput }[];
  log: GardenLine[];
  discoveries: Partial<Record<GardenPerson, GardenDiscovery>>;
  chat?: { person: GardenPerson; start: number; until: number; approach: 'invite' | 'pry' };
  benchFree: boolean;
  gardenCovered: boolean;
  released: boolean;
  ended: boolean;
  /** Received statements only. Author facts never enter this testimony queue. */
  routes: {
    id: number;
    parent?: number;
    root?: number;
    retractedAt?: number;
    contradictedAt?: number;
    confidenceOf?: GardenPerson;
    at: number;
    from: GardenPerson;
    to: GardenPerson;
    about: GardenPerson;
    prop: string;
    value: boolean;
  }[];
}

const copy = <T>(v: T): T => structuredClone(v);
const note = (g: GardenRun, kind: string, text: string, person?: GardenPerson) =>
  g.log.push({ at: g.minute, kind, text, ...(person ? { person } : {}) });
export function gardenAuthors(): PersonAuthoring[] {
  return GARDEN_IDS.map((id) => {
    const c = GARDEN_CAST[id],
      p = canonicalCast(c.castId);
    const author = authorGardenPerson(id, c.name, c.sex, c.age, { ...p.traits }, { ...p.values });
    author.identity.castId = c.castId;
    if (id === 'aylin' || id === 'dilan')
      author.state.relationships = [
        {
          otherId: id === 'aylin' ? 'dilan' : 'aylin',
          affection: 0.45,
          trust: 0.65,
          respect: 0.2,
          familiarity: 0.85,
          roles: ['sibling'],
          ledger: 0,
          lastInteraction: 360 * MINUTE,
        },
      ];
    return author;
  });
}
export function freshGarden(
  seed: number,
  admitted: PersonAuthoring[] = gardenAuthors(),
  chapter?: GardenChapter,
  config?: GardenConfig,
): GardenRun {
  validateGardenConfig(config);
  const session = createGardenSession(seed, admitted);
  const g: GardenRun = {
    edition: GARDEN_EDITION,
    seed,
    ...(config ? { config: copy(config) } : {}),
    lunch: lunchOpening(),
    minute: 360,
    initialPeople: copy(admitted),
    ...(chapter ? { chapter: copy(chapter) } : {}),
    people: sessionPeople(session) as Record<GardenPerson, GardenActor>,
    inputs: [],
    log: [
      {
        at: 360,
        kind: 'opening',
        text: 'Your goal is to serve a paid workers’ lunch on Day 13. Agree on supplies on Day 4 and paid cooking on Day 8. You need at least four reservations, both deliveries and completed paid preparation. Anyone may sit on the gate bench without buying.',
      },
    ],
    discoveries: {},
    routes: [],
    benchFree: false,
    gardenCovered: false,
    released: false,
    ended: false,
  };
  sessions.set(g, session);
  session.available = (id, o, stage) => {
    if (stage === 'interrupt') return true;
    if (o.actionId === 'chat') {
      const partner = o.target as GardenPerson;
      return (
        gardenHere(g, id as GardenPerson) &&
        !!partner &&
        gardenHere(g, partner) &&
        actualGardenLocation(g, id as GardenPerson) === actualGardenLocation(g, partner)
      );
    }
    return true;
  };
  session.attending = (a, b) =>
    gardenHere(g, a as GardenPerson) &&
    gardenHere(g, b as GardenPerson) &&
    actualGardenLocation(g, a as GardenPerson) === actualGardenLocation(g, b as GardenPerson);
  return g;
}
export function gardenHere(g: GardenRun, id: GardenPerson): boolean {
  return (
    ['garden', 'fountain'].includes(actualGardenLocation(g, id)) &&
    g.people[id].body.alive &&
    !g.people[id].body.asleep
  );
}
function endChat(g: GardenRun, completed: boolean) {
  const c = g.chat;
  if (!c) return;
  if (!completed) {
    interruptGardenAction(sessionOf(g), c.person);
    if (c.person !== 'hatice') interruptGardenAction(sessionOf(g), 'hatice');
    refreshGarden(g);
  }
  if (completed && c.approach === 'invite') {
    if (!g.discoveries[c.person]) {
      g.discoveries[c.person] = { at: g.minute, fact: GARDEN_CAST[c.person].fact };
      note(g, 'confidence', GARDEN_CAST[c.person].fact, c.person);
    } else
      note(g, 'conversation', 'You finish the quiet conversation. What was shared stays private.', c.person);
  } else
    note(
      g,
      'interrupted',
      'The conversation stopped before a private matter was shared. You learned nothing private.',
      c.person,
    );
  delete g.chat;
}
function testimony(
  g: GardenRun,
  from: GardenPerson,
  to: GardenPerson,
  about: GardenPerson,
  value: boolean,
  trait: ReputationTrait = 'reliable',
  confidenceOf?: GardenPerson,
) {
  const session = sessionOf(g);
  const prop = `${about}:${trait}`;
  if (from === 'hatice') {
    const credence = 1 / (1 + Math.exp(-beliefEvidence(g.people.hatice, prop)));
    const lie = value ? credence < 0.3 : credence > 0.7;
    const norms: NonNullable<GardenOffer['norms']> = [
      ...(lie ? [{ normId: 'lying', relation: 'violates' as const }] : []),
      ...(!value && !gardenHere(g, about) ? [{ normId: 'backbiting', relation: 'violates' as const }] : []),
    ];
    const spoken = performGardenStatement(session, from, norms);
    refreshGarden(g);
    if (!spoken) {
      note(g, 'refusal', 'Hatice does not complete the statement. No claim reaches the listener.', 'hatice');
      return false;
    }
    if (lie)
      note(
        g,
        'own-statement',
        'You do not believe this claim yourself. The listener does not know that.',
        'hatice',
      );
    const evidenceId = gardenEvidenceId(session);
    gardenEvidence(session, 'testimony.received', {
      person: to,
      evidenceId,
      teller: from,
      claims: [{ prop, value, confidence: 0.8, sourceId: from, evidenceId, provenance: [] }],
    });
    const id = g.routes.length + 1;
    g.routes.push({
      id,
      root: id,
      at: g.minute,
      from,
      to,
      about,
      prop,
      value,
      ...(confidenceOf ? { confidenceOf } : {}),
    });
    note(
      g,
      'testimony',
      `You tell ${GARDEN_CAST[to].name}: “${GARDEN_CAST[about].name} is ${value ? '' : 'not '}${trait}.” You have not proved this.`,
      to,
    );
  } else {
    const before = inspect(session.run, {
      perspective: { kind: 'person', observer: to },
      people: [to],
      select: ['events'],
    });
    const known = new Set(before.ok ? before.value.events.map((e) => e.id) : []);
    converseGarden(session, from, to, [about], 1);
    const after = inspect(session.run, {
      perspective: { kind: 'person', observer: to },
      people: [to],
      select: ['events'],
    });
    if (!after.ok) throw Error(after.error.message);
    for (const e of after.value.events) {
      if (known.has(e.id) || e.data.kind !== 'claim-heard') continue;
      const c = e.data.claim;
      const target = c.prop.split(':')[0] as GardenPerson;
      if (!GARDEN_IDS.includes(target)) continue;
      const parent = g.routes.findLast(
        (r) => r.to === from && r.prop === c.prop && r.value === c.value && !r.retractedAt,
      );
      const id = g.routes.length + 1;
      g.routes.push({
        id,
        ...(parent ? { parent: parent.id } : {}),
        root: parent?.root ?? parent?.id ?? id,
        at: g.minute,
        from,
        to,
        about: target,
        prop: c.prop,
        value: c.value,
        ...(parent?.confidenceOf ? { confidenceOf: parent.confidenceOf } : {}),
      });
      note(
        g,
        'talk',
        `${GARDEN_CAST[from].name} tells ${GARDEN_CAST[to].name}: “${GARDEN_CAST[target].name} is ${c.value ? '' : 'not '}${c.prop.split(':')[1]}.” This is a claim, not proof.`,
        from,
      );
    }
  }
  refreshGarden(g);
  return true;
}
function dailyPerson(minute: number): GardenPerson {
  return GARDEN_IDS[Math.floor(minute / 1440) % 8]!;
}
export function chooseGarden(g: GardenRun, input: GardenInput): boolean {
  if (g.ended || !input || typeof input !== 'object') return false;
  if ('person' in input && !GARDEN_IDS.includes(input.person)) return false;
  if ('about' in input && !GARDEN_IDS.includes(input.about)) return false;
  if (g.chat && !['release', 'silence'].includes(input.type)) return false;
  if (input.type === 'reserve') {
    if (!gardenHere(g, input.person) || !reserveLunch(g, input.person)) return false;
  } else if (input.type === 'plan') {
    if (!planChoice(g, input.choice)) return false;
  } else if (input.type === 'confront') {
    if (
      !gardenHere(g, input.person) ||
      !['own', 'stand'].includes(input.choice) ||
      !answerConfrontation(g, input.person, input.choice)
    )
      return false;
  } else if (input.type === 'listen') {
    if (!['invite', 'pry'].includes(input.approach) || g.chat || !gardenHere(g, input.person)) return false;
    const p = g.people[input.person];
    if (p.activity && !['rest', 'eat', 'drink'].includes(p.activity.action)) return false;
    if (input.person !== 'hatice' && g.people.hatice.activity?.action === 'chat') return false;
    if (input.person !== 'hatice' && g.people.hatice.activity) {
      interruptGardenAction(sessionOf(g), 'hatice');
      refreshGarden(g);
    }
    if (p.activity) {
      interruptGardenAction(sessionOf(g), input.person);
      refreshGarden(g);
    }
    const offers: GardenOffer[] = [
      {
        id: 'leave',
        action: 'rest',
        label: 'Keep my own time',
        duration: 15,
        effort: 0,
        advertises: { autonomy: 0.01 },
      },
    ];
    if (input.approach === 'invite')
      offers.push({
        id: 'talk',
        action: input.person === 'hatice' ? 'reflect' : 'chat',
        label: 'Choose a quiet conversation',
        duration: 15,
        effort: 0.01,
        ...(input.person === 'hatice' ? {} : { targetId: 'hatice', with: ['hatice'] }),
        placeId: gardenLocation(input.person, g.minute),
        advertises: { belonging: 0.15, meaning: 0.1 },
      });
    const d = decideGardenAction(sessionOf(g), input.person, offers);
    refreshGarden(g);
    if (d.chosen !== 'talk')
      note(g, 'refusal', `${p.name} chooses to keep this private for now.`, input.person);
    else {
      if (input.person !== 'hatice') {
        decideGardenAction(sessionOf(g), 'hatice', [
          {
            id: 'hatice-chat',
            action: 'chat',
            label: 'Listen together',
            duration: 15,
            effort: 0.01,
            targetId: input.person,
            with: [input.person],
            advertises: { belonging: 0.15 },
          },
        ]);
        refreshGarden(g);
      }
      g.chat = { person: input.person, start: g.minute, until: g.minute + 16, approach: input.approach };
      note(
        g,
        'chat',
        `${p.name} agrees to a quiet conversation. Either of you may leave before it finishes.`,
        input.person,
      );
    }
  } else if (input.type === 'release') {
    if (g.chat?.person !== input.person) return false;
    endChat(g, false);
  } else if (input.type === 'respond') {
    const d = g.discoveries[input.person];
    if (
      !['support', 'keep', 'spread'].includes(input.choice) ||
      !d ||
      d.response ||
      !gardenHere(g, input.person)
    )
      return false;
    const audience = GARDEN_IDS.find((id) => id !== 'hatice' && id !== input.person && gardenHere(g, id));
    if (input.choice === 'spread' && !audience) return false;
    if (
      input.choice === 'spread' &&
      audience &&
      !testimony(
        g,
        'hatice',
        audience,
        input.person,
        false,
        input.person === 'osman' || input.person === 'nermin' ? 'honest' : 'kind',
        input.person,
      )
    ) {
      // A refused attempt remains an ordered player input, without disclosure or its consequences.
      refreshGarden(g);
      g.inputs.push({ at: g.minute, input: copy(input) });
      return true;
    }
    d.response = input.choice;
    const p = g.people[input.person];
    if (input.choice === 'support') {
      d.outcome = GARDEN_CAST[input.person].repair;
      if (input.person === 'ece') g.benchFree = true;
      gardenSocial(sessionOf(g), input.person, 'hatice', { kind: 'help', byMe: false, magnitude: 0.2 });
      refreshGarden(g);
    } else if (input.choice === 'keep') d.outcome = GARDEN_CAST[input.person].refusal;
    else {
      if (!audience) throw new Error('Garden spread requires its checked audience.');
      d.outcome =
        input.person === 'hatice'
          ? 'You share a private matter from your own past at the next table. You add an unkind claim about yourself.'
          : `You repeat something told to you in private at the next table. ${p.name} hears you. ${GARDEN_CAST[input.person].sex === 'male' ? 'He' : 'She'} stops trusting you with private matters.`;
      gardenSocial(
        sessionOf(g),
        input.person,
        'hatice',
        { kind: 'conflict', byMe: false, magnitude: 0.3 },
        0.6,
      );
      refreshGarden(g);
      note(
        g,
        'private-breach',
        `${GARDEN_CAST[audience].name} hears you repeat this private information: ${d.fact} You use this private information to judge ${GARDEN_CAST[input.person].name} unkindly. It is not proof of character.`,
        audience,
      );
    }
    note(g, 'response', d.outcome, input.person);
  } else if (input.type === 'silence') {
    note(g, 'silence', 'You pour tea without sharing news. Nobody has to tell you anything.');
  } else if (['tell', 'defend', 'ask', 'amends'].includes(input.type) && 'about' in input) {
    const trait = input.trait ?? 'reliable';
    if (!['honest', 'reliable', 'kind', 'generous'].includes(trait)) return false;
    if (input.person === 'hatice' || input.person === input.about || !gardenHere(g, input.person))
      return false;
    if (input.type === 'ask') {
      const p = g.people[input.person],
        prop = `${input.about}:${trait}`;
      const belief = beliefEvidence(p, prop);
      const source = p.memory.beliefs.find((b) => b.prop === prop)?.sources.at(-1);
      const origin = source
        ? source.id === input.person || source.id === 'self'
          ? 'I saw what happened myself.'
          : GARDEN_IDS.includes(source.id as GardenPerson)
            ? `${GARDEN_CAST[source.id as GardenPerson].name} told me about it.`
            : 'I heard it in an earlier chapter. The details remain in that chapter.'
        : 'Nobody has told me about it.';
      // Public concerns give an uncertain answer a personal subject without awarding a confidence.
      const publicConcern: Record<Exclude<GardenPerson, 'hatice'>, string> = {
        derya: 'I work nights. I need somewhere quiet after my shift.',
        dilan: 'I have deliveries to finish. I want a break without another errand.',
        nermin: 'I spend my day arranging work for other people. I want time to think about my own work.',
        aylin: 'I cook at the school. My evenings are not another shift.',
        ece: 'I want somewhere to sit between deliveries without having to buy anything.',
        riza: 'I help deliver bread. I would like to talk about something besides work.',
        osman: 'I supply produce. A written order matters more to me than praise.',
      };
      const uncertain = belief >= -0.85 && belief <= 0.85;
      const invitation =
        uncertain && !g.discoveries[input.person]
          ? ` Choose “Invite a quiet conversation” to listen to ${GARDEN_CAST[input.person].sex === 'male' ? 'him' : 'her'}.`
          : '';
      note(
        g,
        'answer',
        `${GARDEN_CAST[input.person].name}: “${belief > 0.85 ? 'What I have heard makes me think' : belief < -0.85 ? 'What I have heard makes me doubt that' : 'I have not heard enough to judge whether'} ${GARDEN_CAST[input.about].name} is ${trait}. ${origin} ${g.config ? gardenConversation(g, input.person) : uncertain ? publicConcern[input.person] : `Ask ${GARDEN_CAST[input.about].sex === 'male' ? 'him' : 'her'} directly.`}”${invitation}`,
        input.person,
      );
    } else if (input.type === 'amends') {
      const routes = g.routes.filter(
        (r) =>
          r.from === 'hatice' &&
          r.to === input.person &&
          r.about === input.about &&
          r.prop === `${input.about}:${trait}` &&
          !r.value &&
          !r.retractedAt,
      );
      if (!routes.length) return false;
      const p = g.people[input.person],
        prop = `${input.about}:${trait}`;
      // HF withdraws this listener's retained source account for this proposition.
      // It neither confirms the opposite nor retracts another person's repetition.
      // An evicted source has no separately withdrawable contribution in HF's bounded history.
      const contribution = p.memory.beliefs
        .find((b) => b.prop === prop)
        ?.sources.find((s) => s.id === 'hatice');
      if (contribution?.value === false && contribution.contribution !== undefined)
        gardenEvidence(sessionOf(g), 'testimony.withdrawn', {
          person: input.person,
          evidenceId: gardenEvidenceId(sessionOf(g)),
          sourceId: 'hatice',
          prop,
        });
      for (const r of routes) r.retractedAt = g.minute;
      gardenSocial(
        sessionOf(g),
        input.person,
        'hatice',
        { kind: 'apology', byMe: false, magnitude: 0.1 },
        0.95,
      );
      refreshGarden(g);
      note(
        g,
        'amends',
        `You tell ${p.name} that you withdraw your accusation about ${GARDEN_CAST[input.about].name} and are no longer sure. People may still have repeated the claim to others.`,
        input.person,
      );
    } else {
      const value = input.type === 'defend';
      const last = g.routes.findLast(
        (r) =>
          r.from === 'hatice' &&
          r.to === input.person &&
          r.about === input.about &&
          r.prop === `${input.about}:${trait}` &&
          !r.retractedAt,
      );
      const changed =
        last && g.log.some((l) => l.kind === 'witnessed' && l.person === input.about && l.at > last.at);
      if (last && last.value === value && !changed) return false;
      testimony(g, 'hatice', input.person, input.about, value, trait);
    }
  } else return false;
  refreshGarden(g);
  g.inputs.push({ at: g.minute, input: copy(input) });
  return true;
}

function minuteStep(g: GardenRun) {
  const session = sessionOf(g);
  const chatBefore = g.chat;
  const activeBefore = new Map(
    Object.entries(g.people)
      .filter(([, p]) => p.activity)
      .map(([id, p]) => [id, p.activity!]),
  );
  advanceGardenSession(session, g.minute);
  refreshGarden(g);
  if (g.chat) {
    const c = g.chat;
    const active = g.people[c.person].activity;
    const completedBy = (person: GardenPerson) =>
      session.host.outcomes.some(
        (o) =>
          o.person === person &&
          o.action === (person === 'hatice' && c.person === 'hatice' ? 'reflect' : 'chat') &&
          o.status === 'completed' &&
          o.start >= c.start * 60000,
      );
    const visitorDone = completedBy(c.person);
    const listenerDone = c.person === 'hatice' || completedBy('hatice');
    const available = gardenHere(g, c.person) && (c.person === 'hatice' || gardenHere(g, 'hatice'));
    if (visitorDone && listenerDone) endChat(g, available);
    else if (
      !available ||
      (!active && !visitorDone && g.minute > c.start) ||
      (c.person !== 'hatice' && !g.people.hatice.activity && !listenerDone && g.minute > c.start)
    )
      endChat(g, false);
  }
  for (const [id, earlier] of activeBefore) {
    if (
      earlier.action === 'chat' &&
      !g.people[id as GardenPerson].activity &&
      g.minute >= earlier.endsAt &&
      id !== chatBefore?.person &&
      !(chatBefore && id === 'hatice') &&
      session.host.outcomes.some((o) => o.id === earlier.id && o.status === 'completed')
    ) {
      const to = earlier.targetId as GardenPerson;
      if (to && GARDEN_IDS.includes(to) && gardenHere(g, id as GardenPerson) && gardenHere(g, to))
        testimony(g, id as GardenPerson, to, dailyPerson(g.minute), true);
    }
  }
  if (g.minute < 14 * 1440) {
    for (const id of GARDEN_IDS) {
      const p = g.people[id];
      if (p.activity || id === g.chat?.person || (id === 'hatice' && g.chat)) continue;
      const completed = session.host.outcomes.some(
        (outcome) =>
          outcome.person === id && outcome.status === 'completed' && outcome.end > (g.minute - 1) * MINUTE,
      );
      // Completion can fall milliseconds after a quarter-hour. Offer the next task
      // when that actual completion is visible, rather than waiting another quarter-hour.
      if (g.minute % 15 !== 0 && !completed) continue;
      const place = actualGardenLocation(g, id);
      const sleeping =
        place.includes('sleep') ||
        place === 'lodging' ||
        (id === 'hatice' && (g.minute % 1440 < 360 || g.minute % 1440 >= 1320));
      const offers: GardenOffer[] = [
        {
          id: 'rest',
          action: 'rest',
          label: 'Rest a little',
          duration: 15,
          effort: 0,
          advertises: { rest: 0.1, leisure: 0.02 },
        },
        { id: 'eat', action: 'eat', label: 'Eat a meal', duration: 15, advertises: { food: 0.5 } },
        { id: 'drink', action: 'drink', label: 'Drink water', duration: 15, advertises: { water: 0.5 } },
      ];
      if (sleeping)
        offers.push({
          id: 'sleep',
          action: 'sleep',
          label: 'Sleep at lodging',
          duration: 60,
          mode: 'sleep',
          advertises: { sleep: 0.5 },
        });
      else
        offers.push({
          id: 'work',
          action: id === 'osman' ? 'work-market' : 'work',
          label: GARDEN_CAST[id].job,
          duration: 15,
          effort: 0.03,
          placeId: place,
          advertises: { competence: 0.02, meaning: 0.01 },
        });
      if (id !== 'hatice' && gardenHere(g, id)) {
        const partner = GARDEN_IDS.find(
          (other) =>
            other !== id &&
            other !== g.chat?.person &&
            gardenHere(g, other) &&
            actualGardenLocation(g, other) === place &&
            !g.people[other].activity,
        );
        if (partner)
          offers.push({
            id: 'garden-chat',
            action: 'chat',
            label: `Talk with ${GARDEN_CAST[partner].name}`,
            duration: 15,
            effort: 0.01,
            targetId: partner,
            with: [partner],
            placeId: place,
            advertises: { belonging: 0.04, leisure: 0.005 },
          });
      }
      decideGardenAction(session, id, offers);
      refreshGarden(g);
    }
  }
  const t = g.minute % 1440;
  if (g.minute === 13 * 1440 + 390) {
    g.released = true;
    note(g, 'release', 'Derya’s final relief night has ended. She still needs sleep before travelling.');
  }
  stakesStep(g, (id) => gardenHere(g, id));
  if (t === 390) note(g, 'cue', GARDEN_CAST[dailyPerson(g.minute)].cue);
  if (g.minute >= 14 * 1440) {
    if (g.chat) endChat(g, false);
    g.ended = true;
    note(
      g,
      'ending',
      'The two weeks end. The garden record keeps what you heard, repeated and kept private.',
    );
  }
}
export function advanceGarden(g: GardenRun, until: number) {
  if (!Number.isSafeInteger(until) || until < g.minute || until > 14 * 1440)
    throw new Error('Invalid garden clock');
  while (g.minute < until && !g.ended) {
    g.minute++;
    minuteStep(g);
  }
}
export function replayGarden(
  seed: number,
  inputs: GardenRun['inputs'],
  minute: number,
  initial?: GardenRun['initialPeople'],
  chapter?: GardenChapter,
  config?: GardenConfig,
): GardenRun {
  const g = freshGarden(seed, initial, chapter, config);
  for (const e of inputs) {
    advanceGarden(g, e.at);
    if (!chooseGarden(g, e.input)) throw new Error('Invalid recorded garden choice');
  }
  advanceGarden(g, minute);
  return g;
}
export function gardenStanding(g: GardenRun): string {
  const here = GARDEN_IDS.filter((id) => id !== 'hatice' && gardenHere(g, id));
  return g.minute < g.lunch.closedUntil
    ? 'The garden is closed after the confrontation. No tea is sold.'
    : here.length >= 5
      ? 'People are sitting at the tables. Customers who stay pay for their tea.'
      : here.length >= 2
        ? 'A few customers remain. Empty seats bring in no money.'
        : 'The benches are empty. There are no customers to serve.';
}
