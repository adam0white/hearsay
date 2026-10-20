# Hearsay: design

**What done means.** For this first increment: a public, playable build at https://hearsay.adamwhite.work with a playtest export that replays, HF-character playtester runs and two source-unread LLM playtester runs recorded verbatim in `docs/playtests/`, one polish round from them, and an entry on https://human.adamwhite.work/games/ and the lab dashboard. Adam (owner) accepts it by playing it. Later work goes in the Deferred list below, each item with a date.

## The idea

A small mahalle on a hill: about 32 neighbours in 12 households, a fountain, a bakery, a grocer, a tailor, a barber, a mosque courtyard, a coffee house and doorsteps. You are **Hatice**, who keeps the tea garden beside the fountain. Everyone passes you. You hear things.

You live on being the person whose word is good: people sit in your garden because what you tell them turns out true. Your son **Emre** hopes to marry **Elif**, the baker's daughter. Her father **Rıza** is wavering.

On the first morning you overhear something true and damaging about someone. What you do with it is the game. Nobody tells you to gossip. The verbs simply allow it.

Every neighbour is a full HF `Person` (exact pin `@adam0white/human-framework` 2.9.0). Talk between neighbours is HF `converse`: what they tell comes from their own confident beliefs, an unfavourable claim about an absent person costs a speaker who holds that backbiting is wrong (so some refuse to pass it on), and low-honesty speakers may lie when the host offers a temptation. Reputation is beliefs spreading belief by belief; HF turns a changed character belief into a changed relationship.

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

## Phones

Actions stay above the fold at 360×780 (L9). The map is a Canvas 2D drawing of the hill; the garden panel is below it.

## Build measurement

2026-10-20 (round 5): `npm run measure` on this Apple Silicon Mac completed a headless fortnight in **2.528 seconds** (seed 1, careful-relay policy, 32 people, 169 inputs including 3 scene choices, 6 known message threads, 3,449 testimony routes). The measurement includes the policy and sim, excludes the separate replay check, and is one local sample. Replay reproduced fingerprint `97ee9084`.

**Round 1 changes (sim).** Each of the fourteen mornings now supplies a different witnessed incident and a related table question. Five incidents concern Hatice’s or Rıza’s household; kindness, damaging acts and uncertain motives all appear. At 06:30 on day 1, Hatice hears Kemal tell his wife Zehra he has been mixing old flour into the new. Zehra’s household, work and voice now match that role. First-hand observations establish both sides of each trait. Contradictions from witnessed acts or more trusted testimony preserve equivalent-wording provenance, cost trust across the informed household and bring the target to the garden by the next evening. Rıza weighs Emre’s honesty and reliability, his trust in Hatice and contradictions actually known to his household. Dialogue has six openings, refusals and replies per person, with no repeated spoken stem in a day; repeated claims become daily echoes with counts and speakers. Seeded careful, reckless and cunning policies cover the intended outcomes. The HF adapter now offers pace controls and witnessed daily topics, and distinguishes news about other people from harm to Hatice. The nine raw Round 2 sessions are in `docs/playtests/2026-10-20-hf-r2.json.gz`; all reached days 4–8 at the twelve-minute cap, with no voluntary quits and no completed fortnight. The adapter diagnosis and limits are recorded in `docs/hf-requests.md`.


**Polish pass 2 (local).** Game menu holds Download this run, Import a run, Send this run to the notebook and the What you heard journal (DL-26). Each overheard incident slows the clock and appears immediately beneath At your table until a person is tapped or two game hours pass; a present interested listener gets a chip note. Dismissal survives resume. Greeting changes exclude households. Spontaneous testimony starts at 06:30, and all 576 voice stems use short speech. Concrete incident speech requires that incident's witness record. The three HF traces are lossless `.json.gz` archives with adjacent session summaries. `npm run check`, `npm run build`, `node scripts/browser-drive.ts verify-p2` (Vite dev server) and `node scripts/verify-browser.ts` (built preview) verify this pass. The 360×780 opening has 13 people present; the incident card and all six actions fit. Screenshots and the ten-line report live in `scratch/ui-shots-p2/` and `scratch/p2-report.md`. This remains local review, not owner acceptance.

**Rounds 4–6 (2026-10-20), from fresh-player quits.** The wedding is now a plan: Rıza holds three named doubts (honesty, promises, kindness) that settle only through other people's word or his own sight ("You are his mother, Hatice. I would rather hear it from someone else."), plus his trust in Hatice's word with a named way to mend it. The road has steps on Day 4 (coffee with Elif's family) and Day 8 (Rıza gives his word) before the Day 13 answer, and each step is a scene with choices drawn from the run's own record. A traced story becomes a confrontation scene (own it, name who told you, or stand by it), not only a penalty. Messages Hatice knows are on their way appear as threads, with a reason when they stall. A listener sits while the talk panel is open. Telling the person a matter concerns (Meryem and her own cart) is not treated as backbiting: in these neighbours' understanding, telling someone about a matter that concerns their own rights is not talebearing. That is the game's reading of a widely held exception (warning, seeking redress), an assumption and not a sourced ruling. The send dialog uses lab client 0.1.2 `compact` (seed, inputs, minute and fingerprint; the full state is left out) and a test replays the compacted run.

## Deferred

- **2026-10-27 — A dilemma scene with Elif herself (Joanna, round 5)**
- **2026-10-27 — Emre's kindness evidence earlier in the fortnight if playtests show it is hard to find (Tom, round 5)**

- **Done 2026-10-20 — Public build, games page and lab dashboard.** Live at https://hearsay.adamwhite.work from commit `34bad4c` (HF 2.9.0, lab client 0.1.1); listed on https://human.adamwhite.work/games/ and the lab dashboard. Later docs-only commits do not change the deployed app; `/release.json` names the deployed source.
- **Done 2026-10-20 — Fresh-player retests.** Rounds 3–5 used six new source-unread personas on the live build ([playtests/README.md](playtests/README.md)). Round 5's Tom would return on his own: "The family coffee made me want to come back; the repeated chatter nearly lost me." Joanna, also round 5, would not. Round 6 polish (stable story choices, stall reasons, quieter chatter, English for gıybet) is not yet retested by a fresh player.
- **Open, owner's call — Adam’s play acceptance.** The owner accepts this increment by playing it. That personal review remains outstanding; automated and source-unread playtests do not substitute for it.
- **2026-10-27 — Later-fortnight player acceptance.** Round 1 supplies daily scenes and six lines per voice pool, but the nine bounded HF sessions stop at their twelve-minute caps on days 4–8. Human play through days 9–14 and the ending remains to be assessed. The 135-second rules-oriented lull and the limited adapter topic menu need review after that play evidence.
- **2026-10-27 — Longer authored dialogue.** Six lines per voice pool; when a pool runs out, the game narrates the facts instead. Later days can still repeat.
