import type { Affordance, Percept } from '@adam0white/human-framework';
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
import type { Game, Input, Line, LoggedInput, Route, State, Trait } from './types.ts';

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
import { DAILY_INCIDENTS, storyScene } from './incidents.ts';
import { completeClaims, OPPOSITE, receiveTestimony } from './testimony.ts';
import { claimText, knownIncidentClaim, say } from './voices.ts';

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
function answer(s: State, id: string, detail: string, target?: string, reply?: Line['reply']) {
  // A voice stem is optional. The actual answer is never optional or collapsed into an echo.
  const spoken = say(s, id, 'reply', detail) ?? detail;
  line(s, reply ? 'reply' : 'answer', spoken, id, target);
  if (reply) s.log[s.log.length - 1]!.reply = reply;
}

function marriageView(s: State) {
  const r = s.people.riza!;
  const score = (trait: string) =>
    (credence(r, prop('emre', trait)) + 1 - credence(r, prop('emre', OPPOSITE[trait]!))) / 2;
  const honesty = score('honest'),
    reliability = score('reliable'),
    kindness = score('kind');
  const trust = trustOf(r, 'hatice');
  const household = PEOPLE.find((p) => p.id === 'riza')!.household;
  const traced = s.routes.some(
    (root) => root.from === 'hatice' && root.contradictedHouseholds?.includes(household),
  );
  const lean =
    traced || trust <= 0.57 || Math.min(honesty, reliability, kindness) < 0.4
      ? 'cool'
      : Math.min(honesty, reliability) > 0.65 && kindness >= 0.5 && trust > 0.65
        ? 'warm'
        : 'unsure';
  const reason = traced
    ? 'traced'
    : trust <= 0.57
      ? 'trust'
      : honesty < 0.4
        ? 'honesty'
        : reliability < 0.4
          ? 'reliability'
          : kindness < 0.4
            ? 'kindness'
            : trust <= 0.65 && Math.min(honesty, reliability) > 0.65
              ? 'cautious'
              : lean;
  const words: Record<string, string> = {
    traced:
      'A false story from you reached our house. I cannot ask Elif to join a household whose word I doubt.',
    trust: 'I am less sure of your word, Hatice. Elif would have to trust your household too.',
    honesty:
      'What I hear about Emre telling the truth troubles me. I need that settled before Elif joins your family.',
    reliability:
      'I am worried that Emre will not keep his promises to Elif. I need to see him keep his word.',
    kindness: 'I am troubled by how Emre treats people. Elif needs kindness at home.',
    cautious:
      'Emre is keeping his word. I am still cautious about your word, Hatice, and what that would mean for Elif at home.',
    warm: 'Emre is keeping his word, and I trust what you tell me. I am leaning toward the marriage.',
    unsure:
      'Emre is polite and he works. I still want to see how he keeps his word. I have not decided about the marriage.',
    cool: 'I have doubts about Emre and your household. I am leaning against the marriage.',
  };
  return {
    lean,
    reason,
    line: `${words[reason]} I will answer on Day 13.`,
    honesty,
    reliability,
    kindness,
    trust,
    traced,
  } as const;
}

function updateRiza(s: State, announce = true) {
  const next = marriageView(s);
  const old = s.riza;
  if (s.engagement !== 'waiting') {
    const accepted = s.engagement === 'accepted';
    const resolved = accepted
      ? 'I have agreed to the marriage. Come with Emre and we will plan the wedding.'
      : 'I have refused the marriage. Our families should leave this here.';
    if (s.riza?.line !== resolved)
      s.riza = { lean: accepted ? 'warm' : 'cool', line: resolved, at: s.minute, answerDay: 13 };
    return;
  }
  if (old?.line === next.line) return;
  const day = Math.floor(s.minute / 1440);
  const today = s.log.filter((l) => l.kind === 'riza' && Math.floor(l.at / 1440) === day);
  // Current state remains truthful even when an announcement is suppressed.
  s.riza = { lean: next.lean, line: next.line, at: s.minute, answerDay: 13 };
  if (today.length >= 3 || today.some((l) => l.text === next.line)) return;
  if (announce && present(s).some((p) => p.id === 'riza')) line(s, 'riza', next.line, 'riza', 'emre');
}

function avoidsShop(s: State, listener: string, target: string) {
  const workers =
    target === 'kemal' ? ['kemal', 'zehra', 'murat'] : target === 'riza' ? ['riza', 'elif', 'ayse'] : [];
  return (
    workers.length > 0 &&
    !workers.includes(listener) &&
    ['dishonest', 'cruel', 'stingy', 'unreliable'].some(
      (trait) => credence(s.people[listener]!, prop(target, trait)) > 0.6,
    )
  );
}

