import { expect, it } from 'vitest';
import { GARDEN_IDS } from '../src/sim/garden-cast.ts';
import { advanceGarden, chooseGarden, freshGarden, gardenHere } from '../src/sim/garden4.ts';
import { exportGarden, importGarden } from '../src/sim/garden4-export.ts';
import {
  claimControls,
  gardenEmpty,
  gardenInterruption,
  gardenNext,
  gardenRefusal,
  gardenResult,
  gardenSlowNote,
  recordHtml,
  repeatPreview,
  UNKNOWN_REFUSAL,
} from '../src/ui/garden-guidance.ts';

const others = (g: ReturnType<typeof freshGarden>) =>
  GARDEN_IDS.filter((id) => id !== 'hatice' && gardenHere(g, id));

it('shows the host refusal beside Press for private details, and nothing more', () => {
  const g = freshGarden(17);
  const before = g.log.length;
  expect(chooseGarden(g, { type: 'listen', person: 'osman', approach: 'pry' })).toBe(true);
  expect(g.chat).toBeUndefined();
  expect(gardenResult(g, before)).toBe('Osman chooses to keep this private for now.');
  expect(g.log.at(-1)?.person).toBe('osman');
});

it('shows a claim result with its listener and names no unknown reason for an unmapped refusal', () => {
  const g = freshGarden(17);
  const before = g.log.length;
  const listener = others(g).find((id) => id !== 'osman');
  if (!listener) throw new Error('Fixture requires a listener at 06:00.');
  expect(chooseGarden(g, { type: 'tell', person: listener, about: 'osman', trait: 'honest' })).toBe(true);
  expect(gardenResult(g, before)).toContain('Osman is not honest.” You have not proved this.');
  const repeated = { type: 'tell', person: listener, about: 'osman', trait: 'honest' } as const;
  expect(chooseGarden(g, repeated)).toBe(false);
  expect(gardenRefusal(g, repeated)).toContain('You already made this claim');
  expect(gardenRefusal(g, { type: 'reserve', person: listener })).toBe(UNKNOWN_REFUSAL);
});

it('previews the recipient and claim that the host then uses, and replays the choice', () => {
  const g = freshGarden(17);
  const g2 = freshGarden(17);
  for (const run of [g, g2]) {
    chooseGarden(run, { type: 'listen', person: 'riza', approach: 'invite' });
    advanceGarden(run, 376);
  }
  const preview = repeatPreview(g, 'riza');
  if (!preview.audience) throw new Error('Fixture requires an audience.');
  expect(preview.text).toContain(
    `you tell ${preview.audience[0]?.toUpperCase()}${preview.audience.slice(1)}`.replace('ı', 'ı'),
  );
  const before = g.log.length;
  expect(chooseGarden(g, { type: 'respond', person: 'riza', choice: 'spread' })).toBe(true);
  const told = g.log.slice(before).find((l) => l.kind === 'testimony' || l.kind === 'refusal');
  if (told?.kind === 'testimony') {
    expect(told.person).toBe(preview.audience);
    expect(told.text).toContain(`“${preview.claim}”`);
  } else expect(told?.text).toContain('does not complete the statement');
  const replayed = importGarden(JSON.stringify(exportGarden(g)));
  expect(replayed.log).toEqual(g.log);
  expect(chooseGarden(replayed, { type: 'silence' })).toBe(true);
  expect(replayed.inputs.length).toBe(g.inputs.length + 1);
});

it('says when nobody can hear a repeated secret', () => {
  const g = freshGarden(17);
  const preview = repeatPreview({ ...g, people: { ...g.people } } as typeof g, 'riza');
  expect(preview.audience).toBeDefined();
  advanceGarden(g, 8 * 60 + 5);
  expect(others(g)).toEqual([]);
  expect(repeatPreview(g, 'riza').audience).toBeUndefined();
  expect(repeatPreview(g, 'riza').text).toContain('cannot be repeated now');
});

it('gives the available actions for an empty garden and forecasts no return', () => {
  const g = freshGarden(17);
  expect(gardenEmpty(g)).toBe('');
  advanceGarden(g, 8 * 60 + 5);
  const empty = gardenEmpty(g);
  expect(empty).toContain('Nobody is at the garden now.');
  expect(empty).toContain('The game does not say when anyone returns.');
  expect(empty).toContain('pour tea without sharing news');
  expect(empty).not.toMatch(/\d:\d\d|routine|usually/i);
});

