# 20 — Screenshot suite and CI

Type: task
Status: ready-for-agent
Labels: ready-for-agent
Blocked by: 16 — Weekday fix and layout hook, 17 — Capture mode
Map: ../map.md
Spec: ../spec.md

## What to build

A Playwright suite captures the screenshot matrix from the static export and compares it with committed Linux baselines. A developer updates baselines only inside the pinned image. CI fails on a missing baseline, a missing record, a skip, or a pixel difference. A planted one-step accent change fails with a visible diff.

## Acceptance criteria

- [ ] The suite derives the matrix from the screen registry, both schemes, and the empty Habit detail state. The current matrix has 16 cases. A new registered screen without baselines fails.
- [ ] Chromium uses a 480 by 900 CSS viewport and DPR 2. Each capture is the app surface element at device scale, 780 by 1640 pixels.
- [ ] The suite waits for the ready attribute. It does not sleep. It sets the process and browser timezone to UTC.
- [ ] Comparison uses the built-in differ with threshold 0 and maximum differing-pixel ratio 0. Two captures of an unchanged tree match before any baseline is accepted.
- [ ] `vr` compares. `vr:update` writes baselines and the screenshot record, and it refuses to run outside the pinned Linux image. The image tag matches the installed Playwright version. The container architecture is pinned, including local runs on Apple Silicon.
- [ ] Off the pinned image the command reports comparison skipped and that result is not a pass. With the require-compare flag a skip fails.
- [ ] The record names the tested source commit, environment, image, dimensions, DPR, and each case. It is written only after successful generation. Capture inputs are committed before the source commit is recorded. The command does not commit.
- [ ] CI runs an independent job on pull requests and pushes to the default branch. It exports, serves, and compares inside the pinned image. It uploads the report on every run and the diff images on failure. CI does not commit baselines.
- [ ] A planted accent change fails with a visible diff. Light moves from #D9481E to #D8481E. Dark moves from #FF7A4C to #FE7A4C. Restoring both tokens passes again. No baseline update runs during the proof.
- [ ] The measured PNG weight is recorded after generation. The research estimate is not used as a budget.
- [ ] `npm test` stays the Node runner. The Playwright scripts are separate. Lint and typechecking pass.
