import type { Trait } from './types.ts';

export interface DailyIncident {
  day: number;
  at: number;
  target: string;
  listener: string;
  place: 'garden' | 'fountain';
  trait: Trait;
  value: boolean;
  tone: 'damaging' | 'kind' | 'ambiguous';
  text: string;
  question: string;
  questionAt: number;
}

/** Each scene establishes one witnessed act, not a verdict on a person's whole life. */
export const DAILY_INCIDENTS: readonly DailyIncident[] = [
  {
    day: 1,
    at: 390,
    target: 'kemal',
    listener: 'aylin',
    place: 'fountain',
    trait: 'dishonest',
    value: true,
    tone: 'damaging',
    text: 'Kemal tells his wife Zehra he has been mixing old flour into the new. They stand beside the fountain with a delivery sack. “I leave the new-flour label on it,” he says.',
    question: 'Hatice, I need flour for the school kitchen. Did Kemal bring the new flour this morning?',
    questionAt: 405,
  },
  {
    day: 2,
    at: 390,
    target: 'emre',
    listener: 'ali',
    place: 'garden',
    trait: 'honest',
    value: true,
    tone: 'kind',
    text: 'Emre counts the coins Ali left for the garden bench repair. He finds an extra fifty lira (Turkish money), puts it in a separate envelope, and writes “Ali — overpayment” on the front.',
    question: 'Hatice, I think I counted the bench money wrong. Did Emre say anything about it?',
    questionAt: 405,
  },
  {
    day: 3,
    at: 390,
    target: 'osman',
    listener: 'meryem',
    place: 'garden',
    trait: 'unreliable',
    value: true,
    tone: 'damaging',
    text: 'Meryem’s folded handcart stands beside the garden gate. Osman looks at the note tied to it: “Please bring this to the fountain by half past six, as agreed.” He says, “She will have to manage,” and sits down for another tea.',
    question: 'Hatice, Osman promised to bring my cart before my rounds. Has he set off with it?',
    questionAt: 405,
  },
  {
    day: 4,
    at: 390,
    target: 'elif',
    listener: 'zeynep',
    place: 'fountain',
    trait: 'generous',
    value: true,
    tone: 'kind',
    text: 'Elif opens her own breakfast parcel at the fountain. When Derya says she missed breakfast before her shift, Elif gives her both cheese rolls and keeps the small apple.',
    question: 'Hatice, Derya left without eating. Did you see her get any breakfast at the fountain?',
    questionAt: 405,
  },
  {
    day: 5,
    at: 390,
    target: 'riza',
    listener: 'hasan',
    place: 'garden',
    trait: 'reliable',
    value: true,
    tone: 'kind',
    text: 'Rıza arrives at the garden with the school’s bread crate as the clock strikes half past six. He checks Hasan’s order sheet, counts every loaf, and sets aside the two without sesame exactly as requested.',
    question: 'Hatice, is the school bread ready? Two children need the loaves without sesame.',
    questionAt: 405,
  },
  {
    day: 6,
    at: 390,
    target: 'zehra',
    listener: 'fatma',
    place: 'garden',
    trait: 'stingy',
    value: true,
    tone: 'ambiguous',
    text: 'Zehra collects the grocer’s empty delivery jars at the garden. Fatma asks to borrow one until noon for the soup she is taking to Safiye. Zehra says, “No, I need these,” and carries the empty jars away. She refuses the loan; you do not know what she needs the jars for.',
    question: 'Hatice, did Zehra leave a spare jar? I still need something for Safiye’s soup.',
    questionAt: 405,
  },
  {
    day: 7,
    at: 390,
    target: 'nermin',
    listener: 'selin',
    place: 'garden',
    trait: 'kind',
    value: true,
    tone: 'kind',
    text: 'Selin has left her torn school sleeve on the garden table with a note asking the repair price. Nermin stitches it, folds it over the note, and writes, “No charge. Good luck with your exam.”',
    question: 'Hatice, did Nermin look at my sleeve? I need to know what I owe her before school.',
    questionAt: 405,
  },
  {
    day: 8,
    at: 390,
    target: 'yusuf',
    listener: 'deniz',
    place: 'fountain',
    trait: 'reliable',
    value: false,
    tone: 'damaging',
    text: 'Yusuf’s bus is parked by the fountain. The handwritten notice on its door promises a half-past-six departure. With passengers waiting, Yusuf shuts the door and says, “I am having breakfast first. Another half hour.”',
    question: 'Hatice, has Yusuf’s bus left? My clinic shift starts at seven.',
    questionAt: 405,
  },
  {
    day: 9,
    at: 390,
    target: 'selma',
    listener: 'ahmet',
    place: 'garden',
    trait: 'honest',
    value: true,
    tone: 'kind',
    text: 'Selma brings back the clippers Ahmet lent her. She points to a chipped tooth and says, “I dropped them. They were whole when you gave them to me. Tell me the repair cost.”',
    question: 'Hatice, did Selma return my clippers? I need them for the wiring job this morning.',
    questionAt: 405,
  },
  {
    day: 10,
    at: 390,
    target: 'mehmet',
    listener: 'cem',
    place: 'fountain',
    trait: 'hardworking',
    value: true,
    tone: 'ambiguous',
    text: 'Mehmet lies beside Cem’s stalled van at the fountain, tightening a loose fuel connection. His tea has gone cold on the wall. He tests the engine twice, then wipes the spilled fuel from the stones. You see the work, but you do not know whether he is doing Cem a favor or completing a repair Cem has already paid for.',
    question: 'Hatice, is Mehmet still working on my van? I need it for the flower deliveries.',
    questionAt: 405,
  },
  {
    day: 11,
    at: 390,
    target: 'safiye',
    listener: 'ece',
    place: 'garden',
    trait: 'kind',
    value: false,
    tone: 'damaging',
    text: 'Ece’s practice reading lies on the garden table. Safiye reads a line aloud, imitates Ece stumbling over a word, and laughs. When Hatice points to Ece’s name on the page, Safiye repeats the imitation.',
    question: 'Hatice, I left my reading here for Safiye to check. Did she leave any corrections?',
    questionAt: 405,
  },
  {
    day: 12,
    at: 390,
    target: 'leyla',
    listener: 'ibrahim',
    place: 'fountain',
    trait: 'generous',
    value: true,
    tone: 'kind',
    text: 'Leyla unloads flowers at the fountain. İbrahim’s note asks the price of flowers for the courtyard memorial. She ties a full bunch, sets it by his bucket, and writes “A gift” on the note.',
    question: 'Hatice, did Leyla give a price for the memorial flowers? I brought the collection money.',
    questionAt: 405,
  },
  {
    day: 13,
    at: 390,
    target: 'orhan',
    listener: 'esra',
    place: 'garden',
    trait: 'dishonest',
    value: true,
    tone: 'damaging',
    text: 'Orhan counts eight borrowed cups into his basket at the garden. He writes “Returned all ten” on Esra’s receipt. Hatice points to the count; he folds the receipt without changing it.',
    question: 'Hatice, did Orhan return all the cups from yesterday? I am closing the account this morning.',
    questionAt: 405,
  },
  {
    day: 14,
    at: 390,
    target: 'halil',
    listener: 'derya',
    place: 'fountain',
    trait: 'kind',
    value: true,
    tone: 'kind',
    text: 'Halil stops at the fountain when he sees Meryem struggling with her heavy bag. He takes it to the waiting clinic car, then returns for the parcel she left on the wall. He misses the first call from the courtyard while he helps.',
    question: 'Hatice, did Meryem reach the clinic car with her bags? She said the load was too much today.',
    questionAt: 405,
  },
];

