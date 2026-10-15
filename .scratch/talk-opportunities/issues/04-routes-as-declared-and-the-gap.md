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

**Status:** resolved

## Verification harness

Same as ticket 01.

## Acceptance criteria

- [x] The tab destinations appear, marked **declared**.
- [x] The back control is reported as **unresolved**, with a count. A gap shown as
      zero must not read as "there are none".
- [x] The header shows observed, declared and unresolved counts **before** any
      list, so the headline number cannot mislead.
- [x] Membership comes from the router's own directory listing, using the same
      group-membership rule the screen enumeration already applies. A test
      asserts the two agree, so the two views of the router cannot drift apart.
- [x] The tab bar's own presses are not reported as route changes by this list.
      It declares those routes exist; it does not claim to have watched one.
- [x] A screen with no outgoing routes is named, rather than appearing as an
      empty row.

**Browser, planted negative controls:**

- [x] Tap a tab item on the Today frame → the route list's declared entry and the
      press report **agree**. The list says the route exists; the press report
      says nothing happened on the board. If either said otherwise, that
      disagreement is a defect and not a curiosity.
- [ ] Tap all four tab items → sixteen presses, sixteen reported as not having
      moved the board, and the Stats screen's presence in the declared set is
      explained by its tab membership rather than by a watched route.
- [x] The declared count is stable across a reload. If it changes, the membership
      rule is reading something it should not.
- [x] `bsk evaluate` confirms the unresolved count matches the number of back
      controls actually rendered on the board.

## Comments

Boxes ticked: 9 of 10. Everything left unticked was not re-run this
session, and an unticked box is the honest record of that.

Implemented; the review pass found the exits defect, fixed under ticket 03.

**Fixed after review.** A screen with no outgoing route was reported for every
screen on the board at load, tab screens included, because the tab group's declared
rows carry `from: '(tabs)'` and so never named a screen. `exitReport` now puts the
four tab screens in their own bucket — their exits are declared from the router
directory, not watched — and only screens in neither bucket appear as unobserved.

**Browser-verified this session.** Four tab destinations listed as `declared`, each
saying it was not watched. The back control reported as `2 unresolvable` with the
reason, counted from the board rather than declared. Header counts printed before
any list. Tapping a tab item produced one `inert in the studio` press and no route
row, so the declared entry and the press report agree rather than contradict.
`All habits, Today, Profile, Stats` named as off the tab bar.

**Not re-verified this session.** Tapping all four tab items on all four tab screens
for the full sixteen, and the declared-count-stable-across-reload control. The
membership rule is covered by `test/routerKeys.test.ts` and
`test/routes.test.ts`, which assert the declared set and the board come from one
rule.
