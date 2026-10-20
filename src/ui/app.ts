import { credence } from '@adam0white/human-framework';
import {
  act,
  advance,
  newGame,
  REPUTATION_TRAITS,
  replay,
  spokenClaim,
  tellingUnavailable,
  view,
} from '../sim/engine';
import { storyScene } from '../sim/incidents';
import type { Game, Input, Line, LoggedInput, State, Trait } from '../sim/types';
import { claimText, knownIncidentClaim } from '../sim/voices';
import { PEOPLE } from '../sim/world';
import { exportRun, verifyImport } from './export';
import { heardLines } from './heard';
import { lab, notebookRunOptions } from './lab';
import { drawMap, mapPersonAt } from './map';
import { get, put, putImmediate, putNow } from './store';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('Missing app');
const host = root;
let game: Game;
let saved: Game | null = null;
let speed = 5;
let playing = false;
let sendingRun = false;
let shownMinute = -1;
let last = performance.now();
let accumulator = 0;
let listener = '';
let target = 'kemal';
let trait: Trait | null = null;
let story: number | null = null;
let buySilence = false;
let firstStart = false;
let slowReason = '';
let dismissedIncident = 0;
type SceneMemory = { seed: number; dismissedIncident: number };
let sceneMemory: SceneMemory | null = null;
let chosenSpeed = 5;
let slowUntil = 0;
let seenLean = '';
let leanHighlightUntil = 0;
let talking: HTMLDialogElement | null = null;
let seenDoubts = new Map<string, string>();
const changedDoubts = new Map<string, number>();
let selectedDoubt = '';
let leanChanged = false;
let verbReason = '';
let seenIncident = 0;
let reply = '';
type Story = NonNullable<State['stories']>[number];
const state = () => game.s;

let acting = false;
let seenGarden = new Set<string>();
let shownPresence = '';
let shownRiza = '';
let shownScene = '';
let pendingScene = '';
let shownThreads = '';
let shownQuick = '';
let conversation: HTMLDialogElement | null = null;
let refreshConversation: (() => void) | null = null;
let pendingJournal: Promise<boolean> | null = null;
type Journal = { version: 1 | 2; seed: number; minute: number; inputs: LoggedInput[] };
function persistJournal(): Promise<boolean> {
  const writing = putImmediate('run-log', {
    version: game.s.version,
    seed: game.s.seed,
    minute: game.s.minute,
    inputs: game.inputs,
  } satisfies Journal);
  pendingJournal = writing;
  void writing.then(() => {
    if (pendingJournal === writing) pendingJournal = null;
  });
  return writing;
}
const speeds = [
  { label: 'Slow', rate: 1 },
  { label: 'Walk', rate: 5 },
  { label: 'Trot', rate: 20 },
  { label: 'Gallop', rate: 80 },
];
const html = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
const name = (id: string) => PEOPLE.find((p) => p.id === id)?.name ?? id;
const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const dayLabel = (day: number) => `Day ${day}, ${weekdays[(day - 1) % 7]}`;
const dateLabel = (m: number) =>
  `Day ${Math.floor(m / 1440) + 1}, ${weekdays[Math.floor(m / 1440) % 7]} ${clock(m)}`;
