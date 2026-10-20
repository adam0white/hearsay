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
import { DAILY_INCIDENTS, EMRE_INCIDENTS, storyScene } from './incidents.ts';
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

const DOUBTS = ['honest', 'reliable', 'kind'] as const;
const nameOf = (id: string) => PEOPLE.find((p) => p.id === id)?.name ?? id;
function trustedSources(s: State) {
  return PEOPLE.filter((p) => !['hatice', 'emre', 'riza'].includes(p.id))
    .sort((a, b) => trustOf(s.people.riza!, b.id) - trustOf(s.people.riza!, a.id) || a.id.localeCompare(b.id))
    .slice(0, 2);
}
function ensureRiza(s: State) {
  s.riza ??= { lean: 'unsure', line: 'I have not decided about Emre and Elif.', at: s.minute, answerDay: 13 };
  const sources = trustedSources(s)
    .map((p) => p.name)
    .join(' or ');
  const questions = {
    honest: `Does Emre tell the truth? If ${sources} told me he does, I would believe it.`,
    reliable: `Does Emre keep his promises? If ${sources} told me he does, I would believe it.`,
    kind: `Does Emre treat people kindly? If ${sources} told me he does, I would believe it.`,
  };
  s.riza.doubts ??= DOUBTS.map((key) => ({ key, words: questions[key], status: 'open' }));
  const legacyRoad = !s.riza.steps;
  s.riza.steps ??= [
    { day: 4, label: "Coffee with Elif's family", status: 'ahead' },
    { day: 8, label: 'Rıza gives his word', status: 'ahead' },
    { day: 13, label: 'The answer', status: 'ahead' },
  ];
  if (legacyRoad && s.engagement !== 'waiting')
    for (const step of s.riza.steps) step.status = s.engagement === 'accepted' ? 'met' : 'missed';
  return s.riza;
}
function routeAccount(route: Route, trait: Trait) {
  const scene = route.incident ? storyScene(route.incident) : undefined;
  return scene
    ? 'detail' in scene
      ? scene.detail
      : knownIncidentClaim(scene)
    : claimText('Emre', trait, true);
}
function marriageView(s: State) {
  const riza = ensureRiza(s);
  const r = s.people.riza!;
  const trust = trustOf(r, 'hatice');
  const household = PEOPLE.find((p) => p.id === 'riza')!.household;
  const traced = s.routes.some(
    (root) => root.from === 'hatice' && root.contradictedHouseholds?.includes(household),
  );
  const doubts = riza.doubts!;
  let changedCause: string | undefined;
  for (const doubt of doubts) {
    const trait = doubt.key;
    const score = (credence(r, prop('emre', trait)) + 1 - credence(r, prop('emre', OPPOSITE[trait]!))) / 2;
    const supporting = s.routes.findLast(
      (route) =>
        route.to === 'riza' &&
        route.from !== 'hatice' &&
        route.target === 'emre' &&
        !route.retractedAt &&
        ((route.trait === trait && route.value) || (route.trait === OPPOSITE[trait] && !route.value)),
    );
    const opposing = s.routes.findLast(
      (route) =>
        route.to === 'riza' &&
        route.target === 'emre' &&
        !route.retractedAt &&
        ((route.trait === trait && !route.value) || (route.trait === OPPOSITE[trait] && route.value)),
    );
    const seen = Object.entries(s.incidentWitnesses ?? {}).find(([id, witnesses]) => {
      const scene = storyScene(Number(id));
      return scene?.target === 'emre' && scene.trait === trait && scene.value && witnesses.includes('riza');
    });
    const status = score < 0.4 ? 'worse' : score > 0.7 && (supporting || seen) ? 'settled' : 'open';
    if (doubt.status !== status) {
      doubt.status = status;
      doubt.because =
        status === 'open'
          ? undefined
          : status === 'worse'
            ? opposing
              ? `${nameOf(opposing.from)} told him ${claimText('Emre', opposing.trait, opposing.value)}.`
              : `What Rıza has heard about Emre being ${trait} troubles him.`
            : seen
              ? `Rıza saw Emre in “${storyScene(Number(seen[0]))!.title}”.`
              : `${nameOf(supporting!.from)} told him ${routeAccount(supporting!, trait)}.`;
      changedCause = doubt.because ?? `Rıza needs another account of whether Emre is ${trait}.`;
    }
  }
  const settled = doubts.filter((d) => d.status === 'settled').length;
  const worse = doubts.find((d) => d.status === 'worse');
  const lean = traced || trust <= 0.57 || worse ? 'cool' : settled >= 2 && trust > 0.65 ? 'warm' : 'unsure';
  if (s.engagement === 'waiting' && riza.lean !== lean) {
    riza.lean = lean;
    riza.cause = traced
      ? 'A false account from Hatice reached Rıza’s household.'
      : trust <= 0.57
        ? 'Rıza has lost trust in Hatice’s word.'
        : (changedCause ?? 'Rıza is still waiting to hear enough from others.');
  }
  const reason = traced
    ? 'A false story from you reached our house. I cannot trust your account.'
    : trust <= 0.57
      ? 'I am less sure of your word, Hatice. Elif would have to trust your household too.'
      : worse
        ? `What I hear about Emre troubles me. ${worse.because}`
        : lean === 'warm'
          ? 'What I have heard about Emre reassures me. I am leaning toward the marriage.'
          : 'I have not decided about the marriage.';
  const words = doubts
    .map((d) =>
      d.status === 'open'
        ? d.words
        : d.status === 'settled'
          ? `${d.because?.replace('told him', 'told me').replace('Rıza saw', 'I saw')} That settles my doubt about whether he is ${d.key}.`
          : d.because,
    )
    .join(' ');
  return { lean, line: `${reason} ${words}`, trust, traced, settled, worse } as const;
}
function updateRiza(s: State, announce = true, speaking = false) {
  const next = marriageView(s);
  const riza = ensureRiza(s);
  const lean = s.engagement === 'waiting' ? next.lean : s.engagement === 'accepted' ? 'warm' : 'cool';
  if (riza.lean !== lean) {
    riza.lean = lean;
    riza.cause =
      s.engagement === 'accepted'
        ? 'Rıza agreed after settling his doubts about Emre.'
        : 'Rıza gave his answer while doubts remained.';
  }
  // The card keeps his last words to Hatice. Remote news is spoken on his next visit.
  if ((!announce && !speaking) || !present(s).some((p) => p.id === 'riza')) return;
  const words =
    s.engagement === 'waiting'
      ? next.line
      : s.engagement === 'accepted'
        ? 'I have agreed to the marriage. Come with Emre and we will plan the wedding.'
        : 'I have refused the marriage. Our families should leave this here.';
  if (riza.line === words) return;
  riza.line = words;
  riza.at = s.minute;
  if (announce) line(s, 'riza', words, 'riza', 'emre');
}

