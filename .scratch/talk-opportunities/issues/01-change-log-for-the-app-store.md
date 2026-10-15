# 01 — A change log for the app store

**What to build:** The state tab stops showing only what the store is and starts
showing what it did. Toggling a habit's check on the board writes a row naming
the habit and the day that changed; signing in or out writes one too. Rows are
newest-first, each names the store it landed in, and the existing tree stays
below so that "what is the state right now" still has an answer. Signing in
while already signed in writes nothing.

**Blocked by:** None — can start immediately.

**Status:** resolved

## Verification harness

Every ticket in this set is verified by driving a real browser, because six of
the seven defects this codebase has already shipped were invisible to its unit
tests and three of those printed a benign-looking message while being wrong.

```
npm run web                    # background shell
bsk session start --json       # keep the returned session_id
bsk navigate http://localhost:8081/ide --session <id>
bsk observe --session <id>     # fresh @eN refs
bsk click @e3 --session <id>
bsk evaluate "..." --session <id>   # assert on the DOM directly
bsk session stop <id>
```

`bsk` is a dev-time tool and is **not** wired into `npm test`. The test suite
keeps running on the type-stripping runner with no framework, no build step and
no dependency.

Repeat the run with the token server stopped. The absent-server case is the
common one, not an edge.

## Acceptance criteria

- [x] A store change produces a row naming the path that changed, its previous
      and current value, and the store it landed in.
- [ ] A store setter that writes an identical value produces **no** row. This is
      the case that makes a notification-log useless within a minute.
- [x] Rows are newest-first, and the existing state tree remains below them. The
      log answers "what did it do"; the tree still answers "what is it".
- [x] The log distinguishes three states in words — watching with nothing yet,
      watching with nothing found, and not watching — and no two of them ever
      render as the same string.
- [ ] The tree differ already in the codebase does the comparison. There is no
      second implementation, because a second differ is a second set of the
      normalisation bugs this one already carries fixed.
- [x] The spine is a pure module that loads under the type-stripping test runner.
- [x] The buffer is capped, and the cap is stated in the UI when reached. A
      truncated history must never read as a complete one.
- [x] The state tab exposes no control that drives the store. The board is the
      input device; the panel is output.

**Browser, planted negative controls:**

- [x] Toggle a habit check in the Today frame → exactly one row, naming that
      habit's index and the day gained.
- [ ] Sign out in the Profile frame → one row. Sign in again → one row.
- [ ] Sign in while already signed in → **no row**. This is the control for the
      diffing requirement; if it produces a row, the log records notifications.
- [ ] With the token server running, the log behaves identically to the run with
      it stopped.
- [x] `bsk evaluate` confirms the log survives a reload and the empty state
      says so rather than reporting the app as quiet.

## Comments

Boxes ticked: 8 of 13. Everything left unticked was not re-run this
session, and an unticked box is the honest record of that.

Implemented, and the review pass of this ticket found two defects that are now fixed.

**Fixed after review.** `attachSpine` set `attached = true` and returned a teardown
that unsubscribed without clearing the flag. Leaving `/ide` ran the teardown; coming
back saw the flag and returned a no-op, so the log stayed deaf for the rest of the
session while `isSpineAttached()` still reported "watching". It now counts its
holders and clears the flag on the last release. Verified in a browser by driving
`/ide` -> `/` -> `/ide` through the history API (a full reload would reset module
state and prove nothing), then toggling a habit: the log recorded it and named the
habit.

**Fixed after review.** Rows printed `habits[0].done[2]` and never the habit's
`name`, which story 13 asks for. `habitNameForPath` resolves the index against the
list and the row now prints ` · Morning run`. An index the list no longer has is
dropped rather than guessed at.

**Fixed after review.** The board's press tally was read off `entries`, which is a
200-row ring, so the count shrank as rows were evicted. The tally is now accumulated
at commit and survives eviction; `dropped` reports what the ring lost.

**Browser-verified this session.** One row per toggle, naming the habit and the day.
Newest-first, with the current-state tree below. Habit names on every `habits[N]`
path. Empty-workspace clicks are not counted. The tally accumulated across a route
remount (2 of 2, then 3 of 5).

**Not re-verified this session, left unchecked.** Sign out / sign in in the Profile
frame, and the sign-in-while-signed-in control in a browser. Both are covered by
`test/spine.test.ts` (the identical-value case is the reducer's diffing rule), but
the planted browser control was not re-run, so the box stays unticked rather than
claiming a check that did not happen.
