import { believe } from '@adam0white/human-framework';
import { type Browser, chromium, type Page } from 'playwright-core';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { act, advance, newGame, view } from '../src/sim/engine';
import type { Game, LoggedInput } from '../src/sim/types';
import { exportRun, verifyImport } from '../src/ui/export';

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
  await page.goto(server.resolvedUrls?.local[0] ?? '');
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
  await page.locator('.riza-mind').waitFor();
}
async function journalInputs(): Promise<LoggedInput[]> {
  return await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('hearsay', 1);
      request.onsuccess = () => resolve(request.result);
    });
    return await new Promise<LoggedInput[]>((resolve) => {
      const request = db.transaction('pages').objectStore('pages').get('run-log');
      request.onsuccess = () => {
        db.close();
        resolve(JSON.parse(request.result.plain).inputs);
      };
    });
  });
}
async function onScreen(selector: string) {
  const boxes = await page.locator(selector).evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, height: r.height };
    }),
  );
  expect(boxes.length).toBeGreaterThan(0);
  expect(boxes.every((r) => r.top >= 0 && r.bottom <= 690)).toBe(true);
  return boxes;
}
it('puts a pending scene first and keeps all its spoken choices on the phone at Slow', async () => {
  const g = newGame(1);
  g.s.scene = {
    id: 'phone-scene',
    kind: 'confrontation',
    who: ['riza', 'cem'],
    text: 'Rıza: A false story from you reached our house. Cem: Will you take it back?',
    choices: [
      {
        id: 'admit',
        label: 'Take it back',
        says: 'I made it up. I will tell Cem and Osman.',
        risk: 'Cem will hear you take it back',
      },
      { id: 'wait', label: 'Ask for time', says: 'Let me speak to them tomorrow.', risk: 'Rıza may cool' },
      { id: 'insist', label: 'Stand by it', says: 'I stand by what I said.', risk: 'Rıza may cool' },
    ],
    since: 360,
    until: 480,
    fallback: 'wait',
  };
  await load(g);
  expect(await page.locator('.garden > :first-child').getAttribute('data-scene')).toBe('phone-scene');
  await page.getByRole('button', { name: 'Gallop', exact: true }).click();
  expect(await page.locator('[data-speed="1"]').getAttribute('aria-pressed')).toBe('true');
  expect(await page.locator('[data-speed="80"]').getAttribute('data-chosen')).toBe('true');
  await onScreen('[data-scene], [data-choice]');
  expect((await onScreen('[data-choice]')).every((r) => r.height >= 44)).toBe(true);
});
it('shows concrete quick replies immediately after the waiting question and sends the reply', async () => {
  const g = newGame(1);
  advance(g, 405);
  await load(g);
  expect(await page.locator('.question + .quick-replies').count()).toBe(1);
  await onScreen('.question, .quick-replies button');
  const says = await page.locator('.quick-replies button small').first().innerText();
  await page.locator('[data-quick]').first().click();
  await page.locator('.reply').waitFor();
  expect(await page.locator('.reply').innerText()).not.toContain('moved on');
  expect(says.length).toBeGreaterThan(0);
  expect((await journalInputs()).at(-1)?.input).toEqual(view(g.s).quick!.options[0]!.input);
  expect(await page.getByRole('dialog').count()).toBe(0);
});
it('shows Your word repair and only the two newest known message threads', async () => {
  const g = newGame(1);
  g.s.locations.kemal = 'garden';
  g.s.riza!.word = {
    status: 'mending',
    words: 'I need to hear you put it right.',
    mend: 'Take it back to Cem and Osman, the people you told.',
  };
  g.s.threads = [
    { id: 1, who: 'kemal', to: 'riza', about: 'old account', status: 'arrived', at: 360 },
    {
      id: 2,
      who: 'cem',
      to: 'riza',
      about: "Ali's money",
      status: 'on its way',
      where: 'at dusk, coffee house',
      at: 361,
    },
    {
      id: 3,
      who: 'osman',
      to: 'riza',
      about: 'Emre keeps his word',
      status: 'stalled',
      at: 362,
      reason: 'Osman met Rıza but kept this account to himself.',
    },
  ];
  await load(g);
  await page.getByRole('button', { name: /Your word/ }).click();
  expect(await page.locator('.doubt-detail').innerText()).toContain('Take it back to Cem and Osman');
  const threads = await page.locator('.message-thread').allTextContents();
  expect(threads).toHaveLength(2);
  expect(threads[0]).toContain('Osman met Rıza but kept this account to himself.');
  expect(threads[1]).toContain("Cem → Rıza: Ali's money · at dusk, coffee house");
  expect(threads[1]).toContain('on its way');
  expect(await page.locator('[data-person="kemal"]').innerText()).toContain('Rıza listens to them');
  expect(await page.locator('[data-person="emre"]').innerText()).not.toContain('Rıza listens to them');
});
it('removes duplicate Defend and previews the actual Ask without a belief verdict', async () => {
  const g = newGame(1);
  advance(g, 479);
  g.s.newsWaiting = false;
  g.s.locations.aylin = 'garden';
  await load(g);
  await page.locator('[data-person="aylin"]').click();
  await page.locator('[data-target="emre"]').click();
  await page.locator('[data-trait="reliable"]').click();
  expect(await page.locator('[data-verb="defend"]').count()).toBe(0);
  expect(await page.locator('.ask-preview').innerText()).toBe("You'll ask: Does Emre keep promises?");
  await page.locator('[data-verb="ask"]').click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  const lastInput = (await journalInputs()).findLast(({ input }) => input.type === 'ask')?.input;
  expect(lastInput).toMatchObject({ type: 'ask', target: 'emre', trait: 'reliable' });
  expect(await page.locator('.reply').innerText()).not.toMatch(
    /Believes you|Doubts it|Doesn’t believe you|Won’t hear it/,
  );
});
it('keeps Sleep and tomorrow at the top even with a long recap', async () => {
  const g = newGame(1);
  advance(g, 1380);
  g.s.days![0]!.summary = Array.from(
    { length: 16 },
    () => 'The neighbours have a great deal to say about what happened today.',
  );
  await load(g);
  await onScreen('[data-day-card] button, [data-day-card] .tomorrow');
  await page.locator('[data-day-card]').evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await onScreen('[data-day-card] button, [data-day-card] .tomorrow');
});

