Type: task
Status: open
Blocked by: —

## Question

Make every control on the blueprint account for what it did.

## Why this is first

Tallying the interactive surface on the seven frames, at the default store state:

| Frame | Controls | Live | Dead |
|---|---|---|---|
| `index` | 6 habit cards, 6 check buttons, 1 avatar, 1 stats card, 4 tab items | 12 | 6 |
| `habits` | 6 rows, 4 tab items | 6 | 4 |
| `stats` | 4 tab items | 0 | 4 |
| `profile` | 1 settings row, 1 sign-out, 4 tab items | 1 | 5 |
| `habit` | 1 toggle (only once a habit is selected), 1 BackBar | 1 | 1 |
| `settings` | Light/Dark, 1 BackBar, 4 inert Toggles | 2 | 5 |
| `login` | 1 sign-in | 1 | 0 |
| | **48** | **23** | **25** |

Counted at the default store state, so `index` shows its signed-in branch and
`habit` its empty one.

**Roughly one control in two gives press feedback and then nothing.** `Card`
and `Button` in `ui/index.tsx` pass `onPress` straight to a `Pressable` with
`pressed && { opacity: 0.6 }`, so a dead tap still dims. The tool *answers* the
touch and then does nothing, which is worse than ignoring it.

The dead ones are dead for a good reason — `useNavigate` no-ops under
`DesigningProvider`, and `ui/index.tsx:206` returns early from the tab bar — but
the reason is invisible from the board. Nothing on screen distinguishes "this
control is inert here on purpose" from "this control is broken".

This is the `data-*` bug's exact shape: a control that does nothing, reported by
a UI that reads as though it did. It is the first thing a user meets.

## Scope

Observation only, and **no app-code edit** — which is the constraint that makes
this interesting, because `ui/index.tsx` is guarded.

- Record every click on the blueprint at **capture phase** on the workspace
  node, exactly as `Blueprint.tsx` already attaches a capture-phase `wheel`
  listener to the same ref. Capture phase runs before React's handlers, so a
  click that a `Pressable` swallows is still seen.
- Attribute the click to a frame by walking up to the nearest ancestor carrying
  a `nativeID` of `screen-*` or `base-*`. `nativeID` maps to a real DOM id;
  `data-*` does not reach the DOM at all (ticket 10's first bug).
- Pair each click against the event spine from ticket 02. **A click that
  produces no event is a dead tap.** That is the whole definition, and it needs
  no knowledge of which control it was.
- Report it in place: the control dims and does nothing — the studio cannot
  change that, `ui/index.tsx` is guarded — so the report is a **count in the
  blueprint chrome** and a **row in the change log**, not a tooltip on the
  control.

**Do not label a tap "disabled" or "unavailable".** Both are wrong. It is live in
the app and inert in the studio, and the wording must say which.

The three inert `Toggle`s in `settings.tsx` (`onPress={() => {}}`) are dead
everywhere, including in the app. They are genuinely unimplemented, and the
report should not claim otherwise — which means the distinction between "dead
here" and "dead everywhere" is worth keeping, and the ticket should say how it
knows. It probably cannot know, and if it cannot, the wording stays at "did
nothing in the studio", which is true in both cases.

## Verification

Negative control, in a real browser, counted by hand first:

- Tap a habit card in the `index` frame → `select` fires → `selectedId` changes →
  the `habit` frame repaints from its empty branch to the detail. **Live.**
- Tap the `index` avatar → nothing. **Dead.** 1 of 25.
- Tap `Light` in the `settings` frame → every frame repaints. **Live**, and it
  changes the *token* store, which ticket 03 has to notice.
- Tap all four tab items on all four tab screens → 16 dead taps.
- Stop the token server and repeat. The board must be unchanged, because none of
  this touches the server.

Both modes, because neither uses it.

## Tests

- The spine's rule, as a pure function: `classifyClicks(clicks, events)` returns
  live / dead per click. Table-driven.
- A test that a click with no matching event classifies as dead, and that two
  clicks inside one tick with one event do **not** both count as live — the
  pairing is 1:1 by tick, so the second is reported as unattributed rather than
  credited.
- Static, following `test/chrome.test.ts`: the click listener is attached at
  capture phase (`{ capture: true }`) on the workspace ref. A test that reads
  `Blueprint.tsx` and asserts it. This is the mechanism of the bug class, so it
  is worth pinning even though the browser test is the real one.
