import { expect, it } from 'vitest';
import { freshGarden } from '../src/sim/garden.ts';
import { departureReason, prepareGardenDeparture } from '../src/sim/garden-departure.ts';

it('keeps unfinished duties and the complete source prefix instead of clearing them for travel', () => {
  const g = freshGarden(17);
  expect(departureReason(g, 'derya')).toContain('relief');
  expect(departureReason(g, 'hatice')).toContain('cover');
  const before = structuredClone(g.people.riza);
  // Mechanism control: isolate chapter-boundary validation from the fortnight simulation.
  g.ended = true;
  g.minute = 20160;
  const d = prepareGardenDeparture(g, 'riza');
  expect(d.person).toEqual(before);
  expect(d.sourcePrefix).toEqual(g);
  expect(g.people.riza).toEqual(before);
});
