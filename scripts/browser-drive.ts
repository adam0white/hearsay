/**
 * A playtest driver: the real game in a headless phone browser (360×690). The clock keeps moving while
 * the player reads and chooses. It shows only what the screen shows.
 *
 *   node scripts/browser-drive.ts serve <port> [url] [shots-dir]   start the browser (keeps running)
 *   node scripts/browser-drive.ts <port> look                      the screen as text, and a screenshot
 *   node scripts/browser-drive.ts <port> tap <n | button text>     press a button
 *   node scripts/browser-drive.ts <port> touch <x> <y>             one finger taps the picture at screen point x,y
 *   node scripts/browser-drive.ts <port> drag <x1> <y1> <x2> <y2>  one finger drags across the picture
 *   node scripts/browser-drive.ts <port> pan <dx> <dy>             two fingers move the page by dx,dy screen pixels
 *   node scripts/browser-drive.ts <port> zoom <in|out>             pinch
 *   node scripts/browser-drive.ts <port> wait <seconds>            let real play time pass at the current speed (max 600)
 *   node scripts/browser-drive.ts <port> export <file>             save the playtest export from Game menu
 *   node scripts/browser-drive.ts <port> quit                      close the browser
 */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import { chromium, type Page } from 'playwright-core';
import { act, advance, newGame, view } from '../src/sim/engine.ts';
import { verifyImport } from '../src/ui/export.ts';

const [a0, a1, a2, a3] = process.argv.slice(2);

if (a0 === 'verify-p3') {
  await verifyP3(a1 ?? 'http://127.0.0.1:4183/');
} else if (a0 === 'verify-p2') {
  await verifyP2(a1 ?? 'http://127.0.0.1:5173/');
} else if (a0 === 'verify-polish') {
  await verifyPolish(a1 ?? 'http://127.0.0.1:5173/');
} else if (a0 === 'serve') {
  const port = Number(a1);
  const url = a2 ?? 'http://127.0.0.1:5173/';
  const shots = a3 ?? join(process.cwd(), 'scratch', `shots-${port}`);
  mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 360, height: 690 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: false,
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  await page.clock.install({ time: Date.now() });
  await page.goto(url);
  await page.clock.runFor(1500);
  let shot = 0;
  const snap = () => look(page, join(shots, `${String(++shot).padStart(3, '0')}.png`));
  const run = async (cmd: string, args: string[]): Promise<string> => {
    const n = args.map(Number);
    if (cmd === 'look') return snap();
    if (cmd === 'reload') {
      await page.reload();
      await page.clock.runFor(1500);
      return snap();
    }
    if (cmd === 'state')
      return JSON.stringify(
        await page.evaluate(() => ({
          text: document.body.innerText,
          actions: [...document.querySelectorAll('.actions button')].map((b) => ({
            label: b.textContent,
            bottom: b.getBoundingClientRect().bottom,
          })),
          width: innerWidth,
          height: innerHeight,
        })),
      );

    if (cmd === 'tap') return (await tap(page, args.join(' '))) ?? snap();
    if (cmd === 'select') {
      await page.locator(args[0] ?? 'select').selectOption(args[1] ?? '');
      return snap();
    }
    if (cmd === 'touch') {
      await page.mouse.click(n[0] ?? 0, n[1] ?? 0);
      await page.clock.runFor(300);
      return snap();
    }
    if (cmd === 'drag') {
      const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = n;
      await page.mouse.move(x1, y1);
      await page.mouse.down();
      const steps = Math.max(4, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 6));
      for (let k = 1; k <= steps; k++)
        await page.mouse.move(x1 + ((x2 - x1) * k) / steps, y1 + ((y2 - y1) * k) / steps);
      await page.mouse.up();
      await page.clock.runFor(300);
      return snap();
    }
    if (cmd === 'pan') {
      const [dx = 0, dy = 0] = n;
      const box = await page.locator('#map').boundingBox();
      if (!box) return 'No picture on screen.';
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down({ button: 'right' });
      await page.mouse.move(x + dx, y + dy, { steps: 8 });
      await page.mouse.up({ button: 'right' });
      await page.clock.runFor(300);
      return snap();
    }
    if (cmd === 'zoom') {
      const box = await page.locator('#map').boundingBox();
      if (!box) return 'No picture on screen.';
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.keyboard.down('Control');
      await page.mouse.wheel(0, args[0] === 'in' ? -40 : 40);
      await page.keyboard.up('Control');
      await page.clock.runFor(300);
      return snap();
    }
    if (cmd === 'wait') {
      const s = Math.max(0, Math.min(600, n[0] || 0));
      for (let t = 0; t < s; t += 1) await page.clock.runFor(1000);
      return snap();
    }
    if (cmd === 'export') {
      if (!(await page.getByRole('button', { name: 'Download this run', exact: true }).isVisible())) {
        await page.getByRole('button', { name: 'Game menu', exact: true }).click();
      }
      const [dl] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Download this run', exact: true }).click(),
      ]);
      await dl.saveAs(args.join(' '));
      await page.getByRole('button', { name: 'Close Game menu', exact: true }).click();
      return `Saved ${dl.suggestedFilename()} to ${args.join(' ')}`;
    }
    if (cmd === 'import') {
      const [chooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.getByRole('button', { name: 'Import a run', exact: true }).click(),
      ]);
      await chooser.setFiles(args.join(' '));
      await page.clock.runFor(1000);
      return snap();
    }
    if (cmd === 'quit') {
      await browser.close();
      setTimeout(() => process.exit(0), 50);
      return 'closed';
    }
    return `Unknown command ${cmd}`;
  };
  let queue = Promise.resolve();
  createServer((req, res) => {
    let body = '';
    req.on('data', (c) => {
      body += c;
    });
    req.on('end', () => {
      const { cmd, args } = JSON.parse(body || '{}') as { cmd: string; args: string[] };
      queue = queue.then(async () => {
        try {
          res.end(await run(cmd, args ?? []));
        } catch (e) {
          res.end(`error: ${(e as Error).message}`);
        }
      });
    });
  }).listen(port, '127.0.0.1', () => console.log(`driving ${url} on ${port}`));
} else {
  const res = await fetch(`http://127.0.0.1:${a0}/`, {
    method: 'POST',
    body: JSON.stringify({
      cmd: a1,
      args: a1 === 'export' ? [resolve(process.argv.slice(4).join(' '))] : process.argv.slice(4),
    }),
  });
  console.log(await res.text());
}

