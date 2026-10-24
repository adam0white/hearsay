/** Authored local chapter boundaries. This module does not know a shelf or a life API.
 * It never clears an HF goal, duty, injury, family tie or project. The released
 * passport validator must still decide what can travel. Whole prefixes stay local.
 */
import { type Person, snapshot } from '@adam0white/human-framework';
import type { GardenRun } from './garden.ts';
import { GARDEN_CAST, type GardenPerson } from './garden-cast.ts';
export interface GardenDeparture {
  person: Person;
  sourcePrefix: GardenRun;
  chapter: string;
  limitations: string[];
}
export function departureReason(g: GardenRun, id: GardenPerson): string | undefined {
  const p = g.people[id];
  if (!p.body.alive) return 'This chapter cannot treat death as travel.';
  if (p.activity) return 'Finish or explicitly leave the current activity first.';
  if (id === 'hatice') {
    if (!g.ended && !g.gardenCovered) return 'The garden has no agreed cover. Hatice’s duties stay here.';
    if (g.lunch.debt) return 'The garden invoice remains unpaid. A new chapter cannot clear it.';
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
    return 'This local visit has not reached its agreed closing chapter yet.';
  return undefined;
}
export function prepareGardenDeparture(g: GardenRun, id: GardenPerson): GardenDeparture {
  const reason = departureReason(g, id);
  if (reason) throw new Error(reason);
  return {
    person: snapshot(g.people[id]),
    sourcePrefix: structuredClone(g),
    chapter: `hearsay-closing:${id}:${g.minute}`,
    limitations: [
      `${GARDEN_CAST[id].name} leaves only this completed garden visit; permanent work and family are not erased.`,
      'The full garden account, third-person claims and unsupported relationships remain in the named local Hearsay source archive.',
      ...(id === 'osman'
        ? [
            'The Voice tenant/rent account is separate from this garden invoice; no debt forgiveness is inferred.',
          ]
        : []),
      ...(id === 'derya'
        ? ['The final relief assignment is over. Morning sleep is not assumed completed by travel.']
        : []),
    ],
  };
}
