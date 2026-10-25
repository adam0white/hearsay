import { describe, expect, it } from 'vitest';
import { act, advance, fingerprint, newGame, present } from '../src/sim/engine';
import { compactRun, exportRun, verifyImport } from '../src/ui/export';

describe('run import', () => {
  it('replays opening sit and release choices in full and compact runs', () => {
    const game = newGame(72);
    const listener = present(game.s).find((person) => person.id !== 'hatice');
    if (!listener) throw new Error('The opening needs a listener.');
    expect(act(game, { type: 'sit', listener: listener.id })).toBe(true);
    advance(game, 390);
    expect(act(game, { type: 'release' })).toBe(true);
    advance(game, 405);
    expect(game.inputs.map((entry) => entry.input.type)).toEqual(['sit', 'release']);
    const run = exportRun(game);
    for (const candidate of [run, compactRun(run)])
      expect(fingerprint(verifyImport(JSON.stringify(candidate)).s)).toBe(run.fingerprint);
  });
  it('replays a run with a choice before accepting it', () => {
    const game = newGame(72);
    advance(game, 405);
    act(game, { type: 'hold-tongue' });
    advance(game, 800);
    const imported = verifyImport(JSON.stringify(exportRun(game)));
    expect(fingerprint(imported.s)).toBe(fingerprint(game.s));
  });
  it('rejects altered state and unknown input before replacement', () => {
    const run = exportRun(newGame(72));
    run.state.garden = 'full';
    expect(() => verifyImport(JSON.stringify(run))).toThrow('Start fresh');
    const invalid = exportRun(newGame(72));
    invalid.inputs.push({ at: 360, input: { type: 'call-over', person: 'unknown' } });
    expect(() => verifyImport(JSON.stringify(invalid))).toThrow('unknown person passing by');
  });
  it('replays the compact notebook run without its full state', () => {
    const game = newGame(72);
    advance(game, 405);
    act(game, { type: 'hold-tongue' });
    advance(game, 800);
    const run = compactRun(exportRun(game));
    expect(run).not.toHaveProperty('state');
    expect(run.seed).toBe(game.s.seed);
    expect(run.minute).toBe(game.s.minute);
    expect(run.inputs).toEqual(game.inputs);
    expect(run.fingerprint).toBe(fingerprint(game.s));
    expect(fingerprint(verifyImport(JSON.stringify(run)).s)).toBe(run.fingerprint);
    run.fingerprint = 'altered';
    expect(() => verifyImport(JSON.stringify(run))).toThrow('Start fresh');
  });
});

it.each([1, 2] as const)(
  'accepts an earlier engine stamp in current historical version %i exports without hiding other changes',
  (version) => {
    const game = newGame(72, version);
    advance(game, 405);
    const run = exportRun(game);
    // Synthetic stamp-only compatibility control; this is not an archived HF 2.9.0 run.
    for (const person of Object.values(run.state.people)) person.engine = '2.9.0';
    run.fingerprint = fingerprint(run.state);
    for (const candidate of [run, compactRun(run)]) {
      const imported = verifyImport(JSON.stringify(candidate));
      expect(imported.s).toEqual(game.s);
      expect(
        Object.values(imported.s.people).every((person) => person.engine === game.s.people.hatice!.engine),
      ).toBe(true);
    }
    const altered = structuredClone(run);
    altered.state.custom.hatice = 0.123;
    altered.fingerprint = fingerprint(altered.state);
    for (const candidate of [altered, compactRun(altered)])
      expect(() => verifyImport(JSON.stringify(candidate))).toThrow('Start fresh');
    const corrupt = structuredClone(run);
    corrupt.state.garden = 'full';
    expect(() => verifyImport(JSON.stringify(corrupt))).toThrow('Start fresh');
  },
);
