/** Authored world obligations apply to every garden engine edition. */
import type { GardenPerson } from './garden-cast.ts';
export interface GardenDepartureState {
  people: Record<GardenPerson, { body: { alive: boolean }; activity?: unknown }>;
  ended: boolean;
  gardenCovered: boolean;
  released: boolean;
  minute: number;
  lunch: {
    debt: number;
    bread: boolean;
    produce: boolean;
    cook: boolean;
    result: string;
    reservations: GardenPerson[];
  };
}
export function departureReason(g: GardenDepartureState, id: GardenPerson): string | undefined {
  const p = g.people[id];
  if (!p.body.alive) return 'This chapter cannot treat death as travel.';
  if (p.activity) return 'Finish or explicitly leave the current activity first.';
  if (id === 'hatice') {
    if (!g.ended && !g.gardenCovered)
      return 'Nobody has agreed to run the garden for Hatice. She still has duties here.';
    if (g.lunch.debt) return 'The garden invoice is still unpaid. Leaving does not clear the debt.';
  }
  if (id === 'derya' && !g.released)
    return 'Derya’s final relief night has not ended. Her morning sleep is still required.';
  if (id === 'riza' && g.lunch.bread && g.lunch.result === 'waiting')
    return 'The agreed bread delivery and lunch visit are still ahead.';
  if (id === 'osman' && g.lunch.produce && g.lunch.result === 'waiting')
    return 'The agreed produce delivery and garden account are still ahead.';
  if (id === 'aylin' && g.lunch.cook && g.lunch.result === 'waiting')
    return 'The paid preparation and lunch service are still ahead.';
  if (g.lunch.reservations.includes(id) && g.lunch.result === 'waiting')
    return 'This person still has a reserved lunch visit. Keep that appointment before departure.';
  if (!g.ended && Math.floor(g.minute / 1440) < 12)
    return 'This visit has not reached its agreed ending yet.';
  return undefined;
}
