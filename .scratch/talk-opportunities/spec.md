# Spec: The studio accounts for what the app does

Labels: `ready-for-agent`

## Problem Statement

The studio can show me every screen at once and change the tokens they read. It
cannot tell me what the app is *doing*.

I click a habit card and the detail frame repaints, which feels alive. I click
the avatar next to it and nothing happens — but the control still dims under my
finger, so it answers the touch and then does nothing. I count **25 of the 48**
controls on the board in that state: the avatar, the stats card, all sixteen tab
taps, four toggles that were never implemented, two back bars. Roughly half the
board is inert and nothing on screen says which half, or why.

The state tab shows me the store. It is live and it is correct and it still does
not answer the question I open it for. The habits array is six objects holding up
to seven date strings each; I toggle one and one element of one array changes,
and the tree before and after look equally plausible. I cannot see what moved
without remembering the previous one. Worse, the tab watches one store and the
studio has two — switching to Dark in Settings repaints **every frame on the
board** and the state tab shows nothing at all.

There are no routes. I know which screens exist because I can see them, and I
have no idea how any of them reach each other.

And I cannot answer the question the original talk's author attached to visual
regression on the web, which was not *should we screenshot* but *do I have
reasonable confidence this render matches what ships*. I have never checked.

## Solution

The board accounts for every tap, and one log accounts for everything.

Every press on the blueprint is recorded and paired against what the app actually
did. A press that produced an event is live; a press that produced nothing is
reported as inert, in words that name the studio rather than calling the control
broken. The same log records state changes and route changes together, each entry
saying whether it was **observed** at the point of action or **declared** from the
router's own directory listing, and route changes carry the state change that
rode along with them.

The state tab becomes a change log — differences, newest first, each row naming
the store it landed in and the frame it was clicked from — with the tree kept
below it for the question the log cannot answer, which is what the state is right
now. The blueprint grows a route list where every edge is labelled with how it was
known, so a reader who sees eleven routes is told that seven were watched and
four were read off a directory.

And the studio measures the assumption instead of resting on it. It probes which
family actually won the display font stack, prints the verdict, and checks the
type tokens against what the screens really render. Today that answer is *no*,
which is worth knowing and costs nothing to know.

## User Stories

**Clicking around the board**

1. As a developer, I want a press on the blueprint to be recorded, so that I know
   the board is listening even when nothing visibly happens.
2. As a developer, I want a press that changed nothing to be reported as inert,
   so that I stop reading it as a broken control.
3. As a developer, I want the report to say the control is inert *in the studio*
   rather than unavailable, so that I do not conclude the app is missing a
   feature it actually has.
4. As a developer, I want a press that changed something to say what changed, so
   that I can tell a live control from a dead one without counting pixels.
5. As a developer, I want the number of inert controls visible on the board
   without clicking around to count them, so that I know the rough health of the
   blueprint at a glance.
6. As a developer, I want a control that is unimplemented everywhere to be
   described no more strongly than one that is inert only in the studio, so that
   the studio never over-claims.
7. As a developer, I want to know which frame I actually pressed, so that a
   change I caused is not attributed to a frame I did not touch.
8. As a developer, I want two presses inside one interaction not to both be
   credited with the single change between them, so that the count of live
   controls is not inflated.
9. As a developer, I want the click report to behave identically whether or not a
   token server is running, so that what I learn on the deployed build is not
   void back at my desk.
10. As a developer, I want presses on the comparison column distinguished from
    presses on the current column, so that I know which half of the board I hit.

**Watching state**

11. As a developer, I want to see what changed rather than what is true, so that
    I can watch the store work instead of re-reading it.
12. As a developer, I want the log newest-first, so that the change I just caused
    is the one I see.
13. As a developer, I want each row to name which habit moved rather than just the
    path, so that I can find it in the tree.
14. As a developer, I want the log to cover both stores, so that switching the
    scheme — which repaints the whole board — is not invisible.
15. As a developer, I want a state change with no route change to appear anyway,
    so that the log does not read as a navigation log.
16. As a developer, I want a route change with no state change to say so
    explicitly, so that an empty field is never mistaken for missing data.
17. As a developer, I want to tell "signed in again while already signed in" from
    "signed in", so that the log does not fill with entries that changed nothing.
18. As a developer, I want the current tree kept below the log, so that the
    question the log cannot answer — what is the state right now — still has an
    answer.
19. As a developer, I want "nothing has happened yet" and "the log is not
    watching" to read differently, so that I never mistake a broken log for a
    quiet app.
