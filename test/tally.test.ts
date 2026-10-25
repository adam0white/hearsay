import { expect, it } from 'vitest';
import { newGame } from '../src/sim/game';
import type { Route } from '../src/sim/types';
import { endingTally } from '../src/ui/tally';

it('keeps the tally absent by default and throughout play', () => {
  const g = newGame(1);
  expect(endingTally(g.s)).toBe('');
  g.s.ended = true;
  expect(endingTally(g.s)).toContain('<summary>See the total</summary>');
  expect(endingTally(g.s)).not.toContain(' open');
  expect(endingTally(g.s)).toContain('Claims that began with you: 0');
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
  expect(tally).toContain('Claims that began with you: 3');
  expect(tally).toContain('You made 2 claims. Neighbours repeated them 1 time.');
  expect(tally).toContain('Each recorded conversation counts once');
  expect(tally).toContain('does not measure anyone’s worth');
  expect(JSON.stringify(g)).toBe(before);
  g.s.routes = [route, { ...route, id: 2, from: 'riza', to: 'elif', parent: 1 }];
  expect(endingTally(g.s)).toContain('You made 1 claim. Neighbours repeated it 1 time.');
});
