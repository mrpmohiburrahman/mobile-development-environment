# 18 — Present mode

Type: task
Status: resolved
Labels: resolved
Blocked by: 13 — Board in the normal studio
Map: ../map.md
Spec: ../spec.md

## What to build

A presenter enlarges the screen the camera is on, hides the editor, and steps through the declared screen order. The app stays live. Token editing is off. The state log keeps recording. The browser sends no analytics events.

## Acceptance criteria

- [ ] Present, the `P` key, and Escape enter and exit Present mode. The present bar holds the screen label, declared position, scheme toggle, and Exit.
- [ ] Present mode shows the camera's current screen. It does not reset to the first screen.
- [ ] The side panel, badges, zoom controls, baseline controls, and other frames hide. The presented frame and the present bar stay.
- [ ] The frame fits the viewport height divided by 820, clamped from 0.5 to 1.5, and stays centered.
- [ ] Taps inside the frame navigate as on the board and the camera follows. Left and Right step through declared screen order. `L` and the toggle change the scheme.
- [ ] Global shortcuts do nothing while the user edits text or another control holds focus.
- [ ] Token editing is off. App state stays live. The state log records the demonstration. The last scheme survives exit.
- [ ] The browser sends no analytics requests during a presentation.
- [ ] Browser checks cover entry, exit, stepping, and hidden controls on the static export.
- [ ] `npm test`, lint, and typechecking pass.

## Answer

Present mode is live in `mobile/src/ide/presentMode.ts`, `mobile/src/ide/screen.state.ts`, and `mobile/src/ide/PresentBar.tsx`. The glue sits in `mobile/src/ide/MidpointPrototype.tsx` and `mobile/src/app/ide.tsx`.

The Present button and the P key enter. In overview, the screen frame nearest the viewport center opens. After a camera flight, the target screen opens. The other frames, connectors, headers, footers, canvas controls, flybar, toolbar, inspector, status, and footer hide. The studio side panel hides. Token editing is off. The presented app surface centers at viewport height over 820, clamped from 0.5 to 1.5. The CAPTION constant is 48. The app surface sits below the frame header. Center the app surface to keep it centered.

The present bar holds the label, `N / 7`, the Light/Dark toggle, and Exit. The board excludes the bar from pointer capture. Both controls work by click. Left and Right step through declared order. L flips scheme. P and Escape exit. The keyboard decision ignores events while the user edits text or another control holds focus.

`screen.state.ts` carries `presentedKey` and `presenting`. `flyTo` writes the target key. The board subscribes to it. The studio shell reads `presenting` to hide the panel. Wheel, board pan, and board keyboard controls stop while presenting. Live navigation updates the presented screen. The app stays live. The last scheme survives exit. The board uses `vpSize` for the present scale. No analytics sender runs in the browser. Ticket 15 keeps it native-only.

## Verification

Run on 2026-10-18 in this worktree.

- `npm test`: 436 tests passed. `test/presentMode.test.ts` adds 8. They cover scale, centering, nearest frame, stepping, position, and the keyboard contract.
- `npx tsc --noEmit` in `mobile/`: passed.
- `npx expo lint` in `mobile/`: passed with no errors or warnings.
- `npm run export:web`: passed. It verifies 14 pages and 4 assets.
- `npm run test:board`: passed. Board behavior did not regress.
- `npm run test:present`: passed. It covers overview entry, camera entry, exit, stepping, scheme controls, hidden chrome, and a live habit toggle. `npm run test:present` follows `npm run export:web`.
- `scripts/guard.sh 51d1585...HEAD`: passed. `mobile/src/app/ide.tsx` is a permanent exception. No other guarded file changed.

## Code review

Standards and Spec reviews ran on the first implementation. The owner chose to fix the material findings before close.

Standards findings. The readout bar lacked the required toggle and Exit control. `presentMode.ts` had stale exit text and used `phone`. The keyboard wiring bypassed the pure decision for `L`. The effect hand-rolled stepping. `flyTo` wrote the key at flight start. The board now uses `stepDeclaredScreen`. The bar has real controls. The text uses app surface. The header names all exit paths.

Spec findings. P did not exit. Bar controls were missing. Entry from overview fell back to screen 01. Board camera handlers stayed live. The browser check did not prove analytics silence. P and Escape now exit. Entry from overview uses the nearest frame. The board gates wheel, pan, and board keys. The check intercepts Mixpanel hosts and asserts zero requests.

The browser check taps the habit status control in Habit detail. The week count changes. The presented screen stays on Habit detail. The check does not claim route follow for that state change.

## Notes

The present bar first used a readout after its buttons did not fire. The board viewport had already claimed pointer capture. The viewport now returns before pan starts while presenting. The bar also matches the interactive exclusion list. Both controls fire.

The side panel hides by branching in `ide.tsx`. The BaselineToggle hides with it. The state tab, route tab, and Analytics tab hide too. Absence makes the view read-only.
