# Hearsay

Read [HANDOFF.md](HANDOFF.md) for current state and acceptance. Follow [the plain-English policy](docs/lab/plain-english.md).

Use the Human Framework managed worktree workflow. Preserve replay and legacy tests. Run `pnpm run check:lane` before each signed commit. This lane runs lint and types without the machine-wide suite lock. Run focused behavior tests and a headless control for the change. Hosted CI runs the full suite. Include `Co-Authored-By: Codex <noreply@openai.com>`. Fetch and rebase on origin/main before every push. Require green CI on the exact source commit. Deploy from a fresh latest-origin managed tree and verify its clean release stamp.

Do not change the shared checkout, another game's files or setting worktrees. Keep personal acceptance separate from technical verification. The owner accepts by playing.

Use shared Node 26.12.0 (`.node-version`) and pinned pnpm 12.14.0. Install with `pnpm install --frozen-lockfile`. Retained internal npm script runners bypass pnpm dependency verification; the frozen install is required before checks.