it('resolves a real scene, restores Gallop and retains its outcome through inspection and replay', async () => {
  const g = newGame(1);
  advance(g, 3 * 1440 + 1080);
  await load(g);
  await page.getByRole('button', { name: 'Gallop', exact: true }).click();
  const choice = g.s.scene!.choices[0]!;
  await page.locator(`[data-choice="${choice.id}"]`).click();
  await page.locator('[data-scene]').waitFor({ state: 'hidden' });
  expect(await page.locator('[data-speed="80"]').getAttribute('aria-pressed')).toBe('true');
  const outcome = await page.locator('.reply').innerText();
  expect(outcome.trim()).not.toBe('');
  expect(outcome).not.toContain('undefined');
  await page.getByRole('button', { name: /Your word/ }).click();
  expect(await page.locator('.reply').innerText()).toBe(outcome);
  expect(act(g, { type: 'choose', scene: g.s.scene!.id, choice: choice.id })).toBe(true);
  expect(verifyImport(JSON.stringify(exportRun(g))).inputs.at(-1)?.input.type).toBe('choose');
});

it('keeps an expired scene’s fallback and outcome in the answer area', async () => {
  const g = newGame(1);
  advance(g, 3 * 1440 + 1080);
  g.s.scene!.until = g.s.minute + 1;
  const fallback = g.s.scene!.choices.find((c) => c.id === g.s.scene!.fallback)!;
  await load(g);
  await page.getByRole('button', { name: 'Gallop', exact: true }).click();
  await page.clock.runFor(1500);
  await page.locator('[data-scene]').waitFor({ state: 'hidden' });
  expect(await page.locator('.reply').innerText()).toContain(fallback.says);
  expect(await page.locator('.reply').innerText()).not.toContain('undefined');
  await page.getByRole('button', { name: /Your word/ }).click();
  expect(await page.locator('.reply').innerText()).toContain(fallback.says);
});

it('keeps the answer above a different person’s still-waiting question and quick replies', async () => {
  const g = newGame(1);
  advance(g, 405);
  await load(g);
  await page.locator('[data-person="emre"]').click();
  await page.locator('[data-target="kemal"]').click();
  await page.locator('[data-trait="dishonest"]').click();
  await page.locator('[data-verb="tell"]').click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await onScreen('.riza-mind, .reply');
  expect(await page.locator('.reply + .question + .quick-replies').count()).toBe(1);
});

