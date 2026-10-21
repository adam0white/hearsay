# Hearsay

A static web game about talk, trust and consequences in a hillside mahalle. You are Hatice, keeper of the tea garden. Your son hopes to marry the baker’s daughter. On the first morning, you overhear something true.

The authority is [docs/design.md](docs/design.md). Adam accepts the increment by playing it. Publication and owner acceptance remain deferred for his review.

Node 24 or newer:

```sh
npm ci
npm run dev
npm run check
npm run build
npm run preview
```

The six verbs act on neighbours at the garden or fountain. Tell repeats the selected claim; Defend states its favourable opposite. Both statements are previewed, including whether Hatice believes them. Call over can include an offer to pay for tea in exchange for silence. The clock moves briskly through quiet stretches and holds for questions, incidents and conversations. No time passes while the page is hidden or closed.

The notebook downloads a seed, input history, full state and fingerprint. Import replays the choices and verifies both fingerprints before replacing the current run. Sending a run with a note is opt-in through the lab client. Saves use IndexedDB. A small seed/input/minute journal commits before each clock change is displayed. Full-state saves remain compressed during play, with an immediate full-state transaction when leaving.

Headless tools:

```sh
node scripts/drive.ts quiet 1 14
node scripts/drive.ts reckless 42 14 out=scratch/run.json
npm run measure
```

HF-character playtests use the existing local playtester checkout, read-only. Override its entrypoint with `HF_PLAYTESTER` if needed:

```sh
node scripts/hf-playtest/run.ts run seeds=2 personas=commuter,mischief,rulesLawyer minutes=12 out=scratch/cohort.json
node scripts/hf-playtest/run.ts session personas=mischief seed=1 out=scratch/session.json
```

Browser acceptance needs Playwright’s Chromium installed. Start `npm run preview -- --host 127.0.0.1 --port 4173`, then run `node scripts/verify-browser.ts`. It checks the phone layout, downloaded export, replayed import and pagehide/resume without sending telemetry.

[Playtest records and polish](docs/playtests/README.md) include two source-unread LLM runs and the raw HF output. [HF requests](docs/hf-requests.md) record integration gaps. Deployment is configured but has not been run.
