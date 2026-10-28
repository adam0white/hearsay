import {
  createPerson,
  createRun,
  exportRun,
  type Result,
  type RunArchive,
  type RunSpec,
  replay,
} from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import { GARDEN_IDS } from '../src/sim/garden-cast.ts';
import { beliefEvidence, converseGarden } from '../src/sim/garden-hf4.ts';
import {
  advanceGarden,
  chooseGarden,
  freshGarden,
  gardenAuthors,
  refreshGarden,
  sessionOf,
} from '../src/sim/garden4.ts';
import { captureGardenSource } from '../src/sim/garden4-continuity.ts';
import { exportGarden, importGarden } from '../src/sim/garden4-export.ts';
import { wantsLunch } from '../src/sim/garden4-stakes.ts';

const need = <T>(result: Result<T>): T => {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};
const present = <T>(value: T | undefined): T => {
  if (value === undefined) throw new Error('Missing fixture evidence');
  return value;
};

// Public Run fixture at the ending, not a claim that the preceding fortnight was played.
function endingFixture() {
  const g = structuredClone(freshGarden(17));
  const original = sessionOf(freshGarden(17));
  const spec = structuredClone(exportRun(original.run).initial.spec) as RunSpec;
  const start = 20129 * 60000;
  spec.start = start;
  const run = need(createRun(spec));
  for (const author of gardenAuthors()) {
    author.state.body.since = start;
    need(createPerson(run, author));
  }
  g.minute = 20129;
  g.engine = {
    archive: structuredClone(exportRun(run)) as RunArchive,
    clock: start,
    serial: 0,
    offerRevision: {},
    offers: {},
    host: { revision: 0, active: [], completed: 0, outcomes: [] },
  };
  refreshGarden(g);
  return g;
}

it('settles the actual final ordinary activities before freezing the fortnight', () => {
  const g = endingFixture();
  advanceGarden(g, 14 * 1440);
  expect(g.ended).toBe(true);
  expect(GARDEN_IDS.filter((id) => g.people[id].activity)).toEqual([]);
  const session = sessionOf(g);
  expect(session.host.active).toEqual([]);
  expect(session.host.outcomes).toHaveLength(8);
  for (const outcome of session.host.outcomes) {
    expect(outcome.status).toBe('completed');
    expect(outcome.end).toBeLessThanOrEqual(14 * 1440 * 60000);
    expect(outcome.end - outcome.start).toBe(15 * 60000);
  }
  // The real source capture may now evaluate body and duties; no activity is erased for it.
  expect(() => captureGardenSource(g, 'riza')).not.toThrow();
  g.lunch.debt = 1; // Explicit fixture obligation; the ending does not settle an invoice.
  expect(() => captureGardenSource(g, 'hatice')).toThrow('unpaid');
  expect(g.lunch.debt).toBe(1);
  expect(chooseGarden(g, { type: 'silence' })).toBe(false);
});

it('withdraws Hatice’s accepted negative account without proving the opposite or removing other evidence', () => {
  const authors = gardenAuthors();
  const hatice = present(authors.find((p) => p.id === 'hatice'));
  // Engineering fixture only; keep the actual sourced prohibition and weaken its conviction.
  for (const norm of hatice.state.heldNorms) norm.conviction = 0.2;
  const riza = present(authors.find((p) => p.id === 'riza'));
  riza.state.sourceTrust = [{ sourceId: 'hatice', trust: 0.95 }];
  riza.state.beliefs = [
    ...riza.state.beliefs,
    {
      prop: 'aylin:reliable',
      logOdds: -0.1,
      updatedAt: 360 * 60000,
      sources: [{ id: 'ece', value: false, contribution: -0.1 }],
      withdrawalBase: 0,
    },
  ];
  const g = freshGarden(17, authors);
  advanceGarden(g, 400);
  expect(chooseGarden(g, { type: 'tell', person: 'riza', about: 'aylin' })).toBe(true);
  expect(g.routes.some((r) => r.from === 'hatice' && r.to === 'riza' && r.prop === 'aylin:reliable')).toBe(
    true,
  );
  expect(wantsLunch(g, 'riza')).toBe(false);
  const before = present(g.people.riza.memory.beliefs.find((b) => b.prop === 'aylin:reliable'));
  expect(before.sources.find((s) => s.id === 'hatice')?.contribution).toBeLessThan(0);
  const other = before.sources.find((s) => s.id === 'ece');
  // A real separate HF conversation branch repeats the claim to another listener.
  // The game replay below retains its ordinary input stream; this branch uses HF archive replay.
  const repeated = importGarden(JSON.stringify(exportGarden(g)));
  converseGarden(sessionOf(repeated), 'riza', 'ece', ['aylin']);
  refreshGarden(repeated);
  const copy = present(repeated.people.ece.memory.beliefs.find((b) => b.prop === 'aylin:reliable'));
  expect(copy.sources.find((s) => s.id === 'riza')?.contribution).toBeLessThan(0);
  expect(chooseGarden(repeated, { type: 'amends', person: 'riza', about: 'aylin' })).toBe(true);
  const retained = present(repeated.people.ece.memory.beliefs.find((b) => b.prop === 'aylin:reliable'));
  expect(retained.sources.find((s) => s.id === 'riza')?.contribution).toBeCloseTo(
    present(copy.sources.find((s) => s.id === 'riza')?.contribution),
    7,
  );
  expect(need(replay(exportRun(sessionOf(repeated).run)))).toBeDefined();
  const defended = importGarden(JSON.stringify(exportGarden(g)));
  expect(chooseGarden(defended, { type: 'defend', person: 'riza', about: 'aylin' })).toBe(true);
  const positive = present(defended.people.riza.memory.beliefs.find((b) => b.prop === 'aylin:reliable'));
  expect(positive.sources.find((s) => s.id === 'hatice')?.value).toBe(true);
  expect(chooseGarden(defended, { type: 'amends', person: 'riza', about: 'aylin' })).toBe(true);
  const stillPositive = present(defended.people.riza.memory.beliefs.find((b) => b.prop === 'aylin:reliable'));
  expect(stillPositive.sources.find((s) => s.id === 'hatice')?.value).toBe(true);
  expect(stillPositive.sources.find((s) => s.id === 'hatice')?.contribution).toBeCloseTo(
    present(positive.sources.find((s) => s.id === 'hatice')?.contribution),
    7,
  );
  expect(chooseGarden(g, { type: 'amends', person: 'riza', about: 'aylin' })).toBe(true);
  const after = present(g.people.riza.memory.beliefs.find((b) => b.prop === 'aylin:reliable'));
  expect(after.sources.find((s) => s.id === 'hatice')).toBeUndefined();
  expect(after.sources.find((s) => s.id === 'ece')?.contribution).toBeCloseTo(
    present(other?.contribution),
    7,
  );
  expect(beliefEvidence(g.people.riza, 'aylin:reliable')).toBeLessThan(0);
  expect(wantsLunch(g, 'riza')).toBe(true);
  expect(importGarden(JSON.stringify(exportGarden(g)))).toEqual(g);
});
