/** Four-call HF playtester contract. Only garden-visible events and actions leave this adapter. */
import { act, advance, newGame, view } from '../../src/sim/game.ts';
import type { Game, Input } from '../../src/sim/types.ts';

export class HearsayAdapter {
  name = 'hearsay-0.1.0';
  game: Game;
  seen = 0;
  carry = 0;
  byInput = new Map<number, string>();
  offered = new Map<string, Input>();
  constructor(seed: number) {
    this.game = newGame(seed);
  }

  observe() {
    const v = view(this.game.s);
    const events = v.lines
      .filter((line) => line.n >= this.seen)
      .map((line) => {
        const refused = line.kind === 'refusal';
        const adverse = ['confrontation', 'cold-greeting'].includes(line.kind);
        const input = this.byInput.get(line.n);
        return {
          kind: line.kind,
          summary: `${line.who}: ${line.text}`,
          by: line.who === 'narrator' ? undefined : line.who,
          valence: adverse ? -0.55 : refused ? -0.15 : 0.2,
          salience: adverse || refused ? 0.8 : 0.55,
          answers: input ? [input] : false,
        };
      });
    for (const line of v.lines) this.seen = Math.max(this.seen, line.n + 1);
    for (const n of this.byInput.keys()) if (n < this.seen) this.byInput.delete(n);
    const day = Math.floor(v.minute / 1440) + 1;
    const clock = `Day ${day} ${Math.floor((v.minute % 1440) / 60)}:${String(v.minute % 60).padStart(2, '0')}`;
    return {
      clock,
      phase: v.ended ? 'review' : 'play',
      chapter: `day ${day}`,
      events,
      features: { pressure: v.question ? 0.6 : 0.1, openLoop: v.ended ? 0 : 0.65 },
      over: v.ended,
      ...(v.ended ? { outcome: v.engagement === 'accepted' ? ('win' as const) : ('loss' as const) } : {}),
      loops: v.question
        ? [v.question]
        : v.ended
          ? []
          : [
              v.engagement === 'waiting'
                ? 'Emre hopes to marry Elif. Rıza has yet to decide.'
                : v.engagement === 'accepted'
                  ? 'Rıza agreed to the marriage. The fortnight continues.'
                  : 'Rıza refused the engagement. The fortnight continues.',
            ],
    };
  }

  actions() {
    const v = view(this.game.s);
    this.offered.clear();
    const actions: {
      id: string;
      label: string;
      kind: string;
      promise: number;
      tags?: string[];
      mischief?: boolean;
    }[] = [];
    const add = (id: string, label: string, input: Input, promise: number) => {
      this.offered.set(id, input);
      actions.push({ id, label, kind: input.type, promise });
    };
    if (v.ended) return actions;
    if (v.question) add('hold-tongue', 'Hold your tongue', { type: 'hold-tongue' }, 0.55);
    for (const listener of v.present) {
      const name = v.people.find((p) => p.id === listener)?.name ?? listener;
      if (listener !== 'kemal') {
        add(
          `ask:${listener}:kemal`,
          `Ask ${name} about Kemal`,
          { type: 'ask', listener, target: 'kemal' },
          0.6,
        );
        if (v.lines.some((line) => /old flour/.test(line.text)))
          add(
            `tell:${listener}:kemal`,
            `Tell ${name}: Kemal is dishonest`,
            { type: 'tell', listener, target: 'kemal', trait: 'dishonest' },
            0.65,
          );
        add(
          `amends:${listener}:kemal`,
          `Make amends to Kemal with ${name}`,
          { type: 'make-amends', listener, target: 'kemal' },
          0.4,
        );
      }
      if (listener !== 'emre')
        add(
          `defend:${listener}:emre`,
          `Defend Emre to ${name}`,
          { type: 'defend', listener, target: 'emre', trait: 'reliable' },
          0.6,
        );
      if (v.people.find((p) => p.id === listener)?.place === 'fountain')
        add(`call:${listener}`, `Call ${name} over`, { type: 'call-over', person: listener }, 0.45);
    }
    return actions;
  }

  edgeActions() {
    const v = view(this.game.s);
    if (v.ended) return [];
    const lies = v.present
      .filter((id) => id !== 'emre')
      .map((listener) => {
        const id = `tell:${listener}:emre:sport`;
        this.offered.set(id, { type: 'tell', listener, target: 'emre', trait: 'dishonest' });
        return {
          id,
          label: `Tell ${listener} Emre is dishonest, for sport`,
          kind: 'tell',
          promise: 0.3,
          tags: ['confront'],
          mischief: true,
        };
      });
    const bribes = v.present.map((person) => {
      const id = `call:${person}:silence`;
      this.offered.set(id, { type: 'call-over', person, buySilence: true });
      return {
        id,
        label: `Call ${person} over; pay for tea and ask for silence`,
        kind: 'call-over',
        promise: 0.3,
        tags: ['confront'],
        mischief: true,
      };
    });
    return [...lies, ...bribes];
  }

  apply(id: string) {
    const input = this.offered.get(id);
    if (!input) throw new Error(`No currently offered action: ${id}`);
    const n = this.game.s.log.length;
    act(this.game, input);
    for (const line of this.game.s.log.slice(n)) this.byInput.set(line.id, id);
  }

  advance(seconds: number) {
    // Integrate at each speed boundary; batching seconds must not change the clock.
    let remaining = Math.max(0, seconds);
    while (remaining > 1e-9 && !this.game.s.ended) {
      const minute = this.game.s.minute;
      const day = Math.floor(minute / 1440) * 1440;
      const tod = minute - day;
      const rate = tod < 360 || tod >= 1380 ? 240 : 1;
      const boundary = tod < 360 ? day + 360 : tod < 1380 ? day + 1380 : day + 1440 + 360;
      const position = minute + this.carry;
      const span = Math.min(remaining, (boundary - position) / rate);
      const next = position + span * rate;
      const whole = Math.floor(next + 1e-8);
      this.carry = Math.max(0, next - whole);
      advance(this.game, whole);
      remaining -= span;
    }
  }
}
export const make = (seed: number) => new HearsayAdapter(seed);
