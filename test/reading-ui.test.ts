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

it('holds an incident indefinitely until the player responds, at every chosen speed', async () => {
  await load(390);
  await page.locator('[data-speed="80"]').click();
  expect(await page.locator('[data-speed="80"]').getAttribute('aria-pressed')).toBe('true');
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  const clock = await page.locator('#clock').innerText();
  await readFor(125000);
  expect(await page.locator('.table-incident').count()).toBe(1);
  expect(await page.locator('#clock').innerText()).toBe(clock);
  expect(await page.locator('.clock-pace').innerText()).toMatch(/Time held.*overheard/i);
  expect(await page.locator('[data-speed]').count()).toBe(4);
});

it('meets a waiting question before a delayed frame can carry its listener away', async () => {
  await load(400, true);
  await readFor(2000);
  expect(await page.locator('.question').innerText()).toContain('Aylin');
  const held = await page.locator('#clock').innerText();
  await readFor(60000);
  expect(await page.locator('#clock').innerText()).toBe(held);
  expect(await page.locator('.clock-pace').innerText()).toContain('Aylin');
});

it('pauses the Game menu and resumes the chosen speed', async () => {
  await load(390, true);
  await page.locator('#game-menu').click();
  const held = await page.locator('#clock').innerText();
  await readFor(10000);
  expect(await page.locator('#clock').innerText()).toBe(held);
  expect(await page.getByRole('checkbox').count()).toBe(1);
  expect(await page.getByRole('checkbox', { name: 'Record play for the lab' }).count()).toBe(1);
  await page.keyboard.press('Escape');
  await readFor(1000);
  expect(await page.locator('#clock').innerText()).not.toBe(held);
});
