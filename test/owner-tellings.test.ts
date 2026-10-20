import { expect, it } from 'vitest';
import {
  act,
  advance,
  fingerprint,
  load,
  newGame,
  replay,
  save,
  tellingUnavailable,
} from '../src/sim/game.ts';
import type { State } from '../src/sim/types.ts';
import { compactRun, exportRun, verifyImport } from '../src/ui/export.ts';

function legacyFingerprint(state: State) {
  // npm 2.9.0 vs 2.10.0 full-state comparisons differ only at Person.engine.
  // Keep the historical hashes and normalize only that stamp on a copy.
  const legacy = structuredClone(state);
  for (const person of Object.values(legacy.people)) {
    expect(person.engine).toBe('2.10.0');
    person.engine = '2.9.0';
  }
  return fingerprint(legacy);
}

it('refuses a known duplicate story without logging another input or changing state', () => {
  const g = newGame(1);
  advance(g, 390);
  const input = { type: 'tell-story', listener: 'fatma', incident: 1 } as const;
  expect(act(g, input)).toBe(true);
  expect(tellingUnavailable(g.s, input)).toMatch(/already told Fatma/);
  const before = fingerprint(g.s);
  const count = g.inputs.length;
  expect(act(g, input)).toBe(false);
  expect(g.inputs).toHaveLength(count);
  expect(fingerprint(g.s)).toBe(before);
  expect(tellingUnavailable(load(save(g)).s, input)).toBe(tellingUnavailable(g.s, input));
  expect(fingerprint(verifyImport(JSON.stringify(compactRun(exportRun(g)))).s)).toBe(before);
});

it('tracks the actual defended claim and permits changed claims, new listeners and new incidents', () => {
  const g = newGame(1);
  advance(g, 390);
  const defend = { type: 'defend', listener: 'fatma', target: 'kemal', trait: 'dishonest' } as const;
  expect(act(g, defend)).toBe(true);
  expect(tellingUnavailable(g.s, { ...defend, type: 'tell', trait: 'honest' })).toMatch(/already told/);
  expect(tellingUnavailable(g.s, { ...defend, type: 'tell', trait: 'dishonest' })).toBeUndefined();
  expect(tellingUnavailable(g.s, { ...defend, listener: 'ayse' })).toBeUndefined();
  expect(tellingUnavailable(g.s, { type: 'tell-story', listener: 'fatma', incident: 1 })).toBeUndefined();
  const changed = { ...defend, type: 'tell', trait: 'dishonest' } as const;
  expect(act(g, changed)).toBe(true);
  expect(tellingUnavailable(g.s, defend)).toBeUndefined();
  const before = g.s.routes.length;
  expect(act(g, defend)).toBe(true);
  expect(g.s.routes).toHaveLength(before + 1);
});

it('discovers private prior testimony once, names its source, then disables without revealing hidden routes', () => {
  const g = newGame(1);
  advance(g, 390);
  const input = { type: 'tell-story', listener: 'fatma', incident: 1 } as const;
  g.s.routes.push({
    id: g.s.routes.length + 1,
    from: 'ali',
    to: 'fatma',
    target: 'kemal',
    trait: 'dishonest',
    value: true,
    at: 389,
    origin: 'ali',
    steps: 0,
    lie: false,
    incident: 1,
  });
  expect(tellingUnavailable(g.s, input)).toBeUndefined();
  const routes = g.s.routes.length;
  expect(act(g, input)).toBe(true);
  expect(g.s.log.at(-1)?.text).toContain('Ali told me');
  expect(g.s.routes).toHaveLength(routes);
  expect(tellingUnavailable(g.s, input)).toMatch(/Ali/);
  expect(act(g, input)).toBe(false);
});

it('discovers an already heard claim without strengthening it or creating another route', () => {
  const g = newGame(1);
  advance(g, 390);
  const input = { type: 'tell', listener: 'fatma', target: 'kemal', trait: 'generous' } as const;
  g.s.routes.push({
    id: g.s.routes.length + 1,
    from: 'ali',
    to: 'fatma',
    target: 'kemal',
    trait: 'stingy',
    value: false,
    at: 389,
    origin: 'ali',
    steps: 0,
    lie: false,
  });
  const person = JSON.stringify(g.s.people.fatma);
  expect(tellingUnavailable(g.s, input)).toBeUndefined();
  expect(act(g, input)).toBe(true);
  expect(g.s.log.at(-1)?.text).toContain('Ali told me');
  expect(JSON.stringify(g.s.people.fatma)).toBe(person);
  expect(tellingUnavailable(g.s, input)).toContain('Ali');
});

it('replays a minimal pre-change duplicate run with its exact legacy fingerprint', () => {
  const inputs = [0, 1].map(() => ({
    at: 390,
    input: { type: 'tell-story', listener: 'fatma', incident: 1 } as const,
  }));
  const g = replay(1, inputs, 390, 1);
  expect(legacyFingerprint(g.s)).toBe('53cbae48');
  expect(g.inputs).toHaveLength(2);
  const run = { game: 'hearsay', version: 1, seed: 1, minute: 390, inputs, fingerprint: '53cbae48' };
  expect(legacyFingerprint(verifyImport(JSON.stringify(run)).s)).toBe('53cbae48');
  expect(exportRun(g).version).toBe(1);
  expect(newGame(1).s.version).toBe(2);
  expect(() => verifyImport(JSON.stringify({ ...run, version: 3 }))).toThrow();
});

