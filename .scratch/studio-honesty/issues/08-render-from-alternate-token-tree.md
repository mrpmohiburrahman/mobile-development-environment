Type: grilling
Status: open

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