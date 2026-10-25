import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { expect, it } from 'vitest';

it('compresses and restores saves without reading a document-owned Blob stream', async () => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
  await server.listen();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(server.resolvedUrls?.local[0] ?? '');
    await page.locator('.cg-title').waitFor();
    const result = await page.evaluate<{ saved: boolean; compressed: boolean; loaded: unknown }>(`(async()=>{
      const {put,get}=await import('/src/ui/store.ts');
      const original=Blob.prototype.stream;
      Blob.prototype.stream=function(){throw new Error('Document-owned Blob stream is unavailable during unload');};
      let saved;
      try { saved=await put('unload-compression',{text:'A saved garden.',ownedHeads:{riza:'exact-receipt'}}); }
      finally { Blob.prototype.stream=original; }
      const open=indexedDB.open('hearsay',1);
      const db=await new Promise(resolve=>open.onsuccess=()=>resolve(open.result));
      const request=db.transaction('pages','readonly').objectStore('pages').get('unload-compression');
      const row=await new Promise(resolve=>request.onsuccess=()=>resolve(request.result));db.close();
      return {saved,compressed:row.blob instanceof Blob,loaded:(await get('unload-compression')).value};
    })()`);
    expect(result.saved).toBe(true);
    expect(result.compressed).toBe(true);
    expect(result.loaded).toEqual({ text: 'A saved garden.', ownedHeads: { riza: 'exact-receipt' } });
  } finally {
    await browser.close();
    await server.close();
  }
});
