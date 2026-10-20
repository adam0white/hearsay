# Hearsay playtest records

2026-10-20. These are local development runs, not owner acceptance or evidence about real players.

- `2026-10-20-llm-a.md`: source-unread player A, considerate policy, through day 1 midday; all six verbs.
- `2026-10-20-llm-b.md`: source-unread player B, provocative policy, through the fortnight and reload/resume; all six verbs.
- `2026-10-20-browser-acceptance.json`: phone bounds and export/import/close-resume evidence from the last of three consecutive passing trials.
- `2026-10-20-browser-review.json`: completed fortnight import and full review route count.
- `2026-10-20-hf-before.json.gz`, `2026-10-20-hf-after.json.gz`, and `2026-10-20-hf-r2.json.gz`: losslessly compressed raw HF playtester output. The adjacent `.md` files list persona, seed, quit/boredom signals, and final day per session. The default Slow clock and day/night boundary integration were corrected between the before and after files. They are run records, not a controlled before/after comparison.

The LLM files preserve exact browser command output, including the long initial ending. Neither tester read source or design notes. Neither sent a run. Their screenshots were local scratch artifacts; the textual record is retained here verbatim.

## One polish round

Both players accidentally lied through Defend. The UI now previews the exact Tell and Defend statements separately, including debt negation and each lie warning. Hatice begins with first-hand knowledge of Emre’s honesty and reliability. Amends names the claims withdrawn and marks the retractions in the route graph; it does not delete copies already passed on.

Player A lost access to the opening evidence after it left the five-line feed. Game menu now includes the full witnessed journal under What you heard. Map labels are shorter and displaced away from the central figures. Hold your tongue is disabled unless someone has asked for news; third-person testimony is disabled when its subject is the listener.

Player B found thousands of route rows overwhelming and the consequences unclear. The review now leads with Hatice’s statements and their descendants; the complete village route remains available in a separate disclosure. It names who actually confronted Hatice and marks withdrawals, bends and lies. Tracing now produces a real confrontation at a co-present recipient, including social consequences when another neighbour started the story. Cold greetings respond to later reputational damage, and shopping appointments change with the shopper’s beliefs.

Independent code review found hidden lying tags leaking into listener judgements, offsite engagement dialogue, costs that did not affect garden occupancy, a debt-preview error, stale browser-driver selectors and adapter time that depended on caller batching. These were corrected. Regression tests cover the simulation and adapter cases. The browser acceptance script found a last-minute save race. Exit-event writes alone remained intermittent. A small seed/input/minute recovery journal now commits before each clock change is displayed; the full-state gzip save is a cache. Three consecutive phone/export/import/close-resume runs passed after this change. A separate browser import of the completed headless fortnight matched fingerprint `7771d75f` and displayed all 4,336 routes.

## What the tests do not establish

The HF personas use bounded, authored action promises and valences. Five of the six later sessions quit on day 1; none completed a fortnight. Their output reports no classified bored/frustrated sessions, but that is not evidence that later days are engaging. The default Slow pace and finite dialogue pools remain visible weaknesses. Browser acceptance checks round-trip exports and the exact resumed clock; it does not establish persistence through an operating-system crash or forced browser termination.

## Round 2 (2026-10-20) and the polish round from it

Source-unread testers `2026-10-20-r2-tester-a.md` (Deniz, quit at 8:07: "I liked the flour dilemma, but I wouldn't keep playing tonight.") and `-b.md` (Murat, quit at 3:59: "I still don't know whether I'm getting the wedding any closer."). HF cohort `2026-10-20-hf-r3.md`: 30 sittings, no quits and no classified boredom; read as a different signal from people (lab lesson L16).

Polish round from them (commits 8bb4a03, 9f4a613, c53c5b2): Rıza's lean and his own words are always on screen with the named answer day; every reply says whether the listener believes you and what they will do; the answer sits above the verbs on a phone; presence is live; the word resets to Hatice's own view when the subject changes; witnessed incidents can be retold as stories; quiet stretches hurry; each day ends with a card and one question for tomorrow. Not yet retested by a fresh player.

## Round 3 (2026-10-20): two fresh source-unread testers on the live build (34bad4c)

Both quit and neither would return tomorrow.

- `2026-10-20-r3-tester-c.md` (Selin, narrative-game player, quit at 8:54, Day 2): "Now I feel punished for a sensible answer without understanding the alternative. I wouldn't open it tomorrow on my own. I'd come back for a conversation where Meryem reacts to the missing cart and Osman can answer for himself."
- `2026-10-20-r3-tester-d.md` (Hakan, strategy player, quit at 4:54, Day 3): "The wedding is progressing, but I don't feel that I'm directing it. I would not open this tomorrow on my own. I would come back for a clear plan I could try, and a visible sign that my particular choice helped or hurt it."

Diagnosis (designer, 2026-10-20). Both quits share one trigger: the game marks Meryem "would want to know", she asks about her own cart, the truthful answer draws a backbiting refusal and then emptier benches (DL-19, a cue that means the opposite of what happens). All four round 2 and 3 testers lost a listener while the talk panel was open (DL-15). Rıza leaned warm on Day 1 without any plan by the player, so the wedding had no stakes and its changes could not be attributed (Hakan). The day card's question worked as a reason to press on (Selin pressed Sleep for it).

## Round 4 (2026-10-20): live build 497f999, two fresh testers and an adversarial fun review

Round 4 changes: telling the concerned person is not backbiting; a listener sits while the talk panel is open; Rıza's three named doubts settle only through other people's word or his own sight ("You are his mother, Hatice"); the wedding road (Day 4 coffee, Day 8 his word, Day 13 answer); one Talk to… entry; lab client 0.1.2 with compact runs.

- `2026-10-20-r4-tester-e.md` (Leyla, cozy-game player, stopped at 5:52, Day 3): "I did get somewhere—two doubts settled—but I don't want another round of choosing a name and a word tonight. I wouldn't open it tomorrow on my own. I would if the next scene promised a real conversation with the families…"
- `2026-10-20-r4-tester-f.md` (Burak, schemer, quit at 5:25, Day 8): "I got two ticks, got caught lying, took it back, and then kept telling Cem the last thing Rıza wanted without seeing it land. … I would if I could see a concrete way to recover his trust and whether my message is actually on its way."
- `2026-10-20-r4-fun-review.md` (Codex adversarial review): "Conversations become a form before they become relationships"; "Exposure ends with a penalty where I want a decision."

Both now said they were getting somewhere; neither would return tomorrow. Round 5 answers with scenes (confrontation, the family coffee, Rıza's word) that ask for a choice, visible threads for messages on their way, Rıza's trust in Hatice as a fourth item with a way to mend it, stories over repeated adjectives, and a tomorrow line that names an unfinished decision.
