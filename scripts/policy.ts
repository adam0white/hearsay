import { act, advance, newGame, view } from '../src/sim/game.ts';
import type { Game, Input } from '../src/sim/types.ts';

export type Policy = 'quiet' | 'careful' | 'reckless' | 'cunning';

/** Policies use only people and talk visible from the garden. */
export function policyStep(g: Game, policy: Policy) {
  const v = view(g.s);
  const listener = ['riza', 'ayse', ...v.present].find(
    (id) => v.present.includes(id) && id !== 'kemal' && id !== 'emre',
  );
  if (!listener) return;
  let input: Input;
  if (policy === 'quiet') {
    input = g.s.newsWaiting ? { type: 'hold-tongue' } : { type: 'ask', listener, target: 'emre' };
  } else if (
    policy === 'cunning' &&
    g.s.minute < 1440 &&
    v.present.includes('murat') &&
    !g.inputs.some((entry) => entry.input.type === 'tell')
  ) {
    input = { type: 'tell', listener: 'murat', target: 'leyla', trait: 'stingy' };
  } else if (policy === 'careful' || policy === 'cunning') {
    input = { type: 'defend', listener, target: 'emre', trait: 'reliable' };
  } else {
    input = { type: 'tell', listener, target: 'emre', trait: 'dishonest' };
  }
  act(g, input);
}

export function runPolicy(seed: number, policy: Policy, until = 14 * 1440) {
  const g = newGame(seed);
  while (!g.s.ended && g.s.minute < until) {
    policyStep(g, policy);
    advance(g, Math.min(until, g.s.minute + 60));
  }
  return g;
}
