# Map: The talk's five unbuilt bullets

Labels: `wayfinder:map`

## Destination

Five ideas Rafael Mendiola left on a slide at RNCK #14, each put to the test of
what the talk actually supports and what this repo has since built. Three turn
out to be worth building, one turns out to be a measurement rather than a
screenshot suite, and one needs no code at all.

Done when the board says what every tap did, the state tab reads as a change log
rather than a snapshot, the blueprint draws its edges and marks which ones it
observed, and the studio prints a verdict on the assumption the talk hedged its
visual-regression idea behind — with `git diff origin/main...HEAD -- mobile/src/ui
mobile/src/app ':(exclude)mobile/src/app/ide.tsx'` still empty.

## The five, and what the transcript supports

Counted in `transcripts/Rafael Mendiola – Build yourself a mobile development
environment with Expo web ｜ RNCK #14.txt`, not taken from the slide.

| # | Idea | In the transcript | Verdict |
|---|---|---|---|
| 1 | Watch state change | Demonstrated, on stage | Build — not a tree |
| 2 | Visualize navigation routes | `navigation` ×1, about the `designing` prop | Build — prior verdict was wrong |
| 3 | Plug in MixPanel | zero mentions of `mixpanel` or `analytics` | Reject the integration, keep the shape |
| 4 | Visual regression on web | Mentioned once, hedged | Reject the pixel diff; build the measurement |
| 5 | Blueprint for stakeholders | One sentence, "if this was being used in a large organization" | No code |

## Notes

**This map plans.** The previous two carried execution; this one starts from a
repo that already ships, and the first job is to find out what is missing rather
than to write it. Every ticket below is scoped tightly enough to execute without
re-deciding, and the tickets that decide something say so.

**Standing constraints, re-verified against the code rather than inherited.**

- `npm test` is `node --experimental-strip-types --test test/*.test.ts`. 199 tests
  pass on `HEAD`. No framework, no build step, no dependency.
- `scripts/guard.sh` covers `mobile/src/ui` and `mobile/src/app`, with
  `mobile/src/app/ide.tsx` carved out. It passes on `origin/main...HEAD`.
- `mobile/src/ds/`, `mobile/src/ide/`, `token-server/`, `test/` are studio ground.
- `token-server/index.mjs` is Node-stdlib-only: `node:http`, `node:child_process`,
  `node:fs/promises`, `node:path`, `node:url`. Nothing else.
- **None of the six tickets below needs an app-code edit.** That is the map's
  main structural claim, and ticket 01 is the one that could most easily have
  needed one.

**No ticket here needs the token server.** Every feature in this map works
identically with the server running and with it absent, because none of them
touches `tokens.json`. They are the first studio features for which the deployed
static build is not a degraded case — it is the same case.

**Voice.** These two sibling maps are design documents whose nuance is
load-bearing, so this one matches them rather than the STE profile the universal
config asks for on docs. Ticket 06 carries the user-facing text, and that is
written to STE.

## What the repo already has, against each bullet

### 1. State — the tree is live; the change is not

`mobile/src/ide/StatePanel.tsx` subscribes to `useHabits()` and renders
`signedIn`, `selectedId`, `habits`. It updates. That part is not missing.

Three things are missing, and the third is the serious one.

**It shows state, not change.** A tree of current values gives you no way to see
*what moved*. The `habits` array is six objects each holding up to seven ISO date
strings; toggling one rewrites one element of one array, and the tree before and
after look equally plausible. The talk's value was watching it change. This is
the same gap the studio already closed for tokens: `ds/drift.ts` diffs two token
trees and names what moved, and the state panel is the version of that which was
never built.

**There are two stores and the panel shows the quiet one.** `StatePanel` reads
`useHabits`. The token editor store (`ds/editorState.ts`) is separate — and it
holds `scheme`. The Settings frame's Light/Dark control calls `setScheme`, which
repaints **every frame on the board**, because `useTheme()` reads `scheme` from
that store. So the single most dramatic interaction in the studio changes
nothing the state panel shows. It is the talk's own demo — "log out, and you can
see that your Redux state is reset" — inverted: the state changes, visibly,
everywhere, and the panel is silent.

**A zustand `set` is not a change.** `set` notifies on every call, including one
that writes an identical value. `login.tsx`'s sign-in button while already signed
in fires `signIn()` and changes nothing. A log that records notifications rather
than differences fills with no-ops within a minute, which is the crying-wolf
failure in its purest form.

### 2. Navigation — the prior map's arithmetic was stale

The studio-honesty map ruled navigation out: *"`useNavigate()` in
`ide/designing.tsx` is the chokepoint, but four edges across seven screens makes
for a thin demo."*

