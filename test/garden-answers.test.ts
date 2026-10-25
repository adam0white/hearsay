import { expect, it } from 'vitest';
import { chooseGarden, freshGarden } from '../src/sim/garden.ts';
import { exportGarden, importGarden } from '../src/sim/garden-export.ts';

it('gives uncertain neighbours distinct public reasons to talk without granting private knowledge', () => {
  const g = freshGarden(17);
  const before = JSON.stringify(g.people);
  const answers: string[] = [];
  for (const person of ['riza', 'ece', 'aylin'] as const) {
    expect(chooseGarden(g, { type: 'ask', person, about: 'nermin', trait: 'reliable' })).toBe(true);
    const text = g.log.at(-1)!.text;
    expect(text).toContain('I have not heard enough');
    expect(text).toContain('Nobody has told me');
    expect(text).toContain('Invite a quiet conversation');
    answers.push(text.replace(/^.*?: /, ''));
  }
  expect(new Set(answers).size).toBe(3);
  expect(answers[0]).toContain('bread');
  expect(answers[1]).toContain('sit');
  expect(answers[2]).toContain('school');
  expect(g.discoveries).toEqual({});
  expect(JSON.stringify(g.people)).toBe(before);
  expect(importGarden(JSON.stringify(exportGarden(g)))).toEqual(g);
});
