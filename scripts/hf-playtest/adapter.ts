/** Bounded synthetic control of the current local garden, not a player round,
 * full-fortnight proof or shared-person journey. Selection and reading mirror
 * garden-app; observations use its public record and Hatice's readings only.
 * Complete exports are recovery data, never playtester observations.
 */
import { GARDEN_CAST, GARDEN_IDS, type GardenPerson } from '../../src/sim/garden-cast.ts';
import {
  advanceGarden,
  chooseGarden,
  freshGarden,
  type GardenInput,
  type GardenRun,
  gardenHere,
  gardenStanding,
} from '../../src/sim/garden4.ts';
import { exportGarden } from '../../src/sim/garden4-export.ts';
import { actualGardenLocation, type PlanChoice, type ReputationTrait } from '../../src/sim/garden4-stakes.ts';
import { gardenPlace } from '../../src/ui/garden-english.ts';
import { gardenReadings } from '../../src/ui/garden-readings.ts';
import { gardenPace } from '../../src/ui/garden-ui-pace.ts';

type Control = GardenInput | { select: GardenPerson } | { pace: number | null } | { finish: true };
type Action = { id: string; label: string; kind: string; promise: number };
type Event = { kind: string; summary: string; valence: number; salience: number; answers: false | string[] };

export class HearsayAdapter {
  name = 'hearsay-hf4/1';
  game: GardenRun;
  selected: GardenPerson = 'riza';
  pace: number | null = null;
  carry = 0;
  private seen = 0;
  private readingSeconds = 0;
  private answers = new Map<number, string>();
  private notice = '';
  private offered = new Map<string, Control>();

  constructor(seed: number) {
    this.game = freshGarden(seed);
  }

  observe() {
    const g = this.game;
    const day = Math.min(14, Math.floor(g.minute / 1440) + 1);
    const time = g.minute % 1440;
    const events: Event[] = g.log.slice(Math.max(this.seen, g.log.length - 60)).map((line, offset) => {
      const index = Math.max(this.seen, g.log.length - 60) + offset;
      const answer = this.answers.get(index);
      return {
        kind: line.kind,
        summary: line.text,
        valence: 0,
        salience: 0.55,
        answers: answer ? [answer] : false,
      };
    });
    this.seen = g.log.length;
    this.answers.clear();
    const c = GARDEN_CAST[this.selected];
    const discovery = g.discoveries[this.selected];
    const panel = [`${c.name}: ${c.job}. ${gardenPlace(actualGardenLocation(g, this.selected))}.`];
    if (g.lunch.pending) {
      panel.splice(
        0,
        panel.length,
        g.lunch.pending === 'trial' ? 'Day 4 · Reserve the supplies' : 'Day 8 · Agree on paid cooking',
      );
      panel.push(
        'Each meal sells for 100 lira. Selling four meals pays for the sample, preparation and food, which cost 380 lira if you pay now. Buying the sample on credit means paying later. It raises the total cost to 410 lira, so you need to sell five meals.',
        g.lunch.pending === 'trial'
          ? 'Rıza will deliver the agreed number of loaves. Osman will supply the produce with a written order. Pay for a sample now, agree to pay a higher price later, or decline the sample.'
          : 'Aylin offers to prepare food after her school shift. She gives a time when she must leave. Pay her 180-lira fee before the preparation session at 17:00 on Day 10. Anyone may still use the free bench without buying food.',
        'The clock is paused while you decide. These payments come from your garden cash. A promise to pay does not count as payment.',
      );
    } else if (g.ended) {
      panel.splice(
        0,
        panel.length,
        g.lunch.result === 'open'
          ? 'The workers’ lunch opened'
          : g.lunch.result === 'short'
            ? 'The lunch made a loss'
            : 'The lunch could not open',
      );
      panel.push(g.lunch.reason ?? 'No lunch result was recorded.');
    } else {
      panel.push(...gardenReadings(g, this.selected));
      if (g.chat)
        panel.push(
          g.chat.person === this.selected
            ? `${this.selected === 'hatice' ? 'You are reflecting on your past for fifteen minutes' : 'You are in a fifteen-minute conversation'}. It finishes at ${Math.floor((g.chat.until % 1440) / 60)}:${String(g.chat.until % 60).padStart(2, '0')}. You can leave early.`
            : `You are listening to ${GARDEN_CAST[g.chat.person].name}. Finish or leave that conversation first.`,
        );
      else if (discovery)
        panel.push(c.family, discovery.fact, ...(discovery.outcome ? [discovery.outcome] : []));
      else
        panel.push(
          gardenHere(g, this.selected) ? c.cue : `${c.name} is away or unavailable. Try again later.`,
        );
      const confrontation = g.lunch.confrontations.find(
        (row) => row.person === this.selected && !row.resolved && row.at <= g.minute,
      );
      if (confrontation)
        panel.splice(
          0,
          panel.length,
          `${c.name} confronts you. Someone found that the disproved claim came from you. Agree to correct it with each person who heard it, or stand by it and lose a day of tea sales.`,
        );
    }
    if (this.notice) panel.push(this.notice);
    const lunch = `Day 13 lunch: ${g.lunch.breadDelivered ? 'The bread has been delivered.' : g.lunch.bread ? 'The bread is ordered.' : 'The bread is not ordered.'} ${g.lunch.produceDelivered ? 'The produce has been delivered.' : g.lunch.produce ? 'The produce is ordered.' : 'The produce is not ordered.'} ${g.lunch.prepared ? 'The food has been prepared.' : g.lunch.cook ? 'Paid cooking is arranged.' : 'Paid cooking is not arranged.'} Meals reserved: ${g.lunch.reservations.length}/${g.lunch.trial === 'credit' ? 5 : 4}.`;
    const status = [
      this.pace === null
        ? 'Pace: Automatic. The garden slows while you read.'
        : 'The garden slows while you read. Automatic pace is available in the game menu.',
      lunch,
      `You have ${g.lunch.cash} lira. You owe ${g.lunch.debt} lira.`,
      gardenStanding(g),
    ];
    return {
      clock: `Day ${day} · ${String(Math.floor(time / 60)).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`,
      phase: g.ended ? 'review' : g.lunch.pending ? 'agreement' : 'play',
      goal: g.ended ? '' : 'Your goal is to serve a paid workers’ lunch on Day 13.',
      next: panel.join(' '),
      chapter: `day ${day}`,
      events,
      text: [...status, ...panel].map((text) => ({ level: 'now' as const, text })),
      loops: g.ended ? [] : [lunch, ...(g.lunch.debt ? [`Unpaid invoice: ${g.lunch.debt} lira.`] : [])],
      features: { pressure: g.lunch.pending ? 0.6 : 0.1, openLoop: g.ended ? 0 : 0.65 },
      over: g.ended,
      ...(g.ended
        ? {
            outcome:
              g.lunch.result === 'open'
                ? ('win' as const)
                : g.lunch.result === 'short'
                  ? ('mixed' as const)
                  : ('loss' as const),
          }
        : {}),
    };
  }

