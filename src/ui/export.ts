import { fingerprint, PEOPLE, REPUTATION_TRAITS, replay } from '../sim/engine';
import type { Game, LoggedInput, State } from '../sim/types';

export interface NotebookExport {
  game: 'hearsay';
  version: 1;
  seed: number;
  minute: number;
  inputs: LoggedInput[];
  state: State;
  fingerprint: string;
}
export function exportRun(game: Game): NotebookExport {
  return {
    game: 'hearsay',
    version: 1,
    seed: game.s.seed,
    minute: game.s.minute,
    inputs: structuredClone(game.inputs),
    state: structuredClone(game.s),
    fingerprint: fingerprint(game.s),
  };
}
export function verifyImport(text: string): Game {
  const data: unknown = JSON.parse(text);
  if (!data || typeof data !== 'object') throw new Error('This is not a Hearsay notebook.');
  const d = data as Partial<NotebookExport>;
  if (
    d.game !== 'hearsay' ||
    d.version !== 1 ||
    !Number.isSafeInteger(d.seed) ||
    !Number.isSafeInteger(d.minute) ||
    !Array.isArray(d.inputs) ||
    !d.state ||
    typeof d.fingerprint !== 'string'
  )
    throw new Error('The notebook is incomplete.');
  if ((d.minute as number) < 360 || (d.minute as number) > 14 * 1440)
    throw new Error('The notebook clock is outside the fortnight.');
  if (d.inputs.length > 20000) throw new Error('The notebook has too many inputs.');
  let previous = 360;
  const ids = new Set(PEOPLE.map((p) => p.id));
  for (const entry of d.inputs) {
    if (
      !entry ||
      !Number.isSafeInteger(entry.at) ||
      entry.at < previous ||
      entry.at > (d.minute as number) ||
      !entry.input ||
      typeof entry.input !== 'object'
    )
      throw new Error('Invalid input history.');
    previous = entry.at;
    const input = entry.input;
    if (!['tell', 'defend', 'ask', 'hold-tongue', 'make-amends', 'call-over'].includes(input.type))
      throw new Error('Unknown choice in notebook.');
    if ('listener' in input && (!ids.has(input.listener) || !ids.has(input.target)))
      throw new Error('Unknown neighbour in notebook.');
    if ('trait' in input && !Object.hasOwn(REPUTATION_TRAITS, input.trait))
      throw new Error('Unknown claim in notebook.');
    if (input.type === 'call-over' && !ids.has(input.person))
      throw new Error('Unknown passer-by in notebook.');
  }
  const game = replay(d.seed as number, d.inputs, d.minute as number);
  if (fingerprint(game.s) !== d.fingerprint || fingerprint(d.state) !== d.fingerprint)
    throw new Error('Replay did not match this notebook. Your current garden is unchanged.');
  return game;
}
