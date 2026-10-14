Type: research
Status: open
Blocked by: —

## Question

Rafael hedged his own idea. Do I have the confidence his condition asks for?

> "I would also love to do my visual regression testing on the web version of the app, instead of the mobile version, because that seems to be easier. **If I have a reasonable confidence that what is displayed here will be what's displayed on mobile**, then it's just probably easier to do visual regression testing on web."

The prior map answered a different question — *should we add screenshots* — and
answered it correctly: baseline mode is not a pixel diff, and neither the UI nor
the README may imply otherwise. That stands. This ticket is the question Rafael
actually asked, and the answer turns on a measurement nobody has taken.

## Case FOR building a pixel diff

- It is the bullet the talk names.
- **It catches a class baseline mode structurally cannot.** Baseline mode
  compares current against `HEAD`, both rendered from the *same components*. A
  defect in the component is invisible: both sides are broken identically and the
  comparison reports agreement. Committed screenshot baselines would catch
  overflow, a collapsed layout, a missing margin, a screen stuck on its
  empty-state branch.
- It is the only item of the five that produces an artifact usable outside the
  browser: a PNG in git, diffable by anything.
- Captured on one machine in one session it *can* be clean. Font availability is
  stable on a given machine. The noise objection is about portability, and a
  locally-run baseline never moves.

That last point is the strongest version of the case and it deserves to be
stated rather than argued past.

## Case AGAINST

**The font stack is not loaded. It is absent.**

`mobile/src/global.css:2-4`:
```css
--font-display: Spline Sans, Inter, ui-sans-serif, system-ui, sans-serif, ...
```

Checked on this machine:

| Check | Result |
|---|---|
| `Spline Sans` installed | **No** — zero matches in every system font directory |
| `Inter` installed | **No** — an apparent 196 grep hits were all `…Interface-*` font *files* |
| `@font-face` in `mobile/src` | **none** |
| `expo-font` imported | **nowhere**, though it is in `package.json` |
| `fontFamily` in `type.*` tokens | **absent** — only `size`, `weight`, `lineHeight`, `letterSpacing` |

So the stack resolves to `system-ui` → SF Pro, here, today. On a machine with
Inter installed, to Inter. On Linux, to DejaVu Sans or Liberation Sans.
**Three machines, three rasters, one committed tree.**

This is worse than the race the prior map described. Font *loading* is a timing
problem `document.fonts.ready` solves. Font *availability* is a per-machine
property, permanently in the pixels, and waiting does not touch it — no webfont
is loading because none is declared. The stack has already settled.

Also in the same file, applied to `html, body, #root`, so to every screen:
`-webkit-font-smoothing: antialiased` (macOS only), `-moz-osx-font-smoothing:
grayscale`, and `text-rendering: optimizeLegibility` — kerning and ligatures,
whose behaviour shifts between Chromium versions.

**The board is scaled.** `Blueprint.tsx` renders under
`transform: [{ scale }]` at a default of 0.5. Every capture is a scaled
rasterisation, so a baseline must pin scale and `devicePixelRatio` — more
machinery, more ways to be quietly wrong.

**The capture path costs something.** Checked against the Expo SDK 57 docs, per
`mobile/AGENTS.md`:

| Option | Cost |
|---|---|
| `expo-screen-capture` | `platforms: [android, ios, expo-go]` — **no web**; and it *prevents* capture rather than taking it |
| `react-native-view-shot` | web-supported and in the SDK's third-party list, so `npx expo install` resolves it — but its web path rasterizes the DOM, which means **`html2canvas`**: two runtime dependencies, and a library that reimplements layout to make the image |
| Playwright / Puppeteer | correct pixels, full font and DPR control — plus a devDependency, a browser download and a build step, against `node --test` and a stdlib-only server |

**It contradicts the repo's stated claim.** `BaselinePanel.tsx:18-25` and the
README both say in plain words: *"It is not a pixel diff of two screenshots… A
pixel diff would report the zoom level, whichever font happened to load, and
antialiasing as drift, none of which are drift in the design system."* Building
it means rewriting the repo's central honesty claim, or running two contradictory
claims side by side.

