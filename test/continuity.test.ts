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
      engine: person.engine,
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
  await gateContinuity(game);
  expect(recording.allowPersonaRecording).toHaveBeenLastCalledWith(true);
  fake.request.mockImplementation(async () => ({ sameEpoch: false }));
  await gateContinuity(game);
  expect(recording.allowPersonaRecording).toHaveBeenLastCalledWith(false);
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

it('does not authorize a new recording identity from an older in-flight sameEpoch reply', async () => {
  const envelope = await source();
  fake.request.mockImplementation(async (req) =>
    req.action === 'get'
      ? req.castId === envelope.castId
        ? envelope
        : null
      : req.action === 'recording'
        ? { sameEpoch: false }
        : req.envelope,
  );
  const game = await arrive(12);
  let answer: (value: { sameEpoch: boolean }) => void = () => {};
  let queried: () => void = () => {};
  const seen = new Promise<void>((resolve) => {
    queried = resolve;
  });
  fake.request.mockImplementation(
    () =>
      new Promise((resolve) => {
        answer = resolve;
        queried();
      }),
  );
  recording.allowPersonaRecording.mockClear();
  const old = gateContinuity(game);
  await seen;
  recording.playerId = 'epoch-b';
  fake.request.mockResolvedValue({ sameEpoch: false });
  await gateContinuity(game);
  answer({ sameEpoch: true });
  await old;
  expect(recording.allowPersonaRecording).not.toHaveBeenCalledWith(true);
});

