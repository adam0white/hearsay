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
  await page.getByRole('button', { name: 'Send word', exact: true }).click();
  expect(await page.locator('#hflab-persona').count()).toBe(0);
  await page.locator('#hflab-note').fill('A garden title note.');
  await page.locator('.hflab button.send').click();
  expect(await page.evaluate('window.gardenChoices')).toEqual([]);
  expect(await page.evaluate('window.directGrants')).toEqual([]);
  expect(await page.evaluate('window.gardenFeedback')).toEqual({
    note: 'A garden title note.',
    name: '',
    run: { feedbackOnly: true },
  });
  expect(await page.locator('.cg-title').count()).toBe(1);
});
it('keeps the active garden export replayable without any browser consent or ownership metadata', async () => {
  const result = await page.evaluate<{ same: boolean; keys: string[]; stateKeys: string[] }>(`(async()=>{
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

it('updates only the mounted active garden sheet after deferred host approval and preserves note sending on rejection', async () => {
  await page.goto(server.resolvedUrls?.local[0] ?? '');
  await page
    .getByRole('button', { name: /Begin a fresh fortnight|Play a separate local fortnight/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Game menu', exact: true }).click();
  await page.evaluate(`(async()=>{
    const {lab}=await import('/src/ui/lab.ts');
    const {GardenRecordingGuard}=await import('/src/ui/garden-recording.ts');
    lab.personaRecordingRequired=true;lab.personaRecordingAllowed=false;
    window.directGrants=[];window.gardenChoices=[];
    lab.allowPersonaRecording=value=>window.directGrants.push(value);
    GardenRecordingGuard.prototype.choose=value=>{if(!value)lab.personaRecordingAllowed=false;window.gardenChoices.push(value);return new Promise((resolve,reject)=>{window.finishChoice=()=>{lab.personaRecordingAllowed=value;resolve();};window.rejectChoice=()=>reject(Error('epoch changed'));});};
    lab.sendFeedback=async(note,options)=>{window.gardenFeedback={note,...options};return 'queued';};
  })()`);
  await page.getByRole('button', { name: 'Send this run to the notebook', exact: true }).click();
  const choice = page.getByLabel('Link all continuing histories in this garden to lab recording (optional)');
  await choice.click();
  expect(await choice.isChecked()).toBe(false);
  await page.evaluate('window.finishChoice()');
  await expect.poll(() => choice.isChecked()).toBe(true);
  await choice.click();
  await page.evaluate('window.rejectChoice()');
  await expect.poll(() => choice.isChecked()).toBe(false);
  await page.locator('#hflab-note').fill('Still send the garden note.');
  await page.locator('.hflab button.send').click();
  expect(await page.evaluate('window.gardenChoices')).toEqual([true, false]);
  expect(await page.evaluate('window.directGrants')).toEqual([]);
  expect(await page.evaluate('window.gardenFeedback.note')).toBe('Still send the garden note.');
});
