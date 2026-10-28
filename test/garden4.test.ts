import { inspect, validatePortablePerson } from '@adam0white/human-framework';
import { canonicalCast } from '@adam0white/lab-client';
import { expect, it } from 'vitest';
import { gardenOpening } from '../src/sim/garden-cast.ts';
import {
  advanceGarden,
  chooseGarden,
  freshGarden,
  type GardenRun,
  refreshGarden,
  sessionOf,
} from '../src/sim/garden4.ts';
import { exportGarden, importGarden } from '../src/sim/garden4-export.ts';

it('preserves the authored reciprocal sibling ties in public state and replay', () => {
  const garden = freshGarden(17);
  for (const id of ['aylin', 'dilan'] as const) {
    const expected = gardenOpening(id, 17).social.relationships.map((tie) => ({
      ...tie,
      lastInteraction: tie.lastInteraction * 60000,
    }));
    expect(garden.people[id].relationships).toEqual(expected);
  }
  expect(importGarden(JSON.stringify(exportGarden(garden)))).toEqual(garden);
});

/** Public projection control only. It does not publish or establish departure eligibility. */
function engineeringPassport(garden: GardenRun) {
  const cast = canonicalCast('hf.cast.riza.voice');
  const result = inspect(sessionOf(garden).run, {
    perspective: { kind: 'host' },
    people: ['riza'],
    select: ['persona'],
    portable: { person: 'riza', castId: cast.castId, castRevision: cast.revision },
  });
  if (!result.ok) throw new Error(result.error.message);
  const person = result.value.people[0];
  if (person?.kind !== 'host') throw new Error('Missing host projection');
  const part = person.parts.find((part) => part.select === 'persona');
  if (part?.select !== 'persona') throw new Error('Missing portable projection');
  const portable = validatePortablePerson(part.value);
  return {
    transfer: { castPassport: `hf-portable-person/${portable.version}`, portable },
    limitations: ['Engineering projection; no departure or ownership claim.'],
  };
}

it('records a completed invited conversation and replays the current export', () => {
  const garden = freshGarden(17);
  expect(chooseGarden(garden, { type: 'listen', person: 'riza', approach: 'invite' })).toBe(true);
  expect(garden.discoveries.riza).toBeUndefined();
  advanceGarden(garden, 376);
  expect(garden.discoveries.riza?.fact).toContain('doorway');
  expect(garden.people.riza.activity).toBeUndefined();
  expect(garden.people.hatice.activity?.start).toBeGreaterThanOrEqual(376);
  const exported = exportGarden(garden);
  if (!exported.state.engine) throw new Error('Missing engine checkpoint');
  const chatOutcomes = exported.state.engine.host.outcomes.filter((outcome) => outcome.action === 'chat');
  expect(chatOutcomes.map((outcome) => outcome.person).sort()).toEqual(['hatice', 'riza']);
  expect(chatOutcomes[0]?.end).not.toBe(chatOutcomes[1]?.end);
  expect(importGarden(JSON.stringify(exported))).toEqual(garden);
  advanceGarden(garden, 420);
  const later = exportGarden(garden);
  const laterCheckpoint = later.state.engine;
  if (!laterCheckpoint) throw new Error('Missing engine checkpoint');
  const originalIds = new Set(chatOutcomes.map((outcome) => outcome.id));
  expect(laterCheckpoint.host.outcomes.some((outcome) => originalIds.has(outcome.id))).toBe(false);
  const retained = laterCheckpoint.archive.history
    .flatMap((transaction) => transaction.inputs)
    .flatMap((input) =>
      input.kind === 'action.resolved' && originalIds.has(input.payload.activityId)
        ? [input.payload.outcome]
        : [],
    );
  expect(retained.filter((outcome) => outcome?.status === 'completed')).toHaveLength(2);
  expect(importGarden(JSON.stringify(later))).toEqual(garden);
});

