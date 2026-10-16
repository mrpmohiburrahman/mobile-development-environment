# 10 — Collapse into the spec and tickets

Type: task
Status: resolved
Blocked by: 05, 06, 07, 08, 09
Map: ../map.md

## Question

Every decision is made. Write `.scratch/five-bullets-built/spec.md` from the
resolved tickets and break it into tracer-bullet implementation tickets
with `/to-tickets`, each with its blocking edges, numbered to continue from
this map's decision tickets.

Expected implementation slices, in frontier order: font bundled and
rendering; Playwright suite with one frame; full matrix + CI + studio
surface; Mixpanel transport + Analytics tab with the no-token zero; event
taxonomy wired to the spine; edges on the board; Present mode; URL state;
guard rewrite; README + GIFs.

Resolve by linking the spec and the ticket list from the map.

## Comments

### Spec complete, backlog pending

The [implementation spec](../spec.md) carries Status: ready-for-agent and Labels: ready-for-agent. The map links to it. The owner approved three test boundaries: fast tests, browser checks, and iOS Simulator verification.

The original slice list above is not authoritative. Native analytics does not consume the studio spine. Guard permission precedes guarded app edits. The accepted board still needs normal studio and static-export integration.

The `/to-spec` command creates no implementation tickets. Continue with `/to-tickets .scratch/five-bullets-built/spec.md`. Continue numbering after 11. Keep this ticket claimed until the backlog exists and the map links to it.

## Answer

The backlog is tickets 12 to 23. The map links each one. The frontier is 12, 13, 14, and 15.

- [12 — Guard permission trailers](12-guard-permission-trailers.md)
- [13 — Board in the normal studio](13-board-in-the-normal-studio.md)
- [14 — Bundled font](14-bundled-font.md)
- [15 — Analytics sender](15-analytics-sender.md)
- [16 — Weekday fix and layout hook](16-weekday-fix-and-layout-hook.md), blocked by 12 and 15
- [17 — Capture mode](17-capture-mode.md), blocked by 13 and 14
- [18 — Present mode](18-present-mode.md), blocked by 13
- [19 — Analytics tab](19-analytics-tab.md), blocked by 15
- [20 — Screenshot suite and CI](20-screenshot-suite-and-ci.md), blocked by 16 and 17
- [21 — Regression tab](21-regression-tab.md), blocked by 20
- [22 — Shareable URL state](22-shareable-url-state.md), blocked by 18
- [23 — Simulator verification, README, cleanup](23-simulator-verification-readme-cleanup.md), blocked by 16, 19, 20, 21, and 22

The owner approved this breakdown. Native analytics does not consume the studio spine. Guard permission precedes the guarded edits in ticket 16.

### Checks for this spec handoff

- The new spec passes the prose linter with zero violations.
- `npm test` passes all 377 existing tests.
- Mobile lint and typechecking pass.
- `git diff --check` passes.

These checks cover the current repository. They do not prove the future features work. No application code, baseline generation, or Simulator execution forms part of this handoff.
