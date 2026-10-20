import type { Affordance } from '@adam0white/human-framework';
import {
  applyReputationBelief,
  begin,
  converse,
  createPerson,
  credence,
  decide,
  finish,
  believe as hfBelieve,
  confirm as hfConfirm,
  isUnfavourableTrait,
  REPUTATION_TRAITS,
  recordDeed,
  socialEvent,
  tick,
  trustOf,
  understandNorm,
} from '@adam0white/human-framework';
import type { Game, Input, LoggedInput, Route, State, Trait } from './types.ts';

export * from './types.ts';
export { PEOPLE, PLACES } from './world.ts';
export { REPUTATION_TRAITS };

import { PEOPLE, PLACES, SCHEDULES } from './world.ts';

function confirm(...args: Parameters<typeof hfConfirm>) {
  const [p, proposition, , at] = args;
  const before = credence(p, proposition);
  const result = hfConfirm(...args);
  applyReputationBelief(p, proposition, before, credence(p, proposition), at);
  return result;
}
function believe(...args: Parameters<typeof hfBelieve>) {
  const [p, proposition, , , , at] = args;
  const before = credence(p, proposition);
  const result = hfBelieve(...args);
  applyReputationBelief(p, proposition, before, credence(p, proposition), at);
  return result;
}
const good: Record<string, Trait> = {
  dishonest: 'honest',
  unreliable: 'reliable',
  stingy: 'generous',
  cruel: 'kind',
  lazy: 'hardworking',
};
const bad: Record<string, Trait> = {
  honest: 'dishonest',
  reliable: 'unreliable',
  generous: 'stingy',
  kind: 'cruel',
  hardworking: 'lazy',
};

import { hash } from './hash.ts';
import { receiveTestimony } from './testimony.ts';
import { say } from './voices.ts';

