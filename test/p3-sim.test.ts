import { confirm, credence } from '@adam0white/hf-legacy';
import { expect, it } from 'vitest';
import { act, advance, load, newGame, replay, save } from '../src/sim/game.ts';
import type { Game } from '../src/sim/types.ts';

function replyTo(g: Game, inputIndex: number) {
  return g.s.log.findLast((line) => line.kind === 'reply' && line.reply?.to === inputIndex);
}

it('rejects asking a neighbour about themselves without recording an input', () => {
  const g = newGame(3);
  g.s.locations.emre = 'garden';
  const before = save(g);
  expect(act(g, { type: 'ask', listener: 'emre', target: 'emre' })).toBe(false);
  expect(save(g)).toBe(before);
});

it('preserves legacy repeated speech replies linked to each input', () => {
  const g = newGame(3, 1);
  advance(g, 405);
  g.s.locations.fatma = 'garden';
  for (let index = 0; index < 12; index++) {
    expect(act(g, { type: 'tell', listener: 'fatma', target: 'kemal', trait: 'dishonest' })).toBe(true);
    const reply = replyTo(g, index);
    expect(reply?.speaker).toBe('fatma');
    expect(reply?.target).toBe('kemal');
    expect(reply?.text.trim().length).toBeGreaterThan(20);
    expect(reply?.text).not.toMatch(/considers your words\.\s*$/);
    expect(reply?.text).toMatch(/believe|not sure|won.t repeat/i);
    expect(['yes', 'doubt', 'no', 'refuse']).toContain(reply?.reply?.believes);
  }
});

it('records witnessed incidents as selectable stories without inventing future knowledge', () => {
  const g = newGame(3);
  expect(g.s.stories ?? []).toHaveLength(0);
  advance(g, 390);
  expect(g.s.stories).toEqual([
    expect.objectContaining({ id: 1, day: 1, target: 'kemal', truth: true, title: expect.any(String) }),
  ]);
  expect(g.s.stories![0]!.title.trim()).not.toBe('');
  advance(g, 765);
  expect(g.s.stories).toContainEqual(
    expect.objectContaining({ id: 15, day: 1, target: 'kemal', truth: true, title: expect.any(String) }),
  );
  expect(g.s.stories!.some((story) => story.day > 1)).toBe(false);
});

it('lets the player tell the basket incident itself and rejects unknown story ids', () => {
  const g = newGame(3);
  advance(g, 765);
  g.s.locations.cem = 'garden';
  const before = save(g);
  expect(act(g, { type: 'tell-story', listener: 'cem', incident: 99 })).toBe(false);
  expect(save(g)).toBe(before);
  expect(act(g, { type: 'tell-story', listener: 'cem', incident: 15 })).toBe(true);
  const spoken = g.s.log.findLast((line) => line.speaker === 'hatice');
  expect(spoken?.text).toMatch(/basket|Safiye/);
  expect(replyTo(g, 0)?.reply?.to).toBe(0);
  expect(g.s.routes.at(-1)).toMatchObject({ from: 'hatice', to: 'cem', target: 'kemal', trait: 'kind' });
});

it('preserves stories and reply links through save and deterministic replay', () => {
  const g = newGame(3);
  advance(g, 405);
  expect(act(g, { type: 'tell-story', listener: 'aylin', incident: 1 })).toBe(true);
  expect(save(load(save(g)))).toBe(save(g));
  expect(save(replay(g.s.seed, g.inputs, g.s.minute))).toBe(save(g));
});

it('does not offer a daily story before Hatice witnesses it', () => {
  const g = newGame(7);
  g.s.locations.aylin = 'garden';
  const before = save(g);
  expect(act(g, { type: 'tell-story', listener: 'aylin', incident: 1 })).toBe(false);
  expect(save(g)).toBe(before);
});

it('Rıza knows Emre a little and gives a current marriage position', () => {
  const g = newGame(7);
  g.s.locations.riza = 'garden';
  expect(act(g, { type: 'ask', listener: 'riza', target: 'emre' })).toBe(true);
  expect(replyTo(g, 0)?.text).not.toContain('well enough to say');
  expect(replyTo(g, 0)?.text).toMatch(/Emre|polite|works/);
  expect(g.s.riza).toMatchObject({ answerDay: 13, at: g.s.minute, line: expect.any(String) });
  expect(g.s.riza?.line.trim().length).toBeGreaterThan(20);
  expect(g.s.riza?.lean).toBeDefined();
});

it('Rıza returns to the garden at noon every day before his answer', () => {
  const g = newGame(7);
  for (let day = 0; day < 13; day++) {
    advance(g, day * 1440 + 720);
    expect(g.s.locations.riza).toBe('garden');
    expect(g.s.riza?.answerDay).toBe(13);
  }
  advance(g, 13 * 1440 + 720);
  expect(g.s.engagement).not.toBe('waiting');
  expect(g.s.riza?.line).not.toMatch(/\bwill answer\b/i);
});

it('retains one echo per claim and day while increasing counts', () => {
  const g = newGame(3);
  advance(g, 2 * 1440 + 1380);
  const echoes = g.s.log.filter((line) => line.kind === 'echo');
  expect(echoes.length).toBeGreaterThan(0);
  const countedClaims = Object.values(g.s.heardClaims ?? {}).filter((claim) => claim.echo !== undefined);
  expect(countedClaims).toHaveLength(echoes.length);
  expect(new Set(countedClaims.map((claim) => claim.echo)).size).toBe(echoes.length);
  expect(new Set(countedClaims.map((claim) => claim.echo))).toEqual(new Set(echoes.map((line) => line.id)));
  for (const echo of echoes) {
    expect(echo.count).toBeGreaterThan(0);
    expect(echo.who?.length).toBeGreaterThan(0);
  }
});

