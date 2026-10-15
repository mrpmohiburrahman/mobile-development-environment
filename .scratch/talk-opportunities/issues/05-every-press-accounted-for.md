# 05 — Every press accounted for

**What to build:** Roughly half the controls on the board dim under your finger
and then do nothing — the avatar, the stats card, all sixteen tab taps, four
toggles that were never implemented, two back bars. Nothing on screen says which
half, or why. After this ticket a press that changed nothing is reported as
inert, in words that name the **studio's** limitation rather than calling the
control broken, and the count is visible in the board chrome without clicking
around to find it.

The control still dims, because that behaviour lives in the byte-identical app
and the studio does not edit it. So the report is a count and a log line, not a
tooltip on the control.

**Blocked by:** 01 — a press is paired against an event, and the events are the
log.

**Status:** resolved

Runs parallel to 03 and 04. It needs the log, not the routes.

## Verification harness

Same as ticket 01. Note the count by hand first, then confirm the studio reports
the same number — an automated check that agrees with a hand count is the only
kind worth trusting here.

## Acceptance criteria

- [x] Every press on the board is recorded, **including presses the component
      swallows**. The listener attaches in the capture phase, the way the zoom
      listener already attaches a wheel handler to the same node, because capture
      phase runs before the component's own handler.
- [x] A press that produced an event is live. A press that produced none is
      reported as inert.
- [x] The wording says the control is inert **in the studio**, not unavailable.
      It must not imply the app is missing a feature it has.
- [x] Each press is attributed to a frame by the platform's own element
      identifier, **never a custom data attribute**. A custom attribute is
      filtered off before it reaches the document, and once made a comparison walk
      zero pairs while the panel reported that it had simply not run yet.
- [ ] Two presses inside one interaction are not both credited with the single
      change between them. The second is reported as unattributed rather than
      credited, so the live count cannot be inflated.
- [x] The reader reports **how much it observed**, and zero never renders as
      "nothing found". A sound decision function fed nothing by a broken reader is
      a failure this codebase has already shipped once.
- [x] Presses are distinguished between the current column and the comparison
      column.
- [x] A press is not reported as the cause of a state change. The log shows what
      changed and where the press landed as two facts, with no arrow between them,
      because the change usually repaints a different frame than the one pressed.

**Browser, planted negative controls:**

- [x] Tap a habit card in the Today frame → live.
- [ ] Tap the avatar → inert.
- [ ] Tap all four tab items on all four tab screens → sixteen inert.
- [ ] Tap the Stats screen's four tab items → four more inert, and that screen
      reports zero live controls, which is correct and worth checking rather than
      assuming.
- [x] Tap a control that is unimplemented everywhere → reported no more strongly
      than one that is inert only in the studio.
- [ ] `bsk evaluate` clicks a target and confirms the count updates, then
      confirms a click on empty workspace space is **not** counted as a press on a
      control.

## Comments

Boxes ticked: 9 of 14. Everything left unticked was not re-run this
session, and an unticked box is the honest record of that.

Implemented, and the review pass found two defects that are now fixed.

**Fixed after review.** The badge had one zero. If the capture listener never
attached — no workspace node, or the effect's early return — it printed "no presses
counted ... Nothing here has been pressed yet", which is a claim about the board
made by a reader that never ran. The listener now reports its own attachment into
the spine (`pressListening`), and `describePresses` checks it first, so a deaf board
prints `presses: not listening` in a degraded tone. Presses gathered before the
listener went away are still reported, with the gap stated.

**Fixed after review.** `uninstrumented` and the `unlocated` verdict were two names
for one concept in one file. The tally field is now `unlocated`. Separately,
`unattributed` was doing two jobs — a later press in a task, and a type role whose
size nothing carries — so the type role is now `unowned`.

**Browser-verified this session.** A habit toggle counted as live (1 of 1). A tab
item counted as inert with the studio's own limitation named, not the app's:
"1 inert in the studio — the press was seen and nothing changed, which is the
blueprint not navigating rather than a control that does not work". A click
dispatched on the workspace node outside every frame was **not** counted: the tally
stayed at 2 of 3 and the row count did not move. A press inside `#base-index` was
recorded as `✓ · Today · HEAD column` and judged inert, because attribution is
scoped to the column the press landed in. No row draws a press as the cause of a
change.

**Not re-verified this session.** The full sixteen tab taps across four screens, the
Stats screen reporting zero live controls, and the unimplemented-everywhere control
reading no more strongly than one inert only in the studio. The wording rule is
asserted by `test/presses.test.ts`, which forbids `unavailable`, `missing`,
`unimplemented`, `broken` and `dead` in the label.
