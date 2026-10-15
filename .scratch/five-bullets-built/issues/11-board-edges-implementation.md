# 11 — Board edges implementation

Type: task
Status: resolved
Blocked by: 05
Map: ../map.md

## Spec

This ticket records the implementation of the accepted board-edges design from ticket 05.

- Route connections use side-midpoint anchors. Direct connections between screens that are adjacent in the declared screen order use straight arrows. Detours use parallel lanes above the row with rounded elbows.
- Tab connections and provenance counts come from `routerKeys.ts`, `routes.ts`, and `spineStore.ts` through `midpointBoard.ts`.
- The board counts unresolved back controls with `resolveFrames` and `countBackControls`.
- Screen frames move when the user drags the frame header or footer. A grip icon appears on hover or focus only.
- Keyboard users can focus a frame header and press arrow keys to move the frame. `Shift` increases the step size. `Home` restores the frame to its declared position. `Enter` centers the camera on the frame.
- Interacted frames rise to the top of the z-order. Dropping or stepping a frame onto another frame header nudges the moved frame down so both drag handles stay reachable.
- Fit in the bottom-right zoom cluster is the single camera-only action. The `0` key does the same. Reset layout restores frame positions and the camera together.
- `scripts/guard.sh` names `mobile/src/app/ide.tsx` and `mobile/src/ui/index.tsx` as the two exceptions to the byte-identical rule.

## Verification

- `npm test` passes all unit and guard tests, including `test/midpointBoard.test.ts` and `test/guard.test.ts`.
- `bash scripts/guard.sh HEAD` exits 0.
- `npx tsc --noEmit` and `npx eslint` pass in `mobile/`.
