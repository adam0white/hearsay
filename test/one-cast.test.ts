import { createPerson, projectPersona, snapshot } from '@adam0white/human-framework';
import { createPersona } from '@adam0white/lab-client';
import { describe, expect, it } from 'vitest';
import {
  checkpointPerson,
  createAuthoredDeryaCheckpoint,
  createOneCastOpening,
  createOneCastReturn,
  encounterOneCast,
  makeDilanOpening,
  prepareOneCastAdmission,
} from '../src/sim/one-cast.ts';

async function fixture(fitness = 0.5) {
  const source = createPerson({
    id: 'dilan',
    name: 'Dilan',
    seed: 31,
    now: 200,
    bornAt: -33 * 365 * 1440,
    sex: 'female',
    traits: { honesty: 0.68 },
  });
  source.body.fitness = fitness;
  source.memory.episodes.push({
    id: 'e1',
    at: 150,
    kind: 'outcome',
    action: 'deliver',
    valence: 0.4,
    salience: 0.8,
    summary: 'Finished an ordinary parcel delivery.',
    tags: [],
  });
  const projection = projectPersona(source, {
    version: 'murmur-hearsay/1',
    skills: {},
    episodes: { e1: { id: 'delivery-1', action: 'delivery-work', tags: [] } },
  });
  const envelope = await createPersona({
    format: 'hf-persona/1',
    castId: 'hf.cast.dilan.murmur',
    castRevision: '1',
    branchId: 'test-branch',
    parentRevision: null,
    source: { game: 'murmur', build: 'test', engine: '2.14.1', rules: '1' },
    transfer: {
      person: projection,
      history: [
        {
          id: 'work-1',
          kind: 'delivery-work',
          sourceGame: 'murmur',
          episodeId: 'delivery-1',
          disclosed: false,
        },
      ],
      checkpoint: await checkpointPerson(source),
    },
    limitations: projection.limitations,
  });
  return { source, projection, envelope, opening: makeDilanOpening(9, 420, projection) };
}

