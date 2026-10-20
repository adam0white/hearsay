import { act, advance, newGame, PEOPLE, view } from '../src/sim/game.ts';
import type { Game, Input } from '../src/sim/types.ts';

export type Policy = 'quiet' | 'careful' | 'reckless' | 'cunning' | 'passive' | 'careful-relay';

/** Policies use only people and talk visible from the garden. */
export function policyStep(g: Game, policy: Policy) {
  const v = view(g.s);
  const listener = ['riza', 'ayse', ...v.present].find(
    (id) => v.present.includes(id) && id !== 'kemal' && id !== 'emre',
  );
  if (!listener) return;
  let input: Input;
  if (policy === 'quiet') {
    input = g.s.newsWaiting ? { type: 'hold-tongue' } : { type: 'ask', listener, target: 'emre' };
  } else if (
    policy === 'cunning' &&
    g.s.minute < 1440 &&
    v.present.includes('murat') &&
    !g.inputs.some((entry) => entry.input.type === 'tell')
  ) {
    input = { type: 'tell', listener: 'murat', target: 'leyla', trait: 'stingy' };
  } else if (
    policy === 'careful' ||
    policy === 'cunning' ||
    policy === 'careful-relay' ||
    policy === 'passive'
  ) {
    const names = v.riza?.doubts?.map((d) => d.words).join(' ') ?? '';
    const sources = PEOPLE.filter(
      (p) => p.id !== 'riza' && p.id !== 'emre' && names.includes(p.name) && v.present.includes(p.id),
    );
    const relay =
      policy === 'passive'
        ? undefined
        : (v.stories ?? [])
            .filter((story) => story.target === 'emre')
            .flatMap((story) => sources.map((p) => ({ story, listener: p.id })))
            .find(
              ({ story, listener }) =>
                !g.inputs.some(
                  ({ input }) =>
                    input.type === 'tell-story' && input.incident === story.id && input.listener === listener,
                ),
            );
    const question = g.s.newsWaiting ? g.s.log.findLast((l) => l.kind === 'question') : undefined;
    const ownAffair =
      question && v.present.includes(question.speaker ?? '')
        ? (v.stories ?? []).findLast(
            (story) =>
              story.target === question.target &&
              story.target !== 'emre' &&
              story.day === Math.floor(g.s.minute / 1440) + 1,
          )
        : undefined;
    input = relay
      ? { type: 'tell-story', listener: relay.listener, incident: relay.story.id }
      : ownAffair
        ? { type: 'tell-story', listener: question!.speaker!, incident: ownAffair.id }
        : { type: 'ask', listener, target: 'emre' };
  } else {
    input = { type: 'tell', listener, target: 'emre', trait: 'dishonest' };
  }
  act(g, input);
}

export function runPolicy(seed: number, policy: Policy, until = 14 * 1440) {
  const g = newGame(seed);
  while (!g.s.ended && g.s.minute < until) {
    policyStep(g, policy);
    advance(g, Math.min(until, g.s.minute + 60));
  }
  return g;
}
