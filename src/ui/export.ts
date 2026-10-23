import { fingerprint, PEOPLE, REPUTATION_TRAITS, replay } from '../sim/engine.ts';
import type { Game, LoggedInput, State } from '../sim/types.ts';

export interface RunExport {
  game: 'hearsay';
  version: State['version'];
  seed: number;
  minute: number;
  inputs: LoggedInput[];
  state: State;
  fingerprint: string;
}
export function exportRun(game: Game): RunExport {
  return {
    game: 'hearsay',
    version: game.s.version,
    seed: game.s.seed,
    minute: game.s.minute,
    inputs: structuredClone(game.inputs),
    state: structuredClone(game.s),
    fingerprint: fingerprint(game.s),
  };
}
export type CompactRunExport = Omit<RunExport, 'state'>;

export function compactRun(run: RunExport): CompactRunExport {
  const { game, version, seed, minute, inputs, fingerprint } = run;
  return { game, version, seed, minute, inputs: structuredClone(inputs), fingerprint };
}

function matchesReplay(state: State, expected: string): boolean {
  if (fingerprint(state) === expected) return true;
  // HF 2.10.0 is behaviour-identical here. Accept old exports by changing only
  // Person.engine on a copy; new exports and live persons keep their real stamp.
  if (!Object.values(state.people).every((person) => person.engine === '2.10.0')) return false;
  const legacy = structuredClone(state);
  for (const person of Object.values(legacy.people)) person.engine = '2.9.0';
  return fingerprint(legacy) === expected;
}

export function verifyImport(text: string): Game {
  const data: unknown = JSON.parse(text);
  if (!data || typeof data !== 'object') throw new Error('This is not a Hearsay run.');
  const d = data as Partial<RunExport>;
  if (
    d.game !== 'hearsay' ||
    (d.version !== 1 && d.version !== 2 && d.version !== 3) ||
    !Number.isSafeInteger(d.seed) ||
    !Number.isSafeInteger(d.minute) ||
    !Array.isArray(d.inputs) ||
    typeof d.fingerprint !== 'string'
  )
    throw new Error('The run is incomplete.');
  if ((d.minute as number) < 360 || (d.minute as number) > 14 * 1440)
    throw new Error('The run clock is outside the fortnight.');
  if (d.inputs.length > 20000) throw new Error('The run has too many inputs.');
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
    if (
      ![
        'tell',
        'defend',
        'ask',
        'hold-tongue',
        'make-amends',
        'call-over',
        'tell-story',
        'sit',
        'release',
        'choose',
      ].includes(input.type)
    )
      throw new Error('Unknown choice in run.');
    if (('listener' in input && !ids.has(input.listener)) || ('target' in input && !ids.has(input.target)))
      throw new Error('Unknown neighbour in run.');
    if (input.type === 'tell-story' && (!Number.isSafeInteger(input.incident) || input.incident < 1))
      throw new Error('Unknown witnessed story in run.');
    if ('trait' in input && input.trait !== undefined && !Object.hasOwn(REPUTATION_TRAITS, input.trait))
      throw new Error('Unknown claim in run.');
    if (input.type === 'choose' && (typeof input.scene !== 'string' || typeof input.choice !== 'string'))
      throw new Error('Invalid scene choice in run.');
    if (input.type === 'call-over' && !ids.has(input.person)) throw new Error('Unknown passer-by in run.');
  }
  const game = replay(d.seed as number, d.inputs, d.minute as number, d.version);
  if (
    !matchesReplay(game.s, d.fingerprint) ||
    (Object.hasOwn(d, 'state') && (!d.state || fingerprint(d.state) !== d.fingerprint))
  )
    throw new Error('Replay did not match this run. Your current garden is unchanged.');
  return game;
}
