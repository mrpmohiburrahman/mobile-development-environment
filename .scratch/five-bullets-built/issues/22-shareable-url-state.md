# 22 — Shareable URL state

Type: task
Status: resolved
Labels: resolved
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

## Answer

`mobile/src/ide/urlState.ts` is the pure layer. The payload is versioned JSON (`v`, `p`, `s`, `c`, `o` — and nothing else, so app data, frame positions, camera, scroll, active tab, and baseline state are excluded by construction), deflate-compressed through `CompressionStream`, base64url-encoded into `#s=…`. Decoding takes the receiving build's screen registry and committed `tokens.json` as parameters, enforces a 16KB payload cap and a 64KB decompressed cap (the inflate reader cancels past the limit), and never throws: malformed payload, unsupported version, unknown screen, unknown token path, invalid value, and unrecognized scheme or present flag each degrade to the valid part plus a banner sentence. Overrides validate against the same `tokenRules.json` rules as the editor, and prototype-polluting paths fall out through the own-leaf check.

`mobile/src/ide/useShareLink.ts` is the browser glue. On board-ready it decodes the hash once, applies the valid part (overrides land on the editor store directly — a link reproduces a view, it never writes to the codebase), and normalizes the URL to what applied. Every later change to the four shared fields re-encodes through a 400ms-debounced `history.replaceState`; a fully default view clears the fragment. Copy link encodes at click time, ahead of the pending debounce, so the clipboard carries the latest edits, then reports `Copied` or `Copy failed` as a label swap. A browser without the compression streams gets an explicit banner and no URL tracking. The banner floats over the canvas, stays visible in Present mode, and dismisses.

## Verification

Run on 2026-10-18 in this worktree.

- `npm test`: 454 tests passed. `test/urlState.test.ts` adds 18. They cover round trips, the exact wire key set, malformed/oversized/bomb payloads, unsupported versions, unknown screens, partial overrides, prototype pollution, and missing compression APIs.
- `npx tsc --noEmit` in `mobile/`: passed.
- `npm run lint` in `mobile/`: passed. The first run reported a stale-cache `import/no-unresolved` on `analytics/track.ts` from before `npm install` in this worktree; clearing `mobile/.expo/cache/eslint/` resolved it.
- `npm run export:web`: passed. It verifies 14 pages and 4 assets.
- `npm run test:share`: passed on the static export. Round trip (present flag, screen, dark scheme, token override visible on the presented screen, URL re-encodes to the same state), Copy link freshness inside the debounce window with clipboard assertion, partial payload (unknown screen + unknown token warn, valid parts apply, banner dismisses), malformed payload, and version mismatch. The links are built with Node's zlib, so agreement proves the wire format.
- `npm run test:present` and `npm run test:board`: passed. The board check now strips the hash before its no-navigation URL assertion, because the hash legitimately tracks the camera.
- `npm run test:analytics`: passed. No analytics requests in any shared-link flow.
- `scripts/guard.sh`: passed. No guarded file changed.

## Notes

The debounce interval is a fixed 400ms constant and Copy confirmation is a button-label swap — the two open questions from ticket 06, resolved at implementation.