The count is now eleven, and the split matters more than the total.

**Seven push edges, and all seven pass through one editable function.**
`ide/designing.tsx::useNavigate` is studio ground, and every `navigate(...)` call
in the app goes through it:

| From | To | State it moves first |
|---|---|---|
| `login` | `/` | `signIn()` |
| `index` | `/profile` | — |
| `index` | `/stats` | — |
| `index` | `/habit` | `select(h.id)` |
| `habits` | `/habit` | `select(h.id)` |
| `profile` | `/settings` | — |
| `profile` | `/login` | `signOut()` |

Four of the seven already mutate state immediately before navigating, because
`(tabs)/index.tsx:147` and `(tabs)/habits.tsx:47` both read
`onPress={() => { select(h.id); navigate('/habit'); }}`. Inside the blueprint
`navigate` no-ops, so **`select` still fires and the Habit detail frame repaints
from "No habit selected" to the habit's detail, in place.** The talk's headline
demo — "when I click on a story, I can see the story show up here" — already
works in this repo. Nobody built it; it fell out of the context-over-prop
decision.

**Four tab destinations, and none of them are observable.** `ui/index.tsx:207`
calls `router.navigate(tab.key)` through `useRouter()`, not through
`useNavigate()`, behind `if (designing) return;`. That file is guarded. The tab
group's membership *is* knowable — `screens.ts` still has the raw
`./\(tabs\)/stats.tsx` keys before `normalize` strips the prefix — so tab edges
can be **declared** from the router rather than **observed** at the chokepoint.
Those are different kinds of knowledge and the graph must say which is which.

**Back is not an edge.** `ui/index.tsx:247` calls `router.back()`, which resolves
against history at press time. Two frames render a `BackBar` — `habit.tsx` (in
both its branches) and `settings.tsx` — from three call sites. This is
unresolvable as a static edge and must be reported as a gap rather than drawn.

So the prior judgement fails twice over: the count was stale, and it was made
before there was anything for an edge to connect to. An edge plus the state it
moves is one feature, not two, and it is the join between the two bullets the
talk listed separately.

### 3. Mixpanel — reject it, keep its shape

Zero occurrences of `mixpanel`, `Mixpanel`, `analytics` or `Analytics` in the
transcript. One unvalidated bullet on a slide.

It is also a **product** feature arriving in a **dev tool**, and it fails three
of this repo's standing constraints at once:

- A Mixpanel SDK is a runtime dependency. The server is Node-stdlib-only and the
  app takes no dependency for anything in this studio.
- A project token would be committed, which breaks the deliberate
  credential-free clone — `mobile-dev-env` map, ticket 01: "no API keys, no
  backend, seeded local data, so a clone runs instantly."
- It has nothing to do with the studio's thesis. The claim is that design changes
  land in the codebase as git diffs. Talking to Mixpanel is orthogonal, and it
  would be the one part of the bundle that phones a third party.

What is worth keeping is the *shape* the bullet names: a chronological stream of
events from the running app. That is exactly what items 1 and 2 need, it is
zero-dependency, and it is a dev tool rather than a product feature. Ticket 02
builds it; the Mixpanel integration is not built at all.

### 4. Visual regression — the hedge was the whole answer

Rafael's exact words, and the condition is not incidental:

> "I would also love to do my visual regression testing on the web version of the app, instead of the mobile version, because that seems to be easier. **If I have a reasonable confidence that what is displayed here will be what's displayed on mobile**, then it's just probably easier to do visual regression testing on web."

So the question was never "should we take screenshots". It was *do I have that
confidence*. The prior map answered a different question and answered it well:
baseline mode compares two renders of the same components against two token sets,
and is not a pixel diff.

**Measured answer: no, not today, and the gap is fonts.**

`mobile/src/global.css:2-4` declares
`--font-display: Spline Sans, Inter, ui-sans-serif, system-ui, sans-serif`.
Checked on this machine:

- **Spline Sans: absent.** Zero matches across every system font directory.
- **Inter: absent.** An apparent 196 hits were all `.GeezaProInterface-*`,
  `.ArialHebrewDeskInterface-*` and `.HiraginoSansGBInterface-*` — the substring
  `inter` inside `Interface`. No font file named Inter exists.
- **No `@font-face` anywhere in `mobile/src`.** `expo-font` is in
  `mobile/package.json` but is imported by nothing. `type.*` in `tokens.json`
  carries `size`, `weight`, `lineHeight` and `letterSpacing` — **no
  `fontFamily`** — so every screen falls all the way through the stack.

