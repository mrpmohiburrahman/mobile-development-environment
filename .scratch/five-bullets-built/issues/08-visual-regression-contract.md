# 08 — The visual-regression contract

Type: grilling
Status: resolved
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

## Answer

Decision: [ADR 0002](../../../docs/adr/0002-linux-only-screenshot-baselines.md).

Ticket 02 proposes `threshold: 0.2`. This contract sets `threshold` to 0. Ticket 03 is research, not a bundled font. The suite cannot pass until that font work lands.

### Capture

Capture the app surface only. The app surface is 390 by 820 CSS pixels. Exclude the screen-frame header, footer, studio controls, and route connections. Do not capture the board.

Use Capture mode. Capture mode renders one app surface at scale 1. It uses the same screen components as the board. It is not Present mode. It is not shareable URL state.

Enter Capture mode with query parameters on `/ide`. The static export must honor those parameters. Do not gate them with `__DEV__`.

Use this URL shape:

`/ide?capture=1&screen=<key>&scheme=light|dark&state=populated|empty`

`state=empty` applies only to `habit`. Any other empty request is an error. An unknown screen key is an error. On an error, do not set the ready attribute.

Capture mode ignores the shareable hash. It ignores token overrides. It renders the committed tokens only.

Set the fixture before the first paint. Do not use clicks to reach a state.

- Populated Habit detail selects Morning run (`h1`).
- Empty Habit detail leaves no selection.
- Other screens use the signed-in seed.

### Matrix

Build the screenshot matrix from the screen registry, both schemes, and the empty Habit detail state. A screen without a baseline fails the job. A new empty state is not automatic. Only Habit detail has a second state.

The current matrix has 16 screenshot cases. Seven screens times two schemes makes 14 cases. Empty Habit detail adds two cases.

Fix DPR at 2. Do not add viewport widths. The PNG is 780 by 1640 pixels. Set `deviceScaleFactor` to 2. Set the screenshot `scale` to `device`. Use a CSS viewport of 480 by 900. Capture the app surface element, not the full page.

Research estimates 4 to 7 MB for 14 PNGs at DPR 2. This contract has 16 cases. That estimate is not a measurement. Do not use it as a budget.

### Ready predicate

The test waits for `data-screenshot-ready="true"`. Do not sleep.

Set that attribute only when all of these are true:

- `document.fonts.ready` resolves.
- `document.fonts.check('700 16px "Spline Sans"')` returns true.
- Capture mode applies the requested scheme.
- Capture mode applies the fixture.
- The app surface measures 390 by 820 CSS pixels.
- Every image reports complete. The app has no `expo-image` content today.
- Playwright `reducedMotion` is `reduce`.
- Capture mode applies no token override.

A disabled-animation flag does not finish the Reanimated `Meter`. `reducedMotion` does.

### Dates and fonts

`habitDates.ts` already uses UTC. `habit.tsx` formats a weekday with local `getDay()`. Render that weekday with the UTC day. Set `TZ=UTC` in the screenshot job.

Ticket 09 decides the guard exception for that edit. This contract does not change the guard.

The ready check proves that Spline Sans can load. It does not prove that every text node uses it. The font work in ticket 03 must put `fontFamily` on the shared text path before the first baseline update.

### Baselines

Store baselines in `e2e/__screenshots__/`. Omit `{platform}` from `snapshotPathTemplate`.

`npm run vr` compares the current app surfaces with the baselines. `npm run vr:update` writes the baselines and the screenshot record. Run the update only in the pinned Playwright Linux image. The image tag must match the installed Playwright version. Use `mcr.microsoft.com/playwright:v<version>-noble`. The update command refuses to run outside that image.

A developer submits the PNGs for review. CI does not commit baselines.

Use the Playwright differ. Do not add `pixelmatch`.

Off the pinned image, the command skips the comparison. The status text is `comparison skipped`. That result is not a pass. The local command may exit 0 only with that status. CI sets `VR_REQUIRE_COMPARE=1`. A skip then fails the job.

Set `threshold` to 0. Set `maxDiffPixelRatio` to 0. Stop when two captures of an unchanged tree differ. Reopen the tolerance. Do not widen it in the implementation.

### Screenshot record

Commit `mobile/src/ide/screenshot-record.json`. The studio imports that file. The static export bundles it. Do not fetch it at runtime. Only `vr:update` writes it.

No record means no screenshot run on record.

The record holds the baseline commit, the Playwright image tag, DPR, the CSS size, and each screenshot case. Each case names the screen, scheme, state, and baseline path.

CI fails on a missing record, an incomplete matrix, a missing PNG, or a pixel diff. Do not fail CI only because HEAD is newer than the record commit.

### Regression tab

Add a Regression tab. The tab displays the screenshot record as text. It says approved at the recorded commit, or no screenshot run on record. It does not embed PNGs. It does not link to CI artifacts. It does not fetch CI. It does not call a different build a pass.

Keep `RenderVerdict` for render fidelity. Do not add the screenshot result to that line.

Reviewers inspect actual, expected, and diff images in the CI artifact.

### CI

Add an independent job named `visual-regression` to `studio-guard.yml`. The workflow also runs on other pushes. Gate this job with `if`. Run it on pull requests and on pushes to the default branch.

The job exports the static web build. The job serves that build. The job runs `npm run vr` inside the pinned image. Set `VR_REQUIRE_COMPARE` to 1.

The job fails on a capture error, a missing baseline, a missing record, an incomplete matrix, a skipped comparison, or a pixel diff.

Upload the Playwright report on every run. Upload actual, expected, and diff images when the comparison fails.

### Negative control

`color.primary` does not exist. Use the accent tokens.

In the pinned image, after baselines exist:

1. Set `color.light.accent` from `#D9481E` to `#D8481E`.
2. Set `color.dark.accent` from `#FF7A4C` to `#FE7A4C`.
3. Run `npm run vr`.
4. Expect a non-zero exit and a visible diff artifact.
5. Restore both tokens.
6. Do not run `npm run vr:update`.

### README paragraph

Baseline mode compares the current component code with committed tokens and with `HEAD` tokens. It can catch a token change that does not change pixels. It can miss a component change that both columns share. The screenshot suite compares pixels with committed PNGs. It can catch a visible component change that baseline mode shares. It cannot catch an unused token change.
