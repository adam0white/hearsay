import { trustOf } from '@adam0white/human-framework';
import { afterAll, describe, expect, it } from 'vitest';
import { policyStep, runPolicy } from '../scripts/policy.ts';
import { act, advance, fingerprint, load, newGame, replay, save, view } from '../src/sim/game.ts';
import type { Input } from '../src/sim/types.ts';

const SEEDS = [1, 2, 3];
const DAY = 1440;

// These policies must earn their result through recorded player inputs, so replay is
// checked on the same runs used to measure acceptance.
describe('round-four visible engagement policies', () => {
  describe('careful relaying across all fixed seeds', () => {
    const accepted = new Map<number, boolean>();
    afterAll(() => {
      expect(accepted.size).toBe(SEEDS.length);
      expect([...accepted.values()].filter(Boolean).length).toBeGreaterThanOrEqual(2);
    });
    it.each(SEEDS)('checks and replays careful relaying for seed %i', (seed) => {
      const g = runPolicy(seed, 'careful-relay');
      expect(g.s.ended).toBe(true);
      expect(fingerprint(replay(g.s.seed, g.inputs, g.s.minute).s)).toBe(fingerprint(g.s));
      expect(g.s.routes.some((r) => r.from === 'hatice' && r.target === 'emre')).toBe(true);
      expect(g.s.riza?.steps?.length).toBeGreaterThan(0);
      if (g.s.engagement === 'accepted') {
        expect(g.s.riza?.steps?.some((step) => step.status === 'met')).toBe(true);
        expect(g.s.riza?.steps?.some((step) => step.status === 'missed')).toBe(false);
      }
      accepted.set(seed, g.s.engagement === 'accepted');
    });
  });

  it('passive answers are honest but never relay Emre and do not earn acceptance', () => {
    const games = SEEDS.map((seed) => runPolicy(seed, 'passive'));
    expect(games.filter((g) => g.s.engagement === 'accepted')).toHaveLength(0);
    for (const g of games) {
      expect(g.s.ended).toBe(true);
      expect(g.s.routes.some((r) => r.from === 'hatice' && r.target === 'emre')).toBe(false);
      expect(g.s.routes.filter((r) => r.from === 'hatice').every((r) => !r.lie)).toBe(true);
      expect(g.inputs.some(({ input }) => input.type === 'tell-story')).toBe(true);
      expect(g.s.riza?.steps?.some((step) => step.status === 'missed')).toBe(true);
      expect(fingerprint(replay(g.s.seed, g.inputs, g.s.minute).s)).toBe(fingerprint(g.s));
    }
  });

  it('marks each missed family step only when its stated deadline arrives', () => {
    const g = runPolicy(1, 'passive', 3 * DAY + 1065);
    const deadlines = [
      { day: 4, at: 3 * DAY + 1080, label: 'Coffee with Elif’s family' },
      { day: 8, at: 7 * DAY + 1080, label: 'Rıza gives his word' },
      { day: 13, at: 12 * DAY + 1200, label: 'The answer' },
    ];
    for (const deadline of deadlines) {
      advance(g, deadline.at - 15);
      const before = g.s.riza?.steps?.find((step) => step.day === deadline.day);
      expect(before).toMatchObject({ status: 'ahead' });
      expect(before?.label.replaceAll("'", '’')).toBe(deadline.label);
      advance(g, deadline.at);
      expect(g.s.riza?.steps?.find((step) => step.day === deadline.day)?.status).toBe('missed');
      expect(
        g.s.riza?.steps?.filter((step) => step.day > deadline.day).every((step) => step.status === 'ahead'),
      ).toBe(true);
    }
    expect(g.s.engagement).toBe('refused');
  });

  it('Hatice repeating favourable character labels does not settle Rıza’s doubts', () => {
    const g = newGame(1);
    g.s.locations.riza = 'garden';
    expect(g.s.riza?.doubts?.length).toBeGreaterThan(0);
    for (const trait of ['honest', 'reliable', 'kind'] as const)
      expect(act(g, { type: 'defend', listener: 'riza', target: 'emre', trait })).toBe(true);
    expect(g.s.riza?.doubts?.filter((doubt) => doubt.status === 'settled')).toHaveLength(0);
    expect(g.s.engagement).toBe('waiting');
  });
});

