/** Edition 6: eight canonical people, a continuous garden and attended confidences.
 * HF owns people, conversations and their received consequences. The host owns
 * opening hours, privacy of author facts and the two-week garden account. No
 * private fact is acquired by arrival, biography import or an interrupted chat.
 */
import {
  type Affordance,
  applyReputationBelief,
  begin,
  believe,
  converse,
  credence,
  decide,
  finish,
  type NormTag,
  type Person,
  perceive,
  recordDeed,
  seedSourceTrust,
  socialEvent,
  tick,
  trustOf,
} from '@adam0white/human-framework';
import { lifeAdmission } from '@adam0white/lab-client';
import {
  GARDEN_CAST,
  GARDEN_EDITION,
  GARDEN_IDS,
  type GardenPerson,
  gardenLocation,
  gardenOpening,
} from './garden-cast.ts';
import type { GardenChapter } from './garden-continuity.ts';
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
} from './garden-stakes.ts';
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
  edition: typeof GARDEN_EDITION;
  seed: number;
  chapter?: GardenChapter;
  lunch: LunchState;
  minute: number;
  initialPeople: Record<GardenPerson, Person>;
  people: Record<GardenPerson, Person>;
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
export function freshGarden(
  seed: number,
  admitted: Partial<Record<GardenPerson, Person>> = {},
  chapter?: GardenChapter,
): GardenRun {
  const people = {} as Record<GardenPerson, Person>;
  for (const [i, id] of GARDEN_IDS.entries()) {
    const p = admitted[id] ? copy(admitted[id]) : gardenOpening(id, seed ^ (i * 997));
    if (p.id !== id || p.name !== GARDEN_CAST[id].name || p.now !== 360)
      throw new Error('Incompatible pinned garden opening');
    people[id] = p;
    // Received branch histories take precedence over authored local trust.
    if (!admitted[id] && id !== 'hatice') seedSourceTrust(p, 'hatice', 0.65);
  }
  return {
    edition: GARDEN_EDITION,
    seed,
    ...(chapter ? { chapter: copy(chapter) } : {}),
    lunch: lunchOpening(),
    minute: 360,
    people,
    initialPeople: copy(people),
    inputs: [],
    log: [
      {
        at: 360,
        kind: 'opening',
        text: 'The tea urn warms as the two weeks begin. Your goal is to serve a paid lunch for workers on Day 13. Pay for a sample on Day 4 and agree on Aylin’s cooking terms on Day 8. You need at least four meal reservations. You also need bread, produce and paid cooking work. People book based on whether they trust your word. Anyone may use the gate bench without buying food.',
      },
    ],
    discoveries: {},
    routes: [],
    benchFree: false,
    gardenCovered: false,
    released: false,
    ended: false,
  };
}
export function gardenHere(g: GardenRun, id: GardenPerson): boolean {
  return (
    ['garden', 'fountain'].includes(actualGardenLocation(g, id)) &&
    g.people[id].body.alive &&
    !g.people[id].body.asleep
  );
}
function endChat(g: GardenRun, completed: boolean) {
  const chat = g.chat;
  if (!chat) return;
  const p = g.people[chat.person];
  const activity = p.activity;
  const player = g.people.hatice;
  if (
    chat.person !== 'hatice' &&
    player.activity?.action === 'chat' &&
    player.activity.targetId === chat.person
  ) {
    const a = player.activity;
    finish(player, {
      affordanceId: a.affordanceId,
      action: 'chat',
      targetId: chat.person,
      status: completed ? 'completed' : 'interrupted',
      at: g.minute,
      needs: completed ? { belonging: 0.04, leisure: 0.01 } : {},
    });
  }
  if (activity)
    finish(p, {
      affordanceId: activity.affordanceId,
      action: activity.action,
      targetId: activity.targetId,
      status: completed ? 'completed' : 'interrupted',
      at: g.minute,
      needs: completed
        ? chat.person === 'hatice'
          ? { meaning: 0.04 }
          : { belonging: 0.04, leisure: 0.01 }
        : {},
      percepts: completed
        ? [
            {
              at: g.minute,
              channel: 'social',
              kind: 'garden-confidence',
              actorId: 'hatice',
              salience: 1,
              valence: 0.2,
              summary: `${GARDEN_CAST[chat.person].name} chose to discuss a private matter with Hatice.`,
            },
          ]
        : [],
      summary: completed
        ? 'A fifteen-minute conversation finished.'
        : 'The conversation stopped before either person finished.',
    });
  if (completed && chat.approach === 'invite') {
    const c = GARDEN_CAST[chat.person];
    if (!g.discoveries[chat.person]) {
      g.discoveries[chat.person] = { at: g.minute, fact: c.fact };
      note(g, 'confidence', c.fact, chat.person);
    } else
      note(
        g,
        'conversation',
        chat.person === 'hatice'
          ? 'You finish reflecting on your past. You keep these thoughts private.'
          : `${c.name} finishes another quiet conversation. What ${c.sex === 'male' ? 'he' : 'she'} told you earlier stays private.`,
        chat.person,
      );
  } else
    note(
      g,
      'interrupted',
      chat.person === 'hatice'
        ? 'You stop reflecting before you reach a private memory.'
        : 'The conversation ends before the person shares anything private. You have learned nothing private.',
      chat.person,
    );
  delete g.chat;
}
/** Player speech is received through the same HF testimony boundary as ambient talk. */
function testimony(
  g: GardenRun,
  from: GardenPerson,
  to: GardenPerson,
  about: GardenPerson,
  value: boolean,
  trait: ReputationTrait = 'reliable',
  confidenceOf?: GardenPerson,
) {
  const a = g.people[from],
    b = g.people[to],
    prop = `${about}:${trait}`;
  const result =
    from === 'hatice'
      ? null
      : converse(a, b, { at: g.minute, placeId: 'garden', maxClaims: 1, topics: [about] });
  for (const event of result?.socialEvents.speaker ?? []) socialEvent(a, event);
  for (const event of result?.socialEvents.listener ?? []) socialEvent(b, event);
  if (result) {
    perceive(b, result.told);
    if (result.norms.length)
      recordDeed(
        a,
        {
          id: `garden-talk:${g.minute}:${to}`,
          action: 'chat',
          label: 'Share an account',
          duration: 1,
          effort: 0,
          advertises: { belonging: 0.01 },
          norms: result.norms,
        },
        'to share news',
        g.minute,
        true,
      );
    if (result.withheld.some((w) => w.reason === 'norm:backbiting'))
      note(
        g,
        'refusal',
        `${a.name}: “${GARDEN_CAST[about].name} is not here to answer. I will not repeat that.”`,
        from,
      );
  }
  if (from === 'hatice') {
    const belief = credence(a, prop);
    const lie = value ? belief < 0.3 : belief > 0.7;
    const norms: NormTag[] = [
      ...(lie ? [{ normId: 'lying', relation: 'violates' as const }] : []),
      ...(!value && !gardenHere(g, about) ? [{ normId: 'backbiting', relation: 'violates' as const }] : []),
    ];
    if (norms.length)
      recordDeed(
        a,
        {
          id: `garden-speech:${g.inputs.length}:${to}`,
          action: 'tell',
          label: 'Give an account of a neighbour',
          duration: 1,
          effort: 0,
          advertises: {},
          norms,
        },
        'to influence what the listener believes',
        g.minute,
        true,
      );
    if (lie)
      note(
        g,
        'own-statement',
        'You do not believe this claim yourself. The listener does not know that.',
        'hatice',
      );
    // A chosen statement need not be the speaker's most salient existing belief.
    perceive(b, [
      {
        at: g.minute,
        channel: 'told',
        kind: 'testimony',
        summary: confidenceOf
          ? 'Hatice repeats something shared in private and adds an unkind conclusion.'
          : `Hatice says whether ${GARDEN_CAST[about].name} is ${trait}.`,
        actorId: from,
        salience: 1,
        claims: [{ prop, value, confidence: 0.8 }],
      },
    ]);
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
  } else
    for (const claim of result?.claims ?? []) {
      const target = claim.about as GardenPerson;
      if (!GARDEN_IDS.includes(target)) continue;
      const parent = g.routes.findLast(
        (r) => r.to === from && r.prop === claim.prop && r.value === claim.value && !r.retractedAt,
      );
      const id = g.routes.length + 1;
      g.routes.push({
        id,
        ...(parent
          ? {
              parent: parent.id,
              root: parent.root ?? parent.id,
              ...(parent.confidenceOf ? { confidenceOf: parent.confidenceOf } : {}),
            }
          : { root: id }),
        at: g.minute,
        from,
        to,
        about: target,
        prop: claim.prop,
        value: claim.value,
      });
      note(g, 'talk', `${a.name} tells ${b.name} something about ${GARDEN_CAST[target].name}.`, from);
    }
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
    if (input.person !== 'hatice' && g.people.hatice.activity) return false;
    if (p.activity) {
      if (!['rest', 'eat', 'drink'].includes(p.activity.action)) return false;
      const a = p.activity;
      finish(p, {
        affordanceId: a.affordanceId,
        action: a.action,
        status: 'interrupted',
        at: g.minute,
        needs: {},
      });
    }
    const offers: Affordance[] = [
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
        label: input.person === 'hatice' ? 'Revisit my own account' : 'Choose a quiet conversation',
        duration: 15,
        effort: 0.01,
        ...(input.person === 'hatice' ? {} : { targetId: 'hatice', with: ['hatice'] }),
        placeId: gardenLocation(input.person, g.minute),
        advertises: { belonging: 0.15, meaning: 0.1 },
      });
    const decision = decide(p, offers, { now: g.minute });
    const chosen = offers.find((a) => a.id === decision.chosenAffordanceId);
    if (!chosen || chosen.id !== 'talk') {
      note(
        g,
        'refusal',
        input.person === 'hatice'
          ? 'You choose not to reflect on this private matter now.'
          : `${p.name} keeps this private. Buying tea does not mean ${GARDEN_CAST[input.person].sex === 'male' ? 'he' : 'she'} has to explain.`,
        input.person,
      );
    } else {
      begin(p, chosen, decision);
      if (input.person !== 'hatice') {
        const player = g.people.hatice;
        const offer: Affordance = {
          ...chosen,
          id: 'hatice-chat',
          targetId: input.person,
          with: [input.person],
        };
        begin(player, offer, decide(player, [offer], { now: g.minute }));
      }
      g.chat = { person: input.person, start: g.minute, until: g.minute + 15, approach: input.approach };
      note(
        g,
        'chat',
        input.person === 'hatice'
          ? 'You take fifteen minutes to reflect on your past. You can stop early.'
          : `${p.name} agrees to sit with you for fifteen minutes. Either of you may leave. ${GARDEN_CAST[input.person].sex === 'male' ? 'He' : 'She'} must still leave in time for other plans.`,
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
    d.response = input.choice;
    const p = g.people[input.person];
    if (input.choice === 'support') {
      d.outcome = GARDEN_CAST[input.person].repair;
      if (input.person === 'ece') g.benchFree = true;
      socialEvent(p, { kind: 'help', byMe: false, otherId: 'hatice', magnitude: 0.2, at: g.minute });
    } else if (input.choice === 'keep') d.outcome = GARDEN_CAST[input.person].refusal;
    else {
      d.outcome =
        input.person === 'hatice'
          ? 'You share a private matter from your own past at the next table. You add an unkind claim about yourself.'
          : `You repeat something told to you in private at the next table. ${p.name} hears you. ${GARDEN_CAST[input.person].sex === 'male' ? 'He' : 'She'} stops trusting you with private matters.`;
      p.memory.sourceTrust.hatice = Math.max(0, trustOf(p, 'hatice') - 0.25);
      testimony(
        g,
        'hatice',
        audience!,
        input.person,
        false,
        input.person === 'osman' || input.person === 'nermin' ? 'honest' : 'kind',
        input.person,
      );
      note(
        g,
        'private-breach',
        `${GARDEN_CAST[audience!].name} hears you repeat this private information: ${d.fact} You use this private information to judge ${GARDEN_CAST[input.person].name} unkindly. It is not proof of character.`,
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
      const belief = credence(p, prop);
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
      const uncertain = belief >= 0.3 && belief <= 0.7;
      const invitation =
        uncertain && !g.discoveries[input.person]
          ? ` Choose “Invite a quiet conversation” to listen to ${GARDEN_CAST[input.person].sex === 'male' ? 'him' : 'her'}.`
          : '';
      note(
        g,
        'answer',
        `${GARDEN_CAST[input.person].name}: “${belief > 0.7 ? 'What I have heard makes me think' : belief < 0.3 ? 'What I have heard makes me doubt that' : 'I have not heard enough to judge whether'} ${GARDEN_CAST[input.about].name} is ${trait}. ${origin} ${uncertain ? publicConcern[input.person] : `Ask ${GARDEN_CAST[input.about].sex === 'male' ? 'him' : 'her'} directly.`}”${invitation}`,
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
        prop = `${input.about}:${trait}`,
        before = credence(p, prop);
      for (const r of routes) r.retractedAt = g.minute;
      believe(p, prop, true, 0.5, 'hatice', g.minute);
      applyReputationBelief(p, prop, before, credence(p, prop), g.minute);
      p.memory.sourceTrust.hatice = Math.max(0, trustOf(p, 'hatice') - 0.03);
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
  g.inputs.push({ at: g.minute, input: copy(input) });
  return true;
}
function minuteStep(g: GardenRun) {
  for (const id of GARDEN_IDS) {
    const p = g.people[id];
    if (id === 'hatice') p.now = g.minute;
    else tick(p, g.minute);
    if (id === g.chat?.person || (id === 'hatice' && g.chat)) continue;
    if (p.activity?.action === 'chat' && id !== g.chat?.person) {
      const a = p.activity;
      const partner = a.targetId as GardenPerson;
      const available =
        GARDEN_IDS.includes(partner) &&
        gardenHere(g, id) &&
        gardenHere(g, partner) &&
        actualGardenLocation(g, id) === actualGardenLocation(g, partner) &&
        partner !== g.chat?.person;
      if (!available || p.now >= a.endsAt) {
        const completed = available && p.now >= a.endsAt;
        finish(p, {
          affordanceId: a.affordanceId,
          action: 'chat',
          targetId: partner,
          status: completed ? 'completed' : 'interrupted',
          at: g.minute,
          needs: completed ? { belonging: 0.01, leisure: 0.005 } : {},
        });
        if (completed) testimony(g, id, partner, GARDEN_IDS[Math.floor(g.minute / 1440) % 8]!, true);
      }
    }
    if (p.activity && p.now >= p.activity.endsAt) {
      const a = p.activity;
      finish(p, {
        affordanceId: a.affordanceId,
        action: a.action,
        status: 'completed',
        at: g.minute,
        needs:
          a.action === 'eat'
            ? { food: 0.5 }
            : a.action === 'drink'
              ? { water: 0.5 }
              : a.action === 'rest'
                ? { rest: 0.1 }
                : {},
      });
    }
    if (id === 'hatice' || p.activity || g.minute >= 14 * 1440 || g.minute % 15 !== 0) continue;
    const place = actualGardenLocation(g, id);
    const sleeping = place.includes('sleep') || place === 'lodging';
    const offers: Affordance[] = [
      {
        id: 'rest',
        action: 'rest',
        label: 'Rest a little',
        duration: 15,
        effort: 0,
        advertises: { rest: 0.1, leisure: 0.02 },
      },
      { id: 'eat', action: 'eat', label: 'Eat a meal', duration: 15, effort: 0, advertises: { food: 0.5 } },
      {
        id: 'drink',
        action: 'drink',
        label: 'Drink water',
        duration: 15,
        effort: 0,
        advertises: { water: 0.5 },
      },
    ];
    if (sleeping)
      offers.push({
        id: 'sleep',
        action: 'sleep',
        label: 'Sleep at lodging',
        duration: 15,
        effort: 0,
        mode: 'sleep',
        advertises: { sleep: 0.2 },
      });
    else
      offers.push({
        id: 'work',
        action: id === 'osman' ? 'work-market' : 'work',
        ...(id === 'osman' && p.skills.trade ? { skill: { id: 'trade', difficulty: 0.3 } } : {}),
        label: g.chapter?.inputs.find((p) => p.parent.castId === GARDEN_CAST[id].castId)
          ? lifeAdmission(
              g.chapter.inputs.find((p) => p.parent.castId === GARDEN_CAST[id].castId)!,
              'hearsay',
            ).assignment
          : GARDEN_CAST[id].job,
        duration: 15,
        effort: 0.03,
        placeId: place,
        advertises: { competence: 0.02, meaning: 0.01 },
      });
    if (gardenHere(g, id)) {
      const rotated = [
        ...GARDEN_IDS.slice((g.minute / 15 + g.seed) % 8),
        ...GARDEN_IDS.slice(0, (g.minute / 15 + g.seed) % 8),
      ];
      const partner = rotated.find(
        (other) =>
          other !== id &&
          other !== g.chat?.person &&
          gardenHere(g, other) &&
          actualGardenLocation(g, other) === place &&
          (!g.people[other].activity || ['rest', 'drink', 'eat'].includes(g.people[other].activity!.action)),
      );
      if (partner)
        offers.push({
          id: 'garden-chat',
          action: 'chat',
          label: `Talk with ${GARDEN_CAST[partner].name}`,
          duration: 15,
          effort: 0.01,
          with: [partner],
          targetId: partner,
          placeId: place,
          advertises: { belonging: 0.04, leisure: 0.005 },
        });
    }
    // Only a received, already-held calendar creates these offers. No fresh duty is
    // invented here, and completion goes through HF's ordinary activity boundary.
    for (const c of p.agenda.commitments.filter(
      (c) => c.kind === 'worship' && c.status === 'pending' && c.from <= g.minute && c.until >= g.minute,
    )) {
      const action = c.actions.find((a) => ['pray', 'pray-home', 'pray-qada', 'pray-eid'].includes(a));
      if (action && !p.body.asleep)
        offers.push({
          id: `calendar:${c.id}`,
          action,
          label: c.label ?? 'Take a quiet moment',
          duration: 15,
          effort: 0.01,
          fulfills: [c.id],
          ...(c.targetId ? { targetId: c.targetId } : {}),
          advertises: { meaning: 0.02 },
          ...(c.normId ? { norms: [{ normId: c.normId, relation: 'fulfills' as const }] } : {}),
        });
    }
    const d = decide(p, offers, { now: g.minute });
    const selected = offers.find((a) => a.id === d.chosenAffordanceId);
    if (selected) begin(p, selected, d);
  }
  if (g.chat) {
    const c = g.chat;
    const p = g.people[c.person];
    const available =
      gardenHere(g, c.person) &&
      p.activity?.action === (c.person === 'hatice' ? 'reflect' : 'chat') &&
      !p.body.asleep &&
      (c.person === 'hatice' || g.people.hatice.activity?.targetId === c.person);
    if (!available || g.minute >= c.until) endChat(g, available && g.minute >= c.until);
  }
  const t = g.minute % 1440;
  if (g.minute === 13 * 1440 + 390) {
    g.released = true;
    note(
      g,
      'release',
      'Derya’s final night covering for another nurse is over. She will still need to sleep in the morning after leaving the garden. The other visitors finish their local appointments at the end of these two weeks.',
    );
  }
  stakesStep(g, (id) => gardenHere(g, id));
  if (t === 390) note(g, 'cue', GARDEN_CAST[GARDEN_IDS[Math.floor(g.minute / 1440) % 8]!].cue);
  if (g.minute >= 14 * 1440) {
    if (g.chat) endChat(g, false);
    g.ended = true;
    note(
      g,
      'ending',
      'The two weeks end. Your garden record shows what you heard, what you repeated and what you kept private.',
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
): GardenRun {
  const g = freshGarden(seed, initial, chapter);
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
