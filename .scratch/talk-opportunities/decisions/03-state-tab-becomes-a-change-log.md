Type: task
Status: open
Blocked by: 02

## Question

Turn the state tab from a snapshot of the store into a log of what the store did.

## Why

`StatePanel.tsx` is correct and still misses the point. It subscribes to
`useHabits()` and renders `signedIn`, `selectedId`, `habits`. The talk's line was
*"I can see what the state is doing as I click around the app"* — the verb is
**doing**.

A tree of current values cannot answer that. `habits` is six objects holding up
to seven ISO date strings each; toggling one habit rewrites one element of one
array, and the tree before and after are equally plausible to read. You have to
remember the previous one, and nobody remembers an array of date strings.

**The sharpest current failure.** There are two stores. The panel watches
`useHabits`. `settings.tsx:44` calls `setScheme` on the *token editor* store,
which repaints **every frame on the board** because `useTheme()` reads `scheme`
from there. So the most dramatic interaction in the studio shows nothing in the
state tab. That is the talk's own demo inverted — he logged out and watched
Redux reset; here the state changes, visibly, everywhere, and the panel is
silent.

## Scope

- **Both stores.** `useHabits` and the token editor store, from ticket 02's
  spine. The current panel watches one.
- **Differences, not values.** Reuse `ds/drift.ts`. The baseline tab already
  prints `{ path, current, baseline, kind }`; this prints the same shape with
  `baseline` meaning *the previous value*, not `HEAD`. Same rows, same
  normaliser, same bugs fixed once.
- **Chronological, newest first**, each row naming the frame it was clicked from
  and the store it landed in.
- **Keep the tree, below the log.** It is the answer to "what is the state right
  now", which the log does not answer. Two views, clearly separated — the log is
  what you read while clicking; the tree is what you read when you want the
  shape.

The existing `Node` renderer has no collapse, so `habits` unrolls every key of
every habit. That is tolerable at six habits and will not be at sixty, but it is
not this ticket.

## The honest-zero requirement

Three states, visibly distinct, and never collapsing into one another — the
direct lesson of the six silent bugs:

| State | Means |
|---|---|
| watching | subscribed, nothing has changed yet |
| no changes yet | subscribed, zero events — **not** "state is stable" |
| spine unavailable | the mechanism did not attach |

"Nothing has happened" and "I am not looking" must never render the same string.
Ticket 10's first bug printed "not compared yet" while walking zero pairs, and
that phrasing is exactly what made a broken tool read as a working one.

## Scope boundaries

- No time travel, no history beyond the ring buffer, no devtools integration.
  `mobile-dev-env` ticket 09 already settled the last one.
- Not a third tab. This replaces the contents of the existing `state` tab.
- The store's actions (`signIn`, `toggleToday`) are **not** exposed as buttons.
  The blueprint is the input device; the panel is the output. A panel that can
  drive the store is a second way to get into the same state, and then the log
  has two indistinguishable causes.

## Verification

- Toggle a check in `index`: one row, `habits.0.done` gained `"2026-08-19"`, frame
  `index`, store `habits`. Negative control — the row must name the **index** of
  the habit that moved, not just the path.
- Switch to Dark in `settings`: one row on the **token** store, naming `scheme`.
  Before the change, this produced nothing at all. That is the bug.
- Sign in while already signed in: **no row.** The diffing negative control.
- Reload with the server absent: the log is empty and says so. Not "state is
  clean", not "no changes detected".
- Cap the buffer and overflow it: the UI says the oldest entries were dropped.

## Tests

- `diffStores` against `ds/drift.ts`: deep-equal snapshots produce no rows.
- A row cannot be constructed without a store name — the two-store defect was
  exactly a row that could not say which store it came from.
- The three empty states are three distinct strings, asserted against the real
  component source. Cheap, and it is the class of bug that a screenshot review
  catches and a test does not, so it needs both.
