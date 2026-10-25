import { GARDEN_CAST } from '../sim/garden-cast.ts';

/** Display projections keep saved narration, deterministic hashes and replay inputs unchanged. */
const wording: Record<string, string> = {
  'The urn warms. A fortnight of tea, work and talk begins. Open a paid workers’ lunch on Day 13. Pay for a sample on Day 4, agree Aylin’s cooking terms on Day 8, and earn at least four reservations. Bread, produce, paid work and your word all matter. Free use of the gate bench stays separate from food sales.':
    'The tea urn warms as the fortnight begins. Your goal is to open a paid workers’ lunch on Day 13. Pay for a sample on Day 4 and agree on Aylin’s cooking terms on Day 8. You need at least four meal reservations. You also need bread, produce and paid cooking. People book based on whether they trust your word. Anyone may use the gate bench without buying food.',
  'Widowed; her grown child lives outside the district.':
    'Hatice is widowed. Her grown child lives outside the district.',
  'Single; temporary lodging near the garden. Her home is flat 5, Lale Apartmanı.':
    'Derya is single. She is staying near the garden for now. Her home is flat 5, Lale Apartmanı.',
  'Aylin’s younger sister. Their mother lives elsewhere.':
    'Dilan is Aylin’s younger sister. Their mother lives elsewhere.',
  'Dilan’s older sister; their mother is background.':
    'Aylin is Dilan’s older sister. Their mother is part of their family background.',
  'Lives with an aunt; her parents live elsewhere.': 'Ece lives with an aunt. Her parents live elsewhere.',
  'Divorced; his adult son works elsewhere.': 'Osman is divorced. His adult son works elsewhere.',
  'You leave the old account closed. Calling it generosity does not settle the unspoken bargain.':
    'You leave the old wedding account closed. Calling your contribution a gift does not resolve the booking you expected in return.',
  'Nermin closes the case review. Professional confidentiality is not a hint that Hatice may repeat.':
    'Nermin stops reviewing the case. She has not given Hatice permission to repeat these private work details.',
  'Rıza keeps the sketches for himself. A private pleasure need not become a garden attraction.':
    'Rıza keeps the sketches for himself. He does not have to show his private interest to the garden’s customers.',
  'Ece keeps the map informal. Nobody has permission to brand it as a garden promotion.':
    'Ece keeps the map informal. Nobody has permission to use it to advertise the garden.',
  'You repeat a confidence at the next table. Its owner hears you. They stop trusting this table with private matters.':
    'You repeat something told to you in private at the next table. The person who told you hears it. They stop trusting you with private matters.',
  'The conversation ends before the confidence is shared. You have learned no private fact.':
    'The conversation ends before anything private is shared. You have learned no private fact.',
  'You do not believe this claim yourself. The listener cannot see that intention.':
    'You do not believe this claim yourself. The listener does not know that.',
  'You pour tea and let the table be quiet. Nobody owes you news.':
    'You pour tea without sharing news. Nobody has to tell you anything.',
  'The garden is closed after the confrontation; no tea is sold.':
    'The garden is closed after the confrontation. No tea is sold.',
  'The tables are occupied. Customers who stay pay for their tea.':
    'People are sitting at the tables. Customers who stay pay for their tea.',
  'A few customers remain; the empty places earn nothing.':
    'A few customers remain. Empty seats bring in no money.',
  'Customers who still trust the table pay for their tea. Those who avoid it spend elsewhere.':
    'Customers who still trust you pay for their tea. Those who avoid the garden spend elsewhere.',
  'The benches stay empty this morning. There are no tea takings.':
    'The benches stay empty this morning. You earn no money from tea.',
  'The lunch cannot open: an actual delivery, completed paid preparation, settled invoice or the 80-lira food budget is missing.':
    'The lunch cannot open. You need both deliveries, completed paid preparation, all invoices paid and 80 lira for food. At least one of these is missing.',
  'The food is ready, but too few reservations survive what people have heard. The lunch makes a loss.':
    'The food is ready, but too few customers come. The lunch loses money.',
  'You own the account and agree to withdraw it separately with each listener. The copies are not erased.':
    'You take responsibility for the claim. You agree to withdraw it with each listener. People may still have repeated it to others.',
};
const substitutions: [string, string][] = [
  [
    'finishes another quiet conversation. Earlier confidences remain private.',
    'finishes another quiet conversation. What they told you earlier stays private.',
  ],
  ['I saw an act myself.', 'I saw what happened myself.'],
  ['brought me an account.', 'told me about it.'],
  [
    'It came from an earlier chapter, whose full account stays there.',
    'I heard it in an earlier chapter. The details remain in that chapter.',
  ],
  ['Nobody has brought me an account.', 'Nobody has told me anything about it.'],
  ['no completed visit is claimed.', 'the visit has not happened yet.'],
  ['payment and forgiveness remain unresolved.', 'payment and forgiveness are still unresolved.'],
  ['a counted bread order', 'the agreed number of loaves'],
  ['a counted bread and produce order', 'an order for bread and produce in agreed amounts'],
  ['the counted lunch bread', 'the agreed number of loaves for lunch'],
  ['at the promised handover', 'at the agreed delivery time'],
  ['the handover hour', 'the delivery time'],
  ['Neither offers unpaid extra cover.', 'Neither offers to do extra work without pay.'],
  [
    'agrees to sit with you for fifteen minutes. Either of you may leave; their next duty still applies.',
    'agrees to sit with you for fifteen minutes. Either of you may leave. They still need to return to their next duty.',
  ],
  [
    'keeps this private. A cup of tea does not buy an explanation.',
    'keeps this private. Buying tea does not mean they have to explain.',
  ],
  ['hears you repeat: ', 'hears you repeat this private information: '],
  [
    'You attach an unkind inference; the confidence does not prove a general character claim.',
    'You add an unkind conclusion about their character. The private information does not prove that conclusion.',
  ],
  [
    'Copies already passed on remain their own conversations.',
    'People may still have repeated the claim to others.',
  ],
  ['replacing your claim with uncertainty.', 'saying that you are no longer sure.'],
  ['traces the contradicted account back to your table.', 'traces the disproved claim back to you.'],
  [
    '“Will you take it back to the people who heard it, or stand by it?”',
    '“Will you correct what you said to the people who heard it, or stand by it?”',
  ],
  ['You stand by the contradicted story.', 'You stand by the disproved claim.'],
  [
    'word of the confrontation empties the garden until tomorrow.',
    'people hear about the confrontation and stop visiting the garden until tomorrow.',
  ],
  ['No agreement is inferred.', 'You have not agreed to anything.'],
  [
    'Neither agreement proves their whole character.',
    'These agreements do not prove what they are like in every situation.',
  ],
  ['You pay Aylin for a defined preparation session', 'You pay Aylin for the agreed preparation session'],
  [
    'reserve their own meal, on the stated supplier and cooking terms.',
    'reserve a meal each, with the supply and cooking terms you agreed on.',
  ],
  [
    'Reservations may change if new evidence reaches them.',
    'They may change their reservations if they hear something new.',
  ],
  [
    'A courier’s lunch stop uses their own break; no shift is abandoned.',
    'Couriers use their lunch break for this meal. They do not leave during their shift.',
  ],
  [
    'It proves nothing about her private interests or the rest of her route.',
    'This delivery tells you nothing about her private interests or her other deliveries.',
  ],
  [
    'This is delivery work, not evidence that he is a baker.',
    'He is delivering bread. This does not mean he is a baker.',
  ],
  [
    'A warm exchange does not settle their whole family history.',
    'Their friendly conversation does not resolve everything that happened in their family.',
  ],
  ['His old tenant account remains separate.', 'This does not settle the account with his former tenant.'],
  ['his old tenant account remains separate.', 'the account with his former tenant is still separate.'],
  ['The correction concerns this garden order;', 'This correction is for the garden order;'],
  [
    'The fortnight ends. Your garden account records what you heard, what you repeated and what you left private.',
    'The fortnight ends. Your garden account records what you heard, what you repeated and what you kept private.',
  ],
];
const personName = Object.values(GARDEN_CAST)
  .map((person) => person.name)
  .join('|');

