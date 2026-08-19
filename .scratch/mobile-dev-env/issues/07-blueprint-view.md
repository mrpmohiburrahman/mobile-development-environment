Type: task
Status: resolved
Blocked by: 02, 06

## Question

Build the artboard: screens enumerated from the router, each wrapped in a phone-aspect container with a label, ctrl+wheel zoom on the workspace.

## Answer

`src/ide/Blueprint.tsx`. Screens enumerated via `require.context('../app', false, /\.tsx$/)` with `_layout` and `ide` excluded, ordered by an explicit reading order with alphabetical fallback for anything unlisted.

This is the concrete payoff of ticket 02: adding a route file puts it on the artboard automatically, where the hand-written import list in the talk goes stale the first time someone forgets — which is the drift the blueprint exists to catch.

Each screen sits in a 390x844 frame. Ctrl+wheel zooms 0.25-2.0 via a raw DOM `wheel` listener, since React Native Web doesn't surface wheel events.
