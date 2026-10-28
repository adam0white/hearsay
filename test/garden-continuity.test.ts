import type { Person } from '@adam0white/hf-legacy';
import {
  canonicalPersona,
  claimCastChapterBatch,
  createPersona,
  initialPersonaLife,
  type PersonaRequest,
  preparePersonaLife,
} from '@adam0white/lab-client';
import { expect, it } from 'vitest';
import { advanceGarden, freshGarden } from '../src/sim/garden.ts';
import { GARDEN_CAST, type GardenPerson, gardenOpening } from '../src/sim/garden-cast.ts';
import { admitGardenPerson, projectGardenPerson } from '../src/sim/garden-continuity.ts';
import { exportGarden, importGarden } from '../src/sim/garden-export.ts';

const stamps = { game: 'hearsay', build: 'test', engine: '2.23.0', rules: 'hearsay-cast-6' };
async function voice(id: GardenPerson) {
  // Synthetic adapter control, never a browser/source journey receipt.
  const person = gardenOpening(id, 17, 707);
  person.body.fitness = 0.63;
  person.traits.honesty = 0.91;
  person.agenda.commitments.push({
    id: 'source-prayer',
    kind: 'worship',
    label: 'Quiet prayer',
    from: 720,
    until: 780,
    actions: ['pray-home'],
    importance: 0.8,
    status: 'pending',
    recurEvery: 1440,
  });
  person.agenda.commitments.push({
    id: 'source-fast',
    kind: 'abstain',
    label: 'fast',
    from: 600,
    until: 1080,
    actions: [],
    violatedBy: ['eat', 'drink', 'tea'],
    toId: 'self',
    importance: 0.9,
    status: 'pending',
  });
  if (id === 'osman') {
    person.skills.trade = { level: 0.7, practice: 180, lastPracticed: 707 };
    person.agenda.commitments.push({
      id: 'market',
      kind: 'job',
      from: 540,
      until: 1020,
      actions: ['work-market'],
      importance: 0.8,
      status: 'pending',
      recurEvery: 1440,
    });
  }
  const portable = projectGardenPerson(person);
  portable.person.mappingVersion = 'site-cast-calendar/1';
  const digest = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalPersona(person)))),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
  const c = GARDEN_CAST[id];
  return createPersona({
    format: 'hf-persona/1',
    castId: c.castId,
    castRevision: c.revision,
    branchId: `test-${id}`,
    parentRevision: null,
    source: { ...stamps, game: 'voice', rules: 'cast-1' },
    transfer: {
      castPassport: 'site-cast/1',
      sourceRole: id,
      person: portable,
      checkpoint: { schema: person.schema, sourceMinute: person.now, rng: person.rng, sha256: digest },
      life: initialPersonaLife(c.castId, `test-${id}`, 0),
    },
    limitations: portable.person.limitations,
  });
}
it('admits two Voice actors together with real calendar/RNG/fitness, pins life and replays independently', async () => {
  const parents = await Promise.all([voice('riza'), voice('osman')]);
  const inputs = parents.map((p) => preparePersonaLife(p, 48 * 3600000));
  const people: Record<string, Person> = Object.fromEntries(
    inputs.map((p) => [p.parent.transfer.sourceRole, admitGardenPerson(p, 17)]),
  );
  expect(people.riza!.body.fitness).toBe(0.63);
  expect(people.osman!.skills.trade!.practice).toBe(180);
  expect(
    people.osman!.agenda.commitments.some((c) => c.kind === 'job' && c.actions.includes('work-market')),
  ).toBe(true);
  expect(people.riza!.traits.honesty).toBe(0.91);
  expect(people.riza!.rng).toEqual(
    (parents[0]!.transfer.person as ReturnType<typeof projectGardenPerson>).person.rng,
  );
  expect(people.riza!.agenda.commitments[0]!.from).toBe(373);
  expect(people.riza!.agenda.commitments[0]!.actions).toEqual(['pray-home']);
  expect(people.riza!.memory.episodes.some((e) => e.kind === 'cast-notice')).toBe(
    inputs[0]!.life.events.some((e) => e.kind === 'contact'),
  );
  const claims = await Promise.all(
    parents.map((p, i) => {
      const { revision, ...body } = p;
      return createPersona({
        ...body,
        parentRevision: revision,
        source: stamps,
        transfer: { ...body.transfer, life: inputs[i]!.life },
      });
    }),
  );
  const run = freshGarden(17, people, {
    version: 'hearsay-batch/1',
    mapping: 'hearsay-calendar/1',
    inputs,
    claims,
  });
  advanceGarden(run, 420);
  expect(run.lunch.visits.riza).toBeUndefined();
  expect(importGarden(JSON.stringify(exportGarden(run)))).toEqual(run);
});
it('refuses the entire startup before CAS if one allocated source has an unsupported dialect', async () => {
  const parents = await Promise.all([voice('riza'), voice('derya')]);
  let writes = 0;
  const shelf = {
    async request<T>(r: PersonaRequest): Promise<T> {
      if (r.action === 'prepareBatch')
        return {
          expectedHeads: Object.fromEntries(parents.map((p) => [p.castId, p.revision])),
          inputs: parents.map((p) => preparePersonaLife(p, 0)),
          blocked: [],
        } as T;
      ++writes;
      return undefined as T;
    },
  };
  await expect(
    claimCastChapterBatch(
      shelf,
      parents.map((p) => p.castId),
      stamps,
      async (inputs) => inputs.map((p) => admitGardenPerson(p, 17)),
    ),
  ).rejects.toThrow('semantic adapter');
  expect(writes).toBe(0);
});
it('publishes a full ordinary closing checkpoint and retains source-bound trust and episodes on return', async () => {
  const { captureGardenSource } = await import('../src/sim/garden-continuity.ts');
  const { seedSourceTrust, trustOf } = await import('@adam0white/hf-legacy');
  const pinned = gardenOpening('riza', 17);
  pinned.lexicon = { plainEnglish: false };
  const run = freshGarden(17, { riza: pinned });
  advanceGarden(run, 20160);
  seedSourceTrust(run.people.riza, 'hatice', 0.91);
  const captured = await captureGardenSource(run, 'riza');
  expect(captured.limitations.length).toBeLessThanOrEqual(64);
  const c = GARDEN_CAST.riza;
  const parent = await createPersona({
    format: 'hf-persona/1',
    castId: c.castId,
    castRevision: c.revision,
    branchId: 'return-control',
    parentRevision: null,
    source: stamps,
    transfer: { ...captured.transfer, life: initialPersonaLife(c.castId, 'return-control', 0) },
    limitations: captured.limitations,
  });
  const back = admitGardenPerson(preparePersonaLife(parent, 0), 17, [captured.archive]);
  expect(back.lexicon).toEqual({ plainEnglish: false });
  expect(trustOf(back, 'hatice')).toBe(0.91);
  expect(back.memory.episodes.length).toBe(run.people.riza.memory.episodes.length);
  expect(back.body.sleepDebt).toBe(run.people.riza.body.sleepDebt);
  expect(back.body.since).toBe(360);
  expect(back.body.lastSleep!.to - back.body.lastSleep!.from).toBe(
    run.people.riza.body.lastSleep!.to - run.people.riza.body.lastSleep!.from,
  );
});

it('refuses an unknown Voice exporter instead of treating a matching actor as a complete tuple', async () => {
  const parent = await voice('riza');
  const { revision: _revision, ...body } = parent;
  const unknown = await createPersona({ ...body, source: { ...parent.source, rules: 'unknown-exporter' } });
  expect(() => admitGardenPerson(preparePersonaLife(unknown, 0), 17)).toThrow(/semantic adapter/);
});
