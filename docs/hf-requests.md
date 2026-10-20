# Requests from Hearsay

2026-10-20. These are requests, not changes to HF. Hearsay pins npm 2.9.0 and does not modify the framework checkout.

- **Optional testimony lineage token.** `converse` selects a belief and returns a claim, but the host must match that claim to its own last received route to trace rumour ancestry. An optional opaque evidence token carried from an attended claim into later testimony would let a host keep a precise graph when several sources said the same thing. The framework should still own belief weighting; the host should still own the graph and its disclosure.
- **One operation for observed reputation corrections.** Hosts calling `confirm` directly also need to call `applyReputationBelief` with the before/after credence. A composite observation helper would reduce the risk that a host corrects a belief while leaving the person's relationship unchanged. The existing functions are sufficient for this build.
- **Conversation narration hooks.** `converse` exposes withheld propositions and machine reasons. Hearsay supplies authored per-person language. An optional host-owned phrasing callback could keep those reasons attached to the exact claim while avoiding duplication of the delivery code. It should not generate or infer unwitnessed facts.

Space, schedules, economic custom, the engagement decision, bend ladders and review disclosure remain host responsibilities by design.
