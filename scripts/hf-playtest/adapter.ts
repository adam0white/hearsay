/** Four-call HF playtester contract. Only garden-visible events and actions leave this adapter. */
import { act, advance, newGame, view } from '../../src/sim/game.ts';
import { DAILY_INCIDENTS } from '../../src/sim/incidents.ts';
import type { Game, Input, Trait } from '../../src/sim/types.ts';

export class HearsayAdapter {
  name = 'hearsay-0.1.0';
  game: Game;
  seen = 0;
  carry = 0;
  speed = 1;
  paceAnswers: string[] = [];
  byInput = new Map<number, string>();
  offered = new Map<string, Input | number>();
  constructor(seed: number) {
    this.game = newGame(seed);
  }

  observe() {
    const v = view(this.game.s);
    const events = v.lines
      .filter((line) => line.n >= this.seen)
      .map((line) => {
        const input = this.byInput.get(line.n);
        const refused = line.kind === 'refusal' && input !== undefined;
        // Consequences for another neighbour are news, not harm to Hatice.
        const adverse =
          ['confrontation', 'cold-greeting'].includes(line.kind) &&
          /\b(?:you|your|Hatice)\b/i.test(line.text);
        return {
          kind: line.kind,
          summary: `${line.who}: ${line.text}`,
          by: line.who === 'narrator' ? undefined : line.who,
          // Acknowledgements and empty retractions are not rewards.
          valence: adverse ? -0.55 : refused ? -0.15 : 0,
          salience: adverse || refused ? 0.8 : 0.55,
          answers: input ? [input] : false,
        };
      });
    for (const line of v.lines) this.seen = Math.max(this.seen, line.n + 1);
    for (const n of this.byInput.keys()) if (n < this.seen) this.byInput.delete(n);
    for (const id of this.paceAnswers.splice(0))
      events.push({
        kind: 'pace',
        summary: `Time speed: ${{ 1: 'Slow', 5: 'Walk', 20: 'Trot', 80: 'Gallop' }[this.speed]}.`,
        by: undefined,
        valence: 0,
        salience: 0.3,
        answers: [id],
      });
    const day = Math.floor(v.minute / 1440) + 1;
    const clock = `Day ${day} ${Math.floor((v.minute % 1440) / 60)}:${String(v.minute % 60).padStart(2, '0')}`;
    return {
      clock,
      phase: v.ended ? 'review' : 'play',
      goal: v.ended ? '' : 'Keep your word good. See Emre married.',
      next: v.ended ? '' : (v.question ?? 'Tap a person. Choose what to say.'),
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
    const amendsPromise = (listener: string, target: string) => {
      // Hatice can remember her own statements and withdrawals, not others' beliefs.
      const last = this.game.inputs
        .map((entry) => entry.input)
        .findLast(
          (input) =>
            'listener' in input &&
            input.listener === listener &&
            'target' in input &&
            input.target === target &&
            ['tell', 'defend', 'make-amends'].includes(input.type),
        );
      return last && last.type !== 'make-amends' ? 0.4 : 0.05;
    };
    if (v.ended) return actions;
    for (const [label, rate] of [
      ['Slow', 1],
      ['Walk', 5],
      ['Trot', 20],
      ['Gallop', 80],
    ] as const) {
      if (rate === this.speed) continue;
      const id = `pace:${rate}`;
      this.offered.set(id, rate);
      actions.push({
        id,
        label,
        kind: 'pace',
        promise: !v.present.length && !v.question && rate > this.speed ? 0.7 : 0.15,
      });
    }
    if (v.question) add('hold-tongue', 'Hold your tongue', { type: 'hold-tongue' }, 0.55);
    // Authored interpretation of the latest scene in the visible journal.
    // Do not inspect beliefs or offer a future incident's testimony.
    const incident = DAILY_INCIDENTS.filter((scene) =>
      v.lines.some(
        (line) =>
          line.kind === 'overheard' &&
          line.text.startsWith(scene.text) &&
          line.minute === (scene.day - 1) * 1440 + scene.at,
      ),
    ).at(-1);
    const opposites: Partial<Record<Trait, Trait>> = {
      reliable: 'unreliable',
      kind: 'cruel',
      honest: 'dishonest',
      generous: 'stingy',
      hardworking: 'lazy',
    };
    const observedTrait = incident && (incident.value ? incident.trait : opposites[incident.trait]);
    for (const listener of v.present) {
      const name = v.people.find((p) => p.id === listener)?.name ?? listener;
      if (listener !== 'kemal') {
        add(
          `ask:${listener}:kemal`,
          `Ask ${name} about Kemal`,
          { type: 'ask', listener, target: 'kemal' },
          0.6,
        );
        if (!incident && v.lines.some((line) => /old flour/.test(line.text)))
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
          amendsPromise(listener, 'kemal'),
        );
      }
      if (incident && observedTrait && listener !== incident.target) {
        const subject = v.people.find((person) => person.id === incident.target)?.name ?? incident.target;
        add(
          `tell:${listener}:${incident.target}:${observedTrait}`,
          `Tell ${name}: ${subject} is ${observedTrait}`,
          { type: 'tell', listener, target: incident.target, trait: observedTrait },
          0.65,
        );
        if (incident.target !== 'kemal') {
          add(
            `amends:${listener}:${incident.target}`,
            `Make amends to ${subject} with ${name}`,
            { type: 'make-amends', listener, target: incident.target },
            amendsPromise(listener, incident.target),
          );
          add(
            `ask:${listener}:${incident.target}`,
            `Ask ${name} about ${subject}`,
            { type: 'ask', listener, target: incident.target },
            0.6,
          );
        }
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
    if (input === undefined) throw new Error(`No currently offered action: ${id}`);
    if (typeof input === 'number') {
      this.speed = input;
      this.paceAnswers.push(id);
      return;
    }
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
      // The browser drops to Slow while a neighbour waits. Step through each
      // simulation minute so a question reached inside a large batch also slows it.
      if (this.game.s.newsWaiting) this.speed = 1;
      const rate = tod < 360 || tod >= 1380 ? 240 : this.speed;
      const boundary = tod < 360 ? day + 360 : tod < 1380 ? day + 1380 : day + 1440 + 360;
      const position = minute + this.carry;
      const span = Math.min(remaining, (boundary - position) / rate, (minute + 1 - position) / rate);
      const next = position + span * rate;
      const whole = Math.floor(next + 1e-8);
      this.carry = Math.max(0, next - whole);
      advance(this.game, whole);
      remaining -= span;
    }
  }
}
export const make = (seed: number) => new HearsayAdapter(seed);
