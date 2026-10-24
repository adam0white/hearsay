import { expect, it } from 'vitest';
import { freshGarden, gardenHere } from '../src/sim/garden.ts';
import { GARDEN_IDS } from '../src/sim/garden-cast.ts';
import { stakesStep, wantsLunch } from '../src/sim/garden-stakes.ts';
import { gardenEnglish } from '../src/ui/garden-english.ts';

it('does not infer unwilling customers from a short lunch when willing customers are absent', () => {
  const run = freshGarden(17);
  run.minute = 12 * 1440 + 780;
  Object.assign(run.lunch, {
    breadDelivered: true,
    produceDelivered: true,
    cook: true,
    prepared: true,
    reservations: ['derya'],
    // Mechanism control: separate willingness from presence without changing beliefs.
    avoidingUntil: Object.fromEntries(GARDEN_IDS.map((id) => [id, run.minute + 60])),
  });
  expect(wantsLunch(run, 'derya')).toBe(true);
  expect(gardenHere(run, 'derya')).toBe(false);
  stakesStep(run, (id) => gardenHere(run, id));
  expect(run.lunch.result).toBe('short');
  expect(run.lunch.served).toEqual([]);
  const before = JSON.stringify(run);
  expect(gardenEnglish(run.lunch.reason ?? '')).toBe(
    'The food is ready, but too few customers come. The lunch loses money.',
  );
  expect(JSON.stringify(run)).toBe(before);
});
it.each([
  ['Derya', 'Derya reserves one meal'],
  ['Rıza', 'Rıza reserves one meal'],
  ['Derya, Rıza', 'Derya, Rıza reserve a meal each'],
  ['Derya, Aylin, Rıza', 'Derya, Aylin, Rıza reserve a meal each'],
])('uses the correct reservation verb for %s without rewriting saved text', (names, expected) => {
  const stored = `${names} reserve their own meal, on the stated supplier and cooking terms. Reservations may change if new evidence reaches them.`;
  expect(gardenEnglish(stored)).toContain(expected);
  expect(stored).toContain('reserve their own meal');
});
it.each([
  ['Derya', 'Derya actually sits down and pays'],
  ['Rıza', 'Rıza actually sits down and pays'],
  ['Derya, Rıza', 'Derya, Rıza actually sit down and pay'],
  ['Derya, Aylin, Rıza', 'Derya, Aylin, Rıza actually sit down and pay'],
])('uses the correct served-meal verbs for %s', (names, expected) => {
  const stored = `The paid lunch opens. The meals cover the sample, paid preparation and food cost. ${names} actually sit down and pay for their meal.`;
  expect(gardenEnglish(stored)).toContain(expected);
  expect(stored).toContain('actually sit down and pay');
});