const prop = (target: string, trait: string) => `${target}:${trait}`;
export function clockOf(minute: number) {
  const d = Math.floor(minute / 1440);
  const m = minute % 1440;
  return {
    day: Math.min(14, d + 1),
    hour: Math.floor(m / 60),
    minute: m % 60,
    text: `Day ${Math.min(14, d + 1)} · ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
  };
}
function line(s: State, kind: string, text: string, speaker?: string, target?: string) {
  s.log.push({
    id: s.log.length + 1,
    at: s.minute,
    kind,
    text,
    ...(speaker ? { speaker } : {}),
    ...(target ? { target } : {}),
  });
}
function answer(s: State, id: string, detail: string, target?: string) {
  const spoken = say(s, id, 'reply', detail);
  if (spoken) line(s, 'answer', spoken, id, target);
  else
    line(
      s,
      'answer',
      `${PEOPLE.find((p) => p.id === id)?.name} considers your words. ${detail}`,
      undefined,
      target,
    );
}
export function newGame(seed: number): Game {
  const s: State = {
    version: 1,
    seed,
    minute: 360,
    people: {},
    locations: {},
    log: [],
    routes: [],
    newsWaiting: false,
    engagement: 'waiting',
    garden: 'quiet',
    custom: { kemal: 1, riza: 1, hatice: 1 },
    closedUntil: 0,
    ended: false,
    voiceUsed: {},
    called: {},
    silence: {},
    confronted: [],
    greetings: {},
  };
  for (const [i, p] of PEOPLE.entries()) {
    s.people[p.id] = createPerson({
      id: p.id,
      name: p.name,
      seed: hash(`${seed}:${p.id}`),
      now: 360,
      bornAt: -30 * 365 * 1440,
      sex: i % 2 ? 'male' : 'female',
      traits: {
        honesty: p.norm === 'forbidden' ? 0.95 : p.norm === 'disliked' ? 0.55 : 0.12,
        extraversion: 0.75,
        conscientiousness: 0.6,
      },
      norms: [
        { normId: 'backbiting', standing: p.norm, conviction: p.norm === 'forbidden' ? 1 : 0.65 },
        { normId: 'lying', standing: p.norm === 'permitted' ? 'disliked' : 'forbidden', conviction: 0.8 },
      ],
      retention: { trace: 0, chronicleDays: 2 },
    });
    understandNorm(s.people[p.id]!, 'backbiting', p.norm, p.norm === 'forbidden' ? 1 : 0.65);
    understandNorm(s.people[p.id]!, 'lying', p.norm === 'permitted' ? 'disliked' : 'forbidden', 0.8);
    s.people[p.id]!.memory.sourceTrust.hatice = 0.72;
  }
  confirm(s.people.hatice!, 'emre:honest', true, 360);
  confirm(s.people.hatice!, 'emre:reliable', true, 360);
  place(s);
  line(
    s,
    'arrival',
    'The samovar warms. Emre sets two cups aside. Rıza has still not given an answer about Elif.',
  );
  return { s, inputs: [] };
}
function place(s: State) {
  const t = s.minute % 1440;
  const slot = t < 480 ? 0 : t < 660 ? 1 : t < 780 ? 2 : t < 1020 ? 3 : t < 1140 ? 4 : t < 1260 ? 5 : 6;
  for (const p of PEOPLE) {
    let location = t < 360 || t >= 1380 ? p.home : (SCHEDULES[p.id]?.[slot] ?? p.home);
    if (location === 'home') location = p.home;
    if (p.id === 'hatice') location = 'garden';
    else if (s.called[p.id] === s.minute) location = 'garden';
    if (s.minute === 720 && p.id === 'riza') location = 'garden';
    if (
      location === 'grocer' &&
      !['kemal', 'ayse', 'murat'].includes(p.id) &&
      ['dishonest', 'cruel', 'stingy', 'unreliable'].some(
        (t) => credence(s.people[p.id]!, prop('kemal', t)) > 0.7,
      )
    )
      location = 'bakery';
    if (
      location === 'bakery' &&
      !['riza', 'elif', 'zehra'].includes(p.id) &&
      ['dishonest', 'cruel', 'stingy', 'unreliable'].some(
        (t) => credence(s.people[p.id]!, prop('riza', t)) > 0.7,
      )
    )
      location = 'grocer';
    s.locations[p.id] = location;
  }
}
export function present(s: State) {
  return PEOPLE.filter((p) => ['garden', 'fountain'].includes(s.locations[p.id]!));
}
function route(s: State, from: string, to: string, target: string, trait: Trait, lie: boolean, value = true) {
  const prior = [...s.routes]
    .reverse()
    .find((r) => r.to === from && r.target === target && r.trait === trait && r.value === value);
  const r: Route = {
    id: s.routes.length + 1,
    ...(prior ? { parent: prior.id } : {}),
    value,
    at: s.minute,
    from,
    to,
    target,
    trait,
    origin: prior?.origin ?? from,
    steps: prior?.steps ?? 0,
    lie,
  };
  const ladder: Partial<Record<Trait, Trait>> = {
    lazy: 'unreliable',
    unreliable: 'dishonest',
    stingy: 'cruel',
  };
  if (
    from !== 'hatice' &&
    s.people[from]!.traits.honesty < 0.3 &&
    r.steps < 2 &&
    value &&
    ladder[trait] &&
    hash(`${s.seed}:${s.minute}:${from}:${to}:${trait}`) % 3 === 0
  ) {
    r.trait = ladder[trait]!;
    r.steps++;
  }
  s.routes.push(r);
  return r;
}
function talk(s: State, from: string, to: string) {
  if ((s.silence[from] ?? 0) > s.minute) return;
  const a = s.people[from]!,
    b = s.people[to]!;
  const result = converse(a, b, {
    at: s.minute,
    placeId: s.locations[from],
    maxClaims: 1,
    topics: ['kemal'],
    temptations: a.traits.honesty < 0.3 ? [{ prop: 'kemal:cruel', value: true, gain: 0.9 }] : [],
  });

  for (const ev of result.socialEvents.speaker) socialEvent(a, ev);
  for (const ev of result.socialEvents.listener) socialEvent(b, ev);
  for (const c of result.claims) {
    if (c.about && c.prop.split(':')[1]) {
      const r = route(s, from, to, c.about, c.prop.split(':')[1] as Trait, c.deceit, c.value);
      if (r.trait !== c.prop.split(':')[1]) {
        for (const percept of result.told)
          for (const claim of percept.claims ?? [])
            if (claim.prop === c.prop) claim.prop = prop(c.about, r.trait);
        c.prop = prop(c.about, r.trait);
      }
    }
    if (['garden', 'fountain'].includes(s.locations[from]!)) {
      const text = say(
        s,
        from,
        'reply',
        `${PEOPLE.find((p) => p.id === c.about)?.name ?? 'Our neighbour'} ${c.value ? 'is' : 'is not'} ${c.prop.split(':')[1]}. That is what I am telling you.`,
      );
      if (text) line(s, to === 'hatice' ? 'rumour' : 'conversation', text, from, c.about);
    }
  }
  receiveTestimony(b, result.told);
  if (result.norms.length)
    recordDeed(
      a,
      {
        id: `talk:${s.minute}:${to}`,
        action: 'talk',
        label: 'Speak with a neighbour',
        duration: 1,
        effort: 0,
        advertises: { belonging: 0.05 },
        norms: result.norms,
      },
      'to share news',
      s.minute,
      true,
    );
  if (
    result.withheld.some((w) => w.reason === 'norm:backbiting') &&
    ['garden', 'fountain'].includes(s.locations[from]!)
  ) {
    const text = say(s, from, 'refusal');
    if (text) line(s, 'refusal', text, from);
  }
}
export function act(g: Game, input: Input): boolean {
  const s = g.s;
  if (s.ended) return false;
  if ('target' in input && !s.people[input.target]) return false;
  if ('trait' in input && !REPUTATION_TRAITS[input.trait]) return false;
  if (
    (input.type === 'tell' || input.type === 'defend') &&
    (input.target === input.listener || input.target === 'hatice')
  )
    return false;
  if (
    (input.type === 'tell' || input.type === 'defend') &&
    (input.target === input.listener || input.target === 'hatice')
  )
    return false;
  const idsHere = present(s).map((p) => p.id);
  if ('listener' in input && (input.listener === 'hatice' || !idsHere.includes(input.listener))) return false;
  if (input.type === 'call-over') {
    if (!idsHere.includes(input.person) || input.person === 'hatice') return false;
    s.called[input.person] = s.minute;
    s.locations[input.person] = 'garden';
    if (input.buySilence) {
      s.custom.hatice = Math.max(0, (s.custom.hatice ?? 1) - 0.15);
      s.people[input.person]!.memory.sourceTrust.hatice = Math.max(
        0,
        trustOf(s.people[input.person]!, 'hatice') - 0.04,
      );
      if (s.people[input.person]!.traits.honesty < 0.3) {
        s.silence[input.person] = (Math.floor(s.minute / 1440) + 1) * 1440;
        answer(s, input.person, 'You have paid for my tea today. I will keep your story here until morning.');
      } else answer(s, input.person, 'Keep your money. My silence is not yours to buy.');
    } else answer(s, input.person, 'I have a moment. What is it?');
  } else if (input.type === 'hold-tongue') {
    if (!s.newsWaiting) return false;
    s.newsWaiting = false;
    for (const p of idsHere)
      if (p !== 'hatice')
        s.people[p]!.memory.sourceTrust.hatice = Math.min(1, trustOf(s.people[p]!, 'hatice') + 0.015);
    s.custom.hatice = Math.max(0, (s.custom.hatice ?? 1) - 0.03);
    line(s, 'answer', 'You pour another glass. “Nothing I need to pass on.”');
  } else if (input.type === 'ask') {
    const p = s.people[input.listener]!;
    const traits = Object.keys(REPUTATION_TRAITS);
    const best = traits.sort(
      (a, b) =>
        Math.abs(credence(p, prop(input.target, b)) - 0.5) -
        Math.abs(credence(p, prop(input.target, a)) - 0.5),
    )[0]!;
    const c = credence(p, prop(input.target, best));
    answer(
      s,
      input.listener,
      Math.abs(c - 0.5) > 0.15
        ? `${PEOPLE.find((p) => p.id === input.target)?.name} ${c > 0.5 ? 'seems' : 'does not seem'} ${best}, from what I know. I could be wrong.`
        : `I do not know enough about ${PEOPLE.find((p) => p.id === input.target)?.name} to judge.`,
      input.target,
    );
  } else if (input.type === 'make-amends') {
    const p = s.people[input.listener]!;
    s.people[input.listener]!.memory.sourceTrust.hatice = Math.max(0, trustOf(p, 'hatice') - 0.06);
    const wrongs = s.routes.filter(
      (r) =>
        (r.origin === 'hatice' || r.from === 'hatice') &&
        r.target === input.target &&
        r.to === input.listener &&
        !r.retractedAt &&
        !r.retractionOf,
    );
    for (const r of wrongs) {
      believe(p, prop(r.target, r.trait), !r.value, 0.95, 'hatice', s.minute);
      r.retractedAt = s.minute;
      s.routes.push({
        id: s.routes.length + 1,
        at: s.minute,
        from: 'hatice',
        to: input.listener,
        target: r.target,
        trait: r.trait,
        value: !r.value,
        origin: 'hatice',
        steps: 0,
        lie: false,
        retractionOf: r.id,
        parent: r.id,
      });
    }
    answer(
      s,
      input.listener,
      wrongs.length
        ? `You have withdrawn these claims about ${PEOPLE.find((p) => p.id === input.target)?.name}: ${[...new Set(wrongs.map((r) => `${r.value ? '' : 'not '}${r.trait}`))].join(', ')}. I will reconsider them.`
        : `You have not given me a claim about ${PEOPLE.find((p) => p.id === input.target)?.name} to withdraw.`,
      input.target,
    );
  } else {
    const trait = input.type === 'defend' ? (good[input.trait] ?? input.trait) : input.trait;
    const own = s.people.hatice!;
    const value = !(input.type === 'defend' && trait === 'owes');
    const ownConfidence = value
      ? credence(own, prop(input.target, trait))
      : 1 - credence(own, prop(input.target, trait));
    const lie = ownConfidence <= 0.5;
    const percept = {
      at: s.minute,
      channel: 'told' as const,
      kind: 'testimony',
      actorId: 'hatice',
      targetId: input.target,
      salience: 1,
      claims: [
        {
          prop: prop(input.target, trait),
          value,
          confidence: lie ? 0.9 : ownConfidence,
        },
      ],
      summary: `Hatice says ${input.target} is ${trait}`,
      norms: [
        ...(isUnfavourableTrait(trait, value) && !idsHere.includes(input.target)
          ? [{ normId: 'backbiting', relation: 'violates' as const }]
          : []),
      ],
    };
    receiveTestimony(s.people[input.listener]!, [percept]);
    recordDeed(
      own,
      {
        id: `player:${g.inputs.length}`,
        action: 'talk',
        label: 'Tell a neighbour',
        duration: 1,
        effort: 0,
        advertises: {},
        norms: [...percept.norms, ...(lie ? [{ normId: 'lying', relation: 'violates' as const }] : [])],
      },
      lie ? 'to persuade despite my belief' : 'to tell what I believe',
      s.minute,
      true,
    );
    route(s, 'hatice', input.listener, input.target, trait, lie, value);
    line(
      s,
      'answer',
      `You tell ${PEOPLE.find((p) => p.id === input.listener)?.name}: “${PEOPLE.find((p) => p.id === input.target)?.name} ${value ? 'is' : 'is not'} ${trait}.”${lie ? ' You do not believe this yourself.' : ''}`,
      'hatice',
      input.target,
    );
    answer(s, input.listener, 'I have heard what you said.');
    s.newsWaiting = false;
    if (input.target === 'kemal' && bad[trait] === undefined && s.locations.kemal === 'grocer') {
      // The listener is choosing where to shop, based on the testimony just received.
      if (credence(s.people[input.listener]!, 'kemal:dishonest') > 0.6)
        line(
          s,
          'cold-greeting',
          `${PEOPLE.find((p) => p.id === input.listener)?.name} looks toward Kemal’s shutter and puts away the shopping bag. “I will get my flour elsewhere.”`,
          input.listener,
          'kemal',
        );
      if (input.listener === 'fatma') talk(s, 'fatma', 'emre');
    }
  }
  g.inputs.push({ at: s.minute, input: structuredClone(input) });
  return true;
}
function step(s: State) {
  // Hatice's clock follows the host; HF never chooses or advances her activity.
  s.people.hatice!.now = s.minute;
  const previousLocations = { ...s.locations };
  place(s);
  for (const p of Object.values(s.people)) {
    if (p.id === 'hatice') continue;
    tick(p, s.minute);
    if (p.activity) {
      const action = p.activity.action;
      const needs =
        action === 'eat'
          ? { food: 0.5 }
          : action === 'drink'
            ? { water: 0.5 }
            : action === 'work'
              ? { competence: 0.015, meaning: 0.01 }
              : {};
      finish(p, { affordanceId: p.activity.affordanceId, action, status: 'completed', at: s.minute, needs });
    }
    const minute = s.minute % 1440;
    const sleeping = minute >= 1380 || minute < 360;
    const offers: Affordance[] = [
      {
        id: 'rest',
        action: 'rest',
        label: 'Rest a moment',
        duration: 15,
        effort: 0,
        advertises: { rest: 0.08, leisure: 0.02 },
      },
      {
        id: 'drink',
        action: 'drink',
        label: 'Drink water',
        duration: 15,
        effort: 0,
        advertises: { water: 0.5 },
      },
      { id: 'eat', action: 'eat', label: 'Eat a meal', duration: 15, effort: 0, advertises: { food: 0.5 } },
    ];
    if (sleeping || p.body.sleepPressure > 0.85)
      offers.push({
        id: 'sleep',
        action: 'sleep',
        label: 'Sleep at home',
        duration: 15,
        effort: 0,
        mode: 'sleep',
        advertises: { sleep: 0.15 },
      });
    if (!sleeping)
      offers.push({
        id: 'work',
        action: 'work',
        label: `Keep the day's appointment at ${s.locations[p.id]}`,
        placeId: s.locations[p.id],
        duration: 15,
        effort: 0.08,
        advertises: { competence: 0.015, meaning: 0.01 },
      });
    const choice = decide(p, offers, { now: s.minute });
    const chosen = offers.find((a) => a.id === choice.chosenAffordanceId);
    if (chosen) {
      begin(p, chosen, choice);
      if (chosen.action === 'sleep')
        s.locations[p.id] = PEOPLE.find((w) => w.id === p.id)?.home ?? s.locations[p.id]!;
    }
  }
  const t = s.minute % 1440,
    day = Math.floor(s.minute / 1440);
  if (s.minute === 390) {
    s.locations.ayse = 'grocer';
    confirm(s.people.hatice!, 'kemal:dishonest', true, s.minute);
    confirm(s.people.hatice!, 'kemal:honest', false, s.minute);
    line(
      s,
      'overheard',
      'Behind the grocer’s shutter, Kemal tells Ayşe: “Mix yesterday’s old flour into the new sacks. They will not notice.” You heard him yourself.',
      'kemal',
      'kemal',
    );
  }
  if (s.minute === 405) {
    s.newsWaiting = true;
    line(s, 'question', 'Any news this morning, Hatice? You hear everything beside this fountain.', 'fatma');
  }
  if (s.minute === 420) {
    s.locations.kemal = 'fountain';
    for (const neighbour of present(s).filter((p) => p.id !== 'kemal' && p.id !== 'hatice')) {
      if (credence(s.people[neighbour.id]!, 'kemal:dishonest') > 0.6) {
        line(
          s,
          'cold-greeting',
          `${neighbour.name} answers Kemal’s morning greeting without looking at him, then turns back to the tea.`,
          neighbour.id,
          'kemal',
        );
        break;
      }
    }
  }
  if (s.minute === 720) {
    s.newsWaiting = true;
    line(
      s,
      'question',
      'Kemal is my cousin. What do you make of him, Hatice? Elif’s mother worries about the company our families keep.',
      'riza',
      'kemal',
    );
  }
  const groups = new Map<string, string[]>();
  for (const p of PEOPLE) {
    if (p.id === 'hatice') continue;
    const loc = s.locations[p.id]!;
    if (
      loc.startsWith('home') ||
      previousLocations[p.id] !== loc ||
      s.people[p.id]?.activity?.affordance.mode === 'sleep'
    )
      continue;
    const group = groups.get(loc) ?? [];
    group.push(p.id);
    groups.set(loc, group);
  }
  for (const group of groups.values()) {
    const off = (day + Math.floor(t / 15)) % group.length;
    for (let i = 0; i + 1 < group.length && i < 4; i += 2) {
      const a = group[(i + off) % group.length]!,
        b = group[(i + 1 + off) % group.length]!;
      talk(s, a, b);
    }
  }
  const visitors = present(s).filter(
    (p) =>
      p.id !== 'hatice' &&
      previousLocations[p.id] === s.locations[p.id] &&
      s.people[p.id]?.activity?.affordance.mode !== 'sleep',
  );
  if (visitors.length)
    talk(s, visitors[hash(`${s.seed}:${s.minute}:visitor`) % visitors.length]!.id, 'hatice');
  if (t === 765) {
    // Only people at the fountain actually see the helpful act.
    s.locations.kemal = 'fountain';
    for (const p of present(s)) {
      confirm(s.people[p.id]!, 'kemal:cruel', false, s.minute);
      confirm(s.people[p.id]!, 'kemal:kind', true, s.minute);
    }
    line(
      s,
      'truth',
      'Kemal carries a heavy basket up the hill for Safiye. Those at the fountain see him stop to help.',
      'kemal',
    );
  }
  if (t === 510 && day > 0) {
    for (const p of PEOPLE.filter((p) => s.locations[p.id] === 'grocer')) {
      confirm(s.people[p.id]!, 'kemal:dishonest', true, s.minute);
      confirm(s.people[p.id]!, 'kemal:honest', false, s.minute);
    }
  }
  if (t === 1080) {
    for (const id of ['kemal', 'riza']) {
      const reputation =
        PEOPLE.reduce(
          (a, p) =>
            a +
            Math.max(
              ...['dishonest', 'cruel', 'stingy', 'unreliable', 'lazy'].map((t) =>
                credence(s.people[p.id]!, prop(id, t)),
              ),
            ),
          0,
        ) / 32;
      s.custom[id] = Math.max(0.1, 1 - (reputation - 0.5) * 2);
      if (s.custom[id]! < 0.8)
        line(
          s,
          'shop',
          `${PEOPLE.find((p) => p.id === id)?.name} closes the shutters early. Fewer customers came today.`,
          id,
        );
    }
    for (const target of PEOPLE.filter((p) => p.id !== 'hatice')) {
      const heard = s.routes.find(
        (r) =>
          r.target === target.id &&
          !r.retractedAt &&
          !r.retractionOf &&
          isUnfavourableTrait(r.trait, r.value) &&
          s.locations[r.to] === s.locations[target.id] &&
          r.to !== target.id,
      );
      if (!heard) continue;
      let root = heard;
      const visited = new Set<number>();
      while (root.parent && !visited.has(root.id)) {
        visited.add(root.id);
        const parent = s.routes.find((r) => r.id === root.parent);
        if (!parent || parent.to !== root.from || parent.target !== root.target) break;
        root = parent;
      }
      if (s.confronted.includes(root.id)) continue;
      s.confronted.push(root.id);
      root.confrontedAt = s.minute;
      const offended = s.people[target.id]!;
      offended.memory.sourceTrust[root.from] = Math.max(0, trustOf(offended, root.from) - 0.12);
      socialEvent(offended, {
        at: s.minute,
        kind: 'conflict',
        otherId: root.from,
        byMe: false,
        magnitude: 0.6,
      });
      if (root.from === 'hatice') {
        s.locations[target.id] = 'garden';
        s.closedUntil = s.minute + 1440;
        for (const witness of present(s))
          s.people[witness.id]!.memory.sourceTrust.hatice = Math.max(
            0,
            trustOf(s.people[witness.id]!, 'hatice') - 0.06,
          );
        answer(
          s,
          target.id,
          `I met ${PEOPLE.find((p) => p.id === heard.to)?.name} and asked who called me ${heard.trait}. I followed each name back to you. Speak to me before you speak about me.`,
          'hatice',
        );
        line(
          s,
          'confrontation',
          `${target.name} leaves your gate. The neighbours carry their cups away. The benches will stay empty until tomorrow evening.`,
          target.id,
          'hatice',
        );
      }
    }
  }
  const fountain = PEOPLE.filter((p) => s.locations[p.id] === 'fountain');
  let greetingsShown = 0;
  for (const observer of fountain)
    for (const target of fountain) {
      if (observer.id === target.id) continue;
      const key = `${day}:${observer.id}:${target.id}`;
      const cold = ['dishonest', 'cruel', 'unreliable', 'stingy', 'lazy'].some(
        (t) => credence(s.people[observer.id]!, prop(target.id, t)) > 0.7,
      );
      if (s.greetings[key] === cold) continue;
      s.greetings[key] = cold;
      if (cold && greetingsShown < 2) {
        line(
          s,
          'cold-greeting',
          `${observer.name} passes ${target.name} without the usual greeting.`,
          observer.id,
          target.id,
        );
        greetingsShown++;
      }
    }
  const mean =
    PEOPLE.filter((p) => p.id !== 'hatice').reduce((a, p) => a + trustOf(s.people[p.id]!, 'hatice'), 0) / 31;
  const occupancy = mean * (s.custom.hatice ?? 1);
  s.garden =
    s.minute < s.closedUntil
      ? 'empty'
      : occupancy > 0.78
        ? 'full'
        : occupancy > 0.62
          ? 'lively'
          : occupancy > 0.4
            ? 'quiet'
            : 'empty';
  if (day >= 12 && t === 1200 && s.engagement === 'waiting') {
    s.locations.riza = 'garden';
    s.locations.emre = 'garden';
    const r = s.people.riza!;
    const cousin = credence(r, 'kemal:dishonest');
    const household = credence(r, 'emre:dishonest');
    s.engagement = trustOf(r, 'hatice') > 0.57 && cousin < 0.82 && household < 0.65 ? 'accepted' : 'refused';
    line(
      s,
      'engagement',
      s.engagement === 'accepted'
        ? 'Rıza sits beside Emre. “Come with your mother on Sunday. Let us talk about the wedding.”'
        : 'Rıza returns Emre’s cup untouched. “Our families should leave this here.”',
      'riza',
    );
  }
  if (s.minute >= 14 * 1440) {
    s.ended = true;
    line(
      s,
      'ending',
      'The fortnight is over. Open the notebook to follow the words you could not see travelling.',
    );
  }
}
export function advance(g: Game, toMinute: number) {
  const target = Math.min(14 * 1440, Math.max(g.s.minute, Math.floor(toMinute)));
  let next = (Math.floor(g.s.minute / 15) + 1) * 15;
  while (next <= target && !g.s.ended) {
    g.s.minute = next;
    step(g.s);
    next += 15;
  }
  g.s.minute = target;
}
export function replay(seed: number, inputs: LoggedInput[], minute: number) {
  const g = newGame(seed);
  for (const entry of inputs) {
    advance(g, entry.at);
    act(g, entry.input);
  }
  advance(g, minute);
  return g;
}
export function save(g: Game) {
  return JSON.stringify(g);
}
export function load(data: string): Game {
  const g = JSON.parse(data) as Game;
  if (g.s?.version !== 1 || !Array.isArray(g.inputs)) throw new Error('Unsupported Hearsay save');
  g.s.silence ??= {};
  g.s.confronted ??= [];
  g.s.greetings ??= {};
  return g;
}
export function fingerprint(s: State) {
  return hash(JSON.stringify(s)).toString(16).padStart(8, '0');
}
export function view(s: State) {
  return {
    minute: s.minute,
    people: PEOPLE.map((p) => ({ id: p.id, name: p.name, job: p.job, place: s.locations[p.id]! })),
    present: present(s)
      .filter((p) => p.id !== 'hatice')
      .map((p) => p.id),
    lines: s.log.map((l) => ({
      n: l.id,
      minute: l.at,
      who: l.speaker ?? 'narrator',
      text: l.text,
      kind: l.kind,
    })),
    question: s.newsWaiting ? 'A neighbour is waiting for your answer.' : undefined,
    benches: s.garden,
    shutters: Object.entries(s.custom)
      .filter(([id, v]) => id !== 'hatice' && v < 0.8)
      .map(([id]) => id),
    engagement: s.engagement,
    ended: s.ended,
  };
}
