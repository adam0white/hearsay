# Hearsay

Read [HANDOFF.md](HANDOFF.md) for current state and acceptance. Follow [the plain-English policy](docs/lab/plain-english.md).

Use the Human Framework managed worktree workflow. Preserve replay and legacy tests. Run `npm run check:lane` under the machine-wide suite lock before each signed commit. Include `Co-Authored-By: Codex <noreply@openai.com>`. Fetch and rebase on origin/main before every push. Require green CI on the exact source commit. Deploy from a fresh latest-origin managed tree and verify its clean release stamp.

Do not change the shared checkout, another game's files or setting worktrees. Keep personal acceptance separate from technical verification. The owner accepts by playing.
