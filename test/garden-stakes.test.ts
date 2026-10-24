import { expect, it } from 'vitest';
import { advanceGarden, chooseGarden, freshGarden, replayGarden } from '../src/sim/garden.ts';

it('requires paid agreements and delivers an earned lunch rather than a discovery tally', () => {
  const g = freshGarden(17);
  advanceGarden(g, 3 * 1440 + 720);
  expect(g.lunch.pending).toBe('trial');
  const before = g.lunch.cash;
  expect(chooseGarden(g, { type: 'plan', choice: 'paid-trial' })).toBe(true);
  expect(g.lunch.cash).toBeLessThan(before);
  advanceGarden(g, 7 * 1440 + 720);
  expect(chooseGarden(g, { type: 'plan', choice: 'paid-prep' })).toBe(true);
  advanceGarden(g, 9 * 1440 + 790);
  for (const person of ['nermin', 'aylin', 'riza'] as const) {
    chooseGarden(g, { type: 'defend', person, about: 'osman', trait: 'honest' });
    chooseGarden(g, { type: 'reserve', person });
  }
  advanceGarden(g, 12 * 1440 + 780);
  expect(g.lunch.result).toBe('open');
  expect(g.lunch.served.length).toBeGreaterThanOrEqual(4);
  expect(g.lunch.bread && g.lunch.produce && g.lunch.cook).toBe(true);
  expect(replayGarden(g.seed, g.inputs, g.minute)).toEqual(g);
});
it('a skipped agreement cannot become a successful lunch from a confidence count', () => {
  const g = freshGarden(17);
  advanceGarden(g, 12 * 1440 + 780);
  expect(g.lunch.result).toBe('cancelled');
  expect(g.lunch.served).toEqual([]);
});

it('traces a contradicted rumour to an actual confrontation and loses customers when stood by', () => {
  const g = freshGarden(17);
  advanceGarden(g, 400);
  expect(chooseGarden(g, { type: 'tell', person: 'aylin', about: 'riza', trait: 'reliable' })).toBe(true);
  advanceGarden(g, 5 * 1440 + 420);
  expect(g.lunch.confrontations.some((c) => c.person === 'riza' && !c.resolved)).toBe(true);
  const repaired = structuredClone(g);
  expect(chooseGarden(repaired, { type: 'confront', person: 'riza', choice: 'own' })).toBe(true);
  expect(chooseGarden(g, { type: 'confront', person: 'riza', choice: 'stand' })).toBe(true);
  const before = g.lunch.takings;
  advanceGarden(g, 5 * 1440 + 800);
  advanceGarden(repaired, 5 * 1440 + 800);
  expect(g.lunch.takings).toBe(before);
  expect(repaired.lunch.takings).toBeGreaterThan(g.lunch.takings);
  expect(g.lunch.closedUntil).toBeGreaterThan(g.minute);
});

it('never invents paid preparation or reveals Ece’s private map on the no-agreement branch', () => {
  const g = freshGarden(17);
  advanceGarden(g, 12 * 1440 + 400);
  expect(g.lunch.prep).toBe('cancelled');
  expect(g.log.some((l) => l.text.includes('keeps the agreed preparation appointment'))).toBe(false);
  expect(g.discoveries.ece).toBeUndefined();
  expect(g.benchFree).toBe(false);
  expect(g.log.some((l) => l.text.includes('workers’ map'))).toBe(false);
});
