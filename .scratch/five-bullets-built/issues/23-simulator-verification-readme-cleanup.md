# 23 — Simulator verification, README, cleanup
Type: task
Status: blocked
Labels: ready-for-human
Blocked by: an unverified Mixpanel Events-page check, the App Opened per-launch count, and toggle payload contents

Map: ../map.md
Spec: ../spec.md

## What to build

A cold clone can repeat the checks. The iOS Simulator sends a known habit toggle. The event appears in the Mixpanel project. The README states each feature and its limit. Obsolete tests that forbid the new features match the implemented behavior.

## Acceptance criteria

- [x] A native rebuild shows the bundled font. A Metro launch alone is not the proof.
- [ ] The Simulator sends `Habit Toggled` and the event appears on the Mixpanel Events page. Redacted evidence is retained. A browser or Node request is not substituted.
- [ ] The Simulator checks cover one App Opened per launch. They cover screen changes across tabs, push, and Back. They cover the toggle payload, sign-out, and identity persistence across relaunch.
- [x] The report names blocked account access or missing tooling as blocked, not as success.
- [x] The README states the native-only analytics boundary, the screenshot contract against baseline mode, the guard permission rule, and the cold-clone commands.
- [x] Update tests that forbid analytics or screenshot dependencies. The token server stays Node-stdlib-only. The Node test command stays unchanged.
- [ ] Add real screenshots or GIFs only after the features pass on screen.
- [ ] `npm test`, lint, typechecking, the guard range checks, the browser checks, and the Simulator checks pass.

## Verification (2026-10-19)

The checks ran on the iOS 27.0 simulator (iPhone 18 Pro) with Xcode 27. The build is a Release arm64 build from a cold prebuild of the tracked configuration.

- Criterion 1 passed. `mobile.app` carries the three Spline Sans TTFs byte-identical to `mobile/public/fonts/spline-sans/`. `UIAppFonts` lists all three. The Today screen renders after a native rebuild. The SpringBoard confirmation for `mobile://` links names the app, which evidences scheme registration. See `assets/23-simulator-today.png` and `assets/23-simulator-scheme-dialog.png`.
- Criterion 2 blocked. The token file is gitignored and absent. The project has no confirmed arrival on the Events page, so Mixpanel arrival, the per-launch App Opened count, and toggle payload contents stay unverified. Extracting the token from the owner's browser session was proposed and declined.
- Criterion 3 partial, remainder blocked. The relaunch evidence covers restart only: terminate then launch returns a new PID and a rendered Today screen, and no new crash report appears. One App Opened per launch and the toggle payload are unverified. Those checks need Mixpanel access. Screen changes across tabs, push and Back, sign-out, and identity persistence across relaunch are blocked. Those checks need UI taps. The host has no Simulator.app and `simctl` injects no input. The web suite covers tab and push navigation instead. See `assets/23-simulator-relaunch.png`. Argent later reported 8 outbound track requests and completed UI interactions, but no redacted request log or per-step screenshot set is retained. The Events-page arrival check stays blocked.
- Criterion 4 passed. This section and the README Known limits name every blocked item as blocked.
- Criterion 5 passed. The README states the native-only analytics boundary, the screenshot contract, the guard permission rule, and the cold-clone commands.
- Criterion 6 passed. `test/mechanisms.test.ts` pins the implemented behavior. The token server stays stdlib-only. The Node test command string is unchanged. A test pins that string.
- Criterion 7 partial. No README media was added. The retained evidence is limited to four PNGs under `assets/` in this ticket folder: three simulator screenshots and one Argent Today screenshot. The full-size frames stay in the session temp dir, except the one retained Argent frame.
- Criterion 8 passed for deterministic and browser checks only. `npm test` passes 498, mobile lint passes, `tsc --noEmit` passes, and the guard passes. The five browser checks pass. The simulator launch, font, and relaunch checks pass. Mixpanel Events-page arrival, the App Opened per-launch count, and toggle payload contents stay unverified.
- The host resource policy asks ran before each heavy step. The owner approved all three tiers for this session. Each build followed a swap, pressure, and RSS report.

## Answer

The native app launches unmodified on iOS 27, and the README now states what each check proves.

- `mobile/app.json` enables `expo-build-properties` with `ios.enableSceneSupport`. ADR 0005 records the scene-support decision.
- The simulator evidence covers launch, the Today screen, bundled fonts, scheme registration, and a clean relaunch.
- Mixpanel dashboard arrival stays blocked. The token was not available for direct verification. The host has 8 outbound requests as reported by Argent, but no visual confirmation on the Events page.
- Per-screen deep-link delivery stays blocked.
- `CLAUDE.md` carries the host resource policy the owner approved for this work.
- The mechanism tests pin the implemented analytics and documentation behavior.
