Type: task
Status: open
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