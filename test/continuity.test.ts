import { createPerson, projectPersona } from '@adam0white/human-framework';
import { createPersona } from '@adam0white/lab-client';
import { expect, it, vi } from 'vitest';
import { newGame } from '../src/sim/game';
import { checkpointPerson } from '../src/sim/one-cast';

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
}));
vi.mock('@adam0white/lab-client', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  personaChannel: () => fake,
}));
vi.mock('../src/ui/lab', () => ({ lab: recording }));

import { arrive, gateContinuity, validateContinuity } from '../src/ui/continuity';

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
    if (req.action === 'recording') return { sameEpoch: true };
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
        ? { sameEpoch: true }
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
