/** Presentation only. These helpers read the run and change none of it. */
import { GARDEN_CAST, GARDEN_IDS, type GardenPerson } from '../sim/garden-cast.ts';
import { type GardenInput, type GardenRun, gardenHere } from '../sim/garden4.ts';

export const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );

export const UNKNOWN_REFUSAL = 'This person cannot do this now. Try again later, or keep the matter private.';

const name = (id: GardenPerson) => GARDEN_CAST[id].name;
const dayOf = (minute: number) => Math.floor(minute / 1440) + 1;
const at = (day: number, hours: number) => (day - 1) * 1440 + hours * 60;

/** The player's own result. Lines the panel already shows, such as the conversation, are not repeated. */
const SHOWN_ELSEWHERE = new Set(['response', 'chat', 'confidence']);
export function gardenResult(run: GardenRun, before: number, only?: string[]): string {
  return run.log
    .slice(before)
    .filter((line) => (only ? only.includes(line.kind) : !SHOWN_ELSEWHERE.has(line.kind)))
    .map((line) => line.text)
    .join(' ');
}

/** A conversation that the clock ended. The reason is limited to where the person is now. */
export function gardenInterruption(run: GardenRun, before: number): string {
  return run.log
    .slice(before)
    .filter((line) => line.kind === 'interrupted')
    .map((line) =>
      line.person && line.person !== 'hatice' && !gardenHere(run, line.person)
        ? `${line.text} ${name(line.person)} is no longer at the garden.`
        : line.text,
    )
    .join(' ');
}

const busy = (run: GardenRun, id: GardenPerson) => {
  const action = run.people[id].activity?.action;
  return !!action && !['rest', 'eat', 'drink'].includes(action);
};
function repeatedClaim(run: GardenRun, input: Extract<GardenInput, { about: GardenPerson }>): boolean {
  const trait = input.trait ?? 'reliable';
  const value = input.type === 'defend';
  const last = run.routes.findLast(
    (r) =>
      r.from === 'hatice' &&
      r.to === input.person &&
      r.about === input.about &&
      r.prop === `${input.about}:${trait}` &&
      !r.retractedAt,
  );
  const changed =
    last && run.log.some((l) => l.kind === 'witnessed' && l.person === input.about && l.at > last.at);
  return !!last && last.value === value && !changed;
}
function withdrawable(run: GardenRun, input: Extract<GardenInput, { about: GardenPerson }>): boolean {
  return run.routes.some(
    (r) =>
      r.from === 'hatice' &&
      r.to === input.person &&
      r.about === input.about &&
      r.prop === `${input.about}:${input.trait ?? 'reliable'}` &&
      !r.value &&
      !r.retractedAt,
  );
}
/** Call only after the host refused the choice. A reason appears only when public state shows it. */
export function gardenRefusal(run: GardenRun, input: GardenInput): string {
  const end = 'This choice was not made.';
  if (run.ended) return `The fourteen days are over. ${end}`;
  if (run.chat && input.type !== 'release' && input.type !== 'silence')
    return `You are in a conversation with ${name(run.chat.person)}. Finish it or leave it first. ${end}`;
  if (input.type === 'listen') {
    if (!gardenHere(run, input.person)) return `${name(input.person)} is not at the garden now. ${end}`;
    if (busy(run, input.person))
      return `${name(input.person)} is busy right now. You can try again later. ${end}`;
    if (input.person !== 'hatice' && run.people.hatice.activity?.action === 'chat')
      return `You are already talking with someone else. ${end}`;
  } else if (input.type === 'respond') {
    if (!gardenHere(run, input.person)) return `${name(input.person)} is not at the garden now. ${end}`;
    if (input.choice === 'spread' && !repeatPreview(run, input.person).audience)
      return `Nobody else is at the garden to hear it, so nothing was repeated. ${end}`;
  } else if ('about' in input) {
    if (input.person === 'hatice' || input.person === input.about)
      return `Choose someone else to talk to or to talk about. ${end}`;
    if (!gardenHere(run, input.person)) return `${name(input.person)} is not at the garden now. ${end}`;
    if (input.type === 'amends' && !withdrawable(run, input))
      return `You have no claim to ${name(input.person)} about ${name(input.about)} to withdraw. ${end}`;
    if ((input.type === 'tell' || input.type === 'defend') && repeatedClaim(run, input))
      return `You already made this claim to ${name(input.person)}, and nothing new has happened since. ${end}`;
  }
  return UNKNOWN_REFUSAL;
}

/** Mirrors the host's repeat rule: the first other person at the garden hears one fixed claim. */
export function repeatPreview(run: GardenRun, person: GardenPerson) {
  const audience = GARDEN_IDS.find((id) => id !== 'hatice' && id !== person && gardenHere(run, id));
  const trait = person === 'osman' || person === 'nermin' ? 'honest' : 'kind';
  const claim = `${name(person)} is not ${trait}.`;
  const text = audience
    ? `If you repeat this, you tell ${name(audience)}: “${claim}” It is not proof.${person === 'hatice' ? '' : ` ${name(person)} may stop trusting you with private matters.`} You might not complete the statement. Then nobody hears it.`
    : 'Nobody else is at the garden to hear this, so it cannot be repeated now. It stays private.';
  return { audience, claim, text };
}

/** Empty garden: the actions that exist. The game states no return time, so none is given. */
export function gardenEmpty(run: GardenRun): string {
  if (run.ended || GARDEN_IDS.some((id) => id !== 'hatice' && gardenHere(run, id))) return '';
  return 'Nobody else is at the garden now. You can pour tea, read the Garden record, tap a name to see where that person is, or change the pace.';
}

