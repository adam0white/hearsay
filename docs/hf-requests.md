# Requests from Hearsay

Current HF4 source dispositions and precise remaining inputs are in [the 2026-10-29 reconciliation](followthrough-2026-10-29.md). The dated records below describe historical APIs and adapters. Current `gardenConfirm` submits ordinary `fact.confirmed`, conversation text follows actual `claim-heard` events, and the host retains its source-route graph. Generic SDK Derya admission exists; current Stairwell native departure excludes her. Do not treat the old HF3 adapter reassessment date as an engineering hold.

Historical request record, 2026-10-20. Hearsay then pinned npm 2.10.0 and does not modify the framework checkout. Delivery status below refers to the published HF API; adoption is separate.

- **Delivered in HF 2.10.0 — Optional testimony lineage token (Hearsay 1 / Stairwell 4).** `Belief.provenance`, `provenanceOf` and `converse(..., { provenance: true })` carry first acquisition, origin and an opaque host lineage token. The original request: `converse` selects a belief and returns a claim, but the host must match that claim to its own last received route to trace rumour ancestry. An optional opaque evidence token carried from an attended claim into later testimony would let a host keep a precise graph when several sources said the same thing. The framework should still own belief weighting; the host should still own the graph and its disclosure.
- **One operation for observed reputation corrections.** Hosts calling `confirm` directly also need to call `applyReputationBelief` with the before/after credence. A composite observation helper would reduce the risk that a host corrects a belief while leaving the person's relationship unchanged. The existing functions are sufficient for this build.
- **Conversation narration hooks.** `converse` exposes withheld propositions and machine reasons. Hearsay supplies authored per-person language. An optional host-owned phrasing callback could keep those reasons attached to the exact claim while avoiding duplication of the delivery code. It should not generate or infer unwitnessed facts.

## HF 2.10.0 adoption (2026-10-20)

- **Delivered in HF 2.9.1 — Authored source trust and beliefs (Stairwell 1 and 7).** Hearsay now uses `seedSourceTrust` for nonself starting trust. The historical Hatice self entry remains for serialized replay compatibility; HF refuses self seeding, and `trustOf` ignores that entry. `seedBelief` is available but not substituted: familiarity currently uses trust-weighted `believe` plus `applyReputationBelief`. Seeding the same numeric confidence would change initial beliefs and relationships. Hatice's firsthand observations still use `confirm`.
- **Delivered in HF 2.10.0 — Same-source contradiction (`contradicted` / `Percept.reports`, Stairwell 2).** Hearsay does not carry Stairwell's `<source>:dishonest` / 0.75-scale workaround. Its `receiveTestimony` instead penalizes a less trusted source when a different, more trusted speaker disagrees. HF's new operation detects a single source giving opposite accounts, once per proposition. Substitution would change evidence requirements and penalties, so the game's rule stays.
- **Delivered in HF 2.10.0 — Provenance and opaque lineage (Hearsay 1 / Stairwell 4).** Adoption is deferred in this upgrade. HF retains first acquisition even after a correction; Hearsay chooses an eligible route from current testimony, or starts a new root for firsthand knowledge. Its per-transmission graph also carries bends, incidents, withdrawals and household consequences. Replacing that lookup with first acquisition would change ancestry and confrontation outcomes. Opting in only to store unused metadata would change full-state fixtures without replacing the workaround. The route graph remains authoritative. Reassess provenance with any future route-rule change; no new gameplay work is scheduled here.

## Historical HF3 adoption decision — 2026-10-25

Hearsay pins released HF3.0.0, engine2.23.0. The explicit new-game `garden-talk/1` option adopts `confirmObservedReputation` at actual witnessed exchanges. The published helper performs the same `confirm` then `applyReputationBelief` composition, with the same default trait table. Source recalibration and root-specific confrontation still follow that correction. Unmarked runs retain the original composition.

The same option supplies `converse`'s `phrase` callback for the exact selected character claim. The callback uses the claim's subject and value; it does not choose a claim or inspect private author facts. The game delivers the returned percept to the actual listener and uses its summary in the garden record. HF may suppress a percept when a listener already holds the claim; the selected statement still uses the existing transmission graph without pretending it supplied new evidence. Withheld claims and the speaker's private confidence or deceit are not exposed.

The provenance substitution is deliberately rejected. HF's first acquisition and opaque lineage do not replace the host's query for the latest eligible, unretracted transmission to a particular person. Withdrawals, roots and witnessed contradictions require that graph. Adding unused first-acquisition metadata would not implement the request's precise route query. This is an engineering decision, not a future-review deferral.

Space, schedules, economic custom, paid-lunch arrangements and source-route disclosure remain host responsibilities by design.

## Round 2 playtester diagnosis

The six sessions in `docs/playtests/2026-10-20-hf-after.json.gz` do not show a game-ending defect. Five personas voluntarily stop after four or five real minutes, at day 1 10:00 or 11:00. Their recorded stopping reason is `emotion:joy:novel`. Mischief seed 2 reaches the twelve-minute cap at day 1 18:00. None reaches the engagement decision or review. The final recorded engagement in the five quit sessions ranges from 0.245 to 0.299. The absence of a classified bored moment does not contradict a voluntary quit: those are different thresholds and decisions in the playtester.

The run exposes both game and adapter limits. At Slow, one real second advances one game minute. The adapter omitted the visible Walk, Trot and Gallop controls, so its player could never cross a quiet stretch faster. Day 1 lulls reached 144 seconds, and the authored menu repeatedly offered Ask about Kemal, Defend Emre, and even amends when Hatice had made no claim. This is a narrow player policy, not the full UI menu. The game also had finite dialogue and little authored testimony after its opening. These records do not isolate the causal share of each limitation.

