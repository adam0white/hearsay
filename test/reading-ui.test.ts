import { type Browser, chromium, type Page } from 'playwright-core';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { advance, newGame } from '../src/sim/game';

let server: ViteDevServer;
let browser: Browser;
let page: Page;
beforeAll(async () => {
  server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
  await server.listen();
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 360, height: 690 } });
  await page.clock.install();
  await page.clock.pauseAt(new Date());
});
afterAll(async () => {
  await browser?.close();
  await server?.close();
});
async function load(minute: number, dismiss = false) {
  await page.goto('about:blank');
  await page.goto(server.resolvedUrls?.local[0] ?? '');
  await page.locator('.title-page').waitFor();
  const g = newGame(1);
  advance(g, minute);
  await page.evaluate(
    async ({ g, dismiss }) => {
      const db = await new Promise<IDBDatabase>((resolve) => {
        const r = indexedDB.open('hearsay', 1);
        r.onsuccess = () => resolve(r.result);
      });
      await new Promise<void>((resolve) => {
        const tx = db.transaction('pages', 'readwrite');
        for (const [key, value] of [
          ['run', g],
          [
            'run-ui',
            dismiss
              ? {
                  seed: g.s.seed,
                  dismissedIncident: g.s.log.findLast((l) => l.kind === 'overheard')?.id ?? 0,
                }
              : null,
          ],
          ['run-log', null],
        ])
          tx.objectStore('pages').put({ plain: JSON.stringify(value), at: Date.now() }, key as string);
        tx.oncomplete = () => resolve();
      });
      db.close();
    },
    { g, dismiss },
  );
  await page.reload();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.locator('#clock').waitFor();
}
async function readFor(ms: number) {
  for (let elapsed = 0; elapsed < ms; elapsed += 500) await page.clock.runFor(500);
}

it('keeps a witnessed incident slow after the question passes and restores the chosen pace on expiry', async () => {
  await load(390);
  await readFor(45000);
  expect(await page.locator('.table-incident').count()).toBe(1);
  expect(await page.locator('[data-speed="1"]').getAttribute('aria-pressed')).toBe('true');
  expect(await page.locator('.slow-reason').innerText()).toMatch(/overheard|incident/i);
  await readFor(80000);
  expect(await page.locator('.table-incident').count()).toBe(0);
  expect(await page.locator('[data-speed="5"]').getAttribute('aria-pressed')).toBe('true');
});

it('retains a chosen fast pace while a pending incident continues at Slow', async () => {
  await load(390);
  await page.locator('[data-speed="80"]').click();
  expect(await page.locator('[data-speed="80"]').getAttribute('data-chosen')).toBe('true');
  expect(await page.locator('[data-speed="1"]').getAttribute('aria-pressed')).toBe('true');
});

it('meets a waiting question before a fast frame can carry its listener away', async () => {
  await load(400, true);
  await page.locator('[data-speed="80"]').click();
  // One delayed animation frame must stop at the question, rather than cross its whole window.
  await page.clock.fastForward(250);
  expect(await page.locator('.question').innerText()).toContain('Aylin');
  expect(await page.locator('[data-speed="1"]').getAttribute('aria-pressed')).toBe('true');
  expect(await page.locator('.slow-reason').innerText()).toContain('Aylin');
});