function reaction(
  s: State,
  listener: string,
  target: string,
  trait: Trait,
  value: boolean,
  to: number,
  before: number,
  title?: string,
  storyDetail?: string,
) {
  const p = s.people[listener]!;
  const c = credence(p, prop(target, trait));
  const confidence = value ? c : 1 - c;
  const trust = trustOf(p, 'hatice');
  const refused =
    PEOPLE.find((p) => p.id === listener)!.norm === 'forbidden' &&
    isUnfavourableTrait(trait, value) &&
    !present(s).some((p) => p.id === target);
  const believes = refused ? 'refuse' : confidence > 0.6 ? 'yes' : confidence < 0.4 ? 'no' : 'doubt';
  const assertion = storyDetail ?? claimText(PEOPLE.find((p) => p.id === target)!.name, trait, value);
  const detail = refused
    ? `They are not here to answer. Talking about their faults behind their back is wrong. ${confidence > 0.6 ? 'I believe you, but' : 'Whether it is true or not,'} I won’t repeat that.`
    : believes === 'yes'
      ? `I believe ${title ? `your account of “${title}”: ` : ''}${assertion}. ${trust > 0.6 ? 'I trust your word on this.' : 'That fits what I have heard, though I have doubts about your word.'}`
      : believes === 'no'
        ? `I don’t believe ${title ? `your account of “${title}”: ` : ''}${assertion}. ${trust < 0.6 ? 'Your word has let me down.' : 'It goes against what I have seen and heard.'}`
        : `I am not sure ${title ? `about “${title}”: ` : ''}${assertion}. ${trust < 0.6 ? 'I cannot take your word alone.' : 'I hear you, but I need more than that.'}`;
  let will: string | undefined;
  const damaging = isUnfavourableTrait(trait, value);
  const changed = Math.abs(c - before) > 0.02;
  if (refused) will = 'I won’t repeat that.';
  else if (believes === 'no') will = 'I won’t repeat that.';
  else if (changed && confidence > 0.6 && damaging && avoidsShop(s, listener, target))
    will = target === 'kemal' ? 'I’ll buy my flour elsewhere.' : 'I’ll buy my bread elsewhere.';
  else if (
    changed &&
    confidence >= 0.7 &&
    (!damaging || PEOPLE.find((p) => p.id === listener)?.norm !== 'forbidden')
  )
    will = 'I’ll pass on what you told me.';
  else if (believes === 'doubt') will = 'I won’t repeat that until I have seen more.';
  updateRiza(s, false);
  const marriage =
    listener === 'riza' && ['emre', 'hatice', 'osman'].includes(target) ? ` ${s.riza?.line ?? ''}` : '';
  answer(s, listener, `${detail}${will && !detail.includes(will) ? ` ${will}` : ''}${marriage}`, target, {
    to,
    believes,
    ...(will ? { will } : {}),
  });
  if (will?.includes('elsewhere'))
    line(
      s,
      'shop',
      `${PEOPLE.find((p) => p.id === listener)!.name} puts away the shopping bag. “${will}”`,
      listener,
      target,
    );
  if (will?.includes('elsewhere')) s.log[s.log.length - 1]!.witnessed = true;
}

function closeDay(s: State) {
  const day = Math.floor(s.minute / 1440) + 1;
  s.days ??= [];
  if (s.days.some((d) => d.day === day)) return;
  const today = s.log.filter((l) => Math.floor(l.at / 1440) + 1 === day);
  const summary: string[] = [];
  const reply = today.findLast((l) => l.kind === 'reply' && l.reply);
  if (reply) summary.push(`${PEOPLE.find((p) => p.id === reply.speaker)!.name} told you: “${reply.text}”`);
  // Only entries spoken to Hatice or staged in sight of her table are eligible.
  const seen = today.findLast(
    (l) =>
      ['cold-greeting', 'confrontation', 'truth', 'overheard'].includes(l.kind) ||
      (l.kind === 'shop' && l.witnessed === true),
  );
  if (seen) summary.push(seen.text);
  const riza = today.findLast((l) => l.kind === 'riza' || l.kind === 'engagement');
  if (riza) summary.push(`Rıza told you: “${riza.text}”`);
  if (summary.length < 2) summary.push('You have had no further answer at your table today.');
  const question =
    s.engagement !== 'waiting'
      ? 'Who will still sit with you tomorrow?'
      : day >= 12
        ? 'What will Rıza say when he gives his answer on Day 13?'
        : reply?.reply?.believes === 'doubt'
          ? 'Will someone see enough tomorrow to settle the doubt?'
          : 'What will Rıza learn about Emre and your household tomorrow?';
  s.days.push({ day, summary: summary.slice(0, 4), question });
  line(s, 'day', `${summary.join(' ')} ${question}`);
}
function rootOf(s: State, route: Route): Route {
  if (route.root) return s.routes[route.root - 1]!;
  let root = route;
  const visited = new Set<number>();
  while (root.parent && !visited.has(root.id)) {
    visited.add(root.id);
    const parent = s.routes[root.parent - 1];
    if (!parent || parent.to !== root.from || parent.target !== root.target) break;
    root = parent;
  }
  return root;
}

