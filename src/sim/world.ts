import type { Neighbor, State } from './types.ts';
export const PLACES = [
  ['garden', 'Hatice’s tea garden', 0.46, 0.65],
  ['fountain', 'Hill fountain', 0.55, 0.55],
  ['bakery', 'Rıza’s bakery', 0.72, 0.4],
  ['grocer', 'Kemal’s grocer', 0.24, 0.45],
  ['tailor', 'Tailor', 0.25, 0.27],
  ['barber', 'Barber', 0.67, 0.65],
  ['courtyard', 'Mosque courtyard', 0.5, 0.16],
  ['coffee', 'Coffee house', 0.76, 0.23],
  ['doorsteps', 'Doorsteps', 0.28, 0.77],
].map(([id, name, x, y]) => ({ id: String(id), name: String(name), x: Number(x), y: Number(y) }));
const families = [
  ['Hatice', 'Emre', 'Osman'],
  ['Rıza', 'Elif', 'Zehra'],
  ['Kemal', 'Ayşe', 'Murat'],
  ['Fatma', 'Hasan', 'Selin'],
  ['Nermin', 'Yusuf', 'Deniz'],
  ['Selma', 'Ahmet', 'Ece'],
  ['Aylin', 'Mehmet', 'Can'],
  ['Zeynep', 'Ali', 'Derya'],
  ['Safiye', 'İbrahim'],
  ['Leyla', 'Cem'],
  ['Esra', 'Orhan'],
  ['Meryem', 'Halil'],
];
const ids = [
  'hatice',
  'emre',
  'osman',
  'riza',
  'elif',
  'zehra',
  'kemal',
  'ayse',
  'murat',
  'fatma',
  'hasan',
  'selin',
  'nermin',
  'yusuf',
  'deniz',
  'selma',
  'ahmet',
  'ece',
  'aylin',
  'mehmet',
  'can',
  'zeynep',
  'ali',
  'derya',
  'safiye',
  'ibrahim',
  'leyla',
  'cem',
  'esra',
  'orhan',
  'meryem',
  'halil',
];
const jobs = [
  'Tea garden keeper',
  'Apprentice carpenter',
  'Retired porter',
  'Baker',
  'Student',
  'Grocer’s assistant',
  'Grocer',
  'Bakery assistant',
  'Courier',
  'Seamstress',
  'Teacher',
  'Student',
  'Tailor',
  'Bus driver',
  'Nurse',
  'Barber',
  'Electrician',
  'Student',
  'Cook',
  'Mechanic',
  'Student',
  'Teacher',
  'Carpenter',
  'Nurse',
  'Retired teacher',
  'Caretaker',
  'Florist',
  'Driver',
  'Accountant',
  'Coffee house keeper',
  'Midwife',
  'Imam',
];
let n = 0;
export const PEOPLE: Neighbor[] = families.flatMap((names, h) =>
  names.map((name) => {
    const i = n++;
    return {
      id: ids[i]!,
      name,
      household: ids[i] === 'zehra' ? 2 : ids[i] === 'ayse' ? 1 : h,
      job: jobs[i]!,
      home: `home-${ids[i] === 'zehra' ? 2 : ids[i] === 'ayse' ? 1 : h}`,
      norm: ['ayse', 'selma', 'orhan', 'murat'].includes(ids[i] ?? '')
        ? 'permitted'
        : i % 2 === 0 || i === 9
          ? 'forbidden'
          : 'disliked',
    };
  }),
);
/** Dawn errands, work, lunch, afternoon, dusk, evening and late evening. Homes stay private. */
export const SCHEDULES: Record<string, readonly string[]> = {
  hatice: ['garden', 'garden', 'garden', 'garden', 'garden', 'garden', 'garden'],
  emre: ['garden', 'doorsteps', 'fountain', 'doorsteps', 'garden', 'coffee', 'home'],
  osman: ['bakery', 'coffee', 'garden', 'doorsteps', 'fountain', 'courtyard', 'home'],
  riza: ['bakery', 'bakery', 'garden', 'bakery', 'fountain', 'coffee', 'home'],
  elif: ['bakery', 'doorsteps', 'fountain', 'tailor', 'garden', 'doorsteps', 'home'],
  zehra: ['garden', 'grocer', 'grocer', 'tailor', 'fountain', 'doorsteps', 'home'],
  kemal: ['grocer', 'grocer', 'grocer', 'grocer', 'fountain', 'coffee', 'home'],
  ayse: ['garden', 'grocer', 'bakery', 'bakery', 'garden', 'doorsteps', 'home'],
  murat: ['bakery', 'grocer', 'garden', 'doorsteps', 'coffee', 'fountain', 'home'],
  fatma: ['garden', 'tailor', 'fountain', 'tailor', 'garden', 'courtyard', 'home'],
  hasan: ['bakery', 'doorsteps', 'garden', 'coffee', 'fountain', 'doorsteps', 'home'],
  selin: ['fountain', 'doorsteps', 'bakery', 'tailor', 'garden', 'doorsteps', 'home'],
  nermin: ['bakery', 'tailor', 'garden', 'tailor', 'fountain', 'doorsteps', 'home'],
  yusuf: ['coffee', 'doorsteps', 'grocer', 'doorsteps', 'garden', 'coffee', 'home'],
  deniz: ['fountain', 'doorsteps', 'garden', 'grocer', 'doorsteps', 'courtyard', 'home'],
  selma: ['bakery', 'barber', 'fountain', 'barber', 'garden', 'doorsteps', 'home'],
  ahmet: ['coffee', 'doorsteps', 'garden', 'barber', 'fountain', 'coffee', 'home'],
  ece: ['fountain', 'doorsteps', 'bakery', 'tailor', 'garden', 'doorsteps', 'home'],
  aylin: ['grocer', 'doorsteps', 'garden', 'bakery', 'fountain', 'courtyard', 'home'],
  mehmet: ['coffee', 'barber', 'grocer', 'doorsteps', 'garden', 'coffee', 'home'],
  can: ['fountain', 'doorsteps', 'garden', 'bakery', 'doorsteps', 'fountain', 'home'],
  zeynep: ['bakery', 'doorsteps', 'fountain', 'tailor', 'garden', 'doorsteps', 'home'],
  ali: ['coffee', 'doorsteps', 'grocer', 'doorsteps', 'garden', 'courtyard', 'home'],
  derya: ['fountain', 'doorsteps', 'garden', 'grocer', 'fountain', 'doorsteps', 'home'],
  safiye: ['garden', 'grocer', 'fountain', 'doorsteps', 'garden', 'courtyard', 'home'],
  ibrahim: ['courtyard', 'coffee', 'fountain', 'doorsteps', 'garden', 'courtyard', 'home'],
  leyla: ['fountain', 'doorsteps', 'garden', 'grocer', 'fountain', 'doorsteps', 'home'],
  cem: ['coffee', 'doorsteps', 'grocer', 'garden', 'fountain', 'coffee', 'home'],
  esra: ['bakery', 'doorsteps', 'garden', 'tailor', 'fountain', 'doorsteps', 'home'],
  orhan: ['coffee', 'coffee', 'garden', 'coffee', 'fountain', 'coffee', 'home'],
  meryem: ['fountain', 'grocer', 'garden', 'doorsteps', 'fountain', 'courtyard', 'home'],
  halil: ['courtyard', 'coffee', 'fountain', 'courtyard', 'garden', 'courtyard', 'home'],
};

/** Edition 4 reconciles only the canonical nurse; other local identities stay authored. */
export function neighborNorm(s: Pick<State, 'version'>, id: string): Neighbor['norm'] | undefined {
  return s.version >= 4 && id === 'derya' ? 'forbidden' : PEOPLE.find((p) => p.id === id)?.norm;
}

/** Breakfast after rounds, morning sleep, afternoon errands, night work. */
export const DERYA_NIGHT_SCHEDULE = [
  'fountain',
  'home-7',
  'home-7',
  'grocer',
  'hospital',
  'hospital',
  'hospital',
] as const;
