import { expect, it } from 'vitest';
import { GARDEN_CAST, GARDEN_IDS } from '../src/sim/garden-cast.ts';
import { advanceGarden, chooseGarden, freshGarden, gardenHere } from '../src/sim/garden4.ts';
import { exportGarden, importGarden } from '../src/sim/garden4-export.ts';
import {
  claimControls,
  gardenEmpty,
  gardenInterruption,
  gardenNext,
  gardenRefusal,
  gardenResult,
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
  chooseGarden(g, { type: 'listen', person: 'riza', approach: 'invite' });
  advanceGarden(g, 376);
  const preview = repeatPreview(g, 'riza');
  if (!preview.audience) throw new Error('Fixture requires an audience.');
  expect(preview.text).toContain(`you tell ${GARDEN_CAST[preview.audience].name}`);
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
  expect(empty).toContain('Nobody else is at the garden now.');
  expect(empty).toContain('You can pour tea');
  expect(empty).not.toMatch(/\d:\d\d|routine|usually/i);
});

it('keeps the Day 10 preparation line after paying later and then settling', () => {
  const g = freshGarden(17);
  expect(gardenNext(g)).toContain('Day 4 at 12:00');
  expect(chooseGarden(g, { type: 'plan', choice: 'paid-trial' })).toBe(false);
  // Only the offers are set up directly. Each answer below goes through the host's own plan choice.
  g.minute = 3 * 1440 + 720;
  g.lunch.pending = 'trial';
  expect(chooseGarden(g, { type: 'plan', choice: 'paid-trial' })).toBe(true);
  g.minute = 7 * 1440 + 720;
  g.lunch.pending = 'prep';
  expect(chooseGarden(g, { type: 'plan', choice: 'unpaid-prep' })).toBe(true);
  expect(gardenNext(g)).toContain('pay the invoice before 17:00 on Day 10');
  expect(chooseGarden(g, { type: 'plan', choice: 'settle' })).toBe(true);
  expect(g.lunch.prep).toBe('unpaid');
  expect(g.lunch.cook).toBe(true);
  expect(gardenNext(g)).toContain('Aylin must be at the garden');
});

it('does not invite bookings once the lunch can no longer open', () => {
  const g = freshGarden(17);
  g.minute = 3 * 1440 + 720;
  g.lunch.pending = 'trial';
  expect(chooseGarden(g, { type: 'plan', choice: 'decline-trial' })).toBe(true);
  expect(gardenNext(g)).toBe('Next: the lunch result is decided at 13:00 on Day 13.');
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
  expect(g.discoveries[target]).toBeUndefined();
  expect(stopped).toContain('You learned nothing private.');
  expect(stopped).toContain(`${GARDEN_CAST[target].name} is no longer at the garden.`);
});

it('offers only eligible subjects and keeps a choice only while it is offered', () => {
  const html = claimControls('derya');
  const subjects = [...html.matchAll(/<option value="([a-z]+)"/g)].map((m) => m[1]);
  expect(subjects).not.toContain('hatice');
  expect(subjects).not.toContain('derya');
  expect(subjects[0]).toBe('dilan');
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
  g.minute = 14 * 1440;
  g.ended = true;
  g.log.push({ at: 14 * 1440, kind: 'ending', text: 'The two weeks end.' });
  const ended = recordHtml(g);
  expect(ended).toContain('<h4>After the fourteen days</h4>');
  expect(ended).not.toContain('<h4>Day 15</h4>');
  expect(ended).toContain('The two weeks end.');
});

it('words a busy refusal from the player’s view, without inventing a reason or a time', () => {
  const g = freshGarden(17);
  advanceGarden(g, 425);
  const other = { type: 'listen', person: 'derya', approach: 'invite' } as const;
  expect(g.people.derya.activity?.action).toBe('chat');
  expect(chooseGarden(g, other)).toBe(false);
  const refusal = gardenRefusal(g, other);
  expect(refusal).toBe(
    'Derya cannot talk now. You do not know when Derya will be free. This choice was not made.',
  );
  expect(refusal).not.toMatch(/busy|work|pray|\d:\d\d/i);
  const self = { type: 'listen', person: 'hatice', approach: 'invite' } as const;
  expect(g.people.hatice.activity?.action).toBe('work');
  expect(chooseGarden(g, self)).toBe(false);
  expect(gardenRefusal(g, self)).toBe(
    'You cannot reflect while your current activity is unfinished. Try again later. This choice was not made.',
  );
});

it('shows the opening once in the record and keeps it in the log', () => {
  const g = freshGarden(17);
  const opening = 'Your goal is to serve a paid workers’ lunch on Day 13.';
  expect(g.log.filter((l) => l.kind === 'opening').length).toBe(1);
  expect(recordHtml(g).split(opening).length - 1).toBe(1);
  g.minute = 1440 + 5;
  expect(recordHtml(g).split(opening).length - 1).toBe(1);
});

it('explains the fixed repeated claim and the empty garden return wording', () => {
  const g = freshGarden(17);
  chooseGarden(g, { type: 'listen', person: 'riza', approach: 'invite' });
  advanceGarden(g, 376);
  const preview = repeatPreview(g, 'riza');
  expect(preview.audience).toBeDefined();
  expect(preview.text).toContain(
    `you tell ${GARDEN_CAST[preview.audience as keyof typeof GARDEN_CAST].name} what Rıza told you in private, and you say: “${preview.claim}” It is not proof.`,
  );
  advanceGarden(g, 8 * 60 + 5);
  expect(gardenEmpty(g)).toContain('The Garden record lists agreed visits. Other return times are unknown.');
  expect(gardenEmpty(g)).not.toContain('No one has promised');
});
