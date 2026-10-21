import { type Browser, chromium, type Page } from 'playwright-core';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { advance, newGame } from '../src/sim/engine';

let server: ViteDevServer;
let browser: Browser;
let page: Page;
beforeAll(async () => {
  server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
  await server.listen();
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 360, height: 690 } });
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto(server.resolvedUrls?.local[0] ?? '');
});
afterAll(async () => {
  await browser?.close();
  await server?.close();
});
async function load(minute = 479, clearQuestion = true) {
  await page.goto('about:blank');
  await page.goto(server.resolvedUrls?.local[0] ?? '');
  await page.locator('.title-page').waitFor();
  const fixture = newGame(1);
  advance(fixture, minute);
  if (clearQuestion) fixture.s.newsWaiting = false;
  fixture.s.locations.aylin = 'garden';
  await page.evaluate(async (fixture) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('hearsay', 1);
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction('pages', 'readwrite');
      const store = tx.objectStore('pages');
      for (const [key, value] of [
        ['run-ui', null],
        ['run-log', null],
        ['run', fixture],
      ])
        store.put({ plain: JSON.stringify(value), at: Date.now() }, key as string);
      tx.oncomplete = () => resolve();
    });
    db.close();
  }, fixture);
  await page.reload();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.locator('.lk-strip').waitFor();
}
async function talkTo(id: string) {
  const person = page.locator(`[data-person="${id}"]`);
  if (!(await person.isVisible())) await page.locator('.other-neighbours > summary').click();
  await person.click();
}
async function choose(selector: string) {
  const option = page.locator(selector);
  if (!(await option.isVisible()))
    await page.getByText('Choose person, story or word', { exact: true }).click();
  await option.click();
}
async function weddingDetails() {
  await page.getByRole('button', { name: 'Wedding details', exact: true }).click();
}
it('holds the listener beyond departure and keeps the statement and every verb on the phone', async () => {
  await load();
  await talkTo('aylin');
  expect(await page.locator('.presence').innerText()).toContain('Aylin sits with you');
  await page.waitForFunction(() => document.querySelector('.clock-pace')?.textContent?.includes('Time held'));
  await page.clock.runFor(2200);
  expect(await page.locator('.presence').innerText()).toContain('Aylin sits with you');
  expect(await page.locator('[data-person="aylin"]').count()).toBe(1);
  const bounds = await page.locator('.talk-bar .tell-preview, .talk-bar [data-verb]').evaluateAll((els) =>
    els.map((el) => ({
      top: el.getBoundingClientRect().top,
      bottom: el.getBoundingClientRect().bottom,
      height: el.getBoundingClientRect().height,
    })),
  );
  expect(bounds).toHaveLength(5);
  expect(bounds.every((b) => b.top >= 0 && b.bottom <= 690)).toBe(true);
  expect(bounds.slice(1).every((b) => b.height >= 44)).toBe(true);
  await page.getByRole('button', { name: 'Close Talk to Aylin', exact: true }).click();
  expect(await page.locator('[data-speed]').count()).toBe(0);
});
it('holds reading time so the seated listener does not expire while the panel is open', async () => {
  await load();
  await talkTo('aylin');
  const clock = await page.locator('#clock').innerText();
  for (let i = 0; i < 110; i++) await page.clock.runFor(1000);
  expect(await page.getByRole('dialog').isVisible()).toBe(true);
  expect(await page.locator('#clock').innerText()).toBe(clock);
  expect(await page.locator('.presence').innerText()).toContain('Aylin sits with you');
});
it('offers one Talk entry, visible limits, household marks and a compact wedding road', async () => {
  await load(390);
  expect(await page.locator('[data-open-talk]').allTextContents()).toEqual(['Talk to…']);
  expect(await page.locator('.action-limit').allTextContents()).toContain('No one has asked you anything.');
  expect(await page.locator('[data-person="emre"]').innerText()).toContain('your household');
  await weddingDetails();
  expect(await page.locator('.riza-mind').innerText()).toContain('Next: Coffee with Elif');
  expect(await page.locator('.riza-mind').innerText()).toContain('Day 4, Thursday');
  expect(await page.locator('[data-doubt]').count()).toBe(3);
  await page.locator('[data-doubt]').first().click();
  expect(await page.locator('.doubt-detail').innerText()).toContain('?');
  expect(
    await page
      .locator('[data-doubt]')
      .first()
      .evaluate((el) => el === document.activeElement),
  ).toBe(true);
});

it('releases a saved hold on Resume when its sheet no longer exists', async () => {
  await load();
  await talkTo('aylin');
  await page.waitForFunction(() => document.querySelector('.clock-pace')?.textContent?.includes('Time held'));
  await page.reload();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.locator('.lk-strip').waitFor();
  const inputs = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('hearsay', 1);
      request.onsuccess = () => resolve(request.result);
    });
    return await new Promise<string[]>((resolve) => {
      const r = db.transaction('pages').objectStore('pages').get('run-log');
      r.onsuccess = () => {
        db.close();
        resolve(JSON.parse(r.result.plain).inputs.map((i: { input: { type: string } }) => i.input.type));
      };
    });
  });
  expect(inputs.slice(-2)).toEqual(['sit', 'release']);
  expect(await page.getByRole('dialog').count()).toBe(0);
});
it('opens the waiting person and reports their departure without claiming an answer', async () => {
  await load(405, false);
  const before = await page.locator('.question').innerText();
  await page.locator('[data-open-talk]').click();
  expect(await page.locator('.dialog-head h2').innerText()).toMatch(/^Talk to /);
  await page.getByRole('button', { name: /^Close Talk to / }).click();
  await page.locator('[data-open-talk]').waitFor();
  expect(before).toContain('Aylin');
  expect(await page.locator('.reply').innerText()).toContain(
    'Aylin has moved on. You have not answered their question.',
  );
  expect(await page.locator('.question').count()).toBe(0);
  expect(await page.locator('#hold').getAttribute('aria-disabled')).toBe('true');
});
