import {
  createPerson,
  createRun,
  exportRun,
  type Result,
  type RunArchive,
  type RunSpec,
} from '@adam0white/human-framework';
import type { LifeBatchPreparation } from '@adam0white/lab-client';
import { expect, it, vi } from 'vitest';

// Exercise the retained-history bridge independently of the live deployment gate.
vi.mock('@adam0white/lab-client', async (original) => ({
  ...(await original<typeof import('@adam0white/lab-client')>()),
  portableWriteBlockers: () => [],
}));

import { GARDEN_ENGINE } from '../src/sim/garden-engine.ts';
import {
  converseGarden,
  decideGardenAction,
  gardenEvidence,
  gardenEvidenceId,
} from '../src/sim/garden-hf4.ts';
import { advanceGarden, freshGarden, gardenAuthors, refreshGarden, sessionOf } from '../src/sim/garden4.ts';
import { admitGardenBatch, captureGardenSource } from '../src/sim/garden4-continuity.ts';

import { freshEmptyShelfGarden } from './helpers/garden-empty-opening.ts';

const need = <T>(result: Result<T>): T => {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};
const present = <T>(value: T | undefined): T => {
  if (value === undefined) throw new Error('Missing fixture evidence');
  return value;
};

// An actual public Run at the final 31 minutes, not a played preceding fortnight.
function endingFixture() {
  const g = structuredClone(freshEmptyShelfGarden(17));
  const original = sessionOf(freshGarden(17));
  const spec = structuredClone(exportRun(original.run).initial.spec) as RunSpec;
  const start = 20129 * 60000;
  spec.start = start;
  const run = need(createRun(spec));
  for (const author of gardenAuthors()) {
    author.state.body.since = start;
    need(createPerson(run, author));
  }
  g.minute = 20129;
  g.engine = {
    archive: structuredClone(exportRun(run)) as RunArchive,
    clock: start,
    serial: 0,
    offerRevision: {},
    offers: {},
    host: { revision: 0, active: [], completed: 0, outcomes: [] },
  };
  refreshGarden(g);
  return g;
}

it('captures and readmits actual remembered work at every authored place without renaming it', () => {
  const g = endingFixture();
  const session = sessionOf(g);
  // Engineering work receipts exercise the full finite authored place vocabulary.
  // They neither assert that Rıza normally works at every place nor manufacture past episodes.
  const places = [
    'garden',
    'hospital',
    'temporary lodging (morning sleep)',
    'lodging',
    'fountain',
    'delivery route',
    'own evening',
    'school kitchen',
    'agency appointment',
    'bread round',
    'produce round',
    'market stall',
    'a quiet corner',
    'flat 5, Lale Apartmanı',
    'another tea stop',
  ];
  for (const place of places) {
    expect(
      decideGardenAction(session, 'riza', [
        {
          id: 'place-control',
          action: 'work',
          label: 'Complete the bounded work control',
          duration: 1 / 60000,
          placeId: place,
          advertises: { competence: 0.1 },
        },
      ]).chosen,
    ).toBe('place-control');
  }
  advanceGarden(g, 20160);
  expect(g.people.riza.activity).toBeUndefined();
  const captured = captureGardenSource(g, 'riza');
  const portable = captured.transfer.portable;
  expect(portable.version).toBe(2);
  if (portable.version !== 2) throw new Error('Missing retained history');
  const sourceEpisodes = portable.retained.memory.episodes.filter((e) => e.action === 'work');
  expect(sourceEpisodes.map((e) => e.placeId)).toEqual(expect.arrayContaining(places));
  const parent = {
    castId: portable.castId,
    castRevision: portable.castRevision,
    terminal: false,
    source: { game: 'hearsay', engine: GARDEN_ENGINE, rules: 'hearsay-hf4-1' },
    transfer: captured.transfer,
  };
  const batch = {
    expectedHeads: {},
    blocked: [],
    inputs: [{ parent, life: {}, clockMs: 0 }],
  } as unknown as LifeBatchPreparation;
  const received = freshGarden(18, admitGardenBatch(batch));
  const incoming = exportRun(sessionOf(received).run).current.people.riza;
  const episodes = present(incoming).memory.episodes;
  for (const episode of sourceEpisodes)
    expect(episodes).toContainEqual(
      expect.objectContaining({
        id: episode.id,
        placeId: episode.placeId,
        action: episode.action,
        at: episode.at + 360 * 60000 - portable.retained.at,
      }),
    );
});

it('keeps a real unrepaired breach in its source rather than clearing it for portable capture', () => {
  const g = endingFixture();
  const session = sessionOf(g);
  // A public received account supplies this explicit engineering conversation fixture.
  // No norm conviction, provenance, body, duty or breach is edited.
  const evidenceId = gardenEvidenceId(session);
  gardenEvidence(session, 'testimony.received', {
    person: 'ece',
    evidenceId,
    teller: 'hatice',
    claims: [
      {
        prop: 'riza:reliable',
        value: false,
        confidence: 0.99,
        sourceId: 'hatice',
        evidenceId,
        provenance: [],
      },
    ],
  });
  converseGarden(session, 'ece', 'hatice', ['riza']);
  advanceGarden(g, 20160);
  const before = structuredClone(exportRun(session.run).current.people.ece);
  expect(present(before).conscience.breaches.some((b) => !b.repaired && b.normId === 'backbiting')).toBe(
    true,
  );
  expect(g.people.ece.activity).toBeUndefined();
  expect(() => captureGardenSource(g, 'ece')).toThrow('cannot continue here with this saved history');
  expect(exportRun(session.run).current.people.ece).toEqual(before);
});
