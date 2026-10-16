# 16 — Weekday fix and layout hook

Type: task
Status: ready-for-agent
Labels: ready-for-agent
Blocked by: 12 — Guard permission trailers, 15 — Analytics sender
Map: ../map.md
Spec: ../spec.md

## What to build

The two guarded edits land with permission trailers. Habit detail shows the UTC weekday. The root layout calls the analytics hook once, so the native app sends `App Opened` and `Screen Viewed`. The guard passes the range and fails a later branch that edits the same files without its own trailers.

## Acceptance criteria

- [ ] Habit detail formats the weekday with the UTC day. The constant demo dates stay.
- [ ] The root layout calls one analytics hook. The hook sends `App Opened` once per native launch and `Screen Viewed` on the initial route and each visible route change.
- [ ] Screen changes cover tabs, pushes, Back, replacements, and native links. Repeated renders of the same route do not duplicate the event. Remounts do not duplicate `App Opened` within one launch.
- [ ] The screen property uses a normalized pathname.
- [ ] Each guarded edit carries its own `Guard-Allow` trailer with a reason. The guard passes that range.
- [ ] A new branch that edits the same file without a new trailer fails the guard.
- [ ] The browser sends nothing after these edits.
- [ ] `npm test`, the guard range checks, lint, and typechecking pass.
