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
  const incidentPerson = page.locator(`[data-incident-person="${id}"]`);
  if (await incidentPerson.isVisible()) {
    await incidentPerson.click();
    return;
  }
  const waiting = page.locator(`[data-question-person="${id}"]`);
  if (await waiting.isVisible()) {
    await waiting.click();
    return;
  }
  const person = page.locator(`[data-person="${id}"]`);
  if (!(await person.isVisible())) {
    const keep = page.locator('#keep-incident');
    if (await keep.isVisible()) await keep.click();
    const hold = page.locator('#hold');
    if (await hold.isVisible()) await hold.click();
    if (!(await person.isVisible())) await page.locator('.other-neighbours > summary').click();
  }
  await person.click();
}
async function weddingDetails() {
  await page.locator('[data-wedding-details]').click();
}
it('holds the listener beyond departure and keeps the statement and every verb on the phone', async () => {
  await load();
  await talkTo('aylin');
  await page.locator('.state-status').filter({ hasText: 'talking' }).waitFor();
  await page.waitForFunction(() => document.querySelector('.state-status')?.textContent?.includes('Held'));
  await page.clock.runFor(2200);
  expect(await page.locator('.state-status').innerText()).toContain('talking');
  expect(await page.locator('[data-person="aylin"]').count()).toBe(1);
  const bounds = await page.locator('.talk-bar .tell-preview, .talk-bar [data-verb]').evaluateAll((els) =>
    els.map((el) => ({
      top: el.getBoundingClientRect().top,
      bottom: el.getBoundingClientRect().bottom,
      height: el.getBoundingClientRect().height,
      button: el.tagName === 'BUTTON',
    })),
  );
  expect(bounds.length).toBeGreaterThanOrEqual(4);
  expect(bounds.every((b) => b.top >= 0 && b.bottom <= 690)).toBe(true);
  expect(bounds.filter((b) => b.button).every((b) => b.height >= 44)).toBe(true);
  await page.getByRole('button', { name: /^Close ← Aylin/ }).click();
  expect(await page.locator('[data-speed]').count()).toBe(0);
});
it('holds reading time so the seated listener does not expire while the panel is open', async () => {
  await load();
  await talkTo('aylin');
  const clock = await page.locator('#clock').innerText();
  await page.clock.fastForward(110000);
  expect(await page.getByRole('dialog').isVisible()).toBe(true);
  expect(await page.locator('#clock').innerText()).toBe(clock);
  expect(await page.locator('.state-status').innerText()).toContain('talking');
});
it('shows people, household marks and a compact wedding road', async () => {
  await load(390);
  expect(await page.locator('[data-open-talk]').count()).toBe(0);
  expect(await page.locator('#hold').count()).toBe(0);
  await page.locator('#keep-incident').click();
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
  await page.waitForFunction(() => document.querySelector('.state-status')?.textContent?.includes('Held'));
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
it('offers Say nothing only for the waiting question and records that response', async () => {
  await load(405, false);
  expect(await page.locator('.question').innerText()).toContain('flour');
  expect(await page.locator('#skip').count()).toBe(0);
  await page.getByRole('button', { name: 'Say nothing', exact: true }).click();
  await page.locator('.question').waitFor({ state: 'hidden' });
  expect(await page.locator('#hold').count()).toBe(0);
  const types = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('hearsay', 1);
      request.onsuccess = () => resolve(request.result);
    });
    return await new Promise<string[]>((resolve) => {
      const request = db.transaction('pages').objectStore('pages').get('run-log');
      request.onsuccess = () => {
        db.close();
        resolve(
          JSON.parse(request.result.plain).inputs.map(
            (entry: { input: { type: string } }) => entry.input.type,
          ),
        );
      };
    });
  });
  expect(types.at(-1)).toBe('hold-tongue');
});
