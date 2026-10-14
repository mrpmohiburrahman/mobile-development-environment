Extend this repo's design-token studio. It works today. I want to extend it so that I can write a
public post about it without overclaiming.

Here is the ground truth so you do not have to rediscover it. Verify it, do not trust it blindly.

- `mobile/src/app/ide.tsx` — the studio route. Tabs between `TokenPanel` and `StatePanel`, plus `Blueprint`.
- `mobile/src/ide/Blueprint.tsx` — renders every screen side by side at 390x820 inside a scaled row, each wrapped in `DesigningProvider`. Ctrl+wheel zoom is attached directly to the DOM node because RNW does not surface wheel events.
- `mobile/src/ide/screens.ts` — enumerates `../app` recursively via `require.context`, excludes `_layout` and `ide`, normalises `(tabs)/x` to `x`, sorts by a hand-maintained `ORDER` array with unlisted screens after.
- `mobile/src/ide/designing.tsx` — `DesigningContext` plus a `useNavigate()` that returns a no-op under the provider, so screens never navigate away from the artboard.
- `mobile/src/ds/store.ts` — zustand store holding an `overrides` map keyed by dotted path, merged over the imported `tokens.json` on read. `useTheme()` resolves colours for the active `scheme`. `setPath` writes `node[last] = value` unconditionally.
- `mobile/src/ds/tokens.json` — `color.light` / `color.dark` / `space` / `radius` / `type` (5 roles) / `elevation`.
- `mobile/src/ds/client.ts` — `pushToken` / `revertTokens` against `EXPO_PUBLIC_TOKEN_SERVER`, defaults to `http://localhost:3001`. Swallows failures; tracks a module-level `reachable` flag.
- `mobile/src/ide/TokenPanel.tsx` — raw DOM `<input type="color">` and `<input type="range">` via `createElement`. Sections: colour (active scheme), spacing, radius, type scale. Writes `type.<role>.size` and derives `lineHeight` as `size * 1.25`. **There is no control for `elevation`.**
- `token-server/index.mjs` — Node stdlib only, no dependencies, no build step, roughly ninety lines. `GET /tokens`, `POST /token {path,value}`, `POST /revert` which shells out to `git checkout --`. `setPath` refuses to create unknown keys and returns 404. Route matching is exact string equality on `req.url`. Writes with a trailing newline so `git diff` stays clean.
- `mobile/app.json` has `web.output: "static"`, so the deployed build has no filesystem and no server.

The properties I care about and do not want broken:

1. The studio is a route, not a side project. No parallel implementation of a screen, no static
   analysis. If a screen renders wrong on the artboard it must render wrong in the app.
2. The token server stays Node-stdlib-only. No dependencies, no build step.
3. Every feature must work in two modes: server running locally, and server absent on the deployed
   static build. The override layer already makes this a single code path instead of a branch. Do not
   introduce a second one. Degraded-but-working beats broken.
4. Screens keep working unchanged in both contexts, and the app code stays byte-identical.
   `git diff origin/main...HEAD -- mobile/src/ui mobile/src/app` must be empty. Anything that requires
   editing a screen or a shared component to make the studio work defeats the point of the whole
   approach. Studio-only files under `mobile/src/ide/`, the server, and `README.md` are the only
   places you may edit.
5. Type stripping on Node 22.13.1 works, so `test/` needs no framework, no build step and no
   dependency. Keep it that way. Run tests with `node --experimental-strip-types --test test/*.test.ts`
   or `npm test`. If `nvm`'s lazy loader misbehaves in a non-interactive shell, call
   `/Users/mrp/.nvm/versions/node/v22.13.1/bin/node` directly.

There is an unmerged branch `feat/drag-on-canvas` with a `HANDOFF.md`. Read it before you start. It
explains how tokens are inferred from computed styles by value-matching, it holds the only tests in
the project, and it records the reasoning for the approach. Do not disturb it.

Build these, in this order. They are ranked; each one is worth more than the ones below it.

### 1. A committed-baseline mode for the blueprint

The central claim of this tool is that the blueprint cannot lie, because it renders the real
components. Right now that claim is asserted rather than demonstrated: the blueprint only ever shows
current tokens, so it can answer "what does the app look like" but not "does the app still match
what is committed". That drift is the whole reason the tool exists, and it is currently unfalsifiable.