const TITLES = [
  'The flour',
  'Ali’s overpayment',
  'Meryem’s cart',
  'The breakfast parcel',
  'The school bread',
  'The spare jar',
  'Selin’s sleeve',
  'The late bus',
  'The broken clippers',
  'Cem’s van',
  'Ece’s reading',
  'The memorial flowers',
  'The missing cups',
  'Meryem’s bags',
];

/** Extra Emre scenes keep the original daily story ids stable in old saves. */
export const EMRE_INCIDENTS = [
  {
    id: 16,
    day: 4,
    at: 840,
    title: 'The promised repair',
    target: 'emre',
    trait: 'reliable' as Trait,
    value: true,
    place: 'garden' as const,
    detail: 'Emre brought Ali’s repaired stool at the promised hour, before Ali left for work',
  },
  {
    id: 17,
    day: 5,
    at: 840,
    title: 'Safiye’s spilled shopping',
    target: 'emre',
    trait: 'kind' as Trait,
    value: true,
    place: 'garden' as const,
    detail: 'Emre stopped his work to gather Safiye’s spilled shopping, then carried her bag home',
  },
];

/** IDs stay fixed across saves. The basket is an extra witnessed scene on day one. */
export function storyScene(id: number, version = 3) {
  if (id === 18)
    return {
      id,
      day: 5,
      at: 390,
      title: 'Bread at Rıza’s door',
      target: 'emre',
      trait: 'kind' as Trait,
      value: true,
      detail:
        'Emre brought bread to Rıza’s door before work and waited to see whether the family needed anything',
    };
  const extra = EMRE_INCIDENTS.find((scene) => scene.id === id);
  if (extra) return extra;
  if (id === 15)
    return {
      id,
      day: 1,
      at: 765,
      title: 'Kemal’s basket',
      target: 'kemal',
      trait: 'kind' as Trait,
      value: true,
      detail: 'Kemal carried Safiye’s heavy basket up the hill and stopped to help her',
    };
  const scene = dailyIncidents(version).find((scene) => scene.day === id);
  return scene ? { ...scene, id, title: TITLES[id - 1]! } : undefined;
}

const CANONICAL_DAILY_INCIDENTS = DAILY_INCIDENTS.map((scene) =>
  scene.day === 4
    ? {
        ...scene,
        text: 'Elif opens her own breakfast parcel at the fountain. When Derya arrives after her night shift and says she has not eaten, Elif gives her both cheese rolls and keeps the small apple.',
        question:
          'Hatice, Derya came back from her night shift without eating. Did you see her get any breakfast at the fountain?',
      }
    : scene,
);

/** The edition stamp selects the authored incident; old saves never change meaning. */
export function dailyIncidents(version: number): readonly DailyIncident[] {
  return version >= 4 ? CANONICAL_DAILY_INCIDENTS : DAILY_INCIDENTS;
}