function contradict(s: State, listener: string, proposition: string, truth: boolean, source?: string) {
  const [target, trait] = proposition.split(':');
  for (const r of s.routes.filter(
    (r) =>
      r.to === listener &&
      r.target === target &&
      ((r.trait === trait && r.value !== truth) || (OPPOSITE[r.trait] === trait && r.value === truth)) &&
      !r.retractionOf &&
      !r.retractedAt &&
      (!source || r.from === source),
  )) {
    const root = rootOf(s, r);
    if (root.from !== 'hatice') continue;
    const household = PEOPLE.find((p) => p.id === listener)!.household;
    root.contradictedHouseholds ??= [];
    if (root.contradictedHouseholds.includes(household)) continue;
    root.contradictedHouseholds.push(household);
    root.contradictedAt ??= s.minute;
    for (const member of PEOPLE.filter((p) => p.household === household && p.id !== 'hatice'))
      s.people[member.id]!.memory.sourceTrust.hatice = Math.max(
        0,
        trustOf(s.people[member.id]!, 'hatice') - 0.18,
      );
    if (!s.confronted.includes(root.id) && !s.pendingConfrontations!.some((p) => p.root === root.id)) {
      const evening = Math.floor(s.minute / 1440) * 1440 + 1080;
      s.pendingConfrontations!.push({ root: root.id, due: evening < s.minute ? evening + 1440 : evening });
    }
    line(
      s,
      'contradiction',
      `${PEOPLE.find((p) => p.id === listener)!.name} finds that the claim about ${PEOPLE.find((p) => p.id === target)!.name} was wrong and follows its source back to Hatice. Their household no longer trusts her account.`,
      listener,
      target,
    );
  }
}

function observe(s: State, id: string, target: string, trait: Trait, truth: boolean) {
  for (const r of s.routes.filter((r) => r.to === id && r.incident && !r.confirmedAt && !r.retractedAt)) {
    const scene = storyScene(r.incident!);
    if (
      scene &&
      scene.target === target &&
      ((r.trait === trait && r.value === truth) || (OPPOSITE[r.trait] === trait && r.value !== truth))
    ) {
      r.confirmedAt = s.minute;
      if (['garden', 'fountain'].includes(s.locations[id]!))
        line(
          s,
          'confirmation',
          `“I have seen it for myself now. Your story, “${r.title}”, was true.”`,
          id,
          target,
        );
    }
  }
  confirm(s.people[id]!, prop(target, trait), truth, s.minute);
  contradict(s, id, prop(target, trait), truth);
  const opposite = OPPOSITE[trait];
  if (opposite) {
    confirm(s.people[id]!, prop(target, opposite), !truth, s.minute);
    contradict(s, id, prop(target, opposite), !truth);
  }
}

function deliver(s: State, listener: string, percepts: Percept[]) {
  const p = s.people[listener]!;
  const observed = completeClaims(percepts).flatMap((pc) =>
    (pc.claims ?? []).flatMap((c) => {
      const own = p.memory.beliefs
        .find((b) => b.prop === c.prop)
        ?.sources.find((source) => source.id === listener || source.id === 'self');
      return own && own.value !== c.value ? [{ proposition: c.prop, truth: own.value }] : [];
    }),
  );
  receiveTestimony(p, percepts, (proposition, truth, source) =>
    contradict(s, listener, proposition, truth, source),
  );
  // An account cannot displace an act the listener already witnessed.
  for (const fact of observed) {
    const [target, trait] = fact.proposition.split(':');
    observe(s, listener, target!, trait as Trait, fact.truth);
  }
}

