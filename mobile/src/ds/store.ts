import { useMemo } from 'react';
import { create } from 'zustand';
import base from './tokens.json';
import { pushToken, revertTokens, type TokenValue } from './client';
import { applyOverrides } from './applyOverrides';
import { validateTokenValue } from './tokenValidation';

export { applyOverrides, setPath } from './applyOverrides';

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
  /**
   * The last value the studio refused to accept, with the reason.
   *
   * Kept as state rather than thrown so the panel can say why a drag stopped
   * where it did. Cleared on the next accepted edit, so a stale complaint never
   * outlives the thing it was about.
   */
  rejection: { path: string; value: TokenValue; error: string } | null;
  setToken: (path: string, value: TokenValue) => void;
  setScheme: (scheme: Scheme) => void;
  revert: () => void;
};

export const useTokenStore = create<State>((set) => ({
  overrides: {},
  scheme: 'light',
  rejection: null,
  setToken: (path, value) => {
    // Validated here as well as on the server. The server's copy exists because it
    // must refuse writes from anything that is not this client; this copy exists
    // because a drag that silently refuses to move feels broken, whereas one that
    // says "radius must be a number 0–999" is teaching.
    const verdict = validateTokenValue(path, value);
    if (!verdict.ok) {
      set({ rejection: { path, value, error: verdict.error } });
      return;
    }
    set((s) => ({ overrides: { ...s.overrides, [path]: value }, rejection: null }));
    void pushToken(path, value);
  },
  setScheme: (scheme) => set({ scheme }),
  revert: () => {
    set({ overrides: {}, rejection: null });
    void revertTokens();
  },
}));

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
  elevation: Tokens['elevation'];
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
      elevation: tokens.elevation,
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
