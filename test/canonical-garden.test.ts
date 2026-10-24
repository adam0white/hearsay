import { describe, expect, it } from 'vitest';
import { advanceGarden, chooseGarden, freshGarden, replayGarden } from '../src/sim/garden.ts';

describe('canonical garden encounters', () => {
  it('learns a private fact only from a completed chosen conversation', () => {
    const g = freshGarden(17);
    expect(g.discoveries.riza).toBeUndefined();
    expect(chooseGarden(g, { type: 'listen', person: 'riza', approach: 'invite' })).toBe(true);
    expect(g.discoveries.riza).toBeUndefined();
    advanceGarden(g, 375);
    expect(g.discoveries.riza?.fact).toContain('doorway');
    expect(g.people.riza!.memory.episodes.some((e) => e.action === 'garden-confidence')).toBe(true);
    const replay = replayGarden(g.seed, g.inputs, g.minute);
    expect(replay).toEqual(g);
  });
  it('interrupts a private conversation on release without granting discovery', () => {
    const g = freshGarden(17);
    chooseGarden(g, { type: 'listen', person: 'riza', approach: 'invite' });
    advanceGarden(g, 365);
    chooseGarden(g, { type: 'release', person: 'riza' });
    advanceGarden(g, 380);
    expect(g.discoveries.riza).toBeUndefined();
    expect(g.log.some((e) => e.kind === 'interrupted')).toBe(true);
  });
  it('keeps a refusal private and lets the player leave it there', () => {
    const g = freshGarden(7);
    chooseGarden(g, { type: 'listen', person: 'derya', approach: 'pry' });
    advanceGarden(g, 375);
    expect(g.discoveries.derya).toBeUndefined();
    expect(g.log.some((e) => e.text.includes('private'))).toBe(true);
  });
});

it('preserves a carried social goal and advances it only by completed real chats', async () => {
  const { adoptGoal } = await import('@adam0white/human-framework');
  const { gardenOpening } = await import('../src/sim/garden-cast.ts');
  const p = gardenOpening('riza', 17);
  adoptGoal(
    p,
    {
      label: 'Make time for company',
      serves: ['belonging'],
      importance: 0.8,
      advancedBy: [{ action: 'chat', amount: 0.5 }],
    },
    360,
  );
  const g = freshGarden(17, { riza: p });
  const goal = g.people.riza.agenda.goals[0]!;
  chooseGarden(g, { type: 'listen', person: 'riza', approach: 'invite' });
  advanceGarden(g, 365);
  chooseGarden(g, { type: 'release', person: 'riza' });
  expect(goal.progress).toBe(0);
  chooseGarden(g, { type: 'listen', person: 'riza', approach: 'invite' });
  advanceGarden(g, 380);
  expect(goal.progress).toBeGreaterThan(0);
  expect(g.initialPeople.riza.agenda.goals[0]!.progress).toBe(0);
});
it('uses actual company for Hatice’s carried chat goal, not solitary reflection', async () => {
  const { adoptGoal } = await import('@adam0white/human-framework');
  const { gardenOpening } = await import('../src/sim/garden-cast.ts');
  const p = gardenOpening('hatice', 17);
  adoptGoal(
    p,
    {
      label: 'Company',
      serves: ['belonging'],
      importance: 0.8,
      advancedBy: [{ action: 'chat', amount: 0.5 }],
    },
    360,
  );
  const alone = freshGarden(17, { hatice: p });
  chooseGarden(alone, { type: 'listen', person: 'hatice', approach: 'invite' });
  advanceGarden(alone, 375);
  expect(alone.people.hatice.agenda.goals[0]?.progress).toBe(0);
  const together = freshGarden(17, { hatice: p });
  chooseGarden(together, { type: 'listen', person: 'riza', approach: 'invite' });
  advanceGarden(together, 375);
  expect(together.people.hatice.agenda.goals[0]?.progress).toBeGreaterThan(0);
});
it('records knowingly false speech under Hatice’s own held norm', () => {
  const g = freshGarden(17);
  advanceGarden(g, 400);
  chooseGarden(g, { type: 'defend', person: 'riza', about: 'osman', trait: 'honest' });
  expect(g.people.hatice.conscience.breaches.some((b) => b.normId === 'lying')).toBe(true);
});
it('offers an admitted quiet worship appointment instead of deleting it or letting it expire without an action', async () => {
  const { gardenOpening } = await import('../src/sim/garden-cast.ts');
  const p = gardenOpening('riza', 17);
  p.agenda.commitments.push({
    id: 'source-prayer',
    kind: 'worship',
    actions: ['pray'],
    from: 375,
    until: 405,
    importance: 1,
    status: 'pending',
    normId: 'salah',
  });
  const g = freshGarden(17, { riza: p });
  advanceGarden(g, 405);
  expect(g.people.riza.agenda.commitments.find((c) => c.id === 'source-prayer')?.status).toBe('kept');
  expect(g.initialPeople.riza.agenda.commitments.find((c) => c.id === 'source-prayer')?.status).toBe(
    'pending',
  );
});
