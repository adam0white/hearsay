# Hearsay playtest records

2026-10-20. These are local development runs, not owner acceptance or evidence about real players.

- `2026-10-20-llm-a.md`: source-unread player A, considerate policy, through day 1 midday; all six verbs.
- `2026-10-20-llm-b.md`: source-unread player B, provocative policy, through the fortnight and reload/resume; all six verbs.
- `2026-10-20-browser-acceptance.json`: phone bounds and export/import/close-resume evidence from the last of three consecutive passing trials.
- `2026-10-20-browser-review.json`: completed fortnight import and full review route count.
- `2026-10-20-hf-before.json`: raw HF playtester output, two personas × one seed, four-minute cap, early build.
- `2026-10-20-hf-after.json`: raw output, three personas × two seeds, twelve-minute cap, polished build. The default Slow clock and day/night boundary integration were corrected between these files. They are run records, not a controlled before/after comparison.

The LLM files preserve exact browser command output, including the long initial ending. Neither tester read source or design notes. Neither sent a run. Their screenshots were local scratch artifacts; the textual record is retained here verbatim.

## One polish round

Both players accidentally lied through Defend. The UI now previews the exact Tell and Defend statements separately, including debt negation and each lie warning. Hatice begins with first-hand knowledge of Emre’s honesty and reliability. Amends names the claims withdrawn and marks the retractions in the route graph; it does not delete copies already passed on.

Player A lost access to the opening evidence after it left the five-line feed. The notebook now includes the full witnessed journal. Map labels are shorter and displaced away from the central figures. Hold your tongue is disabled unless someone has asked for news; third-person testimony is disabled when its subject is the listener.

Player B found thousands of route rows overwhelming and the consequences unclear. The review now leads with Hatice’s statements and their descendants; the complete village route remains available in a separate disclosure. It names who actually confronted Hatice and marks withdrawals, bends and lies. Tracing now produces a real confrontation at a co-present recipient, including social consequences when another neighbour started the story. Cold greetings respond to later reputational damage, and shopping appointments change with the shopper’s beliefs.

Independent code review found hidden lying tags leaking into listener judgements, offsite engagement dialogue, costs that did not affect garden occupancy, a debt-preview error, stale browser-driver selectors and adapter time that depended on caller batching. These were corrected. Regression tests cover the simulation and adapter cases. The browser acceptance script found a last-minute save race. Exit-event writes alone remained intermittent. A small seed/input/minute recovery journal now commits before each clock change is displayed; the full-state gzip save is a cache. Three consecutive phone/export/import/close-resume runs passed after this change. A separate browser import of the completed headless fortnight matched fingerprint `7771d75f` and displayed all 4,336 routes.

## What the tests do not establish

The HF personas use bounded, authored action promises and valences. Five of the six later sessions quit on day 1; none completed a fortnight. Their output reports no classified bored/frustrated sessions, but that is not evidence that later days are engaging. The default Slow pace and finite dialogue pools remain visible weaknesses. Browser acceptance checks round-trip exports and the exact resumed clock; it does not establish persistence through an operating-system crash or forced browser termination.