Add a mode that renders each screen from the tokens at `HEAD` beside the screen rendered from
current tokens, and flags the ones that differ. `GET /tokens?ref=HEAD` on the server is the obvious
source. Note the existing trap: routes are matched by exact equality on `req.url`, so a naive
`/tokens?ref=HEAD` silently 404s and reads to the client as a server that is not running. Parse the
query string, and if a `ref` cannot be resolved, say so rather than falling back to current tokens.

It has to degrade cleanly when the server is absent — state that the baseline is unavailable, do not
crash the route and do not silently draw a false comparison. Be honest in the UI and in the code
comments about what this is: comparing two renders of the same components against two token sets,
not a pixel diff of two screenshots.

### 2. A "writing to disk" vs "in-memory" badge

`serverIsReachable()` already exists in `mobile/src/ds/client.ts` with zero callers. Surface it in the
studio chrome so a reader can see at a glance whether their edit reached the token file on disk or
only moved the in-memory override layer. Roughly six lines. This is the most important thing in the
tool after the baseline mode, because it makes the difference between the two modes visible instead
of something you have to know about.

### 3. Validate token values by kind

The server checks that a dotted path exists, then writes whatever it was handed. A malformed hex
string in `color.light.accent` renders as garbage and nobody finds out until a screen looks wrong.

Validate against the shape of the leaf: hex for `color.*`, finite number within a sane range for
`space.*` and `radius.*`, numbers for `type.*.size` / `weight` / `lineHeight` / `letterSpacing`, and
a string for `elevation.*`. Reject with a useful message rather than writing a broken file.

Decide explicitly whether validation belongs in the server, the store, or both, and say why in the
code. The reasoning I have: the client needs to feel the drag-constrained values while typing or
dragging, so it validates to give immediate feedback; the server must validate independently because
it has to refuse bad writes from anything that is not this client. Both, with the same rules, is the
answer I expect unless the code argues otherwise.

### 4. Session-scoped revert

`POST /revert` runs `git checkout -- tokens.json`, which throws away uncommitted token work that
predates the current session. If I had a half-finished change from yesterday and pokes one colour
today, revert eats yesterday too.

Snapshot the tokens when the session starts — on first write, or via an explicit session-start call —
and restore that snapshot rather than reaching for `HEAD`. Keep `git checkout` available as a
separate, distinctly-named destructive action, because "back to my session" and "back to committed"
are different intentions and the UI should not blur them. Use the same snapshot mechanism to support
per-token undo, which the editor does not have today and which matters more than a blanket revert.

### 5. An `elevation` editor control

`tokens.json` ships `elevation.sm` and `elevation.md`, they are consumed at four call sites, and
`TokenPanel.tsx` has no control for them. They are string values that are not a simple number or a
colour, so decide what an honest control looks like — a free-text field validated against a real
`box-shadow` shape is acceptable; a slider that pretends elevation is a scalar is not.

### 6. Decouple the studio's own chrome from the app's tokens

All four IDE chrome files (`mobile/src/app/ide.tsx`, `mobile/src/ide/Blueprint.tsx`,
`mobile/src/ide/StatePanel.tsx`, `mobile/src/ide/TokenPanel.tsx`) import `Text` from `../ui`, which
reads `useTheme()`. Dragging `type.caption.size` therefore distorts the editor's own labels. Replace
them with a studio-local label component over raw `RNText` at fixed sizes, and swap it into the
chrome call sites. This touches studio files only, so the byte-identical property holds.

Do not build, and do not touch:

- Light and dark side by side. Out of scope for this pass.
- Per-token undo as its own feature. Fold it into the session snapshot in item 4 if the shape fits;
  do not split it into a separate mechanism.
- Navigation arrows. `useNavigate()` in `ide/designing.tsx` is a chokepoint that would intercept
  every navigation, but there are only four edges across seven screens today, so the demo would look
  thin. Not now.
- `warning` and `radius.sm`, which have no readers. Dead, but separate.
- The `#fff` hardcoded for the accent button label, which is scheme-blind and causes real contrast
  failures. It is in app code and would break property 4. Record it as a known limit instead.
- `setPath` in the server refusing to create keys while the store creates them. It is unreachable
  from the UI today, since paths always originate from the panel. Note it, do not change it.