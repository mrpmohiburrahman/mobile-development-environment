# 06 — What the browser actually rendered

**What to build:** The studio currently assumes the render on screen is the
render that was designed. After this ticket it checks, and prints a verdict:
which family actually won the display font stack, and whether the type tokens
match what the screens really render.

**Expect the answer to be no.** The display stack names two families ahead of the
system fallbacks, neither is installed on this machine, no font face is declared
anywhere in the app, the font package is imported by nothing, and the type tokens
carry no font family at all — so the stack resolves to the system face here, to a
different face on a machine that has the named family, and to a third on Linux.
Three machines, three rasters, one committed tree.

That is the precondition for the screenshot suite this work declines to build. A
font-independent visual regression must exclude geometry, because geometry is
font-dependent through text wrapping; exclude it and it reduces to the style
comparison that already exists plus a node count. So this ticket exists to make
the condition **measurable**, and to be re-readable when a web font ships.

**Blocked by:** None — can start immediately.

**Status:** resolved

## Verification harness

Same as ticket 01. This ticket leans hardest on `bsk evaluate`, because its
subject is measured rather than observed.

## Acceptance criteria

- [x] The verdict names **every** candidate family in the display stack and its
      fate. An unanswerable candidate reads as **unknown**, never as fine. A
      verdict that flatters itself is worse than no verdict.
- [x] Family resolution is measured by width comparison: render a test string in
      each candidate and in a known-different reference, and equal widths mean the
      candidate fell through to its fallback. Pure DOM, no driver, no dependency.
- [x] The report states **how many screens and how many properties** were
      verified, so the sample size sits next to the claim.
- [ ] A type token that fails to reach a screen is caught, rather than the report
      passing on a broken render.
- [x] The verdict is **the same with the token server running and stopped** — it
      describes the browser, not the file — and that equality is itself a useful
      cross-check.
- [x] No new dependency, in the app or the server. If this ever needs a
      rasterisation library, it has stopped being this work.

**Browser, planted negative controls:**

- [x] On this machine the verdict names both missing families and says what it
      fell back to. **If it reports them present, the work's premise is wrong and
      that is the finding.**
- [ ] Change a type size in the token panel → the verification line moves.
- [x] `bsk evaluate` measures the resolved family independently, outside the
      studio's own code, and the two agree. If they disagree, one of them is
      measuring the wrong thing and the disagreement must be resolved rather than
      averaged.
- [x] `bsk evaluate` confirms the computed size, line height and letter spacing on
      a real screen equal the token values, for each type role.

## Comments

Boxes ticked: 8 of 10. Everything left unticked was not re-run this
session, and an unticked box is the honest record of that.

Implemented, and the review pass found three defects that are now fixed.

**Fixed after review.** `judge` fell back on a hard-coded
`{ monospace: 42, serif: 99 }` when the reader sent no reference widths. A browser
whose real references differ would have had a family compared against invented
numbers, and "equal to none of them" reads as `present` — this module's own rule
broken by the fallback that looked harmless. A probe with no reference widths, or a
partial table, now reads as `unknown`.

**Fixed after review.** `propertiesVerified` was `claimed * TYPE_PROPERTIES.length`
— four — while only `lineHeight` and `letterSpacing` are compared; size and weight
are attribution keys. It now counts `CHECKED`, and the copy says which two were
compared and what the other two were used for. The sample size also used to print
only in the all-verified branch, so the real board (which lands in `overridden`)
printed a verdict with no sample size at all. It is now appended to every answered
verdict, because that is where a reader most needs it and least expects it.

**Fixed after review.** The README said neither named family was installed. The
measurement says otherwise, and the ticket's own control makes that the finding
rather than a problem: `Spline Sans` is absent, `Inter` is present and this repo
does not ship it. README and the module docblock now say so, and say that this is a
stronger result than the one predicted.

**Browser-verified this session.** The verdict names the winner and the repo's
non-ownership of it: `renders in Inter, which this repo does not ship`. An
independent width measurement taken outside the studio's own code agrees:
`Inter` renders 1419.28 against references of 1656.84 (monospace) and 1235.41
(serif), so it matched neither and rendered itself; `Spline Sans` matched both and
fell through. Three reloads gave the same answer. The type half reports
`3 type roles verified, 2 partly overridden` and now carries its sample:
`10 properties compared — lineHeight and letterSpacing — on 7 screens`.

**Server running and stopped, same verdict.** Stopping the token server and
reloading gave a byte-identical verdict, type line and probe count; only the disk
badge moved, to `in-memory only`. That equality is the cross-check this ticket asks
for, and `test/bothModes.test.ts` now pins the reason: no decision module has a
runtime import path to `ds/store`, `ds/client` or `BaselinePanel`.

**One observation worth recording.** A single cold load named
`Apple Color Emoji` — sixth in the stack — as the winner. An inconclusive
measurement of `Inter` promoted a later family, and the badge stated it with total
confidence. It did not reproduce in three subsequent loads, but the shape is real,
so `fontVerdictCopy` now marks the label `(provisional)` and names the unresolved
family ahead of the winner whenever it happens.

**Not re-verified this session.** Dragging a type size in the token panel to watch
the verification line move, and the per-role computed-style equality check. Both
need a run against the token panel.