describe('Meryem’s concerned question about her cart', () => {
  const answers: Input[] = [
    { type: 'tell-story', listener: 'meryem', incident: 3 },
    { type: 'tell', listener: 'meryem', target: 'osman', trait: 'unreliable' },
  ];
  it.each(answers)('accepts the true $type answer without a refusal or immediate penalties', (input) => {
    const g = newGame(3);
    advance(g, 2 * DAY + 405);
    expect(g.s.stories?.some((story) => story.id === 3)).toBe(true);
    const trust = trustOf(g.s.people.meryem!, 'hatice');
    const custom = g.s.custom.hatice;
    const closed = g.s.closedUntil;
    const start = g.s.log.length;
    expect(act(g, input)).toBe(true);
    const route = g.s.routes.findLast((r) => r.from === 'hatice')!;
    expect(route).toMatchObject({ to: 'meryem', target: 'osman', trait: 'unreliable', lie: false });
    const reply = g.s.log.slice(start).findLast((line) => line.kind === 'reply');
    expect(reply?.reply).toBeDefined();
    expect(reply?.reply?.believes).not.toBe('refuse');
    expect(reply?.text).not.toMatch(/behind their back|wrong to|not here to answer/i);
    expect(g.s.log.slice(start).some((line) => line.kind === 'refusal')).toBe(false);
    expect(trustOf(g.s.people.meryem!, 'hatice')).toBeGreaterThanOrEqual(trust);
    expect(g.s.custom.hatice).toBe(custom);
    expect(g.s.closedUntil).toBe(closed);

    // Both the recipient and Osman are at the fountain at eighteen hundred.
    // The true account can therefore be traced without relying on a hidden
    // test-only production hook or an unrelated false claim.
    advance(g, 2 * DAY + 1065);
    const osmanTrust = trustOf(g.s.people.osman!, 'hatice');
    const beforeTraceCustom = g.s.custom.hatice;
    const beforeTraceClosed = g.s.closedUntil;
    advance(g, 2 * DAY + 1080);
    expect(g.s.locations.meryem).toBe(g.s.locations.osman);
    expect(g.s.routes.some((r) => r.id === route.id && !r.lie)).toBe(true);
    expect(trustOf(g.s.people.osman!, 'hatice')).toBeGreaterThanOrEqual(osmanTrust);
    expect(g.s.custom.hatice).toBe(beforeTraceCustom);
    expect(g.s.closedUntil).toBe(beforeTraceClosed);
  });
});

describe('sitting and version-one saves', () => {
  it('keeps Rıza through his noon departure and releases him back to his schedule', () => {
    const g = newGame(2);
    advance(g, 765);
    expect(g.s.locations.riza).toBe('garden');
    expect(act(g, { type: 'sit', listener: 'riza' })).toBe(true);
    advance(g, 795);
    expect(g.s.locations.riza).toBe('garden');
    expect(g.s.held).toEqual({ id: 'riza', until: 855 });
    expect(act(g, { type: 'release' })).toBe(true);
    expect(g.s.held).toBeUndefined();
    expect(g.s.locations.riza).not.toBe('garden');
    expect(fingerprint(replay(2, g.inputs, g.s.minute).s)).toBe(fingerprint(g.s));
  });

  it('expires the seat at ninety minutes, including across a save', () => {
    const g = newGame(2);
    advance(g, 765);
    expect(act(g, { type: 'sit', listener: 'riza' })).toBe(true);
    const restored = load(save(g));
    for (const game of [g, restored]) {
      advance(game, 840);
      expect(game.s.locations.riza).toBe('garden');
      advance(game, 855);
      expect(game.s.held).toBeUndefined();
      expect(game.s.locations.riza).not.toBe('garden');
    }
    expect(fingerprint(restored.s)).toBe(fingerprint(g.s));
  });

  it('loads an older save without optional fields and continues deterministically', () => {
    const old = newGame(7);
    advance(old, 405);
    for (const key of [
      'riza',
      'stories',
      'days',
      'held',
      'incidentWitnesses',
      'groundTruth',
      'pendingConfrontations',
      'heardClaims',
    ] as const)
      delete old.s[key];
    const serialized = save(old);
    const a = load(serialized);
    const b = load(serialized);
    for (const game of [a, b]) {
      advance(game, DAY + 405);
      expect(game.s.stories).toContainEqual(expect.objectContaining({ id: 2 }));
      expect(act(game, { type: 'tell-story', listener: 'ali', incident: 2 })).toBe(true);
      advance(game, 2 * DAY);
      expect(game.s.riza?.answerDay).toBe(13);
      expect(game.s.riza?.doubts?.length).toBeGreaterThan(0);
      expect(game.s.riza?.steps?.length).toBeGreaterThan(0);
    }
    expect(fingerprint(a.s)).toBe(fingerprint(b.s));
  });
});

it('keeps a held companion at the table while her scripted scene waits', () => {
  const g = newGame(1);
  expect(act(g, { type: 'sit', listener: 'zehra' })).toBe(true);
  advance(g, 390);
  expect(g.s.locations.zehra).toBe('garden');
  expect(g.s.stories?.some((story) => story.id === 1)).toBe(false);
  act(g, { type: 'release' });
  advance(g, 405);
  expect(g.s.stories?.some((story) => story.id === 1)).toBe(true);
});

