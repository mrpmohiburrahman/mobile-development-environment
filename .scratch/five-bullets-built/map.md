# Map: All five bullets, built

Labels: `wayfinder:map`

## Destination

Every item on Rafael Mendiola's "Additional Opportunities" slide (RNCK #14)
exists as working, demonstrable code in this repo's `/ide` studio — none
rejected, none reduced to a paragraph:

1. **State** — the change log already shipped stays; nothing to add unless a
   later ticket needs it as a source.
2. **Navigation routes** — edges drawn on the blueprint between the screen
   frames, observed and declared styled differently, lighting up when a press
   fires one.
3. **Mixpanel** — events from the running app reach a **real Mixpanel project**
   through its HTTP ingestion API, token supplied by env var, with an Analytics
   tab in the studio mirroring what was sent.
4. **Visual regression on web** — fonts bundled so pixels are deterministic,
   Playwright drives Chromium, PNG baselines per screen × scheme are committed,
   CI diffs them, the studio shows the result.
5. **Stakeholders** — a Present mode (one screen large, chrome hidden,
   keyboard navigation, light/dark) plus shareable URL state so a link
   reproduces an exact view on the deployed build.

Done when a cold clone with a Mixpanel token in `.env` can run `npm test`,
the visual-regression job, and the studio, and each of the five is visible
on screen and in the README.

## Notes

**This map plans, then hands off.** Decision tickets resolve to specs the
implementation tickets can execute without re-deciding. Execution is not
carried into this map.

**Constraints relaxed by the owner for this effort** (asked and answered at
charting):

- Dependencies may be added — Playwright, an image differ, whatever a ticket
  justifies. Prefer devDependencies; prefer zero runtime deps in the app.
- `mobile/src/ui` and `mobile/src/app` may change where instrumentation or
  font loading needs it. `scripts/guard.sh` and `studio-guard.yml` must be
  updated to say what is now guarded, not silently broken.
- A Mixpanel token is **not** committed. Env var only; the no-token case must
  still run and must say it is not sending.

**Constraints that stand:**

- `npm test` stays `node --experimental-strip-types --test test/*.test.ts`.
  New test runners (Playwright) are separate scripts.
- `token-server/index.mjs` stays Node-stdlib-only.
- The honest-zero rule from `talk-opportunities`: every panel has a state
  that means "not measured" and it is visibly different from "measured, found
  nothing". Every feature ships with a planted negative control.
- Expo SDK 57 docs are the reference, per `mobile/AGENTS.md`.

**Prior maps to zoom into, not restate:** `mobile-dev-env`, `studio-honesty`,
`talk-opportunities` (especially `decisions/02-one-event-spine.md` and
`decisions/05-measure-the-render-fidelity-assumption.md` — the reasons the
previous map rejected items 3 and 4 are now the risks this map designs
around, not grounds to reject again).

**Skills:** `/grilling` + `/domain-modeling` on grilling tickets;
`/research` subagents on research tickets; `/prototype` on prototype tickets;
`browser-skill` for in-browser verification.

**Voice:** design-document prose, matching the sibling maps.

## Decisions so far

- [Mixpanel ingestion API, measured](issues/01-mixpanel-ingestion-api.md) — browser `/track` works cross-origin with no SDK and no proxy; `verbose=1` only proves "well-formed", so the tab says *accepted*, never *delivered*; token is not secret but host must match region; one UUID per browser as `$device_id`.
- [Playwright on Expo web export, measured](issues/02-playwright-on-expo-web.md) — baselines must be Linux-only via the official Playwright Docker image; `reducedMotion: 'reduce'` is the wait, not a sleep; frame-level screenshots need the board scale pinned to 1; Playwright's own differ suffices.
- [Bundling the display font](issues/03-bundling-the-font.md) — RNW ignores `global.css` for `Text`, so the app has never rendered Spline Sans; fix is `fontFamily` in the `Text` style plus hand-written `@font-face` and `public/fonts/`; Spline Sans has no 800 weight, so `display` drops to 700.

## Not yet specified

- **Edge routing on a scrolling, zoomable row.** Seven frames in a row;
  curves between non-adjacent frames cross everything. Whether edges draw
  above frames, in a gutter, or only for the hovered/selected frame hangs on
  ticket 05's prototype.
- **Back edges.** `router.back()` is unresolvable statically. Now that app
  code may change, a back press *can* be observed — but whether it is drawn as
  an edge to "wherever you came from" or as a dashed self-loop is undecided.
- **Mixpanel event taxonomy beyond the spine.** The spine gives store
  diffs, routes, presses. Whether screen-view, session, and token-edit events
  are added, and how `distinct_id` is chosen for an anonymous local user,
  waits on ticket 01's research into the ingestion API.
- **Where visual-regression results surface in the studio.** A tab, a badge
  on each frame, or the existing render-verdict line extended. Depends on
  what the CI artifact looks like (ticket 02 / 08).
- **DPR, viewport, and scheme matrix.** Baselines per screen × scheme is the
  floor; whether ×DPR or ×viewport width is worth the PNG weight is open.
- **Present mode and the token server.** Whether Present mode is read-only
  always, or allows live token edits while presenting.
- **URL state and token overrides.** Encoding a full token override set in a
  URL may exceed sane lengths; whether to encode diffs-from-committed only,
  or a hash to a server-held snapshot, is open.
- **README and GIFs** for the new features — last, after everything is on
  screen.

## Out of scope

- Mobile (iOS/Android) screenshot regression. The talk's point is doing it on
  web instead.
- Mixpanel dashboards, funnels, or reports inside the studio. Sending is the
  feature; Mixpanel's own UI is where analysis happens.
- Multi-user comments pinned to frames. Asked at charting; not selected.
- Side-by-side light and dark on the board. Asked at charting; not selected.
- Merging `feat/drag-on-canvas`.

## Tickets

| # | Ticket | Type | Blocked by |
|---|---|---|---|
| 01 | [Mixpanel ingestion API, measured](issues/01-mixpanel-ingestion-api.md) | research | — (resolved) |
| 02 | [Playwright on Expo web export, measured](issues/02-playwright-on-expo-web.md) | research | — (resolved) |
| 03 | [Bundling the display font](issues/03-bundling-the-font.md) | research | — (resolved) |
| 04 | [Create the Mixpanel project](issues/04-create-mixpanel-project.md) | task (HITL) | — |
| 05 | [How edges draw on the board](issues/05-edges-on-the-board.md) | prototype | — |
| 06 | [Present mode and the shareable URL](issues/06-present-mode-and-url.md) | grilling | — |
| 07 | [What the app tells Mixpanel](issues/07-mixpanel-event-design.md) | grilling | 01, 04 |
| 08 | [The visual-regression contract](issues/08-visual-regression-contract.md) | grilling | 02, 03 |
| 09 | [What the guard now guards](issues/09-the-new-guard.md) | grilling | 07, 08 |
| 10 | [Collapse into the spec and tickets](issues/10-collapse-to-spec.md) | task | 05, 06, 07, 08, 09 |

**Frontier: 04 (yours — create the Mixpanel project), 05, 06, and 08 (its
blockers 02 and 03 are resolved).** 07 opens when you finish 04.
