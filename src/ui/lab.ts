/**
 * The game lab client (linked recording and the existing run dialog), from @adam0white/lab-client.
 * Headless test browsers (navigator.webdriver, as Playwright sets it) send nothing, so the playtest driver does not
 * count as a player.
 */
import { createLab, type Lab } from '@adam0white/lab-client';
import { compactRun, type RunExport } from './export';

export const notebookRunOptions = {
  compact: (run: unknown) => compactRun(run as RunExport),
  compactNote: 'The seed, choices, clock and fingerprint are included; the full village state is omitted.',
};

const quiet: Lab | null =
  typeof navigator !== 'undefined' && navigator.webdriver
    ? ({
        milestone() {},
        screen() {},
        flush() {},
        eventsOn: false,
        telemetryOn: false,
        playerId: null,
        setTelemetryOff() {},
        trackRun() {
          return () => {};
        },
        captureSave() {},
        log() {},
        sendFeedback: async () => '',
        privacySignalOn: false,
        privacyOverride: false,
        setPrivacyOverride() {},
        setEventsOff() {},
        sendRun: async () => '',
        sendEnvelopeText: async () => '',
        openSendDialog() {},
        game: 'hearsay',
        endpoint: '',
        build: () => ({}) as ReturnType<Lab['build']>,
      } as Lab)
    : null;

export const lab: Lab = quiet ?? createLab({ game: 'hearsay' });
