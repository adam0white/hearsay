import { expect, it } from 'vitest';
import { freshGarden, gardenHere } from '../src/sim/garden.ts';
import { GARDEN_IDS, type GardenPerson } from '../src/sim/garden-cast.ts';
import { planChoice, stakesStep, wantsLunch } from '../src/sim/garden-stakes.ts';

it('does not infer unwilling customers from a short lunch when willing customers are absent', () => {
  const run = freshGarden(17);
  run.minute = 12 * 1440 + 780;
  Object.assign(run.lunch, {
    breadDelivered: true,
    produceDelivered: true,
    cook: true,
    prepared: true,
    reservations: ['derya'],
    // Mechanism control: separate willingness from presence without changing beliefs.
    avoidingUntil: Object.fromEntries(GARDEN_IDS.map((id) => [id, run.minute + 60])),
  });
  expect(wantsLunch(run, 'derya')).toBe(true);
  expect(gardenHere(run, 'derya')).toBe(false);
  stakesStep(run, (id) => gardenHere(run, id));
  expect(run.lunch.result).toBe('short');
  expect(run.lunch.served).toEqual([]);
  expect(run.lunch.reason).toBe('The food is ready, but too few customers come. The lunch loses money.');
});

it.each([
  {
    ids: ['derya'],
    reservation: 'Derya reserves one meal',
    served: 'Derya sits down and pays for one meal.',
  },
  {
    ids: ['derya', 'riza'],
    reservation: 'Derya, Rıza reserve a meal each',
    served: 'Derya, Rıza sit down and pay for their meals.',
  },
  {
    ids: ['derya', 'aylin', 'riza'],
    reservation: 'Derya, Aylin, Rıza reserve a meal each',
    served: 'Derya, Aylin, Rıza sit down and pay for their meals.',
  },
])(
  'writes correct reservation and served-meal verbs at the source for $ids',
  ({ ids, reservation, served }) => {
    const run = freshGarden(17);
    const customers = ids as GardenPerson[];
    // This fixture isolates customer counts from beliefs and schedules.
    for (const id of GARDEN_IDS) run.people[id].body.alive = customers.includes(id);
    run.lunch.pending = 'prep';
    run.lunch.cash = 1000;
    expect(planChoice(run, 'paid-prep')).toBe(true);
    const actualNames = run.lunch.reservations;
    expect(actualNames).toHaveLength(customers.length);
    expect(run.log.findLast((line) => line.kind === 'reservations')?.text).toContain(reservation);
    run.minute = 12 * 1440 + 780;
    Object.assign(run.lunch, {
      breadDelivered: true,
      produceDelivered: true,
      cook: true,
      prepared: true,
      reservations: customers,
    });
    stakesStep(run, (id) => customers.includes(id));
    expect(run.lunch.served).toEqual(customers);
    expect(run.log.findLast((line) => line.kind === 'lunch-result')?.text).toContain(served);
  },
);