describe('one-cast Hearsay boundary', () => {
  it('pins exact detached state and complete checkpoint digest without sharing source worlds', async () => {
    const { source, envelope, opening } = await fixture();
    const before = snapshot(source);
    const admission = await prepareOneCastAdmission(envelope, opening, { targetBuild: 'test' });
    expect(admission.person.traits).toEqual(source.traits);
    expect(admission.person.rng).toEqual(source.rng);
    expect(admission.person.id).toBe('dilan-delivery');
    expect(admission.person.memory.episodes[0]?.at).toBe(370);
    expect(admission.checkpoint.checkpointDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(source).toEqual(before);
    source.body.sleepPressure = 0.01;
    expect((await checkpointPerson(source)).checkpointDigest).not.toBe(admission.checkpoint.checkpointDigest);
    envelope.transfer.history = [];
    expect(admission.history).toHaveLength(1);
    expect(JSON.stringify(admission.envelope)).not.toContain('sourceTrust');
  });
  it('admits ordinary carried fitness without changing clinical health or the authored source', async () => {
    const { source, projection, envelope, opening } = await fixture(0.4918778653212349);
    const before = snapshot(opening);
    const compatible = createOneCastOpening('hf.cast.dilan.murmur', opening, projection);
    const admission = await prepareOneCastAdmission(envelope, compatible, { targetBuild: 'test' });
    expect(admission.person.body.fitness).toBe(source.body.fitness);
    expect(opening).toEqual(before);
    const injured = snapshot(opening);
    injured.body.health = 0.5;
    expect(() => createOneCastOpening('hf.cast.dilan.murmur', injured, projection)).toThrow(/health/);
    const shifted = snapshot(opening);
    shifted.body.circadianPeak += 1;
    expect(() => createOneCastOpening('hf.cast.dilan.murmur', shifted, projection)).toThrow(/health/);
  });
  it('rejects altered envelope and unsupported source fields', async () => {
    const { envelope, opening } = await fixture();
    envelope.source.game = 'stairwell';
    await expect(prepareOneCastAdmission(envelope, opening, { targetBuild: 'test' })).rejects.toThrow();
    const other = await fixture();
    const { revision: _, ...body } = other.envelope;
    const extra = await createPersona({ ...body, transfer: { ...body.transfer, world: {} } });
    await expect(prepareOneCastAdmission(extra, other.opening, { targetBuild: 'test' })).rejects.toThrow(
      /unsupported source transfer/,
    );
  });
  it('refuses health conflicts and unsupported goals or obligations before projection', async () => {
    const { source, envelope, opening } = await fixture();
    opening.body.health = 0.5;
    await expect(prepareOneCastAdmission(envelope, opening, { targetBuild: 'test' })).rejects.toThrow(
      /health/,
    );
    source.agenda.goals.push({
      id: 'shelf',
      label: 'Finish shelf',
      serves: ['meaning'],
      advancedBy: [{ action: 'build', amount: 0.5 }],
      importance: 0.5,
      status: 'active',
      progress: 0,
      adoptedAt: 0,
    });
    expect(() => projectPersona(source, { version: 'murmur-hearsay/1', skills: {} })).toThrow(/goal/);
    source.agenda.goals = [];
    source.agenda.commitments.push({
      id: 'call',
      kind: 'promise',
      actions: ['call'],
      from: 300,
      until: 400,
      importance: 0.8,
      status: 'pending',
    });
    expect(() => projectPersona(source, { version: 'murmur-hearsay/1', skills: {} })).toThrow(/obligation/);
  });
  it('runs deterministic HF assent with a useful retained fact and preserves disclosure boundaries', async () => {
    const { envelope, opening } = await fixture();
    const admission = await prepareOneCastAdmission(envelope, opening, { targetBuild: 'test' });
    const a = encounterOneCast(admission.person, admission, 'support', 1500);
    const b = encounterOneCast(admission.person, admission, 'support', 1500);
    expect(a).toEqual(b);
    expect(a.encounter.usedFact).toBe('work-1');
    const biography = encounterOneCast(admission.person, { ...admission, history: [] }, 'support', 1500);
    const advertised = (p: typeof a.person) =>
      p.trace.at(-1)?.considered.find((c) => c.affordanceId === 'one-cast-talk')?.advertised?.meaning;
    expect(advertised(a.person)).toBe(0.12);
    expect(advertised(biography.person)).toBe(0.01);
    expect(a.encounter.disclosedFact).toBeNull();
    expect(a.person).not.toEqual(admission.person);
    expect(() => encounterOneCast(admission.person, admission, 'support', 420)).toThrow(/loop/);
    const returned = await createOneCastReturn(a.person, admission, {
      rules: 4,
      targetBuild: 'test',
      parentRevision: envelope.revision,
      encounter: a.encounter,
    });
    expect(returned.source).toMatchObject({ game: 'hearsay', rules: '4' });
    expect(returned.parentRevision).toBe(envelope.revision);
    expect(returned.transfer.admission).toMatchObject({
      sourceRevision: admission.envelope.revision,
      sourceCheckpointDigest: admission.checkpoint.checkpointDigest,
    });
    expect(returned.transfer.history).toEqual([
      expect.objectContaining({
        kind: 'hearsay-encounter',
        outcome: a.encounter.accepted ? 'accepted' : 'declined',
      }),
    ]);
    expect((returned.transfer.person as { episodes: unknown[] }).episodes).toHaveLength(1);
    a.person.memory.episodes = [];
    const forgotten = await createOneCastReturn(a.person, admission, {
      targetBuild: 'test',
      parentRevision: envelope.revision,
      encounter: a.encounter,
    });
    expect(forgotten.transfer.history).toEqual([
      expect.objectContaining({ outcome: a.encounter.accepted ? 'accepted' : 'declined' }),
    ]);
    expect(forgotten.limitations.join(' ')).toContain('host receipt only');
    expect(returned.transfer).not.toHaveProperty('world');
    expect(returned.limitations.join(' ')).toContain('locally saved source departure prefix');
  });
  it('exports a played chapter with many omitted episodes inside the envelope report bound', async () => {
    const { envelope, opening } = await fixture();
    const admission = await prepareOneCastAdmission(envelope, opening, { targetBuild: 'test' });
    const result = encounterOneCast(admission.person, admission, 'support', 1500);
    for (let i = 0; i < 100; i++)
      result.person.memory.episodes.push({
        id: 'old-' + i,
        at: i,
        kind: 'outcome',
        action: 'rest',
        valence: 0,
        salience: 0.1,
        summary: 'An ordinary source-side interval.',
        tags: [],
      });
    const checkpoint = await createOneCastReturn(result.person, admission, {
      targetBuild: 'test',
      parentRevision: envelope.revision,
      encounter: result.encounter,
    });
    expect(checkpoint.limitations.length).toBeLessThanOrEqual(64);
    expect(checkpoint.transfer.history).toHaveLength(1);
    expect(checkpoint.limitations.join(' ')).toContain('omission');
    expect(checkpoint.limitations.join(' ')).toContain('locally saved source departure prefix');
  });
  it('requires recorded assignment release for a fresh canonical Derya departure', async () => {
    const person = createPerson({
      id: 'derya',
      name: 'Derya',
      seed: 4,
      now: 20160,
      bornAt: -44 * 365 * 1440,
      sex: 'female',
      norms: [{ normId: 'backbiting', standing: 'forbidden', conviction: 0.5 }],
    });
    const options = { targetBuild: 'test', branchId: 'derya-branch', parentRevision: null };
    await expect(createAuthoredDeryaCheckpoint(person, options)).rejects.toThrow(/released/);
    const envelope = await createAuthoredDeryaCheckpoint(person, { ...options, assignmentEnded: true });
    expect(envelope.transfer.history).toEqual([]);
    expect(envelope.castId).toBe('hf.cast.derya.stairwell');
    person.life.sex = 'male';
    await expect(
      createAuthoredDeryaCheckpoint(person, { ...options, assignmentEnded: true }),
    ).rejects.toThrow(/legacy/);
  });
});