/** Concrete speech requires first-hand knowledge of this exact witnessed act. */
export function spokenClaim(
  s: State,
  speaker: string,
  target: string,
  trait: string,
  value: boolean,
): string {
  const scene = DAILY_INCIDENTS.findLast(
    (scene) =>
      scene.target === target &&
      (scene.day - 1) * 1440 + scene.at <= s.minute &&
      ((scene.trait === trait && scene.value === value) ||
        (OPPOSITE[scene.trait] === trait && scene.value !== value)),
  );
  return scene && s.incidentWitnesses?.[scene.day]?.includes(speaker)
    ? knownIncidentClaim(scene)
    : claimText(PEOPLE.find((p) => p.id === target)?.name ?? 'Our neighbour', trait, value);
}

function visibleClaim(s: State, from: string, to: string, target: string, trait: string, value: boolean) {
  s.heardClaims ??= {};
  const spokenTrait = !value && OPPOSITE[trait] ? OPPOSITE[trait]! : trait;
  const spokenValue = !value && OPPOSITE[trait] ? true : value;
  const key = `${Math.floor(s.minute / 1440)}:${target}:${spokenTrait}:${spokenValue}`;
  s.heardClaims[key] ??= { count: 0, who: [] };
  const heard = s.heardClaims[key];
  heard.count++;
  if (!heard.who.includes(from)) heard.who.push(from);
  const account = s.routes.findLast(
    (r) => r.from === from && r.to === to && r.target === target && r.at === s.minute && r.incident,
  );
  const scene = account?.incident ? storyScene(account.incident) : undefined;
  const exactStory =
    scene &&
    ((scene.trait === trait && scene.value === value) ||
      (OPPOSITE[scene.trait] === trait && scene.value !== value));
  const claim =
    scene && exactStory
      ? `“${scene.title}”: ${'detail' in scene ? scene.detail : knownIncidentClaim(scene)}`
      : spokenClaim(s, from, target, spokenTrait, spokenValue);
  if (heard.count === 1) {
    const text = say(s, from, 'reply', `${claim}.`);
    if (text) line(s, to === 'hatice' ? 'rumour' : 'conversation', text, from, target);
    else line(s, 'conversation', `${claim}.`, from, target);
  } else {
    if (!heard.echo) {
      line(s, 'echo', '', undefined, target);
      heard.echo = s.log.length;
    }
    const echo = s.log[heard.echo - 1]!;
    echo.count = heard.count - 1;
    echo.who = [...heard.who];
    echo.text = `${claim}: heard again ${echo.count} time${echo.count === 1 ? '' : 's'} today; heard from ${heard.who.map((id) => PEOPLE.find((p) => p.id === id)!.name).join(', ')}.`;
  }
}

