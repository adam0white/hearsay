import { expect, it } from 'vitest';
import { freshGarden } from '../src/sim/garden4.ts';
import { gardenReadings } from '../src/ui/garden-readings.ts';

it('does not present unobserved people as known', () => {
  const garden = freshGarden(17);
  expect(gardenReadings(garden, 'derya')).toEqual([
    "Hatice has not noticed enough to describe Derya's condition.",
  ]);
});

it('reads Hatice live and uses words instead of measurements', () => {
  const garden = freshGarden(17);
  const people = structuredClone(garden.initialPeople);
  const hatice = people.find((person) => person.id === 'hatice');
  if (!hatice) throw new Error('Missing Hatice');
  hatice.state.affect.mood.valence = -0.8;
  const altered = freshGarden(17, people);
  const after = gardenReadings(altered, 'hatice');
  expect(after).not.toEqual(gardenReadings(garden, 'hatice'));
  expect(after.length).toBeGreaterThan(0);
  expect(after.join(' ')).not.toMatch(/\d|fatigue|urgency|valence/);
});

it('shows only Hatice’s learned expectations using familiar action names', () => {
  const garden = freshGarden(17);
  const people = structuredClone(garden.initialPeople);
  const hatice = people.find((person) => person.id === 'hatice');
  const derya = people.find((person) => person.id === 'derya');
  if (!hatice || !derya) throw new Error('Missing people');
  hatice.state.expectations = [
    { key: 'work-market', needs: {}, successRate: 0.9, samples: 2, valence: 0 },
    {
      key: 'unknown-secret',
      needs: {},
      successRate: 0.9,
      samples: 2,
      valence: 0,
    },
  ];
  derya.state.expectations = [{ key: 'eat', needs: {}, successRate: 0.9, samples: 2, valence: 0 }];
  const altered = freshGarden(17, people);
  expect(gardenReadings(altered, 'hatice')).toContain('You expect working at the market to go well.');
  expect(gardenReadings(altered, 'hatice').join(' ')).not.toContain('unknown-secret');
  expect(gardenReadings(altered, 'derya').join(' ')).not.toContain('eating');
});
