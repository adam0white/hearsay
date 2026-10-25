import { believe } from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import { act, advance, fingerprint, load, newGame, replay, save, view } from '../src/sim/game.ts';

it('keeps the flour replies and their order until Rıza answers, including across save and replay', () => {
  const g = newGame(1);
  advance(g, 720);
  const shown = structuredClone(view(g.s).quick!);
  expect(shown.options[0]?.input).toEqual({ type: 'tell-story', listener: 'riza', incident: 1 });
  advance(g, 765);
  expect(g.s.stories?.some((story) => story.id === 15)).toBe(true);
  expect(view(g.s).quick).toEqual(shown);
  expect(view(load(save(g)).s).quick).toEqual(shown);
  expect(act(g, shown.options[0]!.input)).toBe(true);
  expect(view(g.s).quick).toBeUndefined();
  expect(g.s.routes.at(-1)?.incident).toBe(1);
  expect(fingerprint(replay(1, g.inputs, g.s.minute).s)).toBe(fingerprint(g.s));
});

it('reconstructs old question options from stories witnessed when the question was asked', () => {
  const g = newGame(1);
  advance(g, 765);
  for (const line of g.s.log) delete (line as { quick?: unknown }).quick;
  const old = load(save(g));
  expect(view(old.s).quick?.options[0]?.input).toEqual({ type: 'tell-story', listener: 'riza', incident: 1 });
  advance(old, 840);
  expect(view(old.s).quick).toBeUndefined();
});

it('explains a witnessed stalled relay and does not promise that tomorrow’s meeting happened', () => {
  const g = newGame(1);
  advance(g, 1440 + 1049);
  g.s.locations.cem = 'garden';
  expect(act(g, { type: 'tell-story', listener: 'cem', incident: 2 })).toBe(true);
  const thread = g.s.threads!.at(-1)!;
  expect(thread.who).toBe('cem');
  // Cem keeps the account to himself during an observable meeting.
  g.s.silence.cem = 2 * 1440;
  advance(g, 1440 + 1380);
  expect(thread.status).toBe('stalled');
  expect(thread).toHaveProperty('reason', 'Cem met Rıza but kept this account to himself.');
  expect(g.s.days?.at(-1)?.summary.join(' ')).toContain('Cem met Rıza');
  expect(g.s.days?.at(-1)?.tomorrow).not.toContain('Rıza and Cem meet');
  expect(g.s.days?.at(-1)?.tomorrow).toMatch(/Tomorrow.*usually.*fountain/);
});

it('explains when a held listener misses the fountain relay', () => {
  const g = newGame(1);
  advance(g, 1440 + 1049);
  g.s.locations.cem = 'garden';
  act(g, { type: 'tell-story', listener: 'cem', incident: 2 });
  g.s.locations.riza = 'garden';
  act(g, { type: 'sit', listener: 'riza' });
  advance(g, 1440 + 1140);
  expect(g.s.threads!.at(-1)).toMatchObject({
    status: 'stalled',
    reason: 'Cem didn’t get to Rıza: Rıza stayed at your table during the fountain meeting.',
  });
});

it('names the earlier teller when an Emre story is already held instead of repeating a generic refusal', () => {
  const g = newGame(1);
  advance(g, 1440 + 405);
  g.s.locations.cem = 'garden';
  g.s.routes.push({
    id: g.s.routes.length + 1,
    from: 'ali',
    to: 'cem',
    target: 'emre',
    trait: 'honest',
    value: true,
    at: g.s.minute - 1,
    origin: 'ali',
    steps: 0,
    lie: false,
    incident: 2,
  });
  believe(g.s.people.cem!, 'emre:honest', true, 0.98, 'ali', g.s.minute);
  believe(g.s.people.cem!, 'emre:dishonest', false, 0.98, 'ali', g.s.minute);
  act(g, { type: 'tell-story', listener: 'cem', incident: 2 });
  const reply = g.s.log.findLast((line) => line.kind === 'reply');
  expect(reply?.text).toContain('Ali told me that one already');
  expect(reply?.text).not.toMatch(/saint|Give me something/);
  expect(g.s.threads ?? []).toHaveLength(0);
});

it('does not stall a message promised after dusk before its first meeting opportunity', () => {
  const g = newGame(1);
  advance(g, 1440 + 1180);
  g.s.locations.cem = 'garden';
  act(g, { type: 'tell-story', listener: 'cem', incident: 2 });
  const thread = g.s.threads!.at(-1)!;
  advance(g, 1440 + 1380);
  expect(thread.status).toBe('on its way');
  expect(thread.reason).toBeUndefined();
});

it('reports insufficient belief only through the messenger speaking within earshot', () => {
  const g = newGame(1);
  advance(g, 1440 + 1049);
  g.s.locations.cem = 'garden';
  act(g, { type: 'tell-story', listener: 'cem', incident: 2 });
  for (const belief of g.s.people.cem!.memory.beliefs)
    if (['emre:honest', 'emre:dishonest'].includes(belief.prop)) belief.logOdds = 0;
  advance(g, 1440 + 1050);
  expect(g.s.threads!.at(-1)?.reason).toBe('Cem met Rıza but did not believe it enough to pass it on.');
  expect(
    g.s.log.some(
      (line) => line.speaker === 'cem' && line.text.includes('not sure enough about that account'),
    ),
  ).toBe(true);
});
