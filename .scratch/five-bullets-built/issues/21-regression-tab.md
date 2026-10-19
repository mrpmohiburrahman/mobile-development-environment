# 21 — Regression tab

Type: task
Status: resolved
Labels: resolved
Blocked by: 20 — Screenshot suite and CI
Map: ../map.md
Spec: ../spec.md

## What to build

The studio gains a Regression tab that displays the bundled screenshot record as text. It names the source commit that produced the baselines, or it says no screenshot run on record. It never fetches CI, embeds images, or calls a different build a pass.

## Acceptance criteria

- [x] The studio imports the screenshot record and the static export bundles it. The tab does not fetch it at runtime.
- [x] With a record the tab reads approved at the recorded commit and lists each case with its scheme, state, and baseline path.
- [x] With no record the tab reads no screenshot run on record. That state is visibly different from a pass.
- [x] The tab does not embed PNGs, link to CI artifacts, or claim the current build passed.
- [x] RenderVerdict stays a fidelity line. The screenshot result is not added to it.
- [x] A newer HEAD than the record commit does not by itself fail the tab or CI.
- [x] `npm test`, lint, and typechecking pass.

## Answer

`mobile/src/ide/regressionNote.ts` holds the copy. It is pure. It reads only the record and does not read HEAD, CI, or the file system.

- `regressionNote(record)` returns `approved` or `none`.
- `approved` has the headline `Approved at <short commit>`. The details give the full source commit, the image, the environment, the PNG size and DPR, the CSS size, and the case count. Each case gives its id, screen, scheme, state, and baseline path. The caveat says that the record does not show that this build passed, and that HEAD can be newer than the source commit.
- `none` has the headline `No screenshot run on record`. The detail says that no baseline is approved. A record that is not readable also gives `none`, with a detail that says so. These conditions make a record not readable: no full 40-character commit, no cases, a case with a missing field, or a repeated case id.

An absent record is the JSON value `null` in `mobile/src/ide/screenshot-record.json`. The import still resolves, so the studio still builds. `validateScreenshotRecord` reports `null` as a missing record, so CI fails.

`mobile/src/ide/RegressionPanel.tsx` imports `./screenshot-record.json`. Metro bundles it into the static export. The panel renders text only: no image, no link, no fetch. The approved headline uses the chrome text colour. The none headline uses the amber `TONE.degraded`, and it has a separate `#regression-none` node. Neither state uses the green ok tone.

`mobile/src/app/ide.tsx` adds the `regression` tab after `analytics`.

`RenderVerdict.tsx` does not change. `isFullCommit` moved into `screenshotMatrix.ts` so that the note and the record validation use one commit check.

## Verification

Run on 2026-10-19 on the Mac.

- `npm test`: 498 tests passed. `test/regressionNote.test.ts` covers both states, the case list, the unreadable records, the pass wording, an older source commit, the committed record, the panel source, and `RenderVerdict`.
- `npx tsc --noEmit` and `npx expo lint --no-cache` in `mobile/`: passed.
- `npm run export:web`: the entry bundle holds the recorded source commit.
- Chromium on the export: the tab read `Approved at cce6d9c` and listed 16 cases. The note held no image and no link. The tab sent no request. The page had no errors.
- An export with the record set to `null`: typechecking passed, and the tab read `No screenshot run on record` with no approved node. The record was restored after the check.
- Review: findings on dead code, duplicate ids, the CSS size, and brittle tests were addressed. The tab does not compare the record with the live matrix. CI does that check.