// In these neighbours’ understanding, telling someone about their own rights is not
// backbiting: the game's assumed reading of the widely held warning/redress exception,
// not a sourced ruling. Other neighbours may still refuse to pass the account on.
function concernedMatter(
  s: State,
  listener: string,
  target: string,
  trait: Trait,
  value: boolean,
  incident?: number,
  at = s.minute,
) {
  const scene = incident ? storyScene(incident) : DAILY_INCIDENTS[Math.floor(at / 1440)];
  const aboutMatter =
    scene &&
    scene.target === target &&
    ((scene.trait === trait && scene.value === value) ||
      (OPPOSITE[scene.trait] === trait && scene.value !== value));
  const asked = s.log.some(
    (l) =>
      l.kind === 'question' &&
      l.speaker === listener &&
      l.target === target &&
      l.at <= at &&
      Math.floor(l.at / 1440) === Math.floor(at / 1440),
  );
  return aboutMatter && (('listener' in scene && scene.listener === listener) || asked);
}
function protectedAccount(s: State, route: Route) {
  return (
    route.from === 'hatice' &&
    !route.lie &&
    concernedMatter(s, route.to, route.target, route.trait, route.value, route.incident, route.at)
  );
}
function sceneAt(s: State, key: string, due: number, participants: { id: string; place: string }[]) {
  if (s.minute !== due && !s.deferredScenes?.[key]) return false;
  if (participants.some((p) => p.id === s.held?.id && p.place !== 'garden')) {
    s.deferredScenes ??= {};
    s.deferredScenes[key] = due;
    return false;
  }
  if (s.deferredScenes) delete s.deferredScenes[key];
  return true;
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
  concerned = false,
) {
  const p = s.people[listener]!;
  const c = credence(p, prop(target, trait));
  const confidence = value ? c : 1 - c;
  const trust = trustOf(p, 'hatice');
  const refused =
    !concerned &&
    PEOPLE.find((p) => p.id === listener)!.norm === 'forbidden' &&
    isUnfavourableTrait(trait, value) &&
    !present(s).some((p) => p.id === target);
  const mother = listener === 'riza' && target === 'emre' && !isUnfavourableTrait(trait, value);
  const believes = concerned
    ? 'yes'
    : mother
      ? 'doubt'
      : refused
        ? 'refuse'
        : confidence > 0.6
          ? 'yes'
          : confidence < 0.4
            ? 'no'
            : 'doubt';
  const assertion = storyDetail ?? claimText(PEOPLE.find((p) => p.id === target)!.name, trait, value);
  const detail = mother
    ? 'You are his mother, Hatice. I would rather hear it from someone else.'
    : concerned
      ? `Thank you, Hatice. I believe you. ${assertion}.`
      : refused
        ? `They are not here to answer. Talking about their faults behind their back is wrong. ${confidence > 0.6 ? 'I believe you, but' : 'Whether it is true or not,'} I won’t repeat that.`
        : believes === 'yes'
          ? `I believe ${title ? `your account of “${title}”: ` : ''}${assertion}. ${trust > 0.6 ? 'I trust your word on this.' : 'That fits what I have heard, though I have doubts about your word.'}`
          : believes === 'no'
            ? `I don’t believe ${title ? `your account of “${title}”: ` : ''}${assertion}. ${trust < 0.6 ? 'Your word has let me down.' : 'It goes against what I have seen and heard.'}`
            : `I am not sure ${title ? `about “${title}”: ` : ''}${assertion}. ${trust < 0.6 ? 'I cannot take your word alone.' : 'I hear you, but I need more than that.'}`;
  let will: string | undefined;
  const damaging = isUnfavourableTrait(trait, value);
  const changed = Math.abs(c - before) > 0.02;
  if (mother) will = 'I’ll listen for what others say.';
  else if (concerned)
    will =
      listener === 'meryem'
        ? 'I’ll go and find Osman about my cart.'
        : `I’ll go and find ${nameOf(target)} about this.`;
  else if (refused) will = 'I won’t repeat that.';
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
  const rizaBefore = s.riza?.line;
  updateRiza(s, false, listener === 'riza');
  // Rıza's standing line is always on screen; repeat it in his answer only when this input changed it (L2).
  const marriage =
    listener === 'riza' && ['emre', 'hatice', 'osman'].includes(target) && s.riza?.line !== rizaBefore
      ? ` ${s.riza?.line ?? ''}`
      : '';
  answer(s, listener, `${detail}${will && !detail.includes(will) ? ` ${will}` : ''}${marriage}`, target, {
    to,
    believes,
    ...(will ? { will } : {}),
  });
  if (concerned) {
    s.errands ??= {};
    s.errands[listener] = { target, until: s.minute + 105 };
    if (s.held?.id !== listener) s.locations[listener] = s.locations[target]!;
  }
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
  const riza = today.findLast(
    (l) => l.kind === 'riza' || l.kind === 'engagement' || l.kind === 'wedding-step',
  );
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
  const tomorrow = ensureRiza(s).steps!.find((step) => step.day === day + 1);
  s.days.push({
    day,
    summary: summary.slice(0, 4),
    question,
    tomorrow: tomorrow
      ? `Tomorrow: ${tomorrow.label}${tomorrow.day === 13 ? ' after supper' : ' at six in the evening'}.`
      : 'At dusk Rıza and Cem meet at the fountain.',
  });
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
    if (protectedAccount(s, root)) continue;
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
  if (protectedAccount(s, root)) {
    line(
      s,
      'answer',
      `${target.name} comes to your table. “${target.household === PEOPLE.find((p) => p.id === 'hatice')!.household || target.household === PEOPLE.find((p) => p.id === recipient)?.household ? 'You could have told me at home.' : 'I will speak to them about it.'}”`,
      target.id,
      'hatice',
    );
    return;
  }
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
  s.people.riza!.memory.sourceTrust.kemal = 0.88;
  s.people.riza!.memory.sourceTrust.cem = 0.85;
  place(s);
  ensureRiza(s);
  s.riza!.line = marriageView(s).line;
  updateRiza(s, false);
  line(
    s,
    'arrival',
    'The samovar warms. Emre sets two cups aside. Rıza has still not given an answer about Elif.',
  );
  return { s, inputs: [] };
}
function scheduledLocation(s: State, p: (typeof PEOPLE)[number]) {
  const t = s.minute % 1440;
  const slot = t < 480 ? 0 : t < 660 ? 1 : t < 780 ? 2 : t < 1020 ? 3 : t < 1140 ? 4 : t < 1260 ? 5 : 6;
  let location = t < 360 || t >= 1380 ? p.home : (SCHEDULES[p.id]?.[slot] ?? p.home);
  if (location === 'home') location = p.home;
  if (p.id === 'hatice' || s.called[p.id] === s.minute || s.held?.id === p.id) return 'garden';
  if (t >= 720 && t < 780 && p.id === 'riza') return 'garden';
  const errand = s.errands?.[p.id];
  if (errand && errand.until > s.minute) return s.locations[errand.target] ?? location;
  if (location === 'grocer' && avoidsShop(s, p.id, 'kemal')) location = 'bakery';
  if (location === 'bakery' && avoidsShop(s, p.id, 'riza')) location = 'grocer';
  return location;
}
function release(s: State) {
  if (!s.held) return;
  const id = s.held.id;
  delete s.held;
  const person = PEOPLE.find((p) => p.id === id);
  if (person) s.locations[id] = scheduledLocation(s, person);
}
function place(s: State) {
  if (s.held && s.held.until <= s.minute) release(s);
  for (const p of PEOPLE) s.locations[p.id] = scheduledLocation(s, p);
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
  if ('trait' in input && input.trait && !REPUTATION_TRAITS[input.trait]) return false;
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
  if (input.type === 'choose') {
    return false; // Contract first: scene resolution follows in the sim implementation.
  } else if (input.type === 'release') {
    release(s);
  } else if (input.type === 'sit') {
    if (s.held?.id !== input.listener) release(s);
    s.held = { id: input.listener, until: s.minute + 90 };
    s.locations[input.listener] = 'garden';
  } else if (input.type === 'call-over') {
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
    answer(s, input.listener, `${detail}${emre && !s.riza ? ` ${marriageView(s).line}` : ''}`, input.target, {
      to: g.inputs.length,
      believes: refusal ? 'refuse' : believes,
      ...(refusal ? { will: 'I won’t repeat that.' } : {}),
    });
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
    const concernedMatch = !!concernedMatter(
      s,
      input.listener,
      target,
      trait,
      input.type === 'tell-story' ? story!.value : !(input.type === 'defend' && trait === 'owes'),
      story?.id,
    );
    const mother =
      input.listener === 'riza' &&
      target === 'emre' &&
      !isUnfavourableTrait(trait, input.type === 'tell-story' ? story!.value : true);
    const own = s.people.hatice!;
    const value = input.type === 'tell-story' ? story!.value : !(input.type === 'defend' && trait === 'owes');
    const ownConfidence = value ? credence(own, prop(target, trait)) : 1 - credence(own, prop(target, trait));
    const lie = story ? false : ownConfidence <= 0.5;
    const concerned = concernedMatch && !lie;
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
          confidence: mother ? 0.51 : input.type === 'tell-story' ? 1 : lie ? 0.9 : ownConfidence,
        },
      ],
      summary: `Hatice says ${target} is ${trait}`,
      norms: [
        ...(!concerned && isUnfavourableTrait(trait, value) && !idsHere.includes(target)
          ? [{ normId: 'backbiting', relation: 'violates' as const }]
          : []),
      ],
    };
    const heard = route(s, 'hatice', input.listener, target, trait, lie, value);
    if (story) {
      heard.incident = story.id;
      heard.title = story.title;
    }
    const listenerPerson = s.people[input.listener]!;
    const before = credence(listenerPerson, prop(target, trait));
    const beforeOpposite = credence(listenerPerson, prop(target, OPPOSITE[trait] ?? trait));
    deliver(s, input.listener, [percept]);
    if (mother) {
      // Her praise can shift an open view slightly, but cannot cross his threshold
      // for independent support, even after an earlier weak neighbour's account.
      for (const [key, prior, favourable] of [
        [trait, before, value],
        [OPPOSITE[trait], beforeOpposite, !value],
      ] as const) {
        if (!key) continue;
        const belief = listenerPerson.memory.beliefs.find((b) => b.prop === prop(target, key));
        if (!belief) continue;
        const now = credence(listenerPerson, belief.prop);
        const bounded = favourable
          ? Math.max(prior, Math.min(now, 0.69))
          : Math.min(prior, Math.max(now, 0.31));
        belief.logOdds = Math.log(bounded / (1 - bounded));
        applyReputationBelief(listenerPerson, belief.prop, now, bounded, s.minute);
      }
    }
    if (story && !mother && trustOf(s.people[input.listener]!, 'hatice') > 0.1) {
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
      concerned,
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
      if (chosen.action === 'sleep' && s.held?.id !== p.id)
        s.locations[p.id] = PEOPLE.find((w) => w.id === p.id)?.home ?? s.locations[p.id]!;
    }
  }
  const t = s.minute % 1440,
    day = Math.floor(s.minute / 1440);
  const incident = DAILY_INCIDENTS[day];
  const incidentReady =
    incident &&
    t >= incident.at &&
    t < 1380 &&
    !s.incidentWitnesses?.[incident.day] &&
    !(s.held?.id === incident.target && incident.place !== 'garden') &&
    !(day === 0 && s.held?.id === 'zehra');
  if (incidentReady) {
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
  if (
    incident &&
    t >= incident.questionAt &&
    t < 1380 &&
    s.incidentWitnesses?.[incident.day] &&
    !s.log.some(
      (l) => l.kind === 'question' && l.text === incident.question && Math.floor(l.at / 1440) === day,
    )
  ) {
    s.locations[incident.listener] = 'garden';
    // Fatma's opening invitation remains alongside the concrete daily question.
    if (day === 0) line(s, 'question', 'Any news this morning, Hatice?', 'fatma');
    s.newsWaiting = true;
    line(s, 'question', incident.question, incident.listener, incident.target);
  }
  for (const scene of EMRE_INCIDENTS) {
    if (scene.day !== day + 1 || t < scene.at || s.incidentWitnesses?.[scene.id]) continue;
    s.incidentWitnesses ??= {};
    const witnesses = ['hatice', 'emre', ...(s.locations.riza === scene.place ? ['riza'] : [])];
    s.incidentWitnesses[scene.id] = witnesses;
    s.stories ??= [];
    s.stories.push({ id: scene.id, day: scene.day, title: scene.title, target: scene.target, truth: true });
    s.locations.emre = scene.place;
    for (const id of witnesses) observe(s, id, scene.target, scene.trait, scene.value);
    line(s, 'overheard', `${scene.detail}. You witness this yourself.`, undefined, 'emre');
  }
  if (sceneAt(s, 'opening-greeting', 420, [{ id: 'kemal', place: 'fountain' }])) {
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
  // Their regular dusk meeting gives a retold account a reachable route to Rıza.
  if (t === 1050) {
    for (const source of trustedSources(s))
      if (s.locations[source.id] === s.locations.riza) talk(s, source.id, 'riza');
  }
  const visitors = present(s).filter(
    (p) =>
      p.id !== 'hatice' &&
      previousLocations[p.id] === s.locations[p.id] &&
      s.people[p.id]?.activity?.affordance.mode !== 'sleep',
  );
  if (visitors.length)
    talk(s, visitors[hash(`${s.seed}:${s.minute}:visitor`) % visitors.length]!.id, 'hatice');
  if (sceneAt(s, 'basket', 765, [{ id: 'kemal', place: 'fountain' }])) {
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
  if (
    t === 1020 &&
    s.routes.some((r) => r.from === 'hatice' && r.target === 'emre' && isUnfavourableTrait(r.trait, r.value))
  ) {
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
      if (protectedAccount(s, root)) {
        if (root.from === 'hatice') confrontHatice(s, root, heard.to);
        continue;
      }
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
  if (incidentReady) {
    line(s, 'overheard', `${incident.text} You witness this yourself.`, undefined, incident.target);
  }
  const wedding = marriageView(s);
  for (const milestone of ensureRiza(s).steps!) {
    const due = (milestone.day - 1) * 1440 + (milestone.day === 13 ? 1200 : 1080);
    if (milestone.status !== 'ahead' || s.minute < due) continue;
    // A held neighbour stays at the table; none of these scenes asks them to leave.
    s.locations.riza = 'garden';
    if (milestone.day === 13) {
      if (s.engagement !== 'waiting') {
        milestone.status = s.engagement === 'accepted' ? 'met' : 'missed';
        continue;
      }
      s.locations.emre = 'garden';
      s.engagement =
        wedding.settled === 3 && !wedding.worse && wedding.trust > 0.65 && !wedding.traced
          ? 'accepted'
          : 'refused';
      milestone.status = s.engagement === 'accepted' ? 'met' : 'missed';
      line(
        s,
        'engagement',
        s.engagement === 'accepted'
          ? 'Rıza sits beside Emre. “Come with your mother on Sunday. Let us talk about the wedding.”'
          : `Rıza returns Emre’s cup untouched. “${wedding.traced ? 'A false account from you reached my household.' : wedding.trust <= 0.57 ? 'I cannot rely on your word, Hatice.' : 'I still have doubts about Emre. I have not heard enough from others.'} Our families should leave this here.”`,
        'riza',
      );
    } else {
      const met = wedding.settled >= (milestone.day === 4 ? 1 : 2) && !wedding.worse && !wedding.traced;
      milestone.status = met ? 'met' : 'missed';
      line(
        s,
        'wedding-step',
        milestone.day === 4
          ? met
            ? 'Rıza sits at your table. “Come for coffee with Elif’s family. We can talk about Emre.”'
            : 'Rıza sends word that the coffee must wait.'
          : met
            ? 'Rıza puts down his cup. “You have my word. We will speak of the wedding after I settle my last doubts.”'
            : 'Rıza sits at your table. “I cannot give my word yet. I still need to hear more.”',
        'riza',
        'emre',
      );
    }
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
    if (g.s.held && g.s.held.until <= next) {
      g.s.minute = g.s.held.until;
      release(g.s);
    }
    g.s.minute = next;
    step(g.s);
    next += 15;
  }
  if (g.s.held && g.s.held.until <= target) {
    g.s.minute = g.s.held.until;
    release(g.s);
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
    g.s.stories = [...DAILY_INCIDENTS, ...EMRE_INCIDENTS]
      .filter((scene) => g.s.incidentWitnesses?.['id' in scene ? scene.id : scene.day]?.includes('hatice'))
      .map((scene) => ({
        id: 'id' in scene ? scene.id : scene.day,
        day: scene.day,
        title: storyScene('id' in scene ? scene.id : scene.day)!.title,
        target: scene.target,
        truth: true,
      }));
    if (g.s.log.some((l) => l.kind === 'truth' && /heavy basket/.test(l.text)))
      g.s.stories.push({ id: 15, day: 1, title: storyScene(15)!.title, target: 'kemal', truth: true });
  }
  g.s.days ??= [];
  ensureRiza(g.s);
  updateRiza(g.s, false);
  return g;
}
export function fingerprint(s: State) {
  return hash(JSON.stringify(s)).toString(16).padStart(8, '0');
}
export function view(s: State) {
  return {
    minute: s.minute,
    scene: s.scene,
    threads: s.threads,
    quick: undefined as import('./types.ts').QuickReply | undefined,
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
    held: s.held,
    concerned:
      s.incidentWitnesses?.[Math.floor(s.minute / 1440) + 1]?.includes('hatice') &&
      present(s).some((p) => p.id === DAILY_INCIDENTS[Math.floor(s.minute / 1440)]?.listener)
        ? DAILY_INCIDENTS[Math.floor(s.minute / 1440)]?.listener
        : undefined,
    households: Object.fromEntries(PEOPLE.map((p) => [p.id, String(p.household)])),
    riza: s.riza,
    stories: s.stories,
    days: s.days,
    engagement: s.engagement,
    ended: s.ended,
  };
}
