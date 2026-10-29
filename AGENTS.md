# Hearsay

Read [HANDOFF.md](HANDOFF.md) for current state and acceptance. Follow [the plain-English policy](docs/lab/plain-english.md).

Use the Human Framework managed worktree workflow. Preserve replay and legacy tests. Run `pnpm run check:lane` before each signed commit. This lane runs lint and types without the machine-wide suite lock. Run focused behavior tests and a headless control for the change. Hosted CI runs the full suite. Include `Co-Authored-By: Codex <noreply@openai.com>`. Fetch and rebase on origin/main before every push. Require green CI on the exact source commit. Deploy from a fresh latest-origin managed tree and verify its clean release stamp.

Do not change the shared checkout, another game's files or setting worktrees. Keep personal acceptance separate from technical verification. The owner accepts by playing.

Use shared Node 26.12.0 (`.node-version`) and pinned pnpm 12.14.0. Install with `pnpm install --frozen-lockfile`. Retained internal npm script runners bypass pnpm dependency verification; the frozen install is required before checks.

Current source: HF 4.8.0, client 0.5.6, kit 0.5.24. The delivered base is 82f5c25; current batch delivery and owner acceptance are separate. Read docs/followthrough-2026-10-29.md for original-clause dispositions and exact source prerequisites. Use the single current HF4 behavior; older HF3 validators and test fixtures remain historical, not a current engine route. Current full/compact exports retain complete state and replay exactly; incompatible older files may refuse plainly.

Reading slows the clock; menus and explicit agreement sheets may pause it. Player/panel rounds, friends and Show HN remain paused. Never compute divine acceptance or quantities of the ruh. Model a person's understanding of a norm, not a ruling. Source claims from HF research; invent no ruling. Never name the RNG or scheduler after divine attributes. Prayer and fasting remain quiet background by default; authorized faith themes may have stakes and failure.
