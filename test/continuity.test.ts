import { createPerson, projectPersona } from '@adam0white/human-framework';
import { createPersona } from '@adam0white/lab-client';
import { expect, it, vi } from 'vitest';
import { newGame } from '../src/sim/game';
import { checkpointPerson } from '../src/sim/one-cast';

const events = vi.hoisted(() => {
  const target = new EventTarget();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: target });
  return target;
});
const fake = vi.hoisted(() => ({
  enabled: true,
  ready: Promise.resolve(true),
  request: vi.fn(),
  setEnabled: vi.fn(),
}));
const recording = vi.hoisted(() => ({
  setPersonaRecording: vi.fn(),
  allowPersonaRecording: vi.fn(),
  build: () => ({ c: 'test' }),
  milestone: vi.fn(),
  personaRecordingAllowed: false,
  playerId: 'epoch-a',
  telemetryOn: true,
}));
vi.mock('@adam0white/lab-client', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  personaChannel: () => fake,
  watchPersonaCheckpoint: () => () => {},
}));
vi.mock('../src/ui/store', () => ({ get: async () => undefined, put: vi.fn(async () => {}) }));
vi.mock('../src/ui/lab', () => ({ lab: recording }));

import {
  arrive,
  checkpointContinuity,
  chooseContinuityRecording,
  gateContinuity,
  installContinuity,
  invalidateContinuity,
  validateContinuity,
} from '../src/ui/continuity';

function reply(req: { envelope?: { branchId: string; revision: string } }, sameEpoch: boolean) {
  return {
    sameEpoch,
    branchId: req.envelope?.branchId,
    revision: req.envelope?.revision,
    recordingEpoch: 'opaque-epoch',
  };
}
async function source() {
  const person = createPerson({
    id: 'dilan',
    name: 'Dilan',
    seed: 1,
    now: 500,
    bornAt: -33 * 365 * 1440,
    sex: 'female',
  });
  const projection = projectPersona(person, {
    version: 'murmur-hearsay/1',
    skills: {},
  });
  return createPersona({
    format: 'hf-persona/1',
    castId: 'hf.cast.dilan.murmur',
    castRevision: '1',
    branchId: 'branch',
    parentRevision: null,
    source: {
      game: 'murmur',
      build: 'test',
      // Frozen wave1 host stamp. These historical contracts do not become the current live edition.
      engine: '2.14.1',
      rules: '1',
    },
    transfer: {
      person: projection,
      history: [],
      checkpoint: await checkpointPerson(person),
    },
    limitations: projection.limitations,
  });
}
it('claims before loading and records the real source checkpoint as admission parent', async () => {
  const envelope = await source();
  let claimed = false;
  fake.request.mockImplementation(async (req) => {
    if (req.action === 'get') return req.castId === envelope.castId ? envelope : null;
    if (req.action === 'put') {
      claimed = true;
      expect(req.envelope.parentRevision).toBe(envelope.revision);
      return req.envelope;
    }
    if (req.action === 'recording') return reply(req, true);
  });
  const game = await arrive(12);
  expect(claimed).toBe(true);
  expect(
    (
      game.continuity?.entries[0]?.head.transfer.admission as {
        claimId?: string;
      }
    )?.claimId,
  ).toMatch(/^[a-f0-9-]{36}$/);
  expect(game.continuity?.rows[0]?.parentRevision).toBe(envelope.revision);
  expect(game.initialPeople?.['dilan-delivery']).toEqual(game.continuity?.entries[0]?.admission.person);
  expect(game.initialContinuity?.entries[0]?.encounter).toBeUndefined();
  fake.request.mockClear();
  await gateContinuity(game);
  expect(fake.request).not.toHaveBeenCalled();
});

it('refuses persona snapshots with missing pinned continuity rather than opening recording', async () => {
  const game = newGame(2, 4, {
    'dilan-delivery': createPerson({
      id: 'dilan-delivery',
      name: 'Dilan',
      seed: 1,
      bornAt: 0,
      sex: 'female',
    }),
  });
  await expect(validateContinuity(game)).rejects.toThrow(/pinned|continuity/i);
});
it('refuses a competing old admission even when its earlier claim is retained', async () => {
  const { acceptPersona } = await import('@adam0white/lab-client');
  const envelope = await source();
  let state = acceptPersona({ revisions: [], heads: {} }, envelope);
  fake.request.mockImplementation(async (req) => {
    if (req.action === 'get') return req.castId === envelope.castId ? envelope : null;
    if (req.action === 'put') {
      state = acceptPersona(state, req.envelope);
      return req.envelope;
    }
    if (req.action === 'recording') return { sameEpoch: false };
  });
  const first = await arrive(12);
  const accepted = first.continuity?.entries[0]?.head.revision;
  expect(accepted).toBeDefined();
  const stale = await arrive(12);
  expect(stale.initialPeople).toBeUndefined();
  expect(state.heads[envelope.castId]).toBe(accepted);
});

async function admitted() {
  const envelope = await source();
  fake.request.mockImplementation(async (req) =>
    req.action === 'get'
      ? req.castId === envelope.castId
        ? envelope
        : null
      : req.action === 'recording'
        ? reply(req, false)
        : req.envelope,
  );
  return arrive(12);
}

