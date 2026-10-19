# 20 — Screenshot suite and CI

Type: task
Status: resolved
Labels: resolved
Blocked by: 16 — Weekday fix and layout hook, 17 — Capture mode
Map: ../map.md
Spec: ../spec.md

## What to build

A Playwright suite captures the screenshot matrix from the static export and compares it with committed Linux baselines. A developer updates baselines only inside the pinned image. CI fails on a missing baseline, a missing record, a skip, or a pixel difference. A planted one-step accent change fails with a visible diff.

## Acceptance criteria

- [x] The suite derives the matrix from the screen registry, both schemes, and the empty Habit detail state. The current matrix has 16 cases. A new registered screen without baselines fails.
- [x] Chromium uses a 480 by 900 CSS viewport and DPR 2. Each capture is the app surface element at device scale, 780 by 1640 pixels.
- [x] The suite waits for the ready attribute. It does not sleep. It sets the process and browser timezone to UTC.
- [x] Comparison uses the built-in differ with threshold 0 and maximum differing-pixel ratio 0. Two captures of an unchanged tree match before any baseline is accepted.
- [x] `vr` compares. `vr:update` writes baselines and the screenshot record, and it refuses to run outside the pinned Linux image. The image tag matches the installed Playwright version. The container architecture is pinned, including local runs on Apple Silicon.
- [x] Off the pinned image the command reports comparison skipped and that result is not a pass. With the require-compare flag a skip fails.
- [x] The record names the tested source commit, environment, image, dimensions, DPR, and each case. It is written only after successful generation. Capture inputs are committed before the source commit is recorded. The command does not commit.
- [x] CI runs an independent job on pull requests and pushes to the default branch. It exports, serves, and compares inside the pinned image. It uploads the report on every run and the diff images on failure. CI does not commit baselines.
- [x] A planted accent change fails with a visible diff. Light moves from #D9481E to #D8481E. Dark moves from #FF7A4C to #FE7A4C. Restoring both tokens passes again. No baseline update runs during the proof.
- [x] The measured PNG weight is recorded after generation. The research estimate is not used as a budget.
- [x] `npm test` stays the Node runner. The Playwright scripts are separate. Lint and typechecking pass.

## Answer

`mobile/src/ide/screenshotMatrix.ts` holds the pure screenshot contract. It does not read `window`, `document`, or the file system.

- `screenshotMatrix` builds the cases from the screen keys and both schemes. It adds the two empty cases only when the registry holds Habit detail.
- The module holds the geometry and three option sets. `CAPTURE_CONTEXT` sets the browser context. `CAPTURE_SCREENSHOT` sets the screenshot. `DIFF_OPTIONS` sets threshold 0 and ratio 0. The driver, the Playwright config, and the spec all read these constants.
- `evaluatePin` decides the pin from facts. The platform must be `linux`, the architecture `arm64`, and the OS Ubuntu `noble`. `PLAYWRIGHT_BROWSERS_PATH` must be `/ms-playwright` and hold the Chromium build for the installed Playwright. `VR_IMAGE` must equal the tag from `package.json`. Environment variables alone cannot pin a Mac.
- `compareVerdict` returns compare, skip, or fail. The skip text starts with `comparison skipped` and says the result is not a pass.
- `buildScreenshotRecord` and `validateScreenshotRecord` write and check the record. The record names `sourceCommit`, the environment, the image, the Playwright version, the geometry, DPR, the total bytes, and each case. Validation needs a full 40-character commit.

`vr/` drives the suite.

- `vr/registry.ts` holds the one router walk. `test/helpers/routerListing.ts`, the driver, and the spec all use it.
- `vr/env.ts` reads the pin facts. `vr/baselines.ts` checks the record and each PNG size.
- `vr/run.mjs compare` checks the record and the baselines, serves the export in-process, and captures the matrix twice. Then it runs the Playwright runner against that server. The runner compares with `toHaveScreenshot`. The runner never writes baselines (`updateSnapshots: 'none'`).
- `vr/run.mjs update` refuses off the pin. It also refuses while any file other than the baselines and the record is uncommitted. Then it captures twice and writes the PNGs and the record. It records `git rev-parse HEAD`. It does not commit.
- If two captures differ, the driver stops. It names each case with the cause from the Playwright comparator and writes the first, second, and diff PNGs to `test-results/vr/repeatability/`. It does not widen the threshold.
- Each run writes `test-results/vr/status.json`. `vr/summary.mjs` turns it into the CI job summary. A missing or unfinished status reads as an infrastructure failure, not a comparison result.
- `vr/proof.mjs` plants both accents, exports, and compares. It keeps the diff evidence, restores the tokens, exports again, and compares again. It checks that the baselines and the record did not change.

`scripts/vr-docker.sh` runs `vr`, `vr:update`, or `vr:proof` in the pinned image as `linux/arm64`. It mounts the repository and its git directory at their host paths, so git reads the real HEAD. Linux `node_modules` live in named volumes.

Commands:

- `npm run vr` compares. Off the pin it prints the skip and exits 0. With `VR_REQUIRE_COMPARE=1` it exits 1.
- `npm run vr:update` writes the baselines and the record in the pinned image only.
- `npm run vr:proof` runs the planted proof in the pinned image only.
- `npm run vr:docker -- vr|vr:update|vr:proof` runs a command in the pinned image from a Mac.

CI runs an independent `visual-regression` job in `.github/workflows/studio-guard.yml` on pull requests and default-branch pushes. It runs on `ubuntu-24.04-arm` in the pinned container with `--platform linux/arm64`. It installs, exports, and runs `npm run vr`, which serves and compares. It writes the job summary on every run. It uploads the Playwright report on every run and the diff images on failure. It does not update or commit baselines. `test/workflow.test.ts` checks that the job image matches the installed Playwright version.

The measured PNG weight is 1270796 bytes for the 16 baselines. The record holds that value.

## Verification

Run on 2026-10-19 with colima on Apple Silicon. The pinned image ran as `linux/arm64`.

- `npm test`: all tests passed. `test/screenshotMatrix.test.ts` covers the matrix, the record, the pin, and the skip. `test/workflow.test.ts` covers the job.
- `npx tsc --noEmit` and `npx expo lint --no-cache` in `mobile/`: passed in the pinned image.
- `npm run vr:docker -- vr`: 16 cases passed at threshold 0 after both captures matched.
- `npm run vr:docker -- vr:update` on this uncommitted tree: refused with the list of uncommitted files and exit 1.
- `vr:update` in the pinned image on a throwaway committed copy: recorded that copy's HEAD and wrote 16 PNGs. All 16 were byte-identical to the committed baselines, and only the record changed. The command made no commit.
- `npm run vr:docker -- vr:proof`: the planted compare exited 1 with 14 diff images. The restored compare exited 0. The baselines and the record were unchanged. The two empty Habit cases have no accent, so they passed.
- On the Mac: `npm run vr` printed the skip and exited 0. `VR_REQUIRE_COMPARE=1 npm run vr` exited 1. `npm run vr:update` exited 1, also with `VR_IMAGE`, `VR_ARCH`, and `PLAYWRIGHT_BROWSERS_PATH` set.

The committed record still names source commit `cce6d9c73a29a90927c44d0e1ffb67ec1056d962`, migrated to the new field names. After you commit this work, run `npm run vr:docker -- vr:update` to stamp the new HEAD. The PNGs do not change.