function confrontHatice(s: State, root: Route, recipient: string) {
  const target = PEOPLE.find((p) => p.id === root.target)!;
  const personal: Record<string, string> = {
    emre: 'Mother, you know how I work and what I return. Why did you tell people otherwise?',
    riza: 'I must be able to trust the family Elif joins. Your account did not hold up.',
    elif: 'You spoke about me without asking me. How am I meant to join your family now?',
    osman: 'We share a house, Hatice. You could have spoken to me at home.',
    kemal: 'People have stopped coming to my shop. I came to ask what you told them.',
  };
  s.locations[target.id] = 'garden';
  const spoken = say(
    s,
    target.id,
    'opening',
    personal[target.id] ??
      `I spoke to ${PEOPLE.find((p) => p.id === recipient)?.name ?? 'our neighbours'} about your account of me. You should have asked me first.`,
  );
  line(
    s,
    'confrontation',
    `${target.name} comes to your table. “${spoken ?? personal[target.id] ?? `You spoke about me as ${root.trait}. I followed that account back to you. Explain it to me here.`}” The neighbours take their cups away. The benches will stay empty for a day.`,
    target.id,
    'hatice',
  );
  s.closedUntil = Math.max(s.closedUntil, s.minute + 1440);
  for (const witness of present(s).filter((p) => p.id !== 'hatice'))
    s.people[witness.id]!.memory.sourceTrust.hatice = Math.max(
      0,
      trustOf(s.people[witness.id]!, 'hatice') - 0.06,
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
    incidentWitnesses: {},
    groundTruth: { 'emre:honest': true, 'emre:reliable': true },
    pendingConfrontations: [],
    heardClaims: {},
    stories: [],
    days: [],
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
  // Familiarity is fallible testimony, not invented firsthand evidence. People know
  // their household, nearby neighbours and the tradespeople in their daily rounds.
  for (const listener of PEOPLE) {
    for (const target of PEOPLE) {
      if (listener.id === target.id) continue;
      const family = listener.household === target.household;
      const neighbour = Math.abs(listener.household - target.household) <= 1;
      const customer = SCHEDULES[listener.id]?.includes(
        target.id === 'kemal' ? 'grocer' : target.id === 'riza' ? 'bakery' : 'none',
      );
      if (!family && !neighbour && !customer) continue;
      s.people[listener.id]!.memory.sourceTrust[`familiar:${target.id}`] = 0.85;
      for (const trait of ['reliable'] as const) {
        believe(
          s.people[listener.id]!,
          prop(target.id, trait),
          true,
          family ? 0.78 : 0.62,
          `familiar:${target.id}`,
          360,
        );
        believe(
          s.people[listener.id]!,
          prop(target.id, OPPOSITE[trait]!),
          false,
          family ? 0.78 : 0.62,
          `familiar:${target.id}`,
          360,
        );
      }
    }
  }
  believe(s.people.riza!, 'emre:honest', true, 0.6, 'familiar:emre', 360);
  believe(s.people.riza!, 'emre:dishonest', false, 0.6, 'familiar:emre', 360);
  confirm(s.people.hatice!, 'emre:kind', true, 360);
  confirm(s.people.hatice!, 'emre:honest', true, 360);
  confirm(s.people.hatice!, 'emre:reliable', true, 360);
  place(s);
  updateRiza(s, false);
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
    if (t >= 720 && t < 780 && p.id === 'riza') location = 'garden';
    if (location === 'grocer' && avoidsShop(s, p.id, 'kemal')) location = 'bakery';
    if (location === 'bakery' && avoidsShop(s, p.id, 'riza')) location = 'grocer';
    s.locations[p.id] = location;
  }
}
export function present(s: State) {
  return PEOPLE.filter((p) => ['garden', 'fountain'].includes(s.locations[p.id]!));
}
function route(s: State, from: string, to: string, target: string, trait: Trait, lie: boolean, value = true) {
  const belief = s.people[from]!.memory.beliefs.find((b) => b.prop === prop(target, trait));
  const firsthand = belief?.sources.some(
    (source) => (source.id === from || source.id === 'self') && source.value === value,
  );
  const prior =
    from === 'hatice' || firsthand
      ? undefined
      : [...s.routes]
          .reverse()
          .find(
            (r) =>
              r.to === from &&
              r.target === target &&
              !r.retractedAt &&
              !r.retractionOf &&
              ((r.trait === trait && r.value === value) ||
                (OPPOSITE[r.trait] === trait && r.value !== value)) &&
              belief?.sources.some((source) => source.id === r.from),
          );
  const r: Route = {
    id: s.routes.length + 1,
    root: prior ? rootOf(s, prior).id : s.routes.length + 1,
    ...(prior ? { parent: prior.id } : {}),
    value,
    at: s.minute,
    from,
    to,
    target,
    trait,
    origin: prior?.origin ?? from,
    steps: prior?.steps ?? 0,
    lie: lie || (prior?.lie ?? false),
  };
  const ladder: Partial<Record<Trait, Trait>> = {
    lazy: 'unreliable',
    unreliable: 'dishonest',
    stingy: 'cruel',
  };
  const bendTrait = (value ? trait : OPPOSITE[trait]) as Trait | undefined;
  if (
    from !== 'hatice' &&
    s.people[from]!.traits.honesty < 0.3 &&
    r.steps < 2 &&
    bendTrait &&
    ladder[bendTrait] &&
    hash(`${s.seed}:${s.minute}:${from}:${to}:${trait}`) % 3 === 0
  ) {
    r.trait = ladder[bendTrait]!;
    r.value = true;
    r.steps++;
  }
  if (prior?.incident) {
    r.incident = prior.incident;
    r.title = prior.title;
  }
  s.routes.push(r);
  return r;
}
function talk(s: State, from: string, to: string) {
  // Let the first witnessed incident open the morning's talk.
  if (s.minute < 390 || (s.silence[from] ?? 0) > s.minute) return;
  const a = s.people[from]!,
    b = s.people[to]!;
  const result = converse(a, b, {
    at: s.minute,
    placeId: s.locations[from],
    maxClaims: 1,
    topics: [DAILY_INCIDENTS[Math.min(13, Math.floor(s.minute / 1440))]!.target, 'emre'],
    temptations: a.traits.honesty < 0.3 ? [{ prop: 'kemal:cruel', value: true, gain: 0.9 }] : [],
  });

  for (const ev of result.socialEvents.speaker) socialEvent(a, ev);
  for (const ev of result.socialEvents.listener) socialEvent(b, ev);
  for (const c of result.claims) {
    if (c.about && c.prop.split(':')[1]) {
      const r = route(s, from, to, c.about, c.prop.split(':')[1] as Trait, c.deceit, c.value);
      if (r.trait !== c.prop.split(':')[1] || r.value !== c.value) {
        for (const percept of result.told)
          for (const claim of percept.claims ?? [])
            if (claim.prop === c.prop) {
              claim.prop = prop(c.about, r.trait);
              claim.value = r.value;
            }
        c.prop = prop(c.about, r.trait);
        c.value = r.value;
      }
    }
    if (['garden', 'fountain'].includes(s.locations[from]!))
      visibleClaim(s, from, to, c.about ?? '', c.prop.split(':')[1]!, c.value);
  }
  deliver(s, to, result.told);
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
    (input.type === 'tell' || input.type === 'defend' || input.type === 'ask') &&
    (input.target === input.listener || input.target === 'hatice')
  )
    return false;
  const story = input.type === 'tell-story' ? storyScene(input.incident) : undefined;
  if (
    input.type === 'tell-story' &&
    (!story ||
      !s.stories?.some((s) => s.id === input.incident) ||
      story.target === input.listener ||
      story.target === 'hatice')
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
    const believes = c > 0.6 ? 'yes' : c < 0.4 ? 'no' : 'doubt';
    const ownView =
      Math.abs(c - 0.5) > 0.1
        ? `${spokenClaim(s, input.listener, input.target, best, c > 0.5)}. That is what I believe.`
        : `${PEOPLE.find((p) => p.id === input.target)!.name} lives here with us. I have seen too little to be sure about that.`;
    const refusal =
      PEOPLE.find((person) => person.id === input.listener)?.norm === 'forbidden' &&
      isUnfavourableTrait(best, c > 0.5) &&
      !idsHere.includes(input.target);
    const emre = input.listener === 'riza' && input.target === 'emre';
    const detail = refusal
      ? 'They are not here to answer. I won’t talk about their faults behind their back. I won’t repeat that.'
      : emre && !s.routes.some((r) => r.to === 'riza' && r.target === 'emre')
        ? 'He’s polite, he works. I don’t know his heart.'
        : ownView;
    answer(
      s,
      input.listener,
      `${detail}${emre ? ` ${s.riza?.line ?? marriageView(s).line}` : ''}`,
      input.target,
      {
        to: g.inputs.length,
        believes: refusal ? 'refuse' : believes,
        ...(refusal ? { will: 'I won’t repeat that.' } : {}),
      },
    );
    s.newsWaiting = false;
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
        ? `You take back ${[...new Set(wrongs.map((r) => `“${claimText(PEOPLE.find((p) => p.id === r.target)!.name, r.trait, r.value)}”`))].join(' and ')}? All right. I’ll think again.`
        : `You haven’t told me anything about ${PEOPLE.find((p) => p.id === input.target)?.name} to withdraw.`,
      input.target,
    );
  } else {
    const target = input.type === 'tell-story' ? story!.target : input.target;
    const trait =
      input.type === 'tell-story'
        ? story!.trait
        : input.type === 'defend'
          ? (good[input.trait] ?? input.trait)
          : input.trait;
    const own = s.people.hatice!;
    const value = input.type === 'tell-story' ? story!.value : !(input.type === 'defend' && trait === 'owes');
    const ownConfidence = value ? credence(own, prop(target, trait)) : 1 - credence(own, prop(target, trait));
    const lie = story ? false : ownConfidence <= 0.5;
    const percept = {
      at: s.minute,
      channel: 'told' as const,
      kind: 'testimony',
      actorId: 'hatice',
      targetId: target,
      salience: 1,
      claims: [
        {
          prop: prop(target, trait),
          value,
          confidence: input.type === 'tell-story' ? 1 : lie ? 0.9 : ownConfidence,
        },
      ],
      summary: `Hatice says ${target} is ${trait}`,
      norms: [
        ...(isUnfavourableTrait(trait, value) && !idsHere.includes(target)
          ? [{ normId: 'backbiting', relation: 'violates' as const }]
          : []),
      ],
    };
    const heard = route(s, 'hatice', input.listener, target, trait, lie, value);
    if (story) {
      heard.incident = story.id;
      heard.title = story.title;
    }
    const before = credence(s.people[input.listener]!, prop(target, trait));
    deliver(s, input.listener, [percept]);
    if (story && trustOf(s.people[input.listener]!, 'hatice') > 0.1) {
      const p = s.people[input.listener]!;
      const witnessed = p.memory.beliefs
        .find((b) => b.prop === prop(target, trait))
        ?.sources.some((source) => source.id === p.id || source.id === 'self');
      if (!witnessed) {
        // Specific, checkable testimony carries more weight than a character label.
        const c = credence(p, prop(target, trait));
        const stronger = Math.min(0.98, (value ? c : 1 - c) + 0.12 * trustOf(p, 'hatice'));
        believe(p, prop(target, trait), value, stronger, 'hatice', s.minute);
        if (OPPOSITE[trait]) believe(p, prop(target, OPPOSITE[trait]!), !value, stronger, 'hatice', s.minute);
      }
    }
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
    line(
      s,
      'answer',
      `You tell ${PEOPLE.find((p) => p.id === input.listener)?.name}: “${story ? ('detail' in story ? story.detail : knownIncidentClaim(story)) : spokenClaim(s, 'hatice', target, trait, value)}.”${lie ? ' You do not believe this yourself.' : ''}`,
      'hatice',
      target,
    );
    reaction(
      s,
      input.listener,
      target,
      trait,
      value,
      g.inputs.length,
      before,
      story?.title,
      story ? ('detail' in story ? story.detail : knownIncidentClaim(story)) : undefined,
    );
    s.newsWaiting = false;
    if (target === 'kemal' && bad[trait] === undefined && input.listener === 'fatma')
      talk(s, 'fatma', 'emre');
  }
  updateRiza(s);
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
  const incident = DAILY_INCIDENTS[day];
  if (incident && t === incident.at) {
    s.incidentWitnesses ??= {};
    s.incidentWitnesses[incident.day] = ['hatice', incident.target, ...(day === 0 ? ['zehra'] : [])];
    s.stories ??= [];
    if (!s.stories.some((story) => story.id === incident.day))
      s.stories.push({
        id: incident.day,
        day: incident.day,
        title: storyScene(incident.day)!.title,
        target: incident.target,
        truth: true,
      });
    s.locations[incident.target] = incident.place;
    if (day === 0) s.locations.zehra = incident.place;
    s.groundTruth![prop(incident.target, incident.trait)] = incident.value;
    observe(s, 'hatice', incident.target, incident.trait, incident.value);
    observe(s, incident.target, incident.target, incident.trait, incident.value);
    if (day === 0) observe(s, 'zehra', incident.target, incident.trait, incident.value);
  }
  if (incident && t === incident.questionAt) {
    s.locations[incident.listener] = 'garden';
    // Fatma's opening invitation remains alongside the concrete daily question.
    if (day === 0) line(s, 'question', 'Any news this morning, Hatice?', 'fatma');
    s.newsWaiting = true;
    line(s, 'question', incident.question, incident.listener, incident.target);
  }
  if (s.minute === 420) {
    s.locations.kemal = 'fountain';
    for (const neighbour of present(s).filter(
      (p) => p.id !== 'hatice' && p.household !== PEOPLE.find((p) => p.id === 'kemal')!.household,
    )) {
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
  if (t === 720) {
    updateRiza(s);
    if (
      s.engagement === 'waiting' &&
      s.riza &&
      !s.log.some((l) => l.kind === 'riza' && Math.floor(l.at / 1440) === day)
    )
      line(s, 'riza', s.riza.line, 'riza', 'emre');
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
  if (t === 765 && day === 0) {
    // Only people at the fountain actually see the helpful act.
    s.locations.kemal = 'fountain';
    s.stories ??= [];
    s.stories.push({ id: 15, day: 1, title: storyScene(15)!.title, target: 'kemal', truth: true });
    for (const p of present(s)) {
      observe(s, p.id, 'kemal', 'kind', true);
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
      observe(s, p.id, 'kemal', 'dishonest', true);
    }
  }
  if (day === 1 && t === 1020) {
    s.locations.zehra = 'garden';
    line(
      s,
      'truth',
      'Zehra opens a returned sack at your table. The new-flour label covers old flour. “Kemal mixed it, as you heard,” she says.',
      'zehra',
      'kemal',
    );
    for (const witness of present(s)) observe(s, witness.id, 'kemal', 'dishonest', true);
  }
  if (t === 1020) {
    s.locations.emre = 'garden';
    for (const witness of present(s)) {
      observe(s, witness.id, 'emre', 'honest', true);
      observe(s, witness.id, 'emre', 'reliable', true);
    }
    if (
      s.routes.some(
        (r) => r.target === 'emre' && r.origin === 'hatice' && isUnfavourableTrait(r.trait, r.value),
      )
    )
      line(
        s,
        'truth',
        'Emre arrives at the promised hour, returns the borrowed tools and the unused money, and counts it out in front of the table. Rıza can see him from the fountain.',
        'emre',
        'emre',
      );
  }
  const due = s.pendingConfrontations!.filter((p) => p.due <= s.minute);
  const shown = new Set<string>();
  for (const pending of due) {
    const root = s.routes[pending.root - 1]!;
    if (s.confronted.includes(root.id)) continue;
    s.confronted.push(root.id);
    root.confrontedAt = s.minute;
    if (!shown.has(root.target)) {
      confrontHatice(s, root, root.to);
      shown.add(root.target);
    }
  }
  s.pendingConfrontations = s.pendingConfrontations!.filter((p) => p.due > s.minute);
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
      if (s.custom[id]! < 0.8 && ['garden', 'fountain'].includes(s.locations[id]!)) {
        line(
          s,
          'shop',
          `${PEOPLE.find((p) => p.id === id)?.name} tells you: “I closed the shutters early. Fewer customers came today.”`,
          id,
        );
        s.log[s.log.length - 1]!.witnessed = true;
      }
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
      const root = rootOf(s, heard);
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
      if (root.from === 'hatice') confrontHatice(s, root, heard.to);
    }
  }
  const fountain = PEOPLE.filter((p) => s.locations[p.id] === 'fountain');
  let greetingsShown = 0;
  for (const observer of fountain)
    for (const target of fountain) {
      if (observer.household === target.household) continue;
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
  if (incident && t === incident.at) {
    line(s, 'overheard', `${incident.text} You witness this yourself.`, undefined, incident.target);
  }
  if (day >= 12 && t === 1200 && s.engagement === 'waiting') {
    s.locations.riza = 'garden';
    s.locations.emre = 'garden';
    const { honesty, reliability, kindness, trust, traced } = marriageView(s);
    s.engagement =
      trust > 0.57 && honesty > 0.45 && reliability > 0.45 && kindness > 0.4 && !traced
        ? 'accepted'
        : 'refused';
    line(
      s,
      'engagement',
      s.engagement === 'accepted'
        ? 'Rıza sits beside Emre. “Come with your mother on Sunday. Let us talk about the wedding.”'
        : `Rıza returns Emre’s cup untouched. “${traced ? 'An account traced to you reached my household and proved false. I cannot build a family on that.' : trust <= 0.57 ? 'I cannot rely on your word, Hatice.' : kindness <= 0.4 ? 'I am troubled by how Emre treats people. Elif needs kindness at home.' : honesty <= 0.45 ? 'I still have doubts about Emre telling the truth.' : 'I still have doubts about Emre keeping his word.'} Our families should leave this here.”`,
      'riza',
    );
  }
  updateRiza(s);
  if (t === 1380) closeDay(s);
  if (s.minute >= 14 * 1440) {
    s.ended = true;
    line(
      s,
      'ending',
      'The fortnight is over. Open Game menu to follow the words you could not see travelling.',
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
  g.s.groundTruth ??= { 'emre:honest': true, 'emre:reliable': true };
  g.s.pendingConfrontations ??= [];
  g.s.heardClaims ??= {};
  if (!g.s.stories) {
    g.s.stories = DAILY_INCIDENTS.filter((scene) =>
      g.s.incidentWitnesses?.[scene.day]?.includes('hatice'),
    ).map((scene) => ({
      id: scene.day,
      day: scene.day,
      title: storyScene(scene.day)!.title,
      target: scene.target,
      truth: true,
    }));
    if (g.s.log.some((l) => l.kind === 'truth' && /heavy basket/.test(l.text)))
      g.s.stories.push({ id: 15, day: 1, title: storyScene(15)!.title, target: 'kemal', truth: true });
  }
  g.s.days ??= [];
  if (!g.s.riza) updateRiza(g.s, false);
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
      reply: l.reply,
    })),
    question: s.newsWaiting ? 'A neighbour is waiting for your answer.' : undefined,
    benches: s.garden,
    shutters: Object.entries(s.custom)
      .filter(([id, v]) => id !== 'hatice' && v < 0.8)
      .map(([id]) => id),
    riza: s.riza,
    stories: s.stories,
    days: s.days,
    engagement: s.engagement,
    ended: s.ended,
  };
}
