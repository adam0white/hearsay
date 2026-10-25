const places: Record<string, string> = {
  garden: 'at the garden',
  fountain: 'at the fountain',
  hospital: 'at the hospital',
  lodging: 'at their lodging',
  'temporary lodging (morning sleep)': 'sleeping at their temporary lodging',
  'delivery route': 'out delivering parcels',
  'own evening': 'spending the evening on their own plans',
  'school kitchen': 'at the school kitchen',
  'agency appointment': 'at an agency appointment',
  'bread round': 'out delivering bread',
  'produce round': 'out delivering produce',
  'market stall': 'at the market stall',
  'own workplace': 'at their workplace',
  'a quiet corner': 'in a quiet corner',
  'another tea stop': 'at another tea stop',
  'flat 5, Lale Apartmanı': 'at flat 5, Lale Apartmanı',
};
export function gardenPlace(place: string): string {
  return places[place] ?? place;
}