it('expires a hold at ninety minutes even between quarter hours', () => {
  const g = newGame(1);
  advance(g, 766);
  act(g, { type: 'sit', listener: 'riza' });
  advance(g, 856);
  expect(g.s.held).toBeUndefined();
  expect(g.s.locations.riza).toBe('bakery');
  expect(fingerprint(replay(1, g.inputs, 856).s)).toBe(fingerprint(g.s));
});

it('release without a hold changes no simulation state', () => {
  const g = newGame(1);
  advance(g, 390);
  const before = fingerprint(g.s);
  expect(act(g, { type: 'release' })).toBe(true);
  expect(fingerprint(g.s)).toBe(before);
});

it('does not treat an unrelated lie as an answer to the cart question', () => {
  const g = newGame(1);
  advance(g, 2 * DAY + 405);
  g.s.locations.osman = 'doorsteps';
  act(g, { type: 'tell', listener: 'meryem', target: 'osman', trait: 'cruel' });
  const reply = g.s.log.findLast((line) => line.kind === 'reply');
  expect(reply?.reply?.believes).toBe('refuse');
  expect(reply?.text).not.toContain('my cart');
});

it('keeps an older save’s wedding answer after loading and advancing', () => {
  const old = runPolicy(1, 'careful-relay', 12 * DAY + 1200);
  expect(old.s.engagement).toBe('accepted');
  delete old.s.riza!.doubts;
  delete old.s.riza!.steps;
  // The older game did not need independent support for kindness.
  old.s.routes = old.s.routes.filter((route) => route.target !== 'emre');
  delete old.s.incidentWitnesses;
  const g = load(save(old));
  advance(g, old.s.minute + 15);
  expect(g.s.engagement).toBe('accepted');
  expect(g.s.riza?.steps?.find((step) => step.day === 13)?.status).toBe('met');
});

it('keeps hold expiry independent of the caller’s clock batching', () => {
  const a = newGame(2);
  advance(a, 766);
  act(a, { type: 'sit', listener: 'riza' });
  const b = load(save(a));
  advance(a, 900);
  advance(b, 856);
  advance(b, 900);
  expect(fingerprint(a.s)).toBe(fingerprint(b.s));
});

it('protects the truthful answer to Rıza’s own family question', () => {
  const g = newGame(1);
  advance(g, 720);
  expect(act(g, { type: 'tell-story', listener: 'riza', incident: 1 })).toBe(true);
  expect(g.s.log.findLast((line) => line.kind === 'reply')?.reply).toMatchObject({
    believes: 'yes',
    will: expect.stringMatching(/find Kemal/),
  });
});

