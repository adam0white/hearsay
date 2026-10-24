import { type Lab, openSendDialog } from '@adam0white/lab-client';
/** Recording and cross-game linkage follow the single lab recording preference. */
export function openGardenFeedback(
  lab: Lab,
  getRun: () => unknown,
  _choose: (allow: boolean) => Promise<void>,
  _hasRun: boolean,
): void {
  openSendDialog({ lab, getRun });
}
