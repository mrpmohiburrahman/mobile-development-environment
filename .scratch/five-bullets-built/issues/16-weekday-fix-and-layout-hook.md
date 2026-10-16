# 16 — Weekday fix and layout hook

Type: task
Status: resolved
Labels: ready-for-agent
Blocked by: 12 — Guard permission trailers, 15 — Analytics sender
Map: ../map.md
Spec: ../spec.md

## What to build

The two guarded edits land with permission trailers. Habit detail shows the UTC weekday. The root layout calls the analytics hook once, so the native app sends `App Opened` and `Screen Viewed`. The guard passes the range and fails a later branch that edits the same files without its own trailers.

## Acceptance criteria

- [x] Habit detail formats the weekday with the UTC day. The constant demo dates stay.
- [x] The root layout calls one analytics hook. The hook sends `App Opened` once per native launch and `Screen Viewed` on the initial route and each visible route change.
- [x] Screen changes cover tabs, pushes, Back, replacements, and native links. Repeated renders of the same route do not duplicate the event. Remounts do not duplicate `App Opened` within one launch.
- [x] The screen property uses a normalized pathname.
- [x] Each guarded edit carries its own `Guard-Allow` trailer with a reason. The guard passes that range.
- [x] A new branch that edits the same file without a new trailer fails the guard.
- [x] The browser sends nothing after these edits.
- [x] `npm test`, the guard range checks, lint, and typechecking pass.

## Answer

`mobile/src/store/habitDates.ts` gains `weekdayLong(iso)`, which reads the UTC day. `mobile/src/app/habit.tsx` calls it in place of `getDay()`. The test runs the helper in five timezones and expects one answer. A static test fails when a screen or store file reads a demo date in local time.

`mobile/src/analytics/routes.ts` is the pure route observer. `createRouteObserver` sends `App Opened` once per observer and `Screen Viewed` when the normalized pathname changes. A repeated pathname sends nothing. A studio route sends no screen event and does not count as the last screen. The observer reports studio presence, and the sender refuses every event with reason `studio-route` while the device shows the studio.

`mobile/src/analytics/useAnalytics.ts` reads `usePathname()` from expo-router and feeds one module-level observer from an effect keyed on the pathname. `mobile/src/app/_layout.tsx` imports the hook and calls it once. The router updates the pathname on tab changes, pushes, Back, replacements, and native links, so one hook covers all of them. The pathname excludes the query and hash.

Each guarded edit is its own commit with a `Guard-Allow` trailer. `scripts/guard.sh "origin/main...HEAD"` lists both files with their reasons. A throwaway branch that edited `habit.tsx` without a trailer failed the guard. Trailers apply to three-dot ranges only, which is the form both workflows use.

Known caveat for ticket 23: on Android, a launch from a deep link can report `/` before the real route. That first `Screen Viewed` is spurious. Check this on a device before you treat the `screen` property as exact on Android.

`npm test` passes 416 tests. Lint, typechecking, and both guard ranges pass.