describe('final round-four scene and card regressions', () => {
  it('defers the opening greeting while Kemal remains seated', () => {
    const g = newGame(1);
    advance(g, 390);
    expect(act(g, { type: 'tell', listener: 'fatma', target: 'kemal', trait: 'dishonest' })).toBe(true);
    expect(act(g, { type: 'sit', listener: 'kemal' })).toBe(true);
    const start = g.s.log.length;
    advance(g, 420);
    expect(view(g.s).held).toEqual({ id: 'kemal', until: 480 });
    expect(g.s.locations.kemal).toBe('garden');
    expect(g.s.deferredScenes?.['opening-greeting']).toBe(420);
    expect(g.s.log.slice(start).some((line) => line.kind === 'cold-greeting')).toBe(false);
    expect(act(g, { type: 'release' })).toBe(true);
    advance(g, 435);
    expect(g.s.deferredScenes?.['opening-greeting']).toBeUndefined();
    expect(g.s.locations.kemal).toBe('fountain');
    expect(g.s.log.slice(start).some((line) => line.kind === 'cold-greeting')).toBe(true);
    expect(fingerprint(replay(1, g.inputs, g.s.minute).s)).toBe(fingerprint(g.s));
  });

  it('defers Kemal’s basket errand through renewed seats until release', () => {
    const g = newGame(1);
    for (const minute of [420, 495, 570, 645, 720]) {
      advance(g, minute);
      expect(act(g, { type: 'sit', listener: 'kemal' })).toBe(true);
    }
    advance(g, 765);
    expect(g.s.locations.kemal).toBe('garden');
    expect(g.s.stories?.some((story) => story.id === 15)).toBe(false);
    expect(g.s.log.some((line) => line.kind === 'truth' && /heavy basket/.test(line.text))).toBe(false);
    expect(act(g, { type: 'release' })).toBe(true);
    advance(g, 780);
    expect(g.s.locations.kemal).toBe('fountain');
    expect(g.s.stories?.filter((story) => story.id === 15)).toHaveLength(1);
    expect(g.s.log.some((line) => line.kind === 'truth' && /heavy basket/.test(line.text))).toBe(true);
    expect(fingerprint(replay(1, g.inputs, g.s.minute).s)).toBe(fingerprint(g.s));
  });

  it('answers the mother’s favourable witnessed story by asking to hear others', () => {
    const g = newGame(1);
    advance(g, DAY + 720);
    expect(view(g.s).present).toContain('riza');
    const before = g.s.riza?.doubts?.map((doubt) => doubt.status);
    expect(act(g, { type: 'tell-story', listener: 'riza', incident: 2 })).toBe(true);
    const reply = g.s.log.findLast((line) => line.kind === 'reply');
    expect(reply?.text).toMatch(/mother.*hear it from someone else/);
    expect(reply?.reply).toMatchObject({
      believes: 'doubt',
      will: 'I’ll listen for what others say.',
    });
    expect(g.s.riza?.doubts?.map((doubt) => doubt.status)).toEqual(before);
    expect(g.s.riza?.doubts?.some((doubt) => doubt.status === 'settled')).toBe(false);
  });

  it('keeps Rıza’s spoken card after remote news and changes it on his next visit', () => {
    const g = newGame(1);
    advance(g, 405);
    // Ayşe belongs to Rıza’s household. The next morning she sees the flour
    // herself at the grocer while Rıza works at the bakery.
    expect(act(g, { type: 'tell', listener: 'ayse', target: 'kemal', trait: 'honest' })).toBe(true);
    advance(g, DAY + 495);
    const spoken = { line: view(g.s).riza?.line, at: view(g.s).riza?.at };
    advance(g, DAY + 510);
    expect(view(g.s).present).not.toContain('riza');
    expect(g.s.routes.find((route) => route.from === 'hatice')?.contradictedAt).toBe(DAY + 510);
    expect({ line: view(g.s).riza?.line, at: view(g.s).riza?.at }).toEqual(spoken);
    advance(g, DAY + 660);
    expect(view(g.s).present).toContain('riza');
    expect(view(g.s).riza?.line).not.toBe(spoken.line);
    expect(view(g.s).riza?.line).toMatch(/false story.*our house/);
    expect(view(g.s).riza?.at).toBe(DAY + 660);
    expect(
      g.s.log.some(
        (line) => line.at === DAY + 660 && line.kind === 'riza' && line.text === view(g.s).riza?.line,
      ),
    ).toBe(true);
    expect(fingerprint(replay(1, g.inputs, g.s.minute).s)).toBe(fingerprint(g.s));
  });

  it('can recover from missed coffee by beginning truthful relays on day five', () => {
    const g = newGame(1);
    advance(g, 4 * DAY + 360);
    expect(view(g.s).riza?.steps?.find((step) => step.day === 4)?.status).toBe('missed');
    const final = 12 * DAY + 1200;
    while (g.s.minute < final - 60) {
      policyStep(g, 'careful-relay');
      advance(g, Math.min(g.s.minute + 60, final - 60));
    }
    expect(g.s.routes.filter((route) => route.from === 'hatice').every((route) => !route.lie)).toBe(true);
    expect(g.s.riza?.doubts?.filter((doubt) => doubt.status === 'settled')).toHaveLength(3);
    expect(g.s.engagement).toBe('waiting');
    advance(g, final);
    expect(g.s.engagement).toBe('accepted');
    expect(view(g.s).riza?.steps?.map((step) => step.status)).toEqual(['missed', 'met', 'met']);
    expect(fingerprint(replay(1, g.inputs, g.s.minute).s)).toBe(fingerprint(g.s));
  });

  it.each([
    { day: 3, words: /Coffee with Elif[’']s family.*six in the evening/ },
    { day: 7, words: /Rıza gives his word.*six in the evening/ },
    { day: 12, words: /The answer.*after supper/ },
  ])('announces tomorrow’s family step on the day-$day card', ({ day, words }) => {
    const g = newGame(1);
    advance(g, (day - 1) * DAY + 1380);
    expect(view(g.s).days?.find((card) => card.day === day)?.tomorrow).toMatch(words);
  });
});

it('lets a seated Rıza settle a doubt from his own sight of Emre’s repair', () => {
  const g = newGame(1);
  advance(g, 3 * DAY + 765);
  expect(act(g, { type: 'sit', listener: 'riza' })).toBe(true);
  advance(g, 3 * DAY + 840);
  expect(g.s.riza?.doubts?.find((doubt) => doubt.key === 'reliable')).toMatchObject({
    status: 'settled',
    because: expect.stringContaining('Rıza saw Emre'),
  });
  expect(g.s.log.findLast((line) => line.kind === 'riza')?.text).toContain('I saw Emre');
  expect(fingerprint(replay(1, g.inputs, g.s.minute).s)).toBe(fingerprint(g.s));
});
