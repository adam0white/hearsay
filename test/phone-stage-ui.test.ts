import { type Browser, chromium, type Page } from 'playwright-core';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { advance, newGame } from '../src/sim/engine';
import type { Game } from '../src/sim/types';

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
});
afterAll(async () => {
  await browser?.close();
  await server?.close();
});
async function load(fixture: Game) {
  await page.goto('about:blank');
  await page.goto(`${server.resolvedUrls?.local[0] ?? ''}test/fixtures/legacy.html`);
  await page.locator('.title-page').waitFor();
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
  await page.locator('.game').waitFor();
}
it.each([
  { width: 360, height: 690 },
  { width: 1280, height: 800 },
])('gives the people-list disclosure a 44px target at $width×$height', async (viewport) => {
  await page.setViewportSize(viewport);
  await load(newGame(1));
  const target = page.locator('.other-neighbours > summary');
  const bounds = await target.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds?.width).toBeGreaterThanOrEqual(44);
  expect(bounds?.height).toBeGreaterThanOrEqual(44);
});
it('keeps wedding words, scene and one nonmodal talk sheet on a phone', async () => {
  await page.setViewportSize({ width: 360, height: 690 });
  await load(newGame(1));
  expect(await page.locator('.lk-stage').count()).toBe(1);
  await page.locator('[data-person]').first().click();
  await page.locator('.lk-stage[data-phase="talk"]').waitFor();
  await page.waitForFunction(() => /Held/.test(document.querySelector('.state-status')?.textContent ?? ''));
  expect(await page.locator('.lk-sheet:visible').count()).toBe(1);
  expect(await page.locator('dialog:modal').count()).toBe(0);
  const result = await page.evaluate(() => {
    const strip = document.querySelector('.lk-strip')!;
    const scene = document.querySelector('.lk-scene')!;
    return {
      words: strip.textContent,
      scene: scene.getBoundingClientRect().height,
      overflow: document.documentElement.scrollHeight > innerHeight,
      actions: [...document.querySelectorAll('[data-verb], .tell-preview')].map((el) => {
        const r = el.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= innerHeight;
      }),
    };
  });
  expect(result.words).toMatch(/Held|talking/i);
  expect(await page.locator('.wedding-button').innerText()).toContain('Honesty');
  expect(result.scene).toBeGreaterThan(35);
  expect(result.overflow).toBe(false);
  expect(result.actions.every(Boolean)).toBe(true);
});
it('docks the one sheet beside the map on desktop and reflows at narrow enlarged text', async () => {
  await page.setViewportSize({ width: 1000, height: 800 });
  await load(newGame(1));
  const boxes = await page.locator('.lk-scene, .lk-sheet').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right };
    }),
  );
  expect(boxes[0]!.top).toBe(boxes[1]!.top);
  expect(boxes[0]!.right).toBeLessThanOrEqual(boxes[1]!.left);
  await page.setViewportSize({ width: 320, height: 690 });
  await page.evaluate(() => (document.documentElement.style.fontSize = '34px'));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

it('shows waiting quick replies without scrolling the phone', async () => {
  await page.setViewportSize({ width: 360, height: 690 });
  const g = newGame(1);
  advance(g, 405);
  await load(g);
  const visible = await page.locator('.question, [data-quick]').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= innerHeight;
    }),
  );
  expect(visible.length).toBeGreaterThan(1);
  expect(visible.every(Boolean)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
});
it('keeps a long known duplicate reason and all verbs visible on its Tell button', async () => {
  await page.setViewportSize({ width: 360, height: 690 });
  const g = newGame(1);
  advance(g, 390);
  const { act } = await import('../src/sim/engine');
  expect(act(g, { type: 'tell-story', listener: 'fatma', incident: 1 })).toBe(true);
  await load(g);
  const dismiss = page.getByRole('button', { name: 'Keep it to yourself for now', exact: true });
  if (await dismiss.isVisible()) await dismiss.click();
  const fatma = page.locator('[data-person="fatma"]');
  if (!(await fatma.isVisible())) await page.locator('.other-neighbours > summary').click();
  await fatma.click();
  await page.locator('.lk-stage[data-phase="talk"]').waitFor();
  await page.waitForFunction(() => /Held/.test(document.querySelector('.state-status')?.textContent ?? ''));
  await page.locator('[data-tab="story"]').click();
  await page.locator('[data-story="1"]').click();
  expect(await page.locator('[data-verb="tell"] small').innerText()).toContain('Fatma');
  const bounds = await page.locator('.telling-limit,.tell-preview,[data-verb]').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= innerHeight;
    }),
  );
  expect(bounds.every(Boolean)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
});

