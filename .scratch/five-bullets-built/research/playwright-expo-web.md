# Playwright on the Expo web export, measured

Answers ticket `02-playwright-on-expo-web.md`. Research only. Nothing here
was run. The two companion files, `playwright.config.example.ts` and
`frame.spec.example.ts`, show the shape of the setup, not a tested one.

Versions at the time of reading (2026-10-15):

- `@playwright/test` latest on npm: **1.64.1** (docs pages show 1.64.0 in
  the Docker tags). Source: `https://registry.npmjs.org/@playwright/test/latest`.
- Expo SDK 57 docs: `https://docs.expo.dev/versions/v57.0.0/`.
- Repo: `expo ~57.0.14`, `react-native-web ~0.21.0`,
  `react-native-reanimated 4.5.1` (`mobile/package.json`). CI runs Node 22
  on `ubuntu-latest` (`.github/workflows/pages.yml`).

## 0. What the repo already gives the test

- `npm run export:web` runs `scripts/export-web.sh`, which calls
  `npx expo export --platform web --output-dir ../dist` from `mobile/` and
  then verifies the bundle has no writer URL. Output is `dist/`.
- `npm run preview` runs `scripts/serve-static.mjs`: HOST `127.0.0.1`,
  PORT `8080`, and `/ide` resolves to `dist/ide.html`
  (`scripts/static-files.mjs` tries `base`, `base.html`, `base/index.html`).
  The server prints `read-only web  →  http://127.0.0.1:8080/ide`.
- Frames on the board carry a real DOM id from `nativeID`:
  `#screen-<key>` for the current column and `#base-<key>` for the HEAD
  column (`mobile/src/ide/boardFrames.ts`, `frameId`, `FRAME_PREFIX`,
  `BASELINE_PREFIX`). `frameSelector()` returns
  `[id^="screen-"], [id^="base-"]`. `boardFrames.ts` has one `import type`
  and no runtime imports, so a Node test runner can import it.
- The board row is a `View` with `transform: [{ scale }]` and
  `transformOrigin: 'top left'`; `scale` starts at **0.5** and only
  ctrl+wheel changes it, in steps of 0.03 (`mobile/src/ide/Blueprint.tsx`,
  `useState(0.5)`, `handleWheel`). Each frame's artboard is 390 × 820 CSS px
  before the transform (`PHONE`). The row sits inside a horizontal
  `ScrollView` inside a vertical one.
- The colour scheme is app state (`mobile/src/ds/editorState.ts`,
  `scheme: 'light'` default) that a `Pressable` with the text `light` /
  `dark` sets (`mobile/src/ide/TokenPanel.tsx`). It is not the OS
  `prefers-color-scheme` media query.
- The one JS-driven animation is Reanimated `withTiming(..., 700ms)` on
  `Meter` (`mobile/src/ui/index.tsx`). No `expo-image` import exists in
  `mobile/src` today (`expo-image` is only in `package.json`). Demo dates are
  fixed UTC dates (`mobile/src/store/habitDates.ts`).
- Fonts: `mobile/src/global.css` asks for `Spline Sans, Inter, ui-sans-serif,
  system-ui, ...` and sets `-webkit-font-smoothing: antialiased`. No font
  file ships yet (ticket 03).

## 1. Install footprint and CI steps

### Package size

From the npm registry (`unpackedSize`, 1.64.1):

| package | unpacked | deps |
| --- | --- | --- |
| `@playwright/test` | 28.5 KB | `playwright` |
| `playwright` | 5.0 MB | `playwright-core` |
| `playwright-core` | 13.7 MB | none |

