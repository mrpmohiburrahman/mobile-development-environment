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
3. **Mixpanel** — events from the **native app** (iOS Simulator, since the
   app is unpublished) reach a **real Mixpanel project** through its HTTP
   ingestion API, token supplied by env var. The studio on web **emits no
   events**, even though it renders the same screens. What the studio's
   Analytics tab shows, if anything, is ticket 07's call. See ADR 0003.
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
- **Owner decision (after ticket 04):** only the native app sends Mixpanel
  events. The studio on web sends none, in dev and on the Pages build alike.
  Verification runs the app in the iOS Simulator. Ticket 01's browser `/track`
  findings stay as reference but are not the shipping transport. ADR 0003.

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

The [implementation spec](spec.md) consolidates the decisions and carries the ready-for-agent label. Later owner decisions and ADRs override earlier research suggestions. Research completion does not establish implementation completion.

- [Mixpanel ingestion API, measured](issues/01-mixpanel-ingestion-api.md) — browser `/track` works cross-origin with no SDK and no proxy; `verbose=1` only proves "well-formed", so the tab says *accepted*, never *delivered*; token is not secret but host must match region; one UUID per browser as `$device_id`.
- [Playwright on Expo web export, measured](issues/02-playwright-on-expo-web.md) — baselines must be Linux-only via the official Playwright Docker image; `reducedMotion: 'reduce'` is the wait, not a sleep; frame-level screenshots need the board scale pinned to 1; Playwright's own differ suffices.
- [Bundling the display font](issues/03-bundling-the-font.md) — RNW ignores `global.css` for `Text`, so the app has never rendered Spline Sans; fix is `fontFamily` in the `Text` style plus hand-written `@font-face` and `public/fonts/`; Spline Sans has no 800 weight, so `display` drops to 700.
- [How edges draw on the board](issues/05-edges-on-the-board.md) — Contour midpoint board with the Guide camera model: straight arrows between facing side midpoints for adjacent screens in the declared order, parallel detour lanes with rounded elbows above the row, dashed declared vs solid observed, board-local history for Back, draggable screen frames with hover-only grip and keyboard arrow support, header collision auto-nudge, Fit as the single camera-only action, and Reset layout restoring frames and camera together.
- [Present mode and the shareable URL](issues/06-present-mode-and-url.md) — Present mode shows one screen frame large (the one the camera is on), hides all studio chrome, keeps the app live and the spine recording, and is read-only with arrow-key stepping and a light/dark toggle; shareable state lives in the hash fragment (`#s=…`) as present flag + screen key + scheme + deflated token overrides, updates live via `replaceState` with a Copy link button, and a banner reports any part of a link the build cannot apply.
- [What the app tells Mixpanel](issues/07-mixpanel-event-design.md) — raw `/track` from the native build only, four events (`App Opened`, `Screen Viewed`, `Habit Toggled`, `Signed Out`), one UUID per install as identity, and a studio Analytics tab that is a static note with a link to the project rather than a send log. Web sends nothing. See ADR 0003.
- [What the guard now guards](issues/09-the-new-guard.md) — two guarded edits (`_layout.tsx` calls `useAnalytics()`, `habit.tsx` fixes the UTC weekday) pass through a per-commit `Guard-Allow: <path> -- <reason>` trailer; `ui/index.tsx` stays a permanent exception and now also carries the font family. See ADR 0004.
- [The visual-regression contract](issues/08-visual-regression-contract.md) — capture the app surface at DPR 2, derive the matrix from the screen registry plus empty Habit detail, enter Capture mode by a static-export query, update Linux baselines only through reviewed `vr:update`, use threshold 0, and show a bundled screenshot record in the Regression tab. A missing record is not a pass. See ADR 0002.

## Not yet specified

- **Edge routing.** Ticket 05 resolves this with side-midpoint connections and detour lanes above the frames. Normal studio and static-export integration remain required.
- **Back edges.** Ticket 05 resolves Back through board-local history. Empty history reports no destination.
- **Mixpanel event taxonomy beyond the spine.** Resolved in ticket 07: four
  events from the native app only. The spine stays a studio log and does not
  feed Mixpanel.
- **Where visual-regression results surface in the studio.** Resolved in ticket 08: a Regression tab displays the bundled screenshot record. It does not read CI artifacts.
- **DPR, viewport, and scheme matrix.** Resolved in ticket 08: app surface at DPR 2, both schemes, no extra viewport widths. The matrix follows the screen registry plus empty Habit detail.
- **Present mode and the token server.** Resolved in ticket 06: Present mode
  is strictly read-only; live token edits happen outside it.
- **URL state and token overrides.** Resolved in ticket 06: hash fragment,
  diff-from-committed only, deflate-compressed.
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
| 04 | [Create the Mixpanel project](issues/04-create-mixpanel-project.md) | task (HITL) | — (resolved) |
| 05 | [How edges draw on the board](issues/05-edges-on-the-board.md) | prototype | — (resolved) |
| 06 | [Present mode and the shareable URL](issues/06-present-mode-and-url.md) | grilling | — (resolved) |
| 07 | [What the app tells Mixpanel](issues/07-mixpanel-event-design.md) | grilling | 01, 04 (resolved) |
| 08 | [The visual-regression contract](issues/08-visual-regression-contract.md) | grilling | 02, 03 (resolved) |
| 09 | [What the guard now guards](issues/09-the-new-guard.md) | grilling | 07, 08 (resolved) |
| 10 | [Collapse into the spec and tickets](issues/10-collapse-to-spec.md) | task | 05, 06, 07, 08, 09 (resolved) |
| 11 | [Board edges implementation](issues/11-board-edges-implementation.md) | task | 05 (resolved) |
| 12 | [Guard permission trailers](issues/12-guard-permission-trailers.md) | task | — (resolved) |
| 13 | [Board in the normal studio](issues/13-board-in-the-normal-studio.md) | task | — |
| 14 | [Bundled font](issues/14-bundled-font.md) | task | — |
| 15 | [Analytics sender](issues/15-analytics-sender.md) | task | — |
| 16 | [Weekday fix and layout hook](issues/16-weekday-fix-and-layout-hook.md) | task | 12, 15 |
| 17 | [Capture mode](issues/17-capture-mode.md) | task | 13, 14 |
| 18 | [Present mode](issues/18-present-mode.md) | task | 13 |
| 19 | [Analytics tab](issues/19-analytics-tab.md) | task | 15 |
| 20 | [Screenshot suite and CI](issues/20-screenshot-suite-and-ci.md) | task | 16, 17 |
| 21 | [Regression tab](issues/21-regression-tab.md) | task | 20 |
| 22 | [Shareable URL state](issues/22-shareable-url-state.md) | task | 18 |
| 23 | [Simulator verification, README, cleanup](issues/23-simulator-verification-readme-cleanup.md) | task | 16, 19, 20, 21, 22 |

## Handoff

The [implementation spec](spec.md) is ready for agent work. The backlog is tickets 12 to 23. Native analytics stays native-only. The browser sends no events.

**Frontier: 13, 14, and 15.** 12 is resolved. 16 waits on 15. 17 waits on 13 and 14. 18 waits on 13. 19 waits on 15. 20 waits on 16 and 17. 21 waits on 20. 22 waits on 18. 23 waits on 16, 19, 20, 21, and 22.
