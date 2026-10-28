/** Host stakes: a paid workers' lunch on Day 13. HF beliefs and source trust
 * determine who books and comes. Supplier agreements spend actual garden takings;
 * unpaid preparation remains a real debt and never disappears at departure.
 */
import {
  applyReputationBelief,
  confirm,
  confirmObservedReputation,
  credence,
  socialEvent,
  trustOf,
  violatesAbstention,
} from '@adam0white/hf-legacy';
import type { GardenRun } from './garden.ts';
import { GARDEN_CAST, GARDEN_IDS, type GardenPerson, gardenLocation } from './garden-cast.ts';
export type ReputationTrait = 'honest' | 'reliable' | 'kind' | 'generous';
export type PlanChoice =
  | 'paid-trial'
  | 'credit-trial'
  | 'decline-trial'
  | 'paid-prep'
  | 'unpaid-prep'
  | 'cancel'
  | 'settle';
export interface LunchState {
  cash: number;
  debt: number;
  takings: number;
  bread: boolean;
  breadDelivered: boolean;
  produceDelivered: boolean;
  produce: boolean;
  cook: boolean;
  prepared: boolean;
  trial: 'waiting' | 'paid' | 'credit' | 'missed';
  prep: 'waiting' | 'paid' | 'unpaid' | 'cancelled';
  pending?: 'trial' | 'prep';
  pendingUntil?: number;
  reservations: GardenPerson[];
  served: GardenPerson[];
  result: 'waiting' | 'open' | 'short' | 'cancelled';
  reason?: string;
  visits: Partial<Record<GardenPerson, number>>;
  avoidingUntil: Partial<Record<GardenPerson, number>>;
  closedUntil: number;
  confrontations: { person: GardenPerson; root: number; at: number; resolved?: 'own' | 'stand' }[];
}
export function lunchOpening(): LunchState {
  return {
    cash: 400,
    debt: 0,
    takings: 0,
    bread: false,
    breadDelivered: false,
    produceDelivered: false,
    produce: false,
    cook: false,
    prepared: false,
    trial: 'waiting',
    prep: 'waiting',
    reservations: [],
    served: [],
    result: 'waiting',
    visits: {},
    avoidingUntil: {},
    closedUntil: 0,
    confrontations: [],
  };
}
const say = (g: GardenRun, kind: string, text: string, person?: GardenPerson) =>
  g.log.push({ at: g.minute, kind, text, ...(person ? { person } : {}) });
