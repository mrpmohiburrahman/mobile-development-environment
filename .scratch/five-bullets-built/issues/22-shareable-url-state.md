# 22 — Shareable URL state

Type: task
Status: ready-for-agent
Labels: ready-for-agent
Blocked by: 18 — Present mode
Map: ../map.md
Spec: ../spec.md

## What to build

A link reproduces a studio view on the deployed static build with no server. The hash carries the present flag, the screen key, the scheme, and the token overrides. Invalid parts of a link produce a visible warning. The route never crashes.

## Acceptance criteria

- [ ] The payload lives in the hash as a versioned, deflate-compressed, base64url value. It holds the present flag, screen key, scheme, and token overrides as differences from committed tokens.
- [ ] The URL updates live through debounced history replacement. Copy link copies the latest edits, not a stale value, and reports success or failure.
- [ ] A fresh context applies a valid link. Token overrides apply to the receiving build's committed tokens.
- [ ] A malformed payload, an unknown token path, an unsupported version, and an unknown screen key each produce a dismissible banner. Valid parts still apply. An unknown screen shows the first screen.
- [ ] Oversized or invalid payloads are rejected safely. An unsupported browser shows an explicit warning.
- [ ] The link does not carry app data, frame positions, camera scale, scroll, active tab, or baseline-comparison state.
- [ ] Browser checks cover a round trip, a partial payload, and a malformed payload on the static export.
- [ ] `npm test`, lint, and typechecking pass.
