import { describe, expect, it } from 'vitest';
import { act, advance, fingerprint, load, newGame, replay, save } from '../src/sim';

describe('deterministic fortnight', () => {
  it('replays inputs and saves exactly', () => {
    const g = newGame(42);
    advance(g, 405);
    act(g, { type: 'tell', listener: 'fatma', target: 'kemal', trait: 'dishonest' });
    advance(g, 14 * 1440);
    expect(fingerprint(replay(42, g.inputs, g.s.minute).s)).toBe(fingerprint(g.s));
    expect(fingerprint(load(save(g)).s)).toBe(fingerprint(g.s));
    expect(g.s.ended).toBe(true);
    expect(Object.keys(g.s.people)).toHaveLength(32);
    expect(g.s.routes.every((r) => r.steps <= 2)).toBe(true);
  });
});

import { believe, confirm, converse, credence, relationshipWith, trustOf } from '@adam0white/human-framework';
import { runPolicy } from '../scripts/policy';

it('forbidden backbiting refuses while permitted can relay', () => {
  const g = newGame(1);
  advance(g, 405);
  act(g, { type: 'tell', listener: 'fatma', target: 'kemal', trait: 'dishonest' });
  const refusal = converse(g.s.people.fatma!, g.s.people.emre!, { at: 405, topics: ['kemal'] });
  expect(refusal.withheld.some((w) => w.reason === 'norm:backbiting')).toBe(true);
  expect(g.s.log.some((l) => l.kind === 'refusal')).toBe(true);
});
it('confirmation reduces source trust after a lie', () => {
  const g = newGame(8);
  advance(g, 405);
  act(g, { type: 'tell', listener: 'ayse', target: 'kemal', trait: 'cruel' });
  const p = g.s.people.ayse!;
  const before = trustOf(p, 'hatice');
  confirm(p, 'kemal:cruel', false, g.s.minute);
  expect(trustOf(p, 'hatice')).toBeLessThan(before);
  expect(credence(p, 'kemal:cruel')).toBeLessThan(0.1);
});
it('both engagement outcomes arise from visible policies', () => {
  expect(runPolicy(42, 'careful-relay').s.engagement).toBe('accepted');
  expect(runPolicy(42, 'quiet').s.engagement).toBe('refused');
  expect(runPolicy(42, 'reckless').s.engagement).toBe('refused');
});
it('minute-sized advances reach scripted events and replay', () => {
  const g = newGame(4);
  for (let i = 361; i <= 405; i++) advance(g, i);
  expect(g.s.newsWaiting).toBe(true);
  expect(g.s.log.some((l) => l.kind === 'overheard')).toBe(true);
  expect(fingerprint(g.s)).toBe(fingerprint(replay(4, [], 405).s));
});
it('seeded relays retain bounded ancestry', () => {
  const g = newGame(3);
  advance(g, 405);
  act(g, { type: 'tell', listener: 'ayse', target: 'emre', trait: 'lazy' });
  advance(g, 14 * 1440);
  expect(g.s.routes.length).toBeGreaterThan(1);
  expect(g.s.routes.every((r) => r.steps <= 2)).toBe(true);
  expect(g.s.routes.some((r) => r.steps > 0 && r.parent)).toBe(true);
});
it('amends change belief and standing; hold-tongue cannot be farmed', () => {
  const g = newGame(2);
  advance(g, 405);
  act(g, { type: 'tell', listener: 'ayse', target: 'emre', trait: 'dishonest' });
  const p = g.s.people.ayse!;
  const before = credence(p, 'emre:dishonest');
  const trust = trustOf(p, 'hatice');
  act(g, { type: 'make-amends', listener: 'ayse', target: 'emre' });
  expect(credence(p, 'emre:dishonest')).toBeLessThan(before);
  expect(trustOf(p, 'hatice')).toBeLessThan(trust);
  expect(act(g, { type: 'hold-tongue' })).toBe(false);
});
it('cold greetings follow a confident damaging belief, including spontaneous testimony', () => {
  const quiet = newGame(8);
  advance(quiet, 420);
  for (const greeting of quiet.s.log.filter((l) => l.kind === 'cold-greeting'))
    expect(credence(quiet.s.people[greeting.speaker!]!, `${greeting.target}:dishonest`)).toBeGreaterThan(0.6);
  const told = newGame(8);
  advance(told, 405);
  act(told, { type: 'tell', listener: 'fatma', target: 'kemal', trait: 'dishonest' });
  advance(told, 420);
  expect(told.s.log.some((l) => l.kind === 'cold-greeting')).toBe(true);
});
it('buying silence uses call-over and changes custom and source trust', () => {
  const g = newGame(8);
  advance(g, 405);
  const before = g.s.custom.hatice!;
  expect(act(g, { type: 'call-over', person: 'ayse', buySilence: true })).toBe(true);
  expect(g.s.silence.ayse).toBeGreaterThan(g.s.minute);
  expect(g.s.custom.hatice).toBeLessThan(before);
});

import { receiveTestimony } from '../src/sim/testimony.ts';

