import type { Affordance, Percept, Person } from '@adam0white/human-framework';
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
  seedSourceTrust,
  socialEvent,
  tick,
  trustOf,
  understandNorm,
} from '@adam0white/human-framework';
import type { Game, Input, Line, LoggedInput, Route, Scene, State, Trait } from './types.ts';

export * from './types.ts';
export { PEOPLE, PLACES } from './world.ts';
export { REPUTATION_TRAITS };

import { DERYA_NIGHT_SCHEDULE, neighborNorm, PEOPLE, PLACES, SCHEDULES } from './world.ts';

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
import { dailyIncidents, EMRE_INCIDENTS, storyScene } from './incidents.ts';
import { type ContinuityState, encounterOneCast, ONE_CAST } from './one-cast.ts';
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
  if (kind === 'question' && speaker) {
    const question = s.log.at(-1)!;
    question.quick = questionReplies(s, question);
  }
}
function answer(s: State, id: string, detail: string, target?: string, reply?: Line['reply']) {
  // A voice stem is optional. The actual answer is never optional or collapsed into an echo.
  const spoken = say(s, id, 'reply', detail) ?? detail;
  line(s, reply ? 'reply' : 'answer', spoken, id, target);
  if (reply) s.log[s.log.length - 1]!.reply = reply;
}

