// Talks to the token server, which is the thing that makes an edit land in git.
//
// The server is optional on purpose. Locally it is running, so an edit rewrites
// src/ds/tokens.json, Fast Refresh reloads the module, and the change shows up in
// `git diff` and on a connected simulator. On the deployed web build there is no
// server and no filesystem, so the edit lives only in the store — the UI feels
// identical, it just doesn't persist. Same code path either way.

const SERVER = process.env.EXPO_PUBLIC_TOKEN_SERVER ?? 'http://localhost:3001';

async function requestServer(path: string, options?: RequestInit): Promise<Response> {
  if (SERVER === 'http://127.0.0.1:9') {
    throw new Error('The build uses in-memory token edits.');
  }
  return fetch(`${SERVER}${path}`, options);
}

export type TokenValue = string | number;

let reachable: boolean | null = null;
const listeners = new Set<() => void>();

/** Whether the token server answered last time we tried. null = not tried yet. */
export function serverIsReachable() {
  return reachable;
}

/**
 * Subscribe to changes in `serverIsReachable`. Returns an unsubscribe function.
 *
 * Without this the flag is a plain module-level `let` and reading it in a
 * component never re-renders: the badge would show "not checked yet" forever and
 * only ever repaint if something else happened to re-render the tree. That is the
 * whole defect this subscription removes, so it is deliberate rather than
 * incidental — see `ide/DiskBadge.tsx`, which pairs it with `useSyncExternalStore`.
 *
 * `reachable` stays a primitive on purpose. `useSyncExternalStore` re-reads its
 * snapshot on every render and requires the value to be `Object.is`-stable while
 * nothing has changed; a boolean or null always is, so there is nothing to memoise.
 */
export function subscribeServerStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Record an answer and wake the badge. */
function recordReachable(next: boolean) {
  reachable = next;
  for (const listener of listeners) listener();
}

export async function pushToken(path: string, value: TokenValue): Promise<boolean> {
  try {
    const res = await requestServer('/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, value }),
    });
    recordReachable(res.ok);
    return res.ok;
  } catch {
    recordReachable(false);
    return false;
  }
}

/**
 * Undo everything this session wrote, back to the file as it was when the
 * session's first edit landed.
 *
 * 409 when the session has written nothing: there is no baseline to return to,
 * so the caller is told rather than left believing an undo happened.
 */
export async function revertTokens(): Promise<boolean> {
  try {
    const res = await requestServer('/revert', { method: 'POST' });
    recordReachable(res.ok);
    return res.ok;
  } catch {
    recordReachable(false);
    return false;
  }
}

/**
 * Back to the last commit.
 *
 * Separate from `revertTokens` on purpose and not a parameter: this one destroys
 * uncommitted work the studio never saw, and folding it into the same call would
 * make the destructive intent invisible at the call site.
 */
export async function revertToCommitted(): Promise<boolean> {
  try {
    const res = await requestServer('/revert-committed', { method: 'POST' });
    recordReachable(res.ok);
    return res.ok;
  } catch {
    recordReachable(false);
    return false;
  }
}

/**
 * The token tree as last committed, for baseline mode.
 *
 * Null means "no server, so no committed tree to compare against" — distinct from
 * an empty tree, which the studio would never produce. `false` for unreachable is
 * what keeps the compare toggle disabled on the deployed build rather than
 * offering a comparison that cannot happen.
 */
export async function fetchCommittedTokens(): Promise<Record<string, any> | null> {
  try {
    const res = await requestServer('/baseline');
    if (!res.ok) return null;
    const { tree } = (await res.json()) as { tree: Record<string, any> };
    recordReachable(true);
    return tree;
  } catch {
    recordReachable(false);
    return null;
  }
}

/**
 * Whether the server has a baseline to undo to.
 *
 * `false` also covers "no server" — the panel needs to know it cannot offer a
 * session revert, and it should not have to tell a missing server apart from a
 * fresh one to act on that.
 */
export async function sessionHasBaseline(): Promise<boolean> {
  try {
    const res = await requestServer('/session');
    if (!res.ok) return false;
    const { hasBaseline } = (await res.json()) as { hasBaseline: boolean };
    return hasBaseline;
  } catch {
    return false;
  }
}

/**
 * The value one token had at session start, for per-token undo.
 *
 * 404 when the server has no baseline, which is also true if it was restarted
 * mid-session — in that case there is nothing to undo *to*, and the panel says so
 * rather than restoring something arbitrary.
 */
export async function baselineValueFor(path: string): Promise<TokenValue | null | undefined> {
  try {
    const res = await requestServer('/session');
    if (!res.ok) return undefined;
    const { baseline } = (await res.json()) as {
      hasBaseline: boolean;
      baseline: Record<string, any> | null;
    };
    if (!baseline) return undefined;
    // Walk the dotted path in the baseline tree. Absent means the token was not
    // there at session start, which the caller treats as "nothing to restore".
    let node: any = baseline;
    for (const key of path.split('.')) {
      if (node === null || typeof node !== 'object' || !(key in node)) return null;
      node = node[key];
    }
    return node as TokenValue;
  } catch {
    return undefined;
  }
}
