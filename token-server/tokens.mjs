// Pure token-tree helpers for the server, kept out of `index.mjs` so they can
// be tested without importing the module that calls `server.listen()`.
//
// Node stdlib only, no dependencies — same rule as the server itself.

/**
 * Set a dotted path, e.g. "color.light.accent". Refuses to create new keys.
 *
 * Note the deliberate asymmetry with the client's `setPath` in
 * `mobile/src/ds/applyOverrides.ts`, which writes `node[last]` unconditionally
 * and will happily create a path. That divergence is unreachable from the UI
 * today, because paths always originate from the token panel and therefore
 * always exist. Noted, not changed.
 */
export function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  let node = obj;
  for (const k of keys) {
    if (!Object.hasOwn(node, k) || typeof node[k] !== 'object') return false;
    node = node[k];
  }
  if (!Object.hasOwn(node, last)) return false;
  node[last] = value;
  return true;
}