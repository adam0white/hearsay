/** Feedback uses the same remembered-name and consent paths as Night Watch. */
import { feedbackPersonaControl, feedbackSharePlay } from '@adam0white/lab-kit';
import { lab } from './lab';

const NAME_KEY = 'hf-lab-feedback-name';
function stored(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}
export function downloadRun(run: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(run, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'hearsay-run.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function openFeedback(getRun: () => unknown, onClose: () => void, hasRun = true): HTMLDialogElement {
  const d = document.createElement('dialog');
  d.className = 'feedback-dialog sheet';
  d.setAttribute('aria-label', 'Feedback');
  d.dataset.systemMenu = 'true';
  d.innerHTML = `<div class="dialog-head"><h2>Feedback</h2><button type="button" aria-label="Close Feedback">×</button></div>
    <div class="feedback-body lk-sheet-body">
    <p>Send a note even when recording is off. Play history is attached only when recording is allowed.</p>
    <div class="feedback-recording"></div>
    <fieldset class="feedback-verdicts" aria-label="Would you keep playing?"><button type="button" data-verdict="keep" aria-pressed="false">I’d keep playing</button><button type="button" data-verdict="mixed" aria-pressed="false">Not sure</button><button type="button" data-verdict="quit" aria-pressed="false">I’d stop here</button></fieldset>
    <textarea aria-label="Your note" rows="4" placeholder="What happened? What did you want to do? What got in the way?"></textarea>
    <details class="feedback-name"><summary>+ Add a name or tester ID</summary><label>Your name or tester ID<input type="text" maxlength="60" autocomplete="nickname"></label><p class="fine">If you send a name, it labels your past and future play on this device. Leave it empty to send no name.</p></details>
    <details class="feedback-preview"><summary>What is sent</summary><p>Your note and optional name are sent. Your game is attached only when recording is allowed.</p><pre></pre><a href="https://human.adamwhite.work/lab/privacy/">Lab privacy</a></details>
    <button type="button" class="feedback-download">Keep a copy of this run</button><p role="status"></p></div>
    <div class="feedback-actions lk-sheet-actions"><button type="button" class="primary feedback-send">Submit</button></div>`;
  const note = d.querySelector('textarea')!;
  const name = d.querySelector<HTMLInputElement>('.feedback-name input')!;
  const send = d.querySelector<HTMLButtonElement>('.feedback-send')!;
  const status = d.querySelector<HTMLElement>('[role="status"]')!;
  const preference = d.querySelector<HTMLElement>('.feedback-recording')!;
  name.value = stored(NAME_KEY);
  if (name.value) d.querySelector<HTMLDetailsElement>('.feedback-name')!.open = true;
  let verdict = '';
  let busy = false;
  let sent = false;
  const share = feedbackPersonaControl(lab);
  if (share) preference.append(share);
  const update = () => {
    send.disabled = !sent && busy;
  };
  const success = () => {
    try {
      if (name.value.trim()) localStorage.setItem(NAME_KEY, name.value.trim());
      else localStorage.removeItem(NAME_KEY);
    } catch {
      /* Device storage is optional. */
    }
    sent = true;
    status.textContent = 'Sent. Your note is stored.';
    send.textContent = 'Back to the game';
    update();
  };
  d.querySelectorAll<HTMLButtonElement>('[data-verdict]').forEach((b) => {
    b.onclick = () => {
      verdict = verdict === b.dataset.verdict ? '' : (b.dataset.verdict ?? '');
      d.querySelectorAll<HTMLButtonElement>('[data-verdict]').forEach((chip) => {
        chip.setAttribute('aria-pressed', String(chip.dataset.verdict === verdict));
      });
    };
  });
  d.querySelector<HTMLButtonElement>('.dialog-head button')!.onclick = () => d.close();
  const download = d.querySelector<HTMLButtonElement>('.feedback-download')!;
  download.hidden = !hasRun;
  download.onclick = () => downloadRun(getRun());
  d.querySelector<HTMLDetailsElement>('.feedback-preview')!.ontoggle = () => {
    d.querySelector('pre')!.textContent = JSON.stringify(getRun(), null, 2);
  };
  send.onclick = async () => {
    if (sent) {
      d.close();
      return;
    }
    if (busy) return;
    busy = true;
    update();
    const message = [verdict ? `Verdict: ${verdict}` : '', note.value.trim()].filter(Boolean).join('\n\n');
    try {
      let run: unknown;
      try {
        run = getRun();
      } catch {
        // An unavailable optional run does not block the note.
      }
      const sharePlay = feedbackSharePlay(share);
      await lab.sendFeedback(message, {
        name: name.value.trim(),
        run,
        sharePlay,
      });
      success();
    } catch {
      status.textContent = 'Your note could not be sent. Please try again.';
    } finally {
      busy = false;
      update();
    }
  };
  const sync = () => {
    update();
  };
  window.addEventListener('storage', sync);
  window.addEventListener('hf-lab-preference', sync);
  const viewport = window.visualViewport;
  const resize = () => {
    if (!viewport) return;
    d.style.setProperty('--feedback-height', `${viewport.height}px`);
    d.style.setProperty('--feedback-top', `${viewport.offsetTop}px`);
  };
  viewport?.addEventListener('resize', resize);
  viewport?.addEventListener('scroll', resize);
  d.addEventListener(
    'close',
    () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('hf-lab-preference', sync);
      viewport?.removeEventListener('resize', resize);
      viewport?.removeEventListener('scroll', resize);
      d.remove();
      onClose();
    },
    { once: true },
  );
  document.body.append(d);
  update();
  resize();
  d.showModal();
  lab.screen('feedback');
  return d;
}
