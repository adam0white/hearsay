# Hearsay

A static web game about talk, trust and consequences in an Istanbul tea garden. You are Hatice. Open a paid workers’ lunch on Day 13: agree bread and produce on Day 4, pay for Aylin’s preparation on Day 8, and earn enough reservations. What people hear changes who comes, what they buy and whether the lunch can open.

The current canonical edition is documented in [canonical adoption](docs/canonical-adoption.md). It uses Hatice, Derya, Dilan, Nermin, Aylin, Ece, Rıza and Osman. The old engagement and its 32-person household cast are historical. [The original design](docs/design.md) and [playtest records](docs/playtests/README.md) retain that history. Adam accepts the game by playing; technical delivery does not establish owner acceptance.

The canonical edition uses HF 3.0.0 (engine 2.23.0), lab-client 0.4.10 and lab-kit 0.5.11. Browser continuity admits every compatible allocated head in one atomic batch before starting. Voice Rıza and Osman have explicit calendar adapters. Unsupported source dialects and older cast revisions refuse the whole admission; separate local play remains available. Exact release and browser receipts are recorded in the worker report outside the repository.

Use Homebrew Node 24 or newer:

```sh
PATH=/opt/homebrew/bin:$PATH npm ci
PATH=/opt/homebrew/bin:$PATH npm run dev
PATH=/opt/homebrew/bin:$PATH npm run check:lane
PATH=/opt/homebrew/bin:$PATH npm run build
PATH=/opt/homebrew/bin:$PATH npm run preview
```

On the shared lab machine, run `npm run check:lane` directly. Its `npm test` child owns the machine-wide suite lock. Do not add an outer lock wrapper unless it explicitly passes lock ownership to its child. CI runs the full suite on every push.

Ask, tell, defend and withdraw a claim about honesty, reliability, kindness or generosity. A completed conversation may reveal a volunteered private fact. A refusal or interrupted conversation reveals none. Support it privately, leave it alone or repeat it to someone actually present. A contradicted rumour can be traced back to a confrontation. Owning it and correcting each listener differs from standing by it and losing a day of custom.

The clock offers Pause, Slow, Normal and Fast. It holds while agreement choices or the menu are open. No time passes while the page is hidden or closed. Each current run exports full pinned initial people, seed, input history, state and a fingerprint. Import replays the captured opening and verifies the result. Older editions refuse plainly; their local save keys are preserved. IndexedDB stores compressed saves, and pagehide queues the current snapshot immediately. The recording switch controls linked play history. Native browser continuity uses the local shelf independently. Local play and file export remain available when recording is off.

The current browser tests exercise both 360×690 and 1280×800 through start, a real timed conversation, save and reload. Historical browser tests explicitly load `test/fixtures/legacy.html`; that fixture is not built for production. The old `scripts/drive.ts`, `scripts/policy.ts`, `scripts/measure.ts`, `scripts/hf-playtest/` adapter and `scripts/verify-browser.ts` still describe editions 1–5. Their output is historical regression evidence, not a current-edition playtest. Reassess their current-edition replacement after owner review on 2026-11-03.

The maintained stack is TypeScript 7.0.2, Vite 8.3.5, Vitest 5.0.5, Biome 2.6.3, Playwright 1.64.1 and Wrangler 4.152.0, on Node 24 or newer. Worker compatibility date: 2026-10-25. Miniflare retains Undici 7.30.1 because its HTTP 421 guard wraps the legacy dispatcher callbacks; review on 2026-11-03 or the next Miniflare release.