async function look(page: Page, path: string): Promise<string> {
  await page.screenshot({ path });
  const text = await page.evaluate(() => {
    const out: string[] = [];
    const t = (sel: string) => (document.querySelector(sel) as HTMLElement | null)?.innerText.trim() ?? '';
    out.push(t('body'));
    const surface = document.querySelector('dialog[open]') ?? document;
    const buttons = [...surface.querySelectorAll<HTMLButtonElement>('button')].filter(
      (b) => b.offsetParent !== null,
    );
    out.push(
      `[buttons] ${buttons.map((b, i) => `${i + 1}. ${(b.getAttribute('aria-label') ?? b.innerText).replace(/\s+/g, ' ').trim()}${b.disabled ? ' (greyed)' : ''}`).join(' | ')}`,
    );
    return out.join('\n');
  });
  return `${text}\n[screenshot] ${path}`;
}

async function tap(page: Page, arg: string): Promise<string | null> {
  const found = await page.evaluate((arg) => {
    for (const b of document.querySelectorAll('[data-drive]')) b.removeAttribute('data-drive');
    const surface = document.querySelector('dialog[open]') ?? document;
    const all = [...surface.querySelectorAll<HTMLButtonElement>('button')].filter(
      (x) => x.offsetParent !== null,
    );
    const label = (x: HTMLButtonElement) =>
      (x.getAttribute('aria-label') ?? x.innerText).replace(/\s+/g, ' ').trim();
    const n = Number(arg);
    const b =
      Number.isInteger(n) && n > 0
        ? all[n - 1]
        : (all.find((x) => label(x).toLowerCase() === arg.toLowerCase()) ??
          all.find((x) => label(x).toLowerCase().startsWith(arg.toLowerCase())) ??
          all.find((x) => x.innerText.includes(arg)));
    if (!b) return null;
    b.setAttribute('data-drive', '1');
    return { disabled: b.disabled, explainable: b.hasAttribute('data-reason') };
  }, arg);
  if (!found) return `No button "${arg}".`;
  if (found.disabled) return 'That button is greyed out.';
  page.once('dialog', (d) => d.accept());
  await page.locator('[data-drive]').click({ force: found.explainable });
  await page.clock.runFor(400);
  return null;
}

