/** Live canonical garden shell. A loaded run never refreshes its initial people. */
import {
  anchorPersonaLife,
  canonicalCast,
  castForGame,
  closePersonaBranch,
  createPersona,
  initialPersonaLife,
  type PersonaEnvelope,
  personaChannel,
  portablePassport,
  portableWriteBlockers,
  validatePersona,
} from '@adam0white/lab-client';
import { downloadJson, PEOPLE_ACROSS_GAMES, telemetryNotice, telemetryToggle } from '@adam0white/lab-kit';
import { GARDEN_CAST, GARDEN_IDS, type GardenPerson } from '../sim/garden-cast.ts';
import { GARDEN_ENGINE } from '../sim/garden-engine.ts';
import {
  advanceGarden,
  chooseGarden,
  freshGarden,
  type GardenInput,
  type GardenRun,
  gardenAuthors,
  gardenHere,
  gardenStanding,
} from '../sim/garden4.ts';
import {
  admitGardenBatch,
  captureGardenSource,
  claimGardenBatch,
  eligibleGardenBatch,
  type GardenChapter,
  type SourceArchive,
} from '../sim/garden4-continuity.ts';
import { exportGarden, importGarden } from '../sim/garden4-export.ts';
import { actualGardenLocation, type PlanChoice, type ReputationTrait } from '../sim/garden4-stakes.ts';
import { gardenPlace } from './garden-english.ts';
import { openGardenFeedback } from './garden-feedback.ts';
import { loadGardenJournal, saveGardenJournal } from './garden-journal.ts';
import { gardenReadings } from './garden-readings.ts';
import { GardenRecordingGuard, type RecordingBinding } from './garden-recording.ts';
import { retainGardenSource } from './garden-source-archive.ts';
import { gardenPace } from './garden-ui-pace.ts';
import { lab } from './lab.ts';
import { get } from './store.ts';
import './garden.css';

function required<T>(value: T | null | undefined, context: string): T {
  if (value === null || value === undefined) throw new Error(context);
  return value;
}
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    required(
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c],
      'Garden escaping requires a matched character.',
    ),
  );
