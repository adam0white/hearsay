import { inspect } from '@adam0white/human-framework';
import { GARDEN_CAST, type GardenPerson } from '../sim/garden-cast.ts';
import { type GardenRun, sessionOf } from '../sim/garden4.ts';

/** Read only what Hatice can know, including her own current feelings. */
export function gardenReadings(g: GardenRun, person: GardenPerson): string[] {
  const result = inspect(sessionOf(g).run, {
    perspective: { kind: 'person', observer: 'hatice' },
    people: [person],
    select: ['condition', 'affect', 'needs', 'expectations'],
  });
  if (!result.ok) throw new Error(result.error.message);
  const view = result.value.people[0];
  if (!view) return [];
  const lines: string[] = [];
  if (view.kind === 'self') {
    const condition = view.parts.find((part) => part.select === 'condition');
    if (condition?.select === 'condition') {
      const signs = condition.value.selfReport;
      if (signs.fatigue >= 0.3) lines.push('You feel tired.');
      if (signs.pain >= 0.3) lines.push('You feel pain.');
    }
    const affect = view.parts.find((part) => part.select === 'affect');
    if (affect?.select === 'affect') {
      if (affect.value.mood.valence >= 0.3) lines.push('You feel good.');
      if (affect.value.mood.valence <= -0.3) lines.push('You feel low.');
      for (const emotion of affect.value.emotions) {
        if (emotion.intensity < 0.3) continue;
        const words: Record<string, string> = {
          joy: 'joy',
          distress: 'distressed',
          hope: 'hopeful',
          fear: 'afraid',
          relief: 'relieved',
          disappointment: 'disappointed',
          pride: 'proud',
          shame: 'ashamed',
          gratitude: 'grateful',
          anger: 'angry',
          guilt: 'guilty',
          love: 'love',
          grief: 'grief',
          awe: 'awe',
          boredom: 'bored',
          loneliness: 'lonely',
        };
        const word = words[emotion.id];
        if (word) lines.push(`You feel ${word}.`);
      }
    }
    const needs = view.parts.find((part) => part.select === 'needs');
    if (needs?.select === 'needs') {
      const words: Record<string, string> = {
        food: 'You feel hungry.',
        water: 'You feel thirsty.',
        sleep: 'You need sleep.',
        rest: 'You need rest.',
        relief: 'You need the bathroom.',
      };
      for (const need of needs.value) {
        const sentence = words[need.id];
        if (need.urgency >= 0.7 && sentence) lines.push(sentence);
      }
    }
    const expectations = view.parts.find((part) => part.select === 'expectations');
    if (expectations?.select === 'expectations') {
      const actions: Record<string, string> = {
        tell: 'speaking',
        rest: 'resting',
        eat: 'eating',
        drink: 'drinking',
        sleep: 'sleeping',
        work: 'working',
        'work-market': 'working at the market',
        chat: 'talking',
        reflect: 'reflecting',
        pray: 'praying',
        'pray-fajr': 'praying',
        'pray-dhuhr': 'praying',
        'pray-asr': 'praying',
        'pray-maghrib': 'praying',
        'pray-isha': 'praying',
      };
      for (const expectation of expectations.value) {
        // Target-specific keys are not named here; they can refer to private context.
        const action = actions[expectation.key];
        if (!action || expectation.samples < 1) continue;
        if (expectation.successRate >= 0.7) lines.push(`You expect ${action} to go well.`);
        else if (expectation.successRate <= 0.3) lines.push(`You expect ${action} to go poorly.`);
      }
    }
    return [...new Set(lines)];
  }
  if (view.kind === 'other') {
    const condition = view.parts.find((part) => part.select === 'condition');
    if (condition?.select === 'condition') {
      const name = GARDEN_CAST[person].name;
      const words: Record<string, string> = {
        fatigue: 'tired',
        pain: 'in pain',
        fear: 'afraid',
      };
      for (const cue of condition.value.cues) {
        if (cue.confidence > 0 && cue.value >= 0.3 && words[cue.key])
          lines.push(`Hatice has noticed signs that ${name} may be ${words[cue.key]}.`);
      }
    }
    return lines.length
      ? lines
      : [`Hatice has not noticed enough to describe ${GARDEN_CAST[person].name}'s condition.`];
  }
  return lines;
}
