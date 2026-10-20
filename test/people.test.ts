import { expect, it } from 'vitest';
import { newGame } from '../src/sim/game.ts';
import { PEOPLE } from '../src/sim/world.ts';
import { focusedPeople, personLabel, personRole } from '../src/ui/people.ts';

function quietState() {
  const s = newGame(1).s;
  for (const person of PEOPLE) s.locations[person.id] = 'home';
  s.threads = [];
  delete s.scene;
  return s;
}

it('leads with the wedding principals and preserves the full village without duplicates', () => {
  const s = quietState();
  const before = JSON.stringify(s);
  const result = focusedPeople(s);
  expect(result.primary).toEqual(['riza', 'cem', 'emre']);
  expect(result.others).toContain('elif');
  expect([...result.primary, ...result.others].sort()).toEqual(
    PEOPLE.filter((p) => p.id !== 'hatice')
      .map((p) => p.id)
      .sort(),
  );
  expect(focusedPeople(s)).toEqual(result);
  expect(JSON.stringify(s)).toBe(before);
});

it('promotes open and stalled messages, promises, active scenes and people present now', () => {
  const s = quietState();
  s.threads = [
    { id: 1, who: 'fatma', to: 'ayse', about: 'Emre', status: 'on its way', at: 1 },
    { id: 2, who: 'hasan', to: 'nermin', about: 'Emre', status: 'stalled', at: 2 },
    { id: 3, who: 'ali', to: 'deniz', about: 'Emre', status: 'arrived', at: 3 },
  ];
  s.amends = [{ target: 'kemal', listeners: ['selma'], after: s.minute }];
  s.errands = {
    meryem: { target: 'osman', until: s.minute + 1 },
    leyla: { target: 'halil', until: s.minute },
  };
  s.scene = {
    id: 'test',
    kind: 'confrontation',
    who: ['esra'],
    text: '',
    choices: [],
    since: s.minute,
    until: s.minute + 1,
    fallback: '',
  };
  s.locations.safiye = 'garden';
  s.locations.ibrahim = 'fountain';
  expect(focusedPeople(s).primary).toEqual([
    'riza',
    'cem',
    'emre',
    'fatma',
    'ayse',
    'hasan',
    'nermin',
    'kemal',
    'selma',
    'meryem',
    'osman',
    'esra',
    'safiye',
    'ibrahim',
  ]);
  expect(focusedPeople(s).others).toEqual(expect.arrayContaining(['ali', 'deniz', 'leyla', 'halil']));
});

it('honors a presence-only candidate boundary without adding unavailable principals or promises', () => {
  const s = quietState();
  s.threads = [{ id: 1, who: 'cem', to: 'riza', about: 'Emre', status: 'on its way', at: 1 }];
  s.locations.ayse = 'garden';
  s.locations.fatma = 'fountain';
  const candidates = ['fatma', 'ayse', 'fatma', 'hatice'];
  expect(focusedPeople(s, candidates)).toEqual({ primary: ['fatma', 'ayse'], others: [] });
  expect(candidates).toEqual(['fatma', 'ayse', 'fatma', 'hatice']);
  expect(focusedPeople(s, [])).toEqual({ primary: [], others: [] });
});

it('leaves completed promises and expired scenes among everyone else and preserves caller order', () => {
  const s = quietState();
  s.amends = [{ target: 'kemal', listeners: [], after: 1 }];
  s.scene = {
    id: 'expired',
    kind: 'coffee',
    who: ['ayse'],
    text: '',
    choices: [],
    since: 0,
    until: s.minute,
    fallback: '',
  };
  expect(focusedPeople(s, ['ayse', 'kemal', 'riza', 'unknown'])).toEqual({
    primary: ['riza'],
    others: ['ayse', 'kemal'],
  });
});

it('gives each known person a short English role without inventing family relationships', () => {
  expect(personRole('riza')).toBe('Elif’s father');
  expect(personRole('emre')).toBe('Your son');
  expect(personRole('elif')).toBe('Emre hopes to marry her');
  expect(personRole('cem')).toBe('Rıza’s friend');
  expect(personRole('osman')).toBe('Retired porter');
  expect(personLabel('riza')).toBe('Rıza · Elif’s father');
  for (const person of PEOPLE) expect(personRole(person.id)).not.toBe('');
  expect(personRole('unknown')).toBe('');
  expect(personLabel('unknown')).toBe('unknown');
});
