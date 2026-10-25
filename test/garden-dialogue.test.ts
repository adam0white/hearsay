import { expect, it } from 'vitest';
import { advanceGarden, chooseGarden, freshGarden } from '../src/sim/garden.ts';
import { exportGarden, importGarden } from '../src/sim/garden-export.ts';

const config = { dialogue: 'garden-talk/1' } as const;
it('varies invited public answers without awarding private knowledge or changing people', () => {
  const g = freshGarden(17, {}, undefined, config);
  const before = structuredClone(g.people);
  const answers: string[] = [];
  for (let i = 0; i < 4; i++) {
    expect(chooseGarden(g, { type: 'ask', person: 'riza', about: 'nermin' })).toBe(true);
    answers.push(g.log.at(-1)!.text);
  }
  expect(new Set(answers).size).toBe(4);
  expect(g.discoveries).toEqual({});
  expect(g.people).toEqual(before);
  expect(answers.join(' ')).not.toMatch(/daughter|photograph|sketch/);
  expect(importGarden(JSON.stringify(exportGarden(g)))).toEqual(g);
});
it('keeps the chosen dialogue through compact replay and refuses an unknown configuration', () => {
  const g = freshGarden(17, {}, undefined, config);
  chooseGarden(g, { type: 'listen', person: 'riza', approach: 'invite' });
  advanceGarden(g, 375);
  chooseGarden(g, { type: 'respond', person: 'riza', choice: 'keep' });
  chooseGarden(g, { type: 'ask', person: 'riza', about: 'nermin' });
  const compact = exportGarden(g, true);
  expect(compact).not.toHaveProperty('state');
  expect(importGarden(JSON.stringify(compact))).toEqual(g);
  expect(importGarden(JSON.stringify(exportGarden(g)))).toEqual(g);
  compact.config = { dialogue: 'unknown' } as unknown as typeof config;
  expect(() => importGarden(JSON.stringify(compact))).toThrow(/configuration/);
});
it('describes actual late lunch outcomes without promising work on the cancelled branch', () => {
  const g = freshGarden(17, {}, undefined, config);
  advanceGarden(g, 12 * 1440 + 790);
  expect(g.lunch.result).toBe('cancelled');
  expect(chooseGarden(g, { type: 'ask', person: 'riza', about: 'nermin' })).toBe(true);
  expect(g.log.at(-1)!.text).toContain('The lunch could not open');
  expect(g.log.at(-1)!.text).not.toMatch(/delivered|paid me|sketch|daughter/);
  expect(importGarden(JSON.stringify(exportGarden(g, true)))).toEqual(g);
});
it('keeps witnessed corrections and real confrontation consequences in the opt-in garden', () => {
  const g = freshGarden(17, {}, undefined, config);
  advanceGarden(g, 400);
  expect(chooseGarden(g, { type: 'tell', person: 'aylin', about: 'riza', trait: 'reliable' })).toBe(true);
  advanceGarden(g, 5 * 1440 + 420);
  expect(g.lunch.confrontations.some((c) => c.person === 'riza' && !c.resolved)).toBe(true);
  const repaired = structuredClone(g);
  expect(chooseGarden(repaired, { type: 'confront', person: 'riza', choice: 'own' })).toBe(true);
  expect(chooseGarden(g, { type: 'confront', person: 'riza', choice: 'stand' })).toBe(true);
  advanceGarden(g, 5 * 1440 + 800);
  advanceGarden(repaired, 5 * 1440 + 800);
  expect(repaired.lunch.takings).toBeGreaterThan(g.lunch.takings);
  expect(importGarden(JSON.stringify(exportGarden(g, true)))).toEqual(g);
});
it('distinguishes a late settled invoice from an agreed cooking session', () => {
  const g = freshGarden(17, {}, undefined, config);
  advanceGarden(g, 3 * 1440 + 720);
  expect(chooseGarden(g, { type: 'plan', choice: 'paid-trial' })).toBe(true);
  advanceGarden(g, 7 * 1440 + 720);
  expect(chooseGarden(g, { type: 'plan', choice: 'unpaid-prep' })).toBe(true);
  advanceGarden(g, 10 * 1440 + 420);
  expect(chooseGarden(g, { type: 'plan', choice: 'settle' })).toBe(true);
  expect(g.lunch.debt).toBe(0);
  expect(g.lunch.cook).toBe(false);
  expect(chooseGarden(g, { type: 'ask', person: 'riza', about: 'nermin' })).toBe(true);
  expect(g.log.at(-1)!.text).toContain('The fee is paid');
  expect(g.log.at(-1)!.text).toContain('session was missed');
  expect(importGarden(JSON.stringify(exportGarden(g, true)))).toEqual(g);
});
it('does not invent a meal customer when the ready lunch serves nobody', () => {
  const g = freshGarden(17, {}, undefined, config);
  advanceGarden(g, 3 * 1440 + 720);
  expect(chooseGarden(g, { type: 'plan', choice: 'paid-trial' })).toBe(true);
  advanceGarden(g, 7 * 1440 + 720);
  expect(chooseGarden(g, { type: 'plan', choice: 'paid-prep' })).toBe(true);
  advanceGarden(g, 10 * 1440 + 420);
  for (const person of ['derya', 'osman'] as const)
    expect(chooseGarden(g, { type: 'tell', person, about: 'riza', trait: 'reliable' })).toBe(true);
  advanceGarden(g, g.minute + 1);
  for (const person of ['derya', 'osman'] as const)
    expect(chooseGarden(g, { type: 'reserve', person })).toBe(true);
  advanceGarden(g, 12 * 1440 + 790);
  expect(g.lunch.result).toBe('short');
  expect(g.lunch.served).toEqual([]);
  expect(chooseGarden(g, { type: 'ask', person: 'riza', about: 'nermin' })).toBe(true);
  expect(g.log.at(-1)!.text).toContain('nobody bought a meal');
  expect(importGarden(JSON.stringify(exportGarden(g, true)))).toEqual(g);
});
