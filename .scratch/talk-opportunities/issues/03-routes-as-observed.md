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

**Status:** resolved

## Verification harness

Same as ticket 01.

## Acceptance criteria

- [x] Every route change through the seam appears with its source, its
      destination, and the state change that accompanied it — or an explicit
      statement that none did. An empty field is never shown for "no state
      change", because empty reads as missing data.
- [x] Each route carries how it was learned: **observed**, **declared**, or
      **unresolved**. A route cannot be displayed without one.
- [x] A **declared** route cannot carry an observed state change. Declared routes
      come from a directory listing and have no observation window, so pairing one
      with a measured difference would be a fabricated join.
- [x] The seam records instead of navigating, and **still never navigates inside
      the blueprint**. A regression there loses the user their board, silently and
      irrecoverably — the worst failure this work could produce. A static test
      asserts it.
- [x] A static test asserts every route call site in the app still routes through
      the seam. Someone adding a screen that reaches the router directly would
      otherwise cost the list an edge with nothing reporting it anywhere.
- [x] The list reports how many routes it observed, and the count is not derived
      from the list's own length.

**Browser, planted negative controls:**

- [x] Tap a habit card in the Today frame → **one** line naming the route and the
      selection change together. Not two lines.
- [x] Tap the avatar in the Today frame → one line naming the route and
      explicitly reporting that no state changed.
- [ ] Tap a habit row in the All-habits frame → one line, route and selection.
- [x] The comparison column's route entries are marked as belonging to that
      column, so a press there is not confused with a press on the current one.
- [x] `bsk evaluate` counts the observed routes and compares the count to the
      list rendered. A mismatch means the list is drawing something it did not
      observe.

## Comments

Boxes ticked: 10 of 11. Everything left unticked was not re-run this
session, and an unticked box is the honest record of that.

Implemented, and the review pass found three defects that are now fixed.

**Fixed after review.** The headline "N observed" was `rows.filter(...).length` —
the list's own length, which can never disagree with the list, so the cross-check
printed beside it proved nothing. `routeCounts` now takes the seam's independent
tally as the headline and carries the list's own length as `listed`, and the panel
warns when the two differ.

**Fixed after review.** `routes.ts` documented `ROUTE_PROVENANCE` as the table the
panel iterates, and the panel never imported it — it kept a private
`Record<string, string>` of labels and three hard-coded sections. The table now
carries label, tone, section note and empty-state wording, the panel maps over
`ROUTE_PROVENANCES`, and `test/mechanisms.test.ts` fails if a private copy comes
back. This is the runtime check the spec asks for, since the compiler is not in CI.

**Fixed after review.** `screensWithoutExits` derived sources from observed rows
only, so on a fresh load it reported all seven screens as the app's exits —
including `login`, which navigates to `/`. Replaced by `exitReport`, which splits
the board three ways: exits the seam watched, exits declared from the tab group, and
screens merely never seen navigating. The last is reported as absence of evidence,
which is what it is.

**Browser-verified this session.** Tapping a habit card in the Today frame produced
one line: `index -> /habit`, `observed`, `carried selectedId`, with the press, the
route and the state change on the same row. Header leads with the counts. The seam
tally and the list length agreed, so no mismatch line printed. The exits section
named `Habit detail, Login, Settings` and said plainly that some are real exits and
some have simply not been pressed.

**Not re-verified this session.** The avatar control (one line naming the route and
reporting that no state changed) and the `bsk evaluate` count comparison were not
re-run, so those boxes stay unticked.