/** Phone acceptance for the UI polish; run against the local Vite server. */
async function verifyPolish(url: string): Promise<void> {
  mkdirSync('scratch/ui-shots', { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 360, height: 780 }, acceptDownloads: true });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.clock.install({ time: new Date('2026-10-20T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-20T12:00:00Z'));
    await page.goto(url);
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    assert.equal(await page.locator('[data-speed="5"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.first-start p').count(), 5);
    const firstBounds = await page
      .locator('.actions button')
      .evaluateAll((buttons) => buttons.map((b) => b.getBoundingClientRect().bottom));
    assert.ok(
      firstBounds.every((y) => y <= 780),
      JSON.stringify(firstBounds),
    );
    assert.match(await page.locator('.clock').innerText(), /Day 1, Monday 06:00/);
    await page.screenshot({ path: 'scratch/ui-shots/01-first-start.png' });
    await page.getByRole('button', { name: 'Got it', exact: true }).click();
    assert.equal(await page.locator('select').count(), 0);
    await page.locator('[data-person="fatma"]').click();
    await page.locator('[data-target="emre"]').click();
    await page.locator('[data-trait="dishonest"]').focus();
    await page.keyboard.press('Enter');
    assert.equal(
      await page.evaluate(() => (document.activeElement as HTMLElement)?.dataset.trait),
      'dishonest',
    );
    await page.screenshot({ path: 'scratch/ui-shots/02-chooser.png' });
    await page.getByRole('button', { name: 'Someone else…', exact: true }).click();
    assert.equal(await page.locator('[data-target]').count(), 31);
    await page.getByRole('button', { name: 'Show today’s people', exact: true }).click();
    await page.locator('[data-trait="owes"]').click();
    assert.match(await page.locator('.defend-preview').innerText(), /Emre has no debt left to pay/);
    await page.locator('[data-trait="dishonest"]').click();
    assert.match(
      await page.locator('.tell-preview').innerText(),
      /Emre doesn’t always tell the truth.*It would be a lie/,
    );
    assert.match(await page.locator('.defend-preview').innerText(), /Emre tells the truth.*You believe it/);
    await page.getByRole('dialog').getByRole('button', { name: 'Tell', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.match(await page.locator('.reply').innerText(), /Fatma/);
    await page.screenshot({ path: 'scratch/ui-shots/02-answer.png' });
    await page.getByRole('button', { name: 'Game menu', exact: true }).click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download this run', exact: true }).click(),
    ]);
    assert.match(await page.locator('.download-status').innerText(), /Saved hearsay-day1.json/);
    await download.saveAs('scratch/ui-shots/run.json');
    verifyImport(readFileSync('scratch/ui-shots/run.json', 'utf8'));
    await page.getByRole('button', { name: 'Close Game menu', exact: true }).click();
    // A layout-only fixture: keep eleven neighbours nearby, without claiming this
    // altered location snapshot is a replayable simulation outcome.
    const fixture = newGame(1);
    fixture.s.newsWaiting = true;
    for (const id of view(fixture.s).present.slice(11)) fixture.s.locations[id] = 'home-0';
    assert.equal(view(fixture.s).present.length, 11);
    fixture.s.log.push({
      id: fixture.s.log.length + 1,
      at: 360,
      kind: 'echo',
      target: 'kemal',
      count: 7,
      who: ['ayse', 'can', 'emre', 'fatma', 'safiye'],
      text: 'Kemal is dishonest: heard again 7 times today; heard from Ayşe, Can, Emre, Fatma, Safiye.',
    });
    fixture.s.log.push({
      id: fixture.s.log.length + 1,
      at: 360,
      kind: 'overheard',
      target: 'kemal',
      text: 'A witnessed incident for the layout check.',
    });
    fixture.s.log.push({
      id: fixture.s.log.length + 1,
      at: 360,
      kind: 'conversation',
      speaker: 'fatma',
      target: 'kemal',
      text: 'Kemal is dishonest.',
    });
    fixture.s.routes.push({
      id: 1,
      at: 360,
      from: 'fatma',
      to: 'emre',
      target: 'kemal',
      trait: 'dishonest',
      value: true,
      origin: 'fatma',
      steps: 0,
      lie: false,
    });
    fixture.s.routes.push({
      id: 2,
      at: 360,
      from: 'riza',
      to: 'elif',
      target: 'kemal',
      trait: 'dishonest',
      value: true,
      origin: 'riza',
      steps: 0,
      lie: false,
    });
    writeFileSync('scratch/ui-shots/crowd.json', JSON.stringify(fixture));
    await page.goto('about:blank');
    await page.goto(url);
    await page.evaluate(async (fixture) => {
      const path = '/src/ui/store.ts';
      const store = await import(path);
      await store.putImmediate('run-ui', null);
      await store.putImmediate('run-log', null);
      await store.putImmediate('run', fixture);
    }, fixture);
    await page.reload();
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await page.locator('.people-chips').waitFor();
    assert.equal(await page.locator('[data-person]').count(), 11);
    await page.screenshot({ path: 'scratch/ui-shots/03-eleven-people.png' });
    const crowdBounds = await page
      .locator('.actions button')
      .evaluateAll((buttons) =>
        buttons.map((b) => ({ label: b.textContent, bottom: b.getBoundingClientRect().bottom })),
      );
    assert.equal(crowdBounds.length, 6);
    assert.ok(
      crowdBounds.every((b) => b.bottom <= 780),
      JSON.stringify(crowdBounds),
    );
    assert.match(await page.locator('.echo').innerText(), /heard again from Ayşe, Can and 3 others/);
    assert.equal(((await page.locator('.echo').innerText()).match(/heard again/g) ?? []).length, 1);
    assert.ok(!(await page.locator('.echo').innerText()).includes('Safiye'));
    assert.equal(await page.locator('.heard article.incident').count(), 1);
    const layout = await page
      .locator('#map')
      .evaluate((canvas) => JSON.parse((canvas as HTMLCanvasElement).dataset.mapLayout ?? '{}'));
    assert.equal(layout.witnessed.length, 1, 'Only the visible conversation draws a line');
    const originalAlpha = layout.witnessed[0].alpha;
    const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
      a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    for (const label of layout.labels) {
      assert.ok(
        !layout.people.some((p: typeof label) => overlaps(label, p)),
        `Label covers person: ${label.text}`,
      );
      assert.ok(
        !layout.labels.some((p: typeof label) => p !== label && overlaps(label, p)),
        `Labels overlap: ${label.text}`,
      );
    }
    const passer = layout.people.find((p: { location: string }) => p.location === 'fountain');
    const mapBounds = await page.locator('#map').boundingBox();
    assert.ok(passer && mapBounds);
    await page.mouse.click(
      mapBounds.x + passer.x + passer.width / 2,
      mapBounds.y + passer.y + passer.height / 2,
    );
    const caller = page.getByRole('dialog').getByRole('button', { name: /^Call over / });
    assert.equal(await caller.count(), 1);
    const expectedPerson = view(fixture.s).people.find((p) => p.id === passer.id)?.name;
    assert.equal(await caller.innerText(), `Call over ${expectedPerson}`);
    await caller.click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.match(await page.locator('.reply').innerText(), /moment|What is it/);
    assert.equal(await page.locator('[data-speed="1"]').getAttribute('aria-pressed'), 'true');
    assert.match(await page.locator('.slow-reason').innerText(), /arrived/);
    await page.getByRole('button', { name: 'Hold your tongue', exact: true }).click();
    await page.locator('.reply').filter({ hasText: 'Nothing I need to pass on' }).waitFor();
    await page.clock.runFor(1200);
    const faded = await page
      .locator('#map')
      .evaluate((c) => JSON.parse((c as HTMLCanvasElement).dataset.mapLayout ?? '{}').witnessed);
    assert.ok(
      faded.some((w: { id: number; alpha: number }) => w.id === 1 && w.alpha < originalAlpha),
      'Witness line survives render and fades',
    );
    await page.locator('[data-person="fatma"]').click();
    await page.locator('[data-target="emre"]').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Ask', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.match(await page.locator('.reply').innerText(), /Fatma/);
    await page.locator('[data-person="fatma"]').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Make amends', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.match(await page.locator('.reply').innerText(), /Fatma/);
    await page.locator('[data-person="fatma"]').click();
    await page.locator('[data-target="emre"]').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Defend', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.match(await page.locator('.reply').innerText(), /Fatma/);
    await page.locator('[data-speed="80"]').click();
    await page.clock.runFor(2500);
    assert.equal(await page.locator('[data-speed="1"]').getAttribute('aria-pressed'), 'true');
    assert.match(await page.locator('.slow-reason').innerText(), /waiting|arrived|overheard/);
    if (await page.getByRole('button', { name: 'Hold your tongue', exact: true }).isEnabled()) {
      await page.getByRole('button', { name: 'Hold your tongue', exact: true }).click();
      assert.match(await page.locator('.reply').innerText(), /Hatice|Nothing/);
    }
    await page.screenshot({ path: 'scratch/ui-shots/04-slowed.png' });
    assert.deepEqual(errors, []);
    const bounds = await page
      .locator('.actions button')
      .evaluateAll((buttons) =>
        buttons.map((b) => ({ label: b.textContent, bottom: b.getBoundingClientRect().bottom })),
      );
    assert.ok(
      bounds.every((b) => b.bottom <= 780),
      JSON.stringify(bounds),
    );
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    writeFileSync(
      'scratch/ui-shots/acceptance.json',
      JSON.stringify({ phone: [360, 780], crowd: 11, crowdBounds, bounds, errors }, null, 2),
    );
    console.log('UI polish phone acceptance passed. Evidence: scratch/ui-shots/');
  } finally {
    await browser.close();
  }
}