  actions(): Action[] {
    const g = this.game;
    const id = this.selected;
    const here = gardenHere(g, id);
    const actions: Action[] = [];
    this.offered.clear();
    const add = (key: string, label: string, input: Control, kind: string) => {
      this.offered.set(key, input);
      actions.push({ id: key, label, kind, promise: 0.5 });
    };
    if (g.ended) return actions;
    for (const person of GARDEN_IDS)
      if (person !== id)
        add(`select:${person}`, `Select ${GARDEN_CAST[person].name}`, { select: person }, 'select');
    for (const [index, rate] of [0, 1, 4, 12].entries())
      add(`pace:${rate}`, ['Pause', 'Slow', 'Normal', 'Fast'][index] ?? '', { pace: rate }, 'pace');
    add('automatic', 'Use automatic pace', { pace: null }, 'pace');
    const plan = (choice: PlanChoice, label: string) =>
      add(`plan:${choice}`, label, { type: 'plan', choice }, 'plan');
    const conversation = () => {
      if (!g.chat) return;
      add(
        'finish',
        g.lunch.pending ? 'Finish the current conversation first' : 'Let the conversation finish',
        { finish: true },
        'finish',
      );
      add('release', 'Leave the conversation', { type: 'release', person: g.chat.person }, 'release');
    };
    if (g.lunch.pending === 'trial') {
      plan('paid-trial', 'Pay 120 lira for the sample now');
      plan('credit-trial', 'Get the sample now and pay 150 lira before lunch');
      plan('decline-trial', 'Decline the sample and reserve no supplies');
      conversation();
    } else if (g.lunch.pending === 'prep') {
      plan('paid-prep', 'Pay 180 lira for the preparation session');
      plan('unpaid-prep', 'Agree to pay 180 lira before preparation');
      plan('cancel', 'Cancel the lunch preparation');
      conversation();
    } else {
      const confrontation = g.lunch.confrontations.find(
        (row) => row.person === id && !row.resolved && row.at <= g.minute,
      );
      if (confrontation) {
        if (here) {
          add(
            'confront:own',
            'Take responsibility and agree to correct the claim',
            { type: 'confront', person: id, choice: 'own' },
            'confront',
          );
          add(
            'confront:stand',
            'Stand by the disproved claim',
            { type: 'confront', person: id, choice: 'stand' },
            'confront',
          );
        }
      } else if (g.chat) {
        if (g.chat.person === id) conversation();
        else add('chat', 'Go to the conversation', { select: g.chat.person }, 'select');
      } else if (here) {
        const discovery = g.discoveries[id];
        if (discovery && !discovery.response) {
          for (const [choice, label] of [
            ['support', 'Offer practical help and keep this private'],
            ['keep', 'Keep this private'],
            ['spread', 'Repeat this at another table'],
          ] as const)
            add(`respond:${choice}`, label, { type: 'respond', person: id, choice }, 'respond');
        } else {
          add(
            'listen',
            discovery
              ? 'Sit and talk again'
              : id === 'hatice'
                ? 'Reflect on your past for fifteen minutes'
                : 'Invite a quiet conversation',
            { type: 'listen', person: id, approach: 'invite' },
            'listen',
          );
          if (!discovery && id !== 'hatice')
            add(
              'pry',
              'Press for private details',
              { type: 'listen', person: id, approach: 'pry' },
              'listen',
            );
        }
      }
      if (!g.chat && here && id !== 'hatice') {
        if (g.minute >= 7 * 1440 + 720 && g.minute < 12 * 1440 + 780)
          add('reserve', 'Invite them to book the Day 13 lunch', { type: 'reserve', person: id }, 'reserve');
        // These compose the public Who/What selectors with a claim button; no
        // belief, truth, source graph or private author fact selects a claim.
        const traits: Record<ReputationTrait, string> = {
          reliable: 'Keeping promises',
          honest: 'Honesty',
          kind: 'Kindness',
          generous: 'Generosity',
        };
        for (const about of GARDEN_IDS.filter((person) => person !== id && person !== 'hatice')) {
          for (const [trait, words] of Object.entries(traits)) {
            for (const [type, label] of [
              ['ask', 'Ask what they have heard'],
              ['defend', 'Make a positive claim about this trait'],
              ['tell', 'Make a damaging claim about this trait'],
              ['amends', 'Withdraw your accusation'],
            ] as const)
              add(
                `${type}:${about}:${trait}`,
                `${label}: ${GARDEN_CAST[about].name} · ${words}`,
                { type, person: id, about, trait: trait as ReputationTrait },
                type,
              );
          }
        }
      }
    }
    if (!g.chat) add('silence', 'Pour tea without sharing news', { type: 'silence' }, 'silence');
    if (g.lunch.debt > 0 && g.lunch.cash >= g.lunch.debt)
      plan('settle', `Pay the ${g.lunch.debt} lira invoice`);
    return actions;
  }