it('publishes without a recording RPC and keeps a late receipt in its old prefix only', async () => {
  const sourceGame = newGame(42, 4);
  sourceGame.s.deryaAssignmentReleased = true; // Adapter fixture, not a played release receipt.
  let game = sourceGame;
  installContinuity(
    () => game,
    () => {},
  );
  await gateContinuity(game);
  recording.personaRecordingAllowed = true;
  let sent!: () => void;
  const written = new Promise<void>((resolve) => {
    sent = resolve;
  });
  let acknowledge!: () => void;
  fake.request.mockImplementation(async (req) => {
    if (req.action === 'recording' || req.action === 'recordingBatch')
      throw new Error('obsolete recording RPC');
    expect(req.authored).toBe(true);
    expect(req.recordingEpoch).toBeUndefined();
    sent();
    await new Promise<void>((resolve) => {
      acknowledge = resolve;
    });
    return req.envelope;
  });
  const departure = checkpointContinuity();
  await written;
  invalidateContinuity();
  game = newGame(43, 4);
  recording.allowPersonaRecording.mockClear();
  acknowledge();
  await departure;
  expect(sourceGame.continuity).toBeUndefined();
  expect(game.continuity).toBeUndefined();
  expect(recording.allowPersonaRecording).not.toHaveBeenCalledWith(true);
  const { put } = await import('../src/ui/store');
  expect(
    vi
      .mocked(put)
      .mock.calls.some(
        ([key, prefix]) =>
          key.startsWith('persona-departure:') && Boolean((prefix as typeof sourceGame).continuity?.source),
      ),
  ).toBe(true);
  recording.personaRecordingAllowed = false;
});

it('preserves ordinary played file provenance and never relabels it authored', async () => {
  const { advance, load, save } = await import('../src/sim/game');
  const { exportRun, verifyImport } = await import('../src/ui/export');
  const ordinary = newGame(7);
  advance(ordinary, 19110);
  let game = verifyImport(JSON.stringify(exportRun(ordinary)));
  expect(game.initialPeople).toBeUndefined();
  expect(game.continuity).toBeUndefined();
  installContinuity(
    () => game,
    () => {},
  );
  let associated = false;
  fake.request.mockImplementation(async (req) => {
    if (req.action !== 'recording') return req.envelope;
    if (req.allowRecording !== undefined) associated = req.allowRecording;
    return reply(req, associated);
  });
  recording.setPersonaRecording.mockClear();
  recording.allowPersonaRecording.mockClear();
  recording.personaRecordingAllowed = false;
  await gateContinuity(game, true);
  expect(game.fileHistory).toBeDefined();
  expect(recording.allowPersonaRecording).not.toHaveBeenCalledWith(true);
  const fileHistory = game.fileHistory;
  expect(recording.setPersonaRecording).toHaveBeenLastCalledWith(null);
  game = load(save(game));
  game = verifyImport(JSON.stringify(exportRun(game)));
  await gateContinuity(game);
  expect(game.fileHistory).toBe(fileHistory);
  expect(recording.setPersonaRecording).toHaveBeenLastCalledWith(null);
  await chooseContinuityRecording(true); // Explicit local file consent before a portable head exists.
  recording.personaRecordingAllowed = true;
  fake.request.mockClear();
  await checkpointContinuity();
  const put = fake.request.mock.calls.find(([req]) => req.action === 'put')?.[0];
  expect(put).toBeDefined();
  expect(put.authored).toBe(false);
  expect(game.continuity?.rows.at(-1)?.scope).toBe('file');
  expect(
    fake.request.mock.calls.every(([req]) => req.action !== 'recording' && req.action !== 'recordingBatch'),
  ).toBe(true);
  recording.personaRecordingAllowed = false;
});

it('run replacement still cancels a queued source publication', async () => {
  let game = newGame(42, 4);
  game.s.deryaAssignmentReleased = true;
  installContinuity(
    () => game,
    () => {},
  );
  await gateContinuity(game);
  fake.request.mockClear();
  const pending = checkpointContinuity();
  invalidateContinuity();
  game = newGame(43, 4);
  await pending;
  expect(fake.request).not.toHaveBeenCalled();
});

it('legacy multihead file metadata creates no obsolete SDK recording scope', async () => {
  const game = newGame(42, 4);
  game.fileHistory = crypto.randomUUID();
  const head = await source();
  // Synthetic metadata control, not an admitted or played history.
  game.continuity = {
    entries: [
      { head: { ...head, branchId: crypto.randomUUID() } },
      { head: { ...head, branchId: crypto.randomUUID() } },
    ],
    rows: [],
    source: { head: { ...head, branchId: crypto.randomUUID() } },
  } as never;
  fake.request.mockClear();
  recording.setPersonaRecording.mockClear();
  await recording.setPersonaRecording.withImplementation(
    (key: string | null) => {
      if (key !== null) throw new Error('Per-person recording scope is obsolete');
    },
    async () => {
      await gateContinuity(game, true);
    },
  );
  expect(recording.setPersonaRecording).toHaveBeenLastCalledWith(null);
  expect(fake.request).not.toHaveBeenCalled();
  expect(game.fileHistory).toBeDefined();
});
