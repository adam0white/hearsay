/** Public profiles come from the released canonical artifact. Private facts stay author-side. */

import { createPerson, type Person } from '@adam0white/human-framework';
import { canonicalCast, castForGame } from '@adam0white/lab-client';
export const GARDEN_EDITION = 'hearsay-cast/6';
export const GARDEN_CAST = {
  hatice: {
    castId: 'hf.cast.hatice.hearsay',
    revision: '1',
    name: 'Hatice',
    age: 48,
    sex: 'female',
    job: 'Tea-garden keeper',
    family: 'Widowed; her grown child lives outside the district.',
    profile: { honesty: 0.85, extraversion: 0.7, conscientiousness: 0.7, agreeableness: 0.6 },
    cue: 'The old reception account is still in your drawer.',
    fact: 'You encouraged a couple to spend more on their wedding. You called your contribution a gift while privately expecting them to book the garden. You later complained about their ingratitude.',
    repair:
      'You separate the gift from your unspoken expectation and correct your complaint at the tables where you repeated it.',
    refusal: 'You leave the old account closed. Calling it generosity does not settle the unspoken bargain.',
  },
  derya: {
    castId: 'hf.cast.derya.stairwell',
    revision: '2',
    name: 'Derya',
    age: 44,
    sex: 'female',
    job: 'Night nurse on a short relief assignment',
    family: 'Single; temporary lodging near the garden. Her home is flat 5, Lale Apartmanı.',
    profile: { honesty: 0.7, extraversion: 0.35, agreeableness: 0.6, emotionality: 0.5, openness: 0.55 },
    cue: 'Derya folds an unfinished training enquiry before ordering breakfast.',
    fact: 'Derya reported a scheduling error before anyone was harmed. Training invitations then stopped. She kept the correspondence, but does not know whether the events were connected.',
    repair:
      'Derya writes a precise request for an explanation. Hatice helps check the wording; no reply or training place is promised.',
    refusal:
      'Derya puts the correspondence away. Her work and family are private; she has not asked the garden to investigate.',
  },
  dilan: {
    castId: 'hf.cast.dilan.murmur',
    revision: '2',
    name: 'Dilan',
    age: 33,
    sex: 'female',
    job: 'Parcel delivery visitor',
    family: 'Aylin’s younger sister. Their mother lives elsewhere.',
    profile: {
      honesty: 0.68,
      conscientiousness: 0.48,
      emotionality: 0.62,
      extraversion: 0.45,
      agreeableness: 0.6,
    },
    cue: 'Dilan checks an old route slip, then looks toward Ece.',
    fact: 'Dilan once covered Ece’s missed delivery and let Murat believe the delay was hers. She expected thanks without asking; Ece thought the matter was settled.',
    repair:
      'Dilan asks Ece for a short conversation about the actual route slip. She names her unspoken expectation instead of sending an accusation through Hatice.',
    refusal: 'Dilan keeps the slip. Hatice has no permission to turn the old delivery into public news.',
  },
  nermin: {
    castId: 'hf.cast.nermin.goodhands',
    revision: '1',
    name: 'Nermin',
    age: 45,
    sex: 'female',
    job: 'Visiting agency operator; formerly an alterations tailor',
    family: 'Her grown foster daughter lives independently.',
    profile: {
      honesty: 0.75,
      agreeableness: 0.65,
      conscientiousness: 0.75,
      extraversion: 0.6,
      emotionality: 0.5,
      openness: 0.65,
    },
    cue: 'Nermin asks for a quiet table to review her own agency practice.',
    fact: 'In a placement she called a mismatch, Nermin softened a worker’s concern about unpaid nights. She refunded part of the client’s fee before checking what the worker had lost.',
    repair:
      'With Nermin’s consent, you review her account without client names. She drafts a correction and a request to the worker for the unpaid hours she can substantiate; payment and forgiveness remain unresolved.',
    refusal:
      'Nermin closes the case review. Professional confidentiality is not a hint that Hatice may repeat.',
  },
  aylin: {
    castId: 'hf.cast.aylin.murmur',
    revision: '1',
    name: 'Aylin',
    age: 36,
    sex: 'female',
    job: 'School kitchen cook',
    family: 'Dilan’s older sister; their mother is background.',
    profile: {
      honesty: 0.8,
      conscientiousness: 0.8,
      extraversion: 0.55,
      agreeableness: 0.65,
      emotionality: 0.55,
      openness: 0.55,
    },
    cue: 'Aylin declines an evening cooking request with an unusually cheerful smile.',
    fact: 'Aylin has been learning social dance above a tyre shop. She likes being a beginner where nobody expects her to organise the evening. Her class partner is a neighbour, not a secret romance.',
    repair:
      'Aylin keeps the evening free and goes to class on her own terms. You do not turn it into family news or an obligation to perform.',
    refusal: 'Aylin says she has an evening of her own. She owes no further explanation.',
  },
  ece: {
    castId: 'hf.cast.ece.murmur',
    revision: '1',
    name: 'Ece',
    age: 24,
    sex: 'female',
    job: 'Courier and part-time logistics student',
    family: 'Lives with an aunt; her parents live elsewhere.',
    profile: {
      honesty: 0.65,
      conscientiousness: 0.7,
      extraversion: 0.65,
      agreeableness: 0.55,
      emotionality: 0.45,
      openness: 0.75,
    },
    cue: 'Ece asks whether anyone may sit at the garden gate without ordering.',
    fact: 'Ece maps places where workers can sit without buying anything. She notes shade, backs on seats and closing hours. This is a personal map, not an official accessibility survey.',
    repair:
      'You agree that the gate bench is free to use during opening hours. Ece checks the hours with you before adding it to the workers’ map.',
    refusal: 'Ece keeps the map informal. Nobody has permission to brand it as a garden promotion.',
  },
  riza: {
    castId: 'hf.cast.riza.voice',
    revision: '1',
    name: 'Rıza',
    age: 63,
    sex: 'male',
    job: 'Retired worker; part-time bread-delivery helper',
    family: 'His grown daughter lives away. He visits Istanbul occasionally.',
    profile: { extraversion: 0.7, agreeableness: 0.7, honesty: 0.65, conscientiousness: 0.45 },
    cue: 'Rıza asks which lane has the blue tiled doorway.',
    fact: 'Rıza keeps doorway sketches and photographs after his daughter sent a picture she thought he would like. He has not shown the collection because he does not want his quiet interest turned into a performance.',
    repair:
      'Rıza marks a short public-street walk to offer his daughter. You leave private courtyards out and let him decide whether to invite her; no completed visit is claimed.',
    refusal: 'Rıza keeps the sketches for himself. A private pleasure need not become a garden attraction.',
  },
  osman: {
    castId: 'hf.cast.osman.voice',
    revision: '1',
    name: 'Osman',
    age: 55,
    sex: 'male',
    job: 'Produce supplier, market trader and small landlord',
    family: 'Divorced; his adult son works elsewhere.',
    profile: { conscientiousness: 0.75, agreeableness: 0.35, honesty: 0.6, extraversion: 0.5 },
    cue: 'Osman brings his crate account and pauses over an older receipt.',
    fact: 'Osman opens his ledger himself. A former tenant’s repair contribution was never deducted from the final account. He found the note later but kept the money while waiting for a complaint.',
    repair:
      'Osman writes the exact correction and addresses a repayment letter. This is a prepared correction, not proof of payment. Halil’s separate rent account remains unchanged.',
    refusal: 'Osman closes his ledger. One generous concession would not correct this separate account.',
  },
} as const;
export type GardenPerson = keyof typeof GARDEN_CAST;
export const GARDEN_IDS = Object.keys(GARDEN_CAST) as GardenPerson[];
export function gardenOpening(id: GardenPerson, seed: number, now = 360): Person {
  const c = GARDEN_CAST[id];
  const canonical = canonicalCast(c.castId);
  if (!castForGame('hearsay').some((p) => p.castId === c.castId)) throw new Error('Unknown allocation');
  return createPerson({
    id,
    name: c.name,
    seed,
    now,
    bornAt: now - canonical.age * 365 * 1440,
    sex: c.sex,
    traits: { ...canonical.traits },
    values: { ...canonical.values },
    relationships:
      id === 'aylin'
        ? [{ otherId: 'dilan', roles: ['sibling'] }]
        : id === 'dilan'
          ? [{ otherId: 'aylin', roles: ['sibling'] }]
          : [],
    norms: [
      { normId: 'backbiting', standing: 'forbidden', conviction: 0.5 },
      { normId: 'lying', standing: 'forbidden', conviction: 0.8 },
    ],
    retention: { trace: 0, chronicleDays: 14 },
  });
}
/** Duties are host facts, not kinship inferred from shared accommodation. */
export function gardenLocation(id: GardenPerson, minute: number): string {
  const t = minute % 1440;
  if (id === 'hatice') return 'garden';
  if (id === 'derya')
    return t >= 1020 || t < 360
      ? 'hospital'
      : t >= 480 && t < 780
        ? 'temporary lodging (morning sleep)'
        : 'garden';
  if (t < 360 || t >= 1320) return 'lodging';
  if (t < 480 || (t >= 1020 && t < 1140)) return 'garden';
  if (id === 'dilan' || id === 'ece') return t >= 720 && t < 780 ? 'fountain' : 'delivery route';
  if (id === 'aylin') return t >= 780 && t < 840 ? 'garden' : t >= 1140 ? 'own evening' : 'school kitchen';
  if (id === 'nermin') return t >= 720 && t < 840 ? 'garden' : 'agency appointment';
  if (id === 'riza') return t >= 720 && t < 840 ? 'garden' : 'bread round';
  return t >= 720 && t < 840 ? 'garden' : 'produce round';
}
