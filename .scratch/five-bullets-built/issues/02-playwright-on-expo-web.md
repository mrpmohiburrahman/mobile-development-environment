# 02 — Playwright on Expo web export, measured

Type: research
Status: resolved
Blocked by: —
Map: ../map.md

## Question

What is the smallest working setup that takes deterministic screenshots of
each screen frame on the `/ide` route from the **static web export**
(`npm run export:web` + `npm run preview`), in CI on `ubuntu-latest`, and
diffs them against committed PNGs?

Surface, with sources:

- `@playwright/test` install footprint on this repo: devDependency size,
  `npx playwright install --with-deps chromium` in CI, and caching.
- Playwright's built-in `toHaveScreenshot` — baseline naming per
  platform/browser, `maxDiffPixelRatio`/`threshold`, how it stores
  `-expected.png` files, and whether its snapshots are stable between a Mac
  dev machine and Linux CI **when fonts are bundled** (ticket 03). If not,
  the recommended pattern (Docker image `mcr.microsoft.com/playwright`, or
  Linux-only baselines).
- How to wait for Expo web / RNW to settle: `document.fonts.ready`,
  animations off (`reducedMotion`, `animations: 'disabled'`), and whether
  `expo-image` loads need a wait.
- Screenshotting one frame element (`locator.screenshot`) vs. full page,
  given the board is a scrolling, zoomable row — and how the existing
  `boardFrames.ts` finds frames so a test can too.
- Setting `deviceScaleFactor` and viewport so DPR is fixed.
- How the diff artifacts (actual/expected/diff PNGs) are uploaded from
  GitHub Actions and whether a PR comment or job summary can embed them.
- Whether `pixelmatch` + `pngjs` is needed at all, or Playwright's differ
  suffices.

Deliver as `research/playwright-expo-web.md` on branch
`research/playwright-expo-web`, with a minimal `playwright.config.ts` and
one spec that screenshots one frame, **not run** — the configuration and the
reasoning, so ticket 08 can decide the contract.

## Answer

Full findings: [`research/playwright-expo-web.md`](../research/playwright-expo-web.md), with [`playwright.config.example.ts`](../research/playwright.config.example.ts) and [`frame.spec.example.ts`](../research/frame.spec.example.ts).

- Mac and Linux baselines never match even with bundled fonts (CoreText vs FreeType). Baselines are Linux-only: drop `{platform}` from `snapshotPathTemplate`, run in `mcr.microsoft.com/playwright:v<npm version>-noble`, update locally via the same image, `ignoreSnapshots` off-Linux.
- Footprint: `@playwright/test` ≈18.7 MB, zero transitive deps. `npx playwright install --with-deps --only-shell chromium` or none in-container. Browser caching not worth it.
- Wait predicate: `reducedMotion: 'reduce'` (Reanimated jumps `withTiming` to end) + `document.fonts.ready` + `fonts.check(family)` + `toHaveCount(7)` on `[id^="screen-"]` as the honest zero.
- Frame-level `expect(locator).toHaveScreenshot()` via `frameId(key)` from `boardFrames.ts` — but the board renders at `scale(0.5)`; the scale must be pinned to 1 for the run. Hook: ticket 06's URL state or a `stylePath` override. DPR 2 needs `deviceScaleFactor: 2` and `scale: 'device'`.
- Playwright's differ is pixelmatch; no extra dependency. Job summaries cannot embed artifact images — surface counts + artifact link.
