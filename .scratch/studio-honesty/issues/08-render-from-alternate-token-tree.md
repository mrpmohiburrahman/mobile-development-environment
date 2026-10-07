Type: grilling
Status: resolved

## Question

How does the studio render a screen from a token tree that is not the module-level import?

Baseline mode (ticket 09) needs each screen rendered twice: once from current tokens, once from the tokens at `HEAD`. Both renders use the same components — that is what makes the comparison mean anything. So the token source must become a parameter of rendering rather than a module-level constant.

Today `useTheme()` reads `useTokens()`, which reads `useTokenStore((s) => s.overrides)` and merges over a statically imported `base` from `tokens.json`. Every screen calls `useTheme()` through `mobile/src/ui/index.tsx`, which is byte-identical and must stay so.

Decisions needed:

- **How does a second token tree enter the render?** A context that shadows `useTokens()`, a second store instance selected by a provider, or something else. It has to work without `mobile/src/ui` changing, since `useTheme()` is called from inside it.
- **Does the baseline render apply the override layer at all?** If current tokens = `base + overrides` and baseline = `HEAD`, is the comparison `base+overrides` vs `HEAD`, or `base` vs `HEAD`? The first answers "does the app match what is committed"; the second answers "does the committed file match what it was". These are different questions and only one is the drift the tool exists to catch.
- **What happens when a token path exists in one tree and not the other** — a token added since `HEAD`, or removed? `applyOverrides` currently writes `node[last] = value` unconditionally, so it will happily create a path. A render comparison needs a defined answer, not a crash.
- **Does the baseline render share the `scheme` switch?** Both columns presumably render the same scheme so the comparison is not confounded.

`ds/` is editable, so this is reachable without touching app code. But it is the load-bearing decision for ticket 09, and getting the override-layer question wrong makes the flagship feature compare the wrong two things.

Raise it with `/domain-modeling` if the vocabulary of "current" vs "baseline" needs pinning first.

## Answer

A context in `ds/`, consulted by `useTokens()`. `mobile/src/ui` and every app screen are untouched and the guard still passes on its own.

**A context, not a second store instance.** `ui/` is byte-identical and calls `useTheme()` from inside, so the substitution has to happen one level below it. A second zustand instance would also be wrong on the merits: the override layer is global and both columns want the same one, so there is nothing per-render about it to select on. `useTokens()` reads a context that defaults to null, meaning live — so no provider is needed for ordinary screens and only the baseline column supplies one. `TokensFrom` uses `createElement` because `store.ts` is a `.ts`, and renaming it to `.tsx` would have touched every importer across the app for nothing.

**The override question, decided after asking.** Baseline is `HEAD` with **no** override layer. Current is `base + overrides`; applying the same overrides to both would apply the author's in-flight edits to the committed state too, and the two columns would agree on precisely the tokens being edited — the tool would show no drift for exactly the edits most worth seeing. The answer is "what has drifted from what was last committed", which naturally includes this session's uncommitted work, because that is what uncommitted means.

Enforced structurally: `TokenSource` is a discriminated union, not "a tree plus optional overrides", so there is no spelling that reintroduces a merged baseline.

**Missing paths are a defined answer.** `readPath` returns `undefined` rather than throwing when a token exists in one tree and not the other, which is the signal ticket 10 needs in order to report `added` and `removed` instead of crashing on a token added since `HEAD`.

**Shared scheme, as expected** — both columns read the same store, so the comparison cannot be confounded by one rendering light and the other dark. Not worth a separate decision once the tree became a parameter.

**One walker, not two.** `leafPaths` and `readPath` live in `renderSource.ts` and ticket 10 borrows them, so the path set the comparison iterates is by construction the path set the render can read. That removed a mirror the map would otherwise have inherited from ticket 05's validation split — worth noting because the alternative (a server-side diff) also cannot work: the current tree includes the override layer, which only exists in the browser.

`tokenRules`-style parameter sharing was considered and rejected here: there is one caller of this logic, so a shared file would be indirection rather than a guarantee.