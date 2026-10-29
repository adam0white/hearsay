import { exportRun, inspect, replay } from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import {
  authorGardenPerson,
  createGardenSession,
  decideGardenAction,
  gardenEvidence,
} from '../src/sim/garden-hf4.ts';

it('records game-authored advice wording once and reuses it in reads and replay', () => {
  const session = createGardenSession(17, [authorGardenPerson('hatice', 'Hatice', 'female', 48, {}, {})]);
  gardenEvidence(session, 'suggestion.received', {
    person: 'hatice',
    received: {
      kind: 'ordinary',
      suggestion: {
        adviceId: 'tea-break',
        voiceId: 'hearsay',
        action: 'rest',
        strength: 0.8,
      },
    },
  });
  decideGardenAction(session, 'hatice', [
    {
      id: 'rest',
      action: 'rest',
      label: 'Rest at the garden',
      duration: 15,
      advertises: { rest: 0.5 },
    },
  ]);
  const query = {
    perspective: { kind: 'person' as const, observer: 'hatice' },
    people: ['hatice'],
    select: ['events' as const],
  };
  const before = exportRun(session.run);
  const first = inspect(session.run, query);
  if (!first.ok) throw Error(first.error.message);
  const resolution = first.value.events.find((event) => event.data.kind === 'suggestion-resolved');
  expect(resolution?.narration[0]?.text).toBe(
    'After considering your request, I have decided to follow your advice.',
  );
  expect(inspect(session.run, query)).toEqual(first);
  expect(exportRun(session.run)).toEqual(before);
  const proof = replay(before);
  expect(proof.ok && proof.value.fullHash).toBe(before.hashes.full);
});
