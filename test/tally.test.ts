import { expect, it } from 'vitest';
import { newGame } from '../src/sim/game';
import type { Route } from '../src/sim/types';
import { endingTally } from '../src/ui/tally';

it('keeps the tally absent by default and throughout play', () => {
  const g = newGame(1);
  expect(endingTally(g.s)).toBe('');
  g.s.ended = true;
  expect(endingTally(g.s)).toContain('<summary>See tally</summary>');
  expect(endingTally(g.s)).not.toContain(' open');
  expect(endingTally(g.s)).toContain('Words from your gate: 0');
});

it('counts own and onward Hatice-origin routes explicitly without changing the run', () => {
  const g = newGame(1);
  g.s.ended = true;
  const route: Route = {
    id: 1,
    at: 360,
    from: 'hatice',
    to: 'riza',
    target: 'emre',
    trait: 'honest',
    value: true,
    origin: 'hatice',
    steps: 0,
    lie: false,
  };
  g.s.routes = [
    route,
    { ...route, id: 2, from: 'riza', to: 'elif', parent: 1 },
    { ...route, id: 3, retractionOf: 1 },
    { ...route, id: 4, origin: 'kemal', from: 'kemal' },
  ];
  const before = JSON.stringify(g);
  const tally = endingTally(g.s);
  expect(tally).toContain('Words from your gate: 3');
  expect(tally).toContain('your tellings (2) + onward tellings by neighbours (1)');
  expect(tally).toContain("game's own reckoning");
  expect(tally).toContain('not a measure of people');
  expect(JSON.stringify(g)).toBe(before);
});
