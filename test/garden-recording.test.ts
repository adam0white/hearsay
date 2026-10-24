import { expect, it, vi } from 'vitest';
import { GardenRecordingGuard } from '../src/ui/garden-recording.ts';

it('binds history without recording RPCs or waiting for shelf identity', async () => {
  const lab = {
    setPersonaRecording: vi.fn(),
    allowPersonaRecording: vi.fn(),
    personaRecordingAllowed: false,
  };
  const shelf = {
    ready: new Promise<boolean>(() => {}),
    request: vi.fn(async () => {
      throw new Error('obsolete recording RPC');
    }),
  };
  const guard = new GardenRecordingGuard(lab, shelf);
  await guard.bind({ key: 'file-history', file: true, heads: [] }, true);
  const generation = guard.capture();
  await guard.choose(true);
  expect(guard.unchanged(generation)).toBe(true);
  expect(shelf.request).not.toHaveBeenCalled();
  guard.invalidate();
  expect(guard.unchanged(generation)).toBe(false);
});