Round 2 restores the four visible pace controls to the adapter. Its bounded menu now also follows the latest witnessed daily scene: the adapter matches the visible journal text and minute to the authored scene before offering that subject and claim. It never reads hidden beliefs or offers a future scene’s claim. A waiting neighbour drops the pace to Slow even when reached inside one large `advance` call; batched and split time now agree at this boundary. Pace changes receive a visible acknowledgement so rules-oriented personas do not mistake the control for an ignored action. The adapter exposes the new first-start goal, “Keep your word good. See Emre married.”, and the current tea-table question or “Tap a person. Choose what to say.” as the next-step copy. Empty amends receive a low promise using only Hatice’s own statement and withdrawal history. Generic narration and acknowledgements now have neutral valence instead of an unconditional positive 0.2: an empty retraction must not count as a reward. Confrontations and cold greetings count as adverse only when their visible text addresses Hatice; refusals count as adverse only when they answer her input. Ambient refusals and another neighbour’s cold greeting are neutral news. An intermediate Round 2 run showed why this matters: treating every ambient refusal and Kemal’s cold receptions as harm to Hatice produced six frustration-driven quits. That intermediate output was replaced after fixing the appraisal and a separate incident-witnessing bug. Regression tests cover the missing control, its rate, question slowdown across a Gallop batch, and the empty-retraction appraisal. All appraisals and action promises remain authored premises.

No change was made to the human-framework checkout. The HF cohort is a local simulation, not evidence about real players or owner acceptance. Round 2 combines adapter and game changes; it is not a controlled adapter-only experiment.

### Recorded Round 2 cohort

Command: `node scripts/hf-playtest/run.ts run personas=commuter,mischief,rulesLawyer seeds=3 minutes=12 build=polish-r2 out=docs/playtests/2026-10-20-hf-r2.json`. The original JSON output is archived losslessly as `docs/playtests/2026-10-20-hf-r2.json.gz`; it contains all nine raw session traces, persona records and the cohort summary. See `docs/playtests/2026-10-20-hf-r2.md` for the session index. All sessions hit the twelve-minute cap. None quit voluntarily; none completed the fortnight.

| Persona     | Seed | Clock at cap | Pace inputs |
| ----------- | ---- | ------------ | ----------- |
| commuter    | 1    | Day 6 07:23  | 21          |
| commuter    | 2    | Day 5 07:05  | 24          |
| commuter    | 3    | Day 7 17:25  | 23          |
| mischief    | 1    | Day 8 07:08  | 31          |
| mischief    | 2    | Day 6 07:55  | 30          |
| mischief    | 3    | Day 6 17:08  | 16          |
| rulesLawyer | 1    | Day 6 07:13  | 31          |
| rulesLawyer | 2    | Day 4 19:02  | 24          |
| rulesLawyer | 3    | Day 7 00:16  | 25          |

The cohort exercised all six verbs across its sessions; Hold your tongue was chosen only once (rulesLawyer seed 1). Every session used pace controls. No session crossed the bored classification threshold. Two rulesLawyer sessions had classified frustration; the other personas had none. RulesLawyer still had a 135-second maximum lull. This establishes that the adapter now reaches later daily scenes and that the prior day-1 stopping pattern is absent under this bounded policy. It does not establish human retention, later-fortnight engagement, a winning route, or acceptance. The altered game content, pace access, appraisal and authored action menu prevent attribution of the result to any single change. The narrow menu follows the latest witnessed scene plus Kemal and Emre; it does not explore every person/trait combination available in the UI.

## HF 2.21.0 adoption (2026-10-25)

Fresh canonical garden people and the historical shell’s current constructors persist `lexicon.plainEnglish: true`. Immutable editions 1–3 retain their original replay inputs. Loaded complete people and own archived continuations retain their saved narration choice. Voice’s finite portable snapshot has no lexicon; a new receiving Person uses Hearsay’s narration default. The package and source envelope pin 2.21.0; the dependency override keeps lab-client’s clock on the same package. No bodily, project, social or other faculty opt-in changed.

Lesson: narration belongs to the pinned Person. Set it at construction, never while rendering or loading. The live garden already writes its own sentences and does not display HF intention templates, so package inventory examples are not on-screen evidence. The Voice adapter accepts only the unchanged 2.17.0 and 2.21.0 portable dialects, with matching envelope/snapshot engines, source roles, canonical revisions and mapping identity. Its regression uses a real Voice constructor and checkpoint, not a renamed historical header.

## HF 3.0.0 adoption (2026-10-25)

Exact published HF3.0.0 supplies engine2.23.0. Immutable client0.4.10 and kit0.5.11 resolve one framework graph, without the obsolete framework override. The current garden keeps `hearsay-cast-6`: passport semantics and role mappings are unchanged. Fresh saved Persons pin plain-English narration. Existing complete people retain their saved choices. No mutable tuning or new bodily faculty is enabled.

The old one-cast Derya shell remains historical. It has no current production entry or supported permalink: only the explicit test fixture mounts it. The canonical garden supports its own complete archive and Voice Rıza/Osman calendar adapters. It has no current Stairwell Derya adapter. Do not label historical synthetic controls or an unreachable new tuple as a current round trip. Reassess a new ordinary garden Derya adapter after owner review on 2026-11-03; it would need an actual source passport, explicit semantics and both host exporters.

Lesson: a package upgrade cannot establish a cross-host journey. Match source edition, engine, revision, actual checkpoint and replay together; retain the raw source separately from the portable projection.
