import { credence, trustOf } from '@adam0white/human-framework';
import { afterAll, describe, expect, it } from 'vitest';
import { runPolicy } from '../scripts/policy.ts';
import { act, advance, newGame, PEOPLE, spokenClaim } from '../src/sim/game.ts';
import { dailyIncidents, EMRE_INCIDENTS } from '../src/sim/incidents.ts';

it('witnesses the promised scene in plain words at 06:30', () => {
  const g = newGame(1);
  advance(g, 390);
  const scene = g.s.log.find((l) => l.kind === 'overheard');
  expect(scene?.text).toMatch(/Kemal.*wife Zehra.*mixing old flour into the new/);
  expect(scene?.at).toBe(390);
  expect(credence(g.s.people.hatice!, 'kemal:dishonest')).toBeGreaterThan(0.9);
  expect(g.s.locations.kemal).toBe('fountain');
  expect(g.s.locations.zehra).toBe('fountain');
});

it('offers a new witnessed incident and a table question every day', () => {
  const g = newGame(7);
  for (let day = 0; day < 14; day++) {
    advance(g, day * 1440 + 405);
    const scenes = g.s.log.filter((l) => l.kind === 'overheard');
    expect(scenes).toHaveLength(day + 1 + EMRE_INCIDENTS.filter((scene) => scene.day <= day).length);
    const scene = dailyIncidents(g.s.version)[day]!;
    const belief = credence(g.s.people.hatice!, `${scene.target}:${scene.trait}`);
    expect(scene.value ? belief : 1 - belief).toBeGreaterThan(0.9);
    expect(new Set(scenes.map((l) => l.target)).size).toBe(day + 1);
    expect(g.s.newsWaiting).toBe(true);
    const q = g.s.log.findLast((l) => l.kind === 'question');
    expect(g.s.locations[q!.speaker!]).toBe('garden');
    expect(q?.text).toBe(scene.question);
  }
});

it('collects repeated visible claims into one daily echo with count and speakers', () => {
  const g = newGame(3);
  advance(g, 1380);
  const echoes = g.s.log.filter((l) => l.kind === 'echo');
  expect(echoes.length).toBeGreaterThan(0);
  expect(echoes.every((l) => /again.*\d|\d.*again/.test(l.text))).toBe(true);
  expect(echoes.every((l) => /heard it from/.test(l.text))).toBe(true);
  expect(new Set(echoes.map((l) => `${l.target}:${l.text.split('You have heard this again')[0]}`)).size).toBe(
    echoes.length,
  );
});

it('seeing a contradiction traces a lie and costs trust across the witness household', () => {
  const g = newGame(8);
  advance(g, 405);
  act(g, { type: 'tell', listener: 'ayse', target: 'emre', trait: 'dishonest' });
  const before = trustOf(g.s.people.riza!, 'hatice');
  advance(g, 1080);
  expect(trustOf(g.s.people.riza!, 'hatice')).toBeLessThan(before);
  const confrontation = g.s.log.find((l) => l.kind === 'confrontation' && l.speaker === 'emre');
  expect(confrontation?.at).toBe(1080);
  expect(confrontation?.text).toContain('Mother,');
  expect(g.s.locations.emre).toBe('garden');
  expect(trustOf(g.s.people.elif!, 'hatice')).toBeLessThan(before);
  expect(trustOf(g.s.people.ayse!, 'hatice')).toBeLessThan(before);
});

const policySeeds = [1, 2, 3, 8, 13];
describe.each(['careful', 'reckless', 'cunning'] as const)('%s seeded outcomes', (policy) => {
  const outcomes = new Map<number, boolean>();
  afterAll(() => {
    expect(outcomes.size).toBe(policySeeds.length);
    expect([...outcomes.values()].filter(Boolean).length).toBeGreaterThan(policySeeds.length / 2);
  });
  it.each(policySeeds)('plays seed %i to the policy outcome', (seed) => {
    const state = runPolicy(seed, policy).s;
    outcomes.set(
      seed,
      policy === 'reckless'
        ? state.engagement === 'refused' && state.garden === 'empty'
        : state.engagement === 'accepted',
    );
    if (policy === 'cunning')
      expect(state.routes.some((route) => route.from === 'hatice' && route.lie)).toBe(true);
  });
});