// File play is a public route. It switches save sinks before importing a run.
let fileSession = false;
const shelf = personaChannel();
const recordingGuard = new GardenRecordingGuard(lab, shelf);
let recordingBinding: RecordingBinding | undefined;
let fileKey: string | null = null;
let ownedHeads: Record<string, PersonaEnvelope> = {};
let archives: SourceArchive[] = [];
let generation = 0;
let starting = false;
let checkpointBusy = false;
const stamps = () => ({
  game: 'hearsay',
  build: lab.build().c ?? 'development',
  engine: GARDEN_ENGINE,
  rules: 'hearsay-hf4-1',
});
let run: GardenRun | undefined;
let selected: GardenPerson = 'riza';
let menu = false;
let confirmNew = false;
let pace: number | null = null;
let readingUntil = 0;
let lastFrame = 0;
let carry = 0;
let notice = '';
let stopTrack: (() => void) | undefined;
let fileOrigin = false;
let uiGeneration = 0;
let loadGeneration = 0;
const root = required(document.getElementById('app'), 'Garden requires its app root.');
// This footer and the SDK node survive renders and asynchronous notice suppression.
const footer = document.createElement('footer');
footer.className = 'cg-footer';
root.after(footer);
const debug = document.createElement('details');
debug.className = 'cg-debug';
const privacy = document.createElement('a');
privacy.href = 'https://human.adamwhite.work/lab/privacy/';
privacy.textContent = 'Lab privacy';
privacy.target = '_blank';
privacy.rel = 'noopener';
footer.append(privacy, debug);
function renderDebug() {
  debug.innerHTML = `<summary>Debug</summary><p>Build: ${esc(stamps().build)}. Engine: ${esc(stamps().engine)}. Rules: ${esc(stamps().rules)}.</p>${run ? `<p>Seed: ${run.seed}. Minute: ${run.minute}.</p>` : '<p>No game is open.</p>'}`;
}
function information(id: string, label: string, text: string) {
  return `<span class="cg-info"><button type="button" data-info="${id}" aria-label="${label}" aria-expanded="false" aria-controls="${id}">i</button><span id="${id}" hidden>${text}</span></span>`;
}
function clock() {
  const m = run?.minute ?? 360,
    t = m % 1440;
  return `Day ${Math.min(14, Math.floor(m / 1440) + 1)} · ${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}
function button(label: string, key: string, disabled = false) {
  return `<button type="button" data-action="${key}" ${disabled ? 'disabled' : ''}>${label}</button>`;
}
async function save(): Promise<boolean> {
  if (!run) return false;
  if (fileSession) {
    const value = { export: exportGarden(run), fileOrigin, fileKey, ownedHeads, archives };
    try {
      lab.captureSave({
        key: `garden-file:${required(fileKey, 'File recording requires its file key.')}`,
        value,
      });
      return true;
    } catch {
      notice = 'This file session could not be recorded. Download this game file before closing the tab.';
      render();
      return false;
    }
  }
  const stored = await saveGardenJournal(run, { fileOrigin, fileKey, ownedHeads, archives });
  if (!stored) {
    notice =
      'Your garden could not be saved on this device. Keep this page open. You can send feedback from the game menu.';
    render();
  }
  return stored;
}
function input(value: GardenInput) {
  if (!run) return;
  if (!chooseGarden(run, value))
    notice = 'This person cannot do this now. Try again later, or keep the matter private.';
  else {
    notice = value.type === 'ask' ? (run.log.at(-1)?.text ?? '') : '';
    save();
  }
  render();
  if (value.type === 'ask') {
    const answer = root.querySelector<HTMLElement>('.cg-notice');
    if (answer) {
      const headerHeight = root.querySelector('.cg-header')?.getBoundingClientRect().height ?? 0;
      answer.style.scrollMarginTop = `${headerHeight + 8}px`;
      answer.scrollIntoView({ block: 'nearest' });
    }
  }
}
async function useRun(
  next: GardenRun,
  file = false,
  storedFileKey?: string | null,
  receipts: Record<string, PersonaEnvelope> = {},
) {
  const current = ++generation;
  if (generation !== current) return;
  ownedHeads = receipts;
  stopTrack?.();
  // File origin persists through save/reload and remains gated before any hooks.
  recordingGuard.invalidate();
  fileKey = file ? (storedFileKey ?? crypto.randomUUID()) : null;
  const initial = next.chapter?.claims ?? [];
  const heads = [
    ...initial,
    ...Object.values(receipts).filter((h) => !initial.some((p) => p.branchId === h.branchId)),
  ];
  recordingBinding = {
    key: fileKey ? `garden-file:${fileKey}` : heads.length ? `garden-group:${crypto.randomUUID()}` : null,
    file,
    heads,
  };
  await recordingGuard.bind(recordingBinding, file);
  if (generation !== current) return;
  notice = '';
  run = next;
  debug.open = false;
  fileOrigin = file;
  menu = false;
  confirmNew = false;
  lastFrame = 0;
  carry = 0;
  stopTrack = lab.trackRun(() => exportGarden(required(run, 'Garden recording requires a current run.')), {
    getLogs: () => required(run, 'Garden recording requires a current run.').log,
    runKey: () => `${required(run, 'Garden recording requires a current run.').seed}:${fileOrigin}`,
  });
  save();
  render();
}
function otherStarts() {
  return `<details class="cg-starts"><summary>Other ways to begin</summary><div class="cg-start-row">${button('Play fourteen days with new local people', 'local', starting)}${information('cg-local-info', 'About new local people', 'These people have not met Hatice in any other game. Begin uses people you have met in other games when available.')}</div><div class="cg-start-row">${button('Open a game file', 'open-file', starting)}${information('cg-file-info', 'About opening a game file', 'Opening a file keeps its progress separate from your saved garden.')}</div></details>`;
}
function fileControls() {
  return `<p>This file session stays in this tab. Download the game file to keep your progress. Your browser’s saved garden and shared histories are not changed.</p>${run ? button('Download this game file', 'export') : '<label class="cg-file">Open a game file<input type="file" id="import-run" accept=".json,application/json"></label>'}${button('Close file session', 'close-file')}<p>Saving a closing chapter, starting a separate history and starting a new garden are unavailable in a file session.</p>`;
}
function menuControls() {
  if (fileSession)
    return `${run ? button('Resume', 'back') + button('Use automatic pace', 'automatic') : ''}${button('Feedback', 'send')}${button('Fullscreen', 'fullscreen')}<a href="https://human.adamwhite.work/games/" target="_top">All games</a><a href="https://human.adamwhite.work/lab/people/" target="_top">${PEOPLE_ACROSS_GAMES}</a><div id="cg-recording"></div>${fileControls()}`;
  return `${run ? button('Resume', 'back') + button('Use automatic pace', 'automatic') : ''}${button('Feedback', 'send')}${button('Fullscreen', 'fullscreen')}<a href="https://human.adamwhite.work/games/" target="_top">All games</a><a href="https://human.adamwhite.work/lab/people/" target="_top">${PEOPLE_ACROSS_GAMES}</a><div id="cg-recording"></div>${run ? button('New game', 'new') : ''}${confirmNew ? `<p>Start a new fourteen-day game and replace this device’s saved garden?</p>${button('Start new game', 'restart', starting)}${button('Keep this garden', 'cancel-new', starting)}` : ''}${run ? button('Download this run', 'export') : ''}${otherStarts()}`;
}
function renderTitle() {
  root.innerHTML = `<main class="cg-title"><p class="eyebrow">Fourteen days in the neighbourhood</p><h1>Hearsay</h1><p>You are Hatice. You run a tea garden in Istanbul. People visit between shifts, deliveries and appointments.</p><p class="goal">Your goal is to open a paid workers’ lunch on Day 13.</p><details><summary>How to play</summary><p>Arrange supplies on Day 4 and agree on paid cooking on Day 8. You need at least four meal reservations. People decide whether to book based on what they hear.</p><p>Choose a person to talk to. You can listen, repeat a claim or keep it private. Your words affect who trusts you and visits the garden. The clock runs for fourteen days.</p><p>Prices are in lira, the currency of Turkey. ${fileSession ? 'This file session stays in this tab. Download the game file to keep your progress.' : 'Your garden saves automatically on this device.'}</p></details>${notice ? `<p role="status">${esc(notice)}</p>` : ''}${fileSession ? '' : button('Begin', 'start', starting)}${menuControls()}</main>`;
  root.querySelector('#cg-recording')?.append(telemetryToggle(lab));
}
function render() {
  ++uiGeneration;
  renderDebug();
  const opened = new Set(
    [...root.querySelectorAll<HTMLDetailsElement>('details[open]')].map(
      (d) => d.querySelector('summary')?.textContent,
    ),
  );
  const traitSelected = root.querySelector<HTMLSelectElement>('#cg-trait')?.value;
  const about = root.querySelector<HTMLSelectElement>('#cg-about')?.value;
  const focusedAction = (document.activeElement as HTMLElement | null)?.dataset.action;
  if (!run) {
    renderTitle();
    bind();
    return;
  }
  const rendering = run;
  const id = selected,
    c = GARDEN_CAST[id],
    discovery = run.discoveries[id],
    here = gardenHere(run, id);
  const running = run.chat;
  let panel = '';
  if (menu) {
    panel = `<h2>Game menu</h2><p>The clock is paused. ${fileSession ? 'Download the game file to keep your progress.' : 'Your garden saves automatically.'}</p>${menuControls()}`;
  } else if (run.lunch.pending) {
    panel = `<h2>${run.lunch.pending === 'trial' ? 'Day 4 · Reserve the supplies' : 'Day 8 · Agree on paid cooking'}</h2><p>You have ${run.lunch.cash} lira. You owe ${run.lunch.debt} lira. Each meal sells for 100 lira. Selling four meals pays for the sample, preparation and food, which cost 380 lira if you pay now. Buying the sample on credit means paying later. It raises the total cost to 410 lira, so you need to sell five meals.</p><p>${run.lunch.pending === 'trial' ? 'Rıza will deliver the agreed number of loaves. Osman will supply the produce with a written order. Pay for a sample now, agree to pay a higher price later, or decline the sample.' : 'Aylin offers to prepare food after her school shift. She gives a time when she must leave. Pay her 180-lira fee before the preparation session at 17:00 on Day 10. Anyone may still use the free bench without buying food.'}</p>${run.lunch.pending === 'trial' ? button('Pay 120 lira for the sample now', 'plan-paid-trial') + button('Get the sample now and pay 150 lira before lunch', 'plan-credit-trial') + button('Decline the sample and reserve no supplies', 'plan-decline-trial') : button('Pay 180 lira for the preparation session', 'plan-paid-prep') + button('Agree to pay 180 lira before preparation', 'plan-unpaid-prep') + button('Cancel the lunch preparation', 'plan-cancel')}${running ? button('Finish the current conversation first', 'finish') + button('Leave the current conversation', 'release') : ''}<p>The clock is paused while you decide. These payments come from your garden cash. A promise to pay does not count as payment.</p>`;
  } else if (run.ended) {
    panel = `<h2>${run.lunch.result === 'open' ? 'The workers’ lunch opened' : run.lunch.result === 'short' ? 'The lunch made a loss' : 'The lunch could not open'}</h2><p>${esc(run.lunch.reason ?? 'No lunch result was recorded.')}</p><p>${run.lunch.debt ? 'You still have an unpaid invoice. Starting another chapter does not cancel that debt.' : 'All lunch invoices are paid.'}</p><p>${esc(gardenStanding(run))}</p><p>${run.routes.filter((r) => r.from === 'hatice').length ? 'You made claims to other people. The garden record shows who heard them.' : 'You did not make any claims about other people.'}</p>${button('Read the garden record', 'account')}${button('Game menu', 'menu')}`;
  } else {
    panel = `<h2>${esc(c.name)} <small>${id === 'hatice' ? '· you' : ''}</small></h2><p>${esc(c.job)} · ${esc(gardenPlace(actualGardenLocation(run, id)))}</p>`;
    panel += gardenReadings(run, id)
      .map((line) => `<p>${esc(line)}</p>`)
      .join('');
    if (running?.person === id)
      panel += `<p role="status">${id === 'hatice' ? 'You are reflecting on your past for fifteen minutes' : 'You are in a fifteen-minute conversation'}. It finishes at ${Math.floor((running.until % 1440) / 60)}:${String(running.until % 60).padStart(2, '0')}. You can leave early.</p>${button('Let the conversation finish', 'finish')}${button('Leave the conversation', 'release')}`;
    else if (running)
      panel += `<p>You are listening to ${esc(GARDEN_CAST[running.person].name)}. Finish or leave that conversation first.</p>${button('Go to the conversation', 'chat')}`;
    else if (discovery)
      panel += `<details><summary>About ${esc(c.name)}</summary><p>${esc(c.family)}</p></details><p class="cg-confidence">${esc(discovery.fact)}</p>${discovery.response ? `<p>${esc(discovery.outcome ?? '')}</p>${button('Sit and talk again', 'listen', !here)}` : `${button('Offer practical help and keep this private', 'support', !here)}${button('Keep this private', 'keep', !here)}${button('Repeat this at another table', 'spread', !here)}`}`;
    else
      panel += `<p>${here ? esc(c.cue) : `${esc(c.name)} is away or unavailable. Try again later.`}</p>${button(id === 'hatice' ? 'Reflect on your past for fifteen minutes' : 'Invite a quiet conversation', 'listen', !here)}${id !== 'hatice' ? button('Press for private details', 'pry', !here) : ''}`;
    const confrontation = run.lunch.confrontations.find(
      (c) => c.person === id && !c.resolved && c.at <= rendering.minute,
    );
    if (confrontation)
      panel = `<h2>${esc(c.name)} confronts you</h2><p>Someone found that the disproved claim came from you. Agree to correct it with each person who heard it, or stand by it and lose a day of tea sales.</p>${button('Take responsibility and agree to correct the claim', 'confront-own', !here)}${button('Stand by the disproved claim', 'confront-stand', !here)}`;
    if (!running && id !== 'hatice' && run.minute >= 7 * 1440 + 720 && run.minute < 12 * 1440 + 780)
      panel += button('Invite them to book the Day 13 lunch', 'reserve', !here);
    if (!running && id !== 'hatice')
      panel += `<details><summary>Talk about someone else</summary><label>Who?<select id="cg-about">${GARDEN_IDS.filter(
        (p) => p !== id && p !== 'hatice',
      )
        .map((p) => `<option value="${p}">${esc(GARDEN_CAST[p].name)}</option>`)
        .join(
          '',
        )}</select></label><label>What?<select id="cg-trait"><option value="reliable">Keeping promises</option><option value="honest">Honesty</option><option value="kind">Kindness</option><option value="generous">Generosity</option></select></label>${button('Ask what they have heard', 'ask', !here)}${button('Make a positive claim about this trait', 'defend', !here)}${button('Make a damaging claim about this trait', 'tell', !here)}${button('Withdraw your accusation', 'amends', !here)}<p class="fine">Making a claim does not prove it. Something told to you in private stays private unless you repeat it.</p></details>`;
  }
  if (!menu && !run.ended && !running) panel += button('Pour tea without sharing news', 'silence');
  if (!menu && run.lunch.debt > 0)
    panel +=
      `<p>Garden cash: ${run.lunch.cash} lira. Unpaid invoice: ${run.lunch.debt} lira.</p>` +
      button(`Pay the ${run.lunch.debt} lira invoice`, 'plan-settle', run.lunch.cash < run.lunch.debt);
  root.innerHTML = `<main class="cg-game"><header class="cg-header"><div><strong>Hearsay</strong> <span>${clock()}</span></div>${button(menu ? 'Back' : 'Game menu', menu ? 'back' : 'menu')}<p>Day 13 lunch: ${run.lunch.breadDelivered ? 'The bread has been delivered.' : run.lunch.bread ? 'The bread is ordered.' : 'The bread is not ordered.'} ${run.lunch.produceDelivered ? 'The produce has been delivered.' : run.lunch.produce ? 'The produce is ordered.' : 'The produce is not ordered.'} ${run.lunch.prepared ? 'The food has been prepared.' : run.lunch.cook ? 'Paid cooking is arranged.' : 'Paid cooking is not arranged.'} Meals reserved: ${run.lunch.reservations.length}/${run.lunch.trial === 'credit' ? 5 : 4}.</p><p>You have ${run.lunch.cash} lira. You owe ${run.lunch.debt} lira.</p><p class="fine">${pace === null ? 'Pace: Automatic. The garden slows while you read.' : 'The garden slows while you read. Automatic pace is available in the game menu.'}</p><div class="cg-paces">${[0, 1, 4, 12].map((p, i) => `<button type="button" data-pace="${p}" aria-pressed="${pace === p}" ${menu ? 'disabled' : ''}>${['Pause', 'Slow', 'Normal', 'Fast'][i]}</button>`).join('')}</div></header><section class="cg-scene" aria-label="The tea garden"><div class="cg-gate">THE GARDEN GATE <span>${run.benchFree ? 'Anyone may sit here without buying.' : 'There are a few chairs in the shade.'}</span></div><div class="cg-tables">${GARDEN_IDS.map((p) => `<button type="button" class="cg-person ${gardenHere(rendering, p) ? 'here' : 'away'}" data-person="${p}" aria-pressed="${selected === p}"><span aria-hidden="true">${p === 'hatice' ? '☕' : '◯'}</span><strong>${esc(GARDEN_CAST[p].name)}</strong><small>${gardenHere(rendering, p) ? 'at the garden' : esc(gardenPlace(actualGardenLocation(rendering, p)))}</small></button>`).join('')}</div><p class="cg-standing">${esc(gardenStanding(run))}</p></section><section class="cg-panel" aria-live="polite">${notice ? `<p class="cg-notice" role="status">${esc(notice)}</p>` : ''}${panel}</section><details class="cg-account"><summary>Garden record: what you heard</summary>${run.log
    .slice(-60)
    .map(
      (l) =>
        `<p><small>Day ${Math.floor(l.at / 1440) + 1} ${Math.floor((l.at % 1440) / 60)}:${String(l.at % 60).padStart(2, '0')}</small> ${esc(l.text)}</p>`,
    )
    .join('')}</details></main>`;
  root.querySelectorAll<HTMLDetailsElement>('details').forEach((d) => {
    d.open = opened.has(d.querySelector('summary')?.textContent);
  });
  if (traitSelected) {
    const select = root.querySelector<HTMLSelectElement>('#cg-trait');
    if (select) select.value = traitSelected;
  }
  if (about) {
    const select = root.querySelector<HTMLSelectElement>('#cg-about');
    if (select) select.value = about;
  }
  if (focusedAction)
    root.querySelector<HTMLButtonElement>(`[data-action="${focusedAction}"]`)?.focus({ preventScroll: true });
  if (menu) root.querySelector('#cg-recording')?.append(telemetryToggle(lab));
  bind();
}
function bind() {
  const renderGeneration = uiGeneration;
  const owner = run;
  const valid = () => renderGeneration === uiGeneration && owner === run;
  root.querySelectorAll<HTMLButtonElement>('[data-person]').forEach((b) => {
    b.onclick = () => {
      if (!valid()) return;
      selected = b.dataset.person as GardenPerson;
      readingUntil = performance.now() + 15000;
      notice = '';
      render();
    };
  });
  root.querySelectorAll<HTMLButtonElement>('[data-pace]').forEach((b) => {
    b.onclick = () => {
      if (!valid()) return;
      pace = Number(b.dataset.pace);
      carry = 0;
      render();
    };
  });
  root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((b) => {
    b.onclick = () => {
      if (!valid()) return;
      readingUntil = performance.now() + 15000;
      const key = required(b.dataset.action, 'Garden action button requires its action key.');
      void action(key);
    };
  });
  root.querySelectorAll<HTMLButtonElement>('[data-info]').forEach((b) => {
    b.onclick = () => {
      const text = root.querySelector<HTMLElement>(`#${b.dataset.info}`);
      if (!text) return;
      text.hidden = !text.hidden;
      b.setAttribute('aria-expanded', String(!text.hidden));
    };
  });
  const importer = root.querySelector<HTMLInputElement>('#import-run');
  if (importer)
    importer.onchange = async () => {
      const attempt = ++loadGeneration;
      const file = importer.files?.[0];
      if (!file) return;
      recordingGuard.invalidate();
      try {
        if (file.size > 64 * 1024 * 1024) throw new Error('This game file is larger than the 64 MiB limit.');
        const text = await file.text();
        if (attempt !== loadGeneration || !valid()) return;
        ++generation;
        await useRun(importGarden(text), true);
      } catch (error) {
        console.error('Garden import failed', error);
        notice = error instanceof Error ? error.message : 'This game file could not be read.';
        render();
      }
    };
}
async function action(key: string) {
  if (fileSession && ['local', 'new', 'restart', 'start'].includes(key)) return;
  if (key === 'open-file') {
    if (starting || fileSession) return;
    if (run && !(await save())) return;
    ++loadGeneration;
    ++generation;
    stopTrack?.();
    stopTrack = undefined;
    recordingGuard.invalidate();
    fileSession = true;
    run = undefined;
    ownedHeads = {};
    archives = [];
    fileOrigin = false;
    fileKey = null;
    notice = '';
    await recordingGuard.bind({ key: null, file: false, heads: [] });
    render();
    return;
  }
  if (key === 'close-file') {
    if (!fileSession) return;
    await save();
    // Reload restores the native garden without persisting the foreign run there.
    location.reload();
    return;
  }
  if (key === 'fullscreen') {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (error) {
      console.error('Fullscreen failed', error);
      notice = 'Fullscreen could not open in this browser. You can keep playing here.';
      render();
    }
    return;
  }
  if (key === 'new' || key === 'cancel-new') {
    confirmNew = key === 'new';
    render();
    return;
  }
  if (key === 'restart' && !confirmNew) return;
  if (key === 'start' || key === 'restart' || key === 'local') {
    if (!shelf) return;
    if (starting) return;
    ++loadGeneration;
    const attempt = ++generation;
    const seedValues = crypto.getRandomValues(new Uint32Array(1));
    const seed = required(seedValues[0], 'Garden seed requires one random value.');
    starting = true;
    recordingGuard.invalidate();
    render();
    try {
      let next = freshGarden(seed, gardenAuthors()),
        receipts: Record<string, PersonaEnvelope> = {};
      await shelf.ready;
      if (key !== 'local') {
        if (!shelf.enabled) {
          shelf.setEnabled(true);
          await shelf.ready;
        }
        const castIds = castForGame('hearsay').map((p) => p.castId);
        const batch = await shelf.request<import('@adam0white/lab-client').LifeBatchPreparation>({
          action: 'prepareBatch',
          castIds,
        });
        if (!batch.expectedHeads || castIds.some((id) => !Object.hasOwn(batch.expectedHeads, id)))
          throw new Error('The shelf omitted expected heads.');
        const eligible = eligibleGardenBatch(batch);
        const people = admitGardenBatch(eligible);
        next = freshGarden(seed, people);
        const claims = await claimGardenBatch(eligible, stamps());
        if (generation !== attempt) throw new Error('The game changed before the chapter was claimed.');
        if (claims.length || Object.keys(eligible.expectedHeads).length)
          await shelf.request({
            action: 'putBatch',
            envelopes: claims,
            expectedHeads: eligible.expectedHeads,
          });
        if (generation !== attempt) throw new Error('The game changed after the chapter was claimed.');
        next.chapter = { version: 'hearsay-hf4-batch/1', claims } satisfies GardenChapter;
        receipts = Object.fromEntries(claims.map((h) => [h.castId, h]));
      }
      if (generation === attempt) await useRun(next, false, undefined, receipts);
    } catch (e) {
      console.error('Garden start failed', e);
      notice =
        'The new garden could not start. Your saved garden has not changed. Try again later or choose new local people.';
    } finally {
      starting = false;
      render();
    }
    return;
  }
  if (key === 'automatic') {
    pace = null;
    carry = 0;
    render();
    return;
  }
  if (key === 'send') {
    openGardenFeedback(
      lab,
      () => (run ? exportGarden(run) : undefined),
      (allow) => recordingGuard.choose(allow),
      !!run,
    );
    return;
  }
  if (!run) return;
  if (key === 'menu' || key === 'back') {
    menu = key === 'menu';
    debug.open = false;
    carry = 0;
    // Settle the current complete checkpoint before exposing download or file controls.
    if (menu) await save();
    render();
    return;
  }
  if (key === 'export') {
    downloadJson(`hearsay-day-${Math.floor(run.minute / 1440) + 1}.json`, exportGarden(run));
    return;
  }
  if (key === 'account') {
    required(
      root.querySelector<HTMLDetailsElement>('.cg-account'),
      'Garden requires its rendered record.',
    ).open = true;
    return;
  }
  if (key === 'chat') {
    selected = required(run.chat, 'Garden chat action requires its current conversation.').person;
    render();
    return;
  }
  if (key === 'finish') {
    if (run.chat) advanceGarden(run, run.chat.until);
    save();
    render();
    return;
  }
  if (key.startsWith('plan-')) {
    input({ type: 'plan', choice: key.slice(5) as PlanChoice });
    return;
  }
  if (key.startsWith('confront-')) {
    input({
      type: 'confront',
      person: selected,
      choice: key.slice(9) as 'own' | 'stand',
    });
    return;
  }
  if (key === 'reserve') {
    input({ type: 'reserve', person: selected });
    return;
  }
  if (key === 'silence') input({ type: 'silence' });
  if (key === 'release') input({ type: 'release', person: run.chat?.person ?? selected });
  if (key === 'listen' || key === 'pry')
    input({
      type: 'listen',
      person: selected,
      approach: key === 'pry' ? 'pry' : 'invite',
    });
  if (['support', 'keep', 'spread'].includes(key))
    input({
      type: 'respond',
      person: selected,
      choice: key as 'support' | 'keep' | 'spread',
    });
  if (['ask', 'defend', 'tell', 'amends'].includes(key))
    input({
      type: key as 'ask' | 'defend' | 'tell' | 'amends',
      person: selected,
      about: required(
        root.querySelector<HTMLSelectElement>('#cg-about'),
        'Garden claim requires its person selector.',
      ).value as GardenPerson,
      trait: required(
        root.querySelector<HTMLSelectElement>('#cg-trait'),
        'Garden claim requires its trait selector.',
      ).value as ReputationTrait,
    });
}
export async function startGarden() {
  const recordingNotice = telemetryNotice();
  if (recordingNotice) footer.prepend(recordingNotice);

  root.innerHTML =
    '<main class="cg-loading"><h1>Hearsay</h1><p role="status">Opening your garden…</p></main>';
  recordingGuard.invalidate();
  await shelf?.ready;
  try {
    const saved = fileSession ? null : await loadGardenJournal();
    if (saved) {
      archives = (saved.meta.archives ?? []) as SourceArchive[];
      const receipts: Record<string, PersonaEnvelope> = {};
      for (const [id, head] of Object.entries(
        (saved.meta.ownedHeads ?? {}) as Record<string, PersonaEnvelope>,
      )) {
        const valid = await validatePersona(head);
        if (id !== valid.castId) throw new Error('The saved person’s history belongs to someone else.');
        receipts[id] = valid;
      }
      await useRun(saved.run, saved.meta.fileOrigin, saved.meta.fileKey, receipts);
    } else {
      if ((await get('garden-hf4-1')) || (await get('garden-cast6')))
        notice = 'Your earlier garden uses an older edition. Start fresh; its save remains on this device.';
      lab.setPersonaRecording(null);
      render();
    }
  } catch {
    notice = 'Your saved garden could not open. It is still stored on this device. Start fresh.';
    render();
  }
  const invalid = () => {
    ++generation;
    recordingGuard.invalidate();
    if (recordingBinding) void recordingGuard.bind(recordingBinding).catch(() => {});
  };
  window.addEventListener('hf-persona-preference', invalid);
  window.addEventListener('storage', (e) => {
    if (e.key === null || e.key === 'hf-persona-opt-in') invalid();
  });

  window.addEventListener('pagehide', () => {
    if (run) void save();
  });
  document.addEventListener('visibilitychange', () => {
    carry = 0;
    lastFrame = 0;
    if (document.hidden) save();
  });
  function frame(now: number) {
    if (
      lastFrame &&
      run &&
      !menu &&
      !run.ended &&
      !checkpointBusy &&
      !run.lunch.pending &&
      !document.hidden &&
      !document.querySelector('.hflab-veil, .hf-lab-veil')
    ) {
      const reading =
        now < readingUntil ||
        !!run.chat ||
        !!(run.discoveries[selected] && !run.discoveries[selected]?.response) ||
        !!root.querySelector(
          '.cg-panel details[open], .cg-account[open], .cg-info button[aria-expanded="true"]',
        );
      carry += (Math.min(1000, now - lastFrame) * gardenPace(pace, reading)) / 1000;
      if (carry >= 1) {
        const minutes = Math.floor(carry);
        carry -= minutes;
        advanceGarden(run, Math.min(14 * 1440, run.minute + minutes));
        if (run.minute % 5 === 0) save();
        if (run.minute % 1440 === 0) void checkpoint();
        render();
      }
    }
    lastFrame = now;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

async function checkpoint() {
  if (fileSession || !run || starting || checkpointBusy) return;
  checkpointBusy = true;
  const captured = run,
    atGeneration = generation;
  try {
    await shelf.ready;
    if (!shelf.enabled) {
      shelf.setEnabled(true);
      await shelf.ready;
    }
    if (fileSession || run !== captured || generation !== atGeneration) return;
    for (const id of GARDEN_IDS) {
      const capturedMinute = captured.minute,
        capturedInputs = captured.inputs.length;
      const cast = canonicalCast(GARDEN_CAST[id].castId),
        parent = ownedHeads[cast.castId];
      if (parent?.terminal) continue;
      try {
        if (fileOrigin && !parent)
          throw new Error(
            'People from an imported file cannot replace a history saved in this browser. Keep this game file for your own record.',
          );
        const actor = captured.people[id];
        let next: PersonaEnvelope;
        if (parent && portablePassport(parent) && portableWriteBlockers(cast.castId, 'hearsay').length)
          throw new Error('This person cannot be saved across games yet. Keep this chapter.');
        if (!actor.body.alive) {
          if (!parent)
            throw new Error(
              'There is no saved living history for this person to close. Their death is still saved in this game.',
            );
          next = await closePersonaBranch(parent, stamps(), Math.round(actor.now * 60_000));
        } else {
          const projected = await captureGardenSource(captured, id);
          const sourceArchive = await retainGardenSource(captured, stamps());
          const branchId = parent?.branchId ?? crypto.randomUUID();
          const life = parent?.transfer.life
            ? anchorPersonaLife(
                parent.transfer.life as Parameters<typeof anchorPersonaLife>[0],
                cast.castId,
                Date.now(),
              )
            : initialPersonaLife(cast.castId, branchId, Date.now());
          next = await createPersona({
            format: 'hf-persona/1',
            castId: cast.castId,
            castRevision: cast.revision,
            branchId,
            parentRevision: parent?.revision ?? null,
            source: stamps(),
            transfer: { ...projected.transfer, life, sourceArchive },
            limitations: projected.limitations,
          });
        }
        if (
          generation !== atGeneration ||
          run !== captured ||
          captured.minute !== capturedMinute ||
          captured.inputs.length !== capturedInputs
        )
          throw new Error('The game or person changed. Their chapter was not saved.');
        if (!(await save())) throw new Error('The source game could not be saved on this device.');
        if (
          generation !== atGeneration ||
          run !== captured ||
          captured.minute !== capturedMinute ||
          captured.inputs.length !== capturedInputs
        )
          throw new Error('The game or person changed. Their chapter was not saved.');
        await shelf.request({
          action: 'put',
          envelope: next,
        });
        if (generation !== atGeneration || run !== captured) return;
        ownedHeads[cast.castId] = next;
        const initial = captured.chapter?.claims ?? [];
        const heads = [
          ...initial,
          ...Object.values(ownedHeads).filter((h) => !initial.some((p) => p.branchId === h.branchId)),
        ];
        recordingBinding = {
          key: fileKey ? `garden-file:${fileKey}` : `garden-group:${crypto.randomUUID()}`,
          file: fileOrigin,
          heads,
        };
        await recordingGuard.bind(recordingBinding);

        await save();
      } catch {
        notice = `A person’s chapter could not be saved. Finish outstanding responsibilities and try again.`;
      }
    }
  } finally {
    checkpointBusy = false;
  }
}