it('keeps a completed invitation private without fabricating testimony or refusal', () => {
  const garden = freshGarden(17);
  advanceGarden(garden, 400);
  expect(chooseGarden(garden, { type: 'listen', person: 'riza', approach: 'invite' })).toBe(true);
  advanceGarden(garden, 416);
  expect(garden.discoveries.riza).toBeDefined();
  expect(garden.routes.filter((route) => route.from === 'hatice' && route.to === 'riza')).toEqual([]);
  expect(garden.log.filter((entry) => entry.kind === 'refusal' && entry.person === 'hatice')).toEqual([]);
});

it('still delivers testimony after a completed ordinary chat', async () => {
  const { decideGardenAction } = await import('../src/sim/garden-hf4.ts');
  const garden = freshGarden(17);
  const decision = decideGardenAction(sessionOf(garden), 'hatice', [
    {
      id: 'ordinary-chat',
      action: 'chat',
      label: 'Talk',
      duration: 15,
      targetId: 'riza',
      with: ['riza'],
      placeId: 'garden',
    },
  ]);
  expect(decision.chosen).toBe('ordinary-chat');
  refreshGarden(garden);
  advanceGarden(garden, 376);
  expect(garden.routes).toContainEqual(
    expect.objectContaining({ from: 'hatice', to: 'riza', prop: 'hatice:reliable', value: true }),
  );
});

it('keeps a released conversation private', () => {
  const garden = freshGarden(17);
  chooseGarden(garden, { type: 'listen', person: 'riza', approach: 'invite' });
  advanceGarden(garden, 365);
  expect(chooseGarden(garden, { type: 'release', person: 'riza' })).toBe(true);
  advanceGarden(garden, 380);
  expect(garden.discoveries.riza).toBeUndefined();
  expect(garden.log.some((entry) => entry.kind === 'interrupted')).toBe(true);
});

it('restores an active invitation and completes it after export', () => {
  const garden = freshGarden(17);
  expect(chooseGarden(garden, { type: 'listen', person: 'riza', approach: 'invite' })).toBe(true);
  advanceGarden(garden, 365);
  expect(garden.chat).toBeTruthy();
  const restored = importGarden(JSON.stringify(exportGarden(garden)));
  advanceGarden(garden, 376);
  advanceGarden(restored, 376);
  expect(restored).toEqual(garden);
  expect(restored.discoveries.riza?.fact).toContain('doorway');
});