it('names the next dated event and keeps the Day 4 order out of reach before it', () => {
  const g = freshGarden(17);
  expect(gardenNext(g)).toContain('Day 4 at 12:00');
  expect(gardenNext(g)).toContain('Nothing can be ordered before then.');
  expect(chooseGarden(g, { type: 'plan', choice: 'paid-trial' })).toBe(false);
  // Pure presentation of lunch state; the Day 4 decision itself is covered by garden-stakes.test.ts.
  g.minute = 3 * 1440 + 720;
  g.lunch.pending = 'trial';
  expect(gardenNext(g)).toBe('');
  g.lunch.pending = undefined;
  g.lunch.trial = 'paid';
  expect(gardenNext(g)).toContain('Day 8 at 12:00');
  // After Day 8, delivery guidance follows the actual order and invoice and promises nothing.
  g.minute = 12 * 1440;
  g.lunch.prep = 'paid';
  g.lunch.prepared = true;
  g.lunch.bread = true;
  g.lunch.produce = true;
  g.lunch.debt = 150;
  const credit = gardenNext(g);
  expect(credit).toContain('Bread is delivered only if Rıza is at the garden');
  expect(credit).toContain(
    'Produce is delivered only if Osman is at the garden between 12:30 and 13:00 and your invoice is paid.',
  );
  expect(credit).not.toMatch(/arrive/);
  g.lunch.debt = 0;
  g.lunch.breadDelivered = true;
  expect(gardenNext(g)).not.toContain('Bread is delivered');
  expect(gardenNext(g)).not.toContain('invoice is paid');
  g.lunch.bread = g.lunch.produce = false;
  g.lunch.breadDelivered = false;
  expect(gardenNext(g)).toContain('No bread or produce is ordered, so none will be delivered.');
});

it('explains a slow clock without changing the pace', () => {
  expect(gardenSlowNote(12, [])).toBe('');
  expect(gardenSlowNote(1, ['you tapped in the last 15 seconds'])).toBe('');
  expect(gardenSlowNote(12, ['the Garden record or a folded section is open'])).toBe(
    'The clock is slowed to 1 game minute a second because the Garden record or a folded section is open. It returns to 12 game minutes a second when none of that applies.',
  );
});

it('reports a conversation that the clock ended, with only the visible reason', () => {
  const g = freshGarden(17);
  advanceGarden(g, 7 * 60 + 50);
  const target = others(g)[0];
  if (!target) throw new Error('Fixture requires someone at the garden.');
  expect(chooseGarden(g, { type: 'listen', person: target, approach: 'invite' })).toBe(true);
  const before = g.log.length;
  advanceGarden(g, 8 * 60 + 5);
  const stopped = gardenInterruption(g, before);
  if (!g.discoveries[target]) expect(stopped).toContain('You learned nothing private.');
});

it('labels the claim lists with their own short names and offers only eligible subjects', () => {
  const html = claimControls('derya');
  expect(html).toContain('<label for="cg-about">Who?</label><select id="cg-about">');
  expect(html).toContain('<label for="cg-trait">What?</label><select id="cg-trait">');
  expect(html).not.toMatch(/<label[^>]*>[^<]*<select/);
  const subjects = [...html.matchAll(/<option value="([a-z]+)"/g)].map((m) => m[1]);
  expect(subjects).not.toContain('hatice');
  expect(subjects).not.toContain('derya');
  expect(subjects.slice(0, 2)).toEqual(['dilan', 'nermin']);
  // A kept choice stays only while it is still offered; otherwise the first eligible person is the default.
  expect(claimControls('derya', 'osman', 'kind')).toContain('<option value="osman" selected>');
  expect(claimControls('derya', 'osman', 'kind')).toContain('<option value="kind" selected>');
  expect(claimControls('osman', 'osman')).not.toContain(' selected>Osman');
  expect(claimControls('osman', 'osman')).not.toContain('value="osman"');
  expect(claimControls('osman', 'osman')).not.toMatch(/<select id="cg-about">(?:(?!<\/select>).)*selected/);
});

it('keeps every record line and opens the day the game clock is in', () => {
  const g = freshGarden(17);
  g.log.push({
    at: 390,
    kind: 'witnessed',
    text: 'Osman counts eight produce crates but writes ten.',
    person: 'osman',
  });
  const sameDay = recordHtml(g);
  expect(sameDay).toContain('Your goal is to serve a paid workers’ lunch on Day 13.');
  expect(sameDay).toContain('counts eight produce crates but writes ten');
  expect(sameDay).not.toContain('<summary>Day 1</summary>');
  // Past midnight with no new line yet: Day 1 folds, Day 2 is current.
  g.minute = 1440 + 5;
  const rolled = recordHtml(g);
  expect(rolled).toContain('<summary>Day 1</summary>');
  expect(rolled).toContain('<h4>Day 2</h4>');
  expect((rolled.match(/<p><small>/g) ?? []).length).toBeGreaterThanOrEqual(g.log.length);
  // The closing line is labelled Day 15 by the existing row convention, and is the current day then.
  g.minute = 14 * 1440;
  g.log.push({ at: 14 * 1440, kind: 'ending', text: 'The two weeks end.' });
  expect(recordHtml(g)).toContain('<h4>Day 15</h4>');
});

it('answers the private-story pointer without offering a new chooser', () => {
  const g = freshGarden(17);
  const text = repeatPreview(g, 'riza').text;
  expect(text).toContain('It does not repeat this private story.');
});
