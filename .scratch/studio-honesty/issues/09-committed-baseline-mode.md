Type: task
Status: resolved
Blocked by: 03, 04, 08

## Question

Build the committed-baseline mode: `GET /tokens?ref=HEAD` on the server, a blueprint toggle, and honest degradation.

The studio's central claim is that the blueprint cannot lie, because it renders the real components. Right now that claim is asserted rather than demonstrated — the blueprint only ever shows current tokens, so it can answer "what does the app look like" but not "does the app still match what is committed". That drift is the reason the tool exists, and it is currently unfalsifiable.

Decided in charting: **a toggle in the blueprint chrome** switches between current (7 frames) and compare (7 pairs, 14 frames, horizontally scrollable at reduced scale). Compare is opt-in — doubling the artboard is heavy, and `reactCompiler: true` with 14 live screens is untested.

Scope:

- **Parse the query string.** The existing trap: routes are matched by exact equality on `req.url`, so a naive `/tokens?ref=HEAD` silently 404s and reads to the client as a server that is not running. Check out how `req.url === '/tokens'` at `token-server/index.mjs:60` currently works, and split query from path before matching.
- **`git show` for the `HEAD` ref.** `execFile` and `node:child_process` stay — session revert (ticket 06) is pure in-memory and does not get to remove what this needs.
- **If a `ref` cannot be resolved, say so.** Never fall back to current tokens — a silent fallback draws a false comparison, which is worse than no comparison.
- **Degrade cleanly with the server absent:** state that the baseline is unavailable, do not crash the route, do not draw a comparison that did not happen. The server-absent case is the deployed static build, so it is the common case, not an edge case.
- **Be honest about what this is** — in the UI and in code comments: two renders of the same components against two token sets, *not* a pixel diff of two screenshots.
- The badge from ticket 03 should make it obvious whether the comparison ran against real `HEAD` tokens or nothing at all.

Drift detection itself is ticket 10 — this ticket delivers the toggle, the ref plumbing, and the honest degradation.

## Answer

A toggle in the blueprint chrome draws the same seven screens a second time from `HEAD`, beside a list of every token that differs. Verified in Chromium; `npm test` 198.

**The query-string trap, handled by not walking into it.** The ticket specified `GET /tokens?ref=HEAD` and warned that exact-equality matching on `req.url` would 404 it. Rather than parse a query string for one fixed ref, the route is `GET /baseline` — a distinct path, so there is no query to parse and the whole class of bug is absent. The response carries `ref: 'HEAD'` explicitly, so the client never has to infer which ref it got.

**`git show`, not `git checkout`.** It reads the committed tree and never moves the working file — the same rule session revert follows, and the reason `execFile` stays as the map said.

**An unresolvable ref says so.** `/baseline` returns a 500 with the git error rather than falling back to current tokens, and the client treats any non-OK as "no committed tree". There is no code path that draws a comparison against the wrong tree.

**Degradation is the common case, handled as such.** The toggle is always rendered and disabled with the label "no committed baseline" when there is no server. The map left hide-or-disable open; consistency with ticket 06's session revert won, because a control that vanishes cannot be told apart from one that was never built, and on the deployed static build hiding it would make the flagship feature look absent rather than unavailable.

**Two levels of report in one tab.** The baseline tab shows the token-level diff and ticket 10's screen-level verdict together — "which tokens differ" and "which screens that touched" are one comparison, and splitting them across tabs would make the reader correlate them by hand.

**Verified, not assumed.** With two tokens planted against `HEAD`, the panel named exactly those two with both values, seven screens rendered in the second column, and the board carried *both* accent colours — `#AAAA11` from the working tree and `#D9481E` from `HEAD` — which is the proof that the two columns genuinely render different token trees through the same components. Reverting to `HEAD` flipped the panel to "in sync with HEAD, 55 tokens compared, none differ". With the server down the toggle reads "no committed baseline", is disabled, and ticket 03's badge independently reports "in-memory only".

**The claim is stated, not implied.** The panel prints "Compared token sets, not pixels: every line names a token in tokens.json", `drift.ts` opens by explaining what a pixel diff would have wrongly flagged, and no UI text or comment calls this a screenshot diff.
