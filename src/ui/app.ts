import { credence } from '@adam0white/human-framework';
import { act, advance, newGame, REPUTATION_TRAITS, replay, view } from '../sim/engine';
import type { Game, Input, LoggedInput, Trait } from '../sim/types';
import { PEOPLE } from '../sim/world';
import { exportRun, verifyImport } from './export';
import { lab } from './lab';
import { drawMap } from './map';
import { get, put, putImmediate, putNow } from './store';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('Missing app');
const host = root;
let game: Game;
let saved: Game | null = null;
let speed = 1;
let playing = false;
let shownMinute = -1;
let last = performance.now();
let accumulator = 0;
let listener = '';
let target = 'kemal';
let trait: Trait = 'dishonest';
let buySilence = false;
let pendingJournal: Promise<boolean> | null = null;
type Journal = { version: 1; seed: number; minute: number; inputs: LoggedInput[] };
function persistJournal(): Promise<boolean> {
  const writing = putImmediate('run-log', {
    version: 1,
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
  host.innerHTML = `<main class="title-page"><p class="eyebrow">A fortnight in the mahalle</p><h1>Hearsay<span class="subtitle">Someone will hear.</span></h1><div class="title-illustration" aria-hidden="true"><i></i><i></i><i></i><b>☕</b></div><p>You are Hatice. You keep the tea garden.<br>Your son hopes to marry the baker’s daughter.<br>This morning, you overhear something true.</p><div id="start"></div><p class="fine">Fourteen days. Six ways to answer.<br>Your words will find their way home.</p><button type="button" id="import-title" class="text-button">Open a notebook</button></main>`;
  host.querySelector('#start')?.append(
    button(
      saved ? 'Resume' : 'Start',
      async () => {
        game = saved ?? newGame(crypto.getRandomValues(new Uint32Array(1))[0] ?? 1);
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
  host.querySelector('#import-title')?.addEventListener('click', importFile);
  if (saved?.s.ended)
    host.querySelector('#start')?.append(
      button(
        'Start another fortnight',
        async () => {
          saved = null;
          game = newGame(crypto.getRandomValues(new Uint32Array(1))[0] ?? 1);
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
async function perform(input: Input): Promise<void> {
  if (pendingJournal) await pendingJournal;
  const accepted = act(game, input);
  if (accepted && (input.type === 'tell' || input.type === 'defend')) lab.milestone('first word told');
  await persistJournal();
  save();
  render();
}
function render(): void {
  if (!playing || pendingJournal) return;
  const v = view(game.s);
  if (game.s.newsWaiting) speed = 1;
  if (game.s.ended) {
    review();
    return;
  }
  lab.screen('play');
  shownMinute = game.s.minute;
  const present = v.present.filter((id) => id !== 'hatice');
  if (!present.includes(listener)) listener = present[0] ?? '';
  const day = Math.floor(game.s.minute / 1440) + 1;
  const opening = v.lines.find((l) => l.kind === 'overheard');
  const openingAnswered = game.inputs.some(
    (i) => i.at >= 390 && ['tell', 'defend', 'hold-tongue'].includes(i.input.type),
  );
  const openingNote =
    opening && !openingAnswered && day === 1
      ? `<aside class="opening-evidence">${html(opening.text)}</aside>`
      : '';
  host.innerHTML = `<main class="game"><header><a class="wordmark" href="#" id="home">Hearsay</a><div class="clock" id="clock">Day ${day} <span>${clock(game.s.minute)}</span></div><button type="button" id="notebook" class="text-button">Notebook</button></header><div class="speeds" role="group" aria-label="Time speed">${speeds.map((s) => `<button type="button" data-speed="${s.rate}" aria-pressed="${speed === s.rate}">${s.label}</button>`).join('')}</div><div class="map-wrap"><canvas id="map" role="img" aria-label="The hillside neighbourhood, with neighbours walking between houses and shops"></canvas><span class="map-caption">THE MAHALLE · HATICE’S TEA GARDEN</span></div><section class="garden" aria-label="Your tea garden"><div class="section-heading"><h2>At your table</h2><span>${html(game.s.garden)} benches</span></div><p class="present">${present.length ? present.map((id) => html(name(id))).join(' · ') : 'The kettle murmurs. No one is passing just now.'}</p><p class="question">${html(v.question ?? 'A little tea. A little talk. What will you say?')}</p>${openingNote}<div class="selectors"><label>To<select id="listener" aria-label="Listener">${present.map((id) => `<option value="${id}" ${listener === id ? 'selected' : ''}>${html(name(id))}</option>`).join('')}</select></label><label>About<select id="target" aria-label="Person to speak about">${PEOPLE.filter(
    (p) => p.id !== 'hatice',
  )
    .map((p) => `<option value="${p.id}" ${target === p.id ? 'selected' : ''}>${html(p.name)}</option>`)
    .join('')}</select></label><label>Word<select id="trait" aria-label="Claim">${Object.keys(
    REPUTATION_TRAITS,
  )
    .map((t) => `<option ${trait === t ? 'selected' : ''}>${t}</option>`)
    .join(
      '',
    )}</select></label></div><div class="actions" id="actions"></div></section><section class="heard" aria-label="What you witnessed"><h2>What reaches your ears</h2><div role="log" aria-live="polite">${
    v.lines
      .slice(-5)
      .reverse()
      .map(
        (l) =>
          `<article><time>${clock(l.minute)}</time><p>${l.who !== 'narrator' && l.who !== 'hatice' ? `<strong>${html(name(l.who))}</strong> · ` : ''}${html(l.text)}</p></article>`,
      )
      .join('') || '<p class="fine">The hill is waking.</p>'
  }</div></section><footer>Only what you witness, and what people tell you.</footer></main>`;
  host.querySelector('#home')?.addEventListener('click', (e) => {
    e.preventDefault();
    save();
    saved = game;
    title();
  });
  host.querySelector('#notebook')?.addEventListener('click', notebook);
  host.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((b) => {
    b.onclick = () => {
      speed = Number(b.dataset.speed);
      render();
    };
  });
  host.querySelector<HTMLSelectElement>('#listener')?.addEventListener('change', (e) => {
    listener = (e.target as HTMLSelectElement).value;
  });
  host.querySelector<HTMLSelectElement>('#target')?.addEventListener('change', (e) => {
    target = (e.target as HTMLSelectElement).value;
  });
  host.querySelector<HTMLSelectElement>('#trait')?.addEventListener('change', (e) => {
    trait = (e.target as HTMLSelectElement).value as Trait;
  });
  const mark = document.createElement('p');
  mark.className = 'own-word';
  const showOwnWord = () => {
    const positive: Record<string, string> = {
      dishonest: 'honest',
      unreliable: 'reliable',
      stingy: 'generous',
      cruel: 'kind',
      lazy: 'hardworking',
    };
    const defended = positive[trait] ?? trait;
    const believed = (word: string) =>
      game.s.people.hatice && credence(game.s.people.hatice, `${target}:${word}`) > 0.5;
    mark.textContent = `Tell: ${name(target)} is ${trait} (${believed(trait) ? 'you believe it' : 'a lie'}). Defend: ${trait === 'owes' ? 'does not owe money' : defended} (${(trait === 'owes' ? game.s.people.hatice && credence(game.s.people.hatice, `${target}:owes`) < 0.5 : believed(defended)) ? 'you believe it' : 'a lie'}).`;
  };
  showOwnWord();
  host.querySelector('.selectors')?.after(mark);
  host.querySelectorAll('select').forEach((select) => {
    select.addEventListener('change', () => {
      render();
    });
  });
  const actions = host.querySelector('#actions');
  const choices: [string, () => Input][] = [
    ['Tell', () => ({ type: 'tell', listener, target, trait })],
    ['Defend', () => ({ type: 'defend', listener, target, trait })],
    ['Ask', () => ({ type: 'ask', listener, target })],
    ['Hold your tongue', () => ({ type: 'hold-tongue' })],
    ['Make amends', () => ({ type: 'make-amends', listener, target })],
    [
      'Call over',
      () => ({ type: 'call-over', person: listener, ...(buySilence ? { buySilence: true } : {}) }),
    ],
  ];
  for (const [label, input] of choices) {
    const b = button(label, () => perform(input()));
    b.disabled = label === 'Hold your tongue' ? !game.s.newsWaiting : !listener;
    if (['Tell', 'Defend'].includes(label) && target === listener) b.disabled = true;
    if (label === 'Hold your tongue' && !game.s.newsWaiting)
      b.title = 'Wait until a neighbour asks for news.';
    actions?.append(b);
  }
  const offer = document.createElement('details');
  offer.className = 'silence-offer';
  offer.innerHTML = `<summary>Offer tea for silence</summary><label><input type="checkbox" ${buySilence ? 'checked' : ''}> With Call over: pay for their tea and ask them not to repeat your story.</label>`;
  offer.querySelector('input')?.addEventListener('change', (e) => {
    buySilence = (e.target as HTMLInputElement).checked;
  });
  actions?.after(offer);
  if (v.lines.some((l) => l.kind === 'refusal')) lab.milestone('first refusal heard');
  if (v.lines.some((l) => l.kind === 'rumour')) lab.milestone('a rumour reached you');
  if (game.s.engagement !== 'waiting') lab.milestone('the engagement settled');
}
function dialog(titleText: string): HTMLDialogElement {
  const d = document.createElement('dialog');
  d.className = 'notebook';
  d.innerHTML = `<div class="dialog-head"><h2>${titleText}</h2><button type="button" aria-label="Close notebook">×</button></div>`;
  d.querySelector('button')?.addEventListener('click', () => {
    d.close();
    d.remove();
    lab.screen(game?.s.ended ? 'review' : playing ? 'play' : 'title');
  });
  d.addEventListener('close', () => {
    lab.screen(game?.s.ended ? 'review' : playing ? 'play' : 'title');
    d.remove();
  });
  document.body.append(d);
  d.showModal();
  return d;
}
function notebook(): void {
  lab.screen('notebook');
  const d = dialog('Your notebook');
  const p = document.createElement('p');
  p.textContent =
    'Save the whole run: your seed, choices, state and a replay fingerprint. An imported notebook must replay exactly before it replaces your garden.';
  d.append(p);
  const journal = document.createElement('details');
  journal.innerHTML = `<summary>What I heard</summary><div class="journal">${game.s.log.map((l) => `<p><time>Day ${Math.floor(l.at / 1440) + 1} · ${clock(l.at)}</time><br>${l.speaker ? `${html(name(l.speaker))} · ` : ''}${html(l.text)}</p>`).join('')}</div>`;
  d.append(journal);
  d.append(
    button('Download this run', () => {
      const blob = new Blob([JSON.stringify(exportRun(game), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hearsay-day-${Math.floor(game.s.minute / 1440) + 1}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }),
    button('Import a notebook', importFile),
    button('Send this run to the notebook', () => lab.openSendDialog({ getRun: () => exportRun(game) })),
  );
  const privacy = document.createElement('p');
  privacy.className = 'fine';
  privacy.innerHTML =
    'Anonymous play events help improve Hearsay. Sending your full run is your choice. <a href="https://human.adamwhite.work/lab/privacy/" target="_blank" rel="noreferrer">Privacy</a>';
  d.append(privacy);
  d.append(
    button(lab.eventsOn ? 'Turn anonymous events off' : 'Turn anonymous events on', () => {
      lab.setEventsOff(lab.eventsOn);
      d.close();
      d.remove();
      notebook();
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
      const d = dialog('Notebook could not open');
      const p = document.createElement('p');
      p.textContent =
        error instanceof Error ? error.message : 'Invalid notebook. Your current garden is unchanged.';
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
    button('Notebook', notebook),
    button('Return to title', () => {
      saved = game;
      title();
    }),
  );
}
function frame(now: number): void {
  const elapsed = Math.min(250, now - last);
  last = now;
  if (playing && game && !game.s.ended && !document.hidden) {
    const hour = Math.floor((game.s.minute % 1440) / 60);
    accumulator += (elapsed * (hour < 6 || hour >= 23 ? 240 : speed)) / 1000;
    if (accumulator >= 1 && !pendingJournal) {
      const minutes = Math.floor(accumulator);
      accumulator -= minutes;
      advance(game, game.s.minute + minutes);
      const current = game;
      void persistJournal().then(() => {
        if (game !== current || !playing) return;
        if (Math.floor(game.s.minute / 15) !== Math.floor(shownMinute / 15)) render();
        const clockEl = host.querySelector('#clock');
        if (clockEl)
          clockEl.textContent = `Day ${Math.floor(game.s.minute / 1440) + 1} · ${clock(game.s.minute)}`;
      });
    }
    const canvas = host.querySelector<HTMLCanvasElement>('#map');
    if (canvas) drawMap(canvas, game.s, elapsed);
  }
  requestAnimationFrame(frame);
}
export async function start(): Promise<void> {
  const [row, journalRow] = await Promise.all([get<Game>('run'), get<Journal>('run-log')]);
  saved = row?.value?.s?.version === 1 && Array.isArray(row.value.inputs) ? row.value : null;
  const journal = journalRow?.value;
  if (
    journal?.version === 1 &&
    Number.isSafeInteger(journal.seed) &&
    Number.isSafeInteger(journal.minute) &&
    journal.minute >= 360 &&
    journal.minute <= 20160 &&
    Array.isArray(journal.inputs)
  ) {
    try {
      if (
        !saved ||
        saved.s.seed !== journal.seed ||
        saved.s.minute !== journal.minute ||
        JSON.stringify(saved.inputs) !== JSON.stringify(journal.inputs)
      )
        saved = replay(journal.seed, journal.inputs, journal.minute);
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
