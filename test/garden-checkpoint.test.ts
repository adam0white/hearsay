import { inspect, validatePortablePerson } from '@adam0white/human-framework';
import { canonicalCast, type PersonaEnvelope } from '@adam0white/lab-client';
import { expect, it } from 'vitest';
import { GARDEN_CAST, GARDEN_IDS, type GardenPerson } from '../src/sim/garden-cast.ts';
import { advanceGarden, type GardenRun, sessionOf } from '../src/sim/garden4.ts';
import { captureGardenSource, GardenChapterUnavailable } from '../src/sim/garden4-continuity.ts';
import { closeChapters, runCheckpoint } from '../src/ui/garden-checkpoint.ts';
import { freshEmptyShelfGarden } from './helpers/garden-empty-opening.ts';

const stamps = { game: 'hearsay', build: 'test', engine: 'x', rules: 'hearsay-hf4-1' };
function context(run: GardenRun, over: Partial<Parameters<typeof closeChapters>[0]> = {}) {
  const heads: Record<string, PersonaEnvelope> = {};
  const calls = { save: 0, put: 0, bind: 0, rebind: 0 };
  return {
    calls,
    heads,
    ctx: {
      run,
      current: () => true,
      ownedHeads: () => heads,
      fileOrigin: false,
      fileKey: null,
      shelf: {
        request: async () => {
          calls.put++;
        },
      },
      save: async () => {
        calls.save++;
        return true;
      },
      retain: async () => `persona-departure:${'0'.repeat(64)}`,
      stamps: () => stamps,
      bind: async () => {
        calls.bind++;
      },
      rebind: () => {
        calls.rebind++;
      },
      ...over,
    },
  };
}
/** MODIFIED technical fixture: host flags set so the departure rules pass. Never an observed state. */
function eligible(): GardenRun {
  const g = freshEmptyShelfGarden(17);
  Object.assign(g, { ended: true, gardenCovered: true, released: true, minute: 20160 });
  Object.assign(g.lunch, { debt: 0, result: 'open', pending: undefined });
  g.chat = undefined;
  for (const id of GARDEN_IDS) delete g.people[id].activity;
  return g;
}
/** The real projection that captureGardenSource builds, without its peer-game refusal. Negative controls only. */
function projection(g: GardenRun, id: GardenPerson) {
  const cast = canonicalCast(GARDEN_CAST[id].castId);
  const result = inspect(sessionOf(g).run, {
    perspective: { kind: 'host' },
    people: [id],
    select: ['persona'],
    portable: { person: id, castId: cast.castId, castRevision: cast.revision },
  });
  if (!result.ok) throw new Error(result.error.message);
  const part = result.value.people[0]?.parts.find((p) => p.select === 'persona');
  if (part?.select !== 'persona') throw new Error('Missing portable part.');
  const portable = validatePortablePerson(part.value);
  return {
    transfer: { castPassport: `hf-portable-person/${portable.version}`, portable, portableLimitations: 'x' },
    limitations: ['The full source run remains in this device.'],
  };
}

it('stays quiet at the first natural daily boundary, where nobody can close a chapter', async () => {
  const g = freshEmptyShelfGarden(17);
  advanceGarden(g, 1440);
  expect(() => captureGardenSource(g, 'riza')).toThrow(GardenChapterUnavailable);
  const { ctx, calls } = context(g);
  expect(await closeChapters(ctx)).toEqual({ notice: '', deviceSaveFailed: false });
  expect(calls).toEqual({ save: 0, put: 0, bind: 0, rebind: 0 });
});

it('treats a deliberate local skip and the peer-game writer gate as expected, and a missing skip record as real', () => {
  const g = eligible();
  expect(() => captureGardenSource(g, 'riza')).toThrow(GardenChapterUnavailable);
  const skipped = freshEmptyShelfGarden(17);
  skipped.chapter = {
    version: 'hearsay-hf4-batch/1',
    claims: [],
    skipped: [{ castId: 'hf.cast.riza.voice', reason: 'x' }],
  };
  expect(() => captureGardenSource(skipped, 'riza')).toThrow(GardenChapterUnavailable);
  const old = freshEmptyShelfGarden(17);
  old.chapter = { version: 'hearsay-hf4-batch/1', claims: [] } as unknown as GardenRun['chapter'];
  expect(() => captureGardenSource(old, 'riza')).toThrow(/no saved skip record/);
  expect(() => captureGardenSource(old, 'riza')).not.toThrow(GardenChapterUnavailable);
});

