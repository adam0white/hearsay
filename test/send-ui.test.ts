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
});
afterAll(async () => {
  await browser?.close();
  await server?.close();
});
it('holds time throughout feedback and requires run consent under a privacy signal', async () => {
  await page.evaluate(`(async () => {
    const {lab}=await import('/src/ui/lab.ts');
    lab.privacySignalOn=true;
    lab.sendRun=async(run,extra)=>{window.sentRun={run,extra};return 'local';};
  })()`);
  await page.locator('#game-menu').click();
  const before = await page.locator('#clock').innerText();
  await page.getByRole('button', { name: 'Send word ▸', exact: true }).click();
  await page.clock.runFor(12000);
  expect(await page.locator('#clock').innerText()).toBe(before);
  expect(await page.getByRole('button', { name: 'Send', exact: true }).isDisabled()).toBe(true);
  await page.getByRole('checkbox', { name: 'Send this run with my note' }).check();
  await page.getByRole('textbox', { name: 'Your word', exact: true }).fill('Let me read.');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  expect(await page.getByRole('status').last().innerText()).toBe('Sent. Thank you.');
  const sent = (await page.evaluate('window.sentRun')) as {
    extra: { note: string };
    run: { game: string; state: unknown; fingerprint: string };
  };
  expect(sent.extra.note).toBe('Let me read.');
  expect(sent.run.game).toBe('hearsay');
  expect(sent.run.state).toBeDefined();
  expect(sent.run.fingerprint).toBeDefined();
  await page.clock.runFor(3000);
  expect(await page.locator('#clock').innerText()).toBe(before);
  await page.getByRole('button', { name: 'Back to the game', exact: true }).click();
  await page.clock.runFor(1000);
  expect(await page.locator('#clock').innerText()).not.toBe(before);
});
