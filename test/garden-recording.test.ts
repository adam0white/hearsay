import { expect, it } from 'vitest';
import { GardenRecordingGuard } from '../src/ui/garden-recording.ts';

it('keeps file history blocked before its first head even after a positive choice', async () => {
  const lab = {
    allowed: false,
    setPersonaRecording() {
      this.allowed = false;
    },
    allowPersonaRecording(v: boolean) {
      this.allowed = v;
    },
    get personaRecordingAllowed() {
      return this.allowed;
    },
  };
  const shelf = { ready: Promise.resolve(true), request: async () => ({}) };
  const guard = new GardenRecordingGuard(lab, shelf);
  await guard.bind({ key: 'file-one', file: true, heads: [] });
  await guard.choose(true);
  expect(lab.allowed).toBe(false);
});
it('discards a positive association reply when selection or identity generation changes', async () => {
  let answer: (value: unknown) => void = () => {};
  const lab = {
    allowed: false,
    setPersonaRecording() {
      this.allowed = false;
    },
    allowPersonaRecording(v: boolean) {
      this.allowed = v;
    },
    get personaRecordingAllowed() {
      return this.allowed;
    },
  };
  const shelf = {
    ready: Promise.resolve(true),
    request: () =>
      new Promise((resolve) => {
        answer = resolve;
      }),
  };
  const guard = new GardenRecordingGuard(lab, shelf);
  const head = { castId: 'hf.cast.riza.voice', branchId: 'one', revision: 'a' } as never;
  const binding = { key: 'branch-one', file: false, heads: [head] };
  const attempt = guard.bind(binding);
  await Promise.resolve();
  guard.invalidate();
  answer({ sameEpoch: true, revisions: ['a'], recordingEpoch: 'opaque' });
  await attempt;
  expect(lab.allowed).toBe(false);
});
it('does not undo a denial when a preference refresh rebinds the same history', async () => {
  const lab = {
    allowed: false,
    setPersonaRecording() {
      this.allowed = false;
    },
    allowPersonaRecording(v: boolean) {
      this.allowed = v;
    },
    get personaRecordingAllowed() {
      return this.allowed;
    },
  };
  const head = { castId: 'hf.cast.riza.voice', branchId: 'one', revision: 'a' } as never;
  const shelf = {
    ready: Promise.resolve(true),
    request: async () => ({ sameEpoch: true, revisions: ['a'], recordingEpoch: 'opaque' }),
  };
  const guard = new GardenRecordingGuard(lab, shelf);
  const binding = { key: 'branch-one', file: false, heads: [head] };
  await guard.bind(binding);
  expect(lab.allowed).toBe(true);
  const denial = guard.choose(false);
  await guard.bind(binding);
  await denial;
  expect(lab.allowed).toBe(false);
});