The stack therefore resolves to `system-ui` → SF Pro here. On a machine with
Inter installed it resolves to Inter. On Linux it resolves to DejaVu Sans or
Liberation Sans. **Three machines, three different pixels, from one committed
tree.**

This is worse than the race the prior map named. Font *loading* is a timing
problem `document.fonts.ready` solves. Font *availability* is a per-machine
property, permanently baked into the raster, and no amount of waiting moves it —
no webfont is loading, because none is declared. The stack has already settled.

Two more pixel-diet items from the same file: `-webkit-font-smoothing:
antialiased` and `-moz-osx-font-smoothing: grayscale` are macOS-only and apply to
`html, body, #root`, so every screen; `text-rendering: optimizeLegibility` turns
on kerning and ligatures whose behaviour shifts between Chromium versions.

**And the capture path is not free.** Checked against the SDK 57 docs, as
`mobile/AGENTS.md` requires:

- `expo-screen-capture` is `platforms: [android, ios, expo-go]` — no web — and it
  *prevents* capture rather than taking it. Not an option.
- `react-native-view-shot` is `platforms: [android, ios, web]` and is in the
  SDK's third-party list, so `npx expo install` resolves a compatible version.
  Its web implementation rasterizes the DOM, which means `html2canvas`: two
  runtime dependencies in a bundle that has none for this purpose, and a library
  that reimplements layout to produce the image.
- Or Playwright/Puppeteer drives the real browser. Correct pixels, full control
  of fonts and DPR — and a devDependency, a browser download and a build step,
  against a repo whose test command is `node --test` and whose server is stdlib
  only.

**What a pixel diff would uniquely catch, stated honestly.** Baseline mode
compares current against `HEAD`, both rendered from the *same components*, so a
defect in the component itself is invisible to it — both sides are broken
identically. A committed screenshot baseline would catch that class.

But that is a hole in *rendering*, not in *diffing*, and the repo already has a
sounder tool for it. `detectDriftInSubtrees` already returns
`structureMismatch`, and ticket 10 found by reading the source that `habit.tsx`
falls back to a "No habit selected" branch with no Card and no Button. That is
precisely the class a pixel diff would flag — caught structurally, with no
dependency.

**The conclusion the fonts force.** Any visual regression that is
font-independent must exclude geometry, because geometry is font-dependent
through text wrapping — rounding does not help when a wider fallback rewraps a
card by twenty pixels. Exclude geometry and it is not a visual regression at
all; it is the style comparison that already exists, plus a node count. Every
unique thing a pixel diff would give this repo is font-dependent, and this app
has no fixed typeface. **The premise is unsatisfiable as the repo stands.**

That leaves the real answer, and it is better than either building or skipping:
**measure the confidence.** The talk's condition can be checked rather than
assumed, it costs nothing, and the honest answer today is "no". Ticket 05 builds
it. A baseline mode that printed its own font verdict would be a stronger claim
than the one it makes now.

### 5. Stakeholders — no code

One sentence, conditional on an organisation this repo is not. There are no
stakeholders to have a conversation with.

What makes it work for one is shareability, and shareability already exists: the
deployed static build and the README GIFs (`mobile-dev-env` ticket 04). The
remaining gap is documentation, not software — one paragraph in the README
saying the blueprint is the artifact a stakeholder conversation would be held
around, and what it is and is not. Ticket 06.

One thing deliberately **not** built: a "show me just this screen, large" mode.
A stakeholder conversation wants one screen at a useful size, and the blueprint's
zoom is a single ctrl+wheel scale shared across all seven frames. It is a real
gap, it is not what the talk said, and it is a ticket of its own rather than a
line in this one.

## The six bugs this must design against

`studio-honesty` shipped ten tickets and found seven defects that the unit tests
could not reach. Six of them failed **silently** — no error, plausible output —
and every one has the same shape:

1. `data-*` is filtered off `View` by RNW 0.21, so node pairing walked zero pairs
   and the panel said "not compared yet", which reads as benign rather than
   broken.
2. Lengths canonicalised in one direction only, so `16` and `16px` never matched
   and attribution was silently defeated for **every** numeric token.
3. `fontWeight: '700'` eaten by the length rule and turned into `'700px'`.
4. `split(/\s+/)` tore the browser's spaced-out `rgba(35, 25, 20, 0.05)` into
   four fragments, so every elevation difference read as unattributed.
5. Escape committed the elevation draft it was meant to discard, because blur
   runs `commit` before `setDraft` lands.
6. `rgba(` not recognised as a colour, because the pattern required `rgb`
   immediately followed by `(` — and every elevation in the file uses `rgba()`.

