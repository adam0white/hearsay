import { expect, it } from 'vitest';
import { act, advance, fingerprint, newGame } from '../src/sim/game';
import { heardLines } from '../src/ui/heard';

it('collapses only unfamiliar ambient promises per day and preserves the full replay record', () => {
  const g = newGame(1);
  advance(g, 1440 + 1379);
  const before = fingerprint(g.s);
  const lines = heardLines(g);
  expect(lines.filter((line) => line.target === 'can' && /keeps promises/.test(line.text))).toHaveLength(2);
  for (const id of ['hatice', 'osman', 'riza', 'cem', 'kemal']) {
    const original = g.s.log.filter((line) => line.target === id);
    expect(lines.filter((line) => line.target === id)).toEqual(original);
  }
  expect(lines.filter((line) => line.kind === 'overheard')).toEqual(
    g.s.log.filter((line) => line.kind === 'overheard'),
  );
  expect(fingerprint(g.s)).toBe(before);
});

it('retains promise echoes about someone Hatice has spoken to', () => {
  const g = newGame(1);
  g.s.locations.ibrahim = 'garden';
  act(g, { type: 'ask', listener: 'ibrahim', target: 'emre' });
  advance(g, 1379);
  const kept = heardLines(g).filter((line) => line.target === 'ibrahim');
  expect(kept).toEqual(g.s.log.filter((line) => line.target === 'ibrahim'));
  expect(kept.some((line) => line.kind === 'echo')).toBe(true);
});
