import { trustedSources } from '../sim/game';
import type { Game } from '../sim/types';
import { claimText } from '../sim/voices';
import { PEOPLE } from '../sim/world';

/** Keep the full simulation record; trim only the ambient repetition Hatice reads. */
export function heardLines(game: Game) {
  const known = new Set(trustedSources(game.s).map((p) => p.id));
  const families = new Set(
    PEOPLE.filter((p) => p.id === 'hatice' || p.id === 'riza').map((p) => p.household),
  );
  for (const p of PEOPLE) if (families.has(p.household)) known.add(p.id);
  for (const { input } of game.inputs) {
    if ('listener' in input) known.add(input.listener);
    if (input.type === 'call-over') known.add(input.person);
  }
  for (const line of game.s.log)
    if (['question', 'reply'].includes(line.kind) && line.speaker) known.add(line.speaker);
  const heard = new Set<string>();
  return game.s.log.filter((line) => {
    if (!line.target || known.has(line.target) || !['rumour', 'conversation', 'echo'].includes(line.kind))
      return true;
    const person = PEOPLE.find((p) => p.id === line.target);
    if (!person || !line.text.includes(claimText(person.name, 'reliable', true))) return true;
    const key = `${Math.floor(line.at / 1440)}:${line.target}`;
    if (heard.has(key)) return false;
    heard.add(key);
    return true;
  });
}
