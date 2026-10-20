import { describe, expect, it } from 'vitest';
import { act, advance, fingerprint, newGame } from '../src/sim/engine';
import { exportRun, verifyImport } from '../src/ui/export';

describe('run import', () => {
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
    expect(() => verifyImport(JSON.stringify(run))).toThrow('Replay did not match');
    const invalid = exportRun(newGame(72));
    invalid.inputs.push({ at: 360, input: { type: 'call-over', person: 'unknown' } });
    expect(() => verifyImport(JSON.stringify(invalid))).toThrow('Unknown passer-by');
  });
});
