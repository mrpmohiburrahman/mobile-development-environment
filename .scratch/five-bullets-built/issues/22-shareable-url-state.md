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

`mobile/src/ide/urlState.ts` is the pure layer. It does not use `window`.

- The payload is JSON with the keys `v`, `p`, `s`, `c`, and `o`. It has no other keys.
- The link does not carry app data, frame positions, camera, scroll, active tab, or baseline state.
- `CompressionStream` compresses the JSON with deflate. The result goes into `#s=` as base64url.
- The decoder receives the screen registry and the committed `tokens.json` of the receiving build.
- The decoder refuses a payload longer than 16 KB. It stops inflation at 64 KB.
- The decoder does not throw. Each invalid part adds one banner sentence. The valid parts apply.
- Overrides must pass the `tokenRules.json` rules. Each override path must name a leaf in the committed tokens.
- The banner counts the rejected overrides, for example "2 of 3".

`mobile/src/ide/useShareLink.ts` connects the layer to the browser.

- The hook decodes the hash one time, after the board is ready.
- `applySharedOverrides` puts the overrides into the editor store. The token server gets no write.
- The hook then writes the applied state back into the URL.
- A change to a shared field writes the URL again after 400 ms, through `history.replaceState`.
- A default view removes the fragment.
- Copy link encodes the view when the user clicks. It does not wait for the 400 ms timer.
- The button shows `Copied` or `Copy failed`.
- A browser without compression streams gets a banner. The URL does not change, and the board disables Copy link.

The board clears the screen key when the camera leaves the screen. Fit, Reset layout, the `0` key, pan, and zoom clear it. Present entry then uses the nearest frame.

The banner shows over the canvas. It also shows in Present mode. The user can dismiss it.

## Verification

Run on 2026-10-18 in this worktree.

- `npm test`: 456 tests passed. `test/urlState.test.ts` has 20 tests.
- `npx tsc --noEmit` in `mobile/`: passed.
- `npm run lint` in `mobile/`: passed.
- `npm run export:web`: passed. It verifies 14 pages and 4 assets.
- `npm run test:share`: passed on the static export. The script makes its links with Node zlib. The test cases follow.
  - A full link applies in a fresh context. The URL encodes the same state again.
  - Copy link runs at once after a token edit. The clipboard holds the edit.
  - A copied link opens in a fresh context and shows the same state.
  - Fit removes the screen key from the URL.
  - A partial link shows a banner. The camera goes to the first screen.
  - Malformed text and malformed compression show a banner.
  - A wrong version shows a banner.
  - A browser without compression streams shows a banner. The board disables Copy link.
- `npm run test:present` and `npm run test:board`: passed.
- `npm run test:analytics`: not run in the review fix. It runs two more builds, and the owner did not approve that memory use. This change does not touch analytics code.
- `scripts/guard.sh`: passed. No guarded file changed.

## Notes

The debounce interval is a fixed 400 ms constant. Copy link shows its result on the button. These answers close the two open questions from ticket 06.

The banner text follows ASD-STE100. It does not use the ticket 06 sentences word for word.
