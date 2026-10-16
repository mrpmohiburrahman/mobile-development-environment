# 09 — What the guard now guards

Type: grilling
Status: resolved
Blocked by: 07, 08
Map: ../map.md

## Question

`scripts/guard.sh` and `studio-guard.yml` enforce byte-identical
`mobile/src/ui` and `mobile/src/app` (except `ide.tsx`). The owner has
allowed app-code edits for this effort. Tickets 07 and 08 name the files
they must touch. Decide:

- The exact list of guarded-path edits this effort makes, each with its
  reason (font loading in `_layout.tsx`? screen-view instrumentation? a
  `testID` per screen for Playwright?).
- The new guard statement: is the guard narrowed to a list of files, moved
  to "guarded except these named hooks", or replaced by a rule such as "app
  code may import from `ds/` and `ide/designing` only"? The README's claim
  about the app being untouched must be rewritten to match.
- Whether each app-code change could instead be made from studio ground
  (`ds/`, `ide/`) with a documented trade-off, so the guard list stays as
  short as it honestly can.
- How `guard.sh`'s exit codes and messages change, and the test in
  `test/` that covers the new rule.

Resolve with the file list and the new guard wording.

## Answer

The owner asked the agent to choose. Decision: [ADR 0004](../../../docs/adr/0004-guard-permission-per-commit.md).

### Guarded edits this effort makes

| File | Edit | Reason | How it passes |
|---|---|---|---|
| `mobile/src/app/_layout.tsx` | One import and one call to `useAnalytics()` | `App Opened` and `Screen Viewed` (ticket 07) | Guard permission |
| `mobile/src/app/habit.tsx` | Weekday from `getUTCDay()` | The label shows the wrong day west of UTC (ticket 08) | Guard permission |
| `mobile/src/ui/index.tsx` | `fontFamily` on the shared text path, including TabBar, BackBar, Button, and Chip | The app must render Spline Sans (tickets 03, 08) | Existing permanent exception |

No other guarded file changes. These edits need no guard permission:

- `mobile/src/store/habits.ts` (outside the guarded tree)
- `mobile/src/analytics/` (new, outside the guarded tree)
- `mobile/src/ds/`, `mobile/src/ide/`, `mobile/src/global.css`, `mobile/public/fonts/`

### Why `_layout.tsx` and not studio ground

The root layout is the one component that sees every route change on the device. That includes tab switches and the back control, which call the router directly. `useNavigate` sees pushes only. The shared `Screen` component cannot see a tab switch, because tab screens stay mounted. All logic lives in `mobile/src/analytics/useAnalytics.ts`. The layout edit is one import and one call.

`useAnalytics` reads `usePathname()` from `expo-router`. It sends `App Opened` once and `Screen Viewed` on each path change. The sender refuses on web (ticket 07), so the studio route sends nothing.

### Guard permission

A commit grants a guard permission with a trailer line:

```text
Guard-Allow: mobile/src/app/habit.tsx -- fix the weekday label
```

Rules:

1. The guard reads `Guard-Allow` trailers from every commit in the range.
2. A guarded file passes only when a trailer names its exact path.
3. A trailer must have a reason after ` -- `. A trailer without a reason fails the guard.
4. A trailer for one file does not permit another file.
5. The permission covers only the range that contains the commit. A later branch that edits the same file needs its own trailer.

### Permanent exceptions

- `mobile/src/app/ide.tsx` — the studio's own route.
- `mobile/src/ui/index.tsx` — the designing navigation seam for TabBar and BackBar, and the shared font family.

### Exit codes and messages

Exit codes stay the same. Exit 0 means no unpermitted guarded change. Exit 1 means an unpermitted change, a trailer without a reason, or a bad range.

- `guard: OK — <range> changed nothing guarded.`
- `guard: OK — <range> changed only permitted files:` then one line per file with its reason.
- `guard: BROKEN — <range> changed files the studio must not touch:` then the file list, then how to add a trailer.
- `guard: BROKEN — Guard-Allow for <path> has no reason.`

### Tests

Add these cases to `test/guard.test.ts`, with real throwaway repos as today:

1. A trailer permits the named file.
2. A trailer for one file does not permit a second file.
3. A trailer without a reason fails.
4. After the permitted branch merges, a new branch that edits the same file fails without a new trailer.
5. The OK output lists each permitted file with its reason.

### Wording changes

- `scripts/guard.sh` header and the BROKEN message describe guard permission.
- `.github/workflows/studio-guard.yml` comment says the guard allows named, explained edits.
- README, section "The studio is a route". Use this text: "A guard in CI fails any change to the app's screens and shared components. A commit can permit one file if it names the file and gives a reason. The studio's own route and the shared-components seam are permanent exceptions."
- README limitation line about the four tab routes stays true. Ticket 07 does not change how the route panel reads them.
