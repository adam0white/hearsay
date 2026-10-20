import { expect, it } from 'vitest';
import { newGame, PEOPLE } from '../src/sim/game.ts';
import type { State } from '../src/sim/types.ts';
import { say } from '../src/sim/voices.ts';

const kinds = ['opening', 'reply', 'refusal'] as const;
type VoiceKind = (typeof kinds)[number];

function exhaust(s: State, id: string, kind: VoiceKind) {
  const lines: string[] = [];
  for (let attempt = 0; attempt < 100; attempt++) {
    const text = say(s, id, kind);
    if (text === undefined) return lines;
    lines.push(text);
  }
  throw new Error(`${id} ${kind} never exhausted`);
}

it('gives all 32 neighbours at least six distinct openings, replies and refusals', () => {
  expect(PEOPLE).toHaveLength(32);
  const s = newGame(1).s;
  for (const { id } of PEOPLE) {
    const all: string[] = [];
    for (const kind of kinds) {
      const lines = exhaust(s, id, kind);
      expect(lines.length, `${id} ${kind}`).toBeGreaterThanOrEqual(6);
      expect(new Set(lines).size, `${id} ${kind}`).toBe(lines.length);
      expect(say(s, id, kind, 'A different detail.')).toBeUndefined();
      all.push(...lines);
    }
    expect(new Set(all).size, `${id} across pools`).toBe(all.length);
  }
});

it('preserves daily exhaustion through serialization and resets each neighbour at midnight', () => {
  const s = newGame(4).s;
  const first = new Map<string, string>();
  for (const { id } of PEOPLE) {
    for (const kind of kinds) {
      const initial = exhaust(s, id, kind)[0];
      if (!initial) throw new Error(`${id} has no ${kind} lines`);
      first.set(`${id}:${kind}`, initial);
    }
  }
  const restored: State = JSON.parse(JSON.stringify(s));
  restored.minute = 1439;
  for (const { id } of PEOPLE) {
    for (const kind of kinds) expect(say(restored, id, kind)).toBeUndefined();
  }
  restored.minute = 1440;
  for (const { id } of PEOPLE) {
    for (const kind of kinds) expect(say(restored, id, kind)).toBe(first.get(`${id}:${kind}`));
  }
});

it('keeps Zehra at the grocer and gives Ayşe bakery diction', () => {
  const s = newGame(1).s;
  const zehra = kinds.flatMap((kind) => exhaust(s, 'zehra', kind)).join(' ');
  const ayse = exhaust(s, 'ayse', 'opening').join(' ');
  expect(zehra).not.toMatch(/bread counter|trays|out with the bread/);
  expect(zehra).toMatch(/grocer|Kemal/);
  expect(ayse).toMatch(/bakery|bread counter|trays/);
});
