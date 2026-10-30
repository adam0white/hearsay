/** garden-talk/1: public conversation about the speaker's own work and
 * the actual lunch. This module grants no discoveries or completed private
 * outcomes. Selection uses only the pinned run and its attended answer history.
 */
import type { GardenRun } from './garden.ts';
import type { GardenPerson } from './garden-cast.ts';
export interface GardenConfig {
  dialogue: 'garden-talk/1';
}
export function validateGardenConfig(config: GardenConfig | undefined): void {
  if (
    config !== undefined &&
    (!config || config.dialogue !== 'garden-talk/1' || Object.keys(config).length !== 1)
  )
    throw new Error('This conversation configuration is unsupported. Keep the file. Start fresh.');
}
export function requireCurrentGardenConfig(config: GardenConfig | undefined): void {
  if (config === undefined) throw new Error('This older garden is unsupported. Keep the file. Start fresh.');
  validateGardenConfig(config);
}
const publicWords: Record<Exclude<GardenPerson, 'hatice'>, readonly string[]> = {
  derya: [
    'I work nights. A quiet seat after a shift matters to me.',
    'My shift ending does not mean I have a whole free day. I still need sleep.',
    'Please ask when I can stay. My working hours are different from yours.',
    'I would rather have a short quiet break than another task before I sleep.',
    'A daytime lunch and a night shift need different plans. I cannot promise both just to be polite.',
    'I can speak for my own time. I cannot promise that another nurse will come.',
  ],
  dilan: [
    'I have parcels to deliver. A break should leave me time to finish my route.',
    'If I book lunch, I am booking a meal. I am not agreeing to make another delivery.',
    'Tell me when the meal starts. I need to know whether it fits my break.',
    'Aylin and I are sisters, but we each make our own work arrangements.',
    'I would like to sit down without having to carry one more thing for someone.',
    'Please ask me before adding an errand to my route. Knowing the way is not an agreement.',
  ],
  nermin: [
    'I arrange work for other people. I want time to think about my own work too.',
    'I can reserve my own meal. I cannot promise that the people I place will come.',
    'A clear fee and leaving time matter more than calling someone helpful.',
    'Please speak to the person who will do the work. I cannot agree on their behalf.',
    'A table can be a place to rest. It need not become another work meeting.',
    'I want to hear what someone actually agreed to do before I judge a missed promise.',
  ],
  aylin: [
    'I cook at the school. My evening is not another shift that anyone can book for me.',
    'If you want cooking work, agree on the fee and the time I can leave.',
    'Buying ingredients is different from paying someone to prepare them.',
    'Dilan can choose her own lunch break. Being her sister does not let me book it for her.',
    'Please ask before making a plan for my evening. I may already want that time for myself.',
    'A meal needs preparation as well as good intentions. An unpaid promise does not do the work.',
  ],
  ece: [
    'I want somewhere to sit between deliveries without having to buy anything.',
    'A free bench is useful even when I am not staying for lunch.',
    'Please tell me when the gate is open. I need to fit a stop around my route.',
    'If I reserve a meal, that is my choice. It does not book the rest of my break.',
    'I can talk for a while when I stop. I cannot promise to wait all afternoon.',
    'I would like a seat without an errand attached. I still have my own deliveries.',
  ],
  riza: [
    'I help deliver bread. I would like to talk about something besides work.',
    'I carry the bread. I am not the baker, and I cannot promise what the bakery will make.',
    'An agreed delivery needs a time and a quantity. Praise does not settle either one.',
    'Please keep a meal reservation separate from a bread order. They are different promises.',
    'Ask Osman about the produce. I can speak about the bread I carry.',
    'I would like to sit at the table as a customer sometimes, without being given another round.',
  ],
  osman: [
    'I supply produce. A written order matters more to me than praise.',
    'Please agree on what you are buying before asking me to bring it.',
    'A sample and the full lunch order are different things. We should name both clearly.',
    'If the order is on credit, the invoice still needs paying. Good wishes do not pay it.',
    'Rıza carries bread. Ask me about the produce rather than making him answer for my work.',
    'Please tell me whether you want an order or advice. I should not treat one as the other.',
  ],
};
function lunchWords(g: Pick<GardenRun, 'lunch' | 'log'>): string {
  const l = g.lunch;
  if (l.result === 'cancelled')
    return 'The lunch could not open. A conversation now cannot turn it into a meal that was served.';
  if (l.result === 'short')
    return l.served.length
      ? 'The lunch served some customers but made a loss. An empty place did not pay for a meal.'
      : 'The food was ready, but nobody bought a meal. The lunch made a loss.';
  if (l.result === 'open')
    return 'The lunch opened. The garden account records the meals that were actually served.';
  if (l.prepared) return 'The paid preparation is done. The reserved customers still have to come for lunch.';
  if (l.cook && (l.prep === 'paid' || l.prep === 'unpaid'))
    return 'The cooking fee is paid. The preparation and the lunch are still ahead.';
  if (l.prep === 'unpaid')
    return l.debt === 0
      ? 'The fee is paid, but the preparation session was missed. Aylin has not agreed to a new session.'
      : 'The cooking is not paid for yet. Aylin has not begun the preparation.';
  if (l.prep === 'cancelled')
    return 'The cooking arrangement was cancelled. Reservations alone cannot open the lunch.';
  if (l.trial === 'missed')
    return 'The supply agreement was missed. There is no agreed bread and produce order for lunch.';
  if (l.trial === 'paid' || l.trial === 'credit')
    return 'The supply terms are agreed. The Day 8 cooking arrangement still needs an answer.';
  return 'The Day 4 supply decision is still ahead. A meal reservation does not arrange its ingredients.';
}
export function gardenConversation(
  g: Pick<GardenRun, 'lunch' | 'log'>,
  person: Exclude<GardenPerson, 'hatice'>,
): string {
  const words = publicWords[person];
  const heard = g.log.filter((line) => line.kind === 'answer' && line.person === person).length;
  return `${words[heard % words.length]} ${lunchWords(g)}`;
}