export function actualGardenLocation(g: GardenRun, id: GardenPerson): string {
  if (
    id === 'osman' &&
    g.people.osman.agenda.commitments.some(
      (c) =>
        c.kind === 'job' &&
        c.actions.includes('work-market') &&
        ['pending', 'kept'].includes(c.status) &&
        c.from <= g.minute &&
        c.until > g.minute,
    )
  )
    return 'market stall';
  const life = g.chapter?.inputs.find((p) => p.parent.castId === GARDEN_CAST[id].castId)?.life;
  if (life && g.minute < 420 && id !== 'hatice' && life.place !== 'public-garden')
    return life.place === 'home' ? 'lodging' : 'own workplace';
  if (g.people[id].activity?.action.startsWith('pray')) return 'a quiet corner';
  const t = g.minute % 1440,
    day = Math.floor(g.minute / 1440) + 1;
  if (id === 'derya' && g.released)
    return t >= 480 && t < 780 ? 'temporary lodging (morning sleep)' : 'flat 5, Lale Apartmanı';
  const place =
    day === 13 && t >= 780 && t < 810 && g.lunch.reservations.includes(id) && ['dilan', 'ece'].includes(id)
      ? 'garden'
      : gardenLocation(id, g.minute);
  if (id === 'hatice' || !['garden', 'fountain'].includes(place)) return place;
  if (g.minute < g.lunch.closedUntil || (g.lunch.avoidingUntil[id] ?? 0) > g.minute)
    return 'another tea stop';
  return place;
}
export function planChoice(g: GardenRun, choice: PlanChoice): boolean {
  const l = g.lunch;
  if (choice === 'settle') {
    if (l.debt <= 0 || l.cash < l.debt) return false;
    l.cash -= l.debt;
    l.debt = 0;
    if (l.prep === 'unpaid' && g.minute < 9 * 1440 + 1020) l.cook = true;
    say(
      g,
      'payment',
      'You pay the outstanding preparation and supply invoice. You receive a receipt showing that the debt is paid.',
    );
    return true;
  }
  if (l.pending === 'trial') {
    if (!['paid-trial', 'credit-trial', 'decline-trial'].includes(choice)) return false;
    if (choice === 'paid-trial' && l.cash < 120) return false;
    l.trial = choice === 'paid-trial' ? 'paid' : choice === 'credit-trial' ? 'credit' : 'missed';
    l.bread = l.produce = choice !== 'decline-trial';
    if (choice === 'paid-trial') l.cash -= 120;
    if (choice === 'credit-trial') l.debt += 150;
    say(
      g,
      'agreement',
      choice === 'paid-trial'
        ? 'You pay for the Day 4 sample. Rıza agrees to bring the agreed number of loaves on Day 13. Osman agrees to a written produce order. These agreements do not show how Rıza and Osman behave at other times.'
        : choice === 'credit-trial'
          ? 'Osman supplies the sample on credit. You must pay the written invoice before the Day 13 lunch. Buying on credit costs more than paying now. Rıza agrees to the bread order.'
          : 'You decline the sample. No bread or produce is reserved for the lunch.',
    );
  } else if (l.pending === 'prep') {
    if (!['paid-prep', 'unpaid-prep', 'cancel'].includes(choice)) return false;
    if (choice === 'paid-prep' && l.cash < 180) return false;
    l.prep = choice === 'paid-prep' ? 'paid' : choice === 'unpaid-prep' ? 'unpaid' : 'cancelled';
    if (choice === 'paid-prep') {
      l.cash -= 180;
      l.cook = true;
    }
    if (choice === 'unpaid-prep') {
      l.debt += 180;
      l.cook = false;
    }
    say(
      g,
      'agreement',
      choice === 'paid-prep'
        ? 'You pay Aylin for the agreed preparation session after her school shift. She agrees to cook on Day 13 and leave at the agreed hour. Free use of the gate bench remains separate from paid food.'
        : choice === 'unpaid-prep'
          ? 'You record the preparation fee as money you owe instead. Aylin will not begin unpaid work. Her offer stays open only if the fee is paid before the preparation session at 17:00 on Day 10.'
          : 'You cancel the preparation. Aylin keeps the evening for herself. She has not promised to cook.',
    );
    l.reservations = GARDEN_IDS.filter((id) => id !== 'hatice' && wantsLunch(g, id));
    say(
      g,
      'reservations',
      l.reservations.length
        ? `${l.reservations.map((id) => GARDEN_CAST[id].name).join(', ')} ${l.reservations.length === 1 ? 'reserves one meal' : 'reserve a meal each'}, with the supply and cooking terms you agreed on. Anyone who hears something new may change a reservation.`
        : 'Nobody is willing to reserve a meal on the current terms. Ask what they have heard and correct what you can.',
    );
  } else return false;
  delete l.pending;
  delete l.pendingUntil;
  return true;
}
/** Each customer weighs distinct heard claims, not the author's true personality. */
export function wantsLunch(g: GardenRun, id: GardenPerson): boolean {
  const p = g.people[id];
  return (
    p.body.alive &&
    trustOf(p, 'hatice') >= 0.5 &&
    credence(p, 'osman:honest') >= 0.44 &&
    credence(p, 'aylin:reliable') >= 0.44 &&
    credence(p, 'riza:reliable') >= 0.44 &&
    credence(p, 'hatice:kind') >= 0.4
  );
}
/** Twelve authored public incidents replace the old flour/engagement household scenes. */
const ACTS: {
  person: GardenPerson;
  trait: ReputationTrait;
  truth: boolean;
  witness: GardenPerson;
  text: string;
}[] = [
  {
    person: 'osman',
    trait: 'honest',
    truth: false,
    witness: 'ece',
    text: 'At the back table Osman counts eight produce crates but writes ten on Hatice’s invoice. When she points to the count, he folds the paper unchanged. Ece is beside the table.',
  },
  {
    person: 'dilan',
    trait: 'honest',
    truth: true,
    witness: 'nermin',
    text: 'Dilan returns an extra payment for a parcel. She shows Hatice the amount and marks the return on the receipt. Nermin sees the exchange.',
  },
  {
    person: 'aylin',
    trait: 'reliable',
    truth: true,
    witness: 'derya',
    text: 'Aylin brings the agreed sample before leaving for the school kitchen. She labels the ingredients and the delivery time. Derya collects the breakfast portion as agreed.',
  },
  {
    person: 'ece',
    trait: 'kind',
    truth: true,
    witness: 'riza',
    text: 'Ece gives up the shaded seat to Derya after her night shift, without asking her to explain why she is tired. Rıza brings a second chair.',
  },
  {
    person: 'nermin',
    trait: 'honest',
    truth: true,
    witness: 'dilan',
    text: 'Nermin corrects her answer to a work enquiry in front of Dilan. She has not confirmed that someone can do the work and will not yet promise to place a worker at that address.',
  },
  {
    person: 'riza',
    trait: 'reliable',
    truth: true,
    witness: 'aylin',
    text: 'Rıza brings the bread order at the agreed delivery time. He and Aylin check the count before she leaves. Rıza is the delivery helper.',
  },
  {
    person: 'derya',
    trait: 'kind',
    truth: true,
    witness: 'osman',
    text: 'Derya asks Osman to leave the path clear for a tired visitor, then helps move the empty crate. She refuses to discuss any patient at the table.',
  },
  {
    person: 'hatice',
    trait: 'generous',
    truth: true,
    witness: 'ece',
    text: 'Hatice puts drinking water at the gate without requiring an order. Ece checks that the offer includes workers who buy no tea.',
  },
  {
    person: 'osman',
    trait: 'honest',
    truth: true,
    witness: 'riza',
    text: 'Osman returns the corrected eight-crate invoice and hands Hatice the overcharge. Rıza checks the receipt. Osman still owes his former tenant money from a separate account.',
  },
  {
    person: 'aylin',
    trait: 'reliable',
    truth: true,
    witness: 'nermin',
    text: 'Aylin keeps the agreed preparation appointment after her school shift. Nermin sees the written leaving time. Neither offers to do extra work without pay.',
  },
  {
    person: 'riza',
    trait: 'kind',
    truth: true,
    witness: 'dilan',
    text: 'Rıza waits while Dilan finishes her delivery call rather than repeating a rumour over her voice. He leaves her bread order where she can find it.',
  },
  {
    person: 'hatice',
    trait: 'honest',
    truth: true,
    witness: 'derya',
    text: 'Hatice shows Derya the lunch account, including any unpaid invoice. She does not say that a payment has been made when it has only been promised.',
  },
  {
    person: 'ece',
    trait: 'reliable',
    truth: true,
    witness: 'osman',
    text: 'Ece checks the free bench hours again before sharing the small workers’ map. Osman hears Hatice confirm the hours. The map is not a paid-meal reservation.',
  },
  {
    person: 'dilan',
    trait: 'kind',
    truth: true,
    witness: 'aylin',
    text: 'Dilan asks whether Aylin has time to talk before sitting down. Aylin keeps her own evening free. There is still more for the sisters to settle.',
  },
];
export function stakesStep(g: GardenRun, here: (id: GardenPerson) => boolean): void {
  const l = g.lunch,
    t = g.minute % 1440,
    day = Math.floor(g.minute / 1440) + 1;
  if (l.pendingUntil !== undefined && g.minute >= l.pendingUntil) {
    say(
      g,
      'missed',
      `The deadline for the Day ${day} agreement passes without your answer. You have not agreed to anything.`,
    );
    if (l.pending === 'trial') l.trial = 'missed';
    else l.prep = 'cancelled';
    delete l.pending;
    delete l.pendingUntil;
  }
  if ((t === 390 && day !== 10) || (day === 10 && t === 1020)) {
    const authored = ACTS[day - 1];
    const act =
      day === 10 && (!l.cook || !here('aylin'))
        ? undefined
        : day === 13 && !(g.discoveries.ece && g.benchFree)
          ? {
              person: 'ece' as const,
              trait: 'reliable' as const,
              truth: true,
              witness: 'osman' as const,
              text: 'Ece hands over the parcel receipt at the agreed time. Osman sees this delivery. It tells you nothing about her private interests or her other deliveries.',
            }
          : authored;
    if (act) {
      if (day === 10) l.prepared = true;
      say(g, 'witnessed', act.text, act.person);
      // Only those present at this exchange receive firsthand evidence.
      for (const witness of ['hatice', act.witness] as GardenPerson[]) {
        if (!here(witness)) continue;
        const p = g.people[witness],
          prop = `${act.person}:${act.trait}`,
          before = credence(p, prop);
        const disproved = g.config
          ? confirmObservedReputation(p, prop, act.truth, g.minute)
          : confirm(p, prop, act.truth, g.minute);
        if (!g.config) applyReputationBelief(p, prop, before, credence(p, prop), g.minute);
        for (const source of disproved) {
          if (!GARDEN_IDS.includes(source as GardenPerson)) continue;
          p.memory.sourceTrust[source] = Math.max(0, trustOf(p, source) - 0.12);
        }
        for (const route of g.routes.filter(
          (r) => r.to === witness && r.prop === prop && r.value !== act.truth && !r.retractedAt,
        )) {
          route.contradictedAt ??= g.minute;
          const root = route.root ?? route.id;
          if (
            g.routes.find((r) => r.id === root)?.from === 'hatice' &&
            !l.confrontations.some((c) => c.root === root)
          )
            l.confrontations.push({ person: act.person, root, at: g.minute + 30 });
        }
      }
    }
  }
  if (t === 420 || t === 780) {
    for (const id of GARDEN_IDS.filter((id) => id !== 'hatice')) {
      const p = g.people[id];
      if (trustOf(p, 'hatice') < 0.48 || credence(p, 'hatice:kind') < 0.35)
        l.avoidingUntil[id] = Math.floor(g.minute / 1440) * 1440 + 1320;
      if (
        here(id) &&
        !p.agenda.commitments.some(
          (c) =>
            c.kind === 'abstain' &&
            c.status === 'pending' &&
            violatesAbstention(c, 'tea', g.minute, g.minute + 1),
        )
      ) {
        l.visits[id] = (l.visits[id] ?? 0) + 1;
        l.cash += 20;
        l.takings += 20;
      }
    }
    say(
      g,
      'custom',
      GARDEN_IDS.filter((id) => id !== 'hatice' && here(id)).length
        ? 'Customers who still trust you pay for their tea. Those who avoid the garden spend elsewhere.'
        : 'The benches are empty. You earn no money from tea.',
    );
  }
  if (t === 720 && (day === 4 || day === 8)) {
    l.pending = day === 4 ? 'trial' : 'prep';
    l.pendingUntil = g.minute + 120;
    say(
      g,
      'milestone',
      day === 4
        ? 'Day 4: Rıza and Osman offer an order for bread and produce in agreed amounts for the Day 13 workers’ lunch. Decide whether to pay for the sample now, agree in writing to pay later or decline it.'
        : 'Day 8: Aylin offers a paid cooking session with an agreed time to leave. Decide how to pay for preparation. Customers will decide whether to reserve a meal based on what they have heard.',
    );
  }
  for (const c of l.confrontations) {
    if (
      !c.resolved &&
      g.minute >= c.at &&
      here(c.person) &&
      !g.log.some((e) => e.kind === 'confrontation' && e.person === c.person && e.at >= c.at)
    )
      say(
        g,
        'confrontation',
        `${GARDEN_CAST[c.person].name} traces the disproved claim back to you. “Will you correct what you said to the people who heard it, or stand by it?”`,
        c.person,
      );
  }
  if (day === 13 && t >= 750 && t < 780) {
    if (l.bread && !l.breadDelivered && here('riza')) {
      l.breadDelivered = true;
      say(
        g,
        'delivery',
        'Rıza hands over the agreed number of loaves for lunch. Hatice checks the loaf count and signs the delivery receipt.',
        'riza',
      );
    }
    if (l.produce && !l.produceDelivered && l.debt === 0 && here('osman')) {
      l.produceDelivered = true;
      say(
        g,
        'delivery',
        'Osman unloads the agreed produce. Hatice checks the invoice and the settled account before accepting it.',
        'osman',
      );
    }
  }
  if (day === 13 && t === 780 && l.result === 'waiting') {
    const supplies =
      l.breadDelivered && l.produceDelivered && l.cook && l.prepared && l.debt === 0 && l.cash >= 80;
    l.served = supplies ? l.reservations.filter((id) => wantsLunch(g, id) && here(id)) : [];
    l.result = !supplies ? 'cancelled' : l.served.length >= (l.trial === 'credit' ? 5 : 4) ? 'open' : 'short';
    l.reason = !supplies
      ? 'The lunch cannot open. You need both deliveries, completed paid preparation, all invoices paid and 80 lira for food. At least one of these is missing.'
      : l.served.length >= (l.trial === 'credit' ? 5 : 4)
        ? 'The paid lunch opens. Meal sales pay for the sample, paid preparation and food.'
        : 'The food is ready, but too few customers come. The lunch loses money.';
    if (supplies) {
      l.cash -= 80;
      l.cash += l.served.length * 100;
    }
    say(
      g,
      'lunch-result',
      `${l.reason} ${l.served.length ? `${l.served.map((id) => GARDEN_CAST[id].name).join(', ')} ${l.served.length === 1 ? 'sits down and pays for one meal' : 'sit down and pay for their meals'}.` : 'No paid lunch is served.'}`,
    );
  }
}
export function answerConfrontation(g: GardenRun, person: GardenPerson, choice: 'own' | 'stand'): boolean {
  const c = g.lunch.confrontations.find((c) => c.person === person && !c.resolved && c.at <= g.minute);
  if (!c) return false;
  c.resolved = choice;
  const p = g.people[person];
  if (choice === 'own') {
    socialEvent(p, { at: g.minute, kind: 'apology', otherId: 'hatice', byMe: false, magnitude: 0.25 });
    say(
      g,
      'confrontation-answer',
      'You take responsibility for the claim. You agree to withdraw it with each listener. People may still have repeated it to others.',
      person,
    );
  } else {
    socialEvent(p, { at: g.minute, kind: 'conflict', otherId: 'hatice', byMe: false, magnitude: 0.4 });
    p.memory.sourceTrust.hatice = Math.max(0, trustOf(p, 'hatice') - 0.2);
    g.lunch.closedUntil = g.minute + 1440;
    say(
      g,
      'confrontation-answer',
      'You stand by the disproved claim. The person leaves, and people hear about the confrontation and stop visiting the garden until tomorrow. No tea is sold during that closure.',
      person,
    );
  }
  return true;
}

export function reserveLunch(g: GardenRun, id: GardenPerson): boolean {
  if (
    id === 'hatice' ||
    g.minute < 7 * 1440 + 720 ||
    g.minute >= 12 * 1440 + 780 ||
    g.lunch.result !== 'waiting'
  )
    return false;
  const yes = wantsLunch(g, id);
  g.lunch.reservations = g.lunch.reservations.filter((other) => other !== id);
  if (yes) g.lunch.reservations.push(id);
  say(
    g,
    'reservation',
    yes
      ? `${GARDEN_CAST[id].name} books one paid meal for Day 13 at 13:00. The reservation does not cancel any work commitments.`
      : `${GARDEN_CAST[id].name}: “I will not book yet. First I need to trust your word, ${id === 'osman' ? 'my invoice' : 'Osman’s invoice'}, ${id === 'aylin' ? 'my own timing' : 'Aylin’s timing'} and ${id === 'riza' ? 'my delivery' : 'Rıza’s delivery'}. Ask me what I have heard.”`,
    id,
  );
  return true;
}
