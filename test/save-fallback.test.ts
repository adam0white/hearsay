import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { expect, it } from 'vitest';

it('saves and reloads exact garden receipts when storage rejects compressed Blob writes', async () => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
  await server.listen();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(server.resolvedUrls?.local[0] ?? '');
    await page.locator('.cg-title').waitFor();
    const result = await page.evaluate<{ saved: boolean; value: unknown; loaded: unknown }>(`(async()=>{
      const {put,get}=await import('/src/ui/store.ts');
      const original=IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put=function(value,...rest){
        if(value.blob)throw new DOMException('Blob refused','DataCloneError');
        return original.call(this,value,...rest);
      };
      const value={export:{seed:17},ownedHeads:{riza:{revision:'exact-fixture-receipt'}},archives:['retained']};
      const saved=await put('fallback-fixture',value);
      IDBObjectStore.prototype.put=original;
      return {saved,value,loaded:(await get('fallback-fixture'))?.value};
    })()`);
    expect(result.saved).toBe(true);
    expect(result.loaded).toEqual(result.value);
    await page.reload();
    expect(
      await page.evaluate(
        `(async()=>{const {get}=await import('/src/ui/store.ts');return (await get('fallback-fixture')).value})()`,
      ),
    ).toEqual(result.value);
  } finally {
    await browser.close();
    await server.close();
  }
});
