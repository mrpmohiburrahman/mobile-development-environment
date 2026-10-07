Type: task
Status: resolved
Blocked by: 01

## Question

Surface `serverIsReachable()` in the studio chrome, so a reader can see at a glance whether their edit reached `tokens.json` on disk or only moved the in-memory override layer.

`serverIsReachable()` in `mobile/src/ds/client.ts` has zero callers. It returns `boolean | null` — `null` means "not tried yet". That tri-state is the whole point: on a fresh load of the deployed static build the honest answer is "unknown", not "writing to disk".

Scope:

- Reactive, not polled-on-render. `reachable` is a module-level `let` with no subscription, so reading it in a component never re-renders when it changes. Either add a subscription in `ds/client.ts`, or push the flag into the existing zustand store from `pushToken`/`revertTokens`. `ds/` is editable per the map's Notes.
- Three states, not two: writing to disk / in-memory only / not yet determined. Do not let `null` render as a failure.
- Place it in the chrome that survives the rest of this map — blueprint header or the `ide.tsx` tab bar. Ticket 04 rewrites chrome label components; coordinate so the badge is not built twice.
- Every feature must work with the server absent. The badge's degraded state is the common case on the deployed build, not an edge case.
- Test the tri-state mapping from ticket 01's harness.

The point of this item: it makes the difference between the two modes visible, instead of something you have to know about.

## Answer

The badge is in the blueprint header and reads **`not checked yet`** / **`writes to disk`** / **`in-memory only`**. `npm test` is 49; guard and `tsc --noEmit` clean; the static web build prerenders all 14 routes and ships the unknown state.

**Reactivity, and why it is a subscription and not the store.** `client.ts` gained `subscribeServerStatus` plus a `recordReachable` writer that both `pushToken` and `revertTokens` go through. The ticket offered the zustand store as the alternative and that option is worse here for two reasons: `store.ts` is the module ticket 01 proved unimportable under `node --test`, so putting the flag there would have made the required test impossible; and the store would hold a *second* copy of `reachable`, which is precisely the drift this map exists to remove. `reachable` stays a module-level primitive, and `DiskBadge` binds it with `useSyncExternalStore`. It has to stay primitive: that hook re-reads the snapshot every render and requires `Object.is` stability, so there is nothing to memoise and no way to spin.

**The tri-state mapping is its own import-safe module**, `ds/reachability.ts`, with no runtime imports — the same seam as `applyOverrides.ts`. `ide/chrome.ts` holds `TONE`, the three semantic colours, so `ds/` decides meaning and the chrome owns hex.

**Placement, and the note for ticket 04.** Blueprint header, at the right of the existing row: it is the one piece of chrome the rest of this map keeps, and it sits next to the claim it qualifies. The badge uses raw `RNText` at fixed sizes, not `Text` from `../ui` — otherwise dragging `type.caption.size` would resize the one component reporting on the tokens, which is ticket 04's bug pointed at the wrong target. **For 04: `CHROME` has moved out of `Blueprint.tsx` into `ide/chrome.ts`** so the badge and the chrome cannot drift into two sets of the same hex, and the studio-local `Label` belongs there too. The badge needs no Label swap — it is already raw fixed-size text, so do not build a second one.

**No probe on mount.** The flag is only written by a real write attempt, so `not checked yet` means "nothing has been tried", not "a probe came back empty". This is why a running server does not earn the badge `writes to disk`: verified in the browser with the server up, a fresh load still read `not checked yet`. An eager probe would also have turned the deployed build's honest `unknown` into a confident `in-memory only` on first paint.

`getServerSnapshot` is passed, not optional. `output: "static"` means this route is prerendered, where there is no subscription and `null` is the only honest answer — omitting it throws during prerender rather than degrading.

**Verification beyond the tests.** Drove the real studio in Chromium against both a live token server and a refused port. Fresh load with the server running → `not checked yet`, dot `#6E655D`. Dragged a slider → `writes to disk`, dot `#5FBF7F`, and `tokens.json` genuinely contained the dragged value, so the claim was checked against the file rather than against the request's return value. Killed the server mid-session, dragged again → `in-memory only`, dot `#E0A33E`, reactive without a reload. Each transition happened live, which is the part the unit tests cannot show. `tokens.json` was restored afterwards; the tree holds only the intended changes.

**Tests: 16 new, and they were checked by mutation.** `test/reachability.test.ts` pins the mapping — chiefly that `null` and `false` differ in target, label, detail *and* tone, and that all three states are distinguishable by text alone. `test/clientStatus.test.ts` drives real sockets against a `node:http` stub and port 1, asserting the subscriber actually fires on both push and revert. Each scenario points `EXPO_PUBLIC_TOKEN_SERVER` before a cache-busted dynamic import: the flag is module state, and defaulting to the real `localhost:3001` would have let a "successful" push rewrite `tokens.json` during `npm test`. Deleting the notify loop and collapsing `null` into `memory` fails 8 of the 16 between them.

`degraded` is amber, not red. With no server the deployed build is the expected case, and a red badge would report an error where the truth is "this build cannot write".