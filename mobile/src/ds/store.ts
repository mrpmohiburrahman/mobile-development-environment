import { useMemo } from 'react';
import { create } from 'zustand';
import base from './tokens.json';
import { pushToken, revertTokens, type TokenValue } from './client';

export type Tokens = typeof base;
export type Scheme = keyof Tokens['color'];
export type TypeRole = keyof Tokens['type'];

/**
 * Edits are stored as an override layer keyed by dotted path, merged over the
 * JSON file on read.
 *
 * Overriding rather than mutating is what lets one code path serve both modes.
 * When the token server is running it rewrites tokens.json, Fast Refresh swaps
 * the module in, and the file value converges on the override — so the override
 * masking it is a no-op. With no server the override is the only thing there is.
 */
type State = {
  overrides: Record<string, TokenValue>;
  scheme: Scheme;
  setToken: (path: string, value: TokenValue) => void;
  setScheme: (scheme: Scheme) => void;
  revert: () => void;
};

export const useTokenStore = create<State>((set) => ({
  overrides: {},
  scheme: 'light',
  setToken: (path, value) => {
    set((s) => ({ overrides: { ...s.overrides, [path]: value } }));
    void pushToken(path, value);
  },
  setScheme: (scheme) => set({ scheme }),
  revert: () => {
    set({ overrides: {} });
    void revertTokens();
  },
}));

/** Set a dotted path on a plain object, mutating it. */
function setPath(obj: any, path: string, value: TokenValue) {
  const keys = path.split('.');
  const last = keys.pop()!;
  let node = obj;
  for (const k of keys) {
    if (typeof node[k] !== 'object' || node[k] === null) return;
    node = node[k];
  }
  node[last] = value;
}

export function applyOverrides(tokens: Tokens, overrides: Record<string, TokenValue>): Tokens {
  if (Object.keys(overrides).length === 0) return tokens;
  const next = structuredClone(tokens);
  for (const [path, value] of Object.entries(overrides)) setPath(next, path, value);
  return next;
}

/** The whole token tree, with edits applied. */
export function useTokens(): Tokens {
  const overrides = useTokenStore((s) => s.overrides);
  return useMemo(() => applyOverrides(base, overrides), [overrides]);
}

export type Theme = {
  color: Tokens['color']['light'];
  space: Tokens['space'];
  radius: Tokens['radius'];
  type: Tokens['type'];
  scheme: Scheme;
};

/** Tokens resolved for the active colour scheme. What every screen reads. */
export function useTheme(): Theme {
  const tokens = useTokens();
  const scheme = useTokenStore((s) => s.scheme);
  return useMemo(
    () => ({
      color: tokens.color[scheme],
      space: tokens.space,
      radius: tokens.radius,
      type: tokens.type,
      scheme,
    }),
    [tokens, scheme],
  );
}

/** Text style for a typography role, e.g. `useType('title')`. */
export function useType(role: TypeRole) {
  const { type } = useTheme();
  const t = type[role];
  return { fontSize: t.size, fontWeight: t.weight as any, lineHeight: t.lineHeight };
}
