import { type Browser, chromium, type Page } from 'playwright-core';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { newGame } from '../src/sim/engine';
import type { State } from '../src/sim/types';

let server: ViteDevServer;
let browser: Browser;
let page: Page;
beforeAll(async () => {
  server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
  await server.listen();
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 360, height: 690 } });
  await page.goto(server.resolvedUrls?.local[0] ?? '');
  await page.setContent('<canvas style="display:block;width:360px;height:60px"></canvas>');
});
afterAll(async () => {
  await browser?.close();
  await server?.close();
});
async function draw(state: State, selectedId?: string, height = 60) {
  return page.evaluate(
    async ({ state, selectedId, height }) => {
      const { drawMap, mapPersonAt } = await new Function('return import("/src/ui/map.ts")')();
      const canvas = document.querySelector('canvas');
      if (!canvas) throw new Error('Canvas fixture missing');
      canvas.style.height = `${height}px`;
      drawMap(canvas, state, 0, selectedId);
      const layout = JSON.parse(canvas.dataset.mapLayout ?? 'null');
      const bounds = canvas.getBoundingClientRect();
      return {
        ...layout,
        aria: canvas.getAttribute('aria-label'),
        hits: layout.people.map((p: { id: string; x: number; y: number; width: number; height: number }) => ({
          id: p.id,
          hit: mapPersonAt(canvas, bounds.left + p.x + p.width / 2, bounds.top + p.y + p.height / 2),
        })),
      };
    },
    { state, selectedId, height },
  );
}

it('shows a readable close-up at 360×60 with Hatice and the selected listener', async () => {
  const s = newGame(1).s;
  s.locations.cem = 'garden';
  const layout = await draw(s, 'cem');
  expect(layout.mode).toBe('close-up');
  expect(layout.people.map((p: { id: string }) => p.id)).toEqual(['hatice', 'cem']);
  expect(layout.labels.map((p: { text: string }) => p.text)).toEqual(
    expect.arrayContaining(['Hatice', 'Cem']),
  );
  expect(layout.aria).toContain('Cem');
  expect(layout.aria).toContain('Rıza’s friend');
  expect(layout.selectedId).toBe('cem');
  expect(layout.hits).toContainEqual({ id: 'cem', hit: 'cem' });
  expect(layout.hits).toContainEqual({ id: 'hatice', hit: undefined });
  for (const a of layout.labels) {
    expect(a.x).toBeGreaterThanOrEqual(0);
    expect(a.y).toBeGreaterThanOrEqual(0);
    expect(a.x + a.width).toBeLessThanOrEqual(360);
    expect(a.y + a.height).toBeLessThanOrEqual(60);
    for (const b of layout.labels) {
      if (a === b) continue;
      expect(a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y).toBe(
        false,
      );
    }
  }
  const changed = await draw(s, 'emre');
  expect(changed.selectedId).toBe('emre');
  expect(changed.people.map((p: { id: string }) => p.id)).toEqual(['hatice', 'emre']);
});

it('limits the close-up to nearby people and keeps absent people out of hit targets', async () => {
  const s = newGame(1).s;
  s.locations.cem = 'coffee';
  const layout = await draw(s, 'cem');
  expect(layout.people.length).toBeLessThanOrEqual(4);
  expect(layout.people.some((p: { id: string }) => p.id === 'cem')).toBe(false);
  expect(layout.people.every((p: { location: string }) => ['garden', 'fountain'].includes(p.location))).toBe(
    true,
  );
});

it('marks the selected person on the full village map', async () => {
  const s = newGame(1).s;
  const layout = await draw(s, 'riza', 300);
  expect(layout.mode).toBe('village');
  expect(layout.selectedId).toBe('riza');
  expect(layout.people.find((p: { id: string }) => p.id === 'riza').selected).toBe(true);
  expect(layout.aria).toContain('Rıza');
});

it('invalidates the drawing cache when only the selected listener changes', async () => {
  const state = newGame(1).s;
  state.locations.cem = 'garden';
  const result = await page.evaluate(async (state) => {
    const { drawMap } = await new Function('return import("/src/ui/map.ts")')();
    const canvas = document.querySelector('canvas');
    if (!canvas) throw new Error('Canvas fixture missing');
    canvas.style.height = '60px';
    drawMap(canvas, state, 0, 'cem');
    const before = canvas.dataset.mapLayout;
    drawMap(canvas, state, 0, 'emre');
    return {
      changed: canvas.dataset.mapLayout !== before,
      layout: JSON.parse(canvas.dataset.mapLayout ?? 'null'),
    };
  }, state);
  expect(result.changed).toBe(true);
  expect(result.layout.people.map((p: { id: string }) => p.id)).toEqual(['hatice', 'emre']);
});

it('crops the phone garden to the two places within hearing at 190px', async () => {
  const s = newGame(1).s;
  s.locations.cem = 'fountain';
  const layout = await draw(s, undefined, 190);
  expect(layout.mode).toBe('garden');
  expect(layout.labels.map((label: { id: string }) => label.id)).toEqual(
    expect.arrayContaining(['garden', 'fountain']),
  );
  expect(
    layout.people.every((person: { location: string }) => ['garden', 'fountain'].includes(person.location)),
  ).toBe(true);
  expect(layout.hits).toContainEqual({ id: 'cem', hit: 'cem' });
  for (const person of layout.people) {
    expect(person.x).toBeGreaterThanOrEqual(0);
    expect(person.y + person.height).toBeLessThanOrEqual(190);
  }
});
