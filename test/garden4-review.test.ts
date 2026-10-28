import { DEFAULT_NORMS } from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import { advanceGarden, chooseGarden, freshGarden, gardenAuthors } from '../src/sim/garden4.ts';
import { exportGarden, importGarden } from '../src/sim/garden4-export.ts';

it('offers the next ordinary task after genuine completion instead of losing a quarter-hour', () => {
  const garden = freshGarden(17);
  advanceGarden(garden, 407);
  const checkpoint = exportGarden(garden).state.engine;
  if (!checkpoint) throw new Error('Missing checkpoint');
  const completed = checkpoint.archive.history
    .flatMap((transaction) => transaction.inputs)
    .flatMap((input) =>
      input.kind === 'action.resolved' &&
      input.payload.person === 'riza' &&
      input.payload.outcome?.status === 'completed'
        ? [input.payload.outcome]
        : [],
    );
  expect(completed.length).toBeGreaterThanOrEqual(2);
  for (const outcome of completed) expect(outcome.end - outcome.start).toBe(15 * 60000);
  const first = completed[0],
    second = completed[1];
  if (!first || !second) throw new Error('Missing successive outcomes');
  expect(second.start).toBeGreaterThanOrEqual(first.end);
  expect(second.start - first.end).toBeLessThanOrEqual(60000);
});

it('does not deliver a statement refused under Hatice’s actual held prohibition', () => {
  const garden = freshGarden(17);
  advanceGarden(garden, 400);
  expect(
    garden.people.hatice.memory.beliefs.find((belief) => belief.prop === 'osman:honest')?.logOdds,
  ).toBeLessThan(-1);
  expect(chooseGarden(garden, { type: 'defend', person: 'riza', about: 'osman', trait: 'honest' })).toBe(
    true,
  );
  expect(
    garden.routes.filter(
      (route) => route.from === 'hatice' && route.to === 'riza' && route.prop === 'osman:honest',
    ),
  ).toEqual([]);
  expect(garden.log.some((entry) => entry.kind === 'refusal' && entry.person === 'hatice')).toBe(true);
  const checkpoint = exportGarden(garden).state.engine;
  const speaker = checkpoint?.archive.current.people.hatice;
  if (!speaker) throw new Error('Missing speaker checkpoint');
  expect(speaker.conscience.breaches.some((breach) => breach.normId === 'lying')).toBe(false);
  expect(speaker.conscience.norms.find((norm) => norm.normId === 'lying')?.conviction).toBe(0.8);
  expect(importGarden(JSON.stringify(exportGarden(garden)))).toEqual(garden);
});

it('records actual contrary speech under a sourced weaker held norm before delivering its claim', () => {
  // Explicit engineering fixture: a different conviction, with the released source attribution intact.
  const authors = gardenAuthors();
  const held = authors
    .find((person) => person.id === 'hatice')
    ?.state.heldNorms.find((norm) => norm.normId === 'lying');
  if (!held) throw new Error('Missing authored norm');
  held.conviction = 0.2;
  const garden = freshGarden(17, authors);
  advanceGarden(garden, 400);
  expect(chooseGarden(garden, { type: 'defend', person: 'riza', about: 'osman', trait: 'honest' })).toBe(
    true,
  );
  const checkpoint = exportGarden(garden).state.engine;
  if (!checkpoint) throw new Error('Missing checkpoint');
  const hatice = checkpoint.archive.current.people.hatice;
  if (!hatice) throw new Error('Missing speaker checkpoint');
  const conscience = hatice.conscience;
  expect(conscience.breaches.some((breach) => breach.normId === 'lying' && !breach.repaired)).toBe(true);
  expect(conscience.norms.find((norm) => norm.normId === 'lying')?.provenance).toEqual(
    DEFAULT_NORMS.find((norm) => norm.id === 'lying')?.provenance,
  );
  const inputs = checkpoint.archive.history.flatMap((transaction) => transaction.inputs);
  const spoken = inputs.findIndex(
    (input) =>
      input.kind === 'action.resolved' &&
      input.payload.person === 'hatice' &&
      input.payload.outcome?.actionId === 'tell' &&
      input.payload.outcome.status === 'completed',
  );
  const heard = inputs.findIndex(
    (input) =>
      input.kind === 'testimony.received' &&
      input.payload.teller === 'hatice' &&
      input.payload.person === 'riza',
  );
  expect(spoken).toBeGreaterThanOrEqual(0);
  expect(heard).toBeGreaterThan(spoken);
  expect(importGarden(JSON.stringify(exportGarden(garden)))).toEqual(garden);
});

it('records absent-person speech using the sourced backbiting norm without inventing a belief', () => {
  const authors = gardenAuthors();
  const held = authors
    .find((person) => person.id === 'hatice')
    ?.state.heldNorms.find((norm) => norm.normId === 'backbiting');
  if (!held) throw new Error('Missing authored norm');
  held.conviction = 0.2;
  const garden = freshGarden(17, authors);
  advanceGarden(garden, 790);
  expect(
    garden.people.hatice.memory.beliefs.find((belief) => belief.prop === 'dilan:honest'),
  ).toBeUndefined();
  expect(chooseGarden(garden, { type: 'tell', person: 'riza', about: 'dilan', trait: 'honest' })).toBe(true);
  const checkpoint = exportGarden(garden).state.engine;
  if (!checkpoint) throw new Error('Missing checkpoint');
  const hatice = checkpoint.archive.current.people.hatice;
  if (!hatice) throw new Error('Missing speaker checkpoint');
  const conscience = hatice.conscience;
  expect(conscience.breaches.some((breach) => breach.normId === 'backbiting')).toBe(true);
  expect(conscience.breaches.some((breach) => breach.normId === 'lying')).toBe(false);
});
