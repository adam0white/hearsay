/** Bounded engineering control of the shipped garden bundle, not a player or shared-history journey. */
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium, type Page, webkit } from 'playwright-core';
import { preview } from 'vite';
import { advanceGarden, chooseGarden, freshGarden } from '../src/sim/garden4.ts';
import { exportGarden, importGarden } from '../src/sim/garden4-export.ts';

const fixture = freshGarden(17);
assert(chooseGarden(fixture, { type: 'listen', person: 'riza', approach: 'invite' }));
advanceGarden(fixture, 376);
assert(fixture.discoveries.riza?.fact.includes('doorway'));
const native = exportGarden(fixture);
const cold = importGarden(JSON.stringify(native));
assert.deepEqual(exportGarden(cold), native);
for (let minute = 377; minute <= 406; minute++) {
  advanceGarden(fixture, minute);
  advanceGarden(cold, minute);
}
assert.deepEqual(exportGarden(cold), exportGarden(fixture));
const foreign = exportGarden(freshGarden(202));
const rows: unknown[] = [];
const server = await preview({ preview: { host: '127.0.0.1', port: 0, strictPort: false } });
const origin = server.resolvedUrls?.local[0];
assert(origin);
async function readNative(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('hearsay', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const rows = await new Promise<{ plain?: string; blob?: Blob; at: number }[]>((resolve, reject) => {
        const request = db.transaction('pages').objectStore('pages').getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return Promise.all(
        rows.map(async (row) => ({
          at: row.at,
          text:
            row.plain ??
            (await new Response(row.blob!.stream().pipeThrough(new DecompressionStream('gzip'))).text()),
        })),
      );
    } finally {
      db.close();
    }
  });
}
try {
  for (const [engine, launcher] of [
    ['chromium', chromium],
    ['webkit', webkit],
  ] as const) {
    const browser = await launcher.launch();
    try {
      for (const viewport of [
        { width: 360, height: 690 },
        { width: 820, height: 1180 },
        { width: 1180, height: 820 },
        { width: 1280, height: 800 },
      ]) {
        const context = await browser.newContext({ viewport, acceptDownloads: true });
        try {
          const page = await context.newPage();
          const errors: string[] = [];
          const externalWrites: string[] = [];
          page.on('pageerror', (error) => errors.push(error.message));
          page.on('request', (request) => {
            if (request.method() !== 'GET' && new URL(request.url()).origin !== new URL(origin).origin)
              externalWrites.push(request.url());
          });
          await page.route('**/__control_setup', (route) =>
            route.fulfill({ contentType: 'text/html', body: '<title>Control setup</title>' }),
          );
          await page.goto(`${origin}__control_setup`);
          await page.evaluate(
            async (text: string) => {
              localStorage.setItem('hf-telemetry-off', '1');
              const db = await new Promise<IDBDatabase>((resolve, reject) => {
                const request = indexedDB.open('hearsay', 1);
                request.onupgradeneeded = () => request.result.createObjectStore('pages');
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
              });
              await new Promise<void>((resolve, reject) => {
                const tx = db.transaction('pages', 'readwrite');
                tx.objectStore('pages').put({ plain: text, at: 123 }, 'garden-hf4-1');
                tx.objectStore('pages').put({ plain: '{"sentinel":"keep"}', at: 456 }, 'unrelated-control');
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
              });
              db.close();
            },
            JSON.stringify({
              export: native,
              fileOrigin: false,
              fileKey: null,
              ownedHeads: {},
              archives: [],
            }),
          );
          await page.clock.install();
          await page.clock.pauseAt(new Date());
          await page.goto(origin);
          await page.locator('.cg-game').waitFor();
          assert.equal(await page.locator('[data-person]').count(), 8);
          assert((await page.locator('.cg-header').textContent())?.includes('Pace: Automatic.'));
          await page.getByRole('button', { name: 'Slow', exact: true }).click();
          const clock = () => page.locator('.cg-header > div > span').textContent();
          const before = await clock();
          await page.clock.runFor(2000);
          assert.notEqual(await clock(), before, 'ordinary garden must advance');
          await page.getByRole('button', { name: 'Game menu', exact: true }).first().click();
          const held = await clock();
          await page.getByRole('button', { name: 'Feedback', exact: true }).click();
          await page.getByRole('dialog', { name: 'Feedback', exact: true }).waitFor();
          await page.getByRole('button', { name: "I'm confused", exact: true }).click();
          await page.clock.runFor(12000);
          assert.equal(await clock(), held, 'feedback must hold the garden clock');
          assert.equal(await page.locator('.hflab-veil').count(), 1);
          await page.keyboard.press('Escape');
          assert.equal(await page.locator('.hflab-veil').count(), 0);
          await page.clock.runFor(2000);
          assert.equal(await clock(), held, 'closing feedback leaves the menu paused');
          await page.getByRole('button', { name: 'Resume', exact: true }).click();
          await page.clock.runFor(2000);
          assert.notEqual(await clock(), held, 'Resume restores stepping');
          await page.getByRole('button', { name: 'Pause', exact: true }).click();
          await page.getByRole('button', { name: 'Keep this private', exact: true }).click();
          await page.getByRole('button', { name: 'Game menu', exact: true }).first().click();
          // A real public download verifies the production save, complete HF archive and ordered inputs.
          async function download(name: string) {
            const pending = page.waitForEvent('download');
            await page.getByRole('button', { name, exact: true }).click();
            const stream = await (await pending).createReadStream();
            const chunks: Buffer[] = [];
            for await (const chunk of stream) chunks.push(Buffer.from(chunk));
            return JSON.parse(Buffer.concat(chunks).toString());
          }
          await page.getByRole('button', { name: 'Use automatic pace', exact: true }).click();
          await page.clock.runFor(16000);
          await page.getByRole('button', { name: 'Resume', exact: true }).click();
          await page.getByRole('button', { name: 'Fast', exact: true }).click();
          const minute = async () => {
            const text = await clock();
            const match = text?.match(/(\d{1,2}):(\d{2})/);
            assert(match, `Missing displayed time: ${text}`);
            return Number(match[1]) * 60 + Number(match[2]);
          };
          await page.locator('.cg-account > summary').click();
          // Resume starts a short reading interval. Age it while the open record itself keeps Slow.
          await page.clock.runFor(16000);
          const readingStart = await minute();
          await page.clock.runFor(2000);
          const readingEnd = await minute();
          assert(
            readingEnd > readingStart && readingEnd - readingStart <= 3,
            'reading must slow without pausing',
          );
          await page.locator('.cg-account > summary').click();
          await page.clock.runFor(2000);
          assert((await minute()) - readingEnd > 10, 'closing the record restores the chosen Fast pace');
          await page.getByRole('button', { name: 'Pause', exact: true }).click();
          await page.getByRole('button', { name: 'Game menu', exact: true }).first().click();
          const saved = await download('Download this run');
          assert.deepEqual(exportGarden(importGarden(JSON.stringify(saved))), saved);
          await page.reload();
          await page.locator('.cg-game').waitFor();
          await page.getByRole('button', { name: 'Pause', exact: true }).click();
          await page.getByRole('button', { name: 'Game menu', exact: true }).first().click();
          assert.deepEqual(await download('Download this run'), saved, 'cold native restore must be exact');
          await page.getByText('Other ways to begin', { exact: true }).click();
          await page.getByRole('button', { name: 'Open a game file', exact: true }).click();
          await page.locator('#import-run').waitFor();
          const nativeBefore = await readNative(page);
          await page.locator('#import-run').setInputFiles({
            name: 'garden.json',
            mimeType: 'application/json',
            buffer: Buffer.from(JSON.stringify(foreign)),
          });
          await page.locator('.cg-game').waitFor();
          await page.getByRole('button', { name: 'Pause', exact: true }).click();
          await page.getByRole('button', { name: 'Pour tea without sharing news', exact: true }).click();
          await page.getByRole('button', { name: 'Slow', exact: true }).click();
          await page.clock.runFor(6000);
          await page.getByRole('button', { name: 'Game menu', exact: true }).first().click();
          const file = await download('Download this game file');
          assert(file.minute > foreign.minute);
          assert(file.inputs.some((row: { input: { type: string } }) => row.input.type === 'silence'));
          assert.deepEqual(exportGarden(importGarden(JSON.stringify(file))), file);
          assert.deepEqual(await readNative(page), nativeBefore, 'file play must retain every native row');
          await page.getByRole('button', { name: 'Close file session', exact: true }).click();
          await page.locator('.cg-game').waitFor();
          await page.getByRole('button', { name: 'Pause', exact: true }).click();
          assert(await page.locator('.cg-header').textContent());
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          assert.deepEqual(errors, []);
          assert.deepEqual(externalWrites, []);
          rows.push({
            engine,
            viewport,
            feedback: 'open/hold/Escape/menu hold/Resume',
            nativeReplay: saved.fingerprint,
            fileReplay: file.fingerprint,
            fileMinute: file.minute,
            nativePreserved: true,
            errors,
            externalWrites,
          });
          console.info('PASS', engine, viewport.width, viewport.height);
        } finally {
          await context.close();
        }
      }
    } finally {
      await browser.close();
    }
  }
  if (process.env.HEARSAY_CONTROL_EVIDENCE)
    await writeFile(
      process.env.HEARSAY_CONTROL_EVIDENCE,
      JSON.stringify(
        { at: new Date().toISOString(), bounded: { from: 360, coldAt: 376, continuedThrough: 406 }, rows },
        null,
        2,
      ),
    );
} finally {
  await server.close();
}
