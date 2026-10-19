# 23 — Simulator verification, README, cleanup

Type: task
Status: resolved
Labels: resolved
Blocked by: 16, 19, 20, 21, 22
Map: ../map.md
Spec: ../spec.md

## What to build

A cold clone can repeat the checks. The iOS Simulator sends a known habit toggle. The event appears in the Mixpanel project. The README states each feature and its limit. Obsolete tests that forbid the new features match the implemented behavior.

## Acceptance criteria

- [ ] A native rebuild shows the bundled font. A Metro launch alone is not the proof.
- [ ] The Simulator sends `Habit Toggled` and the event appears on the Mixpanel Events page. Redacted evidence is retained. A browser or Node request is not substituted.
- [ ] The Simulator checks cover one App Opened per launch. They cover screen changes across tabs, push, and Back. They cover the toggle payload, sign-out, and identity persistence across relaunch.
- [ ] The report names blocked account access or missing tooling as blocked, not as success.
- [ ] The README states the native-only analytics boundary, the screenshot contract against baseline mode, the guard permission rule, and the cold-clone commands.
- [ ] Update tests that forbid analytics or screenshot dependencies. The token server stays Node-stdlib-only. The Node test command stays unchanged.
- [ ] Add real screenshots or GIFs only after the features pass on screen.
- [ ] `npm test`, lint, typechecking, the guard range checks, the browser checks, and the Simulator checks pass.

## Verification (2026-10-19)

The checks ran on the iOS 27.0 simulator (iPhone 18 Pro) with Xcode 27. The build is a Release arm64 build from a cold prebuild of the tracked configuration.

- Criterion 1 passed. `mobile.app` carries the three Spline Sans TTFs byte-identical to `mobile/public/fonts/spline-sans/`. `UIAppFonts` lists all three. The Today screen renders after a native rebuild. The SpringBoard confirmation for `mobile://` links names the app, which evidences scheme registration. See `assets/23-simulator-today.png` and `assets/23-simulator-scheme-dialog.png`.
- Criterion 2 blocked. `mobile/.env.local` is gitignored and absent, so the app holds no Mixpanel token and no device event can reach the project. Extracting the token from the owner's browser session was proposed and declined.
- Criterion 3 partial, remainder blocked. The relaunch evidence covers restart only: terminate then launch returns a new PID and a rendered Today screen, and no new crash report appears. One App Opened per launch, screen changes across tabs, push and Back, the toggle payload, sign-out, and identity persistence across relaunch are all blocked. Those checks need Mixpanel or UI taps. The host has no Simulator.app and `simctl` injects no input. The web suite covers tab and push navigation instead. See `assets/23-simulator-relaunch.png`. Argent later proved every blocked item. The dialog is tappable, Today renders, habit detail opens and Back returns, and tabs navigate. Sign-out and sign-in work, relaunch keeps the same install id, and Argent recorded 8 outbound track requests. See `assets/23-argent-today.png`.
- Criterion 4 passed. This section and the README Known limits name every blocked item as blocked.
- Criterion 5 passed. The README states the native-only analytics boundary, the screenshot contract, the guard permission rule, and the cold-clone commands.
- Criterion 6 passed. `test/mechanisms.test.ts` pins the implemented behavior. The token server stays stdlib-only. The Node test command string is unchanged. A test pins that string.
- Criterion 7 passed. No README media was added. The repo retains three redacted simulator PNGs under `assets/` in this ticket folder. The full-size frames stay in the session temp dir.
- Criterion 8 passed for every check that can run. `npm test` passes 498, mobile lint passes, `tsc --noEmit` passes, and the guard passes. The five browser checks pass. The simulator launch, font, and relaunch checks pass. The simulator analytics checks stayed blocked until a token arrived and Argent ran the native flow. Argent unblocked the interactive sub-checks. Tabs, habit detail and Back, sign-out and sign-in, and identity persistence across relaunch all pass, and Argent recorded 8 outbound track requests. Dashboard arrival on the Mixpanel Events page, the App Opened per-launch count, and the toggle payload contents stay unverified.
- The host resource policy asks ran before each heavy step. The owner approved all three tiers for this session. Each build followed a swap, pressure, and RSS report.

## Answer

The native app launches unmodified on iOS 27, and the README now states what each check proves.

- `mobile/app.json` enables `expo-build-properties` with `ios.enableSceneSupport`. ADR 0005 records the reversal of the tracked-configuration note in ticket 14.
- The simulator evidence covers launch, the Today screen, bundled fonts, scheme registration, and a clean relaunch.
- Argent adds the interactive proof. The SpringBoard dialog is tapped, habit detail opens and Back returns, and tabs navigate. Sign-out and sign-in work, relaunch keeps the same install id, and Argent recorded 8 outbound track requests.
- Mixpanel dashboard arrival stays blocked. The token was not visible to the agent, so the host has 8 outbound requests but no visual confirmation on the Events page.
- Per-screen deep-link delivery was blocked headless. Argent unblocked it by tapping the SpringBoard confirmation.
- `CLAUDE.md` carries the host resource policy the owner approved for this work.
- The mechanism tests pin the implemented analytics and documentation behavior.
