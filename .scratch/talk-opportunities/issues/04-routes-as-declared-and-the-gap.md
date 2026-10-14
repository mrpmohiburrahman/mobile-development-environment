# 04 — Routes, as declared, and the gap

**What to build:** The four tab destinations are real routes that the studio
**cannot watch**, because the tab bar reaches the router directly and that file is
byte-identical. They appear anyway, marked as read rather than watched. The back
control, which resolves against history and cannot be an edge at all, appears as
a gap with a count.

The header leads with how many of each kind there are, so a reader who sees a
headline number is told how it was arrived at. A reader who sees "11 routes" with
no breakdown will believe the studio watched all eleven. It watches seven.

**Blocked by:** 03 — the provenance machinery and the list must exist first.

**Status:** ready-for-agent

## Verification harness

Same as ticket 01.

## Acceptance criteria

- [ ] The tab destinations appear, marked **declared**.
- [ ] The back control is reported as **unresolved**, with a count. A gap shown as
      zero must not read as "there are none".
- [ ] The header shows observed, declared and unresolved counts **before** any
      list, so the headline number cannot mislead.
- [ ] Membership comes from the router's own directory listing, using the same
      group-membership rule the screen enumeration already applies. A test
      asserts the two agree, so the two views of the router cannot drift apart.
- [ ] The tab bar's own presses are not reported as route changes by this list.
      It declares those routes exist; it does not claim to have watched one.
- [ ] A screen with no outgoing routes is named, rather than appearing as an
      empty row.

**Browser, planted negative controls:**

- [ ] Tap a tab item on the Today frame → the route list's declared entry and the
      press report **agree**. The list says the route exists; the press report
      says nothing happened on the board. If either said otherwise, that
      disagreement is a defect and not a curiosity.
- [ ] Tap all four tab items → sixteen presses, sixteen reported as not having
      moved the board, and the Stats screen's presence in the declared set is
      explained by its tab membership rather than by a watched route.
- [ ] The declared count is stable across a reload. If it changes, the membership
      rule is reading something it should not.
- [ ] `bsk evaluate` confirms the unresolved count matches the number of back
      controls actually rendered on the board.
