# 05 — How edges draw on the board

Type: prototype
Status: claimed
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