So ≈ **18.7 MB** in `node_modules`, three packages, no transitive tree.
Engines: `node >= 20`. Browser binaries live outside `node_modules`: on
Linux in `~/.cache/ms-playwright`, on macOS in
`~/Library/Caches/ms-playwright`; Chromium is listed at ~281 MB
(https://playwright.dev/docs/browsers#managing-browser-binaries).

Where to put it: the root `package.json` has no dependencies today and
`npm test` is `node --test`. The map says Playwright is a separate script.
A root devDependency creates a root `package-lock.json`; `pages.yml` then
needs `cache-dependency-path` to list both lockfiles. Putting it in
`mobile/package.json` instead keeps one lockfile but ties the test runner to
the app's dependency tree. Either works; the config example assumes root.

### Install commands

- `npx playwright install --with-deps chromium` installs the browser and
  the OS packages in one step
  (https://playwright.dev/docs/browsers#install-system-dependencies).
- Headless runs use the **chromium headless shell**, a separate build from
  full Chromium. `npx playwright install --with-deps --only-shell` skips the
  full Chromium download when no `channel` is set
  (https://playwright.dev/docs/browsers#chromium-headless-shell). Setting
  `channel: 'chromium'` switches to Chrome's new headless mode, which renders
  differently; pick one and keep it, because the baselines belong to it.

### GitHub Actions steps (host runner)

From https://playwright.dev/docs/ci#github-actions, adapted to this repo:

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: npm
    cache-dependency-path: |
      package-lock.json
      mobile/package-lock.json
- run: npm ci                       # root: @playwright/test
- run: npm ci                       # app
  working-directory: mobile
- run: npx playwright install --with-deps --only-shell chromium
- run: npm run export:web
- run: npx playwright test
- uses: actions/upload-artifact@v4
  if: ${{ !cancelled() }}
  with:
    name: visual-regression
    path: |
      playwright-report/
      test-results/
    retention-days: 14
```

The docs recommend `workers: 1` in CI and a `globalTimeout`
(https://playwright.dev/docs/ci#workers,
https://playwright.dev/docs/ci#global-timeout).

### Caching

The docs say caching browser binaries is **not recommended**: restoring
the cache takes about as long as the download, and on Linux the OS
dependencies are not cacheable anyway
(https://playwright.dev/docs/ci#caching-browsers). If wanted, cache
`~/.cache/ms-playwright` keyed on the Playwright version, and still run
`npx playwright install-deps chromium` on every run:

```yaml
- uses: actions/cache@v4
  id: pw
  with:
    path: ~/.cache/ms-playwright
    key: pw-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
- if: steps.pw.outputs.cache-hit != 'true'
  run: npx playwright install --only-shell chromium
- run: npx playwright install-deps chromium
```

The Docker-container variant (§3) needs no install step at all, which is
the simplest cache.

## 2. `toHaveScreenshot`: naming, storage, thresholds, cross-OS

### Naming and storage

Source: https://playwright.dev/docs/test-snapshots and
https://playwright.dev/docs/api/class-testconfig#test-config-snapshot-path-template.

- First run writes the golden file and **fails** ("A snapshot doesn't
  exist ... writing actual"). Default `updateSnapshots: 'default'`: missing
  snapshots are created but the test fails so CI never passes silently.
  Modes: `all`, `changed`, `missing`, `none`, `default`.
- Default path: `<spec>.spec.ts-snapshots/<name>-<project>-<platform>.png`,
  e.g. `frame-1-chromium-darwin.png`. The suffix is the browser (or project
  name when projects exist) plus `process.platform`. On Linux CI it is
  `-linux`, on a Mac `-darwin`: **two different files by default**.
- `snapshotPathTemplate` controls the path with tokens `{arg}`, `{ext}`,
  `{platform}`, `{projectName}`, `{testDir}`, `{testFileDir}`,
  `{testFileName}`, `{testFilePath}`, `{testName}`. Dropping `{platform}`
  from the template gives one baseline file per screenshot regardless of OS.
  The example config does that on purpose (one Linux baseline, see §3).
- Named snapshots: `toHaveScreenshot('login-light.png')` or an array of
  path segments. The path must stay inside that spec's snapshot folder.
- Golden files are committed. On a failure Playwright writes three files
  into `test-results/<spec>-<test>-<project>/`: `<name>-expected.png`,
  `<name>-actual.png`, `<name>-diff.png`, and attaches them to the report
  with those suffixes (source:
  `packages/playwright/src/matchers/toMatchSnapshot.ts`, `addSuffixToFilePath(..., '-expected' | '-actual' | '-diff' | '-previous')`;
  file layout described in
  https://github.com/microsoft/playwright/issues/22064).
- PNG by default; `.webp` is also lossless and supported.

### Thresholds

Source: https://playwright.dev/docs/api/class-pageassertions#page-assertions-to-have-screenshot-1.

- `threshold` (0..1, default **0.2**): per-pixel YIQ colour distance that
  counts as "different". It is the pixelmatch threshold.
- `maxDiffPixels` (absolute) and `maxDiffPixelRatio` (0..1): how many
  different pixels the assertion tolerates. Both unset by default, so one
  pixel fails.
- Set once in `expect.toHaveScreenshot` in the config, or per call.
- The assertion retries until two consecutive screenshots are identical,
  then compares the last one. `timeout` defaults to `expect.timeout`
  (5000 ms).

### Stable between a Mac dev machine and Linux CI?

**No, not even with bundled fonts.** The docs warn: "Browser rendering can
vary based on the host OS, version, settings, hardware, power source,
headless mode, and other factors. For consistent screenshots, run tests in
the same environment where the baseline screenshots were generated"
(https://playwright.dev/docs/test-snapshots#introduction). Bundling the
font (ticket 03) fixes which glyph outlines are used; it does not make
macOS CoreText and Linux FreeType rasterise them to the same pixels, and
any glyph outside the bundled face (emoji, `·`, fallback weights) still
comes from a different system font. The `antialiased` smoothing rule in
`global.css` is macOS-only and widens the gap. Ticket 03 should decide
whether to drop it.

So baselines are **Linux-only**. The two ways to get Linux pixels on a Mac:

## 3. The Docker / Linux-baseline pattern

Source: https://playwright.dev/docs/docker and
https://playwright.dev/docs/ci#via-containers.

- Image: `mcr.microsoft.com/playwright:v1.64.0-noble` (Ubuntu 24.04). Tags
  also exist for `-jammy` (22.04) and `-resolute` (26.04). The image holds
  browsers and OS deps but **not** the npm package; the tag **must match**
  the installed `@playwright/test` version or Playwright cannot find the
  browser.
- Run with `--init` and `--ipc=host` (Chromium can run out of memory
  without it). Root user is fine for trusted end-to-end tests.
- CI can run the whole job in the container, which the docs call out as the
  way to get "a consistent environment for e.g. screenshots/visual regression
  testing across different operating systems":

```yaml
jobs:
  visual:
    runs-on: ubuntu-latest
    container:
      image: mcr.microsoft.com/playwright:v1.64.1-noble
      options: --user 1001 --ipc=host
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci && (cd mobile && npm ci)
      - run: npm run export:web
      - run: npx playwright test
```

- Local baseline update on a Mac, same image:

```sh
docker run --rm --init --ipc=host \
  -v "$PWD":/work -w /work \
  mcr.microsoft.com/playwright:v1.64.1-noble \
  sh -c 'npm ci && cd mobile && npm ci && cd .. && npm run export:web && npx playwright test --update-snapshots'
```

  Reinstalling inside the container matters only if `node_modules` holds
  platform-specific binaries. Expo's Metro export is pure JS, so a host
  `node_modules` mounted in may work; `npm ci` inside is the safe default.

- Guard the Mac host: either `ignoreSnapshots: process.platform !== 'linux'`
  in the config (https://playwright.dev/docs/api/class-testconfig#test-config-ignore-snapshots),
  so a bare `npx playwright test` on a Mac still exercises the page but
  skips pixel comparison, or `test.skip(process.platform !== 'linux')`.
  The example config uses `ignoreSnapshots`.

- Alternative without Docker: a CI job that runs with
  `--update-snapshots` on a label and commits the result. Same Linux
  pixels; slower feedback. Ticket 08 picks.

Note the headless-shell detail from §1: the Docker image and the host
runner both default to the headless shell, so baselines made in one match
the other at the same version.

## 4. Waiting for Expo web / RNW to settle

What can still move after `page.goto` resolves on this page:

1. **Fonts.** Today none are bundled, so the fallback stack renders at
   once. After ticket 03, `expo-font` on web injects an `@font-face` block
   (https://docs.expo.dev/versions/v57.0.0/sdk/font/#loadasyncfontfamilyorfontmap-source)
   and the static export inlines a `<link rel="preload" as="font">` plus the
   `@font-face` into the HTML when the font is loaded synchronously through
   `useFonts`/`loadAsync`
   (https://docs.expo.dev/router/reference/static-rendering/#fonts). The
   browser signal is `document.fonts.ready`:
   `await page.evaluate(() => document.fonts.ready)`. Pair it with a check
   that the family is actually in use, e.g.
   `document.fonts.check('16px "Spline Sans"')`, so a missing font fails
   the run rather than silently baselining the fallback.
2. **CSS animations / transitions / WAAPI.** `toHaveScreenshot` defaults to
   `animations: 'disabled'`: finite animations are fast-forwarded to the
   end, infinite ones reset
   (https://playwright.dev/docs/api/class-pageassertions). Nothing to
   configure.
3. **Reanimated `withTiming`** is JS-driven on web, so Playwright's
   animation freeze does not see it. Reanimated defaults every animation to
   `ReduceMotion.System`; when the system prefers reduced motion,
   `withTiming` and `withSpring` "return the `toValue` immediately"
   (https://docs.swmansion.com/react-native-reanimated/docs/guides/accessibility/).
   On web the system value is read once at module load from
   `window.matchMedia('(prefers-reduced-motion: reduce)')`
   (`react-native-reanimated/src/ReducedMotion.ts`). Playwright's
   `reducedMotion: 'reduce'` context option emulates that media query
   before the page loads, so `use: { reducedMotion: 'reduce' }` lands the
   `Meter` at its final width with no 700 ms wait. This is the key wait
   predicate for RNW apps: **set `reducedMotion: 'reduce'`**, do not sleep.
4. **`expo-image`.** Not used in `mobile/src` today. If a screen adds it:
   on web it renders an `<img>` with `loading="lazy"` by default under the
   default `responsivePolicy: 'static'`
   (https://docs.expo.dev/versions/v57.0.0/sdk/image/#loading), so an image
   off-screen in the horizontal board is not fetched until scrolled near.
   `locator.screenshot` scrolls the frame into view first, but the
   screenshot can race the fetch. Two fixes: pass `loading="eager"` on
   images that must be in the baseline, and wait in the test with
   `page.waitForFunction(() => [...document.images].every(i => i.complete))`.
   The `transition` prop defaults to 0 ms, so no cross-fade to wait for.
5. **Hover.** Screenshots capture hover state; move the mouse to `(-1,-1)`
   first (https://playwright.dev/docs/test-snapshots#hover-effects).
6. **Honest zero.** `boardFrames.ts` exists because a walk that finds zero
   frames looks like a quiet board. The spec should `expect(frames).toHaveCount(N)`
   with the committed screen count before any screenshot, so an empty
   board fails loudly rather than producing seven missing-snapshot errors.

Then `toHaveScreenshot`'s own "two consecutive identical screenshots" loop
covers whatever is left.

## 5. One frame element vs. the whole page

- `locator.screenshot` / `expect(locator).toHaveScreenshot()` clip to the
  element's bounding box, wait for actionability, and **scroll the element
  into view** first
  (https://playwright.dev/docs/api/class-locator#locator-screenshot). Nested
  scroll containers are handled by `scrollIntoViewIfNeeded`. Content
  covered by other elements is captured as covered.
- A page screenshot of `/ide` would include the header badges
  (`DiskBadge`, `PressBadge`, `RenderVerdictBadge`), the zoom pill, and the
  horizontal scroll position. Those change for reasons that are not the
  screens. Frame screenshots exclude them without `mask`.
- Locating a frame: `page.locator('#screen-login')`, built with
  `frameId('login')` imported from `mobile/src/ide/boardFrames.ts`. Discover
  all: `page.locator('[id^="screen-"]')` (`frameSelector()` also matches
  the `base-` column, so filter or use the prefix alone). The ordered key
  list lives in `screens.ts`, which uses Metro's `require.context` and
  cannot be imported in Node; the spec needs its own list or reads ids off
  the page and asserts the count.
- **The 0.5 board scale.** The frame element is 390 × 820 CSS px under a
  `scale(0.5)` on its parent, so its bounding box, and therefore the PNG,
  is 195 × 410 CSS px. Three options, in order of preference:
  1. Ticket 06 is adding URL state; a `?scale=1` (or the Present mode
     itself, one screen large) is the clean hook. Then the test navigates to
     the URL and the frame is 390 × 820.
  2. `stylePath` CSS that overrides the inline transform during the
     screenshot only: `:has(> [id^="screen-"]) { transform: none !important; }`.
     Needs a spike to confirm the bounding box is taken after the style is
     applied; the example spec shows the file but does not rely on it.
  3. Keep 0.5 and set `deviceScaleFactor: 2` with `scale: 'device'`: the
     PNG is 390 × 820 device px. Text is rasterised through a transform,
     which is a different pixel path from a 1× render; stable, but not the
     "same pixels as a phone" claim.
  Driving ctrl+wheel from the test is not exact: 0.5 + 0.03·n never equals
  1.0.
- Dark scheme: click the `dark` Pressable
  (`page.getByText('dark', { exact: true })`) and re-screenshot; or a URL
  param from ticket 06. Playwright's `colorScheme` option does not apply
  because the app does not read `prefers-color-scheme`.

## 6. DPR and viewport

- `deviceScaleFactor` and `viewport` are context options set in `use`
  (https://playwright.dev/docs/emulation#viewport). Unset DPR is 1.
- `toHaveScreenshot`'s `scale` option: `'css'` (default) gives one pixel per
  CSS pixel, so a DPR-2 context still writes a 1× PNG; `'device'` writes one
  pixel per device pixel, "twice as large or even larger"
  (https://playwright.dev/docs/api/class-pageassertions). To bank 2× pixels
  you need **both** `deviceScaleFactor: 2` and `scale: 'device'`.
- Weight: a 390 × 820 frame at 1× is ~50–150 KB PNG for flat UI; at 2× it is
  roughly 3–4×. Seven screens × two schemes ≈ 14 PNGs; 1× ≈ 1–2 MB
  committed, 2× ≈ 4–7 MB. Ticket 08 owns the trade.
- Viewport: wide enough that the ScrollView does not clip the frame being
  shot and tall enough for the frame plus its label row at the chosen
  scale. The example uses 1600 × 1000. Do not spread `devices['Desktop Chrome']`
  without overriding `viewport` after it
  (https://playwright.dev/docs/emulation#viewport).

## 7. Artifacts, PR comments, job summary

- Upload `playwright-report/` and `test-results/` with
  `actions/upload-artifact@v4`, `if: ${{ !cancelled() }}`
  (https://playwright.dev/docs/ci#github-actions). The HTML report is
  self-contained and shows expected/actual/diff side by side with a slider;
  `npx playwright show-report playwright-report.zip` opens a downloaded
  artifact directly
  (https://playwright.dev/docs/test-reporters#html-reporter). v4 artifacts
  are immutable per name
  (https://docs.github.com/en/actions/how-tos/writing-workflows/choosing-what-your-workflow-does/storing-and-sharing-data-from-a-workflow).
- The `github` reporter adds failure annotations to the checks view
  (https://playwright.dev/docs/test-reporters#github-actions-annotations).
  Use `[['github'], ['html', { open: 'never' }]]` in CI.
- **Job summary**: `GITHUB_STEP_SUMMARY` accepts GitHub-flavoured Markdown,
  1 MiB per step
  (https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/workflow-commands-for-github-actions#adding-a-job-summary).
  Images render **only from a public absolute URL**; relative paths and
  artifact files do not render
  (https://github.com/orgs/community/discussions/43607,
  https://github.com/orgs/community/discussions/101814). So the summary can
  list failing frames with diff-pixel counts and link to the artifact, but
  cannot show the diff PNG from the artifact.
- **PR comment**: same constraint. To embed a diff image, the PNG must be
  reachable by URL: push it to an orphan branch and reference
  `raw.githubusercontent.com/<owner>/<repo>/<branch>/<path>` (works because
  the repo is public), or publish the HTML report to Pages. A comment body
  with text and an artifact link needs `pull-requests: write` and
  `actions/github-script`; the image route needs `contents: write` for the
  branch push. Ticket 08 decides whether that is worth it or whether the
  studio's own Regression tab, reading a committed report, is the surface.
- The studio-facing `vr-report.json` (ticket 08) can come from a small
  custom reporter (`onTestEnd` gets `result.status` and `result.attachments`
  with the `-expected/-actual/-diff` paths), or from the built-in `json`
  reporter plus a post-processing script.

## 8. Is `pixelmatch` + `pngjs` needed?

No. Playwright's comparator **is** pixelmatch: "Playwright Test uses the
pixelmatch library" with `threshold`, `maxDiffPixels`, `maxDiffPixelRatio`
(https://playwright.dev/docs/test-snapshots#maxdiffpixels-and-threshold),
and it writes the diff PNG itself. Adding `pixelmatch` (36.8 KB on npm) and
`pngjs` only makes sense if ticket 08 wants numeric diff ratios in its own
JSON without parsing Playwright's error text ("N pixels (ratio X of all
image pixels) are different") or reading the diff PNG. Start without them.

## Recommendation for ticket 08

1. Add `@playwright/test@1.64.x` as a root devDependency; CI runs the job inside `mcr.microsoft.com/playwright:v<same>-noble` so no install step and Linux pixels by construction.
2. Baselines are Linux-only: `snapshotPathTemplate` without `{platform}`, committed under `e2e/__screenshots__/`, `ignoreSnapshots` off-Linux, updates via the Docker one-liner in §3.
3. One PNG per frame per scheme via `expect(page.locator('#screen-<key>')).toHaveScreenshot(...)`; never a board PNG.
4. Fix DPR at 1 with `scale: 'css'` unless the 2× weight is accepted; fix the board at scale 1 through ticket 06's URL state, not ctrl+wheel.
5. Wait predicate: `reducedMotion: 'reduce'` + `document.fonts.ready` + `fonts.check` + `toHaveCount(N)` on frames; add the images-complete wait only when `expo-image` enters a screen.
6. Thresholds: start `maxDiffPixelRatio: 0`, `threshold: 0.2`; loosen only with a recorded reason.
7. Upload `playwright-report/` + `test-results/`; use the `github` reporter; write a text summary with counts and a link, not images.
8. Negative control: shift `color.primary` one step, run in Docker, confirm `-diff.png` appears in `test-results/`; record the command.
9. Skip `pixelmatch`/`pngjs`; a custom reporter writes `vr-report.json` from attachments.
10. Serve with `webServer: { command: 'npm run preview', url: 'http://127.0.0.1:8080/ide' }` after an explicit `npm run export:web` step.
