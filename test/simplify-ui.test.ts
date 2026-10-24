import { type Browser, chromium, type Page } from 'playwright-core';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, expect, it } from 'vitest';

let server: ViteDevServer;
let browser: Browser;
let base: string;
beforeAll(async () => {
  server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
  await server.listen();
  base = server.resolvedUrls?.local[0] ?? '';
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  await server?.close();
});
async function savedGarden(page: Page) {
  // Local fixture: this does not prove shared admission.
  await page.evaluate(`(async()=>{
    const {put}=await import('/src/ui/store.ts');
    const {freshGarden}=await import('/src/sim/garden.ts');
    const {exportGarden}=await import('/src/sim/garden-export.ts');
    const {createPersona}=await import('/node_modules/@adam0white/lab-client/dist/index.js');
    const receipt=await createPersona({format:'hf-persona/1',castId:'hf.cast.riza.voice',castRevision:'1',branchId:'fixture',parentRevision:null,source:{game:'hearsay',build:'fixture',engine:'2.17.0',rules:'hearsay-cast-6'},transfer:{},limitations:[]});
    await put('garden-cast6',{export:exportGarden(freshGarden(17)),fileOrigin:false,ownedHeads:{[receipt.castId]:receipt},archives:[]});
  })()`);
  await page.reload();
  await page.locator('[data-pace="0"]').click();
}
it.each(['', '?lab=0', '?lab=true', '?lab=01', '?lab=1'])(
  'shows diagnostics only for the exact lab flag %s',
  async (query) => {
    const page = await browser.newPage();
    try {
      await page.goto(base + query);
      await page.locator('.cg-title').waitFor();
      const diagnostic = page.locator('.cg-lab');
      expect(await diagnostic.count()).toBe(query === '?lab=1' ? 1 : 0);
      expect(await page.locator('#import-run').count()).toBe(query === '?lab=1' ? 1 : 0);
      expect(await page.getByRole('link', { name: 'All games' }).getAttribute('target')).toBe('_top');
      await savedGarden(page);
      await page.getByRole('button', { name: 'Game menu', exact: true }).click();
      expect(await page.locator('.cg-lab').count()).toBe(query === '?lab=1' ? 1 : 0);
      const labels = await page.locator('.cg-panel > button').allTextContents();
      expect(labels).toEqual(['Resume', 'Feedback', 'Fullscreen', 'New game']);
      await page.getByRole('button', { name: 'New game', exact: true }).click();
      await page.getByRole('button', { name: 'Keep this garden', exact: true }).click();
      expect(await page.locator('.cg-header').innerText()).toContain('Day 1');
    } finally {
      await page.close();
    }
  },
);
it.each(['prepareBatch', 'putBatch'])(
  'keeps the saved garden and ownership when %s fails, including an uncertain accepted reply',
  async (failure) => {
    const context = await browser.newContext();
    // Serve actual game modules under their allowed production origin. Only the shelf is a fixture.
    await context.route('https://hearsay.adamwhite.work/**', async (route) => {
      const url = new URL(route.request().url());
      const response = await route.fetch({ url: base.slice(0, -1) + url.pathname + url.search });
      await route.fulfill({ response });
    });
    await context.route('https://human.adamwhite.work/**', async (route) => {
      await route.fulfill({
        contentType: 'text/html',
        body: `<script>window.addEventListener('message',e=>{
          const m=e.data, port=e.ports[0]; if(!port)return;
          if(m.type==='hf-persona-consent')port.postMessage({type:'hf-persona-consent-reply',id:m.id,value:true});
          if(m.type==='hf-persona-request'){
            if(m.action==='prepareBatch' && '${failure}'!=='prepareBatch')port.postMessage({type:'hf-persona-reply',id:m.id,value:{inputs:[],blocked:[],expectedHeads:Object.fromEntries(m.castIds.map(id=>[id,null]))}});
            else port.postMessage({type:'hf-persona-reply',id:m.id,error:'Shelf unavailable. Use a local file.'});
          }
        });</script>`,
      });
    });
    const page = await context.newPage();
    try {
      await page.goto('https://hearsay.adamwhite.work/');
      await page.locator('.cg-title').waitFor();
      await savedGarden(page);
      const read = () =>
        page.evaluate(`(async()=>{
        const {get}=await import('/src/ui/store.ts');return (await get('garden-cast6')).value;
      })()`);
      await page.getByRole('button', { name: 'Game menu', exact: true }).click();
      const before = await read();
      await page.getByRole('button', { name: 'New game', exact: true }).click();
      await page.getByRole('button', { name: 'Start new game', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'The new garden could not start' }).waitFor();
      expect(await read()).toEqual(before);
      expect(await page.locator('.cg-panel').innerText()).not.toMatch(/Shelf unavailable|local file/);
      expect(await page.getByRole('button', { name: 'Feedback', exact: true }).isVisible()).toBe(true);
      await page.getByRole('button', { name: 'Resume', exact: true }).click();
      expect(await page.locator('[data-person]').count()).toBe(8);
    } finally {
      await context.close();
    }
  },
);
it.each([
  { width: 820, height: 1180 },
  { width: 1180, height: 820 },
])(
  'uses readable actual tablet controls and a scrollable one-page Feedback at $width×$height',
  async (viewport) => {
    const page = await browser.newPage({ viewport });
    try {
      await page.goto(base);
      await page.locator('.cg-title').waitFor();
      // The stable footer must remain outside the changing app root.
      expect(await page.locator('.cg-footer').count()).toBe(1);
      await savedGarden(page);
      const sizes = await page
        .locator('.cg-person small, .cg-panel button, .cg-header p')
        .evaluateAll((elements) => elements.map((el) => Number.parseFloat(getComputedStyle(el).fontSize)));
      expect(Math.min(...sizes)).toBeGreaterThanOrEqual(16);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.getByRole('button', { name: 'Game menu', exact: true }).click();
      await page.getByRole('button', { name: 'Feedback', exact: true }).click();
      expect(await page.locator('#hflab-persona').count()).toBe(0);
      expect(await page.locator('.hflab').count()).toBe(1);
      const note = page.locator('#hflab-note');
      await note.fill('Readable tablet feedback.');
      const submit = page.locator('.hflab button.send');
      await submit.scrollIntoViewIfNeeded();
      expect(await submit.isVisible()).toBe(true);
      const bounds = await submit.boundingBox();
      expect(bounds ? bounds.y + bounds.height : 9999).toBeLessThanOrEqual(viewport.height);
    } finally {
      await page.close();
    }
  },
);
