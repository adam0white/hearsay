/**
 * A playtest driver: the real game in a headless phone browser (360×780), with time frozen between commands, so a
 * playtester who reads slowly does not lose the hill while thinking. It shows only what the screen shows.
 *
 *   node scripts/browser-drive.ts serve <port> [url] [shots-dir]   start the browser (keeps running)
 *   node scripts/browser-drive.ts <port> look                      the screen as text, and a screenshot
 *   node scripts/browser-drive.ts <port> tap <n | button text>     press a button
 *   node scripts/browser-drive.ts <port> touch <x> <y>             one finger taps the picture at screen point x,y
 *   node scripts/browser-drive.ts <port> drag <x1> <y1> <x2> <y2>  one finger drags across the picture
 *   node scripts/browser-drive.ts <port> pan <dx> <dy>             two fingers move the page by dx,dy screen pixels
 *   node scripts/browser-drive.ts <port> zoom <in|out>             pinch
 *   node scripts/browser-drive.ts <port> wait <seconds>            let real play time pass at the current speed (max 600)
 *   node scripts/browser-drive.ts <port> export <file>             save the playtest export from the notebook
 *   node scripts/browser-drive.ts <port> quit                      close the browser
 */
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import { chromium, type Page } from 'playwright-core';

const [a0, a1, a2, a3] = process.argv.slice(2);

if (a0 === 'serve') {
  const port = Number(a1);
  const url = a2 ?? 'http://127.0.0.1:5173/';
  const shots = a3 ?? join(process.cwd(), 'scratch', `shots-${port}`);
  mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 360, height: 780 },
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
        await page.getByRole('button', { name: 'Notebook', exact: true }).click();
      }
      const [dl] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Download this run', exact: true }).click(),
      ]);
      await dl.saveAs(args.join(' '));
      await page.getByRole('button', { name: 'Close notebook', exact: true }).click();
      return `Saved ${dl.suggestedFilename()} to ${args.join(' ')}`;
    }
    if (cmd === 'import') {
      const [chooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        ((await page.getByRole('button', { name: 'Import a notebook', exact: true }).isVisible())
          ? page.getByRole('button', { name: 'Import a notebook', exact: true })
          : page.getByRole('button', { name: 'Open a notebook', exact: true })
        ).click(),
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
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('button')].filter(
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
    const all = [...document.querySelectorAll<HTMLButtonElement>('button')].filter(
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
    return { disabled: b.disabled };
  }, arg);
  if (!found) return `No button "${arg}".`;
  if (found.disabled) return 'That button is greyed out.';
  page.once('dialog', (d) => d.accept());
  await page.locator('[data-drive]').click();
  await page.clock.runFor(400);
  return null;
}
