/** Authored local chapter boundaries. This module does not know a shelf or a life API.
 * It never clears an HF goal, duty, injury, family tie or project. The released
 * passport validator must still decide what can travel. Whole prefixes stay local.
 */
import { type Person, snapshot } from '@adam0white/hf-legacy';
import type { GardenRun } from './garden.ts';
import { GARDEN_CAST, type GardenPerson } from './garden-cast.ts';
import { departureReason } from './garden-departure-rules.ts';

export { departureReason } from './garden-departure-rules.ts';
export interface GardenDeparture {
  person: Person;
  sourcePrefix: GardenRun;
  chapter: string;
  limitations: string[];
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
      'The full garden record, claims about other people and relationships that cannot transfer stay in the saved Hearsay archive.',
      ...(id === 'osman'
        ? [
            'The tenant’s rent account from Voice is separate from this garden invoice. The rent debt has not been forgiven.',
          ]
        : []),
      ...(id === 'derya'
        ? ['The final relief assignment is over. Derya still needs her morning sleep when she travels.']
        : []),
    ],
  };
}