/** Round 2: the actual seeded opening, with a phone crowd and live slowdown. */
async function verifyP2(url: string): Promise<void> {
  const shots = 'scratch/ui-shots-p2';
  mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 360, height: 780 }, acceptDownloads: true });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.clock.install({ time: new Date('2026-10-20T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-20T12:00:00Z'));
    await page.goto(url);
    const fixture = newGame(1);
    advance(fixture, 389);
    await page.evaluate(async (fixture) => {
      const path = '/src/ui/store.ts';
      const store = await import(path);
      await store.putImmediate('run-ui', null);
      await store.putImmediate('run-log', null);
      await store.putImmediate('run', fixture);
    }, fixture);
    await page.reload();
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await page.getByRole('button', { name: 'Gallop', exact: true }).click();
    await page.clock.runFor(250);
    const card = page.locator('.table-incident');
    await card.waitFor();
    assert.equal(await page.locator('[data-speed="1"]').getAttribute('aria-pressed'), 'true');
    assert.match(await page.locator('.slow-reason').innerText(), /overheard.*Slow/i);
    assert.match(await card.innerText(), /Kemal.*old flour/);
    assert.ok(!(await card.innerText()).includes('would care'));
    const crowd = await page.locator('[data-person]').count();
    assert.ok(crowd >= 11, `Crowd: ${crowd}`);
    const cardBox = await card.boundingBox();
    const headingBox = await page.locator('.section-heading').boundingBox();
    const chipsBox = await page.locator('.people-chips').boundingBox();
    assert.ok(cardBox && headingBox && chipsBox);
    assert.ok(cardBox.y >= headingBox.y + headingBox.height && cardBox.y + cardBox.height <= chipsBox.y);
    assert.ok(cardBox.y + cardBox.height <= 780);
    assert.equal(await page.locator('.would-want').count(), 0, 'Absent listeners are not marked');
    const bounds = await page
      .locator('.actions button')
      .evaluateAll((buttons) =>
        buttons.map((b) => ({ label: b.textContent, bottom: b.getBoundingClientRect().bottom })),
      );
    assert.ok(
      bounds.every((b) => b.bottom <= 780),
      JSON.stringify(bounds),
    );
    await page.screenshot({ path: `${shots}/01-incident-crowd.png` });
    await page.getByRole('button', { name: 'Game menu', exact: true }).click();
    assert.equal(await page.getByRole('heading', { name: 'Game menu', exact: true }).count(), 1);
    assert.equal(await page.getByText('What you heard', { exact: true }).count(), 1);
    for (const label of ['Download this run', 'Import a run', 'Send this run to the notebook'])
      assert.equal(await page.getByRole('button', { name: label, exact: true }).count(), 1);
    await page.screenshot({ path: `${shots}/02-game-menu.png` });
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download this run', exact: true }).click(),
    ]);
    await download.saveAs(`${shots}/run.json`);
    verifyImport(readFileSync(`${shots}/run.json`, 'utf8'));
    await page.getByRole('button', { name: 'Close Game menu', exact: true }).click();
    // A layout fixture adds the interested listener to the real 13-person scene.
    await page.goto('about:blank');
    await page.goto(url);
    const withListener = newGame(1);
    advance(withListener, 390);
    withListener.s.locations.aylin = 'garden';
    await page.evaluate(async (fixture) => {
      const path = '/src/ui/store.ts';
      const store = await import(path);
      await store.putImmediate('run-ui', null);
      await store.putImmediate('run-log', null);
      await store.putImmediate('run', fixture);
    }, withListener);
    await page.reload();
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await page.locator('[data-person="aylin"] .would-want').waitFor();
    assert.equal(await page.locator('[data-person="aylin"] .would-want').count(), 1);
    assert.equal(await page.locator('.would-want').count(), 1);
    const listenerBounds = await page
      .locator('.actions button')
      .evaluateAll((buttons) => buttons.map((b) => b.getBoundingClientRect().bottom));
    assert.ok(
      listenerBounds.every((bottom) => bottom <= 780),
      JSON.stringify(listenerBounds),
    );
    await page.screenshot({ path: `${shots}/03-listener-present.png` });
    await page.locator('[data-person="aylin"]').click();
    assert.equal(await card.count(), 0, 'A person tap dismisses the incident');
    assert.equal(await page.locator('.would-want').count(), 0);
    await page.getByRole('button', { name: 'Close Talk to Aylin', exact: true }).click();
    await page.screenshot({ path: `${shots}/04-after-person-tap.png` });
    await page.getByRole('link', { name: 'Hearsay', exact: true }).click();
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await page.locator('.people-chips').waitFor();
    assert.equal(await card.count(), 0, 'Dismissal survives title and resume');
    await page.reload();
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await page.locator('.people-chips').waitFor();
    assert.equal(await card.count(), 0, 'Dismissal survives reload');
    // A waiting question keeps Slow until answered, then restores the prior pace.
    await page.goto('about:blank');
    await page.goto(url);
    const waiting = newGame(1);
    advance(waiting, 405);
    await page.evaluate(async (fixture) => {
      const path = '/src/ui/store.ts';
      const store = await import(path);
      await store.putImmediate('run-ui', null);
      await store.putImmediate('run-log', null);
      await store.putImmediate('run', fixture);
    }, waiting);
    await page.reload();
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await page.locator('[data-person="aylin"]').click();
    assert.equal(await page.locator('[data-speed="1"]').getAttribute('aria-pressed'), 'true');
    await page.getByRole('dialog').getByRole('button', { name: 'Tell', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('[data-speed="5"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.slow-reason').count(), 0);
    // Resume the incident just before its two-hour boundary to test expiry.
    await page.goto('about:blank');
    await page.goto(url);
    const expiring = newGame(1);
    advance(expiring, 509);
    expiring.s.newsWaiting = false;
    await page.evaluate(async (fixture) => {
      const path = '/src/ui/store.ts';
      const store = await import(path);
      await store.putImmediate('run-ui', null);
      await store.putImmediate('run-log', null);
      await store.putImmediate('run', fixture);
    }, expiring);
    await page.reload();
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await card.waitFor();
    assert.equal(await card.count(), 1);
    await page.clock.runFor(1200);
    assert.equal(await card.count(), 0, 'Incident expires after two game hours');
    await page.screenshot({ path: `${shots}/05-after-two-hours.png` });
    assert.deepEqual(errors, []);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    writeFileSync(
      `${shots}/acceptance.json`,
      JSON.stringify({ viewport: [360, 780], seed: 1, crowd, cardBox, bounds, errors }, null, 2),
    );
    console.log(`Round 2 phone acceptance passed. Evidence: ${shots}/`);
  } finally {
    await browser.close();
  }
}

