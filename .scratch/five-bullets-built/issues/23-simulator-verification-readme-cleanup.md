# 23 — Simulator verification, README, cleanup

Type: task
Status: ready-for-agent
Labels: ready-for-agent
Blocked by: 16, 19, 20, 21, 22
Map: ../map.md
Spec: ../spec.md

## What to build

A cold clone can repeat the checks. The iOS Simulator sends a known habit toggle. The event appears in the Mixpanel project. The README states each feature and its limit. Obsolete tests that forbid the new features match the implemented behavior.

## Acceptance criteria

- [ ] A native rebuild shows the bundled font. A Metro launch alone is not the proof.
- [ ] The Simulator sends `Habit Toggled` and the event appears on the Mixpanel Events page. Redacted evidence is retained. A browser or Node request is not substituted.
- [ ] The Simulator checks cover one App Opened per launch. They cover screen changes across tabs, push, and Back. They cover the toggle payload, sign-out, and identity persistence across relaunch.
- [ ] The report names blocked account access or missing tooling as blocked, not as success.
- [ ] The README states the native-only analytics boundary, the screenshot contract against baseline mode, the guard permission rule, and the cold-clone commands.
- [ ] Update tests that forbid analytics or screenshot dependencies. The token server stays Node-stdlib-only. The Node test command stays unchanged.
- [ ] Add real screenshots or GIFs only after the features pass on screen.
- [ ] `npm test`, lint, typechecking, the guard range checks, the browser checks, and the Simulator checks pass.