const clock = (m: number) =>
  `${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
function button(label: string, fn: () => void, classes = ''): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.className = classes;
  b.onclick = fn;
  return b;
}
function save(): void {
  if (game) void put('run', game);
}
function title(): void {
  playing = false;
  lab.screen('title');
  host.innerHTML = `<main class="title-page"><p class="eyebrow">A fortnight in the neighbourhood</p><h1>Hearsay<span class="subtitle">Someone will hear.</span></h1><div class="title-illustration" aria-hidden="true"><i></i><i></i><i></i><b>☕</b></div><p>You are Hatice. You keep the tea garden.<br>Your son hopes to marry the baker’s daughter.<br>This morning, you overhear something true.</p><div id="start"></div><p class="fine">Fourteen days. Six ways to answer.<br>Your words will find their way home.</p><button type="button" id="import-title" class="text-button">Import a run</button></main>`;
  host.querySelector('#start')?.append(
    button(
      saved ? 'Resume' : 'Start',
      async () => {
        firstStart = !saved;
        game = saved ?? newGame(crypto.getRandomValues(new Uint32Array(1))[0] ?? 1);
        resetScene();
        await persistJournal();
        save();
        playing = true;
        last = performance.now();
        lab.milestone('run started');
        render();
      },
      'primary',
    ),
  );
  if (saved) {
    const line = document.createElement('p');
    line.className = 'continue-line fine';
    line.textContent = `Continue · ${dayLabel(Math.floor(saved.s.minute / 1440) + 1)}${saved.s.days?.at(-1)?.tomorrow ? ` · ${saved.s.days.at(-1)?.tomorrow}` : ''}`;
    host.querySelector('#start')?.append(line);
  }
  host.querySelector('#import-title')?.addEventListener('click', importFile);
  if (saved?.s.ended)
    host.querySelector('#start')?.append(
      button(
        'Start another fortnight',
        async () => {
          saved = null;
          game = newGame(crypto.getRandomValues(new Uint32Array(1))[0] ?? 1);
          firstStart = true;
          resetScene();
          await persistJournal();
          save();
          lab.milestone('run started');
          playing = true;
          last = performance.now();
          render();
        },
        'text-button',
      ),
    );
}
function tableIncident(): Line | undefined {
  return game.s.log.findLast(
    (l) => l.kind === 'overheard' && l.id > dismissedIncident && game.s.minute - l.at < 120,
  );
}
function dismissIncident(): void {
  const incident = tableIncident();
  if (!incident) return;
  dismissedIncident = incident.id;
  sceneMemory = { seed: game.s.seed, dismissedIncident };
  void putImmediate('run-ui', sceneMemory);
  finishIncidentSlowdown();
  render();
}
function liveQuestion(): Line | undefined {
  if (!game.s.newsWaiting) return;
  const v = view(game.s);
  const question = game.s.log.findLast((l) => l.kind === 'question');
  if (!question?.speaker || !v.present.includes(question.speaker)) return;
  return question;
}
function finishIncidentSlowdown(): void {
  noticeVisitors();
}
function resetScene(): void {
  // A resumed or imported run has no open conversation sheet.
  if (game.s.held) act(game, { type: 'release' });
  talking = null;
  conversation = null;
  refreshConversation = null;
  chosenSpeed = 5;
  speed = 5;
  dismissedIncident = sceneMemory?.seed === game.s.seed ? sceneMemory.dismissedIncident : 0;
  seenIncident = 0;
  accumulator = 0;
  slowUntil = 0;
  slowReason = '';
  reply = '';
  verbReason = '';
  listener = '';
  story = null;
  seenLean = state().riza?.lean ?? 'unsure';
  leanHighlightUntil = 0;
  leanChanged = false;
  seenDoubts = new Map((state().riza?.doubts ?? []).map((d) => [d.key, JSON.stringify(d)]));
  changedDoubts.clear();
  selectedDoubt = '';
  pendingScene = '';
  seenGarden = new Set(view(game.s).present.filter((id) => game.s.locations[id] === 'garden'));
  noticeVisitors();
}
function noticeVisitors(): boolean {
  const previous = `${speed}:${slowReason}`;
  const present = view(game.s).present.filter((id) => id !== 'hatice');
  const garden = new Set(present.filter((id) => game.s.locations[id] === 'garden'));
  const arrivals = [...garden].filter((id) => !seenGarden.has(id));
  seenGarden = garden;
  const question = liveQuestion();
  const incident = tableIncident();
  const riza = state().riza;
  if (riza && riza.lean !== seenLean) {
    seenLean = riza.lean;
    leanChanged = true;
    leanHighlightUntil = performance.now() + 3000;
    slowUntil = game.s.minute + 6;
    slowReason = 'Rıza’s view of the marriage changed. Slowed to Slow.';
    accumulator = 0;
  } else if (incident && incident.id > seenIncident) {
    seenIncident = incident.id;
    slowReason = 'You overheard something. Slowed to Slow so you can read and choose whom to tell.';
  } else if (question) {
    slowReason = `${name(question.speaker ?? '')} is waiting for your answer. Slowed to Slow.`;
  } else if (arrivals.length && !previous.includes('The garden is quiet.')) {
    slowUntil = game.s.minute + 6;
    slowReason = `${arrivals.map(name).join(' and ')} arrived at your table. Slowed to Slow.`;
  } else if (!incident && game.s.minute >= slowUntil) {
    slowReason = '';
  } else if (!question && /waiting/.test(slowReason)) {
    slowReason = '';
  }
  for (const doubt of riza?.doubts ?? []) {
    if (seenDoubts.has(doubt.key) && seenDoubts.get(doubt.key) !== JSON.stringify(doubt)) {
      changedDoubts.set(doubt.key, performance.now() + 3000);
      leanHighlightUntil = performance.now() + 3000;
    }
    seenDoubts.set(doubt.key, JSON.stringify(doubt));
  }
  if (!present.length && !(game.s.minute < slowUntil && slowReason.startsWith('Rıza'))) {
    speed =
      speeds[Math.min(speeds.length - 1, speeds.findIndex((s) => s.rate === chosenSpeed) + 1)]?.rate ?? 80;
    slowReason = 'The garden is quiet. Time hurries until someone comes.';
  } else {
    if (slowReason.startsWith('The garden is quiet.')) slowReason = '';
    speed = slowReason ? 1 : chosenSpeed;
  }
  if (talking?.open) {
    speed = 1;
    slowReason = 'You are talking. Slowed to Slow.';
  }
  if (game.s.scene) {
    if (conversation) {
      endTalk(conversation);
      conversation.close();
      conversation = null;
      refreshConversation = null;
      window.scrollTo(0, 0);
    }
    speed = 1;
    slowReason = 'A conversation is waiting for your choice. Slowed to Slow.';
    if (pendingScene !== game.s.scene.id) {
      accumulator = 0;
      window.scrollTo(0, 0);
    }
  } else if (pendingScene) {
    speed = chosenSpeed;
    slowReason = '';
    slowUntil = 0;
    accumulator = 0;
  }
  pendingScene = game.s.scene?.id ?? '';
  return previous !== `${speed}:${slowReason}`;
}
function selectedBelief(subject: string): void {
  target = subject;
  story = null;
  const own = game.s.people.hatice;
  const household = PEOPLE.find((p) => p.id === subject)?.household === 0;
  const negative = new Set(['dishonest', 'unreliable', 'stingy', 'cruel', 'lazy', 'owes']);
  trait = own
    ? ((Object.keys(REPUTATION_TRAITS) as Trait[])
        .filter((word) => !household || !negative.has(word))
        .map((word) => ({ word, belief: credence(own, `${subject}:${word}`) }))
        .filter(({ belief }) => belief > 0.5)
        .sort((a, b) => b.belief - a.belief)[0]?.word ?? null)
    : null;
}
function storySentence(incident: Story): string {
  const scene = storyScene(incident.id);
  return scene ? `${'detail' in scene ? scene.detail : knownIncidentClaim(scene)}.` : incident.title;
}
function storyPreview(incident: Story): string {
  const scene = storyScene(incident.id);
  const settled =
    scene?.target === 'emre' &&
    scene.value &&
    state().riza?.doubts?.some((doubt) => doubt.key === scene.trait && doubt.status === 'settled');
  const already = settled ? ` Rıza already believes ${claimText('Emre', scene!.trait, true)}.` : '';
  return `You'll say: “${storySentence(incident)}”${already}`;
}
function unavailable(reason: string): string {
  return reason ? `aria-disabled="true" data-reason="${html(reason)}"` : '';
}
function explainLimits(scope: ParentNode): void {
  scope.querySelectorAll<HTMLButtonElement>('[data-reason]').forEach((b) => {
    b.onclick = () => {
      const reason = scope.querySelector<HTMLElement>('.verb-reason');
      if (reason) reason.textContent = b.dataset.reason ?? '';
    };
  });
}
function endTalk(d: HTMLDialogElement): void {
  if (talking !== d) return;
  talking = null;
  act(game, { type: 'release' });
  speed = chosenSpeed;
  slowUntil = 0;
  slowReason = '';
  accumulator = 0;
}
function departure(id: string, d: HTMLDialogElement): void {
  if (d.dataset.departed) return;
  d.dataset.departed = 'true';
  if (!d.classList.contains('talk-sheet')) {
    d.querySelector('.conversation-body')?.replaceChildren(
      Object.assign(document.createElement('p'), {
        textContent: `${name(id)} has moved on. Close this panel to choose someone else.`,
      }),
    );
    return;
  }
  const line = d.querySelector('.presence');
  if (line)
    line.textContent = `${name(id)}’s tea is finished. They have moved on. Close this panel to choose someone else.`;
  d.querySelectorAll<HTMLButtonElement>('[data-verb]').forEach((b) => {
    b.disabled = true;
  });
}
async function perform(input: Input): Promise<void> {
  if (acting) return;
  acting = true;
  try {
    if (pendingJournal) await pendingJournal;
    const before = game.s.log.at(-1)?.id ?? 0;
    const accepted = act(game, input);
    if (accepted && (input.type === 'tell' || input.type === 'defend' || input.type === 'tell-story'))
      lab.milestone('first word told');
    const lines = game.s.log.filter((l) => l.id > before);
    const answer = lines.findLast((l) => l.kind === 'reply' && l.reply?.to === game.inputs.length - 1);
    const reaction =
      input.type !== 'ask' && answer?.reply?.believes
        ? { yes: 'Believes you.', doubt: 'Doubts it.', no: 'Doesn’t believe you.', refuse: 'Won’t hear it.' }[
            answer.reply.believes
          ]
        : '';
    const will =
      answer?.reply?.will && !answer.text.includes(answer.reply.will) ? ` “${answer.reply.will}”` : '';
    reply = accepted
      ? answer
        ? `${answer.speaker ? name(answer.speaker) : 'Hatice'}: “${answer.text}” ${reaction}${will}`
        : lines
            .filter((l) => ['answer', 'shop', 'refusal'].includes(l.kind))
            .map((l) => `${l.speaker ? `${name(l.speaker)}: ` : ''}${l.text}`)
            .join(' ')
      : (tellingUnavailable(game.s, input) ??
        'They have moved on. Choose someone still at the garden or passing the fountain.');
    verbReason = '';
    firstStart = false;
    noticeVisitors();
    if (conversation) endTalk(conversation);
    await persistJournal();
    save();
    conversation?.close();
    conversation = null;
    refreshConversation = null;
    render();
    window.scrollTo(0, 0);
  } finally {
    acting = false;
  }
}
const standing = () =>
  ({
    full: 'The benches are full; people want your news.',
    lively: 'One empty bench. People still come for tea and your news.',
    quiet: 'Three empty benches. People are keeping their distance.',
    empty: 'The benches are empty. Your neighbours are keeping away.',
  })[game.s.garden];
