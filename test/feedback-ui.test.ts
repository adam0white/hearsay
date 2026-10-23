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
  await page.goto(server.resolvedUrls?.local[0] ?? '');
});
afterAll(async () => {
  await browser?.close();
  await server?.close();
});
it('blocks recording-off sends, preserves names, and sends the note with the selected verdict', async () => {
  await page.evaluate(`(async () => {
    const {lab} = await import('/src/ui/lab.ts');
    lab.setTelemetryOff = (off) => localStorage.setItem('hf-lab-recording-off', off ? '1' : '0');
    lab.sendFeedback = async (note, options) => { window.feedbackSent = {note, ...options}; return 'queued'; };
    localStorage.setItem('hf-lab-recording-off', '1');
    const {openFeedback} = await import('/src/ui/feedback.ts');
    openFeedback(() => ({game:'hearsay',seed:1,inputs:[]}), () => {});
  })()`);
  expect(await page.getByRole('button', { name: 'Send', exact: true }).isDisabled()).toBe(true);
  await page.getByRole('checkbox', { name: 'Record play for the lab' }).check();
  await page.getByRole('button', { name: 'Not sure', exact: true }).click();
  await page.getByRole('textbox', { name: 'Your word', exact: true }).fill('I wanted to talk.');
  await page.getByText('+ Add a name or tester id', { exact: true }).click();
  await page.getByRole('textbox', { name: 'Your name or tester id', exact: true }).fill(' Hatice ');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  expect(await page.getByRole('status').last().innerText()).toBe('Sent. Thank you.');
  expect(await page.evaluate('window.feedbackSent')).toEqual({
    note: 'Verdict: mixed\n\nI wanted to talk.',
    name: 'Hatice',
  });
  expect(await page.evaluate(() => localStorage.getItem('hf-lab-feedback-name'))).toBe('Hatice');
});
it('reveals privacy consent after recording is enabled under a privacy signal', async () => {
  await page.getByRole('button', { name: 'Back to the game', exact: true }).click();
  await page.evaluate(`(async () => {
    const {lab}=await import('/src/ui/lab.ts');
    lab.privacySignalOn=true;
    localStorage.setItem('hf-lab-recording-off','1');
    const {openFeedback}=await import('/src/ui/feedback.ts');
    openFeedback(()=>({game:'hearsay',seed:1,inputs:[]}),()=>{});
  })()`);
  await page.getByRole('checkbox', { name: 'Record play for the lab' }).check();
  expect(await page.getByRole('button', { name: 'Send', exact: true }).isDisabled()).toBe(true);
  expect(await page.getByRole('checkbox', { name: 'Send this run with my note' }).isVisible()).toBe(true);
});
it('keeps the consent fallback in the modal active layer and preserves the note', async () => {
  await page.evaluate(`(async()=>{
    const {lab}=await import('/src/ui/lab.ts');
    const {openSendDialog}=await import('/node_modules/@adam0white/lab-client/dist/index.js');
    lab.sendRun=async()=>{throw new Error('local fallback');};
    lab.openSendDialog=options=>openSendDialog({...options,lab});
  })()`);
  await page.getByRole('checkbox', { name: 'Send this run with my note' }).check();
  await page.getByRole('textbox', { name: 'Your word', exact: true }).fill('Keep my words.');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  expect(await page.locator('.feedback-dialog .hflab-veil').count()).toBe(1);
  expect(await page.locator('#hflab-note').inputValue()).toContain('Keep my words.');
  await page.getByRole('button', { name: 'Not now', exact: true }).click();
  expect(await page.locator('.hflab-veil').count()).toBe(0);
});
it('blocks note and explicit run paths while historical linkage is absent', async () => {
  await page.reload();
  await page.evaluate(`(async()=>{
    const {lab}=await import('/src/ui/lab.ts');
    lab.personaRecordingAllowed=false;
    lab.privacySignalOn=false;
    localStorage.removeItem('hf-lab-recording-off');
    localStorage.removeItem('hf-lab-events-off:hearsay');
    window.linkageSends=0;
    lab.sendFeedback=lab.sendRun=async()=>{window.linkageSends++;};
    const {openFeedback}=await import('/src/ui/feedback.ts');
    openFeedback(()=>({game:'hearsay',seed:1,inputs:[]}),()=>{});
  })()`);
  expect(await page.getByRole('button', { name: 'Send', exact: true }).isDisabled()).toBe(true);
  await page.getByRole('button', { name: 'Send', exact: true }).dispatchEvent('click');
  expect(await page.evaluate('window.linkageSends')).toBe(0);
});
