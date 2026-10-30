import { chromium, type Page } from 'playwright-core';
import { createServer } from 'vite';
import { expect, it } from 'vitest';

// Exercise the real SDK on a recognized origin. All identity and backend traffic is synthetic.
it.each([
  { width: 360, height: 690, off: false },
  { width: 1280, height: 800, off: false },
  { width: 360, height: 690, off: true },
  { width: 1280, height: 800, off: true },
])(
  'keeps the refusal visible and native save intact with recording off=$off at $width×$height',
  async (viewport) => {
    const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
    await server.listen();
    const local = server.resolvedUrls?.local[0];
    if (!local) throw Error('Missing local server');
    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      acceptDownloads: true,
    });
    if (viewport.off)
      await context.addInitScript(() => {
        try {
          localStorage.setItem('hf-telemetry-off', '1');
        } catch {}
      });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const rows = (p: Page) =>
      p.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('hearsay', 1);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        const values = await new Promise<{ at: number; plain?: string; blob?: Blob }[]>((resolve, reject) => {
          const request = db.transaction('pages').objectStore('pages').getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        const result = await Promise.all(
          values.map(async (v) => ({
            at: v.at,
            plain: v.plain,
            bytes: v.blob ? Array.from(new Uint8Array(await v.blob.arrayBuffer())) : null,
          })),
        );
        db.close();
        return result;
      });
    try {
      await page.route('**/*', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.origin === 'https://human.adamwhite.work' && url.pathname === '/lab/identity/') {
          await route.fulfill({
            contentType: 'text/html',
            body: `<script>addEventListener('message',e=>{const m=e.data;if(m.type==='hf-lab-identity')parent.postMessage({type:'hf-lab-identity',player:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',off:false,requestId:m.requestId,revision:1},e.origin);if(m.type==='hf-persona-consent'){const r={type:'hf-persona-consent-reply',id:m.id,value:false};if(e.ports[0])e.ports[0].postMessage(r);else parent.postMessage(r,e.origin)}})</script>`,
          });
        } else if (request.method() !== 'GET')
          await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        else if (url.origin !== 'https://hearsay.adamwhite.work') await route.abort();
        else {
          const response = await route.fetch({ url: new URL(url.pathname + url.search, local).href });
          await route.fulfill({ response });
        }
      });
      await page.goto('https://hearsay.adamwhite.work/');
      await page.getByText('Other ways to begin', { exact: true }).click();
      await page
        .getByRole('button', { name: 'Play fourteen days with new local people', exact: true })
        .click();
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      await page.getByRole('button', { name: 'Pour tea without sharing news', exact: true }).click();
      await page.getByRole('button', { name: 'Game menu', exact: true }).first().click();
      const pending = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download this run', exact: true }).click();
      const download = await pending;
      const chunks: Buffer[] = [];
      for await (const chunk of await download.createReadStream()) chunks.push(Buffer.from(chunk));
      const valid = Buffer.concat(chunks);
      const bad = JSON.parse(valid.toString());
      delete bad.config;
      await page.getByText('Other ways to begin', { exact: true }).click();
      await page.getByRole('button', { name: 'Open a game file', exact: true }).click();
      await page.getByRole('button', { name: 'Close file session', exact: true }).waitFor();
      const before = await rows(page);
      await page.locator('#import-run').setInputFiles({
        name: 'unmarked.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(bad)),
      });
      await page
        .getByText('This older garden is unsupported. Keep the file. Start fresh.', { exact: true })
        .waitFor({ timeout: 5000 });
      expect(await rows(page)).toEqual(before);
      await page
        .locator('#import-run')
        .setInputFiles({ name: 'current.json', mimeType: 'application/json', buffer: valid });
      await page.locator('.cg-game').waitFor();
      await page.getByRole('button', { name: 'Game menu', exact: true }).first().click();
      expect(await rows(page)).toEqual(before);
      await page.getByRole('button', { name: 'Close file session', exact: true }).click();
      await page.locator('.cg-game').waitFor();
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      await page.getByRole('button', { name: 'Game menu', exact: true }).first().click();
      const restored = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download this run', exact: true }).click();
      const restoredChunks: Buffer[] = [];
      for await (const chunk of await (await restored).createReadStream())
        restoredChunks.push(Buffer.from(chunk));
      expect(JSON.parse(Buffer.concat(restoredChunks).toString())).toEqual(JSON.parse(valid.toString()));
      expect(errors).toEqual([]);
    } finally {
      await context.close();
      await browser.close();
      await server.close();
    }
  },
  60000,
);
