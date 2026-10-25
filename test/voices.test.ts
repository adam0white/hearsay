import { expect, it } from 'vitest';
import { newGame, PEOPLE } from '../src/sim/game.ts';
import { DAILY_INCIDENTS } from '../src/sim/incidents.ts';
import type { State } from '../src/sim/types.ts';
import { claimText, knownIncidentClaim, say } from '../src/sim/voices.ts';

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

it('keeps every authored stem short enough to speak in one breath', () => {
  const s = newGame(1).s;
  for (const { id } of PEOPLE) {
    for (const kind of kinds) {
      for (const text of exhaust(s, id, kind)) {
        expect(text.split(/\s+/).length, `${id}: ${text}`).toBeLessThanOrEqual(14);
        expect(text, `${id} ${kind}`).not.toMatch(
          /considered|concern|account for|clear response|careful answer|own view|my own part|assumption|verify|discretion|conduct|talebearing/i,
        );
      }
    }
  }
});

it('phrases claims as ordinary speech and keeps negative claims distinct', () => {
  const traits = [
    'honest',
    'dishonest',
    'reliable',
    'unreliable',
    'generous',
    'stingy',
    'kind',
    'cruel',
    'hardworking',
    'lazy',
    'owes',
  ];
  for (const trait of traits) {
    const yes = claimText('Kemal', trait, true);
    const no = claimText('Kemal', trait, false);
    expect(yes).toContain('Kemal');
    expect(no).toContain('Kemal');
    expect(yes).not.toBe(no);
    expect(yes).not.toMatch(new RegExp(`Kemal is (?:not )?${trait}`));
    expect(no).not.toMatch(new RegExp(`Kemal is (?:not )?${trait}`));
  }
});

it('keeps witnessed acts concrete without inventing motives', () => {
  const [flourScene, , , , , jarScene, , , , vanScene] = DAILY_INCIDENTS;
  if (!flourScene || !jarScene || !vanScene) throw new Error('Missing daily scene');
  const flour = knownIncidentClaim(flourScene);
  expect(flour).toMatch(/old flour/);
  expect(flour).toMatch(/new.flour label/);
  for (const scene of DAILY_INCIDENTS) expect(knownIncidentClaim(scene)).toBeTruthy();
  expect(knownIncidentClaim(jarScene)).toMatch(/do not know|don’t know/);
  expect(knownIncidentClaim(vanScene)).toMatch(/paid|paying/);
});

it('explains setting terms in the speech where players first encounter them', () => {
  const s = newGame(1).s;
  const fatma = exhaust(s, 'fatma', 'refusal').find((line) => /gıybet/i.test(line));
  expect(fatma).toMatch(/talk(?:ing)? behind (?:someone|their)/i);
  const emre = exhaust(s, 'emre', 'opening').find((line) => /Mother/.test(line));
  expect(emre).toMatch(/Mother/);
  expect(s.log[0]?.text).toMatch(/samovar.*tea urn/);
});