// Negative technical controls. Each injects one fault into a MODIFIED eligible fixture. None is a positive shelf journey.
it('shows a prepare failure once, names only the failed person and keeps the others quiet', async () => {
  const g = eligible();
  const { ctx, calls } = context(g, {
    capture: (run, id) => {
      if (id === 'ece') throw new Error('This person cannot continue here with this saved history.');
      if (id === 'hatice') throw new GardenChapterUnavailable('expected');
      return projection(run, id);
    },
  });
  const result = await closeChapters(ctx);
  expect(result.notice).toBe('The chapter for Ece could not be prepared for saving across games.');
  expect(result.deviceSaveFailed).toBe(false);
  expect(calls.put).toBe(6);
});

it('shows a source-retention failure as a prepare failure', async () => {
  const { ctx, calls } = context(eligible(), {
    capture: projection,
    retain: async () => {
      throw new Error('The full source run could not be retained on this device.');
    },
  });
  const result = await closeChapters(ctx);
  expect(result.notice).toMatch(
    /^The chapter for Hatice, .* and Osman could not be prepared for saving across games\.$/,
  );
  expect(calls.save).toBe(0);
});

it('leaves a device save failure to the save itself and writes nothing to the shelf', async () => {
  const { ctx, calls } = context(eligible(), { capture: projection, save: async () => false });
  expect(await closeChapters(ctx)).toEqual({ notice: '', deviceSaveFailed: true });
  expect(calls.put).toBe(0);
});

it('says the device save came first only when it did, and names a shelf failure', async () => {
  const { ctx, calls, heads } = context(eligible(), {
    capture: projection,
    shelf: {
      request: async () => {
        throw new Error('stale head');
      },
    },
  });
  const result = await closeChapters(ctx);
  expect(result.notice).toContain(
    'could not be saved across games. Your garden was saved on this device first.',
  );
  expect(calls.save).toBe(8);
  expect(Object.keys(heads)).toEqual([]);
});

it('does not write when the game changes during the device save', async () => {
  const g = eligible();
  const { ctx, calls } = context(g, {
    capture: projection,
    save: async () => {
      g.minute += 1;
      return true;
    },
  });
  const result = await closeChapters(ctx);
  expect(result.notice).toContain('The game changed while the chapter for Hatice');
  expect(calls.put).toBe(0);
});

it('reports a recording update failure after a successful write', async () => {
  const { ctx, heads } = context(eligible(), {
    capture: projection,
    bind: async () => {
      throw new Error('recording unavailable');
    },
  });
  const result = await closeChapters(ctx);
  expect(result.notice).toContain(
    'was saved across games, but this game could not update its recording of it.',
  );
  expect(Object.keys(heads).length).toBe(8);
});

it('writes in the unchanged order when every gate passes (modified fixture, no peer gate)', async () => {
  const order: string[] = [];
  const { ctx } = context(eligible(), {
    capture: (run, id) => {
      order.push(`capture:${id}`);
      return projection(run, id);
    },
    save: async () => {
      order.push('save');
      return true;
    },
    shelf: {
      request: async () => {
        order.push('put');
      },
    },
  });
  expect((await closeChapters(ctx)).notice).toBe('');
  expect(order.slice(0, 5)).toEqual(['capture:hatice', 'save', 'put', 'save', 'capture:derya']);
});

// The app's own checkpoint function, with a fake host. No DOM, shelf or browser is exercised.
function app(g: GardenRun, over: Partial<Parameters<typeof closeChapters>[0]> = {}) {
  const state = {
    run: g as GardenRun | undefined,
    generation: 0,
    file: false,
    busy: false,
    notice: '',
    renders: 0,
  };
  const { ctx, calls } = context(g, { capture: projection, ...over });
  const host = {
    begin() {
      if (state.file || !state.run || state.busy) return undefined;
      state.busy = true;
      const captured = state.run,
        at = state.generation;
      return {
        current: () => !state.file && state.run === captured && state.generation === at,
        end: () => {
          state.busy = false;
        },
      };
    },
    ready: async () => {},
    context: (current: () => boolean) => ({ ...ctx, current }),
    publish(text: string) {
      state.notice = text;
      state.renders++;
    },
  };
  return { state, calls, host };
}
const failing = (id: GardenPerson) => (run: GardenRun, who: GardenPerson) => {
  if (who === id) throw new Error('This person cannot continue here with this saved history.');
  return projection(run, who);
};

