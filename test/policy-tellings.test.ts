import { expect, it } from 'vitest';
import { policyStep } from '../scripts/policy.ts';
import { advance, newGame, view } from '../src/sim/game.ts';

it('moves past already known relay choices without retrying a rejected input', () => {
  const g = newGame(1);
  advance(g, 1440 + 1020);
  g.s.knownTellings = Object.fromEntries(
    view(g.s).present.map((id) => [
      id,
      {
        claims: {},
        incidents: { 2: { source: 'hatice', at: g.s.minute } },
      },
    ]),
  );
  const before = g.inputs.length;
  policyStep(g, 'careful-relay');
  expect(g.inputs).toHaveLength(before + 1);
  expect(g.inputs.at(-1)?.input.type).toBe('ask');
});
