# Hearsay: historical design, editions 1–5

The live entry in this tree now selects the eight-person canonical garden edition. Its current objective, complete cast disposition, discoveries and verification boundary are in [canonical-adoption.md](canonical-adoption.md). The engagement, fixed household cast and tool descriptions below are retained history; they do not describe the new edition. Owner acceptance still requires Adam to play.

**What done means.** For this first increment: a public, playable build at https://hearsay.adamwhite.work with a playtest export that replays, HF-character playtester runs and two source-unread LLM playtester runs recorded verbatim in `docs/playtests/`, one polish round from them, and an entry on https://human.adamwhite.work/games/ and the lab dashboard. Adam (owner) accepts it by playing it. Later work goes in the Deferred list below, each item with a date.

## The idea

A small mahalle on a hill: about 32 neighbours in 12 households, a fountain, a bakery, a grocer, a tailor, a barber, a mosque courtyard, a coffee house and doorsteps. You are **Hatice**, who keeps the tea garden beside the fountain. Everyone passes you. You hear things.

You live on being the person whose word is good: people sit in your garden because what you tell them turns out true. Your son **Emre** hopes to marry **Elif**, the baker's daughter. Her father **Rıza** is wavering.

On the first morning you overhear something true and damaging about someone. What you do with it is the game. Nobody tells you to gossip. The verbs simply allow it.

Every neighbour is a full HF `Person` (exact pin `@adam0white/human-framework` 2.10.0). Talk between neighbours is HF `converse`: what they tell comes from their own confident beliefs, an unfavourable claim about an absent person costs a speaker who holds that backbiting is wrong (so some refuse to pass it on), and low-honesty speakers may lie when the host offers a temptation. Reputation is beliefs spreading belief by belief; HF turns a changed character belief into a changed relationship.

## The fortnight

Fourteen days, continuous clock with four speeds (slow, walk, trot, gallop); nothing pauses, the clock drops to slow when something waits for you (L6). Days run 06:00 to 23:00; nights pass quickly.

## Player verbs (each gets a visible answer, L4)

All verbs work on people present in the garden or passing the fountain, so where you are matters (you are always at the garden; people come to you on their own schedules, and you may **call someone over** who is passing).

1. **Tell** a listener a claim about a third person: one of HF's reputation traits (honest/dishonest, reliable/unreliable, generous/stingy, kind/cruel, hardworking/lazy, and the rest of `REPUTATION_TRAITS`). If you believe it, it is testimony at your credence. If you do not, it is a lie (you see that marked as yours; the listener does not).
2. **Defend** someone: tell the favourable opposite.
3. **Ask** a listener what they think of someone. The answer comes in their words from their beliefs, approximate (L12), never a number.
4. **Hold your tongue**: decline a neighbour who asks you for news. It costs a little custom and earns a little standing.
5. **Make amends** to someone you wronged: costs your standing with the listener, can restore the target's standing with them. A state change, not a log line.
6. **Call over** a passer-by.

Your own standing is the trust neighbours hold in you as a source (`memory.sourceTrust` for your id). It falls when what you said is contradicted by what they see or by someone they trust more, and when the trail of a rumour that hurt someone is traced to you.

## How rumours travel, and what you can see

- Neighbours meet on host schedules (bakery at dawn, fountain, grocer, doorsteps at dusk, courtyard after prayer for those who go, coffee house). When two or more share a place for a quarter hour, the host runs `converse` between pairs, delivers the `told` percepts through `perceive`/`attend`, and applies social events.
- **The bend.** When a talkative, low-honesty teller relays an unfavourable claim, the host may sharpen it one step on a fixed ladder (lazy → unreliable → dishonest; stingy → cruel), chosen by a seeded hash of the event. Bounded: a claim moves at most two steps from where it started.
- **Truth leaks.** Some claims have ground truth (the event you overheard). When a neighbour sees the target act against the claim, `confirm` corrects them and lowers their trust in whoever told them.
- **You see** only conversations at the garden and fountain, and what people tell you. A thin line on the map marks talk you witnessed. The full route of every rumour, with each bend and who started it, appears only in the end-of-fortnight review and in the replay (L13, L14).