it('permits a new assertion after retracting it to that listener', () => {
  const g = newGame(1);
  advance(g, 390);
  const input = { type: 'tell', listener: 'fatma', target: 'kemal', trait: 'dishonest' } as const;
  expect(act(g, input)).toBe(true);
  expect(tellingUnavailable(g.s, input)).toBeDefined();
  expect(act(g, { type: 'make-amends', listener: 'fatma', target: 'kemal' })).toBe(true);
  expect(tellingUnavailable(g.s, input)).toBeUndefined();
  expect(act(g, input)).toBe(true);
});

it('provides pure UI protection for an imported legacy run without changing its historical simulation', () => {
  const g = newGame(1, 1);
  advance(g, 390);
  const input = { type: 'tell-story', listener: 'fatma', incident: 1 } as const;
  expect(act(g, input)).toBe(true);
  const before = fingerprint(g.s);
  expect(tellingUnavailable(g.s, input)).toContain('already told Fatma');
  expect(fingerprint(g.s)).toBe(before);
  expect(act(g, input)).toBe(true);
  expect(legacyFingerprint(g.s)).toBe('53cbae48');
});

it('recovers legacy public tellings collapsed into echoes without changing replay state', () => {
  const g = newGame(1, 1);
  advance(g, 420);
  const input = { type: 'tell', listener: 'deniz', target: 'hasan', trait: 'reliable' } as const;
  const before = save(g);
  expect(tellingUnavailable(g.s, input)).toContain('already heard this from Selin');
  expect(tellingUnavailable(load(before).s, input)).toContain('Selin');
  for (const run of [exportRun(g), compactRun(exportRun(g))])
    expect(tellingUnavailable(verifyImport(JSON.stringify(run)).s, input)).toContain('Selin');
  expect(save(g)).toBe(before);
  // Historical inputs still apply under version 1, even when the UI knows better.
  expect(act(g, input)).toBe(true);
  expect(fingerprint(replay(1, g.inputs, 420, 1).s)).toBe(fingerprint(g.s));
});

it('does not use an echo to reveal a private delivery of the same claim by the same speaker', () => {
  const g = newGame(1, 1);
  advance(g, 420);
  const publicRoute = g.s.routes.find((r) => r.id === 25);
  if (!publicRoute) throw new Error('Missing public telling fixture');
  g.s.routes.push({ ...publicRoute, id: g.s.routes.length + 1, to: 'ali', at: 419 });
  const before = save(g);
  expect(
    tellingUnavailable(g.s, { type: 'tell', listener: 'ali', target: 'hasan', trait: 'reliable' }),
  ).toBeUndefined();
  expect(save(g)).toBe(before);
});

it('does not restore a legacy duplicate-story limit after a later withdrawal, even in the same minute', () => {
  const g = newGame(1, 1);
  advance(g, 390);
  const input = { type: 'tell-story', listener: 'fatma', incident: 1 } as const;
  expect(act(g, input)).toBe(true);
  expect(act(g, input)).toBe(true);
  expect(tellingUnavailable(g.s, input)).toContain('already told Fatma');
  expect(act(g, { type: 'make-amends', listener: 'fatma', target: 'kemal' })).toBe(true);
  const before = save(g);
  expect(tellingUnavailable(g.s, input)).toBeUndefined();
  expect(tellingUnavailable(load(before).s, input)).toBeUndefined();
  for (const run of [exportRun(g), compactRun(exportRun(g))])
    expect(tellingUnavailable(verifyImport(JSON.stringify(run)).s, input)).toBeUndefined();
  expect(save(g)).toBe(before);
  expect(act(g, input)).toBe(true);
  expect(tellingUnavailable(g.s, input)).toContain('already told Fatma');
  expect(fingerprint(replay(1, g.inputs, 390, 1).s)).toBe(fingerprint(g.s));
});

it('loads an owner-style full legacy export through day 7 with repeated stories and withdrawal', () => {
  // Synthetic history: no private owner data belongs in a fixture.
  const story = { type: 'tell-story', listener: 'fatma', incident: 1 } as const;
  const inputs = [story, story, { type: 'make-amends', listener: 'fatma', target: 'kemal' }, story].map(
    (input) => ({ at: 390, input }),
  );
  const run = {
    game: 'hearsay',
    version: 1,
    seed: 1,
    minute: 9240,
    inputs,
    fingerprint: '30000cb5',
  };
  const g = verifyImport(JSON.stringify(run));
  const full = exportRun(g);
  expect(full.version).toBe(1);
  expect(legacyFingerprint(full.state)).toBe(run.fingerprint);
  expect(exportRun(verifyImport(JSON.stringify(full)))).toEqual(full);
});