  apply(id: string): void {
    // A stale action must still be on the current public panel. Willingness is
    // decided only by chooseGarden, including its ordinary refusal and input log.
    this.actions();
    const control = this.offered.get(id);
    if (!control) throw new Error(`No currently offered action: ${id}`);
    if (!('pace' in control) || id === 'automatic') this.readingSeconds = 15;
    this.notice = '';
    if ('select' in control) this.selected = control.select;
    else if ('pace' in control) {
      this.pace = control.pace;
      this.carry = 0;
    } else if ('finish' in control) {
      if (this.game.chat) advanceGarden(this.game, this.game.chat.until);
    } else {
      const first = this.game.log.length;
      if (!chooseGarden(this.game, control))
        this.notice = 'This person cannot do this now. Try again later, or keep the matter private.';
      else for (let index = first; index < this.game.log.length; index++) this.answers.set(index, id);
    }
  }

  advance(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds < 0) throw new Error('Invalid elapsed play time');
    let remaining = seconds;
    while (remaining > 1e-9 && !this.game.ended && !this.game.lunch.pending) {
      const discovery = this.game.discoveries[this.selected];
      const rate = gardenPace(
        this.pace,
        this.readingSeconds > 0 || !!this.game.chat || !!(discovery && !discovery.response),
      );
      if (!rate) break;
      const span = Math.min(
        remaining,
        (1 - this.carry) / rate,
        this.readingSeconds > 0 ? this.readingSeconds : Infinity,
      );
      this.carry += span * rate;
      this.readingSeconds = Math.max(0, this.readingSeconds - span);
      remaining -= span;
      if (this.carry >= 1 - 1e-9) {
        this.carry = 0;
        advanceGarden(this.game, Math.min(14 * 1440, this.game.minute + 1));
      }
    }
  }

  export() {
    return exportGarden(this.game);
  }
}
export const make = (seed: number) => new HearsayAdapter(seed);