## Consequences the host owns (each with a verb, L19)

- **Custom.** A shopkeeper whose believed reputation drops loses customers (people choose another shop when they can). Shutters close earlier. You can see it from the garden.
- **Greetings.** Neighbours stop greeting someone whose reputation fell; you see the cold shoulder at the fountain.
- **The engagement.** Rıza's decision about Emre and Elif reads his beliefs about your household and his trust in you. It can settle either way by the end of week two.
- **Confrontation.** A target who traces a rumour to its teller confronts them, in their words. If it reaches you, your garden empties for a day.
- **Your garden.** Custom per day follows your standing. Shown as how full the benches are, not a number (show, don't count).

Faith stays quiet: some neighbours go to the courtyard after the evening prayer, and some hold that talebearing is wrong and say so when they refuse to repeat something. That is one norm among others.

## The first ten minutes (L7, L15)

- 06:30 day 1: the overheard moment (the grocer **Kemal** quietly tells his wife he has been mixing old flour into the new). True and damaging.
- Within the first game hour: a customer asks you for news (a choice), a neighbour you tell refuses to repeat it in her own words (a refusal), and someone greets the target differently (a changed greeting).
- By midday: Rıza passes and asks what you think of Kemal, whose cousin he is (the collision: the truth helps your standing and hurts your son's chances).

## Naughty edges (L11)

Lying about a rival; ruining someone for sport; playing two households against each other; buying silence. Each is playable and enters the calculations (your standing, the trail, confrontation); none wins outright.

## Determinism, saves and export

One seed; all randomness from seeded RNG held in state or from hashes of (seed, event). Inputs are logged at the minute they apply. Save in IndexedDB. Game menu offers the playtest export (seed, input log, state JSON, fingerprint); `replay(seed, inputs, minute)` reproduces the fingerprint (tested). Lab client 0.1.1 sends regular anonymous telemetry and opt-in runs with notes, as in The Warren.

## HF 2.10.0 upgrade (2026-10-20)

Simulation versions 1 and 2 keep their rules. Authored nonself source trust uses HF's `seedSourceTrust`; familiarity still uses trust-weighted testimony and reputation updates. The new provenance and same-source contradiction APIs are not enabled: their semantics differ from this game's current route and independent-disagreement rules (see [HF requests](hf-requests.md)). No play change is intended.

Before migration edits, full-state comparisons against npm HF 2.9.0 covered the pinned version 1 duplicate history at minute 390, its withdrawal history through day 7 (minute 9240), and a quiet version 2 fortnight. Each differed at exactly the 32 `Person.engine` fields, `2.9.0` → `2.10.0`; normalizing only those stamps made serialized states byte-identical. Pinned hashes `53cbae48` and `30000cb5` remain unchanged in tests, with only that stamp normalized on copies. Import accepts either the current replay hash or the old hash after the same narrow stamp normalization; it still verifies any supplied full state against its declared hash. Imported runs replay into current persons. New exports retain the current engine stamp and fingerprint. Other state changes remain mismatches.

## Owner fixes, phase 1 (2026-10-20)

The notebook send dialog closes the Game menu first and stops the clock. A body observer resumes when the lab-client veil leaves the document; successful sending also resumes through `onSent`. The chosen pace is retained.

New runs use simulation/export version 2. Hatice remembers which stories and claims each listener has heard from her or in her presence. A listener can tell her who already brought private news; only then does it become a visible limit. A changed claim, new incident or actual withdrawal leaves room to speak again. Version 1 runs retain their historical simulation and fingerprints. Their UI derives limits from speech Hatice knows without changing saved state. Recovery journals carry the simulation version.

Builder checks cover duplicate inputs, private-source discovery, retraction, legacy replay/import, live conversation updates, and the real send dialog with local transport. This is a response to the owner's playtest, not a claim of owner acceptance.

## Phones

Lab kit 0.2.0 supplies the phone stage at 360×690: a wrapping state strip, the visible scene and one nonmodal bottom sheet. Desktop docks the sheet beside the scene. The page stays within the viewport; optional people, story and word lists scroll inside their sheet. Essential statements, limits and talk responses stay visible at default text size. Enlarged text can scroll the sheet to every action.

The strip keeps Emre and Elif's wedding, Rıza's answer day, the next family step and his unresolved doubts (including Hatice's word) readable during a conversation. Wedding details offers the longer explanations and message threads. It updates as time passes. The old lean card could be inside the viewport but covered by the modal talk sheet; the explicit wedding goal disappeared with the introduction, and the crowd pushed standing below the phone viewport. That explains the observed visibility failure, not the owner's private reasoning.

People lists lead with Rıza, Cem, Emre, unfinished business and those present. The remaining village stays behind “Everyone else”; presence shortcuts lead to the full list of people here. People carry plain English relationship or occupation labels.

A pending witnessed incident, question, family choice or confrontation keeps Slow until answered or passed, then restores the chosen pace. A delayed fast animation frame stops at the first pending response instead of skipping its window. System menus and the notebook send dialog may stop time. The first Day 1 incident stayed available for 43.50 seconds before this change and 120.00 seconds after, measured in Chromium at default Walk with seed 1, a 06:29 fixture and 250 ms virtual-clock steps. A second measurement with live animation frames and no virtual clock found 43.4 and 120.1 real seconds, respectively (100 ms polling). These are browser timing checks, not human reading-time evidence.

## Build measurement

2026-10-20 (round 5): `npm run measure` on this Apple Silicon Mac completed a headless fortnight in **2.528 seconds** (seed 1, careful-relay policy, 32 people, 169 inputs including 3 scene choices, 6 known message threads, 3,449 testimony routes). The measurement includes the policy and sim, excludes the separate replay check, and is one local sample. Replay reproduced fingerprint `97ee9084`.

**Round 1 changes (sim).** Each of the fourteen mornings now supplies a different witnessed incident and a related table question. Five incidents concern Hatice’s or Rıza’s household; kindness, damaging acts and uncertain motives all appear. At 06:30 on day 1, Hatice hears Kemal tell his wife Zehra he has been mixing old flour into the new. Zehra’s household, work and voice now match that role. First-hand observations establish both sides of each trait. Contradictions from witnessed acts or more trusted testimony preserve equivalent-wording provenance, cost trust across the informed household and bring the target to the garden by the next evening. Rıza weighs Emre’s honesty and reliability, his trust in Hatice and contradictions actually known to his household. Dialogue has six openings, refusals and replies per person, with no repeated spoken stem in a day; repeated claims become daily echoes with counts and speakers. Seeded careful, reckless and cunning policies cover the intended outcomes. The HF adapter now offers pace controls and witnessed daily topics, and distinguishes news about other people from harm to Hatice. The nine raw Round 2 sessions are in `docs/playtests/2026-10-20-hf-r2.json.gz`; all reached days 4–8 at the twelve-minute cap, with no voluntary quits and no completed fortnight. The adapter diagnosis and limits are recorded in `docs/hf-requests.md`.


**Polish pass 2 (local).** Game menu holds Download this run, Import a run, Send this run to the notebook and the What you heard journal (DL-26). Each overheard incident slows the clock and appears immediately beneath At your table until a person is tapped or two game hours pass; a present interested listener gets a chip note. Dismissal survives resume. Greeting changes exclude households. Spontaneous testimony starts at 06:30, and all 576 voice stems use short speech. Concrete incident speech requires that incident's witness record. The three HF traces are lossless `.json.gz` archives with adjacent session summaries. `npm run check`, `npm run build`, `node scripts/browser-drive.ts verify-p2` (Vite dev server) and `node scripts/verify-browser.ts` (built preview) verify this pass. The 360×780 opening has 13 people present; the incident card and all six actions fit. Screenshots and the ten-line report live in `scratch/ui-shots-p2/` and `scratch/p2-report.md`. This remains local review, not owner acceptance.

**Rounds 4–6 (2026-10-20), from fresh-player quits.** The wedding is now a plan: Rıza holds three named doubts (honesty, promises, kindness) that settle only through other people's word or his own sight ("You are his mother, Hatice. I would rather hear it from someone else."), plus his trust in Hatice's word with a named way to mend it. The road has steps on Day 4 (coffee with Elif's family) and Day 8 (Rıza gives his word) before the Day 13 answer, and each step is a scene with choices drawn from the run's own record. A traced story becomes a confrontation scene (own it, name who told you, or stand by it), not only a penalty. Messages Hatice knows are on their way appear as threads, with a reason when they stall. A listener sits while the talk panel is open. Telling the person a matter concerns (Meryem and her own cart) is not treated as backbiting: in these neighbours' understanding, telling someone about a matter that concerns their own rights is not talebearing. That is the game's reading of a widely held exception (warning, seeking redress), an assumption and not a sourced ruling. The send dialog uses lab client 0.1.2 `compact` (seed, inputs, minute and fingerprint; the full state is left out) and a test replays the compacted run.

## Deferred

- **Implemented 2026-10-23 — A dilemma scene with Elif herself (Joanna, round 5).** Rules edition 3; owner play acceptance remains open.
- **2026-10-27 — Emre's kindness evidence earlier in the fortnight if playtests show it is hard to find (Tom, round 5)**

- **Done 2026-10-20 — Public build, games page and lab dashboard.** Live at https://hearsay.adamwhite.work from commit `34bad4c` (HF 2.9.0, lab client 0.1.1); listed on https://human.adamwhite.work/games/ and the lab dashboard. Later docs-only commits do not change the deployed app; `/release.json` names the deployed source.
- **Done 2026-10-20 — Fresh-player retests.** Rounds 3–5 used six new source-unread personas on the live build ([playtests/README.md](playtests/README.md)). Round 5's Tom would return on his own: "The family coffee made me want to come back; the repeated chatter nearly lost me." Joanna, also round 5, would not. Round 6 polish (stable story choices, stall reasons, quieter chatter, English for gıybet) is not yet retested by a fresh player.
- **Open, owner's call — Adam’s play acceptance.** The owner accepts this increment by playing it. That personal review remains outstanding; automated and source-unread playtests do not substitute for it.
- **2026-10-27 — Later-fortnight player acceptance.** Round 1 supplies daily scenes and six lines per voice pool, but the nine bounded HF sessions stop at their twelve-minute caps on days 4–8. Human play through days 9–14 and the ending remains to be assessed. The 135-second rules-oriented lull and the limited adapter topic menu need review after that play evidence.
- **2026-10-27 — Longer authored dialogue.** Six lines per voice pool; when a pool runs out, the game narrates the facts instead. Later days can still repeat.

## Clock presentation (2026-10-21)

The UI offers Slow, Walk, Trot and Gallop clock speeds, starting at Walk. Pending questions, incidents, scenes and open conversations hold time. Game menu and day cards keep their existing pause. Each minute still runs through the unchanged simulation; the UI stops immediately when a response appears and discards timing carry. Composer disclosures remain gameplay. The recorded-route tally appears only behind See tally at the end; no menu preference is needed. Simulation versions, inputs, replay and HF remain unchanged. Adam accepts feel by playing.

## Elif’s confidence (rules edition 3, 2026-10-23)

New fortnights use edition 3. On Day 6 at 18:00, Elif asks Hatice to keep her request to speak with Emre private before Rıza gives his word. Keeping her confidence raises Elif’s trust in Hatice by 0.06. Calling Rıza over and repeating the request raises his trust by 0.06 and lowers Elif’s by 0.06. Asking Elif to speak with him together leaves trust unchanged; she is not ready today. That is also the unanswered scene’s fallback. The scene changes no wedding doubt, evidence or acceptance threshold. Its risk lines name the trust tradeoff before the answer.

This is an implementation choice for the open Elif-dilemma route, not an owner play verdict. The existing owner acceptance requirement still applies. Editions 1 and 2 never schedule the scene or acquire its marker. Their saves and full or compact playtest exports retain the original edition and replay exactly. Edition 3 inherits edition 2’s telling-memory limits.
