import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { act, advance, fingerprint, newGame, replay } from '../src/sim/game.ts';
import { createOneCastOpening, createOneCastReturn, prepareOneCastAdmission } from '../src/sim/one-cast.ts';
import type { State } from '../src/sim/types.ts';
import { exportRun, verifyImport } from '../src/ui/export.ts';

// Actual Stairwell5 ordinary seed7: request rota pause at420, complete night work at480.
// Copied from its real source UI export; no invented Person, goal or progress.
const source = JSON.parse(
  readFileSync(new URL('./fixtures/stairwell-seed7-departure.json', import.meta.url), 'utf8'),
);
async function carried(version = 5) {
  const fresh = newGame(7, version as State['version']);
  const opening = createOneCastOpening(source.castId, fresh.s.people.derya!, source.transfer.person);
  const admission = await prepareOneCastAdmission(source, opening, { targetBuild: 'social-test' });
  return newGame(
    7,
    version as State['version'],
    { derya: admission.person },
    {
      entries: [{ admission, head: source, scope: 'local' }],
      rows: [],
    },
  );
}
it('offers a genuine timed social course and naturally completes the carried make-friend goal before departure', async () => {
  const game = await carried();
  advance(game, 1830);
  expect(act(game, { type: 'one-cast-encounter', person: 'derya', choice: 'support' })).toBe(true);
  advance(game, 19110);
  expect(game.s.deryaAssignmentReleased).toBe(true);
  expect(game.s.log.some((l) => l.kind === 'social-chat-completed')).toBe(true);
  expect(
    game.s.people.derya!.agenda.goals.some((g) => g.label === 'make-friend' && g.status === 'achieved'),
  ).toBe(true);
  const entry = game.continuity!.entries[0]!;
  const returned = await createOneCastReturn(game.s.people.derya!, entry.admission, {
    targetBuild: 'social-test',
    parentRevision: entry.head.revision,
    encounter: entry.encounter!,
    assignmentEnded: true,
    rules: game.s.version as 4 | 5,
  });
  expect(returned.source.rules).toBe('5');
  expect(returned.transfer.admission).toMatchObject({
    sourceRevision: source.revision,
    sourceCheckpointDigest: source.transfer.checkpoint.checkpointDigest,
  });
  expect(
    fingerprint(replay(7, game.inputs, 19110, game.s.version, game.initialPeople, game.initialContinuity).s),
  ).toBe(fingerprint(game.s));
  expect(fingerprint(verifyImport(JSON.stringify(exportRun(game))).s)).toBe(fingerprint(game.s));
});
it('starts fresh games in edition5 and retains the actual edition4 blocked control', async () => {
  expect(newGame(7).s.version).toBe(5);
  const old = await carried(4);
  advance(old, 19110);
  expect(old.s.people.derya!.agenda.goals.find((g) => g.label === 'make-friend')?.status).toBe('active');
  expect(old.s.log.some((l) => l.kind.startsWith('social-chat'))).toBe(false);
});

it('interrupts an actual selected chat when the player calls its partner away, without goal progress', async () => {
  const game = await carried();
  while (game.s.minute < 19110 && game.s.people.derya!.activity?.action !== 'chat')
    advance(game, game.s.minute + 15);
  const activity = game.s.people.derya!.activity!;
  expect(activity.action).toBe('chat');
  expect(activity.endsAt - activity.startedAt).toBe(15);
  expect(activity.affordance.with).toEqual([activity.targetId]);
  expect(activity.affordance.effort).toBe(0.02);
  expect(game.s.locations.derya).toBe('fountain');
  const goals = structuredClone(game.s.people.derya!.agenda.goals);
  const completed = game.s.log.filter((l) => l.kind === 'social-chat-completed').length;
  expect(act(game, { type: 'call-over', person: activity.targetId! })).toBe(true);
  expect(game.s.people.derya!.activity).toBeNull();
  expect(game.s.people.derya!.agenda.goals).toEqual(goals);
  expect(game.s.log.filter((l) => l.kind === 'social-chat-completed')).toHaveLength(completed);
  expect(game.s.log.at(-1)?.kind).toBe('social-chat-interrupted');
  expect(game.s.people.derya!.memory.episodes.findLast((e) => e.action === 'chat')?.tags).toContain(
    'interrupted',
  );
});
