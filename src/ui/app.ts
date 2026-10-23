import '@adam0white/lab-kit/stage.css';
import { credence } from '@adam0white/human-framework';
import { telemetryNotice, telemetryToggle } from '@adam0white/lab-kit';
import {
  act,
  advance,
  load as loadGame,
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
import {
  arrive,
  type ContinuityGame,
  checkpointContinuity,
  continuityPanel,
  gateContinuity,
  installContinuity,
  invalidateContinuity,
  shelf,
  validateContinuity,
} from './continuity';
import { exportRun, verifyImport } from './export';
import { openFeedback } from './feedback';
import { heardLines } from './heard';
import { lab } from './lab';
import { drawMap, mapPersonAt } from './map';
import { automaticPace } from './pacing';
import { focusedPeople, personLabel, personRole } from './people';
import { get, put, putImmediate, putNow } from './store';
import { endingTally } from './tally';

const notice = telemetryNotice();
if (notice) Object.assign(notice.style, { position: 'static', transform: 'none', margin: '0 auto' });
const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('Missing app');
const host = root;
let game: ContinuityGame;
let saved: ContinuityGame | null = null;
let chosenSpeed = 0;
let skipping = false;
let replyOpen = false;
let storyTab = false;
let speed = 5;
let rampedSpeed = 5;
let playing = false;
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
let seenLean = '';
let leanHighlightUntil = 0;
let talking: HTMLDialogElement | null = null;
let seenDoubts = new Map<string, string>();
const changedDoubts = new Map<string, number>();
let selectedDoubt = '';
let leanChanged = false;
let reply = '';
let closeInformation: (() => void) | null = null;
type Story = NonNullable<State['stories']>[number];
const state = () => game.s;

let acting = false;
let shownPresence = '';
let shownRiza = '';
let shownScene = '';
let pendingScene = '';
let shownThreads = '';
let shownQuick = '';
let conversation: HTMLDialogElement | null = null;
let refreshConversation: (() => void) | null = null;
let stripObserver: ResizeObserver | null = null;
let sceneObserver: ResizeObserver | null = null;
let pendingJournal: Promise<boolean> | null = null;
type Journal = {
  fileHistory?: Game['fileHistory'];
  version: State['version'];
  seed: number;
  minute: number;
  inputs: LoggedInput[];
  initialPeople?: Game['initialPeople'];
  initialContinuity?: Game['initialContinuity'];
  continuity?: Game['continuity'];
};
function persistJournal(): Promise<boolean> {
  const writing = putImmediate('run-log', {
    version: game.s.version,
    ...(game.fileHistory ? { fileHistory: game.fileHistory } : {}),
    seed: game.s.seed,
    minute: game.s.minute,
    inputs: game.inputs,
    ...(game.initialPeople ? { initialPeople: game.initialPeople } : {}),
    ...(game.initialContinuity ? { initialContinuity: game.initialContinuity } : {}),
    ...(game.continuity ? { continuity: game.continuity } : {}),
  } satisfies Journal);
  pendingJournal = writing;
  void writing.then(() => {
    if (pendingJournal === writing) pendingJournal = null;
  });
  return writing;
}
const html = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
const name = (id: string) =>
  PEOPLE.find((p) => p.id === id)?.name ?? (id === 'dilan-delivery' ? 'Dilan' : id);
const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const dayLabel = (day: number) => `Day ${day}, ${weekdays[(day - 1) % 7]}`;
const dateLabel = (m: number) =>
  `Day ${Math.floor(m / 1440) + 1} · ${weekdays[Math.floor(m / 1440) % 7]} · ${clock(m)}`;
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
function setPhase(phase: string): void {
  const stage = host.querySelector<HTMLElement>('.lk-stage');
  if (stage) stage.dataset.phase = phase;
}
function topbar(label: string, start = false): string {
  return `<header class="topbar"><div class="topbar-title">${start ? '<a href="https://human.adamwhite.work/lab/">All games</a>' : `<span id="clock">${html(label)}</span>`}</div><div class="topbar-tools"><button type="button" id="game-info" aria-label="Information">i</button><button type="button" id="game-menu" aria-label="Game menu">≡<span class="desktop-menu-label"> Menu</span></button></div></header>`;
}
function bindTopbar(): void {
  host.querySelector('#game-info')?.addEventListener('click', information);
  host.querySelector('#game-menu')?.addEventListener('click', gameMenu);
}
async function beginFortnight(fresh = false): Promise<void> {
  invalidateContinuity();
  saved = null;
  game = await arrive(crypto.getRandomValues(new Uint32Array(1))[0] ?? 1, fresh);
  await gateContinuity(
    game,
    game.continuity?.entries.some((e) => e.scope === 'file'),
  );
  firstStart = true;
  resetScene();
  await persistJournal();
  save();
  playing = true;
  last = performance.now();
  lab.milestone('run started');
  render();
}
function title(): void {
  playing = false;
  lab.screen('title');
  host.innerHTML = `<main class="title-page">${topbar('', true)}<div class="title-content lk-sheet-body"><p class="eyebrow">A fortnight in the neighbourhood</p><h1>Hearsay<span class="subtitle">Someone will hear.</span></h1><div class="title-illustration" aria-hidden="true"><i></i><i></i><i></i><b>☕</b></div><div id="title-notice"></div><p>You are Hatice. You keep the tea garden.<br>Your son hopes to marry the baker’s daughter.<br>This morning, you overhear something true.</p><p class="goal">Help Emre marry Elif by Day 13, and keep your word good.</p><p class="fine">Fourteen days. Six ways to answer.<br>Your words will find their way home.</p><button type="button" id="other-ways" class="menu-row">Other ways in <span>▸</span></button></div><div id="start" class="lk-sheet-actions"></div></main>`;
  if (notice && !notice.dataset.shown) {
    host.querySelector('#title-notice')?.append(notice);
    notice.dataset.shown = '1';
  }
  const actions = host.querySelector('#start');
  actions?.append(
    button(
      saved ? 'Resume' : 'Start',
      async () => {
        if (!saved) {
          await beginFortnight();
          return;
        }
        invalidateContinuity();
        game = saved;
        await gateContinuity(game);
        firstStart = false;
        resetScene();
        await persistJournal();
        save();
        playing = true;
        last = performance.now();
        render();
      },
      'primary',
    ),
  );
  actions?.append(button('Start a fresh authored fortnight', () => void beginFortnight(true)));
  if (saved) {
    actions?.append(
      Object.assign(document.createElement('p'), {
        className: 'continue-line fine',
        textContent: `Continue · ${dayLabel(Math.floor(saved.s.minute / 1440) + 1)}`,
      }),
    );
    actions?.append(
      button('Begin a new fortnight', () => {
        if (saved?.s.ended) {
          void beginFortnight();
          return;
        }
        const confirmation = document.createElement('div');
        confirmation.className = 'new-confirmation';
        confirmation.append(
          Object.assign(document.createElement('p'), {
            textContent: 'This replaces the fortnight in progress.',
          }),
          button('Yes, begin', () => void beginFortnight()),
          button('No', () => confirmation.remove()),
        );
        actions.querySelector('.new-confirmation')?.remove();
        actions.append(confirmation);
      }),
    );
  }
  host.querySelector('#other-ways')?.addEventListener('click', () => {
    const d = dialog('Other ways in');
    d.dataset.systemMenu = 'true';
    const body = document.createElement('div');
    body.className = 'lk-sheet-body';
    body.innerHTML =
      '<p>A run must replay exactly before it replaces your garden.</p><p class="import-status" role="status"></p>';
    body.prepend(button('Load a playtest run', importFile));
    body.append(continuityPanel());
    d.append(body);
  });
  bindTopbar();
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
  chosenSpeed = 0;
  skipping = false;
  replyOpen = false;
  speed = 5;
  dismissedIncident = sceneMemory?.seed === game.s.seed ? sceneMemory.dismissedIncident : 0;
  accumulator = 0;
  slowReason = '';
  reply = '';
  listener = '';
  story = null;
  seenLean = state().riza?.lean ?? 'unsure';
  leanHighlightUntil = 0;
  leanChanged = false;
  seenDoubts = new Map((state().riza?.doubts ?? []).map((d) => [d.key, JSON.stringify(d)]));
  changedDoubts.clear();
  selectedDoubt = '';
  pendingScene = '';
  noticeVisitors();
}
function noticeVisitors(): boolean {
  const previous = `${speed}:${slowReason}`;
  const question = liveQuestion();
  const incident = tableIncident();
  const riza = state().riza;
  if (riza && riza.lean !== seenLean) {
    seenLean = riza.lean;
    leanChanged = true;
    leanHighlightUntil = performance.now() + 3000;
  }
  for (const doubt of riza?.doubts ?? []) {
    if (seenDoubts.has(doubt.key) && seenDoubts.get(doubt.key) !== JSON.stringify(doubt)) {
      changedDoubts.set(doubt.key, performance.now() + 3000);
      leanHighlightUntil = performance.now() + 3000;
    }
    seenDoubts.set(doubt.key, JSON.stringify(doubt));
  }
  if (game.s.scene && conversation) {
    const previousConversation = conversation;
    conversation = null;
    refreshConversation = null;
    endTalk(previousConversation);
    previousConversation.close();
  }
  // Re-evaluate every pending response. Ending one must not clear another's slowdown.
  slowReason = game.s.scene
    ? game.s.scene.kind === 'confrontation'
      ? 'Held · Someone is confronting you.'
      : 'Held · A conversation needs your choice.'
    : question
      ? `Held · ${name(question.speaker ?? '')} is waiting for your answer.`
      : incident
        ? 'Held · You overheard something. Choose whom to tell.'
        : talking?.open
          ? `Held · You are talking with ${name(listener)}.`
          : replyOpen
            ? 'Held · reading the reply'
            : conversation?.open
              ? 'Held · reading the wedding'
              : '';
  speed = automaticPace(
    !!slowReason,
    chosenSpeed || (view(game.s).present.some((id) => id !== 'hatice') ? 5 : 20),
    skipping,
  );
  const nextScene = game.s.scene?.id ?? '';
  if (pendingScene !== nextScene || previous !== `${speed}:${slowReason}`) accumulator = 0;
  pendingScene = nextScene;
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
  const scene = storyScene(incident.id, game.s.version);
  return scene ? `${'detail' in scene ? scene.detail : knownIncidentClaim(scene)}.` : incident.title;
}
function storyPreview(incident: Story): string {
  const scene = storyScene(incident.id, game.s.version);
  const settled =
    scene?.target === 'emre' &&
    scene.value &&
    state().riza?.doubts?.some((doubt) => doubt.key === scene.trait && doubt.status === 'settled');
  return (
    storySentence(incident) +
    (settled && scene ? ` Rıza already believes ${claimText('Emre', scene.trait, true)}.` : '')
  );
}
function unavailable(reason: string): string {
  return reason ? `disabled aria-disabled="true" data-reason="${html(reason)}"` : '';
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
  const question = liveQuestion();
  act(game, { type: 'release' });
  if (question?.speaker && !view(game.s).present.includes(question.speaker))
    reply = `${name(question.speaker)} has moved on. You have not answered their question.`;
  slowReason = '';
  accumulator = 0;
  noticeVisitors();
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
    const explanation = b.querySelector('small');
    if (explanation) explanation.textContent = `${name(id)} has moved on`;
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
    firstStart = false;
    noticeVisitors();
    if (conversation) endTalk(conversation);
    await persistJournal();
    save();
    const answeredTalk = conversation?.classList.contains('talk-sheet');
    conversation?.close();
    conversation = null;
    refreshConversation = null;
    render();
    if (answeredTalk) showReply();
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
  return trait ?? (story === null ? undefined : storyScene(story, game.s.version)?.trait) ?? 'honest';
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
  const d = dialog(`← ${name(id)} · ${personRole(id)}`);
  setPhase('talk');
  conversation = d;
  d.classList.add('talk-sheet');
  talking = d;
  act(game, { type: 'sit', listener: id });
  speed = 0;
  accumulator = 0;
  slowReason = `Held · You are talking with ${name(listener)}.`;
  void persistJournal().then(render);
  save();
  let fullList = false;
  storyTab = story !== null;
  const priorities = focusedPeople(game.s);
  const subjects = [...new Set([...priorities.primary.slice(0, 3), target])];
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
    const active = body.contains(document.activeElement) ? (document.activeElement as HTMLElement) : null;
    const focusAttribute = ['data-verb', 'data-target', 'data-trait', 'data-story'].find((key) =>
      active?.hasAttribute(key),
    );
    const focusSelector = focusAttribute
      ? `[${focusAttribute}="${active?.getAttribute(focusAttribute)}"]`
      : active?.id
        ? `#${active.id}`
        : '';
    const shownSubjects = [...new Set([...priorities.primary.slice(0, 3), target])];
    const otherSubjects = [...priorities.primary, ...priorities.others].filter(
      (id) => !shownSubjects.includes(id),
    );
    body.innerHTML = `<div class="talk-choices lk-sheet-body"><p class="fine presence" role="status">${holdEnded ? 'Their tea is finished; they may leave.' : ''}</p><h3>About whom?</h3><div class="subject-chips">${(fullList ? [...shownSubjects, ...otherSubjects] : shownSubjects).map((p) => `<button type="button" data-target="${p}" aria-pressed="${target === p}">${html(personLabel(p))}</button>`).join('')}<button type="button" id="other-person">${fullList ? 'Fewer people' : `Everyone else (${otherSubjects.length})`}</button></div><div class="talk-segments"><button type="button" data-tab="word" aria-pressed="${!storyTab}">A word</button><button type="button" data-tab="story" aria-pressed="${storyTab}">What you saw (${stories.length})</button></div>${
      storyTab
        ? `<div class="story-chips">${stories.map((item) => `<button type="button" data-story="${item.id}" aria-pressed="${story === item.id}">${html(item.title)}</button>`).join('')}</div>${selectedStory ? `<p class="story-preview">${html(storyPreview(selectedStory))}</p>` : '<p>Choose something you saw.</p>'}`
        : `<div class="word-chips word-grid">${Object.keys(REPUTATION_TRAITS)
            .map(
              (word) =>
                `<button type="button" data-trait="${word}" aria-pressed="${trait === word}">${word === 'owes' ? 'owes money' : word}</button>`,
            )
            .join('')}</div>`
    }</div><div class="talk-bar lk-sheet-actions talk-actions"><button type="button" class="verb-main" data-verb="tell" ${unavailable(tellReason)}><strong>Tell ${html(name(talkTo))}</strong><small class="tell-preview${!tellReason && !selectedStory && preview('tell').includes('It would be a lie') ? ' lie-warning' : ''}">${html(tellReason || (selectedStory ? storyPreview(selectedStory) : preview('tell').replace("You'll say: ", '')))}</small></button><button type="button" class="verb-main" data-verb="ask" ${unavailable(target === talkTo ? 'Ask someone else about this person.' : '')}><strong>Ask ${html(name(talkTo))}</strong><small class="ask-preview">${html(target === talkTo ? 'Ask someone else about this person.' : askPreview().replace("You'll ask: ", ''))}</small></button><div class="minor-verbs">${selectedStory || preview('tell') !== preview('defend') ? `<button type="button" class="verb-minor" data-verb="defend" ${unavailable(defendReason)}><strong>Defend ${html(name(target))}</strong><small>${html(defendReason || preview('defend').replace("You'll say: ", ''))}</small></button>` : ''}<button type="button" class="verb-minor" data-verb="make-amends"><strong>Take back my words</strong><small>what you told ${html(name(talkTo))} about ${html(name(target))}</small></button></div></div>`;
    body.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => {
      b.onclick = () => {
        storyTab = b.dataset.tab === 'story';
        update();
      };
    });
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
        storyTab = false;
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
          storyTab = true;
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
    if (focusSelector) body.querySelector<HTMLElement>(focusSelector)?.focus({ preventScroll: true });
  };
  refreshConversation = () => {
    if (!view(game.s).present.includes(talkTo)) {
      departure(talkTo, d);
      return;
    }
    if (
      (state().stories?.length ?? 0) !== stories.length ||
      shownKnowledge !== (JSON.stringify(game.s.knownTellings) ?? '')
    ) {
      update();
      return;
    }
    const presence = body.querySelector('.presence');
    if (presence)
      presence.textContent = view(game.s).held?.id === talkTo ? '' : 'Their tea is finished; they may leave.';
  };
  update();
}
function choosePasser(id?: string): void {
  if (id) dismissIncident();
  const d = dialog(id ? `${name(id)} is passing` : 'Call someone over');
  conversation = d;
  const body = document.createElement('div');
  body.className = 'conversation-body lk-sheet-body';
  d.append(body);
  const update = () => {
    const nearby = view(game.s).present.filter((p) => p !== 'hatice');
    if (id && !nearby.includes(id)) {
      departure(id, d);
      return;
    }
    body.replaceChildren();
    const people = id ? nearby.filter((p) => p === id) : focusedPeople(game.s, nearby).primary;
    const p = document.createElement('p');
    p.textContent = 'Only people at the garden or passing the fountain can hear you.';
    body.append(p);
    for (const person of people) {
      body.append(
        button(`Call over ${personLabel(person)}`, () =>
          perform({ type: 'call-over', person, ...(buySilence ? { buySilence: true } : {}) }),
        ),
      );
    }
    if (!people.length) body.append(document.createTextNode('No one is close enough just now.'));
    const offer = document.createElement('label');
    offer.className = 'silence-offer';
    offer.innerHTML = `<input type="checkbox" role="switch" ${buySilence ? 'checked' : ''}> Pay for their tea and ask for silence`;
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
  return `<aside class="riza-mind${changing ? ' lean-changed' : ''}" aria-label="Rıza’s mind"><p class="lean-label"><span class="lean-mark ${riza?.lean ?? 'unsure'}" aria-hidden="true"></span>Rıza leans ${riza?.lean ?? 'unsure'}</p>${doubts.length || riza?.word ? `<div class="doubt-chips${riza?.word ? ' has-word' : ''}">${doubts.map((d) => `<button type="button" data-doubt="${d.key}" aria-pressed="${selectedDoubt === d.key}" class="${(changedDoubts.get(d.key) ?? 0) > performance.now() ? 'doubt-changed' : ''}">${labels[d.key]} ▸<small>${marks[d.status]} ${d.status}</small></button>`).join('')}${riza?.word ? `<button type="button" data-word aria-pressed="${selectedDoubt === 'word'}">Your word ▸<small>${marks[riza.word.status]} ${riza.word.status}</small></button>` : ''}</div>` : ''}${selected ? `<p class="doubt-detail" role="status">“${html(selected.words)}”${selected.because ? `<br>${html(selected.because)}` : ''}${'mend' in selected && selected.mend ? `<br>${html(selected.mend)}` : ''}</p>` : ''}${threads.map((t) => `<p class="message-thread">${html(name(t.who))} → ${html(name(t.to))}: ${html(t.about)}${t.where ? ` · ${html(t.where)}` : ''} <span>${t.status === 'stalled' ? html(t.reason ?? `${name(t.who)} hasn't brought back word of reaching ${name(t.to)}.`) : t.status}</span></p>`).join('')}${causes.length ? `<p class="riza-cause" role="status">${[...new Set(causes)].map(html).join(' ')}</p>` : ''}<p class="next-step">${next ? `Next: ${html(next.label)} · ${dayLabel(next.day)}` : `The answer · ${dayLabel(riza?.answerDay ?? 13)}`}</p></aside>`;
}
function fortnightTrack(): string {
  const day = Math.floor(game.s.minute / 1440) + 1;
  return `<div class="fortnight-track" aria-label="Fourteen days; coffee Day 4, his word Day 8, answer Day 13">${Array.from({ length: 14 }, (_, i) => `<span class="day-tick${i + 1 === day ? ' today' : ''}${i + 1 < day ? ' past' : ''}" title="Day ${i + 1}${i === 3 ? ': family coffee' : i === 7 ? ': his word' : i === 12 ? ': answer' : ''}">${i === 3 ? '☕' : i === 7 ? '◇' : i === 12 ? '✦' : '·'}</span>`).join('')}</div>`;
}
function weddingStrip(): string {
  const r = state().riza;
  const marks = { open: '?', settled: '✓', worse: '!', mending: '↺' };
  return `<button type="button" class="wedding-button${performance.now() < leanHighlightUntil ? ' lean-changed' : ''}" data-wedding-details aria-label="Wedding: Rıza leans ${r?.lean ?? 'unsure'}"><span class="lean-mark ${r?.lean ?? 'unsure'}" aria-hidden="true"></span><span class="wedding-lean">Rıza ${r?.lean ?? 'unsure'}</span>${game.s.engagement !== 'waiting' ? (game.s.engagement === 'accepted' ? 'Rıza has agreed to the marriage.' : 'Rıza has refused the marriage.') : `${(r?.doubts ?? []).map((d) => `<span>${d.key === 'honest' ? 'Honesty' : d.key === 'reliable' ? 'Promises' : 'Kindness'} ${marks[d.status]}</span>`).join('')}<span>Your word ${marks[r?.word?.status ?? 'open']}</span>`} ▸</button>`;
}
function measureStrip(): void {
  stripObserver?.disconnect();
  const stage = host.querySelector<HTMLElement>('.lk-stage');
  const strip = stage?.querySelector<HTMLElement>('.lk-strip');
  if (!stage || !strip) return;
  const measure = () => {
    stage.dataset.largeText = String(
      Number.parseFloat(getComputedStyle(document.documentElement).fontSize) >= 26,
    );
    const measured = `${Math.ceil(strip.getBoundingClientRect().height)}px`;
    if (stage.style.getPropertyValue('--lk-strip-height') !== measured)
      stage.style.setProperty('--lk-strip-height', measured);
  };
  measure();
  stripObserver = new ResizeObserver(measure);
  stripObserver.observe(strip);
}
function mountSheet(d: HTMLDialogElement): void {
  const stage = host.querySelector('.lk-stage');
  if (!stage) return;
  const garden = stage.querySelector<HTMLElement>('.garden');
  if (garden) garden.hidden = true;
  stage.append(d);
}
function weddingDetails(): void {
  selectedDoubt ||=
    state().riza?.doubts?.find((d) => d.status === 'open')?.key ?? state().riza?.doubts?.[0]?.key ?? 'word';
  const d = dialog('Wedding');
  setPhase('wedding');
  conversation = d;
  const body = document.createElement('div');
  body.className = 'lk-sheet-body';
  const update = () => {
    body.innerHTML = rizaCard();
    body.querySelectorAll<HTMLButtonElement>('[data-doubt], [data-word]').forEach((b) => {
      b.onclick = () => {
        selectedDoubt = b.dataset.doubt ?? 'word';
        update();
        body
          .querySelector<HTMLButtonElement>(
            selectedDoubt === 'word' ? '[data-word]' : `[data-doubt="${selectedDoubt}"]`,
          )
          ?.focus();
      };
    });
  };
  d.append(body);
  const actions = document.createElement('div');
  actions.className = 'lk-sheet-actions';
  actions.append(button('Back to the garden', () => d.close(), 'primary'));
  d.append(actions);
  refreshConversation = update;
  update();
  render();
}

function visitorEncounter(): void {
  const entry = game?.continuity?.entries.find(
    (e) =>
      !e.encounter &&
      ['garden', 'fountain'].includes(game.s.locations[e.admission.person.id] ?? '') &&
      !game.s.people[e.admission.person.id]?.activity,
  );
  if (!entry || game.s.minute < 1440) return;
  lab.milestone('one cast encounter');
  const d = dialog(
    entry.admission.castId === 'hf.cast.dilan.murmur' ? 'A delivery at the garden' : 'After the night shift',
  );
  d.dataset.systemMenu = 'true';
  const body = document.createElement('div');
  body.className = 'lk-sheet-body';
  const p = document.createElement('p');
  p.textContent =
    entry.admission.castId === 'hf.cast.dilan.murmur'
      ? 'Dilan brings a parcel. Her route passes this Istanbul district. She has a little time before continuing. Her sister Aylin, colleague Ece and depot supervisor Murat are people from her own life.'
      : 'Derya stops after her night shift. She is lodging temporarily at home 7 with Zeynep and Ali during her relief assignment. Her permanent home is flat 5 in Lale Apartmanı. She needs to sleep this morning.';
  body.append(p);
  for (const [label, choice] of [
    ['Offer a short, respectful exchange', 'support'],
    ['Press her for private details', 'pry'],
    ['Let her continue', 'leave'],
  ] as const)
    body.append(
      button(label, async () => {
        d.close();
        await perform({ type: 'one-cast-encounter', person: entry.admission.person.id, choice });
        if (entry.encounter) {
          reply = entry.encounter.text;
          lab.milestone('one cast trial');
          await checkpointContinuity();
          render();
        }
      }),
    );
  d.append(body);
}
function render(): void {
  if (!playing || pendingJournal) return;
  noticeVisitors();
  const v = view(game.s);
  if (game.s.ended) {
    review();
    return;
  }
  lab.screen('play');
  const previousDay = Math.floor(shownMinute / 1440);
  shownMinute = game.s.minute;
  if (
    (previousDay >= 0 && Math.floor(shownMinute / 1440) > previousDay) ||
    (game.s.deryaAssignmentReleased && !game.continuity?.source)
  )
    void checkpointContinuity();
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
  const focused = focusedPeople(game.s, present);
  const orderedPeople = [...focused.primary, ...focused.others];
  const callReason = present.length ? '' : 'No one is close enough to hear you.';
  const openSheet = host.querySelector<HTMLDialogElement>('dialog.lk-sheet[open]');
  const phase = host.querySelector<HTMLElement>('.lk-stage')?.dataset.phase ?? '';
  openSheet?.remove();
  const personCard = (id: string) =>
    `<button type="button" data-person="${id}" aria-label="Talk to ${html(name(id))}"><strong>${html(name(id))}</strong><small>${html(personRole(id))} · ${outwardLook(id)}${v.households[id] === v.households.hatice ? ' · your household' : ''}${id === question?.speaker ? ' · waiting' : ''}</small>${trusted.includes(id) ? '<small>Rıza listens to them</small>' : ''}${id === concerned ? '<small>would want to know</small>' : ''}</button>`;
  let body = '';
  if (game.s.scene) body = sceneCard();
  else if (question)
    body = `<section class="question-card"><p class="question"><strong>${html(name(question.speaker ?? ''))}:</strong> ${html(question.text)}</p>${v.quick ? `<div class="quick-replies">${v.quick.options.map((option, i) => `<button type="button" data-quick="${i}"><strong>${html(option.label)}</strong><small>${html(option.says)}</small></button>`).join('')}</div>` : `<button type="button" data-question-person="${html(question.speaker ?? '')}">Talk to ${html(name(question.speaker ?? ''))}</button>`}<button type="button" id="hold">Say nothing</button></section>`;
  else if (incident)
    body = `<aside class="table-incident"><h2>What you overheard</h2><p>${html(incident.text)}</p><h3>Tell whom?</h3><div class="incident-people">${present.map((id) => `<button type="button" data-incident-person="${id}">${html(name(id))}</button>`).join('')}</div><button type="button" id="keep-incident">Keep it to yourself for now</button></aside>`;
  else
    body = `${firstStart ? '<p class="first-start">Keep your word good. Help Emre marry Elif. Tap a neighbour to speak.</p>' : ''}<div class="section-heading"><h2>At your table</h2><span>and by the fountain</span></div><div class="people-chips">${orderedPeople.slice(0, 3).map(personCard).join('') || '<p>No one is close enough. Watch for people passing.</p>'}</div>${orderedPeople.length > 3 ? `<details class="other-neighbours"><summary>More people here (${orderedPeople.length - 3}) ▸</summary><div class="people-chips">${orderedPeople.slice(3).map(personCard).join('')}</div></details>` : ''}<p class="standing">${standing()}</p>`;
  host.innerHTML = `<main class="game lk-stage" data-sheet="fit" data-phase="${openSheet ? phase : 'garden'}"><div class="lk-strip">${topbar(
    dateLabel(game.s.minute),
  )}<div class="state-status" role="status">${slowReason ? html(slowReason) : skipping ? 'Waiting for someone to come by' : fortnightTrack()}</div>${weddingStrip()}</div><div class="map-wrap lk-scene"><canvas id="map" aria-label="The neighbourhood. Tap a person near the tea garden or fountain to call them over."></canvas>${reply ? `<button type="button" class="speech-overlay">${html(reply)}</button>` : ''}</div><section class="garden lk-sheet" aria-label="Your tea garden"><div class="lk-sheet-body">${body}</div><div class="lk-sheet-actions garden-actions"><button type="button" id="call" ${unavailable(callReason)}><strong>Call over</strong>${callReason ? `<small>${callReason}</small>` : ''}</button>${!game.s.scene && !question && !incident ? '<button type="button" id="skip" aria-label="Skip to the next event">Skip ⏩</button>' : ''}</div></section></main>`;
  const visitor = game.continuity?.entries.find(
    (e) =>
      !e.encounter &&
      game.s.minute >= 1440 &&
      ['garden', 'fountain'].includes(game.s.locations[e.admission.person.id] ?? '') &&
      !game.s.people[e.admission.person.id]?.activity,
  );
  if (visitor)
    host
      .querySelector('.garden-actions')
      ?.prepend(
        button(
          visitor.admission.castId === 'hf.cast.dilan.murmur'
            ? 'A parcel from Dilan'
            : 'Derya after her shift',
          visitorEncounter,
        ),
      );
  measureStrip();
  if (openSheet) mountSheet(openSheet);
  bindTopbar();
  host.querySelector('[data-wedding-details]')?.addEventListener('click', weddingDetails);
  host.querySelector('.speech-overlay')?.addEventListener('click', heardSheet);
  host.querySelectorAll<HTMLButtonElement>('[data-person]').forEach((b) => {
    b.onclick = () => chooseTalk(b.dataset.person ?? '');
  });
  host.querySelectorAll<HTMLButtonElement>('[data-incident-person]').forEach((b) => {
    b.onclick = () => {
      const latest = state().stories?.at(-1);
      if (latest) {
        story = latest.id;
        target = latest.target;
        trait = null;
      }
      chooseTalk(b.dataset.incidentPerson ?? '');
    };
  });
  host
    .querySelector<HTMLButtonElement>('[data-question-person]')
    ?.addEventListener('click', () => chooseTalk(question?.speaker ?? ''));
  host.querySelector('#keep-incident')?.addEventListener('click', dismissIncident);
  host.querySelector('#hold')?.addEventListener('click', () => void perform({ type: 'hold-tongue' }));
  host.querySelector('#call:not([data-reason])')?.addEventListener('click', () => choosePasser());
  host.querySelector('#skip')?.addEventListener('click', (e) => {
    e.stopPropagation();
    skipping = true;
    accumulator = 0;
    noticeVisitors();
    render();
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
    drawMap(canvas, game.s, 0, talking?.open ? listener : undefined);
    sceneObserver?.disconnect();
    sceneObserver = new ResizeObserver(() => {
      if (canvas.isConnected) drawMap(canvas, game.s, 0, talking?.open ? listener : undefined);
    });
    sceneObserver.observe(canvas);
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
  const system = [
    'Game menu',
    'Run could not open',
    'Other ways in',
    'What you heard',
    'Information',
  ].includes(titleText);
  document.querySelectorAll<HTMLDialogElement>('dialog').forEach((open) => {
    const wasTalking = talking === open;
    endTalk(open);
    if (wasTalking) void persistJournal().then(save);
    open.close();
  });
  const origin =
    titleText === 'Who will you talk to?'
      ? host.querySelector<HTMLElement>('[data-open-talk]')
      : (document.activeElement as HTMLElement | null);
  const d = document.createElement('dialog');
  d.className = system ? 'sheet' : 'sheet lk-sheet';
  d.setAttribute('aria-label', titleText);
  d.innerHTML = `<div class="dialog-head lk-sheet-head"><h2>${titleText}</h2><button type="button" aria-label="Close ${html(titleText)}">×</button></div>`;
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

    if (!system && !document.querySelector('dialog.lk-sheet[open]')) {
      replyOpen = false;
      render();
    }
    const replacement = origin?.id
      ? document.getElementById(origin.id)
      : origin?.dataset.person
        ? host.querySelector<HTMLElement>(`[data-person="${origin.dataset.person}"]`)
        : origin?.hasAttribute('data-wedding-details')
          ? host.querySelector<HTMLElement>('[data-wedding-details]')
          : origin?.hasAttribute('data-open-talk')
            ? host.querySelector<HTMLElement>('[data-open-talk]')
            : null;
    (origin?.isConnected ? origin : replacement)?.focus();
    lab.screen(game?.s.ended ? 'review' : playing ? 'play' : 'title');
    d.remove();
  });
  if (system) {
    document.body.append(d);
    d.showModal();
  } else {
    mountSheet(d);
    d.show();
  }
  return d;
}
function showReply(): void {
  replyOpen = true;
  const d = dialog(`← ${name(listener)}`);
  d.classList.add('reply-sheet');
  conversation = d;
  setPhase('reply');
  const body = document.createElement('div');
  body.className = 'lk-sheet-body reply-body';
  body.innerHTML = `<blockquote>${html(reply || 'Your words have been heard.').replace(/(Believes you\.|Doubts it\.|Doesn’t believe you\.|Won’t hear it\.)/g, '<strong>$1</strong>')}</blockquote>`;
  const actions = document.createElement('div');
  actions.className = 'lk-sheet-actions';
  actions.append(
    button(
      'Back to the garden',
      () => {
        replyOpen = false;
        d.close();
      },
      'primary',
    ),
  );
  d.append(body, actions);
  noticeVisitors();
  render();
}
function information(): void {
  if (closeInformation) {
    closeInformation();
    return;
  }
  const phase = !playing
    ? game?.s.ended
      ? 'end'
      : 'start'
    : (host.querySelector<HTMLElement>('.lk-stage')?.dataset.phase ?? 'garden');
  const words: Record<string, [string, string[]]> = {
    start: [
      'The garden',
      [
        'You keep the tea garden for fourteen days.',
        'Neighbours sit with you or pass the fountain, and what you say travels.',
        'Rıza answers about the wedding on Day 13.',
        'A lie can help today and come back to your gate.',
      ],
    ],
    garden: [
      'Who can hear you',
      [
        'Only people at the garden or passing the fountain can hear you.',
        'Tap a person to talk; tap a passer-by on the map to call them over.',
        'Paying for their tea buys their silence, for a while.',
        'The track marks the family coffee, Rıza’s word and his answer.',
        'The clock holds whenever someone waits for you.',
      ],
    ],
    talk: [
      'Saying it',
      [
        'Pick whom it is about, then a word or something you saw.',
        'Tell says it; Ask asks what the listener thinks.',
        'Defend speaks up for someone.',
        'Take back my words withdraws what you told this listener. Copies already on their way keep travelling.',
        'You cannot tell the same thing to the same person twice. Telling someone who needs to know is not gossip.',
      ],
    ],
    wedding: [
      'Rıza’s doubts',
      [
        'Rıza weighs Emre’s honesty, his promises, his kindness, and your word.',
        'Each doubt says what Rıza heard and what could mend it.',
        '? open · ✓ settled · ! worse · ↺ mending.',
      ],
    ],
    night: [
      'At night',
      [
        'Each day ends at 23:00.',
        'The summary is what reached you.',
        'Much travelled where you could not hear.',
      ],
    ],
    end: [
      'The game’s reckoning',
      [
        'The tally counts your tellings plus onward tellings.',
        'Withdrawals are included.',
        'It is the game’s reckoning, not a measure of people.',
      ],
    ],
  };
  const [heading, lines] = words[phase === 'reply' ? 'talk' : phase] ?? [
    'Who can hear you',
    ['The clock holds whenever someone waits for you.'],
  ];
  const d = document.createElement('dialog');
  d.className = 'info-popover';
  d.dataset.systemMenu = 'true';
  d.setAttribute('aria-label', heading);
  d.innerHTML = `<div class="dialog-head"><h2>${heading}</h2><button type="button" aria-label="Close information">×</button></div><div class="lk-sheet-body">${lines.map((line) => `<p>${line}</p>`).join('')}</div>`;
  document.body.append(d);
  d.show();
  d.querySelector('button')?.addEventListener('click', () => close());
  const close = (e?: Event) => {
    if (e instanceof KeyboardEvent && e.key !== 'Escape') return;
    if (
      e instanceof MouseEvent &&
      (d.contains(e.target as Node) || host.querySelector('#game-info')?.contains(e.target as Node))
    )
      return;
    d.remove();
    closeInformation = null;
    document.removeEventListener('keydown', close);
    document.removeEventListener('click', close);
  };
  closeInformation = () => close();
  document.addEventListener('keydown', close);
  setTimeout(() => document.addEventListener('click', close), 0);
}
function heardSheet(): void {
  const d = dialog('What you heard');
  d.dataset.systemMenu = 'true';
  const body = document.createElement('div');
  body.className = 'lk-sheet-body journal';
  body.innerHTML = game
    ? heardLines(game)
        .slice()
        .reverse()
        .map(
          (l) =>
            `<p><time>Day ${Math.floor(l.at / 1440) + 1} · ${clock(l.at)}</time><br>${l.speaker && !['overheard', 'witness', 'incident', 'witnessed'].includes(l.kind) ? `${html(name(l.speaker))} · ` : ''}${html(feedText(l))}</p>`,
        )
        .join('')
    : '<p>The garden is quiet.</p>';
  d.append(body);
  const actions = document.createElement('div');
  actions.className = 'lk-sheet-actions';
  actions.append(button('Back to the garden', () => d.close(), 'primary'));
  d.append(actions);
}
function sendWord(): void {
  if (game)
    openFeedback(
      () => exportRun(game),
      () => {
        last = performance.now();
        accumulator = 0;
      },
    );
}
function downloadRun(): void {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(exportRun(game), null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = `hearsay-day${Math.floor(game.s.minute / 1440) + 1}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function gameMenu(): void {
  lab.screen('game-menu');
  const d = dialog('Game menu');
  d.classList.add('menu-sheet');
  d.dataset.systemMenu = 'true';
  const body = document.createElement('div');
  body.className = 'lk-sheet-body menu-body menu-rows';
  body.innerHTML = '<p>The garden waits while this is open.</p>';
  body.append(button('What you heard ▸', heardSheet, 'menu-row'));
  const pace = document.createElement('div');
  pace.className = 'menu-pacing';
  pace.setAttribute('aria-label', 'Pace');
  for (const [label, rate] of [
    ['Automatic', 0],
    ['Slow', 1],
    ['Steady', 5],
    ['Fast', 20],
  ] as const) {
    const b = button(label, () => {
      chosenSpeed = rate;
      accumulator = 0;
      if (game) noticeVisitors();
      pace.querySelectorAll('button').forEach((el) => {
        el.setAttribute('aria-pressed', String(el === b));
      });
    });
    b.setAttribute('aria-pressed', String(chosenSpeed === rate));
    pace.append(b);
  }
  body.append(pace);
  body.append(
    button(
      'Send word ▸',
      () => {
        d.close();
        sendWord();
      },
      'menu-row',
    ),
    button(
      'Full screen',
      () => {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen?.();
      },
      'menu-row fullscreen-row',
    ),
    button(
      'To the title page',
      () => {
        d.close();
        if (game) {
          save();
          saved = game;
        }
        title();
      },
      'menu-row',
    ),
  );
  const all = document.createElement('a');
  all.href = 'https://human.adamwhite.work/lab/';
  all.textContent = 'All games';
  all.className = 'menu-row';
  body.append(all);
  const toggle = telemetryToggle(lab);
  toggle.classList.add('record-toggle');
  toggle.querySelector('input')?.setAttribute('role', 'switch');
  toggle.querySelector('label')?.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) node.textContent = ' Record play for the lab';
  });
  body.append(toggle, continuityPanel());
  const privacy = document.createElement('a');
  privacy.href = 'https://human.adamwhite.work/lab/privacy/';
  privacy.target = '_blank';
  privacy.rel = 'noreferrer';
  privacy.textContent = 'Lab privacy';
  body.append(privacy);
  const actions = document.createElement('div');
  actions.className = 'lk-sheet-actions';
  actions.append(button(playing ? 'Back to the garden' : 'Back', () => d.close(), 'primary'));
  d.append(body, actions);
}
function importFile(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      invalidateContinuity();
      const imported = verifyImport(await file.text());
      await validateContinuity(imported);
      game = imported;
      await gateContinuity(game, true);
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
      const existing = document.querySelector<HTMLElement>('.import-status');
      if (existing) {
        existing.textContent = `Run could not open: ${error instanceof Error ? error.message : 'Invalid run. Your current garden is unchanged.'}`;
        return;
      }
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
  host.innerHTML = `<main class="review">${topbar('The end of the fortnight')}<div class="lk-sheet-body"><p class="eyebrow">Words find their way.</p><h2>${game.s.engagement === 'accepted' ? 'Rıza has agreed. Emre and Elif may marry.' : game.s.engagement === 'refused' ? 'Rıza has refused the engagement. The two households will remember.' : 'The engagement remains unsettled.'}</h2><h2>What changed</h2><p>Your garden ended ${html(game.s.garden)}. ${confrontations.length ? `${html(confrontations.join(', '))} traced words back to your gate.` : 'No neighbour confronted you at your gate.'} ${shopChanges.length ? `${html(shopChanges.join(' and '))} closed the shutters early.` : ''}</p><h2>The paths your words took</h2><p class="fine">Open one of your statements to follow its descendants. Withdrawals do not recall copies that have already travelled.</p>${ownRoutes || '<p>You started no testimony.</p>'}<details class="all-routes"><summary>The whole village: every rumour route</summary><p class="fine">This includes conversations you could not witness.</p><div class="route-list">${game.s.routes.map(routeHtml).join('') || '<p>No rumour travelled.</p>'}</div></details><h2>One question to carry</h2><p>Whose trust mattered when you chose what to say?</p><div id="ending-tally">${endingTally(game.s)}</div></div><div id="review-actions" class="lk-sheet-actions"></div></main>`;
  host.querySelector('#ending-tally summary')?.replaceChildren(document.createTextNode('See the tally'));
  host.querySelector('#review-actions')?.append(
    button('Send word', sendWord),
    button('Download this run', downloadRun),
    button('Begin a new fortnight', () => void beginFortnight(), 'primary'),
  );
  bindTopbar();
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
  setPhase('night');
  let sleeping = false;
  d.dataset.dayCard = 'true';
  const clockEl = host.querySelector('#clock');
  if (clockEl) clockEl.textContent = `Day ${day} has ended`;
  d.dataset.systemMenu = 'true';
  d.querySelector('.dialog-head button')?.remove();
  d.addEventListener('cancel', (e) => e.preventDefault());
  const content = document.createElement('div');
  content.className = 'lk-sheet-body';
  content.innerHTML = `${(entry?.summary ?? ['The garden has closed for the night.']).map((line) => `<p>${html(line)}</p>`).join('')}<p>${html(entry?.question ?? 'Who will come to your table tomorrow?')}</p>`;
  const dayAction = document.createElement('div');
  dayAction.className = 'day-action lk-sheet-actions';
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
  dayAction.prepend(tomorrow);
  d.append(content, dayAction);
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
    !document.querySelector('dialog[data-system-menu]')
  ) {
    showDayCard();
    if (document.querySelector('[data-day-card]')) {
      requestAnimationFrame(frame);
      return;
    }
    noticeVisitors();
    rampedSpeed = speed === 0 ? 0 : rampedSpeed + (speed - rampedSpeed) * Math.min(1, elapsed / 400);
    accumulator += (elapsed * rampedSpeed) / 1000;
    if (accumulator >= 1 && !pendingJournal) {
      const minutes = Math.floor(accumulator);
      accumulator -= minutes;
      const night = Math.floor(game.s.minute / 1440) * 1440 + 1380;
      const sceneBefore = game.s.scene?.id;
      const lineBefore = game.s.log.at(-1)?.id ?? 0;
      const to = Math.min(game.s.minute + minutes, night);
      const reachBefore = new Set(view(game.s).present);
      const eventBefore = JSON.stringify([game.s.riza, game.s.threads]);
      while (game.s.minute < to && !game.s.ended) {
        advance(game, game.s.minute + 1);
        // A delayed fast frame must stop when a live response first becomes available.
        if (
          game.s.scene ||
          tableIncident() ||
          liveQuestion() ||
          (skipping &&
            (view(game.s).present.some((id) => !reachBefore.has(id)) ||
              JSON.stringify([game.s.riza, game.s.threads]) !== eventBefore ||
              game.s.minute >= night))
        ) {
          skipping = false;
          accumulator = 0;
          break;
        }
      }
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
    if (canvas) drawMap(canvas, game.s, elapsed, talking?.open ? listener : undefined);
  }
  requestAnimationFrame(frame);
}
export async function start(): Promise<void> {
  await shelf.ready;
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
    [1, 2, 3, 4, 5].includes(row?.value?.s?.version ?? 0) && Array.isArray(row?.value?.inputs)
      ? (row?.value ?? null)
      : null;
  const journal = journalRow?.value;
  if (
    journal &&
    [1, 2, 3, 4, 5].includes(journal.version) &&
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
        saved = replay(
          journal.seed,
          journal.inputs,
          journal.minute,
          journal.version,
          journal.initialPeople,
          journal.initialContinuity,
        );
      if (saved && journal.continuity) saved.continuity = journal.continuity;
      if (saved && journal.fileHistory) saved.fileHistory = journal.fileHistory;
    } catch {
      /* Keep a valid full-state cache if a recovery journal was damaged. */
    }
  }
  if (saved) {
    try {
      const pinned = saved.initialContinuity
        ? verifyImport(JSON.stringify(exportRun(saved)))
        : loadGame(JSON.stringify(saved));
      await validateContinuity(pinned);
      saved = pinned;
    } catch {
      saved = null;
    }
  }
  await gateContinuity(saved ?? undefined);
  installContinuity(
    () => game,
    save,
    async (incoming) => {
      invalidateContinuity();
      game = incoming;
      await gateContinuity(
        game,
        game.continuity?.entries.some((e) => e.scope === 'file'),
      );
      saved = game;
      resetScene();
      await persistJournal();
      save();
      playing = true;
      document.querySelectorAll('dialog').forEach((d) => {
        d.remove();
      });
      render();
    },
  );
  lab.trackRun(
    async () => {
      const current = game;
      if (current) {
        for (const key of ['run', 'run-log', 'run-ui']) {
          try {
            const stored = await get<Game | Journal | SceneMemory>(key);
            const value = stored?.value;
            const seed = value && ('s' in value ? value.s.seed : value.seed);
            if (game === current && value && seed === current.s.seed) lab.captureSave({ key, value });
          } catch {}
        }
      }
      return game ? exportRun(game) : null;
    },
    {
      runKey: () => game?.s.seed ?? 'title',
      getLogs: () => game?.s.log.slice(-40).map((line) => line.text) ?? [],
    },
  );
  document.addEventListener(
    'click',
    (e) => {
      if (skipping && !(e.target as Element).closest('#skip')) {
        skipping = false;
        noticeVisitors();
        const status = host.querySelector('.state-status');
        if (status) status.innerHTML = slowReason ? html(slowReason) : fortnightTrack();
      }
    },
    true,
  );
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
