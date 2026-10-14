Type: prototype
Status: open
Blocked by: —

## Question

Build one chronological stream of everything that happens in the running app —
state changes and navigation, together — with each entry saying how it was
known.

Tickets 01, 03 and 04 all consume this. Build it once.

## Why

Two observations that looked like separate features are the same feature.

The seven push edges are `onPress={() => { select(h.id); navigate('/habit'); }}`.
The state changes *immediately before* the navigation, in the same synchronous
task. So a navigation edge and the state change that rode along with it are one
event, not two, and the studio can show them as one line: *Today → Habit detail,
and `selectedId` went null → `"h3"`*.

That is not available in the talk. He showed a Redux tree and a blueprint; there
was no join between them, because his screens navigated away and his state
panel was in another tab. Here the join is free.

It is also, not coincidentally, the shape item 3 named. "Plug in your analytics"
is a bullet about *an event stream*. This is that, without the SDK, the account,
the token and the phone-home.

## Scope

**The store side.** Subscribe to both stores — `useHabits` and the token editor
store — and on every notification take a snapshot and **diff it against the
previous one**.

Diffing is not an optimisation, it is the correctness requirement. Zustand
`set` notifies even when it writes an identical value, so `login.tsx`'s sign-in
button while already signed in fires `signIn()` and changes nothing. A log of
notifications fills with no-ops within a minute. `ds/drift.ts` already knows how
to diff two trees into named differences and already returns the same
`{ path, current, baseline, kind }` shape the baseline tab prints. **Reuse it
rather than writing a second differ** — one differ means one set of
normalisation bugs, which is how ticket 10 got two at once.

**The navigation side.** `useNavigate` in `ide/designing.tsx` is the chokepoint
for all seven push edges and it is studio ground. It records `(from, to)` and
never navigates, exactly as it already never navigates under
`DesigningProvider`. The *from* is the frame the click landed in, which ticket 01
resolves from the DOM.

**Provenance is the point.** Every entry carries where it came from:

| Provenance | Meaning |
|---|---|
| `observed` | Seen at `useNavigate`, or a real store diff |
| `declared` | Read from the router directory — the `(tabs)/` group |
| `unresolved` | Known to exist, cannot be enumerated — `router.back()` |

Three call sites render a `BackBar` — `habit.tsx` in both its branches, and
`settings.tsx` — and `ui/index.tsx:247` calls `router.back()`, which resolves
against history at press time. That is not an edge and must not be drawn as one.
It is reported as an unresolved gap with a count.

## What it must not claim

**A frame click is not the cause of a state change.** `select(h.id)` runs in the
`index` frame but repaints the `habit` frame. The spine reports *what changed*
and *where you clicked*, as two facts side by side. It does not draw an arrow
from one to the other, because that arrow would be an inference and this repo's
whole argument is that it renders the real thing rather than modelling it.

The same standard the token attribution already holds itself to: a strong signal,
not a proof, and no arrow when the signal does not point.

## Scope boundaries

- **In memory, in a ring buffer, capped.** Say the cap in the UI when it is hit.
  Zustand state is per-visitor and resets on reload; a log that silently truncated
  would be the `data-*` bug again.
- **No server, no dependency, no persistence.** This works identically on the
  deployed static build, which is the common case.
- Not a devtools integration. The talk used Redux DevTools; Zustand state is a
  plain object and a subscription is enough, which `mobile-dev-env` ticket 09
  already recorded.

## Verification

- Tap a habit card in `index`: one event, `selectedId` `null` → `"h3"`, edge
  `index → habit`, both on one line. Not two lines.
- Tap the `index` avatar: one event, an edge, and **no state change**. The line
  says so rather than omitting the field.
- Toggle a check in `index`: one event, **no edge**. A state change with no
  navigation is a real event and must appear — otherwise the log looks like a
  navigation log.
- Switch to Dark in `settings`: one event on the **token** store. This is the
  case that proves two stores are being watched; a single-store spine misses it
  entirely, which is the current bug.
- Sign in while already signed in: **no event**. This is the negative control for
  the diffing requirement.

## Tests

- `diffStores(before, after)` over `ds/drift.ts`, with a case where the snapshots
  are deep-equal and the result is empty despite two notifications.
- The provenance enum is total: a navigation entry cannot be constructed without
  one of the three, and `unresolved` cannot carry a destination.
- Static: `useNavigate` in `ide/designing.tsx` still returns without calling
  `router.push` when designing. A guard-shaped regression — the spine wired up
  so eagerly that the blueprint navigates — is exactly the kind that fails
  silently, in the one direction that loses the user their board.
