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
        text: 'The urn warms. A fortnight of tea, work and talk begins. Open a paid workers’ lunch on Day 13. Pay for a sample on Day 4, agree Aylin’s cooking terms on Day 8, and earn at least four reservations. Bread, produce, paid work and your word all matter. Free use of the gate bench stays separate from food sales.',
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
        `${c.name} finishes another quiet conversation. Earlier confidences remain private.`,
        chat.person,
      );
  } else
    note(
      g,
      'interrupted',
      'The conversation ends before the confidence is shared. You have learned no private fact.',
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
      note(g, 'refusal', `${a.name}: “They are not here to answer. I will not repeat that.”`, from);
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
        'You do not believe this claim yourself. The listener cannot see that intention.',
        'hatice',
      );
    // A chosen statement need not be the speaker's most salient existing belief.
    perceive(b, [
      {
        at: g.minute,
        channel: 'told',
        kind: 'testimony',
        summary: confidenceOf
          ? 'Hatice repeats a private confidence with an unkind inference.'
          : `Hatice gives an account of ${trait}.`,
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
      `You tell ${GARDEN_CAST[to].name}: “${GARDEN_CAST[about].name} is ${value ? '' : 'not '}${trait}.” This is your claim, not proof.`,
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
      note(
        g,
        'talk',
        `${a.name} tells ${b.name} ${claim.value ? '' : 'they doubt '}an account about ${GARDEN_CAST[target].name}.`,
        from,
      );
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
        `${p.name} keeps this private. A cup of tea does not buy an explanation.`,
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
        `${p.name} agrees to sit with you for fifteen minutes. Either of you may leave; their next duty still applies.`,
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
        'You repeat a confidence at the next table. Its owner hears you. They stop trusting this table with private matters.';
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
        `${GARDEN_CAST[audience!].name} hears you repeat: ${d.fact} You attach an unkind inference; the confidence does not prove a general character claim.`,
        audience,
      );
    }
    note(g, 'response', d.outcome, input.person);
  } else if (input.type === 'silence') {
    note(g, 'silence', 'You pour tea and let the table be quiet. Nobody owes you news.');
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
          ? 'I saw an act myself.'
          : GARDEN_IDS.includes(source.id as GardenPerson)
            ? `${GARDEN_CAST[source.id as GardenPerson].name} brought me an account.`
            : 'It came from an earlier chapter, whose full account stays there.'
        : 'Nobody has brought me an account.';
      note(
        g,
        'answer',
        `${GARDEN_CAST[input.person].name}: “${belief > 0.7 ? 'What I have heard reassures me' : belief < 0.3 ? 'What I have heard troubles me' : 'I have not heard enough to judge'} about ${GARDEN_CAST[input.about].name} being ${trait}. ${origin} Ask them directly.”`,
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
        `You withdraw your accusation about ${GARDEN_CAST[input.about].name} to ${p.name}, replacing your claim with uncertainty. Copies already passed on remain their own conversations.`,
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
      'Derya’s final relief night is over. Her next chapter must preserve her need for morning sleep. The other visitors finish their local appointments at the end of the fortnight.',
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
      'The fortnight ends. Your garden account records what you heard, what you repeated and what you left private.',
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
    ? 'The garden is closed after the confrontation; no tea is sold.'
    : here.length >= 5
      ? 'The tables are occupied. Customers who stay pay for their tea.'
      : here.length >= 2
        ? 'A few customers remain; the empty places earn nothing.'
        : 'The benches are empty. There are no customers to serve.';
}
