# 05 — How edges draw on the board

Type: prototype
Status: resolved
Blocked by: —
Map: ../map.md

## Question

The route list exists (`ide/routes.ts`, `RoutePanel.tsx`) with provenance
per row — observed, declared, unresolved. Navigation is "visualised" when
those edges are **drawn between the frames on the blueprint**. The frames
sit in a scrolling, zoomable row, so naive curves cross every frame between
source and target. Build two or three throwaway variants with `/prototype`
and pick one:

- **Arcs above the row** — edges leave the top of a frame, arc over the
  frames in between, land on the target's top. Observed edges solid,
  declared dashed, unresolved (back) a dotted stub that ends in a `?`.
- **Hover/select only** — the board is clean; hovering or selecting a frame
  draws only its outgoing and incoming edges.
- **Gutter rails** — edges run in a horizontal rail above the row with
  vertical drops, subway-map style; no crossings over frames.

For each variant settle: where the SVG layer sits relative to the zoom
transform (so edges scale with frames); how a frame's anchor point is found
(`boardFrames.ts` already locates frames); how an edge animates when a
press fires it (the spine already emits the press and route); and what the
honest zero is when no route has been observed yet.

Resolve with the chosen variant, a screenshot, and the open questions it
leaves for the implementation ticket. The prototype lives on
`prototype/board-edges`, not on main.

## Comments

### Side-midpoint proposal: confirmed choices

- Draw direct connections only for real routes between adjacent frames.
- Use straight arrows between the facing side-midpoints of adjacent frames.
- Route detours above intervening frames with rounded elbows.
- Keep the source and destination anchors at side-midpoints.
- Keep all connections visible without hover.
- Draw detours in gray at rest.
- Accent the active connection until the next navigation action.
- Give each detour a separate parallel lane.

The user rejected the earlier variants. This ticket remains claimed during the interview.

### Direction and history: confirmed choices

- Use two offset straight arrows for opposite directions between adjacent frames.
- Spread multiple anchors slightly around each side-midpoint.
- Display known routes before any navigation action.
- Distinguish declared routes from observed routes.
- Add short action labels to connections.
- Maintain board-local history for each journey.
- Resolve Back against that history.
- Report no destination when the relevant history is empty.

### Prototype direction: provisional

The user requests a visual comparison before final approval. All interview choices remain provisional.

- Keep the current frame order by default.
- Each destination remembers its latest incoming path.
- Use dashed lines for declared routes and solid lines for observed routes.
- Keep the active connection accented until the next navigation action.
- Compare alternative anchor and evidence styles through visible controls.
- Render real app screens inside the studio prototype.
- Do not resolve this ticket until the user accepts a prototype.

The prototype resides on `/ide?prototype=midpoints`. Its variants use `variant=contour`, `variant=circuit`, and `variant=atlas`.

### Verification: real-screen comparison

- All 370 tests pass through `npm test`.
- `npm run lint` and `npx tsc --noEmit` pass in `mobile`.
- The browser displays all three variants with real screen components.
- Real app actions mark connections as observed without leaving `/ide`.
- Back follows the latest incoming app journey.
- Preview actions use separate history and do not mark connections as observed.
- Empty history reports no Back destination.
- Opposite direct connections have separate labels.
- Atlas draws lane backgrounds before connectors to prevent covered paths.
- Evidence controls, port controls, zoom controls, and the route inspector respond.
- Arrow keys change variants and preserve the selected variant in the URL.
- The preview server runs in watch mode. CI mode previously served stale code.

`npm run guard -- HEAD` reports `mobile/src/ui/index.tsx` as a guarded change.
This file contains the permitted prototype callbacks for tabs and Back.
The guard remains unchanged. Its policy remains an open map decision.

The local preview responds on port 50267. The assigned public preview alias returns HTTP 404.
This ticket remains claimed until the user accepts a prototype.

### Refinement: canvas navigation

The user accepted the Contour look. The user asked for a canvas experience: free zoom, free pan, free movement. The `/prototype` skill produced three interaction variants on the same route. They replace the earlier `contour`, `circuit`, and `atlas` variants:

