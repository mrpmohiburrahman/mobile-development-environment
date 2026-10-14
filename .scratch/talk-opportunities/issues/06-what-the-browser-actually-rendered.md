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

**Status:** ready-for-agent

## Verification harness

Same as ticket 01. This ticket leans hardest on `bsk evaluate`, because its
subject is measured rather than observed.

## Acceptance criteria

- [ ] The verdict names **every** candidate family in the display stack and its
      fate. An unanswerable candidate reads as **unknown**, never as fine. A
      verdict that flatters itself is worse than no verdict.
- [ ] Family resolution is measured by width comparison: render a test string in
      each candidate and in a known-different reference, and equal widths mean the
      candidate fell through to its fallback. Pure DOM, no driver, no dependency.
- [ ] The report states **how many screens and how many properties** were
      verified, so the sample size sits next to the claim.
- [ ] A type token that fails to reach a screen is caught, rather than the report
      passing on a broken render.
- [ ] The verdict is **the same with the token server running and stopped** — it
      describes the browser, not the file — and that equality is itself a useful
      cross-check.
- [ ] No new dependency, in the app or the server. If this ever needs a
      rasterisation library, it has stopped being this work.

**Browser, planted negative controls:**

- [ ] On this machine the verdict names both missing families and says what it
      fell back to. **If it reports them present, the work's premise is wrong and
      that is the finding.**
- [ ] Change a type size in the token panel → the verification line moves.
- [ ] `bsk evaluate` measures the resolved family independently, outside the
      studio's own code, and the two agree. If they disagree, one of them is
      measuring the wrong thing and the disagreement must be resolved rather than
      averaged.
- [ ] `bsk evaluate` confirms the computed size, line height and letter spacing on
      a real screen equal the token values, for each type role.