it('keeps a chosen story and appends a new witness story while the panel is open and reopened', async () => {
  const g = newGame(1);
  advance(g, 764);
  await load(g);
  await page.locator('[data-person="riza"]').click();
  await page.locator('[data-story="1"]').click();
  const preview = await page.locator('.tell-preview').innerText();
  const options = await page
    .locator('[data-story]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-story')));
  await page.clock.runFor(2200);
  await page.locator('[data-story="15"]').waitFor();
  expect(
    await page.locator('[data-story]').evaluateAll((els) => els.map((el) => el.getAttribute('data-story'))),
  ).toEqual([...options, '15']);
  expect(await page.locator('[data-story="1"]').getAttribute('aria-pressed')).toBe('true');
  expect(await page.locator('.tell-preview').innerText()).toBe(preview);
  await page.getByRole('button', { name: 'Close Talk to Rıza', exact: true }).click();
  await page.locator('[data-person="riza"]').click();
  expect(await page.locator('[data-story="1"]').getAttribute('aria-pressed')).toBe('true');
  expect(await page.locator('.tell-preview').innerText()).toBe(preview);
  await page.locator('[data-verb="tell"]').click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  expect((await journalInputs()).findLast(({ input }) => input.type === 'tell-story')?.input).toEqual({
    type: 'tell-story',
    listener: 'riza',
    incident: 1,
  });
});

it('says when the selected witnessed story concerns an already settled doubt', async () => {
  const g = newGame(1);
  advance(g, 1440 + 405);
  g.s.locations.cem = 'garden';
  believe(g.s.people.riza!, 'emre:honest', true, 0.98, 'self', g.s.minute);
  believe(g.s.people.riza!, 'emre:dishonest', false, 0.98, 'self', g.s.minute);
  g.s.incidentWitnesses![2]!.push('riza');
  await load(g);
  await page.locator('[data-person="cem"]').click();
  await page.locator('[data-story="2"]').click();
  expect(await page.locator('.tell-preview').innerText()).toContain(
    'Rıza already believes Emre tells the truth',
  );
});

it('shows one ambient promise line per unfamiliar subject in the feed and journal, preserving family and trusted sources', async () => {
  const g = newGame(1);
  advance(g, 1379);
  await load(g);
  await page.getByRole('button', { name: 'Game menu', exact: true }).click();
  await page
    .locator('.notebook-history summary, details summary')
    .filter({ hasText: 'What you heard' })
    .click();
  expect(await page.locator('.journal p').filter({ hasText: 'İbrahim keeps promises' }).count()).toBe(1);
  expect(
    await page.locator('.journal p').filter({ hasText: 'Hatice keeps promises' }).count(),
  ).toBeGreaterThan(1);
  expect(await page.locator('.journal p').filter({ hasText: 'Cem keeps promises' }).count()).toBeGreaterThan(
    1,
  );
});

it('disables a story already told with an adjacent known reason and leaves a new story available', async () => {
  const g = newGame(1);
  advance(g, 390);
  expect(act(g, { type: 'tell-story', listener: 'fatma', incident: 1 })).toBe(true);
  await load(g);
  await page.locator('[data-person="fatma"]').click();
  await page.locator('[data-story="1"]').click();
  expect(await page.locator('[data-verb="tell"]').getAttribute('aria-disabled')).toBe('true');
  expect(await page.locator('.telling-limit').innerText()).toContain('Fatma');
  const before = (await journalInputs()).length;
  await page.locator('[data-verb="tell"]').click({ force: true });
  expect((await journalInputs()).length).toBe(before);
  await page.locator('[data-target="emre"]').click();
  await page.locator('[data-trait="kind"]').click();
  expect(await page.locator('[data-verb="tell"]').getAttribute('aria-disabled')).toBeNull();
});

it('uses the journal simulation version when the cached coordinates match', async () => {
  const g = newGame(1, 1);
  advance(g, 390);
  await load(g);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open('hearsay', 1);
      r.onsuccess = () => resolve(r.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction('pages', 'readwrite');
      tx.objectStore('pages').put(
        { plain: JSON.stringify({ version: 2, seed: 1, minute: 390, inputs: [] }), at: Date.now() },
        'run-log',
      );
      tx.oncomplete = () => resolve();
    });
    db.close();
  });
  await page.reload();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  const version = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open('hearsay', 1);
      r.onsuccess = () => resolve(r.result);
    });
    return await new Promise<number>((resolve) => {
      const r = db.transaction('pages').objectStore('pages').get('run-log');
      r.onsuccess = () => {
        db.close();
        resolve(JSON.parse(r.result.plain).version);
      };
    });
  });
  expect(version).toBe(2);
});

it('updates an open talk choice when Hatice hears the listener learn it', async () => {
  const g = newGame(1);
  advance(g, 390);
  await load(g);
  await page.locator('[data-person="fatma"]').click();
  await page.locator('[data-target="kemal"]').click();
  await page.locator('[data-trait="cruel"]').click();
  expect(await page.locator('[data-verb="tell"]').getAttribute('aria-disabled')).toBeNull();
  await page.clock.runFor(17000);
  expect(await page.locator('[data-verb="tell"]').getAttribute('aria-disabled')).toBe('true');
  expect(await page.locator('.telling-limit').innerText()).toContain('Ayşe');
  expect(await page.locator('.presence').innerText()).toContain('Fatma sits with you');
});
