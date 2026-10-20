/** Local browser acceptance checks against a built preview. No telemetry or run is sent. */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { fingerprint, replay } from '../src/sim/game.ts';

mkdirSync('scratch/acceptance', { recursive: true });
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 360, height: 690 },
    isMobile: true,
    hasTouch: true,
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.install();
  await page.goto(process.env.GAME_URL ?? 'http://127.0.0.1:4173/');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: 'Got it', exact: true }).click();
  await page.getByRole('button', { name: 'Trot', exact: true }).click();
  await page.clock.runFor(2450);
  assert.match(await page.locator('.clock').innerText(), /06:/);
  assert.match(await page.locator('.table-incident').innerText(), /old flour/);
  await page.locator('[data-person="fatma"]').click();
  await page.locator('[data-target="kemal"]').click();
  await page.locator('[data-trait="dishonest"]').click();
  assert.match(await page.locator('.defend-preview').innerText(), /Kemal tells the truth.*lie/);
  assert.ok(
    (
      await page
        .locator('.actions button')
        .evaluateAll((bs) => bs.map((b) => b.getBoundingClientRect().bottom))
    ).every((y) => y <= 690),
  );
  await page.getByRole('dialog').getByRole('button', { name: 'Tell', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  const bounds = await page
    .locator('.actions button')
    .evaluateAll((buttons) =>
      buttons.map((button) => ({ label: button.textContent, bottom: button.getBoundingClientRect().bottom })),
    );
  assert.equal(bounds.length, 3);
  assert.ok(
    bounds.every((b) => b.bottom <= 690),
    JSON.stringify(bounds),
  );
  await page.screenshot({ path: 'scratch/acceptance/phone.png', fullPage: true });
  const download = async (path: string) => {
    await page.locator('#game-menu').click();
    const [file] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download this run', exact: true }).click(),
    ]);
    await file.saveAs(path);
    await page.getByRole('button', { name: 'Close Game menu', exact: true }).click();
    return JSON.parse(readFileSync(path, 'utf8'));
  };
  const run = await download('scratch/acceptance/run.json');
  assert.equal(fingerprint(replay(run.seed, run.inputs, run.minute).s), run.fingerprint);
  await page.getByRole('link', { name: 'Hearsay', exact: true }).click();
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Import a run', exact: true }).click(),
  ]);
  await chooser.setFiles('scratch/acceptance/run.json');
  await page.locator('#game-menu').waitFor();
  const imported = await download('scratch/acceptance/imported.json');
  assert.equal(imported.fingerprint, run.fingerprint);
  // Leave after unsaved clock motion. pagehide must preserve that latest clock.
  await page.clock.runFor(1700);
  const clock = (await page.locator('.clock').innerText()).match(/\d{2}:\d{2}/)?.[0];
  await page.close();
  const resumed = await context.newPage();
  await resumed.clock.install();
  await resumed.goto(process.env.GAME_URL ?? 'http://127.0.0.1:4173/');
  await resumed.getByRole('button', { name: 'Resume', exact: true }).click();
  assert.equal((await resumed.locator('.clock').innerText()).match(/\d{2}:\d{2}/)?.[0], clock);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        phone: [360, 690],
        actions: bounds,
        exportReplay: true,
        importReplay: true,
        pagehideResume: true,
        consoleErrors: errors,
      },
      null,
      2,
    ),
  );
  await context.close();
} finally {
  await browser.close();
}
