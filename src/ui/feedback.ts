/** Send word uses the same remembered-name and consent paths as Night Watch. */
import { setTelemetryOff } from '@adam0white/lab-kit';
import { lab, notebookRunOptions } from './lab';

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
export function openFeedback(getRun: () => unknown, onClose: () => void): HTMLDialogElement {
  const d = document.createElement('dialog');
  d.className = 'feedback-dialog sheet';
  d.setAttribute('aria-label', 'Send word');
  d.dataset.systemMenu = 'true';
  d.innerHTML = `<div class="dialog-head"><h2>Send word</h2><button type="button" aria-label="Close Send word">×</button></div>
    <div class="feedback-body lk-sheet-body">
    <p>Your run, saves and log reach us on their own. Tell us what they can’t show.</p>
    <div class="feedback-recording"></div>
    <fieldset class="feedback-verdicts" aria-label="Would you keep playing?"><button type="button" data-verdict="keep" aria-pressed="false">I’d keep playing</button><button type="button" data-verdict="mixed" aria-pressed="false">Not sure</button><button type="button" data-verdict="quit" aria-pressed="false">I’d stop here</button></fieldset>
    <textarea aria-label="Your word" rows="4" placeholder="What happened, what you wanted, what got in the way."></textarea>
    <details class="feedback-name"><summary>+ Add a name or tester id</summary><label>Your name or tester id<input type="text" maxlength="60" autocomplete="nickname"></label><p class="fine">A sent name labels your past and future play on this device. Leave it empty to stay pseudonymous.</p></details>
    <details class="feedback-preview"><summary>What is sent</summary><p>Your note, linked to this device’s play history, or this run with your consent.</p><pre></pre><a href="https://human.adamwhite.work/lab/privacy/">Lab privacy</a></details>
    <button type="button" class="feedback-download">Keep a copy of this run</button><p role="status"></p></div>
    <div class="feedback-actions lk-sheet-actions"><button type="button" class="primary feedback-send">Send</button></div>`;
  const note = d.querySelector('textarea')!;
  const name = d.querySelector<HTMLInputElement>('.feedback-name input')!;
  const send = d.querySelector<HTMLButtonElement>('.feedback-send')!;
  const status = d.querySelector<HTMLElement>('[role="status"]')!;
  const preference = d.querySelector<HTMLElement>('.feedback-recording')!;
  name.value = stored(NAME_KEY);
  if (name.value) d.querySelector('details')!.open = true;
  let verdict = '';
  let consent = false;
  let busy = false;
  let sent = false;
  const recordingOff = () =>
    stored('hf-lab-recording-off') === '1' || stored('hf-lab-events-off:hearsay') === '1';
  const privacyOnly = () => !recordingOff() && lab.privacySignalOn && !lab.privacyOverride;
  const blocked = () => recordingOff() || (privacyOnly() && !consent);
  const offNotice = document.createElement('p');
  const recordingLabel = document.createElement('label');
  const recordingToggle = document.createElement('input');
  recordingToggle.type = 'checkbox';
  recordingLabel.append(recordingToggle, ' Record play for the lab');
  const consentLabel = document.createElement('label');
  const consentToggle = document.createElement('input');
  consentToggle.type = 'checkbox';
  consentLabel.append(consentToggle, ' Send this run with my note');
  const showRecording = recordingOff();
  preference.append(offNotice, recordingLabel, consentLabel);
  const update = () => {
    offNotice.hidden = !recordingOff();
    offNotice.textContent = 'Recording is off, so nothing is sent.';
    recordingLabel.hidden = !showRecording && !recordingOff();
    recordingToggle.checked = !recordingOff();
    consentLabel.hidden = !privacyOnly();
    consentToggle.checked = consent;
    send.disabled = !sent && (busy || blocked());
  };
  recordingToggle.onchange = () => {
    setTelemetryOff(lab, !recordingToggle.checked);
    update();
  };
  consentToggle.onchange = () => {
    consent = consentToggle.checked;
    update();
  };
  const success = () => {
    try {
      if (name.value.trim()) localStorage.setItem(NAME_KEY, name.value.trim());
      else localStorage.removeItem(NAME_KEY);
    } catch {
      /* Device storage is optional. */
    }
    sent = true;
    status.textContent = 'Sent. Thank you.';
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
  d.querySelector<HTMLButtonElement>('.feedback-download')!.onclick = () => downloadRun(getRun());
  d.querySelector<HTMLDetailsElement>('.feedback-preview')!.ontoggle = () => {
    d.querySelector('pre')!.textContent = JSON.stringify(getRun(), null, 2);
  };
  send.onclick = async () => {
    if (sent) {
      d.close();
      return;
    }
    if (busy || blocked()) return;
    busy = true;
    update();
    const message = [verdict ? `Verdict: ${verdict}` : '', note.value.trim()].filter(Boolean).join('\n\n');
    try {
      if (privacyOnly()) {
        const run = getRun();
        try {
          await lab.sendRun(run, { note: message, name: name.value.trim() });
        } catch {
          lab.openSendDialog({
            getRun: () => run,
            ...notebookRunOptions,
            note: message,
            name: name.value.trim(),
            onSent: success,
          });
          // Keep the fallback inside the native modal's active top layer.
          const fallback = document.querySelector('.hflab-veil');
          if (fallback) d.append(fallback);
          status.textContent = 'Use the send dialog to finish sending.';
          return;
        }
      } else await lab.sendFeedback(message, { name: name.value.trim() });
      success();
    } catch {
      status.textContent = 'Your word could not be sent. Please try again.';
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
