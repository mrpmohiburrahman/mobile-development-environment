# 01 — A change log for the app store

**What to build:** The state tab stops showing only what the store is and starts
showing what it did. Toggling a habit's check on the board writes a row naming
the habit and the day that changed; signing in or out writes one too. Rows are
newest-first, each names the store it landed in, and the existing tree stays
below so that "what is the state right now" still has an answer. Signing in
while already signed in writes nothing.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

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

- [ ] A store change produces a row naming the path that changed, its previous
      and current value, and the store it landed in.
- [ ] A store setter that writes an identical value produces **no** row. This is
      the case that makes a notification-log useless within a minute.
- [ ] Rows are newest-first, and the existing state tree remains below them. The
      log answers "what did it do"; the tree still answers "what is it".
- [ ] The log distinguishes three states in words — watching with nothing yet,
      watching with nothing found, and not watching — and no two of them ever
      render as the same string.
- [ ] The tree differ already in the codebase does the comparison. There is no
      second implementation, because a second differ is a second set of the
      normalisation bugs this one already carries fixed.
- [ ] The spine is a pure module that loads under the type-stripping test runner.
- [ ] The buffer is capped, and the cap is stated in the UI when reached. A
      truncated history must never read as a complete one.
- [ ] The state tab exposes no control that drives the store. The board is the
      input device; the panel is output.

**Browser, planted negative controls:**

- [ ] Toggle a habit check in the Today frame → exactly one row, naming that
      habit's index and the day gained.
- [ ] Sign out in the Profile frame → one row. Sign in again → one row.
- [ ] Sign in while already signed in → **no row**. This is the control for the
      diffing requirement; if it produces a row, the log records notifications.
- [ ] With the token server running, the log behaves identically to the run with
      it stopped.
- [ ] `bsk evaluate` confirms the log survives a reload and the empty state
      says so rather than reporting the app as quiet.
