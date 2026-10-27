import { type Browser, chromium, type Page, webkit } from 'playwright-core';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, expect, it } from 'vitest';

let server: ViteDevServer;
let browser: Browser;
let page: Page;
beforeAll(async () => {
  server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
  await server.listen();
  browser = await (process.env.HEARSAY_BROWSER === 'webkit' ? webkit : chromium).launch();
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
  expect(await page.evaluate(() => ({ width: innerWidth, height: innerHeight }))).toEqual(viewport);
  await page.goto(`${server.resolvedUrls?.local[0] ?? ''}`);
  await page.locator('.cg-title, .cg-game').first().waitFor();
  if (await page.locator('.cg-title').count())
    await page.getByText('Other ways to begin', { exact: true }).click();
  const start = page.getByRole('button', { name: 'Play fourteen days with new local people', exact: true });
  if (await start.isVisible()) await start.click();
  else {
    await page.getByRole('button', { name: 'Game menu', exact: true }).first().click();
    await page.getByText('Other ways to begin', { exact: true }).click();
    await page.getByRole('button', { name: 'Play fourteen days with new local people', exact: true }).click();
  }
  await page.locator('[data-pace="0"]').click();
  expect(await page.locator('.cg-header').innerText()).toContain('Day 13 lunch');
  expect(await page.locator('[data-person]').count()).toBe(8);
  const privacy = await page.getByRole('link', { name: 'Lab privacy', exact: true }).boundingBox();
  const debug = await page.locator('.cg-debug > summary').boundingBox();
  expect(privacy && debug && Math.abs(privacy.y - debug.y) < 12).toBe(true);
  await page.getByRole('button', { name: 'Invite a quiet conversation', exact: true }).click();
  await page.getByRole('button', { name: 'Let the conversation finish', exact: true }).click();
  expect(await page.locator('.cg-confidence').innerText()).toContain('doorway');
  const response = page.getByRole('button', {
    name: 'Keep this private',
    exact: true,
  });
  const bounds = await response.boundingBox();
  expect(bounds?.width).toBeGreaterThanOrEqual(44);
  await response.click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Game menu', exact: true }).first().click();
  await page.locator('.cg-starts').evaluate((el) => {
    (el as HTMLDetailsElement).open = true;
  });

  await page.reload();
  await page.locator('[data-pace="0"]').click();
  expect(await page.locator('.cg-confidence').innerText()).toContain('doorway');
  expect(await page.locator('.cg-panel').innerText()).toContain('keeps the sketches');
});
it('requires an unchecked new-game choice and saves that choice through reload', async () => {
  const fresh = await browser.newPage();
  try {
    await fresh.goto(`${server.resolvedUrls?.local[0] ?? ''}`);
    const option = fresh.getByLabel('Use longer conversations about the garden and lunch');
    await option.waitFor();
    expect(await option.isChecked()).toBe(false);
    await option.check();
    await fresh.getByText('Other ways to begin', { exact: true }).click();
    await fresh
      .getByRole('button', { name: 'Play fourteen days with new local people', exact: true })
      .click();
    await fresh.locator('[data-pace="0"]').click();
    const config = () =>
      fresh.evaluate(`(async()=>{
      const {get}=await import('/src/ui/store.ts');
      return (await get('garden-cast6')).value.export.config;
    })()`);
    expect(await config()).toEqual({ dialogue: 'garden-talk/1' });
    await fresh.reload();
    await fresh.locator('[data-pace="0"]').click();
    expect(await config()).toEqual({ dialogue: 'garden-talk/1' });
  } finally {
    await fresh.close();
  }
});
