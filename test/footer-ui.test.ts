import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { expect, it } from 'vitest';

it('keeps the actual notice and wrapper compact and lets enlarged disclosure wrap', async () => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
  await server.listen();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 360, height: 690 } });
    await page.route('**/*', (route) =>
      route.request().method() === 'POST' ? route.abort() : route.continue(),
    );
    await page.goto(server.resolvedUrls?.local[0] ?? '');
    const notice = page.locator('.cg-footer .lk-telemetry-notice');
    await notice.waitFor({ state: 'visible' });
    await page.evaluate(() => document.fonts.ready);
    const measure = () =>
      notice.evaluate((el) => ({
        text: el.textContent,
        font: Number.parseFloat(getComputedStyle(el).fontSize),
        height: el.getBoundingClientRect().height,
        wrapper: el.parentElement?.getBoundingClientRect().height ?? 999,
        line: Number.parseFloat(getComputedStyle(el).lineHeight),
        clipped: el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2,
        width: el.getBoundingClientRect().width,
        controls: el.childElementCount,
      }));
    const normal = await measure();
    expect(normal.text).toBe('We record and link play across games on this device.');
    expect(normal.font).toBe(14);
    expect(normal.height).toBeLessThan(32);
    expect(normal.wrapper).toBeLessThanOrEqual(40);
    expect(normal.clipped).toBe(false);
    expect(normal.controls).toBe(0);
    await page.evaluate(() => (document.documentElement.style.fontSize = '32px'));
    const enlarged = await measure();
    expect(enlarged.font).toBeGreaterThan(normal.font);
    expect(enlarged.height).toBeGreaterThan(enlarged.line * 2);
    expect(enlarged.clipped).toBe(false);
    expect(enlarged.width).toBeLessThanOrEqual(360);
  } finally {
    await browser.close();
    await server.close();
  }
});