export function gardenEnglish(text: string): string {
  let result = wording[text] ?? text;
  // Imported narration can retain historical wording. Project it without editing the saved record.
  result = result
    .replace(/Gıybet, talk behind someone’s back\./g, 'Talking behind someone’s back.')
    .replace(/\bGıybet\b/g, 'talking behind someone’s back')
    .replace(/([\p{L}]+) Hanım\b/gu, 'Ms $1')
    .replace(/kapıcı|\bkapici\b/giu, 'caretaker');
  // Results are sometimes followed by names or quoted inside another log entry.
  for (const [before, after] of Object.entries(wording)) result = result.replaceAll(before, after);
  for (const [before, after] of substitutions) result = result.replaceAll(before, after);
  return result
    .replace(new RegExp(`^(${personName}) reserve a meal each, `, 'u'), '$1 reserves one meal, ')
    .replace(
      new RegExp(`(^|\\. )(${personName}) actually sit down and pay for their meal\\.`, 'gu'),
      '$1$2 actually sits down and pays for their meal.',
    )
    .replace(
      /I have not heard enough to judge about (.+?) being (honest|reliable|kind|generous)\./g,
      'I have not heard enough to judge whether $1 is $2.',
    )
    .replace(
      /What I have heard reassures me about (.+?) being (honest|reliable|kind|generous)\./g,
      'What I have heard makes me think $1 is $2.',
    )
    .replace(
      /What I have heard troubles me about (.+?) being (honest|reliable|kind|generous)\./g,
      'What I have heard makes me doubt that $1 is $2.',
    )
    .replace(
      /(\w+) tells (\w+) they doubt an account about ([^.]+)\./g,
      '$1 tells $2 that they doubt a claim about $3.',
    )
    .replace(/(\w+) tells (\w+) an account about ([^.]+)\./g, '$1 tells $2 a claim about $3.');
}
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
