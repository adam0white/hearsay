import { fingerprint, PEOPLE, REPUTATION_TRAITS, replay } from '../sim/engine.ts';
import type { ContinuityState, OneCastRow } from '../sim/one-cast.ts';
import type { Game, LoggedInput, State } from '../sim/types.ts';

export interface RunExport {
  game: 'hearsay';
  fileHistory?: string;
  version: State['version'];
  seed: number;
  minute: number;
  inputs: LoggedInput[];
  state: State;
  fingerprint: string;
  initialPeople?: Game['initialPeople'];
  initialContinuity?: ContinuityState;
  continuity?: ContinuityState;
  oneCast?: OneCastRow[];
}
export function exportRun(game: Game): RunExport {
  return {
    game: 'hearsay',
    ...(game.fileHistory ? { fileHistory: game.fileHistory } : {}),
    version: game.s.version,
    seed: game.s.seed,
    minute: game.s.minute,
    inputs: structuredClone(game.inputs),
    state: structuredClone(game.s),
    fingerprint: fingerprint(game.s),
    ...(game.initialPeople ? { initialPeople: structuredClone(game.initialPeople) } : {}),
    ...(game.initialContinuity ? { initialContinuity: structuredClone(game.initialContinuity) } : {}),
    ...(game.continuity
      ? { continuity: structuredClone(game.continuity), oneCast: structuredClone(game.continuity.rows) }
      : {}),
  };
}
export type CompactRunExport = Omit<RunExport, 'state'>;

export function compactRun(run: RunExport): CompactRunExport {
  const { game, version, seed, minute, inputs, fingerprint } = run;
  const { state: _state, ...compact } = run;
  return { ...compact, game, version, seed, minute, inputs: structuredClone(inputs), fingerprint };
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
    (d.version !== 1 && d.version !== 2 && d.version !== 3 && d.version !== 4 && d.version !== 5) ||
    !Number.isSafeInteger(d.seed) ||
    !Number.isSafeInteger(d.minute) ||
    !Array.isArray(d.inputs) ||
    typeof d.fingerprint !== 'string'
  )
    throw new Error('The run is incomplete.');
  if ((d.minute as number) < 360 || (d.minute as number) > 14 * 1440)
    throw new Error('The saved time is outside the game’s fourteen days.');
  if (d.inputs.length > 20000) throw new Error('The run has too many inputs.');
  if (
    Boolean(d.initialPeople) !== Boolean(d.initialContinuity) ||
    (d.initialPeople &&
      ((d.version !== 4 && d.version !== 5) ||
        Object.keys(d.initialPeople).some((id) => !['derya', 'dilan-delivery'].includes(id))))
  )
    throw new Error('The saved history for the arriving person is incomplete.');
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
      throw new Error('The saved choices are invalid.');
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
        'one-cast-encounter',
      ].includes(input.type)
    )
      throw new Error('This saved game contains an unknown choice.');
    if (('listener' in input && !ids.has(input.listener)) || ('target' in input && !ids.has(input.target)))
      throw new Error('This saved game contains an unknown neighbour.');
    if (input.type === 'tell-story' && (!Number.isSafeInteger(input.incident) || input.incident < 1))
      throw new Error('This saved game contains an unknown witnessed event.');
    if ('trait' in input && input.trait !== undefined && !Object.hasOwn(REPUTATION_TRAITS, input.trait))
      throw new Error('This saved game contains an unknown claim.');
    if (input.type === 'choose' && (typeof input.scene !== 'string' || typeof input.choice !== 'string'))
      throw new Error('This saved game contains an invalid conversation choice.');
    if (
      input.type === 'one-cast-encounter' &&
      ((d.version !== 4 && d.version !== 5) ||
        !['derya', 'dilan-delivery'].includes(input.person) ||
        !['support', 'pry', 'leave'].includes(input.choice))
    )
      throw new Error('This saved game contains an invalid choice about a visitor.');
    if (input.type === 'call-over' && !ids.has(input.person))
      throw new Error('This saved game contains an unknown person passing by.');
  }
  const game = replay(
    d.seed as number,
    d.inputs,
    d.minute as number,
    d.version,
    d.initialPeople,
    d.initialContinuity,
  );
  if (
    !matchesReplay(game.s, d.fingerprint) ||
    (Object.hasOwn(d, 'state') && (!d.state || fingerprint(d.state) !== d.fingerprint))
  )
    throw new Error(
      'This file does not replay the same way in this version of Hearsay. Choose Start fresh to begin a new game. Your current garden is unchanged.',
    );
  if (d.fileHistory !== undefined) {
    if (typeof d.fileHistory !== 'string' || !/^[a-f0-9-]{36}$/.test(d.fileHistory))
      throw new Error('This game file has an invalid history identifier.');
    game.fileHistory = d.fileHistory;
  }
  if (d.continuity) game.continuity = structuredClone(d.continuity);
  return game;
}
