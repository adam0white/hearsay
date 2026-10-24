/** Live canonical garden shell. A loaded run never refreshes its initial people. */
import {
  anchorPersonaLife,
  canonicalCast,
  castForGame,
  claimCastChapterBatch,
  closePersonaBranch,
  createPersona,
  initialPersonaLife,
  lifeAdmission,
  type PersonaEnvelope,
  personaChannel,
  validatePersona,
  watchPersonaCheckpoint,
} from '@adam0white/lab-client';
import { downloadJson, telemetryNotice, telemetryToggle } from '@adam0white/lab-kit';
import {
  advanceGarden,
  chooseGarden,
  freshGarden,
  type GardenInput,
  type GardenRun,
  gardenHere,
  gardenStanding,
} from '../sim/garden.ts';
import { GARDEN_CAST, GARDEN_IDS, type GardenPerson, gardenLocation } from '../sim/garden-cast.ts';
import {
  admitGardenPerson,
  captureGardenSource,
  type GardenChapter,
  gardenId,
  type SourceArchive,
} from '../sim/garden-continuity.ts';
import { exportGarden, importGarden } from '../sim/garden-export.ts';
import { actualGardenLocation, type PlanChoice, type ReputationTrait } from '../sim/garden-stakes.ts';
import { openGardenFeedback } from './garden-feedback.ts';
import { GardenRecordingGuard, type RecordingBinding } from './garden-recording.ts';
import { lab } from './lab.ts';
import { get, put, putNow } from './store.ts';
import './garden.css';

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
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
  engine: '2.17.0',
  rules: 'hearsay-cast-6',
});
let run: GardenRun | undefined;
let selected: GardenPerson = 'riza';
let menu = false;
let pace = 1;
let lastFrame = 0;
let carry = 0;
let notice = '';
let stopTrack: (() => void) | undefined;
let fileOrigin = false;
let uiGeneration = 0;
let loadGeneration = 0;
const root = document.getElementById('app')!;
let recordingNotice: HTMLElement | null = null;
function clock() {
  const m = run?.minute ?? 360,
    t = m % 1440;
  return `Day ${Math.min(14, Math.floor(m / 1440) + 1)} · ${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}
function button(label: string, key: string, disabled = false) {
  return `<button type="button" data-action="${key}" ${disabled ? 'disabled' : ''}>${label}</button>`;
}
async function save(): Promise<boolean> {
  return run
    ? put('garden-cast6', {
        export: exportGarden(run),
        fileOrigin,
        fileKey,
        ownedHeads,
        archives,
      })
    : false;
}
function input(value: GardenInput) {
  if (!run) return;
  if (!chooseGarden(run, value))
    notice = 'They cannot stay for this now. Try when their duty ends, or leave the matter private.';
  else {
    notice = '';
    save();
  }
  render();
}
async function useRun(
  next: GardenRun,
  file = false,
  storedFileKey?: string | null,
  receipts: Record<string, PersonaEnvelope> = {},
) {
  const current = ++generation;
  if (next.chapter) {
    if (
      next.chapter.version !== 'hearsay-batch/1' ||
      next.chapter.mapping !== 'hearsay-calendar/1' ||
      next.chapter.inputs.length !== next.chapter.claims.length ||
      next.chapter.inputs.length > 8 ||
      new Set(next.chapter.inputs.map((p) => p.parent.castId)).size !== next.chapter.inputs.length
    )
      throw new Error('Invalid pinned cast collection.');
    for (const input of next.chapter.inputs) {
      const parent = await validatePersona(input.parent);
      lifeAdmission(input, 'hearsay');
      const claim = next.chapter.claims.find((h) => h.castId === parent.castId);
      if (!claim || claim.parentRevision !== parent.revision || claim.branchId !== parent.branchId)
        throw new Error('Pinned claim does not follow its source.');
      await validatePersona(claim);
    }
  }
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
  fileOrigin = file;
  menu = false;
  lastFrame = 0;
  carry = 0;
  stopTrack = lab.trackRun(() => exportGarden(run!), {
    getLogs: () => run!.log,
    runKey: () => `${run!.seed}:${fileOrigin}`,
  });
  save();
  render();
}
function renderTitle() {
  root.innerHTML = `<main class="cg-title"><p class="eyebrow">A fortnight in the neighbourhood</p><h1>Hearsay</h1><p class="cg-subtitle">Someone will hear.</p><p>You are Hatice, keeper of a tea garden in Istanbul. People stop between shifts, deliveries and appointments.</p><p class="goal">Open a paid workers’ lunch on Day 13. Agree supplies on Day 4 and paid cooking on Day 8. Earn four reservations by keeping your word good.</p><p>Fourteen days. Your words change who stays.</p>${notice ? `<p role="status">${esc(notice)}</p>` : ''}<p>Browser continuity: ${shelf.enabled ? 'on. The whole available cast must be compatible before play starts.' : 'off. This garden stays independent.'}</p>${button(shelf.enabled ? 'Begin with the saved cast' : 'Begin a fresh fortnight', 'start', starting)}${button(shelf.enabled ? 'Turn browser continuity off' : 'Turn browser continuity on', 'continuity')}${button('Send word', 'send')}${shelf.enabled ? button('Play a separate local fortnight', 'local') : ''}<label class="cg-file">Open a run file<input type="file" id="import-run" accept=".json,application/json"></label><p class="fine">Earlier local saves are kept. This edition starts a new garden with eight canonical people.</p></main>`;
  if (recordingNotice && !recordingNotice.dataset.shown) {
    root.querySelector('.cg-title h1')?.after(recordingNotice);
    recordingNotice.dataset.shown = '1';
  }
}
function render() {
  ++uiGeneration;
  const opened = [...root.querySelectorAll<HTMLDetailsElement>('details')].map((d) => d.open);
  const traitSelected = root.querySelector<HTMLSelectElement>('#cg-trait')?.value;
  const about = root.querySelector<HTMLSelectElement>('#cg-about')?.value;
  const focusedAction = (document.activeElement as HTMLElement | null)?.dataset.action;
  if (!run) {
    renderTitle();
    bind();
    return;
  }
  const id = selected,
    c = GARDEN_CAST[id],
    discovery = run.discoveries[id],
    here = gardenHere(run, id);
  const running = run.chat;
  let panel = '';
  if (menu) {
    panel = `<h2>Game menu</h2><p>The clock is stopped. Garden cash: ${run.lunch.cash} lira. Unpaid invoices: ${run.lunch.debt} lira.</p>${button('Save this garden', 'save')}${button('Download this run', 'export')}<label class="cg-file">Import a run<input type="file" id="import-run" accept=".json,application/json"></label>${button('Send this run to the notebook', 'send')}<div id="cg-recording"></div><details><summary>Browser continuity</summary><p>${shelf.enabled ? 'Continuity is on. Existing runs keep their pinned people; a new chapter checks all eight together.' : 'Continuity is off. Local play and export still work.'}</p>${button(shelf.enabled ? 'Turn browser continuity off' : 'Turn browser continuity on', 'continuity')}<label>Person to checkpoint<select id="cg-checkpoint-person">${GARDEN_IDS.map((p) => `<option value="${p}">${esc(GARDEN_CAST[p].name)}</option>`).join('')}</select></label>${button('Save their eligible closing chapter', 'checkpoint')}${button('Create an explicit fresh browser branch', 'fork')}<p>A checkpoint keeps the exact accepted parent. Unfinished work, invoices and source duties may refuse. Export before replacing a branch.</p>${run.chapter?.inputs.map((p) => `<p>${esc(lifeAdmission(p, 'hearsay').line)}</p>`).join('') ?? ''}</details>${button('Begin another fresh fortnight', 'restart')}${button('Back to the garden', 'back')}`;
  } else if (run.lunch.pending) {
    panel = `<h2>${run.lunch.pending === 'trial' ? 'Day 4 · Reserve the supplies' : 'Day 8 · Agree paid cooking'}</h2><p>Garden cash: ${run.lunch.cash} lira. Unpaid invoices: ${run.lunch.debt} lira. Meals cost 100 lira; four paid-now meals cover 380 lira of sample, preparation and food. Credit raises the total to 410 lira, requiring five meals.</p><p>${run.lunch.pending === 'trial' ? 'Rıza will deliver counted bread. Osman will supply a written produce order. Pay for a sample now, take a dearer credit invoice, or decline.' : 'Aylin offers preparation after her school shift, with a clear leaving time. Her 180-lira fee is due before the Day 10, 17:00 preparation appointment. The free bench remains separate from paid food.'}</p>${run.lunch.pending === 'trial' ? button('Pay 120 lira for the sample now', 'plan-paid-trial') + button('Take credit · 150 lira due before lunch, five meals needed', 'plan-credit-trial') + button('Decline the sample · no supplies reserved', 'plan-decline-trial') : button('Pay 180 lira for a defined preparation session', 'plan-paid-prep') + button('Owe 180 lira · work waits for payment', 'plan-unpaid-prep') + button('Cancel the lunch preparation', 'plan-cancel')}${running ? button('Finish the current conversation first', 'finish') + button('Leave the current conversation', 'release') : ''}<p>The clock holds while you read. The terms cost real takings. A promise of payment is not a receipt.</p>`;
  } else if (run.ended) {
    panel = `<h2>${run.lunch.result === 'open' ? 'The workers’ lunch opened' : run.lunch.result === 'short' ? 'The lunch made a loss' : 'The lunch could not open'}</h2><p>${esc(run.lunch.reason ?? 'No lunch result was recorded.')}</p><p>${run.lunch.debt ? 'An unpaid invoice remains in the local chapter; departure must not clear it.' : 'The lunch account carries no unpaid invoice.'}</p><p>${esc(gardenStanding(run))}</p><p>${run.routes.filter((r) => r.from === 'hatice').length ? 'Your statements travelled beyond your own table. The account below keeps their recipients.' : 'You started no testimony.'}</p>${button('Read the garden account', 'account')}${button('Game menu', 'menu')}`;
  } else {
    panel = `<h2>${esc(c.name)} <small>${id === 'hatice' ? '· you' : ''}</small></h2><p>${esc(c.job)} · ${esc(actualGardenLocation(run, id))}</p>`;
    if (running?.person === id)
      panel += `<p role="status">${id === 'hatice' ? 'You are revisiting your own account for fifteen minutes' : 'You are in a fifteen-minute conversation'}. It finishes at ${Math.floor((running.until % 1440) / 60)}:${String(running.until % 60).padStart(2, '0')}. You can leave early.</p>${button('Let the conversation finish', 'finish')}${button('Leave the conversation', 'release')}`;
    else if (running)
      panel += `<p>You are listening to ${esc(GARDEN_CAST[running.person].name)}. Finish or leave that conversation first.</p>${button('Go to the conversation', 'chat')}`;
    else if (discovery)
      panel += `<details><summary>About ${esc(c.name)}</summary><p>${Math.floor((run.people[id].now - run.people[id].life.bornAt) / (365 * 1440))} years old. ${esc(c.family)}</p></details><p class="cg-confidence">${esc(discovery.fact)}</p>${discovery.response ? `<p>${esc(discovery.outcome ?? '')}</p>${button('Sit and talk again', 'listen', !here)}` : `${button('Offer practical support without repeating it', 'support', !here)}${button('Respect the confidence and leave it private', 'keep', !here)}${button('Repeat the confidence at another table', 'spread', !here)}`}`;
    else
      panel += `<p>${here ? esc(c.cue) : 'They are away or unavailable. Their work and rest have their own hours.'}</p>${button(id === 'hatice' ? 'Revisit your own account for fifteen minutes' : 'Invite a quiet conversation', 'listen', !here)}${id !== 'hatice' ? button('Press for private details', 'pry', !here) : ''}`;
    const confrontation = run.lunch.confrontations.find(
      (c) => c.person === id && !c.resolved && c.at <= run!.minute,
    );
    if (confrontation)
      panel = `<h2>${esc(c.name)} confronts you</h2><p>The contradicted account has been traced to your table. Take responsibility and correct it with each listener, or stand by it and lose a day’s custom.</p>${button('Own it; agree to speak to the listeners', 'confront-own', !here)}${button('Stand by the contradicted account', 'confront-stand', !here)}`;
    if (!running && id !== 'hatice' && run.minute >= 7 * 1440 + 720 && run.minute < 12 * 1440 + 780)
      panel += button('Invite them to book the Day 13 lunch', 'reserve', !here);
    if (!running && id !== 'hatice')
      panel += `<details><summary>Talk about someone else</summary><label>Who?<select id="cg-about">${GARDEN_IDS.filter(
        (p) => p !== id && p !== 'hatice',
      )
        .map((p) => `<option value="${p}">${esc(GARDEN_CAST[p].name)}</option>`)
        .join(
          '',
        )}</select></label><label>What?<select id="cg-trait"><option value="reliable">Keeping promises</option><option value="honest">Honesty</option><option value="kind">Kindness</option><option value="generous">Generosity</option></select></label>${button('Ask what they have heard', 'ask', !here)}${button('Defend them on this point', 'defend', !here)}${button('Make a damaging claim on this point', 'tell', !here)}${button('Withdraw your accusation', 'amends', !here)}<p class="fine">A character claim is your testimony. A private confidence stays out of ordinary rumour unless you choose to repeat it.</p></details>`;
  }
  if (!menu && !run.ended && !running) panel += button('Pour tea and hold your tongue', 'silence');
  if (!menu && run.lunch.debt > 0)
    panel +=
      `<p>Garden cash: ${run.lunch.cash} lira. Outstanding invoice: ${run.lunch.debt} lira.</p>` +
      button(`Pay the ${run.lunch.debt} lira invoice`, 'plan-settle', run.lunch.cash < run.lunch.debt);
  root.innerHTML = `<main class="cg-game"><header class="cg-header"><div><strong>Hearsay</strong> <span>${clock()}</span></div>${button(menu ? 'Back' : 'Game menu', menu ? 'back' : 'menu')}<p>Day 13 lunch · Bread ${run.lunch.breadDelivered ? 'here' : run.lunch.bread ? 'agreed' : '?'} · Produce ${run.lunch.produceDelivered ? 'here' : run.lunch.produce ? 'agreed' : '?'} · Cook ${run.lunch.prepared ? 'ready' : run.lunch.cook ? 'paid' : '?'} · ${run.lunch.reservations.length}/${run.lunch.trial === 'credit' ? 5 : 4} reserved</p><div class="cg-paces">${[0, 1, 4, 12].map((p, i) => `<button type="button" data-pace="${p}" aria-pressed="${pace === p}">${['Pause', 'Slow', 'Walk', 'Hurry'][i]}</button>`).join('')}</div></header><section class="cg-scene" aria-label="The tea garden"><div class="cg-gate">THE GARDEN GATE <span>${run.benchFree ? 'Anyone may sit here without buying.' : 'A few chairs in the shade.'}</span></div><div class="cg-tables">${GARDEN_IDS.map((p) => `<button type="button" class="cg-person ${gardenHere(run!, p) ? 'here' : 'away'}" data-person="${p}" aria-pressed="${selected === p}"><span aria-hidden="true">${p === 'hatice' ? '☕' : '◯'}</span><strong>${esc(GARDEN_CAST[p].name)}</strong><small>${gardenHere(run!, p) ? 'at the garden' : esc(actualGardenLocation(run!, p))}</small></button>`).join('')}</div><p class="cg-standing">${esc(gardenStanding(run))}</p></section><section class="cg-panel" aria-live="polite">${notice ? `<p class="cg-notice" role="status">${esc(notice)}</p>` : ''}${panel}</section><details class="cg-account"><summary>What you heard · garden account</summary>${run.log
    .slice(-60)
    .map(
      (l) =>
        `<p><small>Day ${Math.floor(l.at / 1440) + 1} ${Math.floor((l.at % 1440) / 60)}:${String(l.at % 60).padStart(2, '0')}</small> ${esc(l.text)}</p>`,
    )
    .join('')}</details></main>`;
  root.querySelectorAll<HTMLDetailsElement>('details').forEach((d, i) => {
    d.open = opened[i] ?? false;
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
      void action(b.dataset.action!);
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
        if (file.size > 8 * 1024 * 1024) throw new Error('Run file exceeds 8 MiB.');
        const text = await file.text();
        if (attempt !== loadGeneration || !valid()) return;
        ++generation;
        await useRun(importGarden(text), true);
      } catch (error) {
        notice = error instanceof Error ? error.message : 'Could not read this run.';
        render();
      }
    };
}
async function action(key: string) {
  if (key === 'continuity') {
    ++generation;
    recordingGuard.invalidate();
    shelf.setEnabled(!shelf.enabled);
    if (recordingBinding) await recordingGuard.bind(recordingBinding);
    render();
    return;
  }
  if (key === 'start' || key === 'restart' || key === 'local') {
    if (starting) return;
    ++loadGeneration;
    const attempt = ++generation;
    const seed = crypto.getRandomValues(new Uint32Array(1))[0]!;
    starting = true;
    recordingGuard.invalidate();
    render();
    try {
      let next = freshGarden(seed),
        receipts: Record<string, PersonaEnvelope> = {};
      await shelf.ready;
      if (shelf.enabled && key !== 'local') {
        const chapter = await claimCastChapterBatch(
          shelf,
          castForGame('hearsay').map((p) => p.castId),
          stamps(),
          async (inputs) => {
            const people = Object.fromEntries(
              inputs.map((input) => [
                gardenId(input.parent.castId),
                admitGardenPerson(input, seed, archives),
              ]),
            );
            return freshGarden(seed, people);
          },
          { isCurrent: () => generation === attempt },
        );
        if (chapter) {
          next = chapter.initial;
          next.chapter = {
            version: 'hearsay-batch/1',
            inputs: chapter.inputs,
            claims: chapter.claims,
            mapping: 'hearsay-calendar/1',
          } satisfies GardenChapter;
          receipts = Object.fromEntries(chapter.claims.map((h) => [h.castId, h]));
        }
      }
      if (generation === attempt) await useRun(next, false, undefined, receipts);
    } catch (e) {
      notice = `${e instanceof Error ? e.message : 'Admission refused.'} No partial new chapter started. Keep the current garden, export, or choose separate local play.`;
    } finally {
      starting = false;
      render();
    }
    return;
  }
  if (key === 'checkpoint' || key === 'fork') {
    const id = root.querySelector<HTMLSelectElement>('#cg-checkpoint-person')?.value as GardenPerson;
    await checkpoint(id, key === 'fork');
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
    carry = 0;
    render();
    return;
  }
  if (key === 'save') {
    const stored = await save();
    notice = stored
      ? 'Garden saved on this device.'
      : 'Could not save on this device. Download a file before leaving.';
    render();
    return;
  }
  if (key === 'export') {
    downloadJson(`hearsay-day-${Math.floor(run.minute / 1440) + 1}.json`, exportGarden(run));
    return;
  }
  if (key === 'account') {
    root.querySelector<HTMLDetailsElement>('.cg-account')!.open = true;
    return;
  }
  if (key === 'chat') {
    selected = run.chat!.person;
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
      about: root.querySelector<HTMLSelectElement>('#cg-about')!.value as GardenPerson,
      trait: root.querySelector<HTMLSelectElement>('#cg-trait')!.value as ReputationTrait,
    });
}
export async function startGarden() {
  recordingNotice = telemetryNotice();
  if (recordingNotice)
    Object.assign(recordingNotice.style, { position: 'static', transform: 'none', margin: '0 auto' });
  root.innerHTML =
    '<main class="cg-loading"><h1>Hearsay</h1><p role="status">Opening your garden…</p></main>';
  recordingGuard.invalidate();
  await shelf.ready;
  const saved = await get<{
    export: ReturnType<typeof exportGarden>;
    fileOrigin: boolean;
    fileKey?: string | null;
    ownedHeads?: Record<string, PersonaEnvelope>;
    archives?: SourceArchive[];
  }>('garden-cast6');
  if (saved) {
    try {
      archives = saved.value.archives ?? [];
      const receipts: Record<string, PersonaEnvelope> = {};
      for (const [id, head] of Object.entries(saved.value.ownedHeads ?? {})) {
        const valid = await validatePersona(head);
        if (id !== valid.castId) throw new Error('Local ownership mismatch');
        receipts[id] = valid;
      }
      await useRun(
        importGarden(JSON.stringify(saved.value.export)),
        saved.value.fileOrigin,
        saved.value.fileKey,
        receipts,
      );
    } catch {
      notice = 'This saved edition cannot open here. Keep its file and start fresh.';
      render();
    }
  } else {
    lab.setPersonaRecording(null);
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
  watchPersonaCheckpoint(() => checkpoint());
  window.addEventListener('pagehide', () => {
    if (run)
      putNow('garden-cast6', {
        export: exportGarden(run),
        fileOrigin,
        fileKey,
        ownedHeads,
        archives,
      });
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
      !run.lunch.pending &&
      !document.hidden &&
      !document.querySelector('.hf-lab-veil')
    ) {
      carry += (Math.min(1000, now - lastFrame) * pace) / 1000;
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

async function checkpoint(selected?: GardenPerson, fork = false) {
  if (!run || !shelf.enabled || starting || checkpointBusy) return;
  checkpointBusy = true;
  const captured = run,
    atGeneration = generation;
  try {
    for (const id of selected ? [selected] : GARDEN_IDS) {
      const cast = canonicalCast(GARDEN_CAST[id].castId),
        parent = fork ? undefined : ownedHeads[cast.castId];
      if (parent?.terminal) continue;
      try {
        if (fileOrigin && !parent && !fork)
          throw new Error(
            'Imported files do not own embedded branch receipts. Keep local or explicitly create a fresh branch.',
          );
        const actor = captured.people[id];
        let next: PersonaEnvelope;
        if (!actor.body.alive) {
          if (!parent) throw new Error('No owned living branch to close. The local death remains saved.');
          next = await closePersonaBranch(parent, stamps(), captured.minute);
        } else {
          const projected = await captureGardenSource(captured, id);
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
            transfer: { ...projected.transfer, life },
            limitations: projected.limitations,
          });
          // Keep the full source prefix locally before exposing its bounded passport.
          archives = [
            ...archives.filter((a) => a.digest !== projected.archive.digest),
            projected.archive,
          ].slice(-8);
          while (archives.length > 1 && JSON.stringify(archives).length > 8 * 1024 * 1024) archives.shift();
          if (JSON.stringify(archives).length > 8 * 1024 * 1024)
            throw new Error('Source archive exceeds 8 MiB. Download the full garden before leaving.');
          if (!(await save()))
            throw new Error('Could not retain the source-bound local archive. Export before leaving.');
        }
        if (generation !== atGeneration || run !== captured)
          throw new Error('Run or identity changed. Checkpoint cancelled.');
        await shelf.request({
          action: 'put',
          envelope: next,
          ...(fork ? { fork: true } : {}),
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
        notice = `${cast.name}’s ${next.terminal ? 'death' : 'closing chapter'} is saved in this browser.`;
        await save();
      } catch (e) {
        if (selected) notice = e instanceof Error ? e.message : 'Checkpoint refused.';
      }
    }
  } finally {
    checkpointBusy = false;
  }
}
