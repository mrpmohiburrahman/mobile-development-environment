// Talks to the token server, which is the thing that makes an edit land in git.
//
// The server is optional on purpose. Locally it is running, so an edit rewrites
// src/ds/tokens.json, Fast Refresh reloads the module, and the change shows up in
// `git diff` and on a connected simulator. On the deployed web build there is no
// server and no filesystem, so the edit lives only in the store — the UI feels
// identical, it just doesn't persist. Same code path either way.

const SERVER = process.env.EXPO_PUBLIC_TOKEN_SERVER ?? 'http://localhost:3001';

export type TokenValue = string | number;

let reachable: boolean | null = null;

/** Whether the token server answered last time we tried. null = not tried yet. */
export function serverIsReachable() {
  return reachable;
}

export async function pushToken(path: string, value: TokenValue): Promise<boolean> {
  try {
    const res = await fetch(`${SERVER}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, value }),
    });
    reachable = res.ok;
    return res.ok;
  } catch {
    reachable = false;
    return false;
  }
}

export async function revertTokens(): Promise<boolean> {
  try {
    const res = await fetch(`${SERVER}/revert`, { method: 'POST' });
    reachable = res.ok;
    return res.ok;
  } catch {
    reachable = false;
    return false;
  }
}
