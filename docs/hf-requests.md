# Requests from Hearsay

2026-10-20. Hearsay pins npm 2.10.0 and does not modify the framework checkout. Delivery status below refers to the published HF API; adoption is separate.

- **Delivered in HF 2.10.0 — Optional testimony lineage token (Hearsay 1 / Stairwell 4).** `Belief.provenance`, `provenanceOf` and `converse(..., { provenance: true })` carry first acquisition, origin and an opaque host lineage token. The original request: `converse` selects a belief and returns a claim, but the host must match that claim to its own last received route to trace rumour ancestry. An optional opaque evidence token carried from an attended claim into later testimony would let a host keep a precise graph when several sources said the same thing. The framework should still own belief weighting; the host should still own the graph and its disclosure.
- **One operation for observed reputation corrections.** Hosts calling `confirm` directly also need to call `applyReputationBelief` with the before/after credence. A composite observation helper would reduce the risk that a host corrects a belief while leaving the person's relationship unchanged. The existing functions are sufficient for this build.
- **Conversation narration hooks.** `converse` exposes withheld propositions and machine reasons. Hearsay supplies authored per-person language. An optional host-owned phrasing callback could keep those reasons attached to the exact claim while avoiding duplication of the delivery code. It should not generate or infer unwitnessed facts.

## HF 2.10.0 adoption (2026-10-20)

- **Delivered in HF 2.9.1 — Authored source trust and beliefs (Stairwell 1 and 7).** Hearsay now uses `seedSourceTrust` for nonself starting trust. The historical Hatice self entry remains for serialized replay compatibility; HF refuses self seeding, and `trustOf` ignores that entry. `seedBelief` is available but not substituted: familiarity currently uses trust-weighted `believe` plus `applyReputationBelief`. Seeding the same numeric confidence would change initial beliefs and relationships. Hatice's firsthand observations still use `confirm`.
- **Delivered in HF 2.10.0 — Same-source contradiction (`contradicted` / `Percept.reports`, Stairwell 2).** Hearsay does not carry Stairwell's `<source>:dishonest` / 0.75-scale workaround. Its `receiveTestimony` instead penalizes a less trusted source when a different, more trusted speaker disagrees. HF's new operation detects a single source giving opposite accounts, once per proposition. Substitution would change evidence requirements and penalties, so the game's rule stays.
- **Delivered in HF 2.10.0 — Provenance and opaque lineage (Hearsay 1 / Stairwell 4).** Adoption is deferred in this upgrade. HF retains first acquisition even after a correction; Hearsay chooses an eligible route from current testimony, or starts a new root for firsthand knowledge. Its per-transmission graph also carries bends, incidents, withdrawals and household consequences. Replacing that lookup with first acquisition would change ancestry and confrontation outcomes. Opting in only to store unused metadata would change full-state fixtures without replacing the workaround. The route graph remains authoritative. Reassess provenance with any future route-rule change; no new gameplay work is scheduled here.

The composite observed-reputation correction and conversation narration requests above remain open. No new regard or contradiction mechanics are enabled.

Space, schedules, economic custom, the engagement decision, bend ladders and review disclosure remain host responsibilities by design.

## Round 2 playtester diagnosis

The six sessions in `docs/playtests/2026-10-20-hf-after.json.gz` do not show a game-ending defect. Five personas voluntarily stop after four or five real minutes, at day 1 10:00 or 11:00. Their recorded stopping reason is `emotion:joy:novel`. Mischief seed 2 reaches the twelve-minute cap at day 1 18:00. None reaches the engagement decision or review. The final recorded engagement in the five quit sessions ranges from 0.245 to 0.299. The absence of a classified bored moment does not contradict a voluntary quit: those are different thresholds and decisions in the playtester.

The run exposes both game and adapter limits. At Slow, one real second advances one game minute. The adapter omitted the visible Walk, Trot and Gallop controls, so its player could never cross a quiet stretch faster. Day 1 lulls reached 144 seconds, and the authored menu repeatedly offered Ask about Kemal, Defend Emre, and even amends when Hatice had made no claim. This is a narrow player policy, not the full UI menu. The game also had finite dialogue and little authored testimony after its opening. These records do not isolate the causal share of each limitation.

Round 2 restores the four visible pace controls to the adapter. Its bounded menu now also follows the latest witnessed daily scene: the adapter matches the visible journal text and minute to the authored scene before offering that subject and claim. It never reads hidden beliefs or offers a future scene’s claim. A waiting neighbour drops the pace to Slow even when reached inside one large `advance` call; batched and split time now agree at this boundary. Pace changes receive a visible acknowledgement so rules-oriented personas do not mistake the control for an ignored action. The adapter exposes the new first-start goal, “Keep your word good. See Emre married.”, and the current tea-table question or “Tap a person. Choose what to say.” as the next-step copy. Empty amends receive a low promise using only Hatice’s own statement and withdrawal history. Generic narration and acknowledgements now have neutral valence instead of an unconditional positive 0.2: an empty retraction must not count as a reward. Confrontations and cold greetings count as adverse only when their visible text addresses Hatice; refusals count as adverse only when they answer her input. Ambient refusals and another neighbour’s cold greeting are neutral news. An intermediate Round 2 run showed why this matters: treating every ambient refusal and Kemal’s cold receptions as harm to Hatice produced six frustration-driven quits. That intermediate output was replaced after fixing the appraisal and a separate incident-witnessing bug. Regression tests cover the missing control, its rate, question slowdown across a Gallop batch, and the empty-retraction appraisal. All appraisals and action promises remain authored premises.

No change was made to the human-framework checkout. The HF cohort is a local simulation, not evidence about real players or owner acceptance. Round 2 combines adapter and game changes; it is not a controlled adapter-only experiment.

### Recorded Round 2 cohort

Command: `node scripts/hf-playtest/run.ts run personas=commuter,mischief,rulesLawyer seeds=3 minutes=12 build=polish-r2 out=docs/playtests/2026-10-20-hf-r2.json`. The original JSON output is archived losslessly as `docs/playtests/2026-10-20-hf-r2.json.gz`; it contains all nine raw session traces, persona records and the cohort summary. See `docs/playtests/2026-10-20-hf-r2.md` for the session index. All sessions hit the twelve-minute cap. None quit voluntarily; none completed the fortnight.

| Persona | Seed | Clock at cap | Pace inputs |
| --- | --- | --- | --- |
| commuter | 1 | Day 6 07:23 | 21 |
| commuter | 2 | Day 5 07:05 | 24 |
| commuter | 3 | Day 7 17:25 | 23 |
| mischief | 1 | Day 8 07:08 | 31 |
| mischief | 2 | Day 6 07:55 | 30 |
| mischief | 3 | Day 6 17:08 | 16 |
| rulesLawyer | 1 | Day 6 07:13 | 31 |
| rulesLawyer | 2 | Day 4 19:02 | 24 |
| rulesLawyer | 3 | Day 7 00:16 | 25 |

The cohort exercised all six verbs across its sessions; Hold your tongue was chosen only once (rulesLawyer seed 1). Every session used pace controls. No session crossed the bored classification threshold. Two rulesLawyer sessions had classified frustration; the other personas had none. RulesLawyer still had a 135-second maximum lull. This establishes that the adapter now reaches later daily scenes and that the prior day-1 stopping pattern is absent under this bounded policy. It does not establish human retention, later-fortnight engagement, a winning route, or acceptance. The altered game content, pace access, appraisal and authored action menu prevent attribution of the result to any single change. The narrow menu follows the latest witnessed scene plus Kemal and Emre; it does not explore every person/trait combination available in the UI.
