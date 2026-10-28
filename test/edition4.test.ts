import { createPerson } from '@adam0white/hf-legacy';
import { expect, it } from 'vitest';
import { act, advance, fingerprint, load, newGame, replay, save } from '../src/sim/game.ts';
import { dailyIncidents } from '../src/sim/incidents.ts';
import { say } from '../src/sim/voices.ts';
import { neighborNorm } from '../src/sim/world.ts';
import { historicalRulesFingerprint } from './helpers/historical-rules.ts';

it('pins the canonical night nurse profile to edition 4', () => {
  const g = newGame(17, 4);
  const expected = createPerson({
    id: 'derya',
    name: 'Derya',
    now: 360,
    bornAt: 360 - 44 * 365 * 1440,
    seed: 17 ^ 0x55,
    sex: 'female',
    voices: [{ voiceId: 'kapici', trust: 0.5 }],
    traits: { honesty: 0.7, extraversion: 0.35, agreeableness: 0.6, emotionality: 0.5, openness: 0.55 },
    norms: [{ normId: 'backbiting', standing: 'forbidden', conviction: 0.5 }],
  });
  expect(g.s.people.derya!.body).toEqual(expected.body);
  expect(g.s.people.derya!.traits).toEqual(expected.traits);
  expect(g.s.people.derya!.life).toEqual(expected.life);
  expect(g.s.people.derya!.conscience.norms).toEqual(expected.conscience.norms);
  expect(neighborNorm(g.s, 'derya')).toBe('forbidden');
  advance(g, 480);
  expect(g.s.locations.derya).toBe('home-7');
  expect(act(g, { type: 'call-over', person: 'derya' })).toBe(false);
  advance(g, 1080);
  expect(g.s.locations.derya).toBe('hospital');
});

it('keeps the generous breakfast after the night shift and changes the greeting only in edition 4', () => {
  const current = newGame(2, 4);
  expect(dailyIncidents(4)[3]?.text).toContain('after her night shift');
  expect(dailyIncidents(4)[3]?.text).toContain('both cheese rolls');
  expect(dailyIncidents(3)[3]?.text).toContain('before her shift');
  say(current.s, 'derya', 'opening');
  expect(say(current.s, 'derya', 'opening')).toContain('night shift');
  const old = newGame(2, 3);
  say(old.s, 'derya', 'opening');
  expect(say(old.s, 'derya', 'opening')).toBe('My shift starts a bit later.');
});

it('pins admitted people before local initialization and round trips them through save/replay', () => {
  const original = newGame(22, 4).s.people.derya!;
  const incoming = structuredClone(original);
  incoming.traits.honesty = 0.21;
  const g = newGame(17, 4, { derya: incoming });
  expect(g.s.people.derya).toEqual(incoming);
  incoming.traits.honesty = 0.99;
  expect(g.s.people.derya!.traits.honesty).toBe(0.21);
  advance(g, 6000);
  const restored = load(save(g));
  expect(fingerprint(replay(17, restored.inputs, restored.s.minute, 4, restored.initialPeople).s)).toBe(
    fingerprint(g.s),
  );
  expect(() => newGame(17, 3, { derya: original })).toThrow();
});

it('preserves baseline rules in all three historical editions after prose changes', () => {
  for (const [edition, expected] of [
    [1, 'c3f9e714'],
    [2, '6a50a48c'],
    [3, 'b5d27bef'],
  ] as const) {
    const g = newGame(17, edition);
    advance(g, 6000);
    expect(historicalRulesFingerprint(g.s)).toBe(expected);
    expect(historicalRulesFingerprint(replay(17, g.inputs, g.s.minute, edition).s)).toBe(expected);
  }
});

