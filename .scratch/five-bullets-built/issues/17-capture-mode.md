# 17 — Capture mode

Type: task
Status: resolved
Labels: resolved
Blocked by: 13 — Board in the normal studio, 14 — Bundled font
Map: ../map.md
Spec: ../spec.md

## What to build

A query on the studio route renders one app surface at scale 1 for screenshot capture. The surface becomes ready only after fonts, fixture, scheme, and size settle. Invalid requests never become ready. Capture mode ignores shared links and token overrides. The static export honors the query.

## Acceptance criteria

- [x] The static export honors `capture`, `screen`, `scheme`, and `state` query parameters without a development-only gate.
- [x] Capture mode renders one app surface of 390 by 820 CSS pixels at scale 1, using the real screen components. It excludes the frame header, footer, route connections, and studio controls.
- [x] The fixture applies before the first paint. Populated Habit detail selects Morning run. Empty Habit detail has no selection. Other screens use the signed-in seed.
- [x] Capture mode ignores the shareable hash and all token overrides. It renders committed tokens only.
- [x] An unknown screen, scheme, or state never sets the ready attribute. An empty state on any screen but Habit detail does the same. Each case displays a diagnostic error.
- [x] The ready attribute appears only after the fixture, scheme, size, committed tokens, font availability, image completion, and reduced-motion final state all hold.
- [x] Missing fonts or failed images never become a successful capture. A sleep is not the wait.
- [x] Browser checks cover a valid capture and an invalid request on the static export.
- [x] `npm test`, lint, and typechecking pass.

## Answer

`mobile/src/ide/captureMode.ts` holds the pure capture contract. It does not read `window` or `document`.

- `parseCaptureSearch` parses `capture`, `screen`, `scheme`, and `state` against the screen registry.
- A query without the `capture` parameter stays inactive. The normal studio opens.
- `capture` must be `1`. `scheme` must be `light` or `dark`. `state` must be `populated` or `empty`.
- Only `habit` accepts `empty`. Every invalid query returns a diagnostic error.
- `captureFixtureFor` selects `h1` for populated Habit detail and `null` for empty Habit detail. Every other screen uses the signed-in seed.
- `expectedMeterScales` computes the final `scaleX` values for `Meter` bars on each screen.
- `evaluateCaptureReadiness` checks the fixture, scheme, zero overrides, committed tokens, 390 by 820 size, and scale 1. It also checks Spline Sans weights 400, 600, and 700, image completion, reduced motion, and final `Meter` scales.

`mobile/src/ide/CaptureSurface.tsx` connects the contract to the studio route in `mobile/src/app/ide.tsx`.

- `useCaptureOutcome` reads the query after server hydration. It does not change a store.
- A layout effect applies the fixture. The screen component mounts only after the stores match the fixture. Thus the screen never paints with a different state.
- `TokensFrom` pins the surface to the committed `tokens.json` tree. Shareable hash state and token overrides do not apply.
- A probe inside `TokensFrom` reads the token tree that the screen receives. Readiness requires that tree to be the committed tree.
- `loadBundledFontWeights` in `renderFidelity.dom.ts` loads Spline Sans weights 400, 600, and 700. Capture mode and the render verdict use the same function.
- `mobile/src/store/habitSeed.ts` holds the seed habits. The app store and the unit tests import the same seed.
- The surface renders `#screen-<key>` at 390 by 820 CSS pixels at scale 1 with no studio controls, headers, footers, or route connections.
- `data-screenshot-ready="true"` appears only when `evaluateCaptureReadiness` returns ready.
- Invalid queries, missing fonts, failed images, and disabled reduced motion render `#capture-error` with `role="alert"` and never set `data-screenshot-ready`.

## Verification

Run on 2026-10-19 in this worktree.

- `npm test`: 477 tests passed, including `test/captureMode.test.ts`.
- `npx tsc --noEmit` in `mobile/`: passed.
- `npx expo lint --no-cache` in `mobile/`: passed.
- `npm run export:web`: passed. It verifies 14 pages and 7 assets.
- `npm run test:capture`: passed on the static export. All 16 matrix cases become ready at 390 by 820 with the expected `Meter` scales. It also checks the first-paint fixture, share-hash and override isolation, and an inactive query.
- `npm run test:capture` also checks invalid queries, missing fonts, failed images, disabled reduced motion, and zero analytics requests.
- `npm run test:board`, `npm run test:present`, and `npm run test:share`: passed.
- `npm run guard`: passed. No guarded file changed.
