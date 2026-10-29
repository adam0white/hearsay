import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { expect, it } from 'vitest';

it('retains a complete source separately when the active garden is replaced', async () => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
  await server.listen();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(server.resolvedUrls?.local[0] ?? '');
    const result = (await page.evaluate(`(async () => {
      const { freshGarden, advanceGarden, chooseGarden } = await import('/src/sim/garden4.ts');
      const { exportGarden } = await import('/src/sim/garden4-export.ts');
      const { retainGardenSource } = await import('/src/ui/garden-source-archive.ts');
      const { saveGardenJournal, loadGardenJournal } = await import('/src/ui/garden-journal.ts');
      const garden = freshGarden(17);
      chooseGarden(garden, { type: 'listen', person: 'riza', approach: 'invite' });
      advanceGarden(garden, 376);
      const source = { game: 'hearsay', build: 'test', engine: 'test', rules: 'hearsay-hf4-1' };
      const expected = exportGarden(garden);
      const key = await retainGardenSource(garden, source);
      if (!await saveGardenJournal(freshGarden(42), { fileOrigin: false, fileKey: null, ownedHeads: {}, archives: [] })) throw Error('Fixture save failed');
      if ((await loadGardenJournal()).run.seed !== 42) throw Error('Replacement was not saved');
      return { expected: JSON.stringify(expected), key };
    })()`)) as { expected: string; key: string };
    await page.reload();
    const replay = (await page.evaluate(`(async () => {
      const { exportGarden, importGarden } = await import('/src/sim/garden4-export.ts');
      const { loadGardenSource } = await import('/src/ui/garden-source-archive.ts');
      const retained = await loadGardenSource(${JSON.stringify(result.key)});
      const replayed = exportGarden(importGarden(JSON.stringify(retained.export)));
      let rejected = false;
      retained.export.state.minute++;
      try { importGarden(JSON.stringify(retained.export)); } catch { rejected = true; }
      return { replayed: JSON.stringify(replayed), rejected };
    })()`)) as { replayed: string; rejected: boolean };
    expect(replay.replayed).toBe(result.expected);
    expect(replay.rejected).toBe(true);
    expect(result.key).toMatch(/^persona-departure:/);
  } finally {
    await browser.close();
    await server.close();
  }
});

it('opens a valid game file larger than 8 MiB', async () => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
  await server.listen();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(server.resolvedUrls?.local[0] ?? '');
    const text = (await page.evaluate(`(async () => {
      const { freshGarden } = await import('/src/sim/garden4.ts');
      const { exportGarden } = await import('/src/sim/garden4-export.ts');
      return JSON.stringify(exportGarden(freshGarden(17)));
    })()`)) as string;
    await page.getByText('Other ways to begin', { exact: true }).click();
    await page.getByRole('button', { name: 'Open a game file', exact: true }).click();
    await page.locator('#import-run').setInputFiles({
      name: 'garden.json',
      mimeType: 'application/json',
      buffer: Buffer.from(text + ' '.repeat(8 * 1024 * 1024)),
    });
    await page.locator('.cg-game').waitFor({ timeout: 30000 });
  } finally {
    await browser.close();
    await server.close();
  }
});

it('stores immutable records when Blob transactions fail and deduplicates concurrent writes', async () => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
  await server.listen();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(server.resolvedUrls?.local[0] ?? '');
    const result = await page.evaluate(`(async () => {
      const { putImmutable, get } = await import('/src/ui/store.ts');
      const add = IDBObjectStore.prototype.add;
      IDBObjectStore.prototype.add = function(value, key) {
        if (value.blob) throw new DOMException('Blob unsupported', 'DataCloneError');
        return add.call(this, value, key);
      };
      const results = await Promise.all([
        putImmutable('persona-departure:fallback', { value: 1 }),
        putImmutable('persona-departure:fallback', { value: 1 }),
      ]);
      const conflict = await putImmutable('persona-departure:fallback', { value: 2 });
      return { results, conflict, stored: (await get('persona-departure:fallback')).value };
    })()`);
    expect(result).toEqual({ results: [true, true], conflict: false, stored: { value: 1 } });
  } finally {
    await browser.close();
    await server.close();
  }
});
