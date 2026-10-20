import { describe, expect, it } from 'vitest';
import { POLICIES, policyStep, runPolicy } from '../scripts/policy.ts';
import { act, advance, fingerprint, load, newGame, replay, save, view } from '../src/sim/game.ts';
import { storyScene } from '../src/sim/incidents.ts';
import type { Scene } from '../src/sim/types.ts';

const DAY = 1440;
const SEEDS = [1, 2, 3];

describe('round-five policy outcomes', () => {
  it('careful relays earn acceptance and passive play never does', () => {
    for (const policy of ['careful-relay', 'passive'] as const) {
      const games = SEEDS.map((seed) => runPolicy(seed, policy));
      const accepted = games.filter((game) => game.s.engagement === 'accepted');
      if (policy === 'careful-relay') expect(accepted.length).toBeGreaterThanOrEqual(2);
      else expect(accepted).toHaveLength(0);
      for (const game of games) {
        expect(game.s.ended).toBe(true);
        expect(game.inputs.some(({ input }) => input.type === 'choose')).toBe(true);
      }
    }
  });

  it('owning the lie can reach the day-eight step; standing by it cannot', () => {
    const owning = SEEDS.map((seed) => runPolicy(seed, 'lie-own', 7 * DAY + 1260));
    const standing = SEEDS.map((seed) => runPolicy(seed, 'lie-stand', 7 * DAY + 1260));
    expect(owning.some((game) => game.s.riza?.steps?.find((step) => step.day === 8)?.status === 'met')).toBe(
      true,
    );
    expect(
      standing.some((game) => game.s.riza?.steps?.find((step) => step.day === 8)?.status === 'met'),
    ).toBe(false);
    for (const game of [...owning, ...standing]) {
      const lies = game.s.routes.filter(
        (route) => route.from === 'hatice' && route.target === 'riza' && route.lie,
      );
      expect(lies.some((route) => route.to === 'cem')).toBe(true);
      expect(lies.some((route) => route.to === 'osman')).toBe(true);
      expect(
        game.inputs.some(({ input }) => input.type === 'choose' && input.scene.includes('confront')),
      ).toBe(true);
    }
    expect(owning.some((game) => game.s.routes.some((route) => route.retractionOf))).toBe(true);
  });

  it.each(POLICIES)('replays every input for %s exactly', (policy) => {
    const game = runPolicy(1, policy);
    expect(fingerprint(replay(1, game.inputs, game.s.minute).s)).toBe(fingerprint(game.s));
  });
});