it('keeps the pressed subject visible and every talk action within the phone', async () => {
  await page.setViewportSize({ width: 360, height: 690 });
  await load(newGame(1));
  await page.locator('[data-person]').first().click();
  await page.locator('.lk-stage[data-phase="talk"]').waitFor();
  await page.waitForFunction(() => /Held/.test(document.querySelector('.state-status')?.textContent ?? ''));
  expect(await page.locator('.talk-choices details').count()).toBe(0);
  const selected = page.locator('.subject-chips [aria-pressed="true"]');
  const selectedRect = await selected.boundingBox();
  expect(selectedRect && selectedRect.y >= 0 && selectedRect.y + selectedRect.height <= 690).toBe(true);
  const rects = await page
    .locator('[data-verb]')
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()));
  expect(rects.every((r) => r.width >= 44 && r.height >= 44 && r.y >= 0 && r.bottom <= 690)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
it('keeps the sentence and verbs visible on Day 6 with many optional stories', async () => {
  await page.setViewportSize({ width: 360, height: 690 });
  const g = newGame(1);
  advance(g, 5 * 1440 + 765);
  await load(g);
  await page.locator('[data-person]').first().click();
  await page.locator('.lk-stage[data-phase="talk"]').waitFor();
  await page.waitForFunction(() => /Held/.test(document.querySelector('.state-status')?.textContent ?? ''));
  expect(await page.locator('.talk-choices details').count()).toBe(0);
  await page.locator('[data-tab="story"]').click();
  expect(await page.locator('[data-story]').count()).toBeGreaterThan(5);
  const bounds = await page.locator('.tell-preview,[data-verb]').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= innerHeight;
    }),
  );
  expect(bounds.every(Boolean)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
});

it('keeps the promise doubt in the strip and keyboard focus through a clock render', async () => {
  await page.setViewportSize({ width: 360, height: 690 });
  await load(newGame(1));
  expect(await page.locator('.wedding-button').innerText()).toMatch(/word/i);
  await page.locator('[data-person]').first().click();
  await page.locator('.lk-stage[data-phase="talk"]').waitFor();
  await page.waitForFunction(() => /Held/.test(document.querySelector('.state-status')?.textContent ?? ''));
  await page.locator('[data-verb="ask"]').focus();
  for (let i = 0; i < 40; i++) await page.clock.runFor(500);
  expect(await page.locator('[data-verb="ask"]').evaluate((el) => el === document.activeElement)).toBe(true);
});

it('holds the clock while wedding details are open', async () => {
  await page.setViewportSize({ width: 360, height: 690 });
  const g = newGame(1);
  advance(g, 614);
  await load(g);
  await page.locator('[data-wedding-details]').click();
  const before = await page.locator('#clock').innerText();
  await page.clock.runFor(3000);
  expect(await page.locator('#clock').innerText()).toBe(before);
  expect(await page.locator('.doubt-chips button').count()).toBe(4);
  expect(
    await page
      .locator('.doubt-chips button')
      .evaluateAll((els) => els.every((el) => el.getBoundingClientRect().height >= 56)),
  ).toBe(true);
});

it('keeps the selected listener visible in the compact scene while choosing a story', async () => {
  await page.setViewportSize({ width: 360, height: 690 });
  await load(newGame(1));
  const person = page.locator('[data-person]').first();
  const id = await person.getAttribute('data-person');
  const label = await person.locator('strong').innerText();
  await person.click();
  await page.locator('.lk-stage[data-phase="talk"]').waitFor();
  await page.waitForFunction(() => /Held/.test(document.querySelector('.state-status')?.textContent ?? ''));
  await page.waitForFunction(
    (id) =>
      JSON.parse(document.querySelector<HTMLCanvasElement>('#map')?.dataset.mapLayout ?? '{}').selectedId ===
      id,
    id,
  );
  await page.waitForFunction(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('#map');
    const layout = JSON.parse(canvas?.dataset.mapLayout ?? '{}');
    return (
      canvas &&
      layout.labels?.every(
        (r: { y: number; height: number }) => r.y >= 0 && r.y + r.height <= canvas.clientHeight,
      )
    );
  });
  expect(await page.locator('#map').getAttribute('aria-label')).toContain(label);
  const scene = await page.locator('#map').evaluate((el) => {
    const layout = JSON.parse((el as HTMLCanvasElement).dataset.mapLayout ?? '{}');
    const selected = layout.people.find((p: { selected?: boolean }) => p.selected);
    return { height: el.clientHeight, selected, labels: layout.labels };
  });
  expect(scene.selected).toBeDefined();
  expect(scene.height).toBeGreaterThanOrEqual(60);
  expect(
    scene.labels.every((r: { y: number; height: number }) => r.y >= 0 && r.y + r.height <= scene.height),
  ).toBe(true);
});

it('keeps the wedding outcome readable while talking after the answer', async () => {
  await page.setViewportSize({ width: 360, height: 690 });
  const g = newGame(1);
  g.s.engagement = 'refused';
  for (const step of g.s.riza?.steps ?? []) step.status = 'missed';
  await load(g);
  await page.locator('[data-person]').first().click();
  await page.locator('.lk-stage[data-phase="talk"]').waitFor();
  await page.waitForFunction(() => /Held/.test(document.querySelector('.state-status')?.textContent ?? ''));
  expect(await page.locator('.wedding-button').innerText()).toContain('Rıza has refused');
  expect(await page.locator('.wedding-button').innerText()).not.toContain('Next:');
});
