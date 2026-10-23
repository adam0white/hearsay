import { trustOf } from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import { act, advance, fingerprint, load, newGame, replay, save } from '../src/sim/game';
import { compactRun, exportRun, verifyImport } from '../src/ui/export';

const due = 5 * 1440 + 1080;
it('opens Elif’s private request once in new fortnights and replays each answer', () => {
  for (const choice of ['private', 'father', 'together']) {
    const g = newGame(1);
    advance(g, due);
    expect(g.s.scene?.id).toBe('elif-6');
    expect(g.s.scene?.who).toEqual(['elif']);
    const before = Object.fromEntries(['elif', 'riza'].map((id) => [id, trustOf(g.s.people[id]!, 'hatice')]));
    const doubts = structuredClone(g.s.riza?.doubts);
    const resumed = load(save(g));
    expect(act(resumed, { type: 'choose', scene: 'elif-6', choice: 'invalid' })).toBe(false);
    expect(act(resumed, { type: 'choose', scene: 'elif-6', choice })).toBe(true);
    expect(trustOf(resumed.s.people.elif!, 'hatice')).toBeCloseTo(
      before.elif! + (choice === 'private' ? 0.06 : choice === 'father' ? -0.06 : 0),
    );
    expect(trustOf(resumed.s.people.riza!, 'hatice')).toBeCloseTo(
      before.riza! + (choice === 'father' ? 0.06 : 0),
    );
    expect(resumed.s.riza?.doubts).toEqual(doubts);
    expect(resumed.s.log.at(-1)?.text).toMatch(/confidence|Rıza|myself/);
    for (const run of [exportRun(resumed), compactRun(exportRun(resumed))])
      expect(fingerprint(verifyImport(JSON.stringify(run)).s)).toBe(fingerprint(resumed.s));
    advance(resumed, due + 135);
    expect(resumed.s.scene?.id).not.toBe('elif-6');
    expect(
      resumed.s.log.filter((line) => line.kind === 'wedding-step' && line.speaker === 'elif'),
    ).toHaveLength(1);
  }
});

it('queues Elif behind another scene, preserves the queue on resume, and lets her leave without a trust reward', () => {
  const g = newGame(2);
  advance(g, due - 15);
  g.s.scene = {
    id: 'test-busy',
    kind: 'coffee-missed',
    who: ['emre'],
    text: 'Wait',
    choices: [{ id: 'rest', label: 'Rest', says: 'Rest' }],
    since: g.s.minute,
    until: due + 30,
    fallback: 'rest',
  };
  advance(g, due);
  expect(g.s.sceneQueue?.map((scene) => scene.id)).toContain('elif-6');
  const resumed = load(save(g));
  act(resumed, { type: 'choose', scene: 'test-busy', choice: 'rest' });
  expect(resumed.s.scene?.id).toBe('elif-6');
  const before = trustOf(resumed.s.people.elif!, 'hatice');
  advance(resumed, due + 120);
  expect(resumed.s.scene).toBeUndefined();
  expect(trustOf(resumed.s.people.elif!, 'hatice')).toBeCloseTo(before);
  expect(resumed.s.log.some((line) => line.kind === 'scene-fallback')).toBe(true);
});

it('continues both legacy editions exactly through the new scene date and ending', () => {
  for (const [version, atScene, atEnd] of [
    [1, 'e451eac5', 'c2d1c737'],
    [2, 'db9cddc5', 'ae700dfc'],
  ] as const) {
    const g = newGame(1, version);
    advance(g, due);
    expect(fingerprint(g.s)).toBe(atScene);
    expect(g.s.scene?.id).not.toBe('elif-6');
    const resumed = load(save(g));
    advance(resumed, 14 * 1440);
    expect(fingerprint(resumed.s)).toBe(atEnd);
    expect(fingerprint(replay(1, g.inputs, g.s.minute, version).s)).toBe(atScene);
    expect(fingerprint(verifyImport(JSON.stringify(exportRun(g))).s)).toBe(atScene);
  }
});