**And what it uniquely catches is not really a screenshot problem.** The one
class baseline mode misses — a component-level break — is a defect in
*rendering*, not in *diffing*. The repo already has a sounder tool:
`detectDriftInSubtrees` returns `structureMismatch`, and ticket 10 found by
reading the source that `habit.tsx` falls back to a "No habit selected" branch
with no Card and no Button. That is precisely the class a pixel diff would
flag, caught structurally, with no dependency and no font.

## Why the fonts settle it rather than merely complicating it

Ask what a font-independent visual regression would have to exclude.

**Geometry**, because geometry is font-dependent through text wrapping. A wider
fallback rewraps a paragraph and a card changes height by tens of pixels;
rounding does not help. Exclude geometry and it is not a visual regression at
all — it is the style comparison that already exists, plus a node count.

So every *unique* thing a pixel diff would give this repo is font-dependent, and
this app has no fixed typeface. **The premise is unsatisfiable as the repo
stands.** Not "noisy" — unsatisfiable. That is a much cleaner reason than a list
of noise sources, and it is checkable.

The premise becomes satisfiable the day the app ships a webfont — which is a
real decision with its own costs (a variable-font subset, a change to what the
app actually renders, and a fresh divergence from native, which uses system
fonts). That is a separate ticket, and it is the precondition this one waits on.

## Recommendation: build the measurement, not the screenshots

Rafael's condition can be **checked** rather than assumed, it costs nothing, and
the honest answer today is *no*. A studio that printed its own confidence level
would be making a stronger claim than one that quietly assumed one.

- **Font resolution probe.** Width-probe each candidate family in
  `--font-display` against a known-different reference. Equal widths mean the
  family fell through to its fallback. Pure DOM, zero dependency, testable in a
  browser, and it produces a line a person can read:
  `typeface: Spline Sans absent, Inter absent → SF Pro (system-ui)`.
- **Token-to-screen verification.** For each `type.*` role, read the computed
  `font-size`, `line-height`, `letter-spacing` off a real screen in the real
  render and assert it equals the token. This is the other half of Rafael's
  condition — *will be what's displayed on mobile* — and it is measurable today
  for the properties RNW does render faithfully. It is a weaker claim than
  pixels and a stronger one than nothing.
- **Report the count.** Sizing, spacing, radius, colour and elevation: how many
  of the 24 properties a token can move were verified on how many screens.

`CDP`'s `CSS.getPlatformFontsForNode` gives the exact answer, and Playwright can
reach it — but it needs a browser driver, which is the dependency this repo
refuses. The width probe is the cheap approximation and it is enough to turn
"presumably" into a printed verdict.

**Then the pixel-diff ticket stops being closed on principle and waits on a
precondition.** If the report ever says every family resolved as designed, the
confidence Rafael asked about exists, and the screenshot suite becomes a
reasonable thing to build. Until then it is not a judgement call, it is
unmeasured — and the measurement is the deliverable.

## Verification

- The probe reports Spline Sans and Inter as absent **on this machine**, which is
  the fact the whole argument rests on. If it reports them present, the argument
  is wrong and the map says so.
- Change `type.body.size` in the studio and watch the verification line move.
- Run it with the token server absent. It must report the same verdict — it
  reads rendered styles, not the file — and that is itself a useful cross-check.
- Plant a token change that does not reach a screen and confirm the verification
  catches it, rather than reporting a clean bill of health.

## Tests

- The width probe against a family that is definitely absent and one that is
  definitely present, so the comparison's polarity is pinned.
- A verdict cannot be rendered without every candidate family accounted for —
  an unanswered candidate must read as *unknown*, never as *fine*.
- Static: no new dependency in `mobile/package.json` and no new import in
  `token-server/`. If this ticket ever needs `html2canvas`, it has stopped being
  this ticket.
