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

**Status:** ready-for-agent

Runs parallel to 03 and 04. It needs the log, not the routes.

## Verification harness

Same as ticket 01. Note the count by hand first, then confirm the studio reports
the same number — an automated check that agrees with a hand count is the only
kind worth trusting here.

## Acceptance criteria

- [ ] Every press on the board is recorded, **including presses the component
      swallows**. The listener attaches in the capture phase, the way the zoom
      listener already attaches a wheel handler to the same node, because capture
      phase runs before the component's own handler.
- [ ] A press that produced an event is live. A press that produced none is
      reported as inert.
- [ ] The wording says the control is inert **in the studio**, not unavailable.
      It must not imply the app is missing a feature it has.
- [ ] Each press is attributed to a frame by the platform's own element
      identifier, **never a custom data attribute**. A custom attribute is
      filtered off before it reaches the document, and once made a comparison walk
      zero pairs while the panel reported that it had simply not run yet.
- [ ] Two presses inside one interaction are not both credited with the single
      change between them. The second is reported as unattributed rather than
      credited, so the live count cannot be inflated.
- [ ] The reader reports **how much it observed**, and zero never renders as
      "nothing found". A sound decision function fed nothing by a broken reader is
      a failure this codebase has already shipped once.
- [ ] Presses are distinguished between the current column and the comparison
      column.
- [ ] A press is not reported as the cause of a state change. The log shows what
      changed and where the press landed as two facts, with no arrow between them,
      because the change usually repaints a different frame than the one pressed.

**Browser, planted negative controls:**

- [ ] Tap a habit card in the Today frame → live.
- [ ] Tap the avatar → inert.
- [ ] Tap all four tab items on all four tab screens → sixteen inert.
- [ ] Tap the Stats screen's four tab items → four more inert, and that screen
      reports zero live controls, which is correct and worth checking rather than
      assuming.
- [ ] Tap a control that is unimplemented everywhere → reported no more strongly
      than one that is inert only in the studio.
- [ ] `bsk evaluate` clicks a target and confirms the count updates, then
      confirms a click on empty workspace space is **not** counted as a press on a
      control.