it('offers an admitted visitor an ordinary boundary encounter and replays the pinned admission', async () => {
  const { projectPersona } = await import('@adam0white/hf-legacy');
  const { createPersona } = await import('@adam0white/lab-client');
  const { checkpointPerson, makeDilanOpening, prepareOneCastAdmission } = await import(
    '../src/sim/one-cast.ts'
  );
  const source = createPerson({
    id: 'dilan',
    name: 'Dilan',
    seed: 3,
    now: 200,
    bornAt: -33 * 365 * 1440,
    sex: 'female',
  });
  const projection = projectPersona(source, { version: 'murmur-hearsay/1', skills: {}, episodes: {} });
  const envelope = await createPersona({
    format: 'hf-persona/1',
    castId: 'hf.cast.dilan.murmur',
    castRevision: '1',
    branchId: 'boundary-test',
    parentRevision: null,
    source: { game: 'murmur', build: 'test', engine: '2.14.1', rules: '1' },
    transfer: { person: projection, history: [], checkpoint: await checkpointPerson(source) },
    limitations: projection.limitations,
  });
  const admission = await prepareOneCastAdmission(envelope, makeDilanOpening(7, 360, projection), {
    targetBuild: 'test',
  });
  const g = newGame(
    7,
    4,
    { 'dilan-delivery': admission.person },
    { entries: [{ admission, head: envelope, scope: 'local' }], rows: [] },
  );
  expect(act(g, { type: 'one-cast-encounter', person: 'dilan-delivery', choice: 'support' })).toBe(false);
  advance(g, 1440 + 390);
  expect(g.s.people['dilan-delivery']!.activity).toBeFalsy();
  expect(g.s.locations['dilan-delivery']).toBe('garden');
  expect(act(g, { type: 'one-cast-encounter', person: 'dilan-delivery', choice: 'support' })).toBe(true);
  expect(g.continuity?.entries[0]?.encounter?.chosenAffordance).toMatch(/^one-cast-/);
  expect(g.initialContinuity?.entries[0]?.encounter).toBeUndefined();
  expect(act(g, { type: 'one-cast-encounter', person: 'dilan-delivery', choice: 'support' })).toBe(false);
  const restored = load(save(g));
  const reproduced = replay(
    7,
    restored.inputs,
    restored.s.minute,
    4,
    restored.initialPeople,
    restored.initialContinuity,
  );
  expect(fingerprint(reproduced.s)).toBe(fingerprint(g.s));
  expect(reproduced.continuity).toEqual(g.continuity);
});

it('releases Derya after her final night shift before the assignment checkpoint', () => {
  const g = newGame(7, 4);
  const departure = 13 * 1440 + 390;
  advance(g, departure - 15);
  expect(g.s.deryaAssignmentReleased).toBeUndefined();
  expect(g.s.log.some((line) => line.kind === 'one-cast-release')).toBe(false);
  advance(g, departure);
  expect(g.s.deryaAssignmentReleased).toBe(true);
  expect(g.s.people.derya!.activity).toBeFalsy();
  expect(g.s.locations.derya).toBe('flat-5');
  expect(g.s.log.filter((line) => line.kind === 'one-cast-release')).toEqual([
    expect.objectContaining({
      at: departure,
      speaker: 'derya',
      text: 'Derya’s short relief assignment has ended. She returns to flat 5 in Lale Apartmanı.',
    }),
  ]);
  const restored = load(save(g));
  expect(fingerprint(replay(7, restored.inputs, departure, 4).s)).toBe(fingerprint(g.s));
  advance(restored, departure + 12 * 60);
  expect(restored.s.locations.derya).toBe('flat-5');
  expect(restored.s.people.derya!.activity).toBeFalsy();
  expect(restored.s.log.filter((line) => line.kind === 'one-cast-release')).toHaveLength(1);
});

it('keeps different used voice stems distinct when comparing historical rules', () => {
  const a = newGame(1, 1).s;
  const b = structuredClone(a);
  a.voiceUsed = { 'voice:0:hatice': ['Sit down. Your tea is coming.'] };
  b.voiceUsed = { 'voice:0:hatice': ['Come in, there’s a clean chair.'] };
  expect(historicalRulesFingerprint(a)).not.toBe(historicalRulesFingerprint(b));
  b.voiceUsed = { 'voice:0:hatice': ['I’ll tell you, but keep it between us.'] };
  a.voiceUsed = { 'voice:0:hatice': ['Between you and me, then.'] };
  expect(historicalRulesFingerprint(a)).toBe(historicalRulesFingerprint(b));
});