const DOUBTS = ['honest', 'reliable', 'kind'] as const;
const nameOf = (id: string) => PEOPLE.find((p) => p.id === id)?.name ?? id;
export function trustedSources(s: State) {
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
  s.riza.word ??= { status: 'open', words: 'I need to know your word will hold, Hatice.' };
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
function routeAccount(s: State, route: Route, trait: Trait) {
  const scene = route.incident ? storyScene(route.incident, s.version) : undefined;
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
    (root) => root.from === 'hatice' && !root.retractedAt && root.contradictedHouseholds?.includes(household),
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
      const scene = storyScene(Number(id), s.version);
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
              ? `Rıza saw Emre in “${storyScene(Number(seen[0]), s.version)!.title}”.`
              : `${nameOf(supporting!.from)} told him ${routeAccount(s, supporting!, trait)}.`;
      changedCause = doubt.because ?? `Rıza needs another account of whether Emre is ${trait}.`;
    }
  }
  const settled = doubts.filter((d) => d.status === 'settled').length;
  const worse = doubts.find((d) => d.status === 'worse');
  const lean =
    traced || riza.word?.status === 'worse' || trust <= 0.57 || worse
      ? 'cool'
      : settled >= 2 && trust > 0.65
        ? 'warm'
        : 'unsure';
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
  const scene = incident ? storyScene(incident, s.version) : dailyIncidents(s.version)[Math.floor(at / 1440)];
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
    neighborNorm(s, listener) === 'forbidden' &&
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
  else if (changed && confidence >= 0.7 && (!damaging || neighborNorm(s, listener) !== 'forbidden'))
    will = 'I’ll pass on what you told me.';
  else if (believes === 'doubt') will = 'I won’t repeat that until I have seen more.';
  if (will === 'I’ll pass on what you told me.' && target === 'emre' && listener !== 'riza') {
    const dusk = trustedSources(s).some((source) => source.id === listener);
    will = dusk ? 'I’ll tell Rıza at the fountain at dusk.' : 'I’ll tell Rıza when we meet.';
    const record = s.routes.findLast((r) => r.from === 'hatice' && r.to === listener && r.target === target);
    if (record)
      addThread(s, listener, 'riza', threadAbout(record), record.id, dusk ? 'at dusk, fountain' : undefined);
  }
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
  for (const thread of s.threads ?? [])
    if (thread.who !== 'hatice' && thread.status === 'on its way' && thread.at <= (day - 1) * 1440 + 1050) {
      thread.status = 'stalled';
      thread.reason ??= `${nameOf(thread.who)} has not brought back word of reaching ${nameOf(thread.to)}.`;
    }
  const stalled = s.threads?.findLast(
    (thread) => thread.status === 'stalled' && (thread.attemptedAt ?? thread.at) >= (day - 1) * 1440,
  );
  if (stalled?.reason) summary.push(stalled.reason);
  const repair = s.amends?.find((c) => c.listeners.length);
  const unresolved = s.routes.findLast(
    (r) => r.from === 'hatice' && r.lie && !r.retractedAt && !r.retractionOf,
  );
  const first = repair?.listeners[0] ?? unresolved?.to;
  let decision: string | undefined;
  const correction = s.morningVisits?.find((v) => v.scene && !v.done);
  if (correction)
    decision = 'First thing tomorrow Ayşe and Rıza sit down for tea. Will you take back your denial?';
  else if (first) {
    const target = repair?.target ?? unresolved!.target;
    decision = `First thing tomorrow ${nameOf(first)} sits down for tea. Will you take back what you told ${first === 'ayse' || first === 'elif' ? 'her' : 'him'} about ${nameOf(target)}?`;
    const at = day * 1440 + 360;
    s.morningVisits ??= [];
    s.morningVisits.push({ who: first, at, until: at + 120 });
  } else if (s.morningVisits?.some((v) => v.bread && !v.done))
    decision = 'First thing tomorrow Emre takes bread to Rıza’s door. What will Rıza see for himself?';
  s.days.push({
    day,
    summary: summary.slice(0, 4),
    question,
    tomorrow:
      decision ??
      (tomorrow
        ? `Tomorrow: ${tomorrow.label}${tomorrow.day === 13 ? ' after supper' : ' at six in the evening'}.`
        : 'Tomorrow, Cem and Rıza usually pass the fountain at dusk.'),
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
    if (root.from !== 'hatice' || root.retractedAt) continue;
    if (protectedAccount(s, root)) continue;
    const household = PEOPLE.find((p) => p.id === listener)!.household;
    root.contradictedHouseholds ??= [];
    if (root.contradictedHouseholds.includes(household)) continue;
    root.contradictedHouseholds.push(household);
    root.contradictedAt ??= s.minute;
    markWordHurt(s, root.target);
    if (root.stoodByAt !== undefined) s.closedUntil = Math.max(s.closedUntil, s.minute + 2 * 1440);
    for (const member of PEOPLE.filter((p) => p.household === household && p.id !== 'hatice'))
      s.people[member.id]!.memory.sourceTrust.hatice = Math.max(
        0,
        trustOf(s.people[member.id]!, 'hatice') - (root.stoodByAt !== undefined ? 0.28 : 0.18),
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
    const scene = storyScene(r.incident!, s.version);
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
  const scene = dailyIncidents(s.version).findLast(
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
  const scene = account?.incident ? storyScene(account.incident, s.version) : undefined;
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
  const source = priorSource(s, root);
  openScene(s, {
    id: `confront-${root.id}`,
    kind: 'confrontation',
    who: [target.id],
    text: `${target.name}: “${spoken ?? personal[target.id] ?? 'You spoke about me. Explain it to me here.'}”`,
    choices: [
      {
        id: 'own',
        label: 'Own it and retract',
        says: 'I said it. I will take it back to everyone I told.',
        risk: 'They will hear you take it back',
      },
      ...(source
        ? [
            {
              id: 'source',
              label: 'Say who told you',
              says: `${nameOf(source.from)} told me. I should have asked you first.`,
              risk: `${nameOf(source.from)} will hear of this`,
            },
          ]
        : []),
      {
        id: 'stand',
        label: 'Stand by it',
        says: 'I stand by what I said.',
        risk: root.lie ? 'A contradiction will cost your word' : `${target.name} may stay cold`,
      },
    ],
    since: s.minute,
    until: s.minute + 120,
    fallback: 'stand',
  });
  markWordHurt(s, root.target);
}

export function newGame(
  seed: number,
  version: State['version'] = 5,
  initialPeople?: Record<string, Person>,
  initialContinuity?: ContinuityState,
): Game {
  if (initialPeople && version < 4) throw new Error('Legacy editions cannot admit canonical people');
  const pinned = initialPeople ? structuredClone(initialPeople) : undefined;
  const s: State = {
    version,
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
    if (version >= 4 && p.id === 'derya') {
      s.people.derya = createPerson({
        id: 'derya',
        name: 'Derya',
        seed: seed ^ 0x55,
        now: 360,
        bornAt: 360 - 44 * 365 * 1440,
        sex: 'female',
        voices: [{ voiceId: 'kapici', trust: 0.5 }],
        traits: { honesty: 0.7, extraversion: 0.35, agreeableness: 0.6, emotionality: 0.5, openness: 0.55 },
        norms: [{ normId: 'backbiting', standing: 'forbidden', conviction: 0.5 }],
      });
      understandNorm(s.people.derya, 'backbiting', 'forbidden', 0.5);
      seedSourceTrust(s.people.derya, 'hatice', 0.72);
      continue;
    }
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
    // The legacy serialization stamp is part of published replay fingerprints.
    if (version < 4) s.people[p.id]!.engine = '2.10.0';
    understandNorm(s.people[p.id]!, 'backbiting', p.norm, p.norm === 'forbidden' ? 1 : 0.65);
    understandNorm(s.people[p.id]!, 'lying', p.norm === 'permitted' ? 'disliked' : 'forbidden', 0.8);
    // Preserve the historical serialized self entry; HF correctly refuses to seed self trust.
    if (p.id === 'hatice') s.people[p.id]!.memory.sourceTrust.hatice = 0.72;
    else seedSourceTrust(s.people[p.id]!, 'hatice', 0.72);
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
      seedSourceTrust(s.people[listener.id]!, `familiar:${target.id}`, 0.85);
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
  seedSourceTrust(s.people.riza!, 'kemal', 0.88);
  seedSourceTrust(s.people.riza!, 'cem', 0.85);
  // Incoming people already contain their approved current profile. Local familiarity
  // initialization must not overwrite their memory, norms, transient state or RNG.
  if (pinned)
    for (const [id, person] of Object.entries(pinned)) {
      if (person.id !== id) throw new Error('Admitted Person id does not match its local mapping');
      s.people[id] = structuredClone(person);
    }
  place(s);
  ensureRiza(s);
  s.riza!.line = marriageView(s).line;
  updateRiza(s, false);
  line(
    s,
    'arrival',
    'The samovar, a tea urn, warms. Emre sets two cups aside. Rıza has still not given an answer about Elif.',
  );
  return {
    s,
    inputs: [],
    ...(pinned ? { initialPeople: pinned } : {}),
    ...(initialContinuity
      ? {
          initialContinuity: structuredClone(initialContinuity),
          continuity: structuredClone(initialContinuity),
        }
      : {}),
  };
}
function scheduledLocation(s: State, p: (typeof PEOPLE)[number]) {
  const t = s.minute % 1440;
  const slot = t < 480 ? 0 : t < 660 ? 1 : t < 780 ? 2 : t < 1020 ? 3 : t < 1140 ? 4 : t < 1260 ? 5 : 6;
  const canonicalNurse = s.version >= 4 && p.id === 'derya';
  if (canonicalNurse && s.deryaAssignmentReleased) return 'flat-5';
  let location = canonicalNurse
    ? t < 360 || t >= 1020
      ? 'hospital'
      : DERYA_NIGHT_SCHEDULE[slot]!
    : t < 360 || t >= 1380
      ? p.home
      : (SCHEDULES[p.id]?.[slot] ?? p.home);
  // Sleep and paid night work constrain invitations and interrupted tea visits.
  if (canonicalNurse && (t < 360 || (t >= 480 && t < 780) || t >= 1020)) return location;
  if (location === 'home') location = p.home;
  if (s.scene?.who.includes(p.id)) return 'garden';
  if (s.morningVisits?.some((v) => v.who === p.id && s.minute >= v.at && s.minute < v.until)) return 'garden';
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
  if (s.version >= 4 && s.people['dilan-delivery']) {
    const t = s.minute % 1440;
    s.locations['dilan-delivery'] = s.minute >= 1440 && t >= 390 && t < 420 ? 'garden' : 'delivery-route';
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
/** Only Derya gets this edition5 host opportunity; HF owns selection and goal progress. */
function socialPartnerAvailable(s: State, id: string): boolean {
  const p = s.people[id];
  return Boolean(
    p?.body.alive &&
      !p.body.asleep &&
      p.activity?.mode !== 'sleep' &&
      (!p.activity || ['rest', 'drink', 'eat'].includes(p.activity.action)),
  );
}
function nurseOffDuty(s: State): boolean {
  const t = s.minute % 1440;
  return t >= 360 && t < 1020 && !(t >= 480 && t < 780) && !s.deryaAssignmentReleased;
}
function chatAvailable(s: State): boolean {
  const p = s.people.derya;
  const activity = p?.activity;
  const partner = activity?.targetId;
  return Boolean(
    activity?.action === 'chat' &&
      p?.body.alive &&
      !p.body.asleep &&
      nurseOffDuty(s) &&
      partner &&
      ['garden', 'fountain'].includes(activity.affordance.placeId ?? '') &&
      s.locations.derya === activity.affordance.placeId &&
      s.locations[partner] === activity.affordance.placeId &&
      socialPartnerAvailable(s, partner),
  );
}
function interruptDeryaChat(s: State): void {
  const p = s.people.derya;
  const activity = p?.activity;
  if (s.version < 5 || !p || activity?.action !== 'chat' || chatAvailable(s)) return;
  finish(p, {
    affordanceId: activity.affordanceId,
    action: 'chat',
    targetId: activity.targetId,
    status: 'interrupted',
    at: s.minute,
    needs: {},
    summary: 'The conversation stopped when a participant could no longer stay.',
  });
  line(
    s,
    'social-chat-interrupted',
    `Derya’s conversation with ${nameOf(activity.targetId ?? '')} stops; they cannot both stay.`,
    'derya',
    activity.targetId,
  );
}
function occupiedByChat(s: State, id: string): boolean {
  if (s.version < 5) return false;
  const activity = s.people.derya?.activity;
  return Boolean(
    (activity?.action === 'chat' && (id === 'derya' || id === activity.targetId)) ||
      (s.deryaChatCompleted?.at === s.minute && (id === 'derya' || id === s.deryaChatCompleted.partnerId)),
  );
}
function talk(s: State, from: string, to: string, completedChat = false) {
  if (!completedChat && (occupiedByChat(s, from) || occupiedByChat(s, to))) return;
  // Let the first witnessed incident open the morning's talk.
  if (s.minute < 390 || (s.silence[from] ?? 0) > s.minute) return;
  const a = s.people[from]!,
    b = s.people[to]!;
  const result = converse(a, b, {
    at: s.minute,
    placeId: s.locations[from],
    maxClaims: 1,
    topics: [dailyIncidents(s.version)[Math.min(13, Math.floor(s.minute / 1440))]!.target, 'emre'],
    temptations: a.traits.honesty < 0.3 ? [{ prop: 'kemal:cruel', value: true, gain: 0.9 }] : [],
  });

  for (const ev of result.socialEvents.speaker) socialEvent(a, ev);
  for (const ev of result.socialEvents.listener) socialEvent(b, ev);
  for (const c of result.claims) {
    if (c.about && c.prop.split(':')[1]) {
      const r = route(s, from, to, c.about, c.prop.split(':')[1] as Trait, c.deceit, c.value);
      if (['garden', 'fountain'].includes(s.locations[from]!))
        rememberTelling(
          s,
          to,
          {
            target: r.target,
            trait: r.trait,
            value: r.value,
            ...(r.incident ? { incident: r.incident } : {}),
          },
          from,
        );
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
function waitingQuestion(s: State) {
  return s.newsWaiting ? s.log.findLast((l) => l.kind === 'question') : undefined;
}
function answerQuestion(s: State, listener: string, target: string) {
  const question = waitingQuestion(s);
  if (question?.speaker === listener && (!question.target || question.target === target))
    s.newsWaiting = false;
}
function giveUpQuestion(s: State) {
  const question = waitingQuestion(s);
  if (!question?.speaker) return;
  s.locations[question.speaker] = 'garden';
  answer(
    s,
    question.speaker,
    'I have to go, Hatice. I cannot wait for your answer any longer.',
    question.target,
  );
  s.newsWaiting = false;
}
function quickReplies(s: State): import('./types.ts').QuickReply | undefined {
  const question = waitingQuestion(s);
  if (!question?.speaker || !present(s).some((p) => p.id === question.speaker)) return;
  return question.quick ?? questionReplies(s, question);
}
function questionReplies(s: State, question: Line): import('./types.ts').QuickReply {
  const listener = question.speaker!;
  const story = s.stories?.findLast((story) => {
    const scene = storyScene(story.id, s.version);
    return story.target === question.target && scene && (scene.day - 1) * 1440 + scene.at <= question.at;
  });
  const scene = story ? storyScene(story.id, s.version) : undefined;
  const target = question.target ?? 'kemal';
  return {
    listener,
    options: [
      ...(story && scene
        ? [
            {
              label: 'Tell what you saw',
              says: `${'detail' in scene ? scene.detail : knownIncidentClaim(scene)}.`,
              input: { type: 'tell-story' as const, listener, incident: story.id },
            },
          ]
        : []),
      {
        label: `Speak up for ${nameOf(target)}`,
        says: `${claimText(nameOf(target), 'kind', true)}.`,
        input: { type: 'defend' as const, listener, target, trait: 'kind' as const },
      },
      {
        label: 'Keep it to yourself',
        says: 'Nothing I need to pass on.',
        input: { type: 'hold-tongue' as const },
      },
    ],
  };
}
function priorSource(s: State, root: Route) {
  if (root.lie) return;
  return s.routes.findLast(
    (r) =>
      r.id < root.id &&
      r.to === 'hatice' &&
      rootOf(s, r).from !== 'hatice' &&
      r.from !== root.target &&
      r.target === root.target &&
      !r.retractedAt &&
      ((r.trait === root.trait && r.value === root.value) ||
        (OPPOSITE[r.trait] === root.trait && r.value !== root.value)),
  );
}
function threadAbout(r: Route) {
  const names: Partial<Record<Trait, string>> = {
    honest: 'Emre tells the truth',
    reliable: 'Emre keeps his word',
    kind: 'Emre helps his neighbours',
  };
  return r.target === 'emre' ? (names[r.trait] ?? 'The account of Emre') : `${nameOf(r.target)}’s story`;
}
function addThread(s: State, who: string, to: string, about: string, routeId?: number, where?: string) {
  s.threads ??= [];
  const thread = {
    id: s.threads.length + 1,
    who,
    to,
    about,
    status: 'on its way' as const,
    ...(where ? { where } : {}),
    at: s.minute,
  };
  s.threads.push(thread);
  if (routeId !== undefined) {
    s.threadRoutes ??= {};
    s.threadRoutes[thread.id] = routeId;
  }
  return thread;
}
function reportThreads(s: State) {
  const here = present(s).map((p) => p.id);
  for (const thread of s.threads ?? []) {
    if (thread.status === 'arrived' || thread.who === 'hatice') continue;
    const original = s.routes.find((r) => r.id === s.threadRoutes?.[thread.id]);
    if (!original) continue;
    const delivered = s.routes.find(
      (r) =>
        r.at >= thread.at &&
        r.from === thread.who &&
        r.to === thread.to &&
        r.target === original.target &&
        ((r.trait === original.trait && r.value === original.value) ||
          (OPPOSITE[r.trait] === original.trait && r.value !== original.value)),
    );
    if (!delivered) {
      const t = s.minute % 1440;
      if (t === 1050 && thread.status === 'on its way' && thread.at <= s.minute) {
        const from = nameOf(thread.who),
          to = nameOf(thread.to);
        const together =
          here.includes(thread.who) &&
          here.includes(thread.to) &&
          s.locations[thread.who] === s.locations[thread.to];
        if (together) {
          const p = s.people[thread.who]!;
          const c = credence(p, prop(original.target, original.trait));
          const opposite = OPPOSITE[original.trait];
          const other = opposite ? credence(p, prop(original.target, opposite)) : 0.5;
          const confident = Math.max(original.value ? c : 1 - c, original.value ? 1 - other : other) >= 0.7;
          thread.reason =
            (s.silence[thread.who] ?? 0) > s.minute
              ? `${from} met ${to} but kept this account to himself.`
              : !confident
                ? `${from} met ${to} but did not believe it enough to pass on.`
                : `${from} met ${to} but spoke about something else.`;
          if (!confident && (s.silence[thread.who] ?? 0) <= s.minute)
            answer(
              s,
              thread.who,
              `I met ${to}, but I am not sure enough about that account to pass it on.`,
              original.target,
            );
          thread.attemptedAt = s.minute;
        } else if (here.includes(thread.who) || here.includes(thread.to)) {
          thread.reason =
            s.held?.id === thread.to
              ? `${from} didn’t get to ${to}: ${to} stayed at your table during the fountain meeting.`
              : s.held?.id === thread.who
                ? `${from} didn’t get to ${to}: ${from} stayed at your table during the fountain meeting.`
                : `${from} didn’t get to ${to}: they were not at the fountain together.`;
          thread.attemptedAt = s.minute;
        }
      }
      if (t >= 1140 && thread.attemptedAt !== undefined && thread.reason) thread.status = 'stalled';
      continue;
    }
    if (![thread.who, thread.to].some((id) => here.includes(id))) continue;
    const speaker = here.includes(thread.to) ? thread.to : thread.who;
    const words =
      speaker === thread.to
        ? `${nameOf(thread.who)} told me ${claimText(nameOf(original.target), original.trait, original.value)}.`
        : `I told ${nameOf(thread.to)} ${claimText(nameOf(original.target), original.trait, original.value)}.`;
    answer(s, speaker, words, original.target);
    thread.status = 'arrived';
    delete thread.reason;
  }
}
function mendNames(s: State, target?: string) {
  const ids = [
    ...new Set(
      s.routes
        .filter(
          (r) => r.from === 'hatice' && (!target || r.target === target) && !r.retractedAt && !r.retractionOf,
        )
        .map((r) => r.to),
    ),
  ];
  return ids.map(nameOf).join(' and ');
}
function markWordHurt(s: State, target: string) {
  const word = ensureRiza(s).word!;
  if (word.status === 'mending') return;
  word.status = 'worse';
  word.words = 'Your account has hurt people, Hatice. I need to see you put it right.';
  word.because = `Your account of ${nameOf(target)} was traced to your table.`;
  word.mend = `Take it back to ${mendNames(s, target) || 'the people you told'}, the people you told.`;
}
function openScene(s: State, scene: Scene) {
  if (scene.kind === 'confrontation' && s.routes.find((r) => `confront-${r.id}` === scene.id)?.retractedAt)
    return;
  if (s.scene?.id === scene.id || s.sceneQueue?.some((other) => other.id === scene.id)) return;
  if (s.scene) {
    s.sceneQueue ??= [];
    s.sceneQueue.push(scene);
    return;
  }
  s.scene = { ...scene, since: s.minute, until: s.minute + 120 };
  for (const id of scene.who) s.locations[id] = 'garden';
  line(s, scene.kind === 'confrontation' ? 'confrontation' : 'wedding-step', scene.text, scene.who[0]);
}
/** Edition 3 adds one confidence dilemma; earlier editions never enter it. */
function elifScene(s: State) {
  openScene(s, {
    id: 'elif-6',
    kind: 'elif',
    who: ['elif'],
    text: 'Elif sits beside you. “Before Father gives his word, I want to speak with Emre about what our life would be. Please keep this between us for now. Can you help?”',
    choices: [
      {
        id: 'private',
        label: 'Keep her confidence',
        says: 'I will keep your request between us. Speak to Emre yourself.',
        risk: 'Elif will trust you more. Rıza will hear no reassurance from you.',
      },
      {
        id: 'father',
        label: 'Bring Rıza into the conversation',
        says: 'I want your father to hear this too. Rıza, will you sit with us?',
        risk: 'Rıza will trust your openness more. Elif will trust you less for sharing her request.',
      },
      {
        id: 'together',
        label: 'Ask her to speak to Rıza together',
        says: 'Will you tell your father with me beside you?',
        risk: 'She may not be ready. Neither trust nor the wedding doubts will improve today.',
      },
    ],
    since: s.minute,
    until: s.minute + 120,
    fallback: 'together',
  });
}
function familyScene(s: State, day: number, met: boolean) {
  const kind = day === 4 ? 'coffee' : 'word';
  if (!met) {
    openScene(s, {
      id: `family-${day}`,
      kind: `${kind}-missed`,
      who: ['emre'],
      text: 'Emre: “Rıza sends word that the coffee must wait. Shall I take bread to his door before work tomorrow?”',
      choices: [
        {
          id: 'bread',
          label: 'Send Emre with bread',
          says: 'Take bread to Rıza’s door tomorrow and ask if they need anything.',
          risk: 'Emre must face Rıza himself',
        },
        { id: 'rest', label: 'Let it rest', says: 'Let it rest for now.', risk: 'His doubts will wait too' },
      ],
      since: s.minute,
      until: s.minute + 120,
      fallback: 'rest',
    });
    return;
  }
  const flour = s.routes.some((r) => r.from === 'hatice' && r.target === 'kemal' && r.incident === 1);
  const cart = s.routes.some((r) => r.from === 'hatice' && r.target === 'osman' && r.incident === 3);
  const question = flour
    ? 'They say the flour talk about our cousin Kemal began at your table. Did it?'
    : cart
      ? 'You spoke about Osman’s cart. Will you put your own household right too?'
      : 'You brought us words about Emre. Will he keep his word to Elif when no one is watching?';
  openScene(s, {
    id: `family-${day}`,
    kind,
    who: ['riza', 'ayse', 'elif', 'emre'],
    text: `Ayşe: “${question}”`,
    choices: [
      {
        id: 'truth',
        label: 'Tell them plainly',
        says: flour
          ? 'Yes. I told what I heard, and I will answer for it.'
          : cart
            ? 'Yes. Our household must keep its word too.'
            : 'Ask him yourselves. I will answer for what I have told you.',
        risk: flour ? 'Kemal will hear you own it' : 'Emre must answer for himself',
      },
      {
        id: 'soften',
        label: 'Soften your answer',
        says: 'We have all made mistakes. I hope you can give us time.',
        risk: 'Rıza may keep his doubt',
      },
      {
        id: 'deny',
        label: flour ? 'Deny your part' : 'Turn the question aside',
        says: flour ? 'No. That talk did not begin with me.' : 'Let us talk about the wedding instead.',
        risk: 'They may doubt your word',
      },
    ],
    since: s.minute,
    until: s.minute + 120,
    fallback: 'soften',
  });
}
function resolveScene(s: State, choiceId: string, to = -1, fallback = false) {
  const scene = s.scene;
  const choice = scene?.choices.find((c) => c.id === choiceId);
  if (!scene || !choice) return;
  if (fallback)
    line(
      s,
      'scene-fallback',
      `They have waited for your answer. You let the moment pass: “${choice.says}”`,
      'hatice',
    );
  else line(s, 'answer', `You say: “${choice.says}”`, 'hatice');
  let outcome: string;
  const speaker = scene.who[0]!;
  if (scene.kind === 'confrontation') {
    const root = s.routes.find((r) => `confront-${r.id}` === scene.id)!;
    if (choiceId === 'own') {
      const listeners = [
        ...new Set(
          s.routes
            .filter(
              (r) => r.from === 'hatice' && r.target === root.target && !r.retractedAt && !r.retractionOf,
            )
            .map((r) => r.to),
        ),
      ];
      s.amends ??= [];
      s.amends = s.amends.filter((c) => c.target !== root.target);
      s.amends.push({ target: root.target, listeners, after: s.minute });
      for (const listener of listeners)
        addThread(
          s,
          'hatice',
          listener,
          `Taking back ${nameOf(root.target)}’s story`,
          undefined,
          'when they next sit with you',
        );
      s.closedUntil = Math.max(s.closedUntil, s.minute + 180);
      const word = ensureRiza(s).word!;
      word.status = 'mending';
      word.words = 'Let them hear you take it back. Then we can speak again.';
      word.mend = `Take it back to ${listeners.map(nameOf).join(' and ')}, the people you told.${s.wordDenial ? ' Answer Ayşe and Rıza about your denial too.' : ''}`;
      outcome = `Take it back to ${listeners.map(nameOf).join(' and ')}. I will wait to hear that you did.`;
    } else if (choiceId === 'source') {
      const source = priorSource(s, root)!;
      s.people[root.target]!.memory.sourceTrust[source.from] = Math.max(
        0,
        trustOf(s.people[root.target]!, source.from) - 0.12,
      );
      socialEvent(s.people[root.target]!, {
        at: s.minute,
        kind: 'conflict',
        otherId: source.from,
        byMe: false,
        magnitude: 0.6,
      });
      s.people[root.target]!.memory.sourceTrust.hatice = Math.min(
        1,
        trustOf(s.people[root.target]!, 'hatice') + 0.06,
      );
      if (!root.contradictedAt) {
        const word = ensureRiza(s).word!;
        if (word.status === 'worse' && !s.wordDenial) {
          word.status = 'open';
          word.words = 'I will ask who told you. Keep your own account straight, Hatice.';
          delete word.mend;
        }
      }
      outcome = `Then I will speak to ${nameOf(source.from)}. You still chose to repeat it.`;
      s.closedUntil = Math.max(s.closedUntil, s.minute + 360);
    } else {
      root.stoodByAt = s.minute;
      s.closedUntil = Math.max(
        s.closedUntil,
        s.minute + (root.lie && root.contradictedAt !== undefined ? 2880 : 1440),
      );
      for (const p of present(s).filter((p) => p.id !== 'hatice'))
        s.people[p.id]!.memory.sourceTrust.hatice = Math.max(
          0,
          trustOf(s.people[p.id]!, 'hatice') - (root.lie ? 0.12 : 0.06),
        );
      outcome = root.lie
        ? 'Then we will see whether your account holds. I will not forget this.'
        : 'You may have your believers. Do not expect me to sit warmly with you.';
    }
  } else if (scene.kind === 'elif') {
    const elif = s.people.elif!;
    if (choiceId === 'private') {
      elif.memory.sourceTrust.hatice = Math.min(1, trustOf(elif, 'hatice') + 0.06);
      outcome =
        'Thank you for keeping my confidence. I will speak to Emre myself. Father still has his own questions.';
    } else if (choiceId === 'father') {
      s.locations.riza = 'garden';
      s.people.riza!.memory.sourceTrust.hatice = Math.min(1, trustOf(s.people.riza!, 'hatice') + 0.06);
      elif.memory.sourceTrust.hatice = Math.max(0, trustOf(elif, 'hatice') - 0.06);
      outcome =
        'You call Rıza over and repeat her request. Rıza says, “Thank you for speaking openly. I still need answers about Emre.” Elif says, “I asked you to keep that between us.”';
    } else {
      outcome = 'Not today. I need to find my own words first. I will speak to him myself when I am ready.';
    }
  } else if (scene.kind.endsWith('-missed')) {
    if (choiceId === 'bread') {
      const at = (Math.floor(s.minute / 1440) + 1) * 1440 + 390;
      s.morningVisits ??= [];
      s.morningVisits.push({ who: 'emre', at, until: at + 90, bread: true });
      outcome = 'I will go before work tomorrow. He can see for himself what I mean.';
    } else outcome = 'All right, Mother. I will leave it for now.';
  } else if (scene.id === 'family-13')
    outcome =
      s.engagement === 'accepted'
        ? 'Bring Emre on Sunday. Elif and I will be waiting.'
        : 'Thank you for hearing me, Hatice.';
  else if (choiceId === 'truth') {
    const word = ensureRiza(s).word!;
    if (word.status === 'open' || scene.id.startsWith('correction-')) {
      word.status = 'settled';
      word.words = 'You answered us plainly. I can take your word for that.';
      delete word.mend;
      if (scene.id.startsWith('correction-')) {
        delete s.wordDenial;
        const wrong = s.routes.find(
          (r) =>
            r.from === 'hatice' &&
            !r.retractedAt &&
            !r.retractionOf &&
            (r.lie || r.contradictedAt !== undefined) &&
            r.confrontedAt !== undefined,
        );
        if (wrong) {
          word.status = s.amends?.some((c) => c.listeners.length) ? 'mending' : 'worse';
          word.words = 'You answered us plainly. The people you told still need your retraction.';
          word.mend = `Take it back to ${mendNames(s, wrong.target)}, the people you told.`;
        }
      }
      if (scene.id.startsWith('correction-'))
        s.people.riza!.memory.sourceTrust.hatice = Math.min(1, trustOf(s.people.riza!, 'hatice') + 0.12);
    }
    outcome = scene.id.startsWith('correction-')
      ? 'Rıza says, “Thank you for coming back to it. I can hear a plain answer, even when it costs you.”'
      : scene.kind === 'coffee'
        ? 'Ayşe says, “Then let us sit and talk with Emre. I wanted to hear you answer for your own words.”'
        : 'Elif says, “Emre, I will hold you to that.” Rıza says, “You have my word. Come back for our answer after supper on Day 13.”';
  } else if (choiceId === 'deny') {
    s.wordDenial = true;
    const word = ensureRiza(s).word!;
    word.status = 'worse';
    word.words = 'You turned away from our question. I cannot give my word on that.';
    word.mend = 'Take back your denial to Ayşe and Rıza. They will sit with you tomorrow morning.';
    const at = (Math.floor(s.minute / 1440) + 1) * 1440 + 360;
    s.morningVisits ??= [];
    s.morningVisits.push({
      who: 'ayse',
      at,
      until: at + 120,
      scene: {
        id: `correction-${scene.id}`,
        kind: 'coffee',
        who: ['ayse', 'riza'],
        text: 'Ayşe: “Yesterday you turned away from our question. Do you want to put that right while Rıza is here?”',
        choices: [
          {
            id: 'truth',
            label: 'Take back your denial',
            says: 'I turned away from your question. That was wrong. I will answer for what I said.',
            risk: 'They will hear you take it back',
          },
          {
            id: 'soften',
            label: 'Leave it there',
            says: 'I have no answer for you today.',
            risk: 'Rıza will keep his doubt',
          },
        ],
        since: at,
        until: at + 120,
        fallback: 'soften',
      },
    });
    const day = Number(scene.id.split('-')[1]);
    const step = s.riza!.steps!.find((step) => step.day === day);
    if (step) step.status = 'missed';
    s.people.riza!.memory.sourceTrust.hatice = Math.max(0, trustOf(s.people.riza!, 'hatice') - 0.12);
    outcome = 'We heard your words at this table. Turning away from them makes this harder, Hatice.';
  } else {
    const word = ensureRiza(s).word!;
    if (word.status === 'settled') word.status = 'open';
    if (word.status === 'open')
      word.words = 'Time alone will not answer this. I still need your plain answer.';
    outcome = 'Time alone will not answer this. We still need a plain answer from you.';
  }
  answer(s, speaker, outcome, 'emre', { to });
  delete s.scene;
  let next = s.sceneQueue?.shift();
  while (next?.kind === 'confrontation' && s.routes.find((r) => `confront-${r.id}` === next!.id)?.retractedAt)
    next = s.sceneQueue?.shift();
  if (next) openScene(s, next);
}
function processCommitments(s: State) {
  for (const visit of s.morningVisits ?? []) {
    if (visit.done || s.minute < visit.at) continue;
    visit.done = true;
    s.locations[visit.who] = 'garden';
    if (visit.scene) {
      openScene(s, visit.scene);
    } else if (visit.bread) {
      s.locations.riza = 'garden';
      s.incidentWitnesses ??= {};
      s.incidentWitnesses[18] = ['emre', 'riza'];
      for (const id of ['emre', 'riza']) observe(s, id, 'emre', 'kind', true);
      believe(s.people.hatice!, 'emre:kind', true, 0.95, 'riza', s.minute);
      line(
        s,
        'truth',
        'Rıza brings Emre back to your table. “He came to my door with bread before work and waited to see if we needed anything. I saw that kindness myself.”',
        'riza',
        'emre',
      );
    } else answer(s, visit.who, 'I came for tea, Hatice. What did you want to tell me?');
  }
  for (const commitment of s.amends ?? []) {
    if (s.minute <= commitment.after) continue;
    for (const listener of [...commitment.listeners]) {
      if (!present(s).some((p) => p.id === listener)) continue;
      s.locations[listener] = 'garden';
      makeAmends(s, listener, commitment.target);
      commitment.listeners = commitment.listeners.filter((id) => id !== listener);
      const thread = s.threads?.find(
        (t) =>
          t.who === 'hatice' &&
          t.to === listener &&
          t.about === `Taking back ${nameOf(commitment.target)}’s story` &&
          t.status !== 'arrived',
      );
      if (thread) thread.status = 'arrived';
    }
  }
  if (
    !s.wordDenial &&
    !s.routes.some(
      (r) =>
        r.from === 'hatice' &&
        !r.retractedAt &&
        !r.retractionOf &&
        (r.lie || r.contradictedAt !== undefined) &&
        r.confrontedAt !== undefined,
    ) &&
    s.amends?.length &&
    s.amends.every((c) => !c.listeners.length) &&
    present(s).some((p) => p.id === 'riza') &&
    s.riza?.word?.status === 'mending'
  ) {
    for (const commitment of s.amends) {
      const listener = s.threads?.find(
        (t) =>
          t.who === 'hatice' &&
          t.status === 'arrived' &&
          t.about === `Taking back ${nameOf(commitment.target)}’s story`,
      )?.to;
      if (listener && listener !== 'riza') {
        s.locations[listener] = 'garden';
        line(
          s,
          'answer',
          `${nameOf(listener)} joins Rıza at your table. “Hatice took back what she told me about ${nameOf(commitment.target)}.”`,
          listener,
          commitment.target,
        );
      }
    }
    s.riza.word = {
      status: 'settled',
      words: 'You took it back to the people you told. We can begin again.',
      because: 'You kept your promise to retract your account.',
    };
    for (const id of ['riza', 'ayse', 'elif'].filter((id) => present(s).some((p) => p.id === id)))
      s.people[id]!.memory.sourceTrust.hatice = Math.max(0.76, trustOf(s.people[id]!, 'hatice'));
  }
}
function expireScene(s: State) {
  if (s.scene && s.scene.until <= s.minute) resolveScene(s, s.scene.fallback, -1, true);
}

function makeAmends(s: State, listener: string, target: string) {
  const p = s.people[listener]!;
  s.people[listener]!.memory.sourceTrust.hatice = Math.max(0, trustOf(p, 'hatice') - 0.06);
  const wrongs = s.routes.filter(
    (r) =>
      (r.origin === 'hatice' || r.from === 'hatice') &&
      r.target === target &&
      r.to === listener &&
      !r.retractedAt &&
      !r.retractionOf,
  );
  for (const r of wrongs) {
    believe(p, prop(r.target, r.trait), !r.value, 0.95, 'hatice', s.minute);
    r.retractedAt = s.minute;
    if (s.version >= 2) {
      const known = s.knownTellings?.[listener];
      if (known) {
        delete known.claims[assertionKey(r.target, r.trait, r.value).key];
        if (r.incident) delete known.incidents[r.incident];
      }
    }
    s.routes.push({
      id: s.routes.length + 1,
      at: s.minute,
      from: 'hatice',
      to: listener,
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
    listener,
    wrongs.length
      ? `You take back ${[...new Set(wrongs.map((r) => `“${claimText(PEOPLE.find((p) => p.id === r.target)!.name, r.trait, r.value)}”`))].join(' and ')}? All right. I’ll think again.`
      : `You haven’t told me anything about ${PEOPLE.find((p) => p.id === target)?.name} to withdraw.`,
    target,
  );
  for (const commitment of s.amends ?? [])
    if (commitment.target === target)
      commitment.listeners = commitment.listeners.filter((id) => id !== listener);
  const thread = s.threads?.find(
    (t) =>
      t.who === 'hatice' &&
      t.to === listener &&
      t.about === `Taking back ${nameOf(target)}’s story` &&
      t.status !== 'arrived',
  );
  if (thread) thread.status = 'arrived';
}

/** The assertion actually spoken; Defend and debt negation share this with duplicate checks. */
function tellingClaim(input: Input) {
  if (input.type === 'tell-story') {
    const story = storyScene(input.incident);
    return story
      ? { target: story.target, trait: story.trait, value: story.value, incident: story.id }
      : undefined;
  }
  if (input.type !== 'tell' && input.type !== 'defend') return;
  return {
    target: input.target,
    trait: input.type === 'defend' ? (good[input.trait] ?? input.trait) : input.trait,
    value: !(input.type === 'defend' && input.trait === 'owes'),
  };
}
function assertionKey(target: string, trait: string, value: boolean) {
  const canonical = good[trait];
  return { key: `${target}:${canonical ?? trait}`, value: canonical ? !value : value };
}
function rememberTelling(
  s: State,
  listener: string,
  claim: NonNullable<ReturnType<typeof tellingClaim>>,
  source: string,
) {
  if (s.version < 2) return;
  s.knownTellings ??= {};
  s.knownTellings[listener] ??= { claims: {}, incidents: {} };
  const known = s.knownTellings[listener];
  const assertion = assertionKey(claim.target, claim.trait, claim.value);
  known.claims[assertion.key] = { value: assertion.value, source, at: s.minute };
  if ('incident' in claim && claim.incident !== undefined)
    known.incidents[claim.incident] = { source, at: s.minute };
}
/** UI reasons read Hatice's knowledge only. Private routes never disable an untried action. */
export function tellingUnavailable(s: State, input: Input): string | undefined {
  if (!('listener' in input)) return;
  const claim = tellingClaim(input);
  if (!claim) return;
  const known = s.knownTellings?.[input.listener];
  const assertion = assertionKey(claim.target, claim.trait, claim.value);
  let record =
    'incident' in claim
      ? known?.incidents[claim.incident!]
      : known?.claims[assertion.key]?.value === assertion.value
        ? known.claims[assertion.key]
        : undefined;
  if (s.version === 1) {
    // Old saves have no knowledge index. Recover only speech Hatice herself made
    // or heard. A hidden route alone is never evidence that she knows it.
    const heardKey = (r: Route) => {
      const trait = !r.value && OPPOSITE[r.trait] ? OPPOSITE[r.trait]! : r.trait;
      const value = !r.value && OPPOSITE[r.trait] ? true : r.value;
      return `${Math.floor(r.at / 1440)}:${r.target}:${trait}:${value}`;
    };
    const echoed = (r: Route) => {
      const key = heardKey(r);
      const heard = s.heardClaims?.[key];
      const echo = heard?.echo ? s.log[heard.echo - 1] : undefined;
      if (echo?.kind !== 'echo' || !echo.who?.includes(r.from)) return false;
      // Echoes aggregate a day's speakers, not recipients or delivery times.
      // Only a unique matching delivery identifies whom Hatice heard them tell.
      return s.routes.filter((other) => other.from === r.from && heardKey(other) === key).length === 1;
    };
    const visible = (r: Route) =>
      r.from === 'hatice' ||
      s.log.some(
        (l) =>
          l.at === r.at &&
          l.speaker === r.from &&
          l.target === r.target &&
          ['conversation', 'rumour'].includes(l.kind),
      ) ||
      echoed(r);
    const prior = s.routes.findLast(
      (r) =>
        r.to === input.listener &&
        !r.retractedAt &&
        !r.retractionOf &&
        visible(r) &&
        ('incident' in claim
          ? r.incident === claim.incident
          : assertionKey(r.target, r.trait, r.value).key === assertion.key),
    );
    if (
      prior &&
      ('incident' in claim || assertionKey(prior.target, prior.trait, prior.value).value === assertion.value)
    )
      record = { source: prior.from, at: prior.at };
    if ('incident' in claim) {
      const scene = storyScene(claim.incident!, s.version);
      const detail = scene && ('detail' in scene ? scene.detail : knownIncidentClaim(scene));
      // A legacy already-heard reply follows Hatice's exact story line.
      for (let index = s.log.length - 1; index > 0; index--) {
        const reply = s.log[index]!;
        const said = s.log[index - 1]!;
        if (
          reply.speaker !== input.listener ||
          reply.kind !== 'reply' ||
          !detail ||
          said.speaker !== 'hatice' ||
          !said.text.includes(detail)
        )
          continue;
        const source = reply.text.includes('I saw that myself')
          ? input.listener
          : reply.text.includes('You told me that one already')
            ? 'hatice'
            : PEOPLE.find((p) => reply.text.includes(`${p.name} told me that one already`))?.id;
        const withdrawn = s.routes.some(
          (r) =>
            r.from === source &&
            r.to === input.listener &&
            r.incident === claim.incident &&
            r.retractedAt !== undefined &&
            r.retractedAt >= reply.at,
        );
        if (source && !withdrawn && (!record || reply.at >= record.at)) record = { source, at: reply.at };
        break;
      }
    }
  }
  if (!record) return;
  const when = clockOf(record.at);
  const time = when.text;
  return record.source === 'hatice'
    ? `You already told ${nameOf(input.listener)} ${'incident' in claim ? 'this story' : 'this claim'} (${time}). Tell something new or changed.`
    : record.source === input.listener
      ? `${nameOf(input.listener)} already witnessed this (${time}). Tell something new or changed.`
      : `${nameOf(input.listener)} already heard this from ${nameOf(record.source)} (${time}). Tell something new or changed.`;
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
  const story = input.type === 'tell-story' ? storyScene(input.incident, s.version) : undefined;
  if (
    input.type === 'tell-story' &&
    (!story ||
      !s.stories?.some((s) => s.id === input.incident) ||
      story.target === input.listener ||
      story.target === 'hatice')
  )
    return false;
  if (s.version >= 2 && tellingUnavailable(s, input)) return false;
  const idsHere = present(s).map((p) => p.id);
  if ('listener' in input && (input.listener === 'hatice' || !idsHere.includes(input.listener))) return false;
  if (input.type === 'one-cast-encounter') {
    if (s.version < 4 || s.minute < 1440 || !['support', 'pry', 'leave'].includes(input.choice)) return false;
    const entry = g.continuity?.entries.find((e) => ONE_CAST[e.admission.castId].targetId === input.person);
    const person = s.people[input.person];
    if (
      !entry ||
      entry.encounter ||
      !person ||
      person.activity ||
      !['garden', 'fountain'].includes(s.locations[input.person] ?? '')
    )
      return false;
    const result = encounterOneCast(person, entry.admission, input.choice, s.minute);
    s.people[input.person] = result.person;
    entry.encounter = result.encounter;
    line(s, 'one-cast-encounter', result.encounter.text, input.person);
  } else if (input.type === 'choose') {
    if (!s.scene || s.scene.id !== input.scene || !s.scene.choices.some((c) => c.id === input.choice))
      return false;
    resolveScene(s, input.choice, g.inputs.length);
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
    const best =
      input.trait ??
      Object.keys(REPUTATION_TRAITS).sort(
        (a, b) =>
          Math.abs(credence(p, prop(input.target, b)) - 0.5) -
          Math.abs(credence(p, prop(input.target, a)) - 0.5),
      )[0]!;
    const c = credence(p, prop(input.target, best));
    const ownView =
      Math.abs(c - 0.5) > 0.1
        ? `${spokenClaim(s, input.listener, input.target, best, c > 0.5)}. That is what I believe.`
        : `${PEOPLE.find((p) => p.id === input.target)!.name} lives here with us. I have seen too little to be sure about that.`;
    const refusal =
      neighborNorm(s, input.listener) === 'forbidden' &&
      isUnfavourableTrait(best, c > 0.5) &&
      !idsHere.includes(input.target);
    const emre = input.listener === 'riza' && input.target === 'emre';
    const detail = refusal
      ? 'They are not here to answer. I won’t talk about their faults behind their back. I won’t repeat that.'
      : emre && !input.trait && !s.routes.some((r) => r.to === 'riza' && r.target === 'emre')
        ? 'He’s polite, he works. I don’t know his heart.'
        : ownView;
    answer(s, input.listener, `${detail}${emre && !s.riza ? ` ${marriageView(s).line}` : ''}`, input.target, {
      to: g.inputs.length,
      ...(refusal ? { will: 'I won’t repeat that.' } : {}),
    });
  } else if (input.type === 'make-amends') {
    makeAmends(s, input.listener, input.target);
  } else {
    const target = input.type === 'tell-story' ? story!.target : input.target;
    const trait =
      input.type === 'tell-story'
        ? story!.trait
        : input.type === 'defend'
          ? (good[input.trait] ?? input.trait)
          : input.trait;
    if (s.version >= 2) {
      const claim = tellingClaim(input)!;
      const assertion = assertionKey(target, trait, claim.value);
      const latest = s.routes.findLast((r) => {
        if (r.to !== input.listener || r.retractedAt || r.retractionOf) return false;
        if (story) return r.incident === story.id;
        const other = assertionKey(r.target, r.trait, r.value);
        return other.key === assertion.key;
      });
      const prior =
        latest && (story || assertionKey(latest.target, latest.trait, latest.value).value === assertion.value)
          ? latest
          : undefined;
      const saw = story ? s.incidentWitnesses?.[story.id]?.includes(input.listener) : false;
      if (prior || saw) {
        const source = saw ? input.listener : prior!.from;
        rememberTelling(s, input.listener, claim, source);
        answer(
          s,
          input.listener,
          saw
            ? 'I saw that myself, Hatice.'
            : source === 'hatice'
              ? 'You told me that already, Hatice.'
              : `${nameOf(source)} told me that${story ? ' one' : ''} already, Hatice.`,
          target,
          { to: g.inputs.length },
        );
        answerQuestion(s, input.listener, target);
        g.inputs.push({ at: s.minute, input: structuredClone(input) });
        return true;
      }
      rememberTelling(s, input.listener, claim, 'hatice');
    }
    if (story && s.version === 1) {
      const prior = s.routes.findLast(
        (r) => r.to === input.listener && r.incident === story.id && !r.retractedAt && !r.retractionOf,
      );
      const saw = s.incidentWitnesses?.[story.id]?.includes(input.listener);
      if (prior || saw) {
        const confidence = credence(s.people[input.listener]!, prop(target, trait));
        const believes = (story.value ? confidence : 1 - confidence) > 0.6 ? 'yes' : 'doubt';
        const already = saw
          ? 'I saw that myself, Hatice.'
          : prior!.from === 'hatice'
            ? 'You told me that one already, Hatice.'
            : `${nameOf(prior!.from)} told me that one already, Hatice.`;
        line(
          s,
          'answer',
          `You tell ${nameOf(input.listener)}: “${'detail' in story ? story.detail : knownIncidentClaim(story)}.”`,
          'hatice',
          target,
        );
        answer(
          s,
          input.listener,
          `${already} ${believes === 'yes' ? 'I believe it.' : 'I still have doubts about it.'}`,
          target,
          { to: g.inputs.length, believes },
        );
        answerQuestion(s, input.listener, target);
        g.inputs.push({ at: s.minute, input: structuredClone(input) });
        return true;
      }
    }
    if (
      s.version === 1 &&
      input.type !== 'tell-story' &&
      target === 'emre' &&
      !isUnfavourableTrait(trait, true)
    ) {
      s.bareEndorsements ??= {};
      const key = `${Math.floor(s.minute / 1440)}:${input.listener}`;
      const count = s.bareEndorsements[key] ?? 0;
      s.bareEndorsements[key] = count + 1;
      if (count > 0) {
        answer(
          s,
          input.listener,
          "You've told me he's a saint, Hatice. Give me something I've seen.",
          target,
          { to: g.inputs.length, believes: 'doubt', will: 'Tell me what he did.' },
        );
        g.inputs.push({ at: s.minute, input: structuredClone(input) });
        return true;
      }
    }
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
    answerQuestion(s, input.listener, target);
    if (target === 'kemal' && bad[trait] === undefined && input.listener === 'fatma')
      talk(s, 'fatma', 'emre');
  }
  interruptDeryaChat(s);
  updateRiza(s);
  g.inputs.push({ at: s.minute, input: structuredClone(input) });
  return true;
}
function step(s: State) {
  // Hatice's clock follows the host; HF never chooses or advances her activity.
  s.people.hatice!.now = s.minute;
  const previousLocations = { ...s.locations };
  place(s);
  interruptDeryaChat(s);
  // Evaluate the prior window before another participant starts their next quarter's activity.
  const completingChat = s.version >= 5 && chatAvailable(s);
  const questionBefore = waitingQuestion(s);
  if (
    questionBefore?.speaker &&
    ['garden', 'fountain'].includes(previousLocations[questionBefore.speaker] ?? '') &&
    !['garden', 'fountain'].includes(s.locations[questionBefore.speaker] ?? '')
  )
    giveUpQuestion(s);
  for (const p of Object.values(s.people)) {
    if (p.id === 'hatice') continue;
    tick(p, s.minute);
    if (p.activity) {
      const activity = p.activity;
      const action = activity.action;
      const needs =
        action === 'eat'
          ? { food: 0.5 }
          : action === 'drink'
            ? { water: 0.5 }
            : action === 'work'
              ? { competence: 0.015, meaning: 0.01 }
              : {};
      if (s.version >= 5 && p.id === 'derya' && action === 'chat') {
        const completed = completingChat && s.minute >= activity.endsAt;
        finish(p, {
          affordanceId: activity.affordanceId,
          action,
          targetId: activity.targetId,
          status: completed ? 'completed' : 'interrupted',
          at: s.minute,
          needs: completed ? { belonging: 0.01, leisure: 0.005 } : {},
        });
        if (completed && activity.targetId) {
          s.deryaChatCompleted = { at: s.minute, partnerId: activity.targetId };
          line(
            s,
            'social-chat-completed',
            `Derya finishes a fifteen-minute conversation with ${nameOf(activity.targetId)}.`,
            p.id,
            activity.targetId,
          );
          talk(s, p.id, activity.targetId, true);
        }
      } else
        finish(p, { affordanceId: activity.affordanceId, action, status: 'completed', at: s.minute, needs });
    }
    const minute = s.minute % 1440;
    if (s.version >= 4 && p.id === 'derya' && s.minute >= 13 * 1440 + 390) {
      if (!s.deryaAssignmentReleased) {
        s.deryaAssignmentReleased = true;
        line(
          s,
          'one-cast-release',
          'Derya’s short relief assignment has ended. She returns to flat 5 in Lale Apartmanı.',
          'derya',
        );
      }
      s.locations.derya = 'flat-5';
      // The final local activity completed above. The next chapter owns her next duty.
      continue;
    }
    // A short post-shift / delivery pause makes the ordinary encounter playable.
    // The prior activity was completed above; no running activity is discarded.
    if (s.version >= 4 && ['derya', 'dilan-delivery'].includes(p.id) && minute === 390) continue;
    const sleeping =
      s.version >= 4 && p.id === 'derya' ? minute >= 480 && minute < 780 : minute >= 1380 || minute < 360;
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
    if (
      s.version >= 5 &&
      p.id === 'derya' &&
      !p.body.asleep &&
      nurseOffDuty(s) &&
      ['garden', 'fountain'].includes(s.locations.derya ?? '')
    ) {
      const partner = Object.values(s.people).find(
        (other) =>
          other.id !== p.id &&
          s.locations[other.id] === s.locations.derya &&
          socialPartnerAvailable(s, other.id) &&
          (!other.activity || other.activity.endsAt > s.minute),
      );
      if (partner)
        offers.push({
          id: 'nurse-chat',
          action: 'chat',
          label: `Talk with ${partner.name}`,
          duration: 15,
          effort: 0.02,
          // A tired night nurse must attend to a conversation; it is not free rest.
          focus: 0.15,
          with: [partner.id],
          targetId: partner.id,
          placeId: s.locations.derya,
          advertises: { belonging: 0.01, leisure: 0.005 },
        });
    }
    const choice = decide(p, offers, { now: s.minute });
    const chosen = offers.find((a) => a.id === choice.chosenAffordanceId);
    if (chosen) {
      begin(p, chosen, choice);
      if (chosen.action === 'chat')
        line(
          s,
          'social-chat-started',
          `Derya settles into a fifteen-minute conversation with ${nameOf(chosen.targetId ?? '')}.`,
          p.id,
          chosen.targetId,
        );
      if (chosen.action === 'sleep' && s.held?.id !== p.id)
        s.locations[p.id] = PEOPLE.find((w) => w.id === p.id)?.home ?? s.locations[p.id]!;
    }
  }
  const t = s.minute % 1440,
    day = Math.floor(s.minute / 1440);
  processCommitments(s);
  const waiting = waitingQuestion(s);
  if (waiting && s.minute >= waiting.at + 120) giveUpQuestion(s);
  if (s.scene) for (const id of s.scene.who) s.locations[id] = 'garden';
  const incident = dailyIncidents(s.version)[day];
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
        title: storyScene(incident.day, s.version)!.title,
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
    giveUpQuestion(s);
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
    giveUpQuestion(s);
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
    s.stories.push({ id: 15, day: 1, title: storyScene(15, s.version)!.title, target: 'kemal', truth: true });
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
  reportThreads(s);
  const due = s.pendingConfrontations!.filter((p) => p.due <= s.minute);
  const shown = new Set<string>();
  for (const pending of due) {
    const root = s.routes[pending.root - 1]!;
    if (s.confronted.includes(root.id) || root.retractedAt) continue;
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
      if (s.confronted.includes(root.id) || root.retractedAt) continue;
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
        wedding.settled === 3 &&
        !wedding.worse &&
        wedding.trust > 0.65 &&
        !wedding.traced &&
        s.riza?.word?.status !== 'worse' &&
        s.riza?.word?.status !== 'mending'
          ? 'accepted'
          : 'refused';
      milestone.status = s.engagement === 'accepted' ? 'met' : 'missed';
      const text =
        s.engagement === 'accepted'
          ? 'Rıza: “Come with your mother on Sunday. Let us talk about the wedding.”'
          : `Rıza: “${wedding.traced ? 'A false account from you reached my household.' : wedding.trust <= 0.57 ? 'I cannot rely on your word, Hatice.' : 'I still have doubts about Emre.'} Our families should leave this here.”`;
      line(s, 'engagement', text, 'riza');
      openScene(s, {
        id: 'family-13',
        kind: 'word',
        who: ['riza', 'emre', 'elif'],
        text,
        choices: [{ id: 'acknowledge', label: 'Hear his answer', says: 'I hear you, Rıza.' }],
        since: s.minute,
        until: s.minute + 120,
        fallback: 'acknowledge',
      });
    } else {
      const met =
        wedding.settled >= (milestone.day === 4 ? 1 : 2) &&
        !wedding.worse &&
        !wedding.traced &&
        s.riza?.word?.status !== 'worse';
      milestone.status = met ? 'met' : 'missed';
      familyScene(s, milestone.day, met);
    }
  }
  if (s.version >= 3 && !s.elifAsked && s.minute >= 5 * 1440 + 1080) {
    s.elifAsked = true;
    elifScene(s);
  }
  updateRiza(s);
  interruptDeryaChat(s);
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
  while (g.s.minute < target && !g.s.ended) {
    const quarter = (Math.floor(g.s.minute / 15) + 1) * 15;
    const boundary = Math.min(target, quarter, g.s.held?.until ?? Infinity, g.s.scene?.until ?? Infinity);
    g.s.minute = boundary;
    if (g.s.held && g.s.held.until <= boundary) release(g.s);
    expireScene(g.s);
    interruptDeryaChat(g.s);
    if (boundary === quarter) step(g.s);
  }
}
export function replay(
  seed: number,
  inputs: LoggedInput[],
  minute: number,
  version: State['version'] = 5,
  initialPeople?: Record<string, Person>,
  initialContinuity?: ContinuityState,
) {
  const g = newGame(seed, version, initialPeople, initialContinuity);
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
  if (![1, 2, 3, 4, 5].includes(g.s?.version) || !Array.isArray(g.inputs))
    throw new Error('Unsupported Hearsay save');
  if (
    g.fileHistory !== undefined &&
    (typeof g.fileHistory !== 'string' || !/^[a-f0-9-]{36}$/.test(g.fileHistory))
  )
    throw new Error('Invalid file history provenance.');
  g.s.silence ??= {};
  g.s.confronted ??= [];
  g.s.greetings ??= {};
  g.s.groundTruth ??= { 'emre:honest': true, 'emre:reliable': true };
  g.s.pendingConfrontations ??= [];
  g.s.heardClaims ??= {};
  if (!g.s.stories) {
    g.s.stories = [...dailyIncidents(g.s.version), ...EMRE_INCIDENTS]
      .filter((scene) => g.s.incidentWitnesses?.['id' in scene ? scene.id : scene.day]?.includes('hatice'))
      .map((scene) => ({
        id: 'id' in scene ? scene.id : scene.day,
        day: scene.day,
        title: storyScene('id' in scene ? scene.id : scene.day, g.s.version)!.title,
        target: scene.target,
        truth: true,
      }));
    if (g.s.log.some((l) => l.kind === 'truth' && /heavy basket/.test(l.text)))
      g.s.stories.push({
        id: 15,
        day: 1,
        title: storyScene(15, g.s.version)!.title,
        target: 'kemal',
        truth: true,
      });
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
    quick: quickReplies(s),
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
      present(s).some((p) => p.id === dailyIncidents(s.version)[Math.floor(s.minute / 1440)]?.listener)
        ? dailyIncidents(s.version)[Math.floor(s.minute / 1440)]?.listener
        : undefined,
    households: Object.fromEntries(PEOPLE.map((p) => [p.id, String(p.household)])),
    riza: s.riza,
    stories: s.stories,
    days: s.days,
    engagement: s.engagement,
    ended: s.ended,
  };
}