// A contradicted account in another household is not knowledge Rıza possesses.
it('does not let an unseen contradiction veto Rıza’s decision', () => {
  const g = runPolicy(11, 'careful', 12 * 1440 + 1185);
  const root = g.s.routes.find((r) => r.from === 'hatice' && r.to === 'riza')!;
  root.contradictedAt = g.s.minute;
  root.contradictedHouseholds = [7];
  advance(g, 12 * 1440 + 1200);
  expect(g.s.engagement).toBe('accepted');
});

it('keeps equivalent opposite-form testimony attached to Hatice’s route', () => {
  const g = newGame(3);
  advance(g, 405);
  act(g, { type: 'tell', listener: 'ayse', target: 'emre', trait: 'lazy' });
  const root = g.s.routes.at(-1)!;
  advance(g, 1020);
  expect(
    g.s.routes.some(
      (r) => r.trait === 'hardworking' && r.value === false && r.origin === 'hatice' && r.root === root.id,
    ),
  ).toBe(true);
});

it('keeps spontaneous starting rumours out of the garden before the first incident', () => {
  for (const seed of [1, 3, 8, 42]) {
    const g = newGame(seed);
    advance(g, 389);
    expect(g.s.routes.filter((r) => r.to === 'hatice')).toHaveLength(0);
    expect(g.s.log.filter((l) => ['rumour', 'conversation', 'echo'].includes(l.kind))).toHaveLength(0);
    advance(g, 450);
    expect(g.s.routes.length).toBeGreaterThan(0);
  }
});

it('never shows a changed greeting between members of the same household', () => {
  const g = newGame(1);
  advance(g, 390);
  const household = new Map(PEOPLE.map((p) => [p.id, p.household]));
  const first = g.s.log.filter((l) => l.kind === 'cold-greeting');
  expect(first.some((l) => l.speaker === 'zehra' && l.target === 'kemal')).toBe(false);
  advance(g, 14 * 1440);
  const greetings = g.s.log.filter((l) => l.kind === 'cold-greeting');
  expect(greetings.length).toBeGreaterThan(0);
  for (const l of greetings) expect(household.get(l.speaker!)).not.toBe(household.get(l.target!));
});

it('records incidents without a redundant speaker or a suggested recipient in the prose', () => {
  const g = newGame(1);
  advance(g, 390);
  const scene = g.s.log.find((l) => l.kind === 'overheard');
  expect(scene?.speaker).toBeUndefined();
  expect(scene?.text).not.toMatch(/would care/);
});

it('speaks a known act instead of a trait label and does not invent a scene for a lie', () => {
  const g = newGame(1);
  act(g, { type: 'tell', listener: 'fatma', target: 'kemal', trait: 'cruel' });
  const before = g.s.log.findLast((l) => l.speaker === 'hatice');
  expect(before?.text).not.toMatch(/Kemal is cruel|old flour/);
  advance(g, 390);
  act(g, { type: 'tell', listener: 'fatma', target: 'kemal', trait: 'dishonest' });
  const spoken = g.s.log.findLast((l) => l.speaker === 'hatice');
  expect(spoken?.text).toMatch(/old flour/);
  expect(spoken?.text).not.toContain('Kemal is dishonest');
});

it('does not turn another witnessed act into knowledge of a later incident', () => {
  const g = newGame(1);
  advance(g, 1830);
  expect(spokenClaim(g.s, 'osman', 'emre', 'honest', true)).not.toMatch(/fifty|Ali/);
  expect(spokenClaim(g.s, 'hatice', 'emre', 'honest', true)).toMatch(/Ali.*fifty/);
});