describe('round-five conversation rules', () => {
  it('applies a scene fallback at its exact deadline and ignores a stale choice', () => {
    const game = newGame(1);
    advance(game, 3 * DAY + 1080);
    const scene = game.s.scene!;
    expect(scene).toBeDefined();
    expect(scene.until - scene.since).toBe(120);
    const before = fingerprint(game.s);
    expect(act(game, { type: 'choose', scene: `${scene.id}-stale`, choice: scene.fallback })).toBe(false);
    expect(fingerprint(game.s)).toBe(before);
    const chosen = load(save(game));
    advance(game, scene.until - 1);
    expect(game.s.scene?.id).toBe(scene.id);
    advance(chosen, scene.until - 1);
    expect(act(chosen, { type: 'choose', scene: scene.id, choice: scene.fallback })).toBe(true);
    advance(game, scene.until);
    advance(chosen, scene.until);
    expect(game.s.scene?.id).not.toBe(scene.id);
    expect(game.s.riza?.steps).toEqual(chosen.s.riza?.steps);
    expect(game.s.riza?.word).toEqual(chosen.s.riza?.word);
  });

  it('gives a queued scene its own full response window when presented', () => {
    const game = newGame(1);
    advance(game, 3 * DAY + 1080);
    const first = game.s.scene as Scene;
    game.s.sceneQueue = [{ ...first, id: 'family-8', kind: 'word-missed' }];
    advance(game, first.until);
    expect(game.s.scene).toMatchObject({ id: 'family-8', since: first.until, until: first.until + 120 });
    advance(game, first.until + 119);
    expect(game.s.scene?.id).toBe('family-8');
    advance(game, first.until + 120);
    expect(game.s.scene).toBeUndefined();
  });

  it('names retractions, schedules tomorrow’s listener, and visibly completes the repair', () => {
    const game = runPolicy(1, 'lie-own', 1080);
    const scene = game.s.scene as Scene;
    expect(scene.kind).toBe('confrontation');
    expect(scene.choices.map((choice) => choice.id)).toEqual(['own', 'stand']);
    expect(scene.choices.every((choice) => !!choice.risk)).toBe(true);
    expect(game.s.riza?.word?.mend).toMatch(/Osman.*Cem|Cem.*Osman/);
    advance(game, 1180);
    expect(act(game, { type: 'choose', scene: scene.id, choice: 'own' })).toBe(true);
    expect(game.s.riza?.word?.status).toBe('mending');
    expect(
      game.s.threads?.filter((thread) => thread.who === 'hatice' && thread.status === 'on its way'),
    ).toHaveLength(2);
    advance(game, 1380);
    expect(game.s.days?.at(-1)?.tomorrow).toMatch(/First thing tomorrow Osman sits down.*take back.*Rıza/);
    advance(game, DAY + 360);
    expect(view(game.s).present).toContain('osman');
    expect(game.s.routes.some((route) => route.to === 'osman' && route.retractionOf)).toBe(true);
    advance(game, 2 * DAY);
    expect(game.s.riza?.word?.status).toBe('settled');
    expect(
      game.s.threads
        ?.filter((thread) => thread.who === 'hatice')
        .every((thread) => thread.status === 'arrived'),
    ).toBe(true);
    expect(fingerprint(replay(1, game.inputs, game.s.minute).s)).toBe(fingerprint(game.s));
  });

  it('keeps a wedding denial costly until Hatice takes it back at the promised visit', () => {
    const game = runPolicy(1, 'careful-relay', 7 * DAY + 1080);
    const wedding = game.s.scene as Scene;
    expect(wedding.kind).toBe('word');
    expect(wedding.text).toMatch(/flour.*began at your table/);
    act(game, { type: 'choose', scene: wedding.id, choice: 'deny' });
    expect(game.s.riza?.word?.status).toBe('worse');
    expect(game.s.riza?.word?.mend).toMatch(/Ayşe and Rıza/);
    advance(game, 7 * DAY + 1380);
    expect(game.s.days?.at(-1)?.tomorrow).toMatch(/Ayşe and Rıza.*take back your denial/);
    advance(game, 8 * DAY + 360);
    const correction = game.s.scene as Scene;
    expect(correction.id).toBe(`correction-${wedding.id}`);
    const repaired = load(save(game));
    act(game, { type: 'choose', scene: correction.id, choice: 'soften' });
    act(repaired, { type: 'choose', scene: correction.id, choice: 'truth' });
    expect(repaired.s.riza?.word?.status).toBe('settled');
    for (const branch of [game, repaired]) {
      while (branch.s.minute < 12 * DAY + 1200) {
        policyStep(branch, 'careful-relay');
        advance(branch, Math.min(branch.s.minute + 60, 12 * DAY + 1200));
      }
      expect(fingerprint(replay(1, branch.inputs, branch.s.minute).s)).toBe(fingerprint(branch.s));
    }
    expect(game.s.engagement).toBe('refused');
    expect(repaired.s.engagement).toBe('accepted');
  });

  it('preserves the legacy limit on a second bare endorsement to the same listener that day', () => {
    const game = newGame(1, 1);
    game.s.locations.cem = 'garden';
    expect(act(game, { type: 'tell', listener: 'cem', target: 'emre', trait: 'honest' })).toBe(true);
    const routes = game.s.routes.length;
    expect(act(game, { type: 'tell', listener: 'cem', target: 'emre', trait: 'reliable' })).toBe(true);
    expect(game.s.routes).toHaveLength(routes);
    expect(game.s.log.findLast((line) => line.kind === 'reply')?.text).toMatch(/seen|story|saint/i);
  });

  it('answers Ask about the selected trait without a believes verdict', () => {
    const game = newGame(1);
    game.s.locations.cem = 'garden';
    expect(act(game, { type: 'ask', listener: 'cem', target: 'emre', trait: 'reliable' })).toBe(true);
    const reply = game.s.log.findLast((line) => line.kind === 'reply');
    expect(reply?.reply?.believes).toBeUndefined();
    expect(reply?.text).toMatch(/promise|word|reliable|sure|know|seen/i);
    game.s.locations.riza = 'garden';
    act(game, { type: 'ask', listener: 'riza', target: 'emre', trait: 'reliable' });
    expect(game.s.log.findLast((line) => line.kind === 'reply')?.text).not.toContain('know his heart');
  });

  it('provides witnessed Emre stories for all three doubts by day five', () => {
    const game = newGame(1);
    advance(game, 5 * DAY - 1);
    const traits = new Set(
      game.s.stories?.filter((story) => story.target === 'emre').map((story) => storyScene(story.id)?.trait),
    );
    for (const trait of ['honest', 'reliable', 'kind']) expect([...traits]).toContain(trait);
  });

  it('keeps concrete quick replies for an unanswered question after another conversation', () => {
    const game = newGame(1);
    advance(game, 405);
    const waiting = view(game.s).quick;
    expect(waiting?.options.length).toBeGreaterThanOrEqual(2);
    expect(waiting?.options.length).toBeLessThanOrEqual(3);
    const start = game.s.log.length;
    const other = view(game.s).present.find((id) => id !== waiting?.listener && id !== 'emre')!;
    act(game, { type: 'ask', listener: other, target: 'emre', trait: 'kind' });
    expect(
      view(game.s).quick?.listener === waiting?.listener ||
        game.s.log.slice(start).some((line) => line.speaker === waiting?.listener),
    ).toBe(true);
  });

  it('shows promised relays as threads and records their arrival or stall', () => {
    const game = runPolicy(1, 'careful-relay', 5 * DAY);
    expect(game.s.threads?.length).toBeGreaterThan(0);
    const relays = game.s.threads?.filter((thread) => thread.who !== 'hatice') ?? [];
    expect(relays.length).toBeGreaterThan(0);
    expect(relays.every((thread) => thread.to === 'riza' && !!thread.where)).toBe(true);
    expect(relays.some((thread) => thread.status === 'arrived')).toBe(true);
    for (const thread of relays.filter((thread) => thread.status === 'arrived')) {
      expect(
        game.s.log.some(
          (line) => line.at >= thread.at && (line.speaker === thread.who || line.speaker === thread.to),
        ),
      ).toBe(true);
    }
  });

  it('gives missed coffee a second chance Rıza sees the next morning', () => {
    const game = newGame(1);
    advance(game, 3 * DAY + 1080);
    const scene = game.s.scene as Scene;
    expect(scene.kind).toBe('coffee-missed');
    expect(act(game, { type: 'choose', scene: scene.id, choice: 'bread' })).toBe(true);
    advance(game, 4 * DAY + 390);
    expect(game.s.riza?.doubts?.find((doubt) => doubt.key === 'kind')?.status).toBe('settled');
    expect(
      game.s.log.some((line) => line.speaker === 'riza' && /bread.*saw|saw.*bread/i.test(line.text)),
    ).toBe(true);
    expect(fingerprint(replay(1, game.inputs, game.s.minute).s)).toBe(fingerprint(game.s));
  });

  it('loads a round-four save without scene or threads and continues deterministically', () => {
    const game = newGame(2);
    advance(game, 405);
    delete game.s.scene;
    delete game.s.threads;
    if (game.s.riza) delete game.s.riza.word;
    const a = load(save(game));
    const b = load(save(game));
    for (const loaded of [a, b]) {
      advance(loaded, 3 * DAY + 1080);
      expect(loaded.s.scene).toBeDefined();
      const scene = loaded.s.scene as Scene;
      act(loaded, { type: 'choose', scene: scene.id, choice: scene.fallback });
      advance(loaded, 4 * DAY + 405);
      expect(loaded.s.riza?.word).toBeDefined();
    }
    expect(fingerprint(a.s)).toBe(fingerprint(b.s));
  });
});
