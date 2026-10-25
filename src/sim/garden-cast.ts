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
    family: 'She is widowed. Her grown child lives outside the district.',
    profile: { honesty: 0.85, extraversion: 0.7, conscientiousness: 0.7, agreeableness: 0.6 },
    cue: 'The account from the wedding reception is still in your drawer.',
    fact: 'You encouraged a couple to spend more on their wedding. You called your contribution a gift while privately expecting them to book the garden. You later complained about their ingratitude.',
    repair:
      'You acknowledge that your gift came with an expectation you never stated. You correct your complaint with the people who heard you repeat it.',
    refusal:
      'You do not discuss the old wedding account. Calling your contribution generous does not resolve the expectation you never stated.',
  },
  derya: {
    castId: 'hf.cast.derya.stairwell',
    revision: '2',
    name: 'Derya',
    age: 44,
    sex: 'female',
    job: 'Night nurse on a short relief assignment',
    family:
      'She is single and has temporary lodging near the garden. Her home is flat 5 of Lale Apartmanı, the Lale apartment building.',
    profile: { honesty: 0.7, extraversion: 0.35, agreeableness: 0.6, emotionality: 0.5, openness: 0.55 },
    cue: 'Derya folds an unfinished letter asking about training before ordering breakfast.',
    fact: 'Derya reported a scheduling error before anyone was harmed. Training invitations then stopped. She kept the correspondence, but does not know whether the events were connected.',
    repair:
      'Derya writes a specific request for an explanation. Hatice helps check the wording. Nobody has promised a reply or a training place.',
    refusal:
      'Derya puts the correspondence away. Her work and family are private. She has not asked anyone at the garden to investigate.',
  },
  dilan: {
    castId: 'hf.cast.dilan.murmur',
    revision: '2',
    name: 'Dilan',
    age: 33,
    sex: 'female',
    job: 'Parcel delivery visitor',
    family: 'Dilan is Aylin’s younger sister. Their mother lives elsewhere.',
    profile: {
      honesty: 0.68,
      conscientiousness: 0.48,
      emotionality: 0.62,
      extraversion: 0.45,
      agreeableness: 0.6,
    },
    cue: 'Dilan checks an old route slip, then looks toward Ece.',
    fact: 'Dilan once completed a delivery Ece had missed and let Murat believe Dilan had caused the delay. Dilan expected thanks without saying so. Ece thought the matter was settled.',
    repair:
      'Dilan asks Ece for a short conversation about the old delivery slip. She explains the thanks she expected instead of asking Hatice to pass on an accusation.',
    refusal: 'Dilan keeps the slip. Hatice does not have permission to tell others about the old delivery.',
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
    cue: 'Nermin asks for a quiet table to review how she runs her agency.',
    fact: 'Nermin described a worker’s placement as a poor match and made the worker’s complaint about unpaid nights sound less serious. She refunded part of the client’s fee before checking what the worker had lost.',
    repair:
      'With Nermin’s consent, you review what happened without using client names. She drafts a correction and a letter asking the worker which unpaid hours she can document. Payment and forgiveness remain unresolved.',
    refusal:
      'Nermin stops reviewing the case. Hatice does not have permission to repeat what Nermin shared in confidence about her work.',
  },
  aylin: {
    castId: 'hf.cast.aylin.murmur',
    revision: '1',
    name: 'Aylin',
    age: 36,
    sex: 'female',
    job: 'School kitchen cook',
    family: 'She is Dilan’s older sister. Their mother is not involved in events at the garden.',
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
      'Aylin keeps the evening free and chooses to go to class. You do not tell her family or expect her to perform for anyone.',
    refusal: 'Aylin says she has an evening of her own. She owes no further explanation.',
  },
  ece: {
    castId: 'hf.cast.ece.murmur',
    revision: '1',
    name: 'Ece',
    age: 24,
    sex: 'female',
    job: 'Courier and part-time logistics student',
    family: 'She lives with an aunt. Her parents live elsewhere.',
    profile: {
      honesty: 0.65,
      conscientiousness: 0.7,
      extraversion: 0.65,
      agreeableness: 0.55,
      emotionality: 0.45,
      openness: 0.75,
    },
    cue: 'Ece asks whether anyone may sit at the garden gate without ordering.',
    fact: 'Ece maps places where workers can sit without buying anything. She notes whether there is shade, whether seats have backrests and when each place closes. This is a personal map. It is not an official survey of access for disabled people.',
    repair:
      'You agree that the gate bench is free to use during opening hours. Ece checks the hours with you before adding it to the workers’ map.',
    refusal: 'Ece keeps the map informal. Nobody has permission to use it to advertise the garden.',
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
      'Rıza marks a short walking route along public streets to suggest to his daughter. You leave private courtyards out and let him decide whether to invite her. The visit has not happened.',
    refusal:
      'Rıza keeps the sketches for himself. He does not have to share his private interest with garden customers.',
  },
  osman: {
    castId: 'hf.cast.osman.voice',
    revision: '1',
    name: 'Osman',
    age: 55,
    sex: 'male',
    job: 'Produce supplier, market trader and small landlord',
    family: 'He is divorced. His adult son works elsewhere.',
    profile: { conscientiousness: 0.75, agreeableness: 0.35, honesty: 0.6, extraversion: 0.5 },
    cue: 'Osman brings the account for his produce crates and stops to look at an older receipt.',
    fact: 'Osman opens his account book himself. A former tenant’s repair contribution was never deducted from the final account. He found the note later but kept the money while waiting for a complaint.',
    repair:
      'Osman writes the exact correction and addresses a letter about repayment. He has prepared the correction, but this does not prove that he has repaid the money. Halil’s separate rent account remains unchanged.',
    refusal:
      'Osman closes his account book. A generous offer elsewhere would not correct this separate account.',
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
    lexicon: { plainEnglish: true },
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
