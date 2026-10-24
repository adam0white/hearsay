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
  page = await browser.newPage();
});
afterAll(async () => {
  await browser?.close();
  await server?.close();
});
it.each([
  { width: 360, height: 690 },
  { width: 1280, height: 800 },
])('plays, saves and reloads the canonical UI at $width×$height', async (viewport) => {
  await page.setViewportSize(viewport);
  await page.goto(server.resolvedUrls?.local[0] ?? '');
  await page.locator('.cg-title, .cg-game').first().waitFor();
  const start = page.getByRole('button', { name: 'Begin a fresh fortnight', exact: true });
  if (await start.isVisible()) await start.click();
  else {
    await page.getByRole('button', { name: 'Game menu', exact: true }).first().click();
    await page.getByRole('button', { name: 'Begin another fresh fortnight', exact: true }).click();
  }
  await page.locator('[data-pace="0"]').click();
  expect(await page.locator('.cg-header').innerText()).toContain('Day 13 lunch');
  expect(await page.locator('[data-person]').count()).toBe(8);
  await page.getByRole('button', { name: 'Invite a quiet conversation', exact: true }).click();
  await page.getByRole('button', { name: 'Let the conversation finish', exact: true }).click();
  expect(await page.locator('.cg-confidence').innerText()).toContain('doorway');
  const response = page.getByRole('button', {
    name: 'Respect the confidence and leave it private',
    exact: true,
  });
  const bounds = await response.boundingBox();
  expect(bounds?.width).toBeGreaterThanOrEqual(44);
  await response.click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Game menu', exact: true }).first().click();
  await page.getByRole('button', { name: 'Save this garden', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Garden saved' }).waitFor();
  await page.reload();
  await page.locator('[data-pace="0"]').click();
  expect(await page.locator('.cg-confidence').innerText()).toContain('doorway');
  expect(await page.locator('.cg-panel').innerText()).toContain('keeps the sketches');
});