function outwardLook(id: string): string {
  return game.s.locations[id] === 'fountain' ? 'Passing' : 'Seated';
}
function recentSubjects(): string[] {
  const today = Math.floor(game.s.minute / 1440);
  const subjects = new Set([
    ...view(game.s).present,
    ...PEOPLE.filter((p) => p.household === 0).map((p) => p.id),
    ...game.s.log
      .filter((l) => Math.floor(l.at / 1440) === today && l.target)
      .flatMap((l) => (l.target ? [l.target] : [])),
  ]);
  return PEOPLE.filter((p) => p.id !== 'hatice' && subjects.has(p.id)).map((p) => p.id);
}
function preview(kind: 'tell' | 'defend'): string {
  const opposites: Partial<Record<Trait, Trait>> = {
    dishonest: 'honest',
    unreliable: 'reliable',
    stingy: 'generous',
    cruel: 'kind',
    lazy: 'hardworking',
  };
  if (!trait) return 'Choose a word you want to say.';
  const word = kind === 'defend' ? (opposites[trait] ?? trait) : trait;
  const negative = kind === 'defend' && word === 'owes';
  const belief = game.s.people.hatice ? credence(game.s.people.hatice, `${target}:${word}`) : 0.5;
  const believed = negative ? belief < 0.5 : belief > 0.5;
  const sentence = `${spokenClaim(game.s, 'hatice', target, word, !negative)}.`;
  return `You'll say: ${sentence} ${believed ? 'You believe it.' : "You don't believe this. It would be a lie."}`;
}
function askTrait(): Trait {
  return trait ?? (story === null ? undefined : storyScene(story)?.trait) ?? 'honest';
}
function askPreview(): string {
  const questions: Record<Trait, string> = {
    honest: 'tell the truth',
    dishonest: 'lie',
    reliable: 'keep promises',
    unreliable: 'break promises',
    generous: 'give freely',
    stingy: 'hold back from giving',
    kind: 'treat people well',
    cruel: 'treat people cruelly',
    hardworking: 'work hard',
    lazy: 'avoid work',
    owes: 'owe money',
  };
  return `You'll ask: Does ${name(target)} ${questions[askTrait()]}?`;
}
function chooseTalk(id: string): void {
  if (!view(game.s).present.includes(id)) return;
  dismissIncident();
  listener = id;
  const talkTo = id;
  const d = dialog(`Talk to ${name(id)}`);
  conversation = d;
  d.classList.add('talk-sheet');
  talking = d;
  act(game, { type: 'sit', listener: id });
  speed = 1;
  accumulator = 0;
  slowReason = 'You are talking. Slowed to Slow.';
  void persistJournal().then(render);
  save();
  let fullList = false;
  const subjects = recentSubjects();
  if (!state().stories?.some((item) => item.id === story && item.target !== talkTo))
    selectedBelief(
      subjects.includes(target) && target !== talkTo
        ? target
        : (subjects.find((p) => p !== talkTo) ?? 'emre'),
    );
  const stories = [...(state().stories ?? [])];
  const body = document.createElement('div');
  body.className = 'conversation-body';
  d.append(body);
  let shownKnowledge = '';
  const update = () => {
    shownKnowledge = JSON.stringify(game.s.knownTellings) ?? '';
    const available = view(game.s).present.includes(talkTo);
    if (!available) {
      departure(talkTo, d);
      return;
    }
    for (const item of state().stories ?? [])
      if (!stories.some((shown) => shown.id === item.id)) stories.push(item);
    const selectedStory = stories.find((item) => item.id === story);
    const holdEnded = view(game.s).held?.id !== talkTo;
    const presenceText = holdEnded
      ? `${name(talkTo)}’s tea is finished. Their time with you has ended; they may leave now. The clock keeps moving.`
      : `${name(talkTo)} sits with you while you talk. The clock keeps moving.`;
    const tellReason =
      target === talkTo
        ? 'Tell someone else about this person.'
        : !trait && !selectedStory
          ? 'Choose a word or a story first.'
          : (tellingUnavailable(
              game.s,
              selectedStory
                ? { type: 'tell-story', listener: talkTo, incident: selectedStory.id }
                : { type: 'tell', listener: talkTo, target, trait: trait! },
            ) ?? '');
    const defendReason =
      target === talkTo
        ? 'Defend this person to someone else.'
        : !trait
          ? 'Choose a word first.'
          : (tellingUnavailable(game.s, { type: 'defend', listener: talkTo, target, trait }) ?? '');
    body.innerHTML = `<p class="fine presence" role="status">${html(presenceText)}</p><div class="talk-choices"><h3>About whom?</h3><div class="subject-chips">${(fullList ? PEOPLE.filter((p) => p.id !== 'hatice').map((p) => p.id) : subjects).map((p) => `<button type="button" data-target="${p}" aria-pressed="${target === p}">${html(name(p))}</button>`).join('')}<button type="button" id="other-person">${fullList ? 'Show today’s people' : 'Someone else…'}</button></div>${stories.length ? `<h3>Tell what you saw</h3><div class="story-chips">${stories.map((item) => `<button type="button" data-story="${item.id}" aria-pressed="${story === item.id}">${html(item.title)}</button>`).join('')}</div>${selectedStory ? `<p class="story-preview">You'll say: “${html(storySentence(selectedStory))}”</p>` : ''}` : ''}<h3>Which word?</h3><div class="word-chips">${Object.keys(
      REPUTATION_TRAITS,
    )
      .map(
        (word) =>
          `<button type="button" data-trait="${word}" aria-pressed="${trait === word}">${word === 'owes' ? 'owes money' : word}</button>`,
      )
      .join(
        '',
      )}</div></div><div class="talk-bar"><div class="statement"><p class="tell-preview">${html(selectedStory ? storyPreview(selectedStory) : preview('tell'))}</p><button type="button" data-verb="tell" ${unavailable(tellReason)}>Tell</button>${tellReason ? `<p class="telling-limit action-limit">${html(tellReason)}</p>` : ''}</div>${selectedStory || preview('tell') !== preview('defend') ? `<div class="statement"><p class="defend-preview">${html(preview('defend'))}</p><button type="button" data-verb="defend" ${unavailable(defendReason)}>Defend</button>${defendReason ? `<p class="defending-limit action-limit">${html(defendReason)}</p>` : ''}</div>` : ''}<p class="ask-preview">${html(askPreview())}</p><div class="conversation-actions"><button type="button" data-verb="ask" ${unavailable(target === talkTo ? 'Ask someone else about this person.' : '')}>Ask</button><button type="button" data-verb="make-amends">Make amends</button></div><p class="verb-reason" role="status"></p><p class="fine">Ask about ${html(name(target))}, or withdraw what you told ${html(name(talkTo))} about them.</p></div>`;
    body.querySelectorAll<HTMLButtonElement>('[data-target]').forEach((b) => {
      b.onclick = () => {
        selectedBelief(b.dataset.target ?? target);
        update();
      };
    });
    body.querySelectorAll<HTMLButtonElement>('[data-trait]').forEach((b) => {
      b.onclick = () => {
        trait = b.dataset.trait as Trait;
        story = null;
        update();
      };
    });
    body.querySelectorAll<HTMLButtonElement>('[data-story]').forEach((b) => {
      b.onclick = () => {
        const item = stories.find((item) => item.id === Number(b.dataset.story));
        if (item) {
          target = item.target;
          trait = null;
          story = item.id;
          update();
        }
      };
    });
    body.querySelector('#other-person')?.addEventListener('click', () => {
      fullList = !fullList;
      update();
    });
    body.querySelectorAll<HTMLButtonElement>('[data-verb]:not([data-reason])').forEach((b) => {
      b.onclick = () => {
        const type = b.dataset.verb as 'tell' | 'defend' | 'ask' | 'make-amends';
        if (type === 'tell' && story !== null) {
          void perform({ type: 'tell-story', listener: talkTo, incident: story });
        } else if ((type === 'tell' || type === 'defend') && trait) {
          void perform({ type, listener: talkTo, target, trait });
        } else if (type === 'ask') {
          void perform({ type, listener: talkTo, target, trait: askTrait() });
        } else if (type === 'make-amends') {
          void perform({ type, listener: talkTo, target });
        }
      };
    });
    explainLimits(body);
  };
  refreshConversation = () => {
    if (!view(game.s).present.includes(talkTo)) {
      departure(talkTo, d);
      return;
    }
    if (
      (state().stories?.length ?? 0) !== body.querySelectorAll('[data-story]').length ||
      shownKnowledge !== (JSON.stringify(game.s.knownTellings) ?? '')
    ) {
      update();
      return;
    }
    const presence = body.querySelector('.presence');
    if (presence)
      presence.textContent =
        view(game.s).held?.id === talkTo
          ? `${name(talkTo)} sits with you while you talk. The clock keeps moving.`
          : `${name(talkTo)}’s tea is finished. Their time with you has ended; they may leave now. The clock keeps moving.`;
    const tell = body.querySelector('.tell-preview');
    const selectedStory = stories.find((item) => item.id === story);
    if (tell) tell.textContent = selectedStory ? storyPreview(selectedStory) : preview('tell');
    const defend = body.querySelector('.defend-preview');
    if (defend) defend.textContent = preview('defend');
  };
  update();
}
function choosePasser(id?: string): void {
  if (id) dismissIncident();
  const d = dialog(id ? `${name(id)} is passing` : 'Call someone over');
  conversation = d;
  const body = document.createElement('div');
  body.className = 'conversation-body';
  d.append(body);
  const update = () => {
    const nearby = view(game.s).present.filter((p) => p !== 'hatice');
    if (id && !nearby.includes(id)) {
      departure(id, d);
      return;
    }
    body.replaceChildren();
    const people = id ? nearby.filter((p) => p === id) : nearby;
    const p = document.createElement('p');
    p.textContent = 'Only people at the garden or passing the fountain can hear you.';
    body.append(p);
    for (const person of people) {
      body.append(
        button(`Call over ${name(person)}`, () =>
          perform({ type: 'call-over', person, ...(buySilence ? { buySilence: true } : {}) }),
        ),
      );
    }
    if (!people.length) body.append(document.createTextNode('No one is close enough just now.'));
    const offer = document.createElement('label');
    offer.className = 'silence-offer';
    offer.innerHTML = `<input type="checkbox" ${buySilence ? 'checked' : ''}> Pay for their tea and ask for silence`;
    offer.querySelector('input')?.addEventListener('change', (e) => {
      buySilence = (e.target as HTMLInputElement).checked;
    });
    body.append(offer);
  };
  refreshConversation = update;
  update();
}
function feedText(line: Game['s']['log'][number]): string {
  if (line.kind !== 'echo') return line.text;
  const speakers = line.who ?? [];
  const names = speakers.slice(0, 2).map(name);
  const others = Math.max(0, speakers.length - names.length);
  const claim = line.text.split(': heard again')[0] ?? line.text;
  return `${claim}: heard again${names.length ? ` from ${names.join(', ')}${others ? ` and ${others} others` : ''}` : ''}${line.count ? ` (${line.count} ${line.count === 1 ? 'echo' : 'echoes'})` : ''}`;
}
function sceneCard(): string {
  const scene = game.s.scene;
  if (!scene) return '';
  return `<aside class="scene-card" data-scene="${html(scene.id)}" aria-label="A conversation waiting"><h2>${scene.who.map((id) => html(name(id))).join(' · ')}</h2><p>${html(scene.text)}</p><div class="scene-choices">${scene.choices.map((c) => `<button type="button" data-choice="${html(c.id)}"><strong>${html(c.label)}</strong><small>${html(c.says)}</small>${c.risk ? `<small class="choice-risk">${html(c.risk)}</small>` : ''}</button>`).join('')}</div></aside>`;
}
function rizaCard(): string {
  const riza = state().riza;
  const changing = performance.now() < leanHighlightUntil;
  const doubts = riza?.doubts ?? [];
  const selected = selectedDoubt === 'word' ? riza?.word : doubts.find((d) => d.key === selectedDoubt);
  const next = riza?.steps?.find((step) => step.status === 'ahead');
  const causes = [
    ...(changing && leanChanged && riza?.cause ? [riza.cause] : []),
    ...doubts
      .filter((d) => (changedDoubts.get(d.key) ?? 0) > performance.now())
      .flatMap((d) => (d.because ? [d.because] : [])),
  ];
  const labels = { honest: 'Honesty', reliable: 'Promises', kind: 'Kindness' };
  const marks = { open: '?', settled: '✓', worse: '!', mending: '↺' };
  const threads = [...(state().threads ?? [])].sort((a, b) => b.at - a.at || b.id - a.id).slice(0, 2);
  return `<aside class="riza-mind${changing ? ' lean-changed' : ''}" aria-label="Rıza’s mind"><p class="lean-label"><span class="lean-mark ${riza?.lean ?? 'unsure'}" aria-hidden="true"></span>Rıza leans ${riza?.lean ?? 'unsure'}</p>${doubts.length || riza?.word ? `<div class="doubt-chips${riza?.word ? ' has-word' : ''}">${doubts.map((d) => `<button type="button" data-doubt="${d.key}" aria-pressed="${selectedDoubt === d.key}" class="${(changedDoubts.get(d.key) ?? 0) > performance.now() ? 'doubt-changed' : ''}">${labels[d.key]}<small>${marks[d.status]} ${d.status}</small></button>`).join('')}${riza?.word ? `<button type="button" data-word aria-pressed="${selectedDoubt === 'word'}">Your word<small>${marks[riza.word.status]} ${riza.word.status}</small></button>` : ''}</div>` : ''}${threads.map((t) => `<p class="message-thread">${html(name(t.who))} → ${html(name(t.to))}: ${html(t.about)}${t.where ? ` · ${html(t.where)}` : ''} <span>${t.status === 'stalled' ? html(t.reason ?? `${name(t.who)} hasn't brought back word of reaching ${name(t.to)}.`) : t.status}</span></p>`).join('')}${selected ? `<p class="doubt-detail" role="status">“${html(selected.words)}”${selected.because ? `<br>${html(selected.because)}` : ''}${'mend' in selected && selected.mend ? `<br>${html(selected.mend)}` : ''}</p>` : ''}${causes.length ? `<p class="riza-cause" role="status">${[...new Set(causes)].map(html).join(' ')}</p>` : ''}<p class="next-step">${next ? `Next: ${html(next.label)} · ${dayLabel(next.day)}` : `The answer · ${dayLabel(riza?.answerDay ?? 13)}`}</p></aside>`;
}
function render(): void {
  if (!playing || pendingJournal) return;
  const v = view(game.s);
  if (game.s.ended) {
    review();
    return;
  }
  lab.screen('play');
  shownMinute = game.s.minute;
  const present = v.present.filter((id) => id !== 'hatice');
  if (!present.includes(listener)) listener = '';
  const incident = tableIncident();
  const question = liveQuestion();
  const riza = state().riza;
  shownPresence = presenceStamp();
  shownRiza = JSON.stringify(riza);
  shownScene = JSON.stringify(game.s.scene) ?? '';
  shownThreads = JSON.stringify(game.s.threads) ?? '';
  shownQuick = JSON.stringify(v.quick) ?? '';
  const trusted = PEOPLE.filter((p) =>
    riza?.doubts?.some((d) => d.status === 'open' && d.words.split('?').slice(1).join('?').includes(p.name)),
  ).map((p) => p.id);
  const concerned = v.concerned;
  const holdReason = question ? '' : 'No one has asked you anything.';
  const callReason = present.length ? '' : 'No one is close enough to hear you.';
  const introduction = firstStart
    ? `<aside class="first-start" aria-label="How to play"><p>Keep your word good. See Emre married.</p><p>Tap people at the table or passing on the map.</p><p>Your standing fills benches. Watch Rıza’s mind.</p><p>Speak only to people here. Hear only nearby talk.</p><p>Someone will ask you for news soon.</p><button type="button" id="dismiss-intro">Got it</button></aside>`
    : '';
  host.innerHTML = `<main class="game${incident ? ' has-incident' : ''}"><header><a class="wordmark" href="#" id="home">Hearsay</a><div class="clock" id="clock">${dateLabel(game.s.minute)}</div><button type="button" id="game-menu" class="text-button">Game menu</button></header>${introduction}<div class="speeds" role="group" aria-label="Time speed">${speeds.map((s) => `<button type="button" data-speed="${s.rate}" aria-pressed="${speed === s.rate}" ${chosenSpeed === s.rate ? 'data-chosen="true"' : ''}>${s.label}</button>`).join('')}</div>${slowReason ? `<p class="slow-reason" role="status">${html(slowReason)}</p>` : ''}<section class="garden" aria-label="Your tea garden">${sceneCard()}${rizaCard()}<section class="conversation-panel" aria-label="Conversation"><div class="section-heading"><h2>At your table</h2><span>and by the fountain</span></div>${reply ? `<p class="reply" role="status">${html(reply)}</p>` : ''}${question ? `<p class="question">${html(name(question.speaker ?? ''))}: ${html(question.text)}</p>` : ''}${v.quick ? `<div class="quick-replies" aria-label="Answer ${html(name(v.quick.listener))}">${v.quick.options.map((option, i) => `<button type="button" data-quick="${i}"><strong>${html(option.label)}</strong><small>${html(option.says)}</small></button>`).join('')}</div>` : ''}<div class="actions"><button type="button" class="primary" data-open-talk ${unavailable(present.length ? '' : 'No one is close enough. Wait for someone at the garden or fountain.')}>Talk to…</button><div class="action-option"><button type="button" id="hold" ${unavailable(holdReason)}>Hold your tongue</button>${holdReason ? `<small class="action-limit">${html(holdReason)}</small>` : ''}</div><div class="action-option"><button type="button" id="call" ${unavailable(callReason)}>Call over</button>${callReason ? `<small class="action-limit">${html(callReason)}</small>` : ''}</div></div><p class="verb-reason" role="status">${html(verbReason)}</p></section>${incident ? `<aside class="table-incident" aria-label="What you overheard"><p>${html(incident.text)}</p></aside>` : ''}<div class="people-chips" aria-label="People close enough to talk">${present.map((id) => `<button type="button" data-person="${id}" aria-label="Talk to ${html(name(id))}"><strong>${html(name(id))}</strong><small>${outwardLook(id)}${v.households[id] === v.households.hatice ? ' · your household' : ''}${id === question?.speaker ? ' · waiting' : ''}</small>${trusted.includes(id) ? '<small class="riza-listens">Rıza listens to them</small>' : ''}${id === concerned ? '<small class="would-want">would want to know</small>' : ''}</button>`).join('') || '<p class="fine">No one is close enough. Watch for people passing.</p>'}</div><p class="standing">${standing()}</p>${game.s.engagement !== 'waiting' ? `<p class="engagement">${game.s.engagement === 'accepted' ? 'Rıza has agreed to the marriage.' : 'Rıza has refused the marriage.'}</p>` : ''}</section><div class="map-wrap"><canvas id="map" aria-label="The neighbourhood. Tap a person near the tea garden or fountain to call them over."></canvas><span class="map-caption">HATICE’S TEA GARDEN · TAP A PASSER-BY</span></div><section class="heard" aria-label="What you witnessed"><h2>What reaches your ears</h2><div role="log" aria-live="polite">${
    heardLines(game)
      .slice(-5)
      .reverse()
      .map(
        (l) =>
          `<article class="${l.kind === 'echo' ? 'echo' : ['overheard', 'witness', 'incident', 'witnessed'].includes(l.kind) ? 'incident' : ''}"><time>${clock(l.at)}</time><p>${!['echo', 'overheard', 'witness', 'incident', 'witnessed'].includes(l.kind) && l.speaker && l.speaker !== 'hatice' ? `<strong>${html(name(l.speaker))}</strong> · ` : ''}${html(feedText(l))}</p></article>`,
      )
      .join('') || '<p class="fine">The hill is waking.</p>'
  }</div></section><footer>Only what you witness, and what people tell you. Open Game menu for What you heard.</footer></main>`;
  host.querySelector('#home')?.addEventListener('click', (e) => {
    e.preventDefault();
    save();
    saved = game;
    title();
  });
  host.querySelector('#game-menu')?.addEventListener('click', gameMenu);
  host.querySelector('#dismiss-intro')?.addEventListener('click', () => {
    firstStart = false;
    render();
  });
  host.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((b) => {
    b.onclick = () => {
      chosenSpeed = Number(b.dataset.speed);
      slowUntil = 0;
      slowReason = '';
      noticeVisitors();
      render();
    };
  });
  host.querySelectorAll<HTMLButtonElement>('[data-person]').forEach((b) => {
    b.onclick = () => chooseTalk(b.dataset.person ?? '');
  });
  host.querySelectorAll('[data-open-talk]:not([data-reason])').forEach((b) => {
    b.addEventListener('click', () => {
      const waiting = liveQuestion()?.speaker;
      if (waiting) {
        chooseTalk(waiting);
        return;
      }
      const d = dialog('Who will you talk to?');
      conversation = d;
      const choices = document.createElement('div');
      d.append(choices);
      const update = () => {
        choices.replaceChildren();
        for (const person of view(game.s).present.filter((id) => id !== 'hatice'))
          choices.append(
            button(name(person), () => {
              d.close();
              chooseTalk(person);
            }),
          );
        if (!choices.childElementCount) choices.textContent = 'No one is close enough just now.';
      };
      refreshConversation = update;
      update();
    });
  });
  host
    .querySelector('#hold:not([data-reason])')
    ?.addEventListener('click', () => perform({ type: 'hold-tongue' }));
  host.querySelector('#call:not([data-reason])')?.addEventListener('click', () => choosePasser());
  explainLimits(host);
  host.querySelectorAll<HTMLButtonElement>('[data-reason]').forEach((b) => {
    b.onclick = () => {
      verbReason = b.dataset.reason ?? '';
      const reason = host.querySelector('.verb-reason');
      if (reason) reason.textContent = verbReason;
    };
  });
  host.querySelectorAll<HTMLButtonElement>('[data-doubt]').forEach((b) => {
    b.onclick = () => {
      selectedDoubt = selectedDoubt === b.dataset.doubt ? '' : (b.dataset.doubt ?? '');
      const key = b.dataset.doubt;
      render();
      host.querySelector<HTMLButtonElement>(`[data-doubt="${key}"]`)?.focus();
    };
  });
  host.querySelector('[data-word]')?.addEventListener('click', () => {
    selectedDoubt = selectedDoubt === 'word' ? '' : 'word';
    render();
    host.querySelector<HTMLButtonElement>('[data-word]')?.focus();
  });
  host.querySelectorAll<HTMLButtonElement>('[data-choice]').forEach((b) => {
    b.onclick = () => {
      const scene = v.scene;
      if (scene) void perform({ type: 'choose', scene: scene.id, choice: b.dataset.choice ?? '' });
    };
  });
  host.querySelectorAll<HTMLButtonElement>('[data-quick]').forEach((b) => {
    b.onclick = () => {
      const option = v.quick?.options[Number(b.dataset.quick)];
      if (option) void perform(option.input);
    };
  });
  showDayCard();
  const canvas = host.querySelector<HTMLCanvasElement>('#map');
  if (canvas) {
    drawMap(canvas, game.s, 0);
    canvas.onclick = (e) => {
      const id = mapPersonAt(canvas, e.clientX, e.clientY);
      if (id) choosePasser(id);
    };
  }
  if (v.lines.some((l) => l.kind === 'refusal')) lab.milestone('first refusal heard');
  if (v.lines.some((l) => l.kind === 'rumour')) lab.milestone('a rumour reached you');
  if (game.s.engagement !== 'waiting') lab.milestone('the engagement settled');
}
function dialog(titleText: string): HTMLDialogElement {
  document.querySelectorAll<HTMLDialogElement>('dialog').forEach((open) => {
    const wasTalking = talking === open;
    endTalk(open);
    if (wasTalking) void persistJournal().then(save);
    open.close();
  });
  const origin = document.activeElement as HTMLElement | null;
  const d = document.createElement('dialog');
  d.className = 'sheet';
  d.innerHTML = `<div class="dialog-head"><h2>${titleText}</h2><button type="button" aria-label="Close ${html(titleText)}">Close</button></div>`;
  d.querySelector('button')?.addEventListener('click', () => {
    const wasTalking = talking === d;
    endTalk(d);
    d.close();
    d.remove();
    if (wasTalking)
      void persistJournal().then(() => {
        save();
        render();
      });
    lab.screen(game?.s.ended ? 'review' : playing ? 'play' : 'title');
  });
  d.addEventListener('cancel', () => {
    if (talking === d) {
      endTalk(d);
      void persistJournal().then(() => {
        save();
        render();
      });
    }
  });
  d.addEventListener('close', () => {
    const wasTalking = talking === d;
    endTalk(d);
    if (wasTalking)
      void persistJournal().then(() => {
        save();
        render();
      });
    if (conversation === d) {
      conversation = null;
      refreshConversation = null;
    }

    origin?.focus();
    lab.screen(game?.s.ended ? 'review' : playing ? 'play' : 'title');
    d.remove();
  });
  document.body.append(d);
  d.showModal();
  return d;
}
function gameMenu(): void {
  lab.screen('game-menu');
  const d = dialog('Game menu');
  d.dataset.systemMenu = 'true';
  const p = document.createElement('p');
  p.textContent =
    'Save the whole run: your seed, choices, state and a replay fingerprint. An imported run must replay exactly before it replaces your garden.';
  d.append(p);
  const journal = document.createElement('details');
  journal.innerHTML = `<summary>What you heard</summary><div class="journal">${heardLines(game)
    .map(
      (l) =>
        `<p><time>Day ${Math.floor(l.at / 1440) + 1} · ${clock(l.at)}</time><br>${l.speaker && !['overheard', 'witness', 'incident', 'witnessed'].includes(l.kind) ? `${html(name(l.speaker))} · ` : ''}${html(feedText(l))}</p>`,
    )
    .join('')}</div>`;
  d.append(journal);
  const status = document.createElement('p');
  status.className = 'download-status';
  status.setAttribute('role', 'status');
  d.append(status);
  d.append(
    button('Download this run', () => {
      const blob = new Blob([JSON.stringify(exportRun(game), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hearsay-day${Math.floor(game.s.minute / 1440) + 1}.json`;
      a.click();
      status.textContent = `Saved ${a.download}`;
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }),
    button('Import a run', importFile),
    button('Send this run to the notebook', () => {
      d.close();
      d.remove();
      sendingRun = true;
      accumulator = 0;
      const resume = () => {
        sendingRun = false;
        accumulator = 0;
        last = performance.now();
      };
      // lab-client 0.1.2 has no close callback. Observe its veil leaving the document.
      const removed = new MutationObserver(() => {
        if (!document.querySelector('.hflab-veil')) {
          removed.disconnect();
          resume();
          host.querySelector<HTMLButtonElement>('#game-menu')?.focus();
        }
      });
      removed.observe(document.body, { childList: true, subtree: true });
      try {
        lab.openSendDialog({ getRun: () => exportRun(game), ...notebookRunOptions, onSent: resume });
        if (!document.querySelector('.hflab-veil')) {
          removed.disconnect();
          resume();
        }
      } catch (error) {
        removed.disconnect();
        resume();
        throw error;
      }
    }),
  );
  const privacy = document.createElement('p');
  privacy.className = 'fine';
  privacy.innerHTML =
    'Anonymous play events help improve Hearsay. Sending your run is your choice. <a href="https://human.adamwhite.work/lab/privacy/" target="_blank" rel="noreferrer">Privacy</a>';
  d.append(privacy);
  d.append(
    button(lab.eventsOn ? 'Turn anonymous events off' : 'Turn anonymous events on', () => {
      lab.setEventsOff(lab.eventsOn);
      d.close();
      d.remove();
      gameMenu();
    }),
  );
}
function importFile(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const imported = verifyImport(await file.text());
      game = imported;
      sceneMemory = null;
      await putImmediate('run-ui', null);
      firstStart = false;
      resetScene();
      saved = game;
      playing = true;
      document.querySelectorAll('dialog').forEach((d) => {
        d.remove();
      });
      await persistJournal();
      save();
      last = performance.now();
      render();
    } catch (error) {
      document.querySelectorAll('dialog').forEach((d) => {
        d.close();
      });
      const d = dialog('Run could not open');
      const p = document.createElement('p');
      p.textContent =
        error instanceof Error ? error.message : 'Invalid run. Your current garden is unchanged.';
      d.append(p);
    }
  };
  input.click();
}
function review(): void {
  playing = false;
  lab.screen('review');
  lab.milestone('fortnight ended');
  save();
  const routeHtml = (r: (typeof game.s.routes)[number]) =>
    `<p id="route-${r.id}"><time>Day ${Math.min(14, Math.floor(r.at / 1440) + 1)} · ${clock(r.at)}</time><br>${html(name(r.from))} → ${html(name(r.to))}<br><strong>${html(name(r.target))}: ${r.value ? '' : 'not '}${html(r.trait)}</strong>${r.lie ? ' · a lie' : ''}${r.steps ? ` · sharpened ${r.steps === 1 ? 'once' : 'twice'}` : ''}${r.confrontedAt !== undefined ? ' · traced and confronted' : ''}${r.retractionOf ? ` · withdraws #${r.retractionOf}` : ''}${r.retractedAt !== undefined ? ' · later withdrawn' : ''}<br><small>Route #${r.id}${r.parent ? ` · heard through #${r.parent}` : ''} · Started with ${html(name(r.origin))}</small></p>`;
  const byId = new Map(game.s.routes.map((r) => [r.id, r]));
  const descendsFrom = (id: number, root: number) => {
    let route = byId.get(id);
    const seen = new Set<number>();
    while (route && !seen.has(route.id)) {
      if (route.id === root) return true;
      seen.add(route.id);
      route = route.parent ? byId.get(route.parent) : undefined;
    }
    return false;
  };
  const personal = game.s.routes.filter((r) => r.from === 'hatice');
  const confrontations = [
    ...new Set(
      game.s.log.filter((l) => l.kind === 'confrontation' && l.speaker).map((l) => name(l.speaker ?? '')),
    ),
  ];
  const shopChanges = Object.entries(game.s.custom)
    .filter(([id, value]) => id !== 'hatice' && value < 0.8)
    .map(([id]) => name(id));
  const ownRoutes = personal
    .map(
      (root) =>
        `<details><summary>${html(name(root.to))} heard you say ${html(name(root.target))} ${root.value ? 'is' : 'is not'} ${html(root.trait)}${root.lie ? ' · your lie' : ''}${root.retractionOf ? ' · your withdrawal' : ''}</summary><div class="route-list">${game.s.routes
          .filter((r) => descendsFrom(r.id, root.id))
          .map(routeHtml)
          .join('')}</div></details>`,
    )
    .join('');
  host.innerHTML = `<main class="review"><p class="eyebrow">The end of the fortnight</p><h1>Words find their way.</h1><p>${game.s.engagement === 'accepted' ? 'Rıza has agreed. Emre and Elif may marry.' : game.s.engagement === 'refused' ? 'Rıza has refused the engagement. The two households will remember.' : 'The engagement remains unsettled.'}</p><h2>What changed</h2><p>Your garden ended ${html(game.s.garden)}. ${confrontations.length ? `${html(confrontations.join(', '))} traced words back to your gate.` : 'No neighbour confronted you at your gate.'} ${shopChanges.length ? `${html(shopChanges.join(' and '))} closed the shutters early.` : ''}</p><h2>The paths your words took</h2><p class="fine">Open one of your statements to follow its descendants. Withdrawals do not recall copies that have already travelled.</p>${ownRoutes || '<p>You started no testimony.</p>'}<details class="all-routes"><summary>The whole village: every rumour route</summary><p class="fine">This includes conversations you could not witness.</p><div class="route-list">${game.s.routes.map(routeHtml).join('') || '<p>No rumour travelled.</p>'}</div></details><h2>One question to carry</h2><p>Whose trust mattered when you chose what to say?</p><div id="review-actions"></div></main>`;
  host.querySelector('#review-actions')?.append(
    button('Game menu', gameMenu),
    button('Return to title', () => {
      saved = game;
      title();
    }),
  );
}
function presenceStamp(): string {
  return `${view(game.s)
    .present.map((id) => `${id}:${game.s.locations[id]}`)
    .join('|')}:${liveQuestion()?.id ?? ''}`;
}
function showDayCard(): void {
  const minuteOfDay = game.s.minute % 1440;
  if ((minuteOfDay >= 360 && minuteOfDay < 1380) || game.s.ended || document.querySelector('[data-day-card]'))
    return;
  const day = Math.floor(game.s.minute / 1440) + (minuteOfDay < 360 ? 0 : 1);
  const entry = state().days?.find((item) => item.day === day);
  const d = dialog(`Day ${day} has ended`);
  let sleeping = false;
  d.dataset.dayCard = 'true';
  d.dataset.systemMenu = 'true';
  d.querySelector('.dialog-head button')?.remove();
  d.addEventListener('cancel', (e) => e.preventDefault());
  const content = document.createElement('div');
  content.innerHTML = `${(entry?.summary ?? ['The garden has closed for the night.']).map((line) => `<p>${html(line)}</p>`).join('')}<p>${html(entry?.question ?? 'Who will come to your table tomorrow?')}</p>`;
  const dayAction = document.createElement('div');
  dayAction.className = 'day-action';
  dayAction.append(
    button(
      'Sleep',
      async () => {
        if (sleeping) return;
        sleeping = true;
        if (pendingJournal) await pendingJournal;
        advance(
          game,
          Math.min(
            20160,
            Math.floor(game.s.minute / 1440) * 1440 + (game.s.minute % 1440 < 360 ? 360 : 1800),
          ),
        );
        accumulator = 0;
        slowUntil = 0;
        noticeVisitors();
        await persistJournal();
        save();
        d.close();
        render();
      },
      'primary',
    ),
  );
  const tomorrow = document.createElement('p');
  tomorrow.className = 'tomorrow';
  tomorrow.textContent = entry?.tomorrow ?? entry?.question ?? 'Who will come tomorrow?';
  dayAction.append(tomorrow);
  d.append(dayAction, content);
}
function frame(now: number): void {
  if (now >= leanHighlightUntil) {
    host.querySelectorAll('.lean-changed, .doubt-changed').forEach((el) => {
      el.classList.remove('lean-changed', 'doubt-changed');
    });
    host.querySelector('.riza-cause')?.remove();
    leanChanged = false;
  }
  const elapsed = Math.min(250, now - last);
  last = now;
  if (
    playing &&
    game &&
    !game.s.ended &&
    !document.hidden &&
    !sendingRun &&
    !document.querySelector('dialog[data-system-menu]')
  ) {
    showDayCard();
    if (document.querySelector('[data-day-card]')) {
      requestAnimationFrame(frame);
      return;
    }
    accumulator += (elapsed * speed) / 1000;
    if (accumulator >= 1 && !pendingJournal) {
      const minutes = Math.floor(accumulator);
      accumulator -= minutes;
      const night = Math.floor(game.s.minute / 1440) * 1440 + 1380;
      const sceneBefore = game.s.scene?.id;
      const lineBefore = game.s.log.at(-1)?.id ?? 0;
      advance(game, Math.min(game.s.minute + minutes, night));
      if (sceneBefore && game.s.scene?.id !== sceneBefore) {
        const outcome = game.s.log.findLast(
          (l) => l.id > lineBefore && l.kind === 'reply' && l.reply?.to === -1,
        );
        const fallback = game.s.log.find((l) => l.id > lineBefore && l.kind === 'scene-fallback');
        if (outcome)
          reply = `${fallback ? `${fallback.text} ` : ''}${outcome.speaker ? `${name(outcome.speaker)}: ` : ''}${outcome.text}`;
      }
      const visitor = noticeVisitors();
      refreshConversation?.();
      const current = game;
      void persistJournal().then(() => {
        if (game !== current || !playing) return;
        if (
          visitor ||
          presenceStamp() !== shownPresence ||
          JSON.stringify(state().riza) !== shownRiza ||
          (JSON.stringify(state().scene) ?? '') !== shownScene ||
          (JSON.stringify(state().threads) ?? '') !== shownThreads ||
          (JSON.stringify(view(state()).quick) ?? '') !== shownQuick ||
          game.s.minute % 1440 >= 1380 ||
          Math.floor(game.s.minute / 15) !== Math.floor(shownMinute / 15)
        )
          render();
        const clockEl = host.querySelector('#clock');
        if (clockEl) clockEl.textContent = dateLabel(game.s.minute);
      });
    }
    const canvas = host.querySelector<HTMLCanvasElement>('#map');
    if (canvas) drawMap(canvas, game.s, elapsed);
  }
  requestAnimationFrame(frame);
}
export async function start(): Promise<void> {
  const [row, journalRow, sceneRow] = await Promise.all([
    get<Game>('run'),
    get<Journal>('run-log'),
    get<SceneMemory>('run-ui'),
  ]);
  const remembered = sceneRow?.value;
  sceneMemory =
    remembered && Number.isSafeInteger(remembered.seed) && Number.isSafeInteger(remembered.dismissedIncident)
      ? remembered
      : null;
  saved =
    [1, 2].includes(row?.value?.s?.version ?? 0) && Array.isArray(row?.value?.inputs)
      ? (row?.value ?? null)
      : null;
  const journal = journalRow?.value;
  if (
    journal &&
    [1, 2].includes(journal.version) &&
    Number.isSafeInteger(journal.seed) &&
    Number.isSafeInteger(journal.minute) &&
    journal.minute >= 360 &&
    journal.minute <= 20160 &&
    Array.isArray(journal.inputs)
  ) {
    try {
      if (
        !saved ||
        saved.s.version !== journal.version ||
        saved.s.seed !== journal.seed ||
        saved.s.minute !== journal.minute ||
        JSON.stringify(saved.inputs) !== JSON.stringify(journal.inputs)
      )
        saved = replay(journal.seed, journal.inputs, journal.minute, journal.version);
    } catch {
      /* Keep a valid full-state cache if a recovery journal was damaged. */
    }
  }
  title();
  requestAnimationFrame(frame);
  setInterval(save, 5000);
  window.addEventListener('pagehide', () => {
    if (game && !putNow('run', game)) save();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game && !putNow('run', game)) save();
    last = performance.now();
  });
}
