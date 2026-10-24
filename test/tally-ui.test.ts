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
  page = await browser.newPage();
  await page.clock.install();
  await page.clock.pauseAt(new Date());
});
afterAll(async () => {
  await browser?.close();
  await server?.close();
});
it('offers the tally only as a closed ending disclosure, without a menu preference', async () => {
  await page.goto(`${server.resolvedUrls?.local[0] ?? ''}test/fixtures/legacy.html`);
  await page.locator('.title-page').waitFor();
  const g = newGame(1);
  advance(g, 20160);
  expect(g.s.ended).toBe(true);
  await page.evaluate(async (g) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('hearsay', 1);
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction('pages', 'readwrite');
      tx.objectStore('pages').put({ plain: JSON.stringify(g), at: Date.now() }, 'run');
      tx.oncomplete = () => resolve();
    });
    db.close();
  }, g);
  await page.reload();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  const tally = page.locator('#ending-tally details');
  expect(await tally.getAttribute('open')).toBe(null);
  await page.getByText('See the tally', { exact: true }).click();
  expect(await tally.innerText()).toContain('Total =');
  await page.getByRole('button', { name: 'Game menu', exact: true }).click();
  expect(await page.getByRole('switch').count()).toBe(1);
  expect(await page.getByRole('switch', { name: 'Recording' }).count()).toBe(1);
  await page.reload();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  expect(await tally.getAttribute('open')).toBe(null);
});