it('accepts sameEpoch when closing the gate hides the public recording identity', async () => {
  const envelope = await source();
  fake.request.mockImplementation(async (req) =>
    req.action === 'get'
      ? req.castId === envelope.castId
        ? envelope
        : null
      : req.action === 'recording'
        ? reply(req, true)
        : req.envelope,
  );
  const game = await arrive(12);
  let allowed = true;
  const descriptor = Object.getOwnPropertyDescriptor(recording, 'playerId')!;
  Object.defineProperty(recording, 'playerId', {
    configurable: true,
    get: () => (allowed ? 'epoch-a' : null),
  });
  recording.allowPersonaRecording.mockImplementation((value: boolean) => {
    allowed = value;
  });
  try {
    await gateContinuity(game);
    expect(allowed).toBe(true);
  } finally {
    Object.defineProperty(recording, 'playerId', descriptor);
    recording.allowPersonaRecording.mockReset();
  }
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
it('requires the exact pinned branch and revision echoes, never another active head', async () => {
  const game = await admitted();
  const head = game.continuity!.entries[0]!.head;
  fake.request.mockImplementation(async (req) => {
    expect(req.envelope).toEqual(head);
    return { ...reply(req, true), branchId: 'different-active-branch' };
  });
  recording.allowPersonaRecording.mockClear();
  await gateContinuity(game);
  expect(recording.allowPersonaRecording).not.toHaveBeenCalledWith(true);
});
it('immediately blocks denial and persists it only for the selected pinned envelope with a fresh epoch', async () => {
  const game = await admitted();
  installContinuity(
    () => game,
    () => {},
  );
  fake.request.mockImplementation(async (req) => {
    expect(req.envelope).toEqual(game.continuity!.entries[0]!.head);
    if (req.allowRecording !== undefined) {
      expect(req.recordingEpoch).toBe('opaque-epoch');
      expect(req.allowRecording).toBe(false);
    }
    return reply(req, req.allowRecording !== false);
  });
  recording.allowPersonaRecording.mockClear();
  const denying = chooseContinuityRecording(false);
  expect(recording.allowPersonaRecording).toHaveBeenLastCalledWith(false);
  await denying;
  expect(fake.request.mock.calls.some(([req]) => req.allowRecording === false)).toBe(true);
  await gateContinuity(game);
  expect(recording.allowPersonaRecording).not.toHaveBeenCalledWith(true);
});
it('a pending grant cannot authorize a replacement run or send after a storage identity change', async () => {
  for (const replace of [true, false]) {
    let game = await admitted();
    installContinuity(
      () => game,
      () => {},
    );
    let answer!: (v: ReturnType<typeof reply>) => void;
    let seen!: () => void;
    const queried = new Promise<void>((r) => {
      seen = r;
    });
    let held: Parameters<typeof reply>[0];
    fake.request.mockImplementation((req) => {
      held = req;
      seen();
      return new Promise((r) => {
        answer = r;
      });
    });
    recording.allowPersonaRecording.mockClear();
    const choosing = chooseContinuityRecording(true);
    await queried;
    if (replace) {
      invalidateContinuity();
      game = newGame(13);
    } else {
      fake.request.mockImplementation(async (req) => reply(req, false));
      const event = new Event('storage');
      Object.defineProperty(event, 'key', { value: 'hf-lab-player' });
      events.dispatchEvent(event);
    }
    answer(reply(held!, true));
    await choosing;
    expect(recording.allowPersonaRecording).not.toHaveBeenCalledWith(true);
    expect(fake.request.mock.calls.some(([req]) => req.allowRecording === true)).toBe(false);
  }
});
it('serializes central choices so a late sent grant is followed by the latest denial and never reopens locally', async () => {
  const game = await admitted();
  installContinuity(
    () => game,
    () => {},
  );
  let answer!: (v: ReturnType<typeof reply>) => void;
  let sent!: () => void;
  const granted = new Promise<void>((r) => {
    sent = r;
  });
  const writes: boolean[] = [];
  fake.request.mockImplementation(async (req) => {
    if (req.allowRecording === true) {
      writes.push(true);
      sent();
      return new Promise((r) => {
        answer = r;
      });
    }
    if (req.allowRecording === false) writes.push(false);
    return reply(req, req.allowRecording !== false);
  });
  recording.allowPersonaRecording.mockClear();
  const older = chooseContinuityRecording(true);
  await granted;
  const latest = chooseContinuityRecording(false);
  answer(reply({ envelope: game.continuity!.entries[0]!.head }, true));
  await Promise.all([older, latest]);
  expect(writes).toEqual([true, false]);
  expect(recording.allowPersonaRecording).not.toHaveBeenCalledWith(true);
});
it('a source departure captures epoch before projection and cannot link or touch a replacement gate', async () => {
  let game = newGame(42, 4);
  game.s.deryaAssignmentReleased = true;
  installContinuity(
    () => game,
    () => {},
  );
  await gateContinuity(game);
  recording.personaRecordingAllowed = true;
  let answer!: (value: { recordingEpoch: string }) => void;
  let queried!: () => void;
  const seen = new Promise<void>((r) => {
    queried = r;
  });
  fake.request.mockImplementation((req) =>
    req.action === 'recording'
      ? new Promise((r) => {
          answer = r;
          queried();
        })
      : Promise.resolve(req.envelope),
  );
  const checkpoint = checkpointContinuity();
  await seen;
  invalidateContinuity();
  game = newGame(43, 4);
  recording.allowPersonaRecording.mockClear();
  answer({ recordingEpoch: 'old-opaque-epoch' });
  await checkpoint;
  const put = fake.request.mock.calls.find(([req]) => req.action === 'put')?.[0];
  expect(put).toBeUndefined();
  expect(recording.allowPersonaRecording).not.toHaveBeenCalledWith(true);
  recording.personaRecordingAllowed = false;
});

it('supplies the captured epoch on authored put and keeps a late receipt in its old prefix only', async () => {
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
    if (req.action === 'recording') return { recordingEpoch: 'source-opaque-epoch' };
    expect(req.authored).toBe(true);
    expect(req.recordingEpoch).toBe('source-opaque-epoch');
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

it('cannot restore file permission from an existing central association after local denial and reload', async () => {
  let game = await admitted();
  game.continuity!.entries[0]!.scope = 'file';
  installContinuity(
    () => game,
    () => {},
  );
  fake.request.mockImplementation(async (req) => reply(req, true));
  recording.personaRecordingAllowed = false;
  await chooseContinuityRecording(false);
  game = structuredClone(game); // Reload loses the in-memory denial latch.
  fake.request.mockClear();
  recording.allowPersonaRecording.mockClear();
  await gateContinuity(game);
  expect(fake.request).not.toHaveBeenCalled();
  expect(recording.allowPersonaRecording).not.toHaveBeenCalledWith(true);
});
