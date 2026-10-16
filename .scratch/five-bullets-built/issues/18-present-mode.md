# 18 — Present mode

Type: task
Status: ready-for-agent
Labels: ready-for-agent
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
