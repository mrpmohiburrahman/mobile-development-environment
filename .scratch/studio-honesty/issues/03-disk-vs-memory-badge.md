Type: task
Status: open
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