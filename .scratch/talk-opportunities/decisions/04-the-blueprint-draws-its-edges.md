Type: prototype
Status: open
Blocked by: 02

## Question

Show the routes the app can take, and mark which ones the studio watched and
which ones it read off the router.

## Why the prior map's verdict does not hold

`studio-honesty` ruled this out: *"`useNavigate()` in `ide/designing.tsx` is the
chokepoint, but four edges across seven screens makes for a thin demo."*

Both halves of that are now false.

**The count is eleven, not four.** And the seven push edges are not thin — four
of them already carry a state change that fires before the navigation, so each
one draws as *route plus the state it moved*. The talk listed state and
navigation as two separate bullets. They are one feature here, because the app
already does the join.

**And it is no longer standalone.** Before `studio-honesty`, an edge list had
nowhere to connect to. It now connects to a live state change, to baseline mode's
per-screen drift, and to ticket 01's dead-tap count. "Four edges across seven
screens" was a fair description of a graph with nothing on it.

## The eleven

**Seven observed**, all through `ide/designing.tsx::useNavigate`:

| From | To | State moved first |
|---|---|---|
| `login` | `/` | `signIn()` |
| `index` | `/profile` | — |
| `index` | `/stats` | — |
| `index` | `/habit` | `select(h.id)` |
| `habits` | `/habit` | `select(h.id)` |
| `profile` | `/settings` | — |
| `profile` | `/login` | `signOut()` |

**Four declared.** The tab group. `ui/index.tsx:207` calls
`router.navigate(tab.key)` through `useRouter()`, not through `useNavigate()`,
behind `if (designing) return;`. That file is guarded, so the edges are not
observable. But membership is knowable: `screens.ts` still holds the raw
`./\(tabs\)/stats.tsx` key before `normalize` strips the prefix, so the four tab
destinations are readable from the router directory at zero cost.

**Unresolved.** `router.back()` at `ui/index.tsx:247`, behind a `BackBar` on
`habit.tsx` (both branches) and `settings.tsx` — two frames, three call sites.
History-dependent, so drawn as none of them, and reported as a gap with a count.

## Declared is not observed, and the graph must say which

This is the whole design constraint. The repo's claim is that the blueprint
cannot lie because it renders the real components. A graph that mixes two
provenance classes into one confident diagram reintroduces the lie in a new
place.

So each edge carries its source, and the panel leads with the count:

```
routes: 7 observed · 4 declared (tab group) · 3 back, unresolved
```

A reader who sees "11 routes" with no breakdown will believe the studio watched
all eleven. It watched seven.

The distinction is not a caveat bolted on. It is the difference between "I
measured this" and "I read it off a directory listing", and ticket 10's six
silent bugs were all the first pretending to be the second.

## Why a list and not a diagram

Seven nodes and eleven edges would fit a small radial. The problem is where the
nodes are: laid out in a horizontally scrolling row under a shared ctrl+wheel
zoom, at a default scale of 0.5. Curves drawn *between the frames* would cross
every other frame, and would have to be recomputed on every scroll and zoom
event.

A **list of edges** with from, to, kind, provenance and the state change it
moved is more useful, costs a panel, and does not lie about geometry it cannot
hold still. The small abstract graph is open in the map — it would show the
*shape* of the app without pretending to sit on top of it.

## Scope

- **No app-code edit.** `useNavigate` is studio ground. The tab group is read from
  the router directory. The back edge is reported as a gap.
- Live on the board: tapping a frame's name or number highlights the edges out
  of it, and vice versa.
- Combine with ticket 01: an edge to a frame that is not on the board, or a
  frame with no outgoing edges, is worth naming — `stats` has no `navigate` call
  at all and reaches the rest only by tab.
- Combine with ticket 03: one row per edge taken, with the state it moved.

## Verification

- Every one of the seven pushes appears, with the right state annotation. Four
  carry one; three carry "no state change" rather than an empty field.
- The four tab destinations appear as `declared`, and tapping any of them on the
  board logs a dead tap — ticket 01 — rather than a route change. **The two must
  agree**: if the graph says tab switching is a route and the tap report says it
  did nothing, one of them is wrong and the disagreement is the finding.
- `stats` shows as having no outgoing edges.
- Back is reported as three unresolved instances, not as zero.

## Tests

- The provenance enum is total and a `declared` edge cannot carry an observed
  state change — declared edges are inferred from a directory listing and have
  no observation window, so pairing them with a state diff would be a fabricated
  join.
- Parsing the tab group from raw router keys: the four `(tabs)/` members, with
  `_layout.tsx` and `ide.tsx` excluded — the same exclusion `screens.ts` already
  applies, tested against the same rule so the two cannot disagree.
- A test asserting the seven `navigate(...)` call sites still route through
  `ide/designing.tsx`. This is the one that rots: someone adds a screen and
  imports `useRouter` directly, and the graph quietly loses an edge with no error
  anywhere. Static, like `test/chrome.test.ts`.
