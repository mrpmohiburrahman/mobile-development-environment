# 21 — Regression tab

Type: task
Status: ready-for-agent
Labels: ready-for-agent
Blocked by: 20 — Screenshot suite and CI
Map: ../map.md
Spec: ../spec.md

## What to build

The studio gains a Regression tab that displays the bundled screenshot record as text. It names the source commit that produced the baselines, or it says no screenshot run on record. It never fetches CI, embeds images, or calls a different build a pass.

## Acceptance criteria

- [ ] The studio imports the screenshot record and the static export bundles it. The tab does not fetch it at runtime.
- [ ] With a record the tab reads approved at the recorded commit and lists each case with its scheme, state, and baseline path.
- [ ] With no record the tab reads no screenshot run on record. That state is visibly different from a pass.
- [ ] The tab does not embed PNGs, link to CI artifacts, or claim the current build passed.
- [ ] RenderVerdict stays a fidelity line. The screenshot result is not added to it.
- [ ] A newer HEAD than the record commit does not by itself fail the tab or CI.
- [ ] `npm test`, lint, and typechecking pass.
