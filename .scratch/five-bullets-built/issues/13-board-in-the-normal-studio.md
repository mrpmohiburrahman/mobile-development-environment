# 13 — Board in the normal studio

Type: task
Status: ready-for-agent
Labels: ready-for-agent
Blocked by: None — can start immediately
Map: ../map.md
Spec: ../spec.md

## What to build

The accepted Contour board with the Guide camera replaces the old blueprint at the normal studio entry. The static export includes it. A developer sees declared and observed route connections, board-local Back history, draggable screen frames, Fit, and Reset layout without a development-only gate.

## Acceptance criteria

- [ ] The normal studio entry and the static export render the accepted board with real screen components.
- [ ] Declared routes appear before any interaction. Declared connections are dashed. Observed connections are solid. The active connection stays accented until the next navigation action.
- [ ] Direct connections use straight arrows between side midpoints. Detours use separate parallel lanes above the row with rounded elbows.
- [ ] Back resolves against board-local history and reports no destination when history is empty. Preview actions stay separate from observed journeys.
- [ ] Screen frames move by header or footer drag and by keyboard. The grip appears on hover or focus only. Frame position never changes declared screen order.
- [ ] Fit changes only the camera. Reset layout restores frame positions and the camera together. Reset session keeps its own job.
- [ ] The token editor, baseline comparison, state log, route evidence, and fidelity information remain available.
- [ ] The development-only prototype gate no longer gates the shipped board.
- [ ] Browser checks cover the exported board. `npm test`, lint, and typechecking pass.
