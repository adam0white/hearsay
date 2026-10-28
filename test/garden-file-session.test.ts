import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { type Browser, chromium, type Page } from 'playwright-core';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { freshGarden } from '../src/sim/garden4.ts';
import { exportGarden, importGarden } from '../src/sim/garden4-export.ts';

let server: ViteDevServer;
let browser: Browser;
let origin: string;
const externalRequests = new WeakMap<Page, string[]>();
const evidencePath = process.env.HEARSAY_FILE_TEST_EVIDENCE;
const owner = {
  value: {
    export: exportGarden(freshGarden(101)),
    fileOrigin: false,
    fileKey: null,
    ownedHeads: {},
    archives: [],
  },
  at: 123,
};
const file: ReturnType<typeof exportGarden> = process.env.HEARSAY_FILE_TEST_INPUT
  ? JSON.parse(readFileSync(process.env.HEARSAY_FILE_TEST_INPUT, 'utf8'))
  : exportGarden(freshGarden(202));
importGarden(JSON.stringify(file));
beforeAll(async () => {
  if (evidencePath) writeFileSync(evidencePath, '', { flag: 'wx', mode: 0o600 });
  server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
  await server.listen();
  origin = server.resolvedUrls?.local[0] ?? '';
  browser = await chromium.launch();
});
afterAll(async () => {
  for (const context of browser?.contexts() ?? [])
    for (const page of context.pages()) await closeTestPage(page);
  await browser?.close();
  await server?.close();
});
async function closeTestPage(page: Page) {
  const pending = await page.evaluate(async () => {
    const names = (await indexedDB.databases()).map((db) => db.name);
    if (!names.includes('hf-lab-pending')) return { exists: false, count: 0 };
    const request = indexedDB.open('hf-lab-pending');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const count = await new Promise<number>((resolve, reject) => {
        const request = db.transaction('pieces').objectStore('pieces').count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return { exists: true, count };
    } finally {
      db.close();
    }
  });
  const observation = {
    at: new Date().toISOString(),
    url: page.url(),
    pending,
    externalRequests: externalRequests.get(page) ?? [],
  };
  if (evidencePath) appendFileSync(evidencePath, `${JSON.stringify(observation)}\n`);
  console.info('Controlled source-test pending readback before close:', observation);
  // A nonzero/unknown queue stops cleanup rather than deleting unique recording data.
  expect(pending.count).toBe(0);
  expect(
    observation.externalRequests.filter(
      (request) => !request.startsWith('GET https://fonts.googleapis.com/'),
    ),
  ).toEqual([]);
  await page.close();
}
async function occupied(): Promise<Page> {
  const page = await browser.newPage();
  const requests: string[] = [];
  externalRequests.set(page, requests);
  page.on('request', (request) => {
    if (request.url().startsWith('http') && new URL(request.url()).origin !== new URL(origin).origin)
      requests.push(`${request.method()} ${request.url()}`);
  });
  await page.route('**/file-session-empty', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>Test setup</title>' }),
  );
  await page.goto(`${origin}file-session-empty`);
  await page.evaluate(
    async (row) => {
      if ((await indexedDB.databases()).length !== 0)
        throw new Error('Test context is not pristine before sentinel setup.');
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('hearsay', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('pages');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('pages', 'readwrite');
        tx.objectStore('pages').put({ plain: row.plain, at: row.at }, 'garden-hf4-1');
        tx.objectStore('pages').put({ unique: 'source-journal-sentinel' }, 'unrelated-owner-row');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
      localStorage.setItem('hf-persona-opt-in', '0');
      localStorage.setItem('unrelated-owner-key', 'keep');
    },
    { plain: JSON.stringify(owner.value), at: owner.at },
  );
  await page.addInitScript(() => {
    const state = { nativeOpens: 0, shelfConstructions: 0 };
    Object.assign(window, { fileSessionBoundary: state });
    const open = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function (...args: Parameters<IDBFactory['open']>) {
      if (args[0] === 'hearsay') state.nativeOpens++;
      return open.apply(this, args);
    };
  });
  // Observe the real SDK constructor, preserving its body and every side effect.
  await page.route('**/*lab-client*.js*', async (route) => {
    const response = await route.fetch();
    const text = await response.text();
    // The SDK now accepts options in this signature. A missing probe used to
    // report zero constructions and fail only the native control. Fail closed.
    const signature = /\bfunction personaChannel\([^)]*\)\s*\{/g;
    expect([...text.matchAll(signature)]).toHaveLength(1);
    const body = text.replace(signature, '$& window.fileSessionBoundary.shelfConstructions++;');
    await route.fulfill({ response, body });
  });
  return page;
}
async function readOwner(page: Page) {
  return page.evaluate(async () => {
    const request = indexedDB.open('hearsay', 1);
    const db = await new Promise<IDBDatabase>((resolve) => {
      request.onsuccess = () => resolve(request.result);
    });
    const rows = await new Promise<unknown[]>((resolve) => {
      const tx = db.transaction('pages');
      const request = tx.objectStore('pages').getAll();
      request.onsuccess = () => resolve(request.result);
    });
    db.close();
    return rows;
  });
}
it('plays a complete foreign file through the public route without replacing native content', async () => {
  const page = await occupied();
  try {
    await page.goto(origin);
    await page.locator('.cg-game').waitFor();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.getByRole('button', { name: 'Game menu', exact: true }).click();
    await page.getByText('Other ways to begin', { exact: true }).click();
    await page.getByRole('button', { name: 'Open a game file', exact: true }).click();
    await page.locator('#import-run').waitFor();
    // An unopened or invalid file must always offer a way back to the native save.
    expect(await page.getByRole('button', { name: 'Close file session', exact: true }).isVisible()).toBe(
      true,
    );
    await page
      .locator('#import-run')
      .setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
    await page.locator('.cg-title [role=status]').waitFor();
    await page.getByRole('button', { name: 'Close file session', exact: true }).click();
    await page.locator('.cg-game').waitFor();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.getByRole('button', { name: 'Game menu', exact: true }).click();
    await page.getByText('Other ways to begin', { exact: true }).click();
    await page.getByRole('button', { name: 'Open a game file', exact: true }).click();
    await page.locator('#import-run').waitFor();
    const nativeBefore = await readOwner(page);
    const boundaryBefore = await page.evaluate(() =>
      structuredClone((window as unknown as { fileSessionBoundary: unknown }).fileSessionBoundary),
    );
    await expect.poll(() => page.locator('#import-run').count()).toBe(1);
    await page.evaluate(`(async () => {
      const { lab } = await import('/src/ui/lab.ts');
      const capture = lab.captureSave.bind(lab);
      window.fileCaptures = [];
      lab.captureSave = (value) => {
        window.fileCaptures.push(structuredClone(value));
        return capture(value);
      };
    })()`);
    await page.locator('#import-run').setInputFiles({
      name: 'garden.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(file)),
    });
    await page.locator('.cg-game').waitFor();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    expect(await page.locator('[data-person]').count()).toBe(8);
    await page.getByRole('button', { name: 'Pour tea without sharing news', exact: true }).click();
    await page.getByRole('button', { name: 'Slow', exact: true }).click();
    await page.waitForTimeout(5500);
    await page.getByRole('button', { name: 'Game menu', exact: true }).click();
    for (const name of [
      'New game',
      'Play fourteen days with new local people',
      'Save their closing chapter if it is ready',
      'Start a separate history for this person',
    ])
      expect(await page.getByRole('button', { name, exact: true }).count()).toBe(0);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      window.dispatchEvent(new Event('pagehide'));
    });
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download this game file', exact: true }).click();
    const stream = await (await download).createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const exported = JSON.parse(Buffer.concat(chunks).toString());
    const replayed = importGarden(JSON.stringify(exported));
    expect(exported.initialPeople).toEqual(file.initialPeople);
    expect(exported.inputs).toEqual([{ at: 360, input: { type: 'silence' } }]);
    expect(exportGarden(replayed)).toEqual(exported);
    const captures = await page.evaluate(
      () =>
        (window as unknown as { fileCaptures: Array<{ key: string; value: { export: unknown } }> })
          .fileCaptures,
    );
    expect(captures.length).toBeGreaterThanOrEqual(2);
    expect(captures.every((c) => c.key.startsWith('garden-file:'))).toBe(true);
    expect(captures.at(-1)?.value.export).toEqual(exported);
    expect(await readOwner(page)).toEqual(nativeBefore);
    // Reading the sentinel above opens native storage once; file play itself does not.
    const boundaryAfter = await page.evaluate(
      () =>
        (window as unknown as { fileSessionBoundary: { nativeOpens: number; shelfConstructions: number } })
          .fileSessionBoundary,
    );
    expect(boundaryAfter).toEqual({
      ...(boundaryBefore as object),
      nativeOpens: (boundaryBefore as { nativeOpens: number }).nativeOpens + 1,
    });
    await page.getByRole('button', { name: 'Close file session', exact: true }).click();
    await page.locator('.cg-game').waitFor();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    const restored = (await page.evaluate(`(async()=>{
      const {get}=await import('/src/ui/store.ts');return (await get('garden-hf4-1')).value.export;
    })()`)) as ReturnType<typeof exportGarden>;
    expect(restored.seed).toBe(owner.value.export.seed);
    expect(restored.inputs).toEqual([]);
    expect(
      await page.evaluate(() => [
        localStorage.getItem('hf-persona-opt-in'),
        localStorage.getItem('unrelated-owner-key'),
      ]),
    ).toEqual(['0', 'keep']);
  } finally {
    await closeTestPage(page);
  }
});
it('retains ordinary native startup and persistence outside the foreign-file route', async () => {
  const page = await occupied();
  try {
    await page.goto(origin);
    await page.locator('.cg-game').waitFor();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.getByRole('button', { name: 'Pour tea without sharing news', exact: true }).click();
    await page.getByRole('button', { name: 'Game menu', exact: true }).click();
    expect(await page.getByRole('button', { name: 'New game', exact: true }).count()).toBe(1);
    await page.reload();
    await page.locator('.cg-game').waitFor();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    const saved = await page.evaluate(`(async () => {
      const { get } = await import('/src/ui/store.ts');
      return (await get('garden-hf4-1'))?.value.export.inputs;
    })()`);
    expect(saved).toEqual([{ at: 360, input: { type: 'silence' } }]);
    expect((await readOwner(page)).length).toBe(2);
    const boundary = await page.evaluate(
      () =>
        (window as unknown as { fileSessionBoundary: { nativeOpens: number; shelfConstructions: number } })
          .fileSessionBoundary,
    );
    expect(boundary.shelfConstructions).toBe(1);
    expect(boundary.nativeOpens).toBeGreaterThan(0);
  } finally {
    await closeTestPage(page);
  }
});