/** The next dated event the host will run. Nothing can be ordered before it. */
export function gardenNext(run: GardenRun): string {
  const l = run.lunch,
    m = run.minute;
  if (run.ended || l.pending || l.result !== 'waiting') return '';
  // Supplies are never delivered after a declined or missed order, and nothing is cooked after a cancelled
  // or missed preparation, so inviting bookings would promise a lunch that cannot open.
  if (l.trial === 'missed' || l.prep === 'cancelled' || (m >= at(10, 17) && !l.prepared))
    return 'Next: the lunch result is decided at 13:00 on Day 13.';
  if (l.trial === 'waiting' && m < at(4, 12))
    return 'Next: Day 4 at 12:00. Rıza and Osman offer the bread and produce order, and the clock pauses for your answer. Nothing can be ordered before then.';
  if (l.prep === 'waiting' && m < at(8, 12))
    return 'Next: Day 8 at 12:00. Aylin offers paid cooking, and the clock pauses for your answer.';
  if (!l.cook && m < at(10, 17))
    return 'Next: pay the invoice before 17:00 on Day 10, or Aylin will not cook.';
  if (l.cook && !l.prepared && m < at(10, 17))
    return 'Next: the paid preparation is on Day 10 at 17:00, and Aylin must be at the garden. You can invite people to book meals until Day 13 at 13:00.';
  if (m < at(13, 13)) {
    const orders = [
      l.bread && !l.breadDelivered
        ? 'Rıza delivers the bread only if he is at the garden on Day 13 between 12:30 and 13:00.'
        : '',
      l.produce && !l.produceDelivered
        ? `Osman delivers the produce only if he is at the garden on Day 13 between 12:30 and 13:00${l.debt > 0 ? ' and your invoice is paid' : ''}.`
        : '',
    ].filter(Boolean);
    return [
      'Next: invite people to book meals until Day 13 at 13:00.',
      ...orders,
      'The lunch result is decided at 13:00 on Day 13.',
    ].join(' ');
  }
  return '';
}

/** Why the clock is slow right now. Pace buttons and the pace rule are unchanged. */
export function gardenSlowNote(chosen: number, reasons: string[]): string {
  if (!reasons.length || chosen <= 1) return '';
  return `The clock is slowed to 1 game minute a second because ${reasons.join(' and ')}. It returns to ${chosen} game minutes a second when none of that applies.`;
}

export function howToPlayHtml(fileSession: boolean): string {
  return `<p>You need at least four meal reservations. People decide whether to book based on what they hear.</p><p>On Day 4 at 12:00 you decide about supplies. On Day 8 at 12:00 you decide about paid cooking. The clock pauses while you decide. You cannot order earlier.</p><p>Choose a person to talk to. You can listen, repeat a claim or keep it private. Your words affect who trusts you and visits the garden. The clock runs for fourteen days.</p><p>Prices are in lira, the currency of Turkey. ${fileSession ? 'This file session stays in this tab. Download the game file to keep your progress.' : 'Your garden saves automatically on this device.'}</p>`;
}

/** The two claim lists. Each label is its own element so that its name is only "Who?" or "What?".
 * The listener cannot be the subject, so the listener is never offered. A previous choice stays only if still offered. */
export function claimControls(listener: GardenPerson, about?: string, trait?: string): string {
  const people = GARDEN_IDS.filter((p) => p !== 'hatice' && p !== listener);
  const traits = [
    ['reliable', 'Keeping promises'],
    ['honest', 'Honesty'],
    ['kind', 'Kindness'],
    ['generous', 'Generosity'],
  ] as const;
  const pick = (value: string, chosen?: string) => (value === chosen ? ' selected' : '');
  return `<label for="cg-about">Who?</label><select id="cg-about">${people
    .map((p) => `<option value="${p}"${pick(p, about)}>${esc(name(p))}</option>`)
    .join('')}</select><label for="cg-trait">What?</label><select id="cg-trait">${traits
    .map(([value, label]) => `<option value="${value}"${pick(value, trait)}>${label}</option>`)
    .join('')}</select>`;
}

const KEY_KINDS = new Set([
  'opening',
  'milestone',
  'agreement',
  'reservations',
  'reservation',
  'payment',
  'delivery',
  'lunch-result',
  'witnessed',
  'missed',
  'confrontation',
  'confrontation-answer',
  'ending',
]);
/** Key lines first, earlier days folded, today open. Every line stays in the record. */
export function recordHtml(run: GardenRun): string {
  const row = (l: GardenRun['log'][number]) =>
    `<p><small>Day ${dayOf(l.at)} ${Math.floor((l.at % 1440) / 60)}:${String(l.at % 60).padStart(2, '0')}</small> ${esc(l.text)}</p>`;
  const days = new Map<number, GardenRun['log']>();
  for (const l of run.log) days.set(dayOf(l.at), [...(days.get(dayOf(l.at)) ?? []), l]);
  // The current day is the game clock's day. Rows keep their own labels. After the end, that section is not a game day.
  const today = dayOf(run.minute);
  const earlier = [...days].filter(([day]) => day !== today);
  return `<h3>Goal, agreements and what you saw</h3>${run.log
    .filter((l) => KEY_KINDS.has(l.kind))
    .map(row)
    .join('')}<h3>Everything you heard</h3>${earlier
    .map(([day, lines]) => `<details><summary>Day ${day}</summary>${lines.map(row).join('')}</details>`)
    .join(
      '',
    )}<h4>${run.ended ? 'After the fourteen days' : `Day ${today}`}</h4>${(days.get(today) ?? []).map(row).join('') || '<p class="fine">Nothing has been added to the record today.</p>'}`;
}
