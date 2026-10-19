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

- [x] A native rebuild shows the bundled font. A Metro launch alone is not the proof.
- [x] The Simulator sends `Habit Toggled` and the event appears on the Mixpanel Events page. Redacted evidence is retained. A browser or Node request is not substituted.
- [x] The Simulator checks cover one App Opened per launch. They cover screen changes across tabs, push, and Back. They cover the toggle payload, sign-out, and identity persistence across relaunch.
- [x] The report names blocked account access or missing tooling as blocked, not as success.
- [x] The README states the native-only analytics boundary, the screenshot contract against baseline mode, the guard permission rule, and the cold-clone commands.
- [x] Update tests that forbid analytics or screenshot dependencies. The token server stays Node-stdlib-only. The Node test command stays unchanged.
- [x] Add real screenshots or GIFs only after the features pass on screen.
- [x] `npm test`, lint, typechecking, the guard range checks, the browser checks, and the Simulator checks pass.

## Verification (2026-10-19)

The checks ran on the iOS 27.0 simulator (iPhone 18 Pro) with Xcode 27. The build is a Release arm64 build from a cold prebuild of the tracked configuration.

- Criterion 1 passed. `mobile.app` carries the three Spline Sans TTFs byte-identical to `mobile/public/fonts/spline-sans/`. `UIAppFonts` lists all three. The Today screen renders after a native rebuild. The SpringBoard confirmation for `mobile://` links names the app, which evidences scheme registration. See `assets/23-simulator-today.png` and `assets/23-simulator-scheme-dialog.png`.
- Criterion 2 passed (2026-10-20). The owner placed the token in the gitignored `mobile/.env.local`. The installed `com.mrpmohibur.mobile` bundle (built 02:26, after the token file) inlines it. A tap on the "Practice guitar" circle sent one POST to `https://api.mixpanel.com/track?verbose=1&ip=0` (HTTP 200). The Events page in project 4074212 lists `Habit Toggled` with `done: true`, `habit_id: h3`, a `$device:` distinct id, an `$insert_id`, and the user agent `mobile/1 CFNetwork`. See `assets/23-mixpanel-events-page.png` and `assets/23-argent-today-toggled.png`. No browser or Node request was substituted.
- Criterion 3 passed (2026-10-20). Two relaunches each produced exactly one `App Opened` (`platform: ios`) and one `Screen Viewed` on the Events page, and no duplicates. Taps on Habits, Stats, Today, a habit row, Back, and Profile produced `Screen Viewed` rows with `screen` values `/habits`, `/stats`, `/`, `/habit`, `/`, `/profile`. Sign out produced `Signed Out` then `Screen Viewed /login`. Sign in produced `Screen Viewed /`. All 18 rows in that run carry the same `$device:9abb9df7-…` id, which also matches the relaunch rows. The device id is an anonymous install UUID, not a credential. See `assets/23-mixpanel-app-opened-payload.png`, `assets/23-argent-habit-detail.png`, and `assets/23-argent-login-after-signout.png`. The earlier 2026-10-19 relaunch evidence stays in `assets/23-simulator-relaunch.png`.
- Criterion 4 passed. On 2026-10-19 this section and the README named the Mixpanel checks as blocked. On 2026-10-20 they passed and the record says so.
- Criterion 5 passed. The README states the native-only analytics boundary, the screenshot contract, the guard permission rule, and the cold-clone commands.
- Criterion 6 passed. `test/mechanisms.test.ts` pins the implemented behavior. The token server stays stdlib-only. The Node test command string is unchanged. A test pins that string.
- Criterion 7 passed. No README media was added. The ticket folder retains nine PNGs under `assets/`: three 2026-10-19 simulator frames, one Argent Today frame, and five 2026-10-20 frames (toggled Today, habit detail, Login after sign out, the Events page, and the expanded App Opened payload). The Events-page frames show no token. The `$device` id is an anonymous install UUID.
- Criterion 8 passed. `npm test` passes, mobile lint passes, `tsc --noEmit` passes, and the guard passes (2026-10-19 run). The five browser checks pass (2026-10-19 run). The simulator launch, font, relaunch, toggle, navigation, sign-out, and sign-in checks pass (2026-10-20 run). The Events page confirms arrival for every event type.
- The host resource policy asks ran before each heavy step. On 2026-10-19 the owner approved all three tiers. On 2026-10-20 the owner approved reuse of the already booted simulator with no rebuild. Swap was 1064 MB of 2048 MB and 57% of memory was free at that ask.

## Answer

The native app launches unmodified on iOS 27, its events arrive in the Mixpanel project, and the README states what each check proves.

- `mobile/app.json` enables `expo-build-properties` with `ios.enableSceneSupport`. ADR 0005 records the scene-support decision.
- The simulator evidence covers launch, the Today screen, bundled fonts, scheme registration, and a clean relaunch.
- The Events page in project 4074212 shows `App Opened`, `Screen Viewed`, `Habit Toggled`, and `Signed Out` from the simulator install. `App Opened` fires once per launch. `Habit Toggled` carries `done` and `habit_id`. `Screen Viewed` carries the normalized `screen` path. The `$device` id survives sign-out, sign-in, and relaunch.
- Sign in resets the demo store, so Done Today returned to 4/6 after the sign-in step. That is demo behavior, not an analytics defect.
- `CLAUDE.md` carries the host resource policy the owner approved for this work.
- The mechanism tests pin the implemented analytics and documentation behavior.
