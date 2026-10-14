# 03 — Routes, as observed

**What to build:** The studio can see which screens exist. It now shows how they
connect. Every route change passing through the studio's navigation seam
appears in a list, each carrying the state change that happened in the same
moment **on one line**, and each labelled with how it was learned.

Four of the seven already mutate state in the same synchronous task as the route
change, so those four read as a single line rather than two entries to
correlate. That join is the thing the original talk could not show: it had a
state panel and a blueprint, and no way to see them together.

**Blocked by:** 01 — the log must exist before a route change can carry a state
change beside it.

**Status:** ready-for-agent

## Verification harness

Same as ticket 01.

## Acceptance criteria

- [ ] Every route change through the seam appears with its source, its
      destination, and the state change that accompanied it — or an explicit
      statement that none did. An empty field is never shown for "no state
      change", because empty reads as missing data.
- [ ] Each route carries how it was learned: **observed**, **declared**, or
      **unresolved**. A route cannot be displayed without one.
- [ ] A **declared** route cannot carry an observed state change. Declared routes
      come from a directory listing and have no observation window, so pairing one
      with a measured difference would be a fabricated join.
- [ ] The seam records instead of navigating, and **still never navigates inside
      the blueprint**. A regression there loses the user their board, silently and
      irrecoverably — the worst failure this work could produce. A static test
      asserts it.
- [ ] A static test asserts every route call site in the app still routes through
      the seam. Someone adding a screen that reaches the router directly would
      otherwise cost the list an edge with nothing reporting it anywhere.
- [ ] The list reports how many routes it observed, and the count is not derived
      from the list's own length.

**Browser, planted negative controls:**

- [ ] Tap a habit card in the Today frame → **one** line naming the route and the
      selection change together. Not two lines.
- [ ] Tap the avatar in the Today frame → one line naming the route and
      explicitly reporting that no state changed.
- [ ] Tap a habit row in the All-habits frame → one line, route and selection.
- [ ] The comparison column's route entries are marked as belonging to that
      column, so a press there is not confused with a press on the current one.
- [ ] `bsk evaluate` counts the observed routes and compares the count to the
      list rendered. A mismatch means the list is drawing something it did not
      observe.
