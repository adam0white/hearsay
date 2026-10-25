const places: Record<string, string> = {
  garden: 'at the garden',
  fountain: 'at the fountain',
  hospital: 'at the hospital',
  lodging: 'at the lodging',
  'temporary lodging (morning sleep)': 'sleeping at the temporary lodging',
  'delivery route': 'out delivering parcels',
  'own evening': 'busy with evening plans',
  'school kitchen': 'at the school kitchen',
  'agency appointment': 'at an agency appointment',
  'bread round': 'out delivering bread',
  'produce round': 'out delivering produce',
  'market stall': 'at the market stall',
  'own workplace': 'at work',
  'a quiet corner': 'in a quiet corner',
  'another tea stop': 'at another tea stop',
  'flat 5, Lale Apartmanı': 'at flat 5 in the Lale apartment building',
};
export function gardenPlace(place: string): string {
  return places[place] ?? place;
}
