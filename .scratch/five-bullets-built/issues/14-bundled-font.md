# 14 — Bundled font

Type: task
Status: resolved
Labels: resolved
Blocked by: None
Map: ../map.md
Spec: ../spec.md

## What to build

The app renders Spline Sans from bundled files on web and on native. Display weight drops to 700. The family reaches shared text and the raw text paths, including tabs, Back, buttons, and chips. The font license ships with the files.

## Acceptance criteria

- [x] Spline Sans weights 400, 600, and 700 ship with the license, weighted web font-face declarations, and the native font configuration plugin.
- [x] The family applies through the shared text component and the raw text paths for TabBar, BackBar, Button, and Chip.
- [x] The display weight is 700. A family token with an allow-list exists.
- [x] The app does not rely on an installed system font or a CSS variable alone.
- [x] A native rebuild, not a Metro session alone, renders the bundled face. See the iOS 27 limitation below.
- [x] Existing smoothing settings stay.
- [x] `npm test`, lint, and typechecking pass.

## Answer

Spline Sans weights 400, 600, and 700 now serve shared app Text and the raw tab, Back, button, and chip paths.
The font files include their OFL license.
The family token uses a bundled allow-list, and the display weight is 700.
Final correctness and specification reviews reported no findings.
The app-tree guard passed against HEAD.
README text checks retain existing style debt: 25 hard findings versus 28 at HEAD, with none in the added font paragraphs.
The native result has the explicit iOS 27 limitation below.

## Comments

### Verification — October 19, 2026

The app includes the original TTF files and OFL license from `@expo-google-fonts/spline-sans` version 0.4.2.
The package integrity check passed before extraction.
Web and native use the same three files.
The client and server reject families outside the bundled allow-list.

The final checks passed:

- `npm test`: 468 tests, zero failures.
- `npm --prefix mobile run lint`.
- `mobile/node_modules/.bin/tsc --noEmit --project mobile/tsconfig.json`.
- `git diff --check`.

Tests, lint, and typechecking ran sequentially with a 512 MiB Node heap limit.
Earlier root and subpath exports also passed:

```bash
npm run export:web -- --max-workers 1
EXPO_BASE_URL=/mobile-development-environment npm run export:web -- --max-workers 1
```

Each export verified 11 pages and seven assets, including the three fonts.
The export converts public font URLs to stylesheet-relative paths.
Regression tests reject missing font files and URLs outside the deployment prefix.
No browser runtime check ran during this verification.

### Native font evidence

A standalone arm64 Release build ran on the iPhone 18 Pro simulator with iOS 27.0 and Xcode 27.0.
The build included `main.jsbundle` and all three font files.
No Metro server supplied the app bundle.

Temporary native instrumentation inspected the actual `UIFont` attributes on rendered React Native text.
It checked the registered face set and each observed font family and face.
The registered faces were `SplineSans-Regular`, `SplineSans-SemiBold`, and `SplineSans-Bold`.
All inspected app text used the family `Spline Sans`.

| Screen | Text elements checked | Paths covered |
| --- | ---: | --- |
| Today | 48 | Display, body, chips, all four tab labels |
| Habit detail | 23 | Display, Back, chip, completion button |
| Habits | 27 | Display, labels, tabs |
| Stats | 27 | Display, percentage, labels, tabs |
| Profile | 21 | Display, Settings, Sign out, tabs |
| Settings | 15 | Display, Back, scheme labels, body |
| Login | 5 | Display, body, Sign in, Create account |

All seven screen snapshots contained genuine Regular, SemiBold, and Bold faces.
The habit completion button changed to its undo state and back, with font assertions in both states.
Sign out opened Login.
Sign in returned to Today, where font assertions passed again.
Dark Settings passed font assertions and visual inspection.
The test restored Light mode and the original habit completion state.
These checks cover the bundled font paths, not every app feature.
Android runtime font verification did not run.

### iOS 27 limitation (superseded by ADR 0005)

The generated Expo app initially failed at launch because iOS 27 requires the scene lifecycle.
A temporary scene delegate and scene manifest in ignored `mobile/ios/` files allowed font verification.
This workaround changed app startup, not the bundled font files or text styles.
ADR 0005 superseded this note: the tracked configuration now adopts the scene lifecycle via `expo-build-properties`.
The result proves bundled font rendering after the startup workaround, not an unmodified iOS 27 launch.

Verification cleanup removed the temporary scene adapter and font inspector from generated source.
The test app and simulator stopped.
The final memory check reported 52% system memory free.
Generated native dependencies and build artifacts remain ignored.
No commit or push occurred.
