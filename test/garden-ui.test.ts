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
  await expect.poll(() => page.locator('[data-pace]:disabled').count()).toBe(4);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  expect(await page.locator('[data-pace]:disabled').count()).toBe(0);
  await page.getByRole('button', { name: 'Game menu', exact: true }).first().click();
  await page.locator('.cg-starts').evaluate((el) => {
    (el as HTMLDetailsElement).open = true;
  });

  await page.reload();
  await page.locator('[data-pace="0"]').click();
  expect(await page.locator('.cg-confidence').innerText()).toContain('doorway');
  expect(await page.locator('.cg-panel').innerText()).toContain('keeps the sketches');
});
it('starts current conversations and continues the native garden after reload', async () => {
  const fresh = await browser.newPage();
  try {
    await fresh.clock.install();
    await fresh.clock.pauseAt(new Date());
    await fresh.goto(`${server.resolvedUrls?.local[0] ?? ''}`);
    await fresh.getByRole('button', { name: 'Begin', exact: true }).waitFor();
    expect(await fresh.getByLabel('Use longer conversations about the garden and lunch').count()).toBe(0);
    expect(await fresh.locator('#cg-dialogue').count()).toBe(0);
    await fresh.evaluate(() => localStorage.setItem('unrelated-ui-test', 'keep'));
    await fresh.getByText('Other ways to begin', { exact: true }).click();
    await fresh
      .getByRole('button', { name: 'Play fourteen days with new local people', exact: true })
      .click();
    await fresh.locator('[data-pace="0"]').click();
    await fresh.getByRole('button', { name: 'Pour tea without sharing news', exact: true }).click();
    const saved = () =>
      fresh.evaluate(`(async()=>{
        const {loadGardenJournal}=await import('/src/ui/garden-journal.ts');
        const {exportGarden}=await import('/src/sim/garden4-export.ts');
        const journal=await loadGardenJournal();
        return journal ? exportGarden(journal.run) : null;
      })()`);
    await expect.poll(async () => ((await saved()) as { inputs: unknown[] } | null)?.inputs.length).toBe(1);
    const before = (await saved()) as { config: unknown; inputs: unknown[] };
    expect(before.config).toEqual({ dialogue: 'garden-talk/1' });
    await fresh.reload();
    await fresh.locator('[data-pace="0"]').click();
    expect(await saved()).toEqual(before);
    expect(await fresh.evaluate(() => localStorage.getItem('unrelated-ui-test'))).toBe('keep');
    await fresh.getByRole('button', { name: 'Pour tea without sharing news', exact: true }).click();
    await expect.poll(async () => ((await saved()) as { inputs: unknown[] } | null)?.inputs.length).toBe(2);
    const continued = (await saved()) as { config: unknown; inputs: unknown[] };
    expect(continued.config).toEqual(before.config);
    expect(continued.inputs[0]).toEqual(before.inputs[0]);
  } finally {
    await fresh.close();
  }
});

it.each([
  { width: 360, height: 690 },
  { width: 1280, height: 800 },
])(
  'explains an unmarked native refusal and retains every stored byte at $width×$height',
  async (viewport) => {
    const fresh = await browser.newPage({ viewport });
    try {
      await fresh.goto(`${server.resolvedUrls?.local[0] ?? ''}`);
      const storedRows = () =>
        fresh.evaluate(async () => {
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open('hearsay', 1);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          try {
            const rows = await new Promise<{ plain?: string; blob?: Blob; at: number }[]>(
              (resolve, reject) => {
                const request = db.transaction('pages').objectStore('pages').getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
              },
            );
            return Promise.all(
              rows.map(async (row) => ({
                at: row.at,
                plain: row.plain,
                bytes: row.blob ? Array.from(new Uint8Array(await row.blob.arrayBuffer())) : null,
              })),
            );
          } finally {
            db.close();
          }
        });
      await fresh.evaluate(`(async () => {
      const { freshGarden } = await import('/src/sim/garden4.ts');
      const { saveGardenJournal } = await import('/src/ui/garden-journal.ts');
      const { get, put } = await import('/src/ui/store.ts');
      await saveGardenJournal(freshGarden(17), {fileOrigin:false,fileKey:null,ownedHeads:{},archives:[]});
      const key = 'garden-hf4-journal-1';
      const head = (await get(key)).value;
      delete head.state.config;
      if (!await put(key, head)) throw Error('Refusal fixture was not stored');
    })()`);
      const before = await storedRows();
      await fresh.reload();
      await expect
        .poll(() => fresh.locator('.cg-title [role="status"]').textContent())
        .toContain('This older garden is unsupported. Keep the file. Start fresh.');
      expect(await fresh.locator('.cg-game').count()).toBe(0);
      expect(await storedRows()).toEqual(before);
    } finally {
      await fresh.close();
    }
  },
);
