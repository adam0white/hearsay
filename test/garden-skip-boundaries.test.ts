import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { expect, it } from 'vitest';

it('refuses malformed native and file metadata before cursor, save or recording activation', async () => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
  await server.listen();
  const browserServer = await chromium.launchServer();
  const browser = await chromium.connect(browserServer.wsEndpoint());
  const proof: Record<string, unknown> = {};
  try {
    const page = await browser.newPage();
    await page.goto(server.resolvedUrls?.local[0] ?? '');
    const native = await page.evaluate(`(async()=>{
      const {freshGarden,advanceGarden}=await import('/src/sim/garden4.ts');
      const {exportGarden}=await import('/src/sim/garden4-export.ts');
      const {saveGardenJournal,loadGardenJournal}=await import('/src/ui/garden-journal.ts');
      const {get,put}=await import('/src/ui/store.ts');
      const {GardenRecordingGuard}=await import('/src/ui/garden-recording.ts');
      const meta={fileOrigin:false,fileKey:null,ownedHeads:{},archives:[]};
      const g=freshGarden(17,undefined,{version:'hearsay-hf4-batch/1',claims:[],skipped:[]});
      await saveGardenJournal(g,meta);
      const original=(await get('garden-hf4-journal-1')).value;
      const active=JSON.stringify(exportGarden(g));
      const bad=structuredClone(original);
      bad.state.chapter.skipped=[{castId:'hf.cast.hatice.hearsay',reason:'refused'}];
      bad.meta.ownedHeads={'hf.cast.hatice.hearsay':{castId:'hf.cast.hatice.hearsay'}};
      await put('garden-hf4-journal-1',bad);
      const before=JSON.stringify((await get('garden-hf4-journal-1')).value);
      let error='';try{await loadGardenJournal()}catch(e){error=e.message}
      const unchanged=before===JSON.stringify((await get('garden-hf4-journal-1')).value);
      const activeUnchanged=active===JSON.stringify(exportGarden(g));
      advanceGarden(g,365);
      const saved=await saveGardenJournal(g,meta);
      const after=(await get('garden-hf4-journal-1')).value;
      const cursorRetained=after.id===original.id && after.openingKey===original.openingKey;
      window.skipBindings=0;
      const bind=GardenRecordingGuard.prototype.bind;
      GardenRecordingGuard.prototype.bind=function(...args){window.skipBindings++;return bind.apply(this,args)};
      return {error,unchanged,activeUnchanged,saved,cursorRetained};
    })()`);
    proof.native = native;
    expect(native).toMatchObject({
      error: expect.stringMatching(/Keep the original.*Start fresh/),
      unchanged: true,
      activeUnchanged: true,
      saved: true,
      cursorRetained: true,
    });
    await page.reload();
    await page.getByRole('button', { name: 'Game menu', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Game menu', exact: true }).click();
    await page.getByText('Other ways to begin', { exact: true }).click();
    await page.getByRole('button', { name: 'Open a game file', exact: true }).click();
    // The click returns before the route's awaited save and recording bind finish.
    // The file input appears only after both complete. Measure import effects after that.
    await page.locator('#import-run').waitFor({ state: 'visible' });
    const before = await page.evaluate(`(async()=>{
      const {get}=await import('/src/ui/store.ts');
      const {GardenRecordingGuard}=await import('/src/ui/garden-recording.ts');
      const {lab}=await import('/src/ui/lab.ts');
      window.skipBindings=0;window.skipSaves=0;
      const bind=GardenRecordingGuard.prototype.bind;
      GardenRecordingGuard.prototype.bind=function(...args){window.skipBindings++;return bind.apply(this,args)};
      const capture=lab.captureSave.bind(lab);lab.captureSave=(...args)=>{window.skipSaves++;return capture(...args)};
      return JSON.stringify((await get('garden-hf4-journal-1')).value);
    })()`);
    const malformed = await page.evaluate(`(async()=>{
      const {freshGarden}=await import('/src/sim/garden4.ts');
      const {exportGarden}=await import('/src/sim/garden4-export.ts');
      const {canonicalPersona}=await import('/node_modules/.vite/deps/@adam0white_lab-client.js');
      const {hash}=await import('/src/sim/hash.ts');
      const packet=exportGarden(freshGarden(17));
      packet.state.chapter={version:'hearsay-hf4-batch/1',claims:[],skipped:[null]};
      packet.fingerprint=hash(canonicalPersona(packet.state)).toString(16);
      return JSON.stringify(packet);
    })()`);
    await page.locator('#import-run').setInputFiles({
      name: 'invalid.json',
      mimeType: 'application/json',
      buffer: Buffer.from(String(malformed)),
    });
    await expect
      .poll(() => page.locator('[role="status"]').textContent())
      .toMatch(/Keep the original.*Start fresh/);
    const after = await page.evaluate(
      `(async()=>{const {get}=await import('/src/ui/store.ts');return {native:JSON.stringify((await get('garden-hf4-journal-1')).value),bindings:window.skipBindings,saves:window.skipSaves}})()`,
    );
    proof.file = { nativeUnchanged: (after as { native: string }).native === before, ...(after as object) };
    expect(after).toEqual({ native: before, bindings: 0, saves: 0 });
    expect(await page.locator('.cg-game').count()).toBe(0);
  } finally {
    await browser.close();
    await browserServer.close();
    console.info(
      JSON.stringify({
        browserPID: browserServer.process().pid,
        exited: browserServer.process().exitCode !== null,
      }),
    );
    await server.close();
    proof.browserPID = browserServer.process().pid;
    proof.browserExited = browserServer.process().exitCode !== null;
    proof.serverClosed = true;
    if (process.env.HEARSAY_READER_R2_PROOF)
      writeFileSync(process.env.HEARSAY_READER_R2_PROOF, JSON.stringify(proof, null, 2));
  }
});
