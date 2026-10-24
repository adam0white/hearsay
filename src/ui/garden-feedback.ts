import { type Lab, openSendDialog } from '@adam0white/lab-client';
/** Shared sheet uses the live garden's complete-history guard, never a direct grant. */
export function openGardenFeedback(
  lab: Lab,
  getRun: () => unknown,
  choose: (allow: boolean) => Promise<void>,
  hasRun: boolean,
): void {
  const scoped = Object.create(lab) as Lab;
  if (!hasRun) Object.defineProperty(scoped, 'personaRecordingRequired', { value: false });
  let sheet: HTMLElement | undefined;
  scoped.allowPersonaRecording = (allow) => {
    void choose(allow)
      .then(() => {
        if (!sheet?.isConnected) return;
        const checkbox = sheet.querySelector<HTMLInputElement>('#hflab-persona');
        if (checkbox) checkbox.checked = lab.personaRecordingAllowed;
      })
      .catch(() => {
        if (!sheet?.isConnected) return;
        const checkbox = sheet.querySelector<HTMLInputElement>('#hflab-persona');
        if (checkbox) checkbox.checked = lab.personaRecordingAllowed;
        const status = sheet.querySelector('.status');
        if (status) status.textContent = 'History choice could not be applied. Your note can still send.';
      });
  };
  scoped.sendFeedback = (note, options) =>
    lab.sendFeedback(note, { name: options?.name, run: options?.run ?? { feedbackOnly: true } });
  openSendDialog({ lab: scoped, getRun });
  sheet = [...document.querySelectorAll<HTMLElement>('.hflab')].at(-1);
  const label = sheet?.querySelector('label[for=hflab-persona]');
  if (label) {
    for (const child of [...label.childNodes]) if (child.nodeType === Node.TEXT_NODE) child.remove();
    label.append('Link all continuing histories in this garden to lab recording (optional)');
  }
}