it('projects a native portable person and refuses a blocked batch', async () => {
  const { admitGardenBatch } = await import('../src/sim/garden4-continuity.ts');
  const garden = freshGarden(17);
  const captured = engineeringPassport(garden);
  expect(captured.transfer.castPassport).toMatch(/^hf-portable-person\//);
  expect(captured.transfer.portable.castId).toBe('hf.cast.riza.voice');
  expect(() =>
    admitGardenBatch({ expectedHeads: {}, inputs: [], blocked: [{ castId: 'riza', reason: 'unavailable' }] }),
  ).toThrow('saved person is unavailable');
});

it('readmits a native passport only for the installed engine and matching source', async () => {
  const { admitGardenBatch } = await import('../src/sim/garden4-continuity.ts');
  const { GARDEN_ENGINE } = await import('../src/sim/garden-engine.ts');
  const source = freshGarden(17);
  expect(chooseGarden(source, { type: 'listen', person: 'riza', approach: 'invite' })).toBe(true);
  advanceGarden(source, 376);
  const captured = engineeringPassport(source);
  const portable = captured.transfer.portable;
  expect(portable.version).toBe(2);
  if (portable.version === 2)
    expect(portable.retained.memory.episodes).toContainEqual(
      expect.objectContaining({ action: 'chat', placeId: 'garden', targetId: 'hatice' }),
    );
  const parent = {
    castId: portable.castId,
    castRevision: portable.castRevision,
    terminal: false,
    source: { game: 'hearsay', engine: GARDEN_ENGINE, rules: 'hearsay-hf4-1' },
    transfer: captured.transfer,
  };
  const batch = {
    expectedHeads: {},
    blocked: [],
    inputs: [{ parent, life: {}, clockMs: 0 }],
  } as unknown as import('@adam0white/lab-client').LifeBatchPreparation;
  const authors = admitGardenBatch(batch);
  expect(authors.find((person) => person.id === 'riza')?.portable?.person).toEqual(portable);
  expect(freshGarden(18, authors).people.riza).toBeDefined();
  parent.source.engine = '4.5.1';
  expect(() => admitGardenBatch(batch)).toThrow('unsupported chapter');
});

it('retains the latest actual outcome per person in the host checkpoint', () => {
  const garden = freshGarden(17);
  advanceGarden(garden, 450);
  const checkpoint = exportGarden(garden).state.engine;
  if (!checkpoint) throw new Error('Missing engine checkpoint');
  const outcomes = checkpoint.host.outcomes;
  expect(outcomes.length).toBeGreaterThan(0);
  expect(new Set(outcomes.map((outcome) => outcome.person)).size).toBe(outcomes.length);
  const resolutions = checkpoint.archive.history
    .flatMap((transaction) => transaction.inputs)
    .filter((input) => input.kind === 'action.resolved' && input.payload.outcome);
  expect(resolutions.length).toBeGreaterThan(outcomes.length);
});

it('records active action references in the world without repeating complete offers', () => {
  const garden = freshGarden(17);
  chooseGarden(garden, { type: 'listen', person: 'riza', approach: 'invite' });
  const checkpoint = exportGarden(garden).state.engine;
  if (!checkpoint) throw new Error('Missing engine checkpoint');
  const world = checkpoint.archive.current.world.hostState as {
    active: string[];
    outcomes: string[];
  };
  expect(world.active).toEqual(checkpoint.host.active.map(({ id }) => id));
  expect(world.outcomes).toEqual(checkpoint.host.outcomes.map(({ id }) => id));
  expect(importGarden(JSON.stringify(exportGarden(garden)))).toEqual(garden);
  const changed = exportGarden(garden);
  const changedActivity = changed.state.engine?.host.active[0];
  if (!changedActivity) throw new Error('Missing active action');
  changedActivity.offer.durationMs++;
  expect(() => importGarden(JSON.stringify(changed))).toThrow('does not replay exactly');
});

it('retains a native chapter envelope through a complete export and replay', async () => {
  const { canonicalCast, createPersona } = await import('@adam0white/lab-client');
  const { GARDEN_ENGINE } = await import('../src/sim/garden-engine.ts');
  const garden = freshGarden(17);
  const captured = engineeringPassport(garden);
  const cast = canonicalCast(captured.transfer.portable.castId);
  const claim = await createPersona({
    format: 'hf-persona/1',
    castId: cast.castId,
    castRevision: cast.revision,
    branchId: 'native-chapter-control',
    parentRevision: null,
    source: { game: 'hearsay', build: 'control', engine: GARDEN_ENGINE, rules: 'hearsay-hf4-1' },
    transfer: captured.transfer,
    limitations: captured.limitations,
  });
  // The live shared-start path assigns the accepted batch after its CAS completes.
  garden.chapter = { version: 'hearsay-hf4-batch/1', claims: [claim] };
  const saved = exportGarden(garden);
  const restored = importGarden(JSON.stringify(saved));
  expect(restored.chapter).toEqual(garden.chapter);
  expect(exportGarden(restored)).toEqual(saved);
});

it('finishes one ordinary host opportunity without restarting a stale offer', async () => {
  const { advanceGardenSession, decideGardenAction } = await import('../src/sim/garden-hf4.ts');
  const garden = freshGarden(17);
  const session = sessionOf(garden);
  const decision = decideGardenAction(session, 'riza', [
    { id: 'ordinary-rest', action: 'rest', label: 'Rest once', duration: 15 },
  ]);
  expect(decision.chosen).toBe('ordinary-rest');
  advanceGardenSession(session, 376);
  expect(session.host.active.filter((action) => action.person === 'riza')).toEqual([]);
  expect(session.host.outcomes.find((outcome) => outcome.person === 'riza')).toMatchObject({
    id: decision.activity?.id,
    status: 'completed',
    start: 21600000,
    end: 22500000,
  });
  expect(session.offers.riza).toEqual([]);
});
