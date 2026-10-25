import { fingerprint } from '../../src/sim/game.ts';
import type { Scene, State } from '../../src/sim/types.ts';

const ORIGINAL_STEM: Record<string, Record<string, string>> = {
  emre: {
    'Mother, let me finish.': 'Anne (Mother), let me finish.',
    'Mother, listen.': 'Anne (Mother), listen.',
  },
  hatice: {
    'I’ll tell you, but keep it between us.': 'Between you and me, then.',
    'All right, I’ll answer since you asked.': 'All right, since you asked.',
  },
  osman: {
    'There’s no rush. I’m not going anywhere.': 'No rush. I’m not going anywhere.',
  },
  riza: {
    'I won’t upset a family over rumors.': 'I won’t trouble a family over talk.',
    'I won’t discuss this in front of the children.': 'Not in front of the children.',
  },
  murat: {
    'Let me tell you before I forget.': 'Before I forget, then.',
  },
  fatma: {
    'That is gıybet, talking behind someone’s back. They can’t answer us.':
      'Gıybet, talk behind someone’s back. They can’t answer us.',
    'I couldn’t face them after saying that.': 'I couldn’t look them in the eye after.',
  },
  hasan: {
    'Here is the part that matters.': 'Now, the important part.',
  },
  nermin: {
    'Don’t talk about them like that while I work.': 'Keep that talk off my worktable.',
    'Let them have some peace.': 'Leave them a little peace.',
  },
  selma: {
    'They aren’t here. Leave them alone.': 'Their chair’s empty. Leave them alone.',
    'I’ll answer since you’re asking me.': 'Since you’re asking me, then.',
  },
  mehmet: {
    'I won’t pass that on.': 'That goes no further with me.',
  },
  zeynep: {
    'No. Give them a chance to explain.': 'No. Leave them room to explain.',
    'I’ve heard enough. Let me answer.': 'I’ve heard enough. My turn.',
  },
  ibrahim: {
    'I won’t repeat that to them.': 'I won’t take that to their door.',
  },
  leyla: {
    'No. I won’t discuss them over tea.': 'No. Leave them out of our tea.',
    'I won’t repeat that to someone else.': 'I won’t carry that to another door.',
    'Let’s stop talking about them.': 'Let’s leave their name alone.',
  },
  cem: {
    'I’ll give you a quick answer.': 'Quick answer, then.',
  },
  orhan: {
    'I won’t repeat that story to my customers.': 'I’m not serving that story with coffee.',
    'Don’t talk about them in here.': 'Leave their name alone in here.',
  },
  meryem: {
    'Let them have some peace at home.': 'Leave a little peace in their house.',
  },
  halil: {
    'They aren’t here. Let’s keep quiet.': 'They aren’t here. Let’s hold our tongues.',
    'No. Let’s stop talking about them.': 'No. Let’s leave their name in peace.',
  },
};

/**
 * Exclude only authored display prose; preserve IDs, semantic keys, counts and order.
 * Historical pins were generated from the unchanged c8c825a baseline engine.
 * HF Person state is never normalized. This supplements strict current replay checks.
 */
export function historicalRulesFingerprint(state: State): string {
  const copy = structuredClone(state);
  const blank = (object: object, key: string) => {
    if (typeof (object as Record<string, unknown>)[key] === 'string')
      (object as Record<string, unknown>)[key] = '';
  };
  const scene = (value: Scene) => {
    value.text = '';
    for (const choice of value.choices) {
      choice.label = '';
      choice.says = '';
      blank(choice, 'risk');
    }
  };
  for (const line of copy.log) {
    line.text = '';
    if (line.reply) blank(line.reply, 'will');
    for (const option of line.quick?.options ?? []) {
      option.label = '';
      option.says = '';
    }
  }
  // Map edited speech back to its original identity. Keep every used stem and its order.
  for (const [key, used] of Object.entries(copy.voiceUsed)) {
    const speaker = key.split(':').at(-1)!;
    for (let index = 0; index < used.length; index++)
      used[index] = ORIGINAL_STEM[speaker]?.[used[index]!] ?? used[index]!;
  }
  if (copy.scene) scene(copy.scene);
  for (const value of copy.sceneQueue ?? []) scene(value);
  for (const visit of copy.morningVisits ?? []) if (visit.scene) scene(visit.scene);
  for (const thread of copy.threads ?? []) {
    blank(thread, 'where');
    blank(thread, 'reason');
  }
  if (copy.riza) {
    blank(copy.riza, 'line');
    blank(copy.riza, 'cause');
    if (copy.riza.word) for (const key of ['words', 'because', 'mend']) blank(copy.riza.word, key);
    for (const doubt of copy.riza.doubts ?? []) {
      doubt.words = '';
      blank(doubt, 'because');
    }
    for (const step of copy.riza.steps ?? []) step.label = '';
  }
  for (const route of copy.routes) blank(route, 'title');
  for (const story of copy.stories ?? []) story.title = '';
  for (const day of copy.days ?? []) {
    day.summary.fill('');
    day.question = '';
    blank(day, 'tomorrow');
  }
  return fingerprint(copy);
}
