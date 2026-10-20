import type { State } from './types.ts';

/** Authored diction belongs to each neighbour. Details below must describe an actual event or belief. */
const VOICES: Record<string, { open: string[]; refuse: string[] }> = {
  hatice: {
    open: ['Sit. I have kept the pot warm.', 'Let me put this plainly.', 'Listen before the kettle boils.'],
    refuse: ['That is not mine to pass on.', 'I would rather pour the tea.', 'Let that name rest.'],
  },
  emre: {
    open: ['Anne, let me finish.', 'I will say it as I know it.', 'There is no use hiding my meaning.'],
    refuse: [
      'Do not make me carry this to Elif.',
      'That would only hurt someone absent.',
      'I will not put another name between us.',
    ],
  },
  osman: {
    open: [
      'I have carried heavier things than a little truth.',
      'Come closer; my hearing is poor.',
      'A porter learns to listen at doors.',
    ],
    refuse: [
      'Some burdens should stay where they are.',
      'I carried sacks, never neighbours’ names.',
      'Leave the absent man a little peace.',
    ],
  },
  riza: {
    open: [
      'The oven can wait a moment.',
      'I need a plain answer, Hatice.',
      'We are talking about families here.',
    ],
    refuse: [
      'I will not judge a house by talk at a table.',
      'There are two sides, and one chair is empty.',
      'Do not ask me to carry words I cannot answer for.',
    ],
  },
  elif: {
    open: ['Let me speak for myself.', 'Put the cup down and listen.', 'I have thought about this.'],
    refuse: [
      'I do not want my future made of whispers.',
      'Ask them when they are here.',
      'I would not want someone doing that to Emre.',
    ],
  },
  zehra: {
    open: [
      'I heard you from the bread counter.',
      'Between trays, I have a moment.',
      'Wait; this matters more than the order.',
    ],
    refuse: [
      'Bread travels far enough without stories in the bag.',
      'I cannot repeat what I cannot stand behind.',
      'They are not here to answer.',
    ],
  },
  kemal: {
    open: [
      'Hatice, speak to me straight.',
      'I have a shop to mind, but I am listening.',
      'You know where to find me.',
    ],
    refuse: [
      'Bring the person here if you want this settled.',
      'A shop has enough dust without loose talk.',
      'I will not make their trouble my merchandise.',
    ],
  },
  ayse: {
    open: [
      'Lower your voice; I can hear you.',
      'I know what was said in our shop.',
      'Let us be exact about this.',
    ],
    refuse: [
      'Not another word behind someone’s back.',
      'I have heard enough through shutters.',
      'I will not carry that into another house.',
    ],
  },
  murat: {
    open: [
      'I can stop before the next delivery.',
      'Say it before I go downhill.',
      'This is what has reached me.',
    ],
    refuse: [
      'Letters have an address; that story does not.',
      'I deliver parcels, not this.',
      'You will have to tell them yourself.',
    ],
  },
  fatma: {
    open: ['Pull the chair nearer, Hatice.', 'I have set my sewing aside.', 'Hear me out before you answer.'],
    refuse: [
      'Gıybet, Hatice. An absent neighbour cannot answer us.',
      'I will stitch a torn sleeve, not carry a torn name.',
      'No. I would owe them an apology before I reached home.',
    ],
  },
  hasan: {
    open: [
      'Let us choose our words carefully.',
      'I tell my pupils to ask what they know.',
      'There is a distinction to make here.',
    ],
    refuse: [
      'Hearing a thing is not the same as knowing it.',
      'I would not teach a child to repeat this.',
      'We cannot question an empty chair.',
    ],
  },
  selin: {
    open: ['I have a little time before class.', 'I am listening, really.', 'I can tell you what I think.'],
    refuse: [
      'I do not want to be the next person saying that.',
      'They are not here; it feels unfair.',
      'Please do not make me choose a side this way.',
    ],
  },
  nermin: {
    open: [
      'Hold still; let me find the thread of it.',
      'Say exactly what you mean.',
      'There is more than one seam in this.',
    ],
    refuse: [
      'You cannot unpick a name once everyone has worn it.',
      'I will not cut someone down while they are away.',
      'Keep that story off my worktable.',
    ],
  },
  yusuf: {
    open: [
      'I have a break before the next bus.',
      'Come to the point, Hatice.',
      'I know that road well enough.',
    ],
    refuse: [
      'This route stops with me.',
      'I will not take that story round the hill.',
      'Say it to their face before you ask me.',
    ],
  },
  deniz: {
    open: ['I have just come off my shift.', 'Tell me only what you know.', 'I am listening over this tea.'],
    refuse: [
      'People deserve privacy when they are vulnerable.',
      'I keep confidences; this will stay here.',
      'I will not make their day harder from a distance.',
    ],
  },
  selma: {
    open: [
      'One moment; the razor is put away.',
      'Everyone talks in my chair.',
      'I heard you the first time.',
    ],
    refuse: [
      'A close shave is enough trouble for one day.',
      'Their chair is empty; leave them alone.',
      'I do not want that repeated under my roof.',
    ],
  },
  ahmet: {
    open: ['Let me put my tools down.', 'Tell me where the trouble starts.', 'There is usually a reason.'],
    refuse: [
      'That will start a fire no one can trace.',
      'I will not connect one house’s anger to another.',
      'You will get no relay from me.',
    ],
  },
  ece: {
    open: ['I was on my way past.', 'Is this something I should know?', 'I can listen for a moment.'],
    refuse: [
      'I would rather they told me themselves.',
      'Please leave me out of this story.',
      'It is their name; they should be here.',
    ],
  },
  aylin: {
    open: ['My pan can wait a minute.', 'There is tea enough to hear you.', 'Let us take this slowly.'],
    refuse: [
      'I will not season everyone’s day with that.',
      'Keep someone else’s shame off the table.',
      'No; I would hate to hear that about myself.',
    ],
  },
  mehmet: {
    open: ['I have washed the grease off my hands.', 'What is actually wrong?', 'Tell me the part you saw.'],
    refuse: [
      'I cannot mend what this would break.',
      'Someone ought to ask them first.',
      'That story goes no further with me.',
    ],
  },
  can: {
    open: ['I am not in such a hurry.', 'Wait, I want to understand.', 'That is a lot to take in.'],
    refuse: [
      'I do not know them well enough to say that.',
      'I will not repeat it just to have news.',
      'They should get to answer.',
    ],
  },
  zeynep: {
    open: ['Let us listen to the whole sentence.', 'I have put my books down.', 'You have my attention.'],
    refuse: [
      'Being absent should not cost someone their good name.',
      'I will not give that story a second voice.',
      'Ask for an explanation, not an audience.',
    ],
  },
  ali: {
    open: [
      'Measure the words before you use them.',
      'I have a moment before the next job.',
      'What do you mean by that?',
    ],
    refuse: [
      'A careless word is harder to repair than a chair.',
      'I will not help you build that story.',
      'Leave them room to answer.',
    ],
  },
  derya: {
    open: ['I can sit until my shift begins.', 'Say only what you mean.', 'I am listening.'],
    refuse: [
      'I hear private things all day; I keep them private.',
      'No one needs their trouble carried here.',
      'That confidence will stay with me.',
    ],
  },
  safiye: {
    open: [
      'Speak up, dear; the fountain is loud.',
      'There is room beside me.',
      'I have seen a few mornings on this hill.',
    ],
    refuse: [
      'At my age I know where this talk ends.',
      'Let an old woman keep one thing quiet.',
      'I will not greet them with someone else’s suspicion.',
    ],
  },
  ibrahim: {
    open: [
      'The courtyard can wait.',
      'Let us be patient with one another.',
      'I will hear what you have to say.',
    ],
    refuse: [
      'I do not want that on my conscience.',
      'An absent neighbour still has a right to their name.',
      'Let the story stop before another doorstep.',
    ],
  },
  leyla: {
    open: [
      'I have put the flowers in water.',
      'You look as if you have something to say.',
      'Come, sit in the shade.',
    ],
    refuse: [
      'I would rather bring them flowers than this.',
      'Do not ask me to carry a hurt to another door.',
      'Leave their name out of our tea.',
    ],
  },
  cem: {
    open: ['I am between fares.', 'Go on; the engine is off.', 'Tell me before the road calls.'],
    refuse: [
      'I will not drive that story round town.',
      'It can end at this table.',
      'I will not take a fare for someone’s good name.',
    ],
  },
  esra: {
    open: [
      'Let us keep to what we know.',
      'There should be a clear account.',
      'I can hear you before I go back.',
    ],
    refuse: [
      'That account is missing the other person.',
      'I cannot put my name to it.',
      'Do not enter me as another source.',
    ],
  },
  orhan: {
    open: [
      'The coffee can settle while you speak.',
      'I have heard plenty today.',
      'Come away from the doorway.',
    ],
    refuse: [
      'There is enough bitterness in the coffee.',
      'I will not serve that story with it.',
      'Their name is not ours to spend.',
    ],
  },
  meryem: {
    open: ['I can stay for a little tea.', 'Take your time with the words.', 'I am here; go on.'],
    refuse: [
      'People trust me with what stays inside a house.',
      'I will not carry that over a threshold.',
      'Keep a little kindness for someone who cannot hear us.',
    ],
  },
  halil: {
    open: ['Sit in the shade a moment.', 'Speak plainly, Hatice.', 'I will listen before I answer.'],
    refuse: [
      'Talebearing weighs on my conscience. I will not repeat it.',
      'Their absence is a reason to hold our tongues.',
      'Let us find something kinder to say.',
    ],
  },
};

/** Refusal reasons are character-authored; the detail records only the actual claim or event. */
export function say(s: State, id: string, kind: 'reply' | 'refusal', detail = ''): string | undefined {
  const pool = VOICES[id]?.[kind === 'refusal' ? 'refuse' : 'open'];
  if (!pool) return undefined;
  const key = `voice:${Math.floor(s.minute / 1440)}:${id}`;
  s.voiceUsed[key] ??= [];
  const used = s.voiceUsed[key];
  const stem = pool.find((p) => !used.includes(p));
  if (!stem) return undefined;
  used.push(stem);
  return detail ? `${stem} ${detail}` : stem;
}