20. As a developer, I want the log's row style to match the token drift report's,
    so that I read one thing in one way wherever I meet it.
21. As a developer, I want the log to be capped at a known length and to say when
    it has overflowed, so that a truncated history never reads as a complete one.
22. As a developer, I want the log to survive losing the token server, so that
    relaunching it mid-session does not blank my history for no reason.

**Seeing routes**

23. As a developer, I want to see which routes the app can take, so that I know
    how the screens I see are connected.
24. As a developer, I want a route to carry the state change that came with it,
    so that I see one thing rather than two lists I have to correlate.
25. As a developer, I want every route labelled by how it was learned, so that I
    never mistake a route read off a directory listing for one that was watched.
26. As a developer, I want the count of observed, declared and unresolved routes
    shown together, so that the headline number cannot mislead me.
27. As a developer, I want the back control reported as a gap rather than drawn or
    omitted, so that its absence is not read as "there are no back routes".
28. As a developer, I want a screen with no outgoing routes named, so that I know
    where the app's exits are.
29. As a developer, I want adding a screen with a route to show up without editing
    the studio, so that the route list cannot go stale the way a hand-written
    import list does.
30. As a developer, I want highlighting a frame to show the routes out of it, so
    that I can read one screen's connections without the whole graph.
31. As a developer, I want the tab group's routes marked as read rather than
    watched, so that I understand why tapping a tab does not move the board.
32. As a reviewer, I want a test that fails when a screen stops routing through
    the studio's navigation seam, so that the route list cannot quietly lose an
    edge with nothing reporting it.

**Trusting the render**

33. As a developer, I want the studio to report which typeface it actually
    resolved, so that I stop assuming the one I designed with is the one I am
    looking at.
34. As a developer, I want the report to name every candidate family and its
    fate, so that an absent font is visible rather than silently skipped.
35. As a developer, I want an unanswerable candidate reported as unknown rather
    than as fine, so that the verdict never flatters itself.
36. As a developer, I want the type tokens checked against the rendered screens,
    so that "what is displayed here" is a measurement rather than a hope.
37. As a developer, I want a token change that fails to reach a screen to be
    caught, so that the studio cannot report a clean bill of health on a broken
    render.
38. As a developer, I want the verdict to be the same with and without a token
    server, so that it describes the browser rather than the file.
39. As a developer, I want to see how many screens and how many properties were
    actually verified, so that I know the sample size behind the claim.
40. As a developer, I want the answer to the visual regression question to be
    printed rather than assumed, so that revisiting the decision is a matter of
    re-reading a number.

**Sharing and future work**

41. As a stakeholder, I want to open a link and see every screen at once, so that
    I can hold a conversation about the app's shape rather than one screen.
42. As a stakeholder, I want to know the deployed build's edits are mine alone and
    are not written anywhere, so that I understand what I am looking at.
43. As a stakeholder, I want to be told this is not a design tool and not a record
    of what was agreed, so that I do not read more into it than it claims.
44. As a future contributor, I want to see which of the original talk's ideas were
    built, reshaped or declined, so that I do not re-propose a declined one.
45. As a future contributor, I want the declined analytics idea declined for a
    stated reason rather than by silence, so that I understand the constraint
    behind it.
46. As a future contributor, I want a test that fails if a screenshot dependency
    appears, so that the decision is enforced rather than remembered.
47. As a future contributor, I want the documentation to keep saying the drift
    report is not a pixel diff, so that the claim survives my change.
48. As a CI, I want the app's own screens to remain byte-identical, so that the
    studio keeps earning the trust that everything else here rests on.
49. As a CI, I want the new tests to run with no framework, no build step and no
    dependency, so that the test command stays the one it is today.

## Implementation Decisions

**One spine, two stores, differences not notifications.**

- The spine is a single chronological stream fed by three input kinds: a store
  difference, a route change, and a press. It is one reducer over one state, so
  ordering is total and a press and the change it shares a task with can be shown
  on one line.
- **Both** stores feed it. The state tab currently watches one and the studio
  has two; the scheme lives on the other and drives a whole-board repaint.
- Entries record **differences, never notifications.** A store setter fires even
  when it writes an identical value, so a log of notifications fills with entries
  that changed nothing within a minute. A deep-equal pair of snapshots yields no
  entry.
- **The existing tree-diffing logic is reused, not reimplemented.** It already
  produces the named-difference shape the token drift report prints, and it
  already carries fixed normalisation bugs. A second differ is a second set of
  those bugs. Here "baseline" means *the previous value* rather than `HEAD`; the
  row shape is otherwise identical to the drift report's.
