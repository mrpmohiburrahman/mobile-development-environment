Type: task
Status: resolved

## Question

Create `test/` and the `npm test` script on this branch, which currently has neither.

`test/` and `npm test` exist only on the unmerged `feat/drag-on-canvas`, not on `design/polish`. Property 5 of the brief describes them as the project's tests and instructs that they keep running with no framework, no build step, and no dependency — that is a constraint to honour, not a thing to inherit.

Scope:

- `package.json` gains `"test": "node --experimental-strip-types --test test/*.test.ts"`. The glob matters: plain `node --test test/` resolves `test` as a module and fails.
- First tests cover the pieces later tickets depend on: `applyOverrides` / `setPath` in `mobile/src/ds/store.ts` (pure, already exported), and the server's `setPath` refusing unknown keys.
- `applyOverrides` currently imports `./client` transitively via `store.ts`, which touches `process.env` and `fetch`. Confirm whether that blocks a plain `node --test` import, and if it does, extract the pure functions rather than mocking.

Do not port `dragMath.test.ts` — that branch stays untouched. Node is v22.13.1; call `/Users/mrp/.nvm/versions/node/v22.13.1/bin/node` directly if the lazy loader misbehaves.

## Answer

`npm test` works: 12 tests, 0 failures, no framework, no build step, no dependency. `package.json` gained the `test` script with the glob.

**The blocking finding: `store.ts` cannot be imported under plain `node --test` at all.** It fails with `ERR_MODULE_NOT_FOUND` on the extensionless `./client` specifier — Node's ESM resolver requires explicit extensions, Metro does not. So the ticket's contingency applied: extract the pure functions rather than mock. Type stripping was never the problem; module resolution was.

Three extractions, each the minimal seam:

- `mobile/src/ds/applyOverrides.ts` — new. Holds `setPath` and `applyOverrides` verbatim, with no runtime imports at all. `store.ts` imports from it and re-exports both, so every existing call site is unchanged and `applyOverrides` keeps its public name.
- `token-server/tokens.mjs` — new. Holds the server's `setPath`, because importing `index.mjs` runs `server.listen()` at module scope. `index.mjs` imports it instead.
- The client's `applyOverrides` is now generic (`<T extends Record<string, any>>`) rather than typed to `Tokens`, so the extracted module needs no import of `tokens.json`.

Tests run against the real `tokens.json` via `import ... with { type: 'json' }`, not a fixture — so a token renamed upstream fails here on purpose. Coverage: identity short-circuit when there are no overrides (it protects `useTokens`' memo), non-mutation of the imported base, scheme independence, nested-leaf writes leaving sibling fields alone, several overrides in one pass, and both `setPath` implementations agreeing on every real token path while differing only on non-existent ones. That last one pins the documented asymmetry as intentional rather than accidental.

Verified beyond the tests: server still starts and serves `GET /tokens`; an unknown path still returns 404; `tsc --noEmit` clean; byte-identical guard holds (`git diff origin/main...HEAD -- mobile/src/ui mobile/src/app ':(exclude)mobile/src/app/ide.tsx'` is empty).

`dragMath.test.ts` not ported. For later tickets: import server logic from `token-server/tokens.mjs`, client logic from `mobile/src/ds/applyOverrides.ts` or a new sibling, and never from `store.ts` or `index.mjs`.