import { type Browser, chromium, type Page } from 'playwright-core';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, expect, it } from 'vitest';

let server: ViteDevServer;
let browser: Browser;
let page: Page;
beforeAll(async () => {
  server = await createServer({
    server: { host: '127.0.0.1', port: 0, hmr: false, watch: null },
  });
  await server.listen();
  browser = await chromium.launch();
  page = await browser.newPage();
});
afterAll(async () => {
  await browser?.close();
  await server?.close();
});
it('uses the active garden entry, scoped group choice and explicit title note without creating a run', async () => {
  await page.goto(server.resolvedUrls?.local[0] ?? '');
  await page.evaluate(`(async () => {
    const {lab}=await import('/src/ui/lab.ts');
    const {GardenRecordingGuard}=await import('/src/ui/garden-recording.ts');
    window.gardenChoices=[];window.directGrants=[];
    GardenRecordingGuard.prototype.choose=async value=>{window.gardenChoices.push(value);throw Error('epoch changed');};
    lab.personaRecordingRequired=true;lab.personaRecordingAllowed=false;
    lab.allowPersonaRecording=value=>window.directGrants.push(value);
    lab.openSendDialog=()=>{throw Error('Raw lab dialog must not be used');};
    lab.sendFeedback=async(note,options)=>{window.gardenFeedback={note,...options};return 'queued';};
  })()`);
  await page.getByRole('button', { name: 'Feedback', exact: true }).click();
  expect(await page.locator('#hflab-persona').count()).toBe(0);
  await page.locator('#hflab-note').fill('A garden title note.');
  await page.locator('.hflab button.send').click();
  expect(await page.evaluate('window.gardenChoices')).toEqual([]);
  expect(await page.evaluate('window.directGrants')).toEqual([]);
  expect(await page.evaluate('window.gardenFeedback')).toEqual({
    note: 'A garden title note.',
    name: '',
    sharePlay: false,
  });
  expect(await page.locator('.cg-title').count()).toBe(1);
});
it('keeps the active garden export replayable without any browser consent or ownership metadata', async () => {
  const result = await page.evaluate<{
    same: boolean;
    keys: string[];
    stateKeys: string[];
  }>(`(async()=>{
    const {freshGarden,advanceGarden}=await import('/src/sim/garden.ts');
    const {exportGarden,importGarden}=await import('/src/sim/garden-export.ts');
    const run=freshGarden(17);advanceGarden(run,375);
    const exported=exportGarden(run);const restored=importGarden(JSON.stringify(exported));
    return {same:JSON.stringify(restored)===JSON.stringify(run),keys:Object.keys(exported),stateKeys:Object.keys(exported.state)};
  })()`);
  expect(result.same).toBe(true);
  for (const key of [
    'fileHistory',
    'fileKey',
    'ownedHeads',
    'archives',
    'recordingEpoch',
    'player',
    'session',
  ]) {
    expect(result.keys).not.toContain(key);
    expect(result.stateKeys).not.toContain(key);
  }
});

it.each([false, true])('shares active garden play only when its one checkbox is %s', async (sharePlay) => {
  await page.close();
  page = await browser.newPage();
  await page.goto(server.resolvedUrls?.local[0] ?? '');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  // A saved local fixture tests Feedback; it is not a shared admission receipt.
  await page.evaluate(`(async()=>{
    const {put}=await import('/src/ui/store.ts');
    const {freshGarden}=await import('/src/sim/garden.ts');
    const {exportGarden}=await import('/src/sim/garden-export.ts');
    await put('garden-cast6',{export:exportGarden(freshGarden(17)),fileOrigin:false,ownedHeads:{},archives:[]});
  })()`);
  await page.reload();
  await page.locator('[data-pace="0"]').click();
  await page.getByRole('button', { name: 'Game menu', exact: true }).click();
  await page.evaluate(`(async()=>{
    const {lab}=await import('/src/ui/lab.ts');
    lab.setTelemetryOff(true);
    lab.sendFeedback=async(note,options)=>{window.gardenFeedback={note,...options};return 'queued';};
  })()`);
  await page
    .getByRole('button', {
      name: 'Feedback',
      exact: true,
    })
    .click();
  const choice = page.getByLabel('Share this run and my play with the lab');
  expect(await choice.isChecked()).toBe(false);
  await choice.setChecked(sharePlay);
  await page.locator('#hflab-note').fill('Still send the garden note.');
  await page.locator('.hflab button.send').click();
  expect(await page.evaluate('window.gardenFeedback.sharePlay')).toBe(sharePlay);
  expect(await page.evaluate('window.gardenFeedback.note')).toBe('Still send the garden note.');
});
