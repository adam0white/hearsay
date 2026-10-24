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
  await page.goto(`${server.resolvedUrls?.local[0] ?? ''}test/fixtures/legacy.html`);
});
afterAll(async () => {
  await browser?.close();
  await server?.close();
});
it('opens and sends feedback from the title before a run exists', async () => {
  await page.evaluate(`(async () => {
    const {lab}=await import('/src/ui/lab.ts');
    lab.sendFeedback=async(note,options)=>{window.titleFeedback={note,...options};return 'queued';};
  })()`);
  await page.getByRole('button', { name: 'Game menu', exact: true }).click();
  await page.getByRole('button', { name: 'Send word ▸', exact: true }).click();
  await page.getByRole('textbox', { name: 'Your word', exact: true }).fill('I have not started yet.');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  expect(await page.evaluate('window.titleFeedback')).toEqual({
    note: 'I have not started yet.',
    name: '',
    run: undefined,
  });
  await page.getByRole('button', { name: 'Back to the game', exact: true }).click();
});
it('sends recording-off feedback in one sheet and remembers the optional name', async () => {
  await page.evaluate(`(async () => {
    const {lab} = await import('/src/ui/lab.ts');
    lab.telemetryOn = false;
    lab.sendFeedback = async (note, options) => { window.feedbackSent = {note, ...options}; return 'queued'; };
    localStorage.setItem('hf-lab-recording-off', '1');
    const {openFeedback} = await import('/src/ui/feedback.ts');
    openFeedback(() => ({game:'hearsay',seed:1,inputs:[]}), () => {});
  })()`);
  expect(await page.getByRole('button', { name: 'Send', exact: true }).isEnabled()).toBe(true);
  await page.getByRole('button', { name: 'Not sure', exact: true }).click();
  await page.getByRole('textbox', { name: 'Your word', exact: true }).fill('I wanted to talk.');
  await page.getByText('+ Add a name or tester id', { exact: true }).click();
  await page.getByRole('textbox', { name: 'Your name or tester id', exact: true }).fill(' Hatice ');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  expect(await page.getByRole('status').last().innerText()).toBe(
    'Note and verdict queued without a run or history linkage.',
  );
  expect(await page.evaluate('window.feedbackSent')).toEqual({
    note: 'Verdict: mixed\n\nI wanted to talk.',
    name: 'Hatice',
    run: { game: 'hearsay', seed: 1, inputs: [] },
  });
  expect(await page.locator('.hflab-veil').count()).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem('hf-lab-feedback-name'))).toBe('Hatice');
});
it('keeps privacy and unanswered historical linkage from blocking the note', async () => {
  await page.reload();
  await page.evaluate(`(async () => {
    const {lab}=await import('/src/ui/lab.ts');
    lab.privacySignalOn=true;
    lab.personaRecordingRequired=true;
    lab.personaRecordingAllowed=false;
    window.linkageSends=0;
    lab.sendFeedback=async()=>{window.linkageSends++; return 'queued';};
    lab.openSendDialog=()=>{throw new Error('A second sheet must not open');};
    const {openFeedback}=await import('/src/ui/feedback.ts');
    openFeedback(()=>({game:'hearsay',seed:1,inputs:[]}),()=>{});
  })()`);
  expect(await page.getByRole('button', { name: 'Send', exact: true }).isEnabled()).toBe(true);
  await page.getByRole('textbox', { name: 'Your word', exact: true }).fill('Keep my words.');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  expect(await page.evaluate('window.linkageSends')).toBe(1);
  expect(await page.locator('.hflab-veil').count()).toBe(0);
});
it('keeps a transport failure in the same sheet and permits retry', async () => {
  await page.reload();
  await page.evaluate(`(async()=>{
    const {lab}=await import('/src/ui/lab.ts');
    window.linkageSends=0;
    lab.sendFeedback=async()=>{if(!window.linkageSends++) throw new Error('offline'); return 'queued';};
    const {openFeedback}=await import('/src/ui/feedback.ts');
    openFeedback(()=>{throw new Error('export unavailable');},()=>{});
  })()`);
  await page.getByRole('textbox', { name: 'Your word', exact: true }).fill('Keep my words.');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  expect(await page.getByRole('status').last().innerText()).toContain('could not be sent');
  expect(await page.getByRole('textbox', { name: 'Your word', exact: true }).inputValue()).toBe(
    'Keep my words.',
  );
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  expect(await page.evaluate('window.linkageSends')).toBe(2);
  expect(await page.locator('.hflab-veil').count()).toBe(0);
});
it.each([360, 1280])('keeps shared feedback readable at width %i under dark OS settings', async (width) => {
  await page.goto(`${server.resolvedUrls?.local[0] ?? ''}test/fixtures/legacy.html`);
  await page.setViewportSize({ width, height: 800 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.evaluate(`(async () => {
    const {openSendDialog}=await import('/node_modules/@adam0white/lab-client/dist/index.js');
    const {lab}=await import('/src/ui/lab.ts');
    openSendDialog({lab,getRun:()=>undefined});
  })()`);
  const colors = await page.locator('.hflab').evaluate((sheet) => {
    const style = getComputedStyle(sheet);
    const input = getComputedStyle(sheet.querySelector('textarea')!);
    const soft = getComputedStyle(sheet.querySelector('.soft')!);
    return { paper: style.backgroundColor, input: input.backgroundColor, ink: input.color, soft: soft.color };
  });
  expect(colors).toEqual({
    paper: 'rgb(245, 239, 227)',
    input: 'rgb(245, 239, 227)',
    ink: 'rgb(38, 63, 59)',
    soft: 'rgb(82, 99, 91)',
  });
  const luminance = (color: string): number => {
    const channels = (color.match(/\d+/g) ?? []).slice(0, 3).map((value) => {
      const channel = Number(value) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
  };
  const contrast = (foreground: string, background: string): number => {
    const levels = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
    return (levels[1]! + 0.05) / (levels[0]! + 0.05);
  };
  expect(contrast(colors.ink, colors.input)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(colors.soft, colors.paper)).toBeGreaterThanOrEqual(4.5);
  await page.locator('.hflab').getByRole('button', { name: 'Not now', exact: true }).click();
  await page.emulateMedia({ colorScheme: 'light' });
});
