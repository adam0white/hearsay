# Hearsay

A static web game about talk, trust and consequences in an Istanbul tea garden. You are Hatice. Open a paid workers’ lunch on Day 13: agree bread and produce on Day 4, agree on Aylin’s paid preparation on Day 8, and earn enough reservations. What people hear changes who comes, what they buy and whether the lunch can open.

The current canonical edition is documented in [canonical adoption](docs/canonical-adoption.md). It uses Hatice, Derya, Dilan, Nermin, Aylin, Ece, Rıza and Osman. The old engagement and its 32-person household cast are historical. [The original design](docs/design.md) and [playtest records](docs/playtests/README.md) retain that history. Adam accepts the game by playing; technical delivery does not establish owner acceptance.

The source pins `@adam0white/human-framework` exactly to 3.0.0 (engine 2.23.0), with immutable lab-client 0.4.10 and lab-kit 0.5.11 release artifacts. HF supplies each person’s state, seeded decisions, activities, conversations, beliefs, source trust and received social consequences. Hearsay supplies the tea garden, schedules, private discoveries, testimony routes, prices, invoices and lunch rules. Browser continuity admits every compatible allocated head in one atomic batch before starting. Voice Rıza and Osman have explicit calendar adapters. Unsupported source dialects and older cast revisions refuse the whole admission; separate local play remains available. The current garden has no Stairwell-to-Derya adapter. The unreachable historical shell does not establish that support. See [HANDOFF.md](HANDOFF.md) for the deployed receipt, which is separate from the source dependency pin.

Use Homebrew Node 24 or newer:

```sh
PATH=/opt/homebrew/bin:$PATH npm ci
PATH=/opt/homebrew/bin:$PATH npm run dev
PATH=/opt/homebrew/bin:$PATH npm run check:lane
PATH=/opt/homebrew/bin:$PATH npm run build
PATH=/opt/homebrew/bin:$PATH npm run preview
```

On the shared lab machine, run `npm run check:lane` directly. Its `npm test` child owns the machine-wide suite lock. Do not add an outer lock wrapper unless it explicitly passes lock ownership to its child. CI runs the full suite on every push.

To play, choose Begin, then select someone who is at the garden. Invite a quiet conversation. They may decline. If they agree, let its fifteen game minutes finish to hear a volunteered private fact. Leaving early or pressing for details reveals none. Choose whether to offer practical help, keep it private or repeat it. Hatice can reflect on her own past.

Open “Talk about someone else” to ask what a listener has heard, make a positive or damaging claim, or withdraw your accusation. Choose honesty, keeping promises, kindness or generosity. A claim is not proof. If a disproved claim leads back to you, take responsibility and correct it with each listener, or stand by it and lose a day of tea sales. You can also pour tea without sharing news.

On Day 4, arrange bread and produce. On Day 8, agree on paid preparation with Aylin; pay her before 17:00 on Day 10. Invite visitors to reserve lunch from midday on Day 8 until lunch on Day 13. Four meals cover costs if you paid for the sample immediately; credit raises the cost and requires five. Actual deliveries, preparation, payment and attendance determine the result. Read the garden record to review what you heard and did.

Pause, Slow, Normal and Fast control the clock. Agreement choices, the Game menu and Feedback hold time. No time passes while the page is hidden or closed. The ordinary menu contains Resume, Feedback, Fullscreen, All games, Recording and New game with inline confirmation. Saving is automatic on this device. Exact `?lab=1` exposes diagnostic import/export, manual save and continuity/chapter/branch controls; these are not ordinary play steps.

One Recording switch controls lab recording and automatic linkage across games on this device. The first-visit notice covers both; DNT/GPC defaults recording off. Character analysis has its own opt-in. Native browser continuity uses the local shelf independently of recording. Feedback accepts a note without sharing a run. With recording off, its unticked sharing checkbox explicitly enables recording and linked run sharing when selected. No separate continuing-person consent gate is required.

Each current run exports complete pinned initial people, seed, input history, state and a fingerprint. Import replays that opening and verifies the result. Older incompatible exports refuse plainly; their local saves remain stored. IndexedDB stores compressed saves, and pagehide queues the current snapshot immediately. Local play and diagnostic file export remain available with recording off.

The current browser tests exercise both 360×690 and 1280×800 through start, a real timed conversation, save and reload. Historical browser tests explicitly load `test/fixtures/legacy.html`; that fixture is not built for production. The old `scripts/drive.ts`, `scripts/policy.ts`, `scripts/measure.ts`, `scripts/hf-playtest/` adapter and `scripts/verify-browser.ts` still describe editions 1–5. Their output is historical regression evidence, not a current-edition playtest. Reassess their current-edition replacement after owner review on 2026-11-03.

The maintained stack is TypeScript 7.0.2, Vite 8.3.5, Vitest 5.0.5, Biome 2.6.3, Playwright 1.64.1 and Wrangler 4.152.0, on Node 24 or newer. Worker compatibility date: 2026-10-25. Miniflare retains Undici 7.30.1 because its HTTP 421 guard wraps the legacy dispatcher callbacks; review on 2026-11-03 or the next Miniflare release.
