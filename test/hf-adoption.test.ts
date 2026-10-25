import { expect, it } from 'vitest';
import { advanceGarden, freshGarden } from '../src/sim/garden.ts';
import { GARDEN_IDS, gardenOpening } from '../src/sim/garden-cast.ts';
import { exportGarden, importGarden } from '../src/sim/garden-export.ts';

it('opts fresh canonical people into persisted plain narration and pins that choice through replay', () => {
  const run = freshGarden(17);
  for (const id of GARDEN_IDS) {
    expect(run.people[id].lexicon).toMatchObject({ plainEnglish: true });
    expect(run.initialPeople[id].lexicon).toMatchObject({ plainEnglish: true });
    expect(run.people[id].engine).toBe('2.21.0');
  }
  advanceGarden(run, 420);
  expect(importGarden(JSON.stringify(exportGarden(run)))).toEqual(run);
});
it('retains an admitted person’s saved narration choice without rewriting it during replay', () => {
  const person = gardenOpening('riza', 17);
  person.lexicon = { names: { hatice: 'Hatice' } };
  const run = freshGarden(17, { riza: person });
  advanceGarden(run, 420);
  expect(run.people.riza.lexicon).toEqual(person.lexicon);
  expect(importGarden(JSON.stringify(exportGarden(run)))).toEqual(run);
});

it('admits an actual HF 2.21 Voice constructor checkpoint and refuses altered source stamps or mapping', async () => {
  const { readFileSync } = await import('node:fs');
  const { createPersona, preparePersonaLife, canonicalPersona } = await import('@adam0white/lab-client');
  const { snapshot } = await import('@adam0white/human-framework');
  const { admitGardenPerson } = await import('../src/sim/garden-continuity.ts');
  const fixture = JSON.parse(
    readFileSync(new URL('./fixtures/voice-hf221-riza.json', import.meta.url), 'utf8'),
  );
  const head = fixture.head;
  expect(head.source.engine).toBe('2.21.0');
  expect(head.transfer.person.person.source.engine).toBe('2.21.0');
  const digest = Buffer.from(
    await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(canonicalPersona(snapshot(fixture.source))),
    ),
  ).toString('hex');
  expect(digest).toBe(head.transfer.checkpoint.sha256);
  const admitted = admitGardenPerson(preparePersonaLife(head, 0), 17);
  expect(admitted.id).toBe('riza');
  // The finite portable dialect carries no source lexicon. This is a new host Person.
  expect(admitted.lexicon).toEqual({ plainEnglish: true });
  expect(admitted.traits).toEqual(fixture.source.traits);
  const run = freshGarden(17, { riza: admitted });
  advanceGarden(run, 420);
  expect(importGarden(JSON.stringify(exportGarden(run)))).toEqual(run);
  for (const mutate of [
    (body: typeof head) => {
      body.source.engine = '2.99.0';
    },
    (body: typeof head) => {
      body.source.engine = '2.17.0';
    },
    (body: typeof head) => {
      body.transfer.person.person.mappingVersion = 'other/1';
    },
    (body: typeof head) => {
      body.transfer.sourceRole = 'osman';
    },
  ]) {
    const { revision: _, ...body } = structuredClone(head);
    mutate(body);
    const altered = await createPersona(body);
    expect(() => admitGardenPerson(preparePersonaLife(altered, 0), 17)).toThrow();
  }
});

it('opts current historical-shell constructors in while keeping immutable legacy replay inputs', async () => {
  const { newGame } = await import('../src/sim/game.ts');
  const { makeDilanOpening } = await import('../src/sim/one-cast.ts');
  for (const person of Object.values(newGame(17).s.people))
    expect(person.lexicon).toMatchObject({ plainEnglish: true });
  expect(makeDilanOpening(17).lexicon).toMatchObject({ plainEnglish: true });
  for (const person of Object.values(newGame(17, 1).s.people))
    expect(person.lexicon?.plainEnglish).toBeUndefined();
});

it('supplies the previously clipped HF package lines as sentences for the opted-in cast', async () => {
  const { linesFor } = await import('@adam0white/human-framework');
  const lexicon = freshGarden(17).people.hatice.lexicon;
  expect(linesFor('need:food', lexicon)).toContain('My stomach is growling. I will eat first.');
  expect(linesFor('need:autonomy', lexicon)).toContain('I want to make my own choice this time.');
  expect(linesFor('source:habit', lexicon)).toContain('I am doing what I always do.');
});
