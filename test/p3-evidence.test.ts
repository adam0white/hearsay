import { credence } from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import { act, advance, newGame } from '../src/sim/game.ts';

it('a witnessed story persuades more strongly than the matching trait word', () => {
  const word = newGame(2);
  const story = newGame(2);
  for (const g of [word, story]) advance(g, 405);
  expect(act(word, { type: 'tell', listener: 'ayse', target: 'kemal', trait: 'dishonest' })).toBe(true);
  expect(act(story, { type: 'tell-story', listener: 'ayse', incident: 1 })).toBe(true);
  expect(credence(story.s.people.ayse!, 'kemal:dishonest')).toBeGreaterThan(
    credence(word.s.people.ayse!, 'kemal:dishonest'),
  );
  expect(story.s.log.findLast((l) => l.kind === 'reply')?.text).toMatch(/flour|label/);
});

it('keeps the incident title on relays and confirms a true story on later evidence', () => {
  const g = newGame(3);
  advance(g, 405);
  // Round-five table scenes change this seed’s incidental flour meetings.
  // Cem is willing to relay the account before the later public confirmation.
  g.s.locations.cem = 'garden';
  act(g, { type: 'tell-story', listener: 'cem', incident: 1 });
  const root = g.s.routes.findLast((r) => r.from === 'hatice')!;
  expect(root?.title).toBe('The flour');
  advance(g, 14 * 1440);
  expect(g.s.routes.some((r) => r.parent && r.incident === 1 && r.title === 'The flour')).toBe(true);
  expect(g.s.routes.some((r) => r.incident === 1 && r.confirmedAt !== undefined)).toBe(true);
});

it('does not confirm a distorted story from evidence of the original incident', () => {
  const g = newGame(9);
  advance(g, 405);
  act(g, { type: 'tell-story', listener: 'ayse', incident: 1 });
  const route = g.s.routes.findLast((r) => r.from === 'hatice')!;
  route.trait = 'cruel';
  advance(g, 1440 + 1020);
  expect(route.confirmedAt).toBeUndefined();
});

it('a summary cannot turn a remote shop log into something Hatice saw', () => {
  const g = newGame(9);
  advance(g, 1365);
  g.s.log.push({
    id: g.s.log.length + 1,
    at: 1365,
    kind: 'shop',
    text: 'Private shop fact behind a closed door.',
  });
  advance(g, 1380);
  expect(g.s.days?.[0]?.summary.join(' ')).not.toContain('Private shop fact');
});

it('promises to change shops only when the listener can change that shopping visit', () => {
  const employee = newGame(3);
  const shopper = newGame(3);
  for (const g of [employee, shopper]) advance(g, 405);
  employee.s.locations.murat = 'garden';
  expect(act(employee, { type: 'tell-story', listener: 'murat', incident: 1 })).toBe(true);
  expect(employee.s.log.findLast((l) => l.kind === 'reply')?.reply?.will).not.toMatch(/flour elsewhere/);
  expect(act(shopper, { type: 'tell-story', listener: 'ayse', incident: 1 })).toBe(true);
  expect(shopper.s.log.findLast((l) => l.kind === 'reply')?.reply?.will).toMatch(/flour elsewhere/);
  advance(shopper, 480);
  expect(shopper.s.locations.ayse).toBe('bakery');
});
