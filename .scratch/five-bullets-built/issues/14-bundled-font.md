# 14 — Bundled font

Type: task
Status: ready-for-agent
Labels: ready-for-agent
Blocked by: None — can start immediately
Map: ../map.md
Spec: ../spec.md

## What to build

The app renders Spline Sans from bundled files on web and on native. Display weight drops to 700. The family reaches shared text and the raw text paths, including tabs, Back, buttons, and chips. The font license ships with the files.

## Acceptance criteria

- [ ] Spline Sans weights 400, 600, and 700 ship with the license, weighted web font-face declarations, and the native font configuration plugin.
- [ ] The family applies through the shared text component and the raw text paths for TabBar, BackBar, Button, and Chip.
- [ ] The display weight is 700. A family token with an allow-list exists.
- [ ] The app does not rely on an installed system font or a CSS variable alone.
- [ ] A native rebuild, not a Metro session alone, renders the bundled face.
- [ ] Existing smoothing settings stay.
- [ ] `npm test`, lint, and typechecking pass.