it('closes each day at 23:00 with a short summary and a question', () => {
  const g = newGame(7);
  for (let day = 1; day <= 3; day++) {
    advance(g, (day - 1) * 1440 + 1365);
    expect(g.s.days ?? []).toHaveLength(day - 1);
    advance(g, (day - 1) * 1440 + 1380);
    expect(g.s.days).toHaveLength(day);
    const closing = g.s.days!.at(-1)!;
    expect(closing.day).toBe(day);
    expect(closing.summary.length).toBeGreaterThanOrEqual(2);
    expect(closing.summary.length).toBeLessThanOrEqual(4);
    expect(closing.summary.every((text) => text.trim().length > 0)).toBe(true);
    expect(closing.question.trim().length).toBeGreaterThan(10);
    expect(closing.question).toContain('?');
    expect(g.s.log.findLast((line) => line.kind === 'day')?.at).toBe((day - 1) * 1440 + 1380);
    advance(g, day * 1440 + 360);
    expect(g.s.days).toHaveLength(day);
  }
});

it('reports acceptance and rejection from the listener’s actual knowledge', () => {
  const g = newGame(7);
  g.s.locations.ayse = 'garden';
  confirm(g.s.people.ayse!, 'emre:honest', true, g.s.minute);
  confirm(g.s.people.ayse!, 'emre:dishonest', false, g.s.minute);
  expect(act(g, { type: 'tell', listener: 'ayse', target: 'emre', trait: 'honest' })).toBe(true);
  expect(replyTo(g, 0)?.reply?.believes).toBe('yes');
  expect(act(g, { type: 'tell', listener: 'ayse', target: 'emre', trait: 'dishonest' })).toBe(true);
  expect(replyTo(g, 1)?.reply?.believes).toBe('no');
  expect(credence(g.s.people.ayse!, 'emre:honest')).toBeGreaterThan(0.9);
});

it('reports doubt when the listener lacks knowledge and distrusts the source', () => {
  const g = newGame(7);
  g.s.locations.ayse = 'garden';
  g.s.people.ayse!.memory.sourceTrust.hatice = 0;
  expect(act(g, { type: 'tell', listener: 'ayse', target: 'emre', trait: 'generous' })).toBe(true);
  const reply = replyTo(g, 0);
  expect(reply?.reply?.believes).toBe('doubt');
  expect(reply?.reply?.will?.trim().length).toBeGreaterThan(0);
  expect(reply?.text).toContain(reply?.reply?.will);
});

it('distinguishes refusing to spread damaging talk from failing to hear it', () => {
  const g = newGame(7);
  advance(g, 405);
  g.s.locations.fatma = 'garden';
  g.s.locations.kemal = 'grocer';
  expect(act(g, { type: 'tell-story', listener: 'fatma', incident: 1 })).toBe(true);
  expect(replyTo(g, 0)?.reply?.believes).toBe('refuse');
  expect(credence(g.s.people.fatma!, 'kemal:dishonest')).toBeGreaterThan(0.5);
});

it('keeps Rıza’s last words accurate whenever he gives Hatice a changed answer', () => {
  const g = newGame(7);
  g.s.locations.riza = 'garden';
  const initial = g.s.riza!.line;
  let distrust = '';
  for (const [index, trust] of [0.2, 0.9, 0.2, 0.9, 0.2].entries()) {
    advance(g, 361 + index);
    g.s.people.riza!.memory.sourceTrust.hatice = trust;
    expect(act(g, { type: 'call-over', person: 'riza' })).toBe(true);
    if (index === 0) {
      distrust = g.s.riza!.line;
      expect(distrust).not.toBe(initial);
    }
    expect(g.s.riza?.line).toBe(trust < 0.6 ? distrust : initial);
    expect(g.s.riza?.at).toBe(g.s.minute);
    if (trust < 0.6) expect(g.s.riza?.lean).toBe('cool');
  }
  const spoken = g.s.log.filter((line) => line.kind === 'riza');
  expect(spoken.at(-1)?.text).toBe(g.s.riza?.line);
  expect(spoken.length).toBeGreaterThan(0);
});

it('continues old version-one saves that lack the optional story and day fields', () => {
  const old = newGame(7);
  delete old.s.riza;
  delete old.s.stories;
  delete old.s.days;
  const g = load(save(old));
  advance(g, 405);
  expect(g.s.stories).toContainEqual(expect.objectContaining({ id: 1, day: 1 }));
  expect(act(g, { type: 'tell-story', listener: 'aylin', incident: 1 })).toBe(true);
  expect(replyTo(g, 0)).toBeDefined();
  advance(g, 1380);
  expect(g.s.days).toHaveLength(1);
  expect(g.s.riza?.answerDay).toBe(13);
});

it('builds the day summary only from answers and events Hatice can see', () => {
  const g = newGame(7);
  advance(g, 405);
  expect(act(g, { type: 'tell-story', listener: 'aylin', incident: 1 })).toBe(true);
  advance(g, 1380);
  const closing = g.s.days!.at(-1)!;
  const visible = g.s.log.filter((line) =>
    ['reply', 'cold-greeting', 'shop', 'confrontation', 'truth', 'overheard', 'riza', 'engagement'].includes(
      line.kind,
    ),
  );
  for (const summary of closing.summary) {
    expect(visible.some((line) => summary.includes(line.text))).toBe(true);
  }
});
