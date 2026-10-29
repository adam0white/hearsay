import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { expect, it } from 'vitest';

it('commits journal chunks with the host state, retries a failed write and restores the exact game', async () => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
  await server.listen();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(server.resolvedUrls?.local[0] ?? '');
    const result = await page.evaluate(`(async () => {
      const { freshGarden, advanceGarden } = await import('/src/sim/garden4.ts');
      const { exportGarden } = await import('/src/sim/garden4-export.ts');
      const { saveGardenJournal, loadGardenJournal } = await import('/src/ui/garden-journal.ts');
      const { get } = await import('/src/ui/store.ts');
      const meta = { fileOrigin: false, fileKey: null, ownedHeads: {}, archives: [] };
      const g = freshGarden(17);
      const first = await saveGardenJournal(g, meta);
      advanceGarden(g, 365);
      const add = IDBObjectStore.prototype.add;
      IDBObjectStore.prototype.add = function() { throw new Error('write failed'); };
      const failed = await saveGardenJournal(g, meta);
      IDBObjectStore.prototype.add = add;
      const afterFailure = (await loadGardenJournal()).run.minute;
      const retried = await saveGardenJournal(g, meta);
      const before = JSON.stringify(exportGarden(g));
      const restored = await loadGardenJournal();
      const after = JSON.stringify(exportGarden(restored.run));
      const head = (await get('garden-hf4-journal-1')).value;
      advanceGarden(g, 370);
      advanceGarden(restored.run, 370);
      return { first, failed, afterFailure, retried, equal: before === after,
        continued: JSON.stringify(exportGarden(g)) === JSON.stringify(exportGarden(restored.run)),
        chunks: head.chunkKeys.length };
    })()`);
    expect(result).toEqual({
      first: true,
      failed: false,
      afterFailure: 360,
      retried: true,
      equal: true,
      continued: true,
      chunks: 1,
    });
    await page.reload();
    const cold = await page.evaluate(`(async () => {
      const { loadGardenJournal } = await import('/src/ui/garden-journal.ts');
      const { advanceGarden } = await import('/src/sim/garden4.ts');
      const { saveGardenJournal } = await import('/src/ui/garden-journal.ts');
      const saved = await loadGardenJournal();
      const minute = saved.run.minute;
      advanceGarden(saved.run, 370);
      return { minute, saved: await saveGardenJournal(saved.run, saved.meta) };
    })()`);
    expect(cold).toEqual({ minute: 365, saved: true });
  } finally {
    await browser.close();
    await server.close();
  }
});

it('refuses the previous autosave with a plain fresh-start message and retains it', async () => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
  await server.listen();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(server.resolvedUrls?.local[0] ?? '');
    await page.evaluate(`(async () => {
      const { put } = await import('/src/ui/store.ts');
      await put('garden-hf4-1', { oldEngine: '4.8.0', retained: true });
    })()`);
    await page.reload();
    await expect.poll(() => page.locator('[role="status"]').textContent()).toContain('Start fresh');
    expect(await page.locator('.cg-game').count()).toBe(0);
    expect(
      await page.evaluate(`(async () => {
      const { get } = await import('/src/ui/store.ts');
      return (await get('garden-hf4-1')).value;
    })()`),
    ).toEqual({ oldEngine: '4.8.0', retained: true });
  } finally {
    await browser.close();
    await server.close();
  }
});
