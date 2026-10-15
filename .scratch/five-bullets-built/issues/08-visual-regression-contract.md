# 08 — The visual-regression contract

Type: grilling
Status: open
Blocked by: 02, 03
Map: ../map.md

## Question

With Playwright measured (02) and the font bundled (03), decide the
contract that makes "visual regression on web" a thing the repo does:

- **Matrix**: screens × scheme (light/dark) is the floor. Decide DPR (fix at
  2?), viewport, and whether frame-level screenshots (one PNG per frame) or
  one board PNG. Estimate committed PNG weight.
- **Determinism**: fonts bundled; animations disabled; dates — the demo
  dates are already zone-stable (`f22bff4`); `expo-image` and any async
  content waited for. Name the wait predicate.
- **Where baselines live** and how they are updated: `npm run vr:update`
  locally in the Playwright Docker image, or a CI job that commits new
  baselines on a label. Mac-vs-Linux drift policy.
- **CI**: a new workflow or a job in `studio-guard.yml`; runs on PR; uploads
  actual/expected/diff; fails the check on diff above threshold.
- **In the studio**: how results surface. Options: a Regression tab reading
  a committed `vr-report.json`; a badge per frame; the existing
  `RenderVerdict` line extended with "last screenshot run: pass/fail/not
  run". Honest zero: "no screenshot run on record" is distinct from "pass".
- **Negative control**: a planted token change (e.g. `color.primary` shifted
  one step) must fail the job with a visible diff image. Record the command
  that proves it.
- **Relation to baseline mode**: `studio-honesty` compares renders against
  `HEAD` tokens structurally; the screenshot suite compares pixels against
  committed PNGs. State in one paragraph what each catches that the other
  cannot, for the README.

Resolve with a spec the implementation ticket can execute.
