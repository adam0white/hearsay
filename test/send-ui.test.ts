import { type Browser, chromium, type Page } from 'playwright-core';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, expect, it } from 'vitest';

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
  await page.goto(server.resolvedUrls?.local[0] ?? '');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: 'Got it', exact: true }).click();
  // Exercise the real client dialog, with local transport only. No run leaves this browser.
  await page.evaluate(`(async () => {
    const { lab } = await import('/src/ui/lab.ts');
    const { openSendDialog } = await import('/node_modules/@adam0white/lab-client/dist/index.js');
    lab.openSendDialog = (options) => openSendDialog({ ...options, lab });
    lab.sendEnvelopeText = async () => 'local-test-reference';
  })()`);
});
afterAll(async () => {
  await browser?.close();
  await server?.close();
});

it('closes the menu before sending, stops time, and resumes the chosen speed on removal and success', async () => {
  await page.getByRole('button', { name: 'Gallop', exact: true }).click();
  await page.locator('#game-menu').click();
  const before = await page.locator('#clock').innerText();
  await page.getByRole('button', { name: 'Send this run to the notebook', exact: true }).click();
  await page.locator('.hflab-veil').waitFor();
  expect(await page.locator('dialog[open]').count()).toBe(0);
  await page.locator('#hflab-note').fill('Still reading and writing.');
  await page.clock.runFor(12000);
  expect(await page.locator('#clock').innerText()).toBe(before);
  await page.getByRole('button', { name: 'Not now', exact: true }).click();
  await page.clock.runFor(4000);
  expect(await page.locator('#clock').innerText()).not.toBe(before);
  expect(await page.locator('[data-speed="80"]').getAttribute('data-chosen')).toBe('true');

  await page.locator('#game-menu').click();
  await page.getByRole('button', { name: 'Send this run to the notebook', exact: true }).click();
  const second = await page.locator('#clock').innerText();
  await page.locator('.hflab .send').click();
  await page.locator('.hflab .ok').waitFor();
  await page.clock.runFor(3000);
  expect(await page.locator('#clock').innerText()).not.toBe(second);
  expect(await page.locator('[data-speed="80"]').getAttribute('data-chosen')).toBe('true');
  await page.locator('.hflab-veil').evaluate((el) => el.remove());
});
