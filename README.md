# Hearsay

[Play Hearsay](https://hearsay.adamwhite.work).

A static web game about talk, trust and consequences in an Istanbul tea garden. You are Hatice. Open a paid workers’ lunch on Day 13: agree bread and produce on Day 4, agree on Aylin’s paid preparation on Day 8, and earn enough reservations. What people hear changes who comes, what they buy and whether the lunch can open.

The current canonical edition is documented in [canonical adoption](docs/canonical-adoption.md). It uses Hatice, Derya, Dilan, Nermin, Aylin, Ece, Rıza and Osman. The old engagement and its 32-person household cast are historical. [The original design](docs/design.md) and [playtest records](docs/playtests/README.md) retain that history. Adam accepts the game by playing; technical delivery does not establish owner acceptance.

The source pins `@adam0white/human-framework` exactly to 3.0.0 (engine 2.23.0), with immutable lab-client 0.4.11 and lab-kit 0.5.12 release artifacts. HF supplies each person’s state, seeded decisions, activities, conversations, beliefs, source trust and received social consequences. Hearsay supplies the tea garden, schedules, private discoveries, testimony routes, prices, invoices and lunch rules. Browser continuity admits every compatible allocated head in one atomic batch before starting. Voice Rıza and Osman have explicit calendar adapters. Unsupported source dialects and older cast revisions refuse the whole admission; separate local play remains available. The current garden has no Stairwell-to-Derya adapter. The unreachable historical shell does not establish that support. See [HANDOFF.md](HANDOFF.md) for the deployed receipt, which is separate from the source dependency pin.

Use shared Homebrew Node 26.12.0 and pnpm 12.14.0 pinned by `.node-version` and `packageManager`:

```sh
PATH=/opt/homebrew/bin:$PATH pnpm install --frozen-lockfile
PATH=/opt/homebrew/bin:$PATH pnpm run dev
PATH=/opt/homebrew/bin:$PATH pnpm run check:lane
PATH=/opt/homebrew/bin:$PATH pnpm run build
PATH=/opt/homebrew/bin:$PATH pnpm run preview
```

On the shared lab machine, run `pnpm run check:lane` directly. Its test child owns the machine-wide suite lock. Do not add an outer lock wrapper unless it explicitly passes lock ownership to its child. CI runs the full suite on every push.

Before Begin or a confirmed New game, the unchecked “Use longer conversations about the garden and lunch” option selects `garden-talk/1` for that run. It gives the seven visitors six replies each about their own public work, followed by the actual supply, cooking or lunch status. Paid fees, completed preparation and served meals mean different things; paying late does not complete a missed preparation session. The option stays fixed through save/reload. It grants no private knowledge or completed outside outcome and changes no cast, deadline, price, attendance or difficulty rule. The canonical cast still has eight people, including Hatice.

To play, choose Begin, then select someone who is at the garden. Invite a quiet conversation. They may decline. If they agree, let its fifteen game minutes finish to hear a volunteered private fact. Leaving early or pressing for details reveals none. Choose whether to offer practical help, keep it private or repeat it. Hatice can reflect on her own past.

Open “Talk about someone else” to ask what a listener has heard, make a positive or damaging claim, or withdraw your accusation. Choose honesty, keeping promises, kindness or generosity. A claim is not proof. If a disproved claim leads back to you, take responsibility and correct it with each listener, or stand by it and lose a day of tea sales. You can also pour tea without sharing news.

On Day 4, arrange bread and produce. On Day 8, agree on paid preparation with Aylin; pay her before 17:00 on Day 10. Invite visitors to reserve lunch from midday on Day 8 until lunch on Day 13. Four meals cover costs if you paid for the sample immediately; credit raises the cost and requires five. Actual deliveries, preparation, payment and attendance determine the result. Read the garden record to review what you heard and did.

Pause, Slow, Normal and Fast control the clock. Agreement choices, the Game menu and Feedback hold time. No time passes while the page is hidden or closed. The ordinary menu contains Resume, Feedback, Fullscreen, All games, Recording and New game with inline confirmation. Saving is automatic on this device. Exact `?lab=1` exposes diagnostic import/export, manual save and continuity/chapter/branch controls; these are not ordinary play steps.

One Recording switch controls lab recording and automatic linkage across games on this device. The first-visit notice covers both; DNT/GPC defaults recording off. Character analysis has its own opt-in. Native browser continuity uses the local shelf independently of recording. Feedback offers “I'm stopping” and “I'm confused”. Selection sends nothing and leaves your edited note intact. Submit includes the selected words in the ordinary note. Feedback accepts a note without sharing a run. With recording off, its unticked sharing checkbox enables recording and linked run sharing only when checked on Submit. No separate continuing-person consent gate is required.

Current full exports contain complete pinned initial people, seed, conversation configuration when selected, input history, final state and a fingerprint. The export API also supports compact files: they omit final state, retain any source/life chapter inputs and verify the complete replay fingerprint. The diagnostic download control still exports the full file. Import replays the captured opening without consulting current clocks or shelf heads. Unmarked runs preserve their exact prior full-state and ending continuation without normalizing prose histories. Older incompatible exports refuse plainly; their local saves remain stored. IndexedDB stores compressed saves, and pagehide queues the current snapshot immediately. Local play and diagnostic file export remain available with recording off.

The current browser tests exercise both 360×690 and 1280×800 through start, a real timed conversation, save and reload. Historical browser tests explicitly load `test/fixtures/legacy.html`; that fixture is not built for production. The old `scripts/drive.ts`, `scripts/policy.ts`, `scripts/measure.ts`, `scripts/hf-playtest/` adapter and `scripts/verify-browser.ts` still describe editions 1–5. Their output is historical regression evidence, not a current-edition playtest. Reassess their current-edition replacement after owner review on 2026-11-03.

The maintained stack is TypeScript 7.0.2, Vite 8.3.5, Vitest 5.0.5, Biome 2.6.3, Playwright 1.64.1 and Wrangler 4.152.0, on shared Node 26.12.0 and pnpm 12.14.0. Worker compatibility date: 2026-10-25. Miniflare retains Undici 7.30.1 because its HTTP 421 guard wraps the legacy dispatcher callbacks; review on 2026-11-03 or the next Miniflare release.

The pnpm policy uses isolated hardlinks, strict engines and peers, a 1440-minute release age with only the owned package scope exempt, and reviewed esbuild/workerd lifecycle scripts. Unknown install scripts fail. `pnpm run` and `pnpm exec` reject stale dependencies; retained internal `npm run` script calls bypass that guard, so install the frozen lock first. Existing npm trees must remove root/workspace `node_modules`, install the frozen pnpm lock and delete `dist`, `.types` and `*.tsbuildinfo` before rebuilding.

### Play a game file without replacing this browser’s garden

Open `?file=1` and choose **Open a game file**. This route opens the file in a separate session in the tab. It does not open or replace the browser’s saved garden or use shared person histories. The complete game file keeps its original eight people and replays their recorded inputs. The current prepared file condition has no browser ownership receipts or source archives; this route does not claim ownership of imported histories.

Play normally. Use **Download this game file** in the game menu to keep progress. **Close file session**, hiding the page, or closing the tab never saves over the browser’s garden. Reloading opens the file chooser again. Closing chapters, starting separate histories, and starting new gardens are unavailable in this mode. The file format, simulation rules and difficulty are unchanged.

Recording uses the normal lab client and the existing browser’s actual privacy and identity settings. File progress still calls recording captureSave. Normal recording can change session/run keys and pending uploads; this mode does not clear queues, reset identities, or change continuity preferences. It does not establish an upload acknowledgment or ingestion receipt. Actual existing-profile preservation and file round-trip evidence remain separate from automated source tests.