The seventh, found by hand rather than by test, is the same family: the session
baseline was seeded after `setPath`, so it captured its own first edit and
`POST /revert` left that edit applied.

**The rule they all teach.** A comparison that produces a wrong answer is worse
than a comparison that produces none, and a UI string that describes a broken
state as an ordinary one is the specific mechanism by which a broken tool
acquires false confidence. Three of the six printed a benign-looking message
while being wrong.

So every ticket below carries two obligations: **an honest zero** (the tool must
have a state that means "I did not measure this", and it must be visibly
different from "I measured and found nothing") and **a negative control** (a
planted value that must make the tool report the specific thing, verified in a
real browser, not asserted).

## Tickets

The map cleared into [`spec.md`](spec.md), which collapsed into the seven
implementation tickets under [`issues/`](issues/). Work the frontier: any ticket
whose blockers are all done.

**Decision tickets** — the questions this map asked, now retired to
[`decisions/`](decisions/) with their answers intact. They are the primary
source for the findings above and remain worth reading.

- [Every tap on the board accounts for itself](decisions/01-every-tap-accounts-for-itself.md)
- [One event spine, with provenance](decisions/02-one-event-spine.md)
- [The state tab becomes a change log](decisions/03-state-tab-becomes-a-change-log.md)
- [The blueprint draws its edges](decisions/04-the-blueprint-draws-its-edges.md)
- [Measure the assumption visual regression was hedged behind](decisions/05-measure-the-render-fidelity-assumption.md)
- [Record what we are not building, and pin it](decisions/06-record-what-we-are-not-building.md)

**Implementation tickets** — tracer bullets, blockers first.

| # | Ticket | Blocked by |
|---|---|---|
| 01 | [A change log for the app store](issues/01-change-log-for-the-app-store.md) | — |
| 02 | [The scheme repaint, logged](issues/02-scheme-repaint-logged.md) | 01 |
| 03 | [Routes, as observed](issues/03-routes-as-observed.md) | 01 |
| 04 | [Routes, as declared, and the gap](issues/04-routes-as-declared-and-the-gap.md) | 03 |
| 05 | [Every press accounted for](issues/05-every-press-accounted-for.md) | 01 |
| 06 | [What the browser actually rendered](issues/06-what-the-browser-actually-rendered.md) | — |
| 07 | [What we are not building](issues/07-what-we-are-not-building.md) | 06 |

**Frontier: 01 and 06.** 05 runs parallel to 03 and 04.

**No prefactor ticket.** The tree differ this work reuses already indexes arrays
and is already import-safe, so there is nothing to widen before the first
vertical slice lands.

**Verification is by browser automation.** `bsk` drives the real Chromium and can
evaluate script in the page, which turns the planted negative controls from
manual work into something repeatable. It is a dev-time tool and is deliberately
not wired into `npm test`, which stays on the type-stripping runner with no
framework, no build step and no dependency.

## Not yet specified

- Whether the edge list earns a real diagram. Seven nodes and eleven edges fit a
  small radial, but the frames are laid out in a scrolling, zoomable row, so
  drawing curves *between the frames* would cross everything. Ticket 04 starts
  with the list for that reason and leaves the diagram open.
- Whether the event spine should survive a reload. Zustand state is per-visitor
  and resets; an in-memory ring buffer makes the deployed build honest and
  loses the history on refresh. Whether to say so in the UI or persist nothing
  is undecided.
- Whether `setScheme` belongs in the state tab at all, or whether scheme is
  better read as a studio control than as app state. It is a token-editor
  concern wearing an app-state hat.
- Whether the render-fidelity report belongs in the blueprint header or as its
  own tab. It is one line of text and reads as a badge; it may also deserve to
  be a claim in the README.
- `type.*.weight`, `warning` and `radius.sm` remain unspecified from
  `studio-honesty` and are untouched here.
- Whether light and dark belong side by side on the board. `setScheme` works
  live; `studio-honesty` ruled it out of scope for that pass.

## Out of scope

- The Mixpanel integration. Decided in ticket 06, not deferred.
- Pixel-diff visual regression. Decided in ticket 05, with the font measurement
  as the reason.
- Any edit to `mobile/src/ui` or `mobile/src/app`. Every finding in this map was
  reached by observing around the guard, and the two places where a guard edit
  was the obvious move — the tab bar's `useRouter` calls and the back edge — are
  handled by declaring rather than instrumenting, and by reporting a gap.
- A "single screen, large" view for stakeholder conversations. Real, not asked
  for, and a ticket of its own.
- Merging `feat/drag-on-canvas`.
