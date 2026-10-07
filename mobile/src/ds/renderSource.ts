/**
 * Which token tree a render reads from.
 *
 * The studio needs to draw the same screen twice: once from the live tokens, once
 * from the tokens at `HEAD`. Both renders use the same components — that is what
 * makes the comparison mean anything — so the *tree* has to be a parameter of
 * rendering rather than a module-level constant.
 *
 * `mobile/src/ui` is byte-identical and has to stay that way, and every screen
 * reaches its tokens through `useTheme()` inside it. So the substitution happens
 * one level down, in `useTokens()`, by way of a context this module describes.
 *
 * **The load-bearing decision, pinned here so it cannot drift.**
 *
 * A pinned render does *not* get the override layer. Current tokens are
 * `base + overrides`; the baseline is `HEAD`. Applying the same overrides to both
 * would apply the author's in-flight edits to the committed state too, and mask
 * part of the difference the tool exists to show. So `pinned` means exactly that
 * tree: no merge, no overrides, nothing else added to it.
 *
 * That makes the comparison answer one question — *what has drifted from what was
 * last committed* — and it naturally includes edits made in this session, which
 * are uncommitted by definition. The alternative question, "does the committed
 * file match what it was", is a different tool.
 *
 * Pure and dependency-free so `test/renderSource.test.ts` can load it.
 */

import { applyOverrides, type TokenValue } from './applyOverrides.ts';

export type Tokens = Record<string, any>;

/**
 * Where a render's tokens come from.
 *
 * - `live`  — the module-level `tokens.json` import, merged with the in-memory
 *   override layer. What every app screen reads.
 * - `pinned` — exactly the given tree, with nothing merged into it. The baseline
 *   column.
 *
 * A discriminated union rather than "a tree or null" so the no-override rule
 * cannot be forgotten at a call site: there is no way to say "pinned, plus these
 * overrides".
 */
export type TokenSource =
  | { kind: 'live' }
  | { kind: 'pinned'; tree: Tokens; label: string };

/**
 * The tree a render should use.
 *
 * `overrides` is ignored entirely for a pinned source. That is the decision above,
 * and it is the whole reason this function exists rather than the provider
 * calling `applyOverrides` itself.
 */
export function resolveTokensFor(
  source: TokenSource,
  liveBase: Tokens,
  overrides: Record<string, TokenValue> = {},
): Tokens {
  if (source.kind === 'pinned') return source.tree;
  return applyOverrides(liveBase, overrides);
}

/** Convenience for the common case, which is the live source. */
export const LIVE: TokenSource = { kind: 'live' };

/**
 * Every leaf path in a tree, as dotted paths.
 *
 * Used to decide what to compare: a path present in one tree and absent in the
 * other is itself drift — a token added or removed since `HEAD` — so the two
 * trees' path sets have to be diffable before any comparison runs.
 *
 * Arrays are indexed rather than walked into, because `tokens.json` has none; if
 * one ever appears, an index is a better answer than silently flattening it.
 */
export function leafPaths(tree: unknown, prefix = ''): string[] {
  if (tree === null || typeof tree !== 'object') return prefix ? [prefix] : [];
  if (Array.isArray(tree)) {
    return tree.flatMap((item, i) => leafPaths(item, prefix ? `${prefix}.${i}` : String(i)));
  }

  const out: string[] = [];
  for (const [key, value] of Object.entries(tree as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object') out.push(...leafPaths(value, path));
    else out.push(path);
  }
  return out;
}

/** Read a dotted path out of a tree. `undefined` when the path is not there. */
export function readPath(tree: unknown, path: string): unknown {
  let node: any = tree;
  for (const key of path.split('.')) {
    if (node === null || typeof node !== 'object' || !(key in node)) return undefined;
    node = node[key];
  }
  return node;
}