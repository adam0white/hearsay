import { describe, expect, it } from 'vitest';
import { HearsayAdapter } from '../scripts/hf-playtest/adapter.ts';

describe('HF playtester boundary', () => {
  it('reports witnessed information without hidden state', () => {
    const adapter = new HearsayAdapter(5);
    const shown = JSON.stringify(adapter.observe());
    for (const key of ['sourceTrust', 'routes', 'credence', 'rng']) expect(shown).not.toContain(key);
  });
  it('advances only the simulation clock, independently of time spent closed', () => {
    const a = new HearsayAdapter(5);
    const minute = a.game.s.minute;
    a.advance(10);
    expect(a.game.s.minute).toBeGreaterThan(minute);
    expect(a.game.s.minute).toBeLessThanOrEqual(minute + 30);
  });
  it('applies only offered actions and attributes the answer', () => {
    const a = new HearsayAdapter(5);
    a.advance(75);
    a.observe();
    const action = a.actions()[0];
    expect(action).toBeDefined();
    if (!action) throw new Error('No action');
    a.apply(action.id);
    expect(
      a.observe().events.some((event) => Array.isArray(event.answers) && event.answers.includes(action.id)),
    ).toBe(true);
    expect(() => a.apply('not-offered')).toThrow();
  });
});

it('integrates speed across night boundaries independently of caller batching', () => {
  const a = new HearsayAdapter(9),
    b = new HearsayAdapter(9);
  a.game.s.minute = 1379;
  b.game.s.minute = 1379;
  a.advance(2);
  b.advance(1);
  b.advance(1);
  expect(a.game.s.minute).toBe(b.game.s.minute);
  expect(a.game.s.minute).toBe(1620);
});