- The buffer is a ring, capped, and the cap is stated in the UI when reached.

**Provenance is mandatory, total, and visible.**

- Every route carries exactly one of three provenances: **observed** (seen at the
  navigation seam), **declared** (read from the router's directory listing),
  **unresolved** (known to exist, cannot be enumerated).
- A **declared** route may not carry an observed state change. Declared routes are
  inferred from a directory and have no observation window, so pairing one with a
  measured difference would be a fabricated join.
- Counts are shown before any list: observed, declared, unresolved. A reader who
  sees a headline number is told how it was arrived at.

**The navigation seam records instead of navigating.**

- The existing seam that all route changes already pass through becomes the
  observation point. It records and returns. Under the designing context it must
  still not navigate — a regression there loses the user their board, silently and
  irrecoverably, which is the worst failure this work could produce.
- Tab routes are **declared** from the router directory's raw group keys, before
  group prefixes are normalised away. The membership is knowable at zero cost;
  the presses are not observable, because the tab bar reaches the router directly
  and that file is guarded.
- The back control resolves against history at press time and cannot be an edge.
  It is reported as a gap **with a count**, because a gap shown as zero reads as
  "there are none".

**Presses are observed at capture phase, and frames are identified by real DOM ids.**

- The press listener attaches to the workspace node in the capture phase, the way
  the zoom listener already attaches a wheel handler to the same node. Capture
  phase runs before the component's own handler, so a press the component
  swallows is still seen.
- Frame identity comes from the platform's own id attribute, **not** a custom data
  attribute. The custom attribute is filtered off the view before it reaches the
  DOM, which once made a pairing walk zero pairs while the panel said the
  comparison had simply not run yet.
- A press with no event is inert. Nothing more is inferred from it.
- **A press is not a cause.** The log reports what changed and where the press
  landed as two facts side by side, and draws no arrow between them, because the
  change usually repaints a *different* frame than the one pressed. This is a
  strong signal, not a proof, and no arrow is drawn when the signal does not
  point.

**Honest zeros, everywhere, as distinct visible states.**

- Every view distinguishes: watching with nothing yet, watching with nothing
  found, and not watching. These never collapse into one another.
- Wording names the studio's own limitation rather than implying the app is
  broken.

**Every browser-gathered fact arrives with a count, and zero is a distinct state.**

- This is mandatory across all three features that read the DOM. A sound decision
  function fed nothing by a broken reader is a known failure here, and the UI
  made it look like an un-run comparison rather than a broken one.
- So a reader reports how much it observed, and **zero never renders as "nothing
  found"**.

**Routes as a list, not a diagram.**

- Seven nodes and eleven edges would fit a small radial, but the frames sit in a
  horizontally scrolling row under one shared zoom, so edges drawn between them
  would cross every other frame and be recomputed on every scroll.
- A list carrying from, to, kind, provenance and the state change moved is more
  useful, costs a panel, and does not lie about geometry it cannot hold still.

**The render verdict is measured, and it names everything.**

- Typeface resolution is probed by width comparison: render a test string in each
  candidate family and in a known-different reference; equal widths mean the
  family fell through to its fallback. Pure DOM, no dependency, no driver.
- The verdict names **every** candidate and its fate. An unanswerable candidate
  reads as unknown. It never reads as fine.
- The type tokens are checked against what the screens actually render, and the
  report states how many screens and how many properties were verified, so the
  sample size is visible.
- **No new dependency, in the app or the server.** If this ever needs a
  rasterisation library it has stopped being this work.

**Three rejections, recorded and pinned.**

- The analytics SDK is not built. Its *shape* — a stream of events from the running
  app — is, and it is what the spine already is. Declined because it is a runtime
  dependency, because it commits a project token and breaks the credential-free
  clone, and because it is orthogonal to a tool whose claim is that design changes
  land in the codebase.
- Pixel-diff visual regression is not built, on a precondition rather than on
  principle. The app has no fixed typeface — the first two families in the display
  stack are installed nowhere on this machine and no font face is declared
  anywhere — so every unique thing a screenshot suite would add is
  font-dependent, and a font-independent visual regression reduces to the style
  comparison that already exists plus a node count.
- Stakeholder tooling gets no code. The link already exists; the gap is a
  paragraph.

**The state tab is output only.**

- It exposes no buttons that drive the store. The blueprint is the input device.
  A panel that can also drive the store is a second way to reach the same state,
  and then every log entry has two indistinguishable causes.

## Testing Decisions

**What makes a good test here.** External behaviour of one import-safe module:
given a sequence of inputs, what does the log say? Not "does it call the right
function", and not "does it render the right class".

**One seam.** Every decision lives in pure modules that load under the type-
stripping test runner; the browser half gathers facts and delegates, holding no
decisions of its own. This is the split the drift detector already uses, where the
comparison is pure and tested and the DOM walk is thin.

**The zero-count rule is the guard for that split's failure mode.** A pure
function cannot tell a reader that found nothing from a reader that was never
pointed at anything, so every reader reports a count and the UI renders zero as a
state distinct from "none found".

**Static source assertions for the mechanisms that rot silently.** Read the real
source, strip comments, assert the mechanism is present or absent. Prior art: the
chrome test already does this to stop a chrome file importing the token-reading
component. Applied to: the press listener being capture-phase; the navigation seam
still not navigating under the designing context; every route call site still
routing through that seam; no new dependency appearing in the app manifest; and
the documentation continuing to deny a pixel diff and an analytics SDK.

**Type-level guarantees are not enforced and must not be relied on.** The compiler
runs clean locally but is not in CI, so any rule of the form "this cannot be
constructed without a provenance" needs a runtime check to actually hold.

**Both modes, every feature.** Server running and server absent. None of this work
touches the token file, so the deployed static build is the same case rather than
a degraded one, and that is worth testing rather than assuming.

**Prior art, by kind.**

| Kind | Prior art |
|---|---|
| Pure tree differences | the drift test, for row shape and normalisation traps |
| Facts separated from decisions | the drift-detector test, for the DOM/pure split |
| Static mechanism assertions | the chrome test, for comment stripping and real-file reads |
| Repository invariants | the guard test and the workflow test |
| Server behaviour | the session test |

**Browser verification with planted negative controls, every time.** Six of the
seven defects this codebase has already shipped were invisible to its unit tests,
and three of those printed a benign-looking message while being wrong. So each
feature ships with a planted value that must make it report that specific thing,
verified by hand in a real browser, not asserted. The negative controls are
listed per feature in the map's tickets.

## Out of Scope

- The analytics SDK integration. Declined, not deferred.
- Screenshot-based visual regression. Waiting on a precondition — a shipped web
  font — that the render verdict is what will detect.
- A "one screen, large" view for stakeholder conversations. Real gap, not asked
  for, and a ticket of its own rather than a line in this work.
- Any edit to the app's own screens or shared components. Every finding was
  reached by observing around that boundary; the two places where crossing it was
  the obvious move are handled by declaring rather than instrumenting, and by
  reporting a gap.
- Light and dark side by side on the board.
- Time travel, history beyond the ring buffer, or any devtools integration.
- Persisting the log across a reload.
- Whether the colour scheme is app state or a studio control. It is currently both,
  which is a modelling question this work surfaces rather than settles.
- Merging the drag-on-canvas branch.

## Further Notes

**The typeface finding, measured, because the whole rejection rests on it.** The
display stack declares two named families ahead of the system fallbacks. On this
machine neither is installed — an apparent hundred-plus matches for one of them
were font *filenames* containing a substring, not the family — no font face is
declared anywhere in the app, the font package is installed and imported by
nothing, and the type tokens carry no font family at all. So the stack resolves to
the system face here, to a different face on a machine that has the named family,
and to a third on Linux. Three machines, three rasters, one committed tree.

This is worse than a font-loading race, which a readiness check solves. It is font
*availability*: a per-machine property, already settled, that waiting cannot move.

**That is why the answer is a measurement rather than a screenshot suite.** The
original talk's author attached his visual regression idea to a confidence
condition. The condition is checkable. Checking it is cheaper than either building
the suite or refusing it on taste, and it converts the decision from a judgement
into a number that can change.

**Route arithmetic, for whoever implements it.** Seven route changes through the
seam, four tab destinations declared from the directory, and a back control that
cannot be enumerated. Four of the seven already mutate state in the same
synchronous task as the route change, so they draw as one line rather than two.

**Control arithmetic, likewise.** Forty-eight controls on the board at the default
store state; twenty-three live, twenty-five inert.

**This repository's precedent is that maps carry execution.** Both prior maps in
this repo overrode wayfinding's planning-only stance and went straight from
tickets to code. This spec is written so that either route works: the tickets
under `issues/` already carry scope, negative controls and test lists.