it('publishes a real failure once when the garden has ended and no frame will render it', async () => {
  const g = eligible();
  const { state, host } = app(g, { capture: failing('ece') });
  expect(g.ended).toBe(true);
  await runCheckpoint(host);
  expect(state.notice).toBe('The chapter for Ece could not be prepared for saving across games.');
  expect(state.renders).toBe(1);
  expect(state.busy).toBe(false);
});

it('ignores a result after the game is replaced or the generation moves on', async () => {
  for (const change of [
    (s: ReturnType<typeof app>['state']) => {
      s.run = eligible();
    },
    (s: ReturnType<typeof app>['state']) => {
      s.generation++;
    },
  ]) {
    const g = eligible();
    const { state, host } = app(g, {
      capture: (run, id) => {
        if (id === 'ece') change(state);
        return failing('ece')(run, id);
      },
    });
    state.notice = 'fresh game notice';
    await runCheckpoint(host);
    expect(state.notice).toBe('fresh game notice');
    expect(state.renders).toBe(0);
    expect(state.busy).toBe(false);
  }
});

it('ignores a result after a game file is opened', async () => {
  const g = eligible();
  const { state, host } = app(g, {
    capture: (run, id) => {
      if (id === 'ece') state.file = true;
      return failing('ece')(run, id);
    },
  });
  state.notice = 'file notice';
  await runCheckpoint(host);
  expect(state.notice).toBe('file notice');
  expect(state.renders).toBe(0);
});

it('still reports a real clock change in the same game', async () => {
  const g = eligible();
  const { state, host } = app(g, {
    save: async () => {
      g.minute += 1;
      return true;
    },
  });
  await runCheckpoint(host);
  expect(state.notice).toContain('The game changed while the chapter for Hatice');
  expect(state.renders).toBe(1);
});

it('leaves a device save failure to the save and publishes nothing more', async () => {
  const { state, host } = app(eligible(), { save: async () => false });
  await runCheckpoint(host);
  expect(state.notice).toBe('');
  expect(state.renders).toBe(0);
});

it('does not start a second checkpoint while one is open', async () => {
  const { state, host } = app(eligible());
  const first = runCheckpoint(host);
  expect(state.busy).toBe(true);
  await runCheckpoint(host);
  await first;
  expect(state.busy).toBe(false);
});

// The app's own save(), taken from the source text and run in a function scope with fake globals.
// No DOM, browser or IndexedDB: it shows only when save() publishes its own device failure.
async function appSave(stored: Promise<boolean>) {
  const { readFileSync } = await import('node:fs');
  const { stripTypeScriptTypes } = await import('node:module');
  const text = readFileSync(new URL('../src/ui/garden-app.ts', import.meta.url), 'utf8');
  const start = text.indexOf('async function save(): Promise<boolean> {');
  const end = text.indexOf('\nfunction input(', start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  const js = stripTypeScriptTypes(text.slice(start, end));
  const make = new Function(
    'env',
    `let { run, fileSession, generation, notice, renders, fileOrigin, fileKey, ownedHeads, archives } = env.state;
     const saveGardenJournal = env.saveGardenJournal, exportGarden = () => ({}), lab = {}, required = (v) => v;
     const render = () => { renders++; };
     ${js}
     return { save, state: () => ({ notice, renders }), set: (k, v) => { if (k === 'run') run = v; if (k === 'generation') generation = v; } };`,
  );
  const out = make({
    state: {
      run: {},
      fileSession: false,
      generation: 0,
      notice: '',
      renders: 0,
      fileOrigin: false,
      fileKey: null,
      ownedHeads: {},
      archives: [],
    },
    saveGardenJournal: () => stored,
  });
  return out;
}
const DEVICE_FAILURE =
  'Your garden could not be saved on this device. Keep this page open. You can send feedback from the game menu.';

it('app save() shows a current device failure once', async () => {
  const { save, state } = await appSave(Promise.resolve(false));
  expect(await save()).toBe(false);
  expect(state()).toEqual({ notice: DEVICE_FAILURE, renders: 1 });
});

it('app save() ignores a device failure after the generation moved on or the run was replaced', async () => {
  for (const [key, value] of [
    ['generation', 1],
    ['run', {}],
  ] as const) {
    let resolve: (v: boolean) => void = () => {};
    const { save, state, set } = await appSave(new Promise<boolean>((r) => (resolve = r)));
    const pending = save();
    set(key, value);
    resolve(false);
    expect(await pending).toBe(false);
    expect(state()).toEqual({ notice: '', renders: 0 });
  }
});