- **Draft** (`variant=draft`) — the wheel zooms to the cursor. Drag empty canvas to pan. Corner controls give zoom out, zoom to 100 percent, zoom in, and fit. Double-click a frame heading to center that frame.
- **Roam** (`variant=roam`) — the wheel pans the board. Pinch or Ctrl+wheel zooms. A minimap displays every frame and the current viewport. Click the minimap to jump.
- **Guide** (`variant=guide`) — the camera flies to the screen each navigation lands on. A fly bar centers any screen on demand. Overview fits the whole board.

All three variants keep the Contour skin, the route inspector, and the evidence and port controls. The board world moves with `translate` and `scale`. The connector labels keep a constant screen size. In the browser, wheel zoom, drag pan, wheel pan, the minimap, and camera fly-to all work. All 370 tests pass. Lint and TypeScript pass.

This ticket remains claimed until the user picks a canvas variant.

### Refinement: Guide accepted, frames draggable

The user accepted the Guide variant and removed Draft and Roam. The variant picker, the minimap, and the `variant=` URL switch are gone. The `variant=guide` parameter still loads the board. The user then asked for screen frames to be draggable. Confirmed choices:

- Drag a screen frame by its header or its footer. The phone area stays fully interactive.
- Display a grip icon on the header on hover only.
- Drag empty board space to move the board.
- Keep route connections attached to the side midpoints. Update them during the drag.
- Keep the declared screen order authoritative for numbers, direct connections, and detour lanes. Frame position is visual only.
- Store frame positions in `localStorage`. Add a `Reset layout` button. `Reset session` keeps its own job.
- Move frames freely on both axes. Hold `Shift` to lock one axis. Press `Esc` to cancel the move in progress.
- Compute Overview, Fit, and camera fly-to targets from the current frame positions. The declared board stays the lower bound for fit.
- Raise the dragged frame above the others. Use grab and grabbing cursors on the handle.
- Keep the wheel behavior of Guide: wheel pans, Ctrl or Cmd plus wheel zooms at the cursor.
- Keep the Overview button in two places: the fly bar and the bottom-right controls.

The glossary in `CONTEXT.md` now defines Screen frame, Declared screen order, Frame position, and Drag handle. It ties Direct connection and Detour to the declared screen order.

Browser verification on the assigned port: 7 frames render. The variant picker and the minimap are absent. Both Overview buttons exist. The grip appears on hover only. A header drag moves the frame and its connections. The position survives a reload. Fly-to centers the moved frame. Reset layout restores the declared row and clears storage. No console errors. All 370 tests pass. Lint and TypeScript pass.

## Answer

Chosen design: the Contour midpoint board with the Guide camera model (`mobile/src/ide/MidpointPrototype.tsx`, `mobile/src/ide/midpointBoard.ts`). Screenshots: [`board-edges-guide-overview.png`](../assets/board-edges-guide-overview.png) and [`board-edges-guide-dragged.png`](../assets/board-edges-guide-dragged.png).

- Direct connections use straight arrows between facing side midpoints. Detours use parallel lanes above the row with rounded elbows.
- Declared routes use dashed lines. Observed routes use solid lines. The active connection stays accented until the next navigation action.
- Each destination keeps board-local history for its latest incoming path. Back resolves against that history and reports when history is empty.
- Tab routes and provenance counts derive from `routerKeys.ts`, `routes.ts`, and `spineStore.ts`. The board counts unresolved back controls with `resolveFrames` and `countBackControls`.
- Screen frames drag by their header or footer. A grip icon appears on hover or focus only. Keyboard users can focus a header and move the frame with arrow keys (`Shift` for a larger step, `Home` to restore, `Enter` to center).
- Interacted frames rise to the top of the z-order. Dropping or stepping a frame onto another frame header nudges the moved frame down by one header height so both drag handles stay reachable.
- `scripts/guard.sh` names `mobile/src/app/ide.tsx` and `mobile/src/ui/index.tsx` as the two explicit exceptions to the byte-identical rule.

### Refinement: Reset layout scope

The user reported that Reset layout did not work. In a browser reproduction, the button restored dragged frames correctly but stayed disabled after a pan, a zoom, or a fly-to. The button covered frame positions only. Confirmed changes:

- Reset layout now restores frame positions and the camera. It is active when a frame moved or the camera left the overview.
- The two Overview buttons are gone. Fit in the zoom cluster is the single camera-only action. It displays the pressed state while the camera is in overview. The `0` key does the same.
- The fly bar holds screen names only.

