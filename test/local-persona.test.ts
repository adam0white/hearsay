import { createPersona, type PersonaEnvelope, type PersonaShelfState } from '@adam0white/lab-client';
import { describe, expect, it } from 'vitest';
import { reduceLocalPersona } from '../src/ui/local-persona.ts';

async function envelope(
  parent: string | null,
  branchId = 'branch-1',
  build = 'source',
): Promise<PersonaEnvelope> {
  return createPersona({
    format: 'hf-persona/1',
    castId: 'hf.cast.dilan.murmur',
    castRevision: '1',
    branchId,
    parentRevision: parent,
    source: { game: 'murmur', build, engine: '2.14.1', rules: '1' },
    transfer: {},
    limitations: [],
  });
}
describe('local file parent checks', () => {
  it('atomically starts at an imported checkpoint and claims its exact revision', async () => {
    const arrival = await envelope('a'.repeat(64));
    const claim = await envelope(arrival.revision, 'branch-1', 'claim');
    const next = reduceLocalPersona(undefined, claim, { arrival });
    expect(next.revisions.map((p) => p.revision)).toEqual([arrival.revision, claim.revision]);
    expect(next.heads[arrival.castId]).toBe(claim.revision);
    expect(reduceLocalPersona(next, claim, { arrival })).toEqual(next);
  });
  it('refuses stale competing continuation without changing previous state', async () => {
    const arrival = await envelope(null);
    const claim = await envelope(arrival.revision, 'branch-1', 'claim');
    const initial = reduceLocalPersona(undefined, claim, { arrival });
    const before = structuredClone(initial);
    const competitor = await envelope(arrival.revision, 'branch-1', 'competitor');
    expect(() => reduceLocalPersona(initial, competitor, { arrival })).toThrow(/conflict/);
    expect(initial).toEqual(before);
    const unrelated = await envelope(null, 'other-branch');
    expect(() => reduceLocalPersona(initial, unrelated)).toThrow(/conflict/);
  });
  it('accepts only an explicit new branch fork and preserves other people', async () => {
    const original = await envelope(null);
    const state = reduceLocalPersona(undefined, original);
    const second = {
      ...original,
      castId: 'hf.cast.derya.stairwell',
      revision: 'b'.repeat(64),
      branchId: 'derya',
    };
    const previous: PersonaShelfState = {
      revisions: [...state.revisions, second],
      heads: { ...state.heads, [second.castId]: second.revision },
    };
    const fork = await envelope(null, 'fork-1');
    const next = reduceLocalPersona(previous, fork, { fork: true });
    expect(next.heads[original.castId]).toBe(fork.revision);
    expect(next.heads[second.castId]).toBe(second.revision);
    expect(() => reduceLocalPersona(previous, original, { fork: true, arrival: original })).toThrow(
      /file claim/,
    );
  });
});
