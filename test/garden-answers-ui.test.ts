import { type Browser, chromium, webkit } from 'playwright-core';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, expect, it } from 'vitest';

let server: ViteDevServer;
let browser: Browser;
beforeAll(async () => {
  server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
  await server.listen();
  browser = await (process.env.HEARSAY_BROWSER === 'webkit' ? webkit : chromium).launch();
});
afterAll(async () => {
  await browser?.close();
  await server?.close();
});
it.each([
  { width: 360, height: 690 },
  { width: 1280, height: 800 },
])('shows an Ask reply without opening the record at $width×$height', async (viewport) => {
  const page = await browser.newPage({ viewport });
  try {
    await page.goto(`${server.resolvedUrls?.local[0] ?? ''}`);
    await page.getByText('Other ways to begin', { exact: true }).click();
    await page.getByRole('button', { name: 'Play fourteen days with new local people', exact: true }).click();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.getByText('Talk about someone else', { exact: true }).click();
    await page.getByRole('button', { name: 'Ask what they have heard', exact: true }).click();
    const answer = page.locator('.cg-panel [role="status"]');
    await expect.poll(() => answer.count()).toBe(1);
    expect(await answer.innerText()).toContain('bread');
    expect(await answer.innerText()).toContain('Invite a quiet conversation');
    expect(await page.locator('.cg-account').getAttribute('open')).toBeNull();
    const bounds = await answer.boundingBox();
    // Chromium rounds scroll offsets to whole pixels, while font bounds can be fractional.
    const header = await page.locator('.cg-header').boundingBox();
    expect(Math.round(bounds?.y ?? -2)).toBeGreaterThanOrEqual(
      Math.max(0, Math.round((header?.y ?? 0) + (header?.height ?? 0))),
    );
    expect(Math.round((bounds?.y ?? -2) + (bounds?.height ?? 0))).toBeLessThanOrEqual(viewport.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally {
    await page.close();
  }
});

it('takes Who? and What? by their exact labels and shows the refusal beside the action', async () => {
  const page = await browser.newPage({ viewport: { width: 360, height: 690 } });
  try {
    await page.goto(`${server.resolvedUrls?.local[0] ?? ''}`);
    await page.getByText('Other ways to begin', { exact: true }).click();
    await page.getByRole('button', { name: 'Play fourteen days with new local people', exact: true }).click();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.getByRole('button', { name: 'Press for private details', exact: true }).click();
    await expect
      .poll(() => page.locator('.cg-panel .cg-notice').textContent())
      .toContain('keep this private');
    await page.getByText('Talk about someone else', { exact: true }).click();
    await page.getByLabel('Who?', { exact: true }).selectOption('osman');
    await page.getByLabel('What?', { exact: true }).selectOption('honest');
    expect(await page.getByLabel('Who?', { exact: true }).inputValue()).toBe('osman');
    expect(await page.getByLabel('What?', { exact: true }).inputValue()).toBe('honest');
  } finally {
    await page.close();
  }
});