/** Round 3: response, marriage and verbs must share the smallest phone viewport. */
async function verifyP3(url: string): Promise<void> {
  const shots = 'scratch/ui-shots-p3';
  mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 360, height: 690 } });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    const load = async (fixture: ReturnType<typeof newGame>) => {
      await page.goto(url);
      await page.locator('.title-page').waitFor();
      await page.evaluate(async (fixture) => {
        const path = '/src/ui/store.ts';
        const store = await import(path);
        await store.putImmediate('run-ui', null);
        await store.putImmediate('run-log', null);
        await store.putImmediate('run', fixture);
      }, fixture);
      await page.reload();
      await page.getByRole('button', { name: 'Resume', exact: true }).click();
      await page.locator('.riza-mind').waitFor();
    };
    await page.goto(url);
    const fixture = newGame(1);
    advance(fixture, 390);
    // Keep exactly thirteen people, including the person deciding the marriage.
    fixture.s.locations.meryem = 'home:11';
    fixture.s.locations.riza = 'garden';
    await page.evaluate(async (fixture) => {
      const path = '/src/ui/store.ts';
      const store = await import(path);
      await store.putImmediate('run-ui', null);
      await store.putImmediate('run-log', null);
      await store.putImmediate('run', fixture);
    }, fixture);
    await page.reload();
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await page.locator('[data-person]').first().waitFor();
    assert.equal(await page.locator('[data-person]').count(), 13);
    assert.match(await page.locator('.riza-mind').innerText(), /Rıza leans.*Day 13, Saturday/s);
    await page.locator('[data-person="riza"]').click();
    await page.locator('[data-target="emre"]').click();
    assert.equal(await page.locator('[data-trait="dishonest"]').getAttribute('aria-pressed'), 'false');
    await page.getByRole('dialog').getByRole('button', { name: 'Ask', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.locator('.reply').waitFor();
    assert.match(await page.locator('.reply').innerText(), /Rıza:.*(Believes|Doubts|believe|hear)/s);
    assert.doesNotMatch(await page.locator('.reply').innerText(), /moved on/);
    assert.equal(await page.locator('.actions button').count(), 6);
    const bounds = await page.locator('.reply, .riza-mind, .actions button').evaluateAll((elements) =>
      elements.map((el) => ({
        text: el.textContent,
        top: el.getBoundingClientRect().top,
        bottom: el.getBoundingClientRect().bottom,
      })),
    );
    assert.ok(
      bounds.every((b) => b.top >= 0 && b.bottom <= 690),
      JSON.stringify(bounds),
    );
    await page.screenshot({ path: `${shots}/01-answer-crowd.png` });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const firstReply = await page.locator('.reply').innerText();
    await page.locator('[data-person="emre"]').click();
    await page.getByRole('button', { name: 'Close Talk to Emre', exact: true }).click();
    assert.equal(await page.locator('.reply').innerText(), firstReply, 'Inspection keeps the last answer');
    await page.getByRole('button', { name: 'Hold your tongue', exact: true }).click({ force: true });
    assert.equal(await page.locator('.verb-reason').innerText(), 'No one has asked you anything.');
    assert.equal(
      await page.locator('.reply').innerText(),
      firstReply,
      'A disabled tap does not replace the answer',
    );

    const basket = newGame(1);
    advance(basket, 765);
    await load(basket);
    await page.locator('[data-person="riza"]').click();
    await page.locator('[data-story="15"]').click();
    const exactStory = 'Kemal carried Safiye’s heavy basket up the hill and stopped to help her.';
    assert.equal(await page.locator('.tell-preview').innerText(), `You'll say: “${exactStory}”`);
    await page.screenshot({ path: `${shots}/02-basket-preview.png` });
    await page.getByRole('dialog').getByRole('button', { name: 'Tell', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.locator('.reply').waitFor();
    assert.doesNotMatch(await page.locator('.reply').innerText(), /moved on/);
    assert.ok(act(basket, { type: 'tell-story', listener: 'riza', incident: 15 }));
    assert.ok(
      basket.s.log.some((line) => line.speaker === 'hatice' && line.text.includes(`“${exactStory}”`)),
    );
    verifyImport(JSON.stringify((await import('../src/ui/export.ts')).exportRun(basket)));

    const leaning = newGame(1);
    advance(leaning, 720);
    await load(leaning);
    for (const word of ['reliable', 'honest']) {
      await page.locator('[data-person="riza"]').click();
      await page.locator('[data-target="emre"]').click();
      await page.locator(`[data-trait="${word}"]`).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Tell', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
    }
    assert.match(await page.locator('.riza-mind').innerText(), /Rıza leans warm/);
    assert.equal(await page.locator('.lean-changed').count(), 1);
    assert.equal(await page.locator('[data-speed="1"]').getAttribute('aria-pressed'), 'true');
    assert.match(await page.locator('.slow-reason').innerText(), /Rıza.*changed.*Slow/);
    await page.screenshot({ path: `${shots}/07-lean-changed.png` });
    await page.clock.runFor(3100);
    assert.equal(await page.locator('.lean-changed').count(), 0, 'The highlight is brief');

    const departing = newGame(1);
    advance(departing, 479);
    departing.s.newsWaiting = false;
    departing.s.locations.aylin = 'garden';
    await load(departing);
    await page.getByRole('button', { name: 'Slow', exact: true }).click();
    await page.locator('[data-person="aylin"]').click();
    await page.clock.runFor(1200);
    await page
      .getByRole('dialog')
      .getByText(/Aylin has gone toward/)
      .waitFor();
    await page.screenshot({ path: `${shots}/03-departure.png` });
    await page.clock.runFor(2300);
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.match(await page.locator('.reply').innerText(), /Aylin has gone toward/);
    assert.equal(await page.locator('[data-person="aylin"]').count(), 0);
    assert.equal(await page.locator('.question').count(), 0);

    const quiet = newGame(1);
    advance(quiet, 659);
    quiet.s.newsWaiting = false;
    await load(quiet);
    assert.match(
      await page.locator('.slow-reason').innerText(),
      /The garden is quiet. Time hurries until someone comes./,
    );
    assert.equal(await page.locator('[data-speed="20"]').getAttribute('aria-pressed'), 'true');
    await page.getByRole('button', { name: 'Gallop', exact: true }).click();
    assert.equal(await page.locator('[data-speed="80"]').getAttribute('aria-pressed'), 'true');
    await page.getByRole('button', { name: 'Walk', exact: true }).click();
    await page.screenshot({ path: `${shots}/04-quiet.png` });
    await page.clock.runFor(150);
    await page.locator('[data-person]').first().waitFor();
    assert.equal(
      await page.locator('[data-speed="5"]').getAttribute('aria-pressed'),
      'true',
      'Arrival restores the chosen pace',
    );

    const evening = newGame(1);
    advance(evening, 1379);
    await load(evening);
    await page.getByRole('button', { name: 'Gallop', exact: true }).click();
    await page.clock.runFor(100);
    await page.locator('[data-day-card]').waitFor();
    assert.equal(await page.locator('#clock').innerText(), 'Day 1, Monday 23:00');
    const expectedDay = structuredClone(evening);
    advance(expectedDay, 1380);
    for (const summary of expectedDay.s.days?.at(-1)?.summary ?? [])
      assert.equal(await page.locator('[data-day-card]').getByText(summary, { exact: true }).count(), 1);
    await page.screenshot({ path: `${shots}/05-day-card.png` });
    await page.clock.runFor(1000);
    assert.equal(
      await page.locator('#clock').innerText(),
      'Day 1, Monday 23:00',
      'Day card holds the boundary',
    );
    await page.getByRole('button', { name: 'Sleep', exact: true }).evaluate((b) => {
      (b as HTMLButtonElement).click();
      (b as HTMLButtonElement).click();
    });
    await page.locator('[data-day-card]').waitFor({ state: 'hidden' });
    assert.match(await page.locator('#clock').innerText(), /^Day 2, Tuesday 06:00$/);

    const oldSave = newGame(1);
    delete oldSave.s.riza;
    delete oldSave.s.stories;
    delete oldSave.s.days;
    await load(oldSave);
    assert.match(await page.locator('.riza-mind').innerText(), /Rıza leans unsure/);
    await page.locator('[data-person]').first().click();
    assert.equal(await page.locator('.story-chips').count(), 0);
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /^Close / })
      .click();
    await page.setViewportSize({ width: 320, height: 690 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '34px';
    });
    await page.screenshot({ path: `${shots}/06-320-text-reflow.png` });
    const overflow = await page.locator('body *').evaluateAll((elements) =>
      elements
        .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
        .map((el) => ({
          tag: el.tagName,
          class: el.className,
          right: el.getBoundingClientRect().right,
          text: el.textContent?.slice(0, 60),
        }))
        .slice(0, 20),
    );
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      JSON.stringify(overflow),
    );
    assert.deepEqual(errors, []);
    writeFileSync(
      `${shots}/acceptance.json`,
      JSON.stringify({ viewport: [360, 690], seed: 1, bounds, errors }, null, 2),
    );
    console.log(`Round 3 phone acceptance passed. Evidence: ${shots}/`);
  } finally {
    await browser.close();
  }
}