it('a more trusted contradictory speaker reduces the earlier source standing', () => {
  const g = newGame(1);
  advance(g, 405);
  act(g, { type: 'tell', listener: 'fatma', target: 'kemal', trait: 'cruel' });
  const p = g.s.people.fatma!;
  p.memory.sourceTrust.emre = 0.98;
  const before = trustOf(p, 'hatice');
  receiveTestimony(p, [
    {
      at: 405,
      channel: 'told',
      kind: 'testimony',
      actorId: 'emre',
      salience: 1,
      claims: [{ prop: 'kemal:cruel', value: false, confidence: 0.95 }],
      summary: 'Emre contradicts the claim',
    },
  ]);
  expect(trustOf(p, 'hatice')).toBeLessThan(before);
});
it('defending a debt negates it and amends record the withdrawn claim', () => {
  const g = newGame(1);
  advance(g, 405);
  act(g, { type: 'tell', listener: 'ayse', target: 'emre', trait: 'owes' });
  act(g, { type: 'defend', listener: 'ayse', target: 'emre', trait: 'owes' });
  expect(g.s.routes.at(-1)?.value).toBe(false);
  act(g, { type: 'make-amends', listener: 'ayse', target: 'emre' });
  expect(g.s.log.at(-1)?.text).toMatch(/debt|money/);
  expect(g.s.routes.some((r) => r.retractionOf)).toBe(true);
});
it('targets trace a real co-present recipient and confront the source only once', () => {
  const g = newGame(3);
  advance(g, 405);
  act(g, { type: 'tell', listener: 'fatma', target: 'emre', trait: 'dishonest' });
  advance(g, 1080);
  expect(g.s.log.some((l) => l.kind === 'confrontation' && l.speaker === 'emre')).toBe(true);
  const roots = [...g.s.confronted];
  advance(g, 1080 + 1440);
  expect(g.s.confronted.filter((id) => roots.includes(id))).toHaveLength(roots.length);
  expect(g.s.closedUntil).toBeGreaterThan(1080);
});
it('customers change their actual shop appointment after hearing damaging testimony', () => {
  const quiet = newGame(3);
  advance(quiet, 480);
  expect(quiet.s.locations.safiye).toBe('grocer');
  const g = newGame(3);
  advance(g, 405);
  act(g, { type: 'tell', listener: 'safiye', target: 'kemal', trait: 'dishonest' });
  advance(g, 480);
  expect(g.s.locations.safiye).toBe('bakery');
});

it('a listener cannot see the private lying deed', () => {
  const lied = newGame(3),
    believed = newGame(3);
  advance(lied, 405);
  advance(believed, 405);
  believe(believed.s.people.hatice!, 'emre:lazy', true, 0.9, 'hatice', 405);
  act(lied, { type: 'tell', listener: 'ayse', target: 'emre', trait: 'lazy' });
  act(believed, { type: 'tell', listener: 'ayse', target: 'emre', trait: 'lazy' });
  expect(lied.s.routes.at(-1)?.lie).toBe(true);
  expect(believed.s.routes.at(-1)?.lie).toBe(false);
  expect(relationshipWith(lied.s.people.ayse!, 'hatice').trust).toBeCloseTo(
    relationshipWith(believed.s.people.ayse!, 'hatice').trust,
    10,
  );
});
it('Rıza and Emre come to the garden for the visible engagement decision', () => {
  const g = newGame(9);
  advance(g, 12 * 1440 + 1200);
  expect(g.s.engagement).not.toBe('waiting');
  expect(g.s.locations.riza).toBe('garden');
  expect(g.s.locations.emre).toBe('garden');
});
it('paid silence costs actual garden occupancy', () => {
  const g = newGame(9);
  advance(g, 405);
  for (let i = 0; i < 6; i++) act(g, { type: 'call-over', person: 'ayse', buySilence: true });
  advance(g, 420);
  expect(g.s.garden).toBe('empty');
});

it('a scripted bot fortnight is deterministic and replays its full input history', () => {
  const a = runPolicy(13, 'careful');
  const b = runPolicy(13, 'careful');
  expect(a.inputs.length).toBeGreaterThan(100);
  expect(a.s.ended).toBe(true);
  expect(fingerprint(a.s)).toBe(fingerprint(b.s));
  expect(fingerprint(replay(13, a.inputs, a.s.minute).s)).toBe(fingerprint(a.s));
});
it('resumes the exact HF loop after saving between quarter-hour steps', () => {
  const a = newGame(43);
  advance(a, 407);
  act(a, { type: 'ask', listener: 'fatma', target: 'kemal' });
  advance(a, 563);
  const b = load(save(a));
  advance(a, 3000);
  advance(b, 3000);
  expect(fingerprint(a.s)).toBe(fingerprint(b.s));
  expect(fingerprint(a.s)).toBe(fingerprint(replay(43, a.inputs, a.s.minute).s));
});

it('the helpful act seen from the garden becomes Hatice’s own evidence', () => {
  const g = newGame(8);
  advance(g, 765);
  expect(credence(g.s.people.hatice!, 'kemal:kind')).toBeGreaterThan(0.9);
  expect(credence(g.s.people.hatice!, 'kemal:cruel')).toBeLessThan(0.1);
});
it('confrontations have consequences when a neighbour, rather than Hatice, started the story', () => {
  const g = newGame(3);
  advance(g, 1080);
  const root = g.s.routes.find((r) => g.s.confronted.includes(r.id) && r.from !== 'hatice');
  expect(root).toBeDefined();
  expect(root?.confrontedAt).toBe(1080);
});
it('later damage changes a greeting at the fountain beyond the scripted opening', () => {
  const g = newGame(3);
  advance(g, 720);
  act(g, { type: 'tell', listener: 'selma', target: 'emre', trait: 'dishonest' });
  advance(g, 735);
  expect(g.s.log.some((l) => l.kind === 'cold-greeting' && l.target === 'emre')).toBe(true);
});

it('Ask reports a confident negative belief rather than claiming ignorance', () => {
  const g = newGame(7);
  advance(g, 405);
  confirm(g.s.people.fatma!, 'kemal:cruel', false, 405);
  act(g, { type: 'ask', listener: 'fatma', target: 'kemal' });
  expect(g.s.log.at(-1)?.text).toMatch(/treats people well|doesn’t go out of their way to hurt people/);
});
