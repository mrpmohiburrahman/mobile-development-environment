/**
 * The pure half of the override layer: dotted-path writes and the merge over
 * the token tree.
 *
 * Split out from `store.ts` so it can be tested without a bundler. `store.ts`
 * imports zustand, react and `./client`, and Node's ESM resolver rejects the
 * extensionless specifier Metro is happy with — so importing `store.ts` from
 * `node --test` fails on `ERR_MODULE_NOT_FOUND` before any test runs. These two
 * functions need none of that, so they live here with no runtime imports at all.
 *
 * `store.ts` re-exports them, so nothing else in the app changes.
 */

export type TokenValue = string | number;

/** Set a dotted path on a plain object, mutating it. */
export function setPath(obj: any, path: string, value: TokenValue) {
  const keys = path.split('.');
  const last = keys.pop()!;
  let node = obj;
  for (const k of keys) {
    if (typeof node[k] !== 'object' || node[k] === null) return;
    node = node[k];
  }
  node[last] = value;
}

export function applyOverrides<T extends Record<string, any>>(
  tokens: T,
  overrides: Record<string, TokenValue>,
): T {
  if (Object.keys(overrides).length === 0) return tokens;
  const next = structuredClone(tokens);
  for (const [path, value] of Object.entries(overrides)) setPath(next, path, value);
  return next;
}