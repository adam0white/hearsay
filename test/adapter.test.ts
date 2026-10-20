import { describe, expect, it } from 'vitest';
import { HearsayAdapter } from '../scripts/hf-playtest/adapter.ts';
import { advance } from '../src/sim/game.ts';

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
    const action = a.actions().find((action) => action.kind !== 'pace');
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

it('offers the visible pace controls and applies their actual rates', () => {
  const a = new HearsayAdapter(9);
  a.game.s.minute = 500;
  const gallop = a.actions().find((action) => action.id === 'pace:80');
  expect(gallop?.label).toBe('Gallop');
  a.apply('pace:80');
  a.advance(0.05);
  expect(a.game.s.minute).toBe(504);
  a.game.s.newsWaiting = true;
  a.advance(1);
  expect(a.game.s.minute).toBe(505);
});

it('does not call an empty retraction a reward', () => {
  const a = new HearsayAdapter(9);
  a.observe();
  const action = a.actions().find((action) => action.kind === 'make-amends');
  expect(action).toBeDefined();
  if (!action) throw new Error('No amends action');
  expect(action.promise).toBeLessThan(0.2);
  a.apply(action.id);
  const reply = a.observe().events.find((event) => event.summary.includes('to withdraw'));
  expect(reply?.valence).toBe(0);
});

it('slows for a question reached inside a Gallop batch', () => {
  const a = new HearsayAdapter(9),
    b = new HearsayAdapter(9);
  for (const adapter of [a, b]) {
    adapter.game.s.minute = 404;
    adapter.actions();
    adapter.apply('pace:80');
  }
  a.advance(2);
  for (let i = 0; i < 8; i++) b.advance(0.25);
  expect(a.game.s.minute).toBe(b.game.s.minute);
  expect(a.game.s.newsWaiting).toBe(true);
  expect(a.speed).toBe(1);
  expect(a.game.s.minute).toBeLessThan(410);
});

it('offers a daily claim only after its scene is witnessed', async () => {
  const { DAILY_INCIDENTS } = await import('../src/sim/incidents.ts');
  const a = new HearsayAdapter(9);
  expect(a.actions().some((action) => action.id.includes(':emre:honest'))).toBe(false);
  const incident = DAILY_INCIDENTS[1];
  if (!incident) throw new Error('Missing day 2 scene');
  const at = (incident.day - 1) * 1440 + incident.at;
  a.game.s.minute = at;
  a.game.s.log.push({
    id: a.game.s.log.length + 1,
    at,
    kind: 'overheard',
    text: `${incident.text} You witness this yourself.`,
    target: incident.target,
  });
  expect(a.actions().some((action) => action.id.includes(':emre:honest'))).toBe(true);
});

it('does not treat another neighbour’s cold greeting or moral refusal as a setback to Hatice', () => {
  const a = new HearsayAdapter(9);
  a.observe();
  for (const [kind, text] of [
    ['cold-greeting', 'Fatma passes Kemal without the usual greeting.'],
    ['refusal', 'I will not discuss private troubles with the whole village.'],
    ['confrontation', 'Emre comes to your table. “Mother, why did you say that?”'],
  ] as const)
    a.game.s.log.push({ id: a.game.s.log.length + 1, at: 405, kind, text, speaker: 'fatma' });
  const events = a.observe().events;
  expect(events.map((event) => event.valence)).toEqual([0, 0, -0.55]);
});

it('slows when an incident arrives before the daily question', () => {
  const adapter = new HearsayAdapter(1);
  adapter.game.s.minute = 389;
  adapter.actions();
  adapter.apply('pace:80');
  adapter.advance(0.1);
  expect(adapter.speed).toBe(1);
  expect(adapter.game.s.minute).toBe(390);
});

it('offers witnessed story actions including the basket without future stories', () => {
  const a = new HearsayAdapter(7);
  expect(a.actions().some((action) => action.kind === 'tell-story')).toBe(false);
  advance(a.game, 765);
  const actions = a.actions().filter((action) => action.kind === 'tell-story');
  expect(actions.length).toBeGreaterThan(0);
  expect(actions.some((action) => action.label.includes('basket'))).toBe(true);
  for (const action of actions) {
    const input = a.offered.get(action.id);
    expect(typeof input).toBe('object');
    if (typeof input !== 'object' || input.type !== 'tell-story') throw new Error('Missing story input');
    expect(a.game.s.stories?.some((story) => story.id === input.incident)).toBe(true);
  }
});

it('attributes only the immediate reply to a story and remembers it for amends', () => {
  const a = new HearsayAdapter(7);
  advance(a.game, 405);
  a.observe();
  const action = a.actions().find((action) => {
    const input = a.offered.get(action.id);
    return typeof input === 'object' && input.type === 'tell-story' && input.listener === 'ayse';
  });
  if (!action) throw new Error('Missing witnessed story action');
  a.apply(action.id);
  const events = a.observe().events;
  const answers = events.filter((event) => Array.isArray(event.answers) && event.answers.includes(action.id));
  expect(answers).toHaveLength(1);
  expect(answers[0]?.kind).toBe('reply');
  expect(answers[0]?.reply?.to).toBe(0);
  expect(answers[0]?.reply?.believes).toBeDefined();
  expect(events.filter((event) => event.kind !== 'reply').every((event) => event.answers === false)).toBe(
    true,
  );
  expect(a.actions().find((action) => action.id === 'amends:ayse:kemal')?.promise).toBeGreaterThan(0.2);
});

it('reports the current public marriage position and the closing question', () => {
  const a = new HearsayAdapter(7);
  advance(a.game, 1380);
  const shown = a.observe();
  expect(shown.loops).toContain(a.game.s.riza?.line);
  expect(shown.loops).toContain(a.game.s.days?.at(-1)?.question);
  for (const key of ['sourceTrust', 'routes', 'credence', 'rng'])
    expect(JSON.stringify(shown)).not.toContain(key);
});
