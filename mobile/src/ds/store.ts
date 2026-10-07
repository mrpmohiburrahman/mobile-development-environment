import { createContext, createElement, useContext, useMemo } from 'react';
import { create } from 'zustand';
import base from './tokens.json';
import {
  pushToken,
  revertTokens,
  revertToCommitted,
  sessionHasBaseline,
  baselineValueFor,
  type TokenValue,
} from './client';
import { validateTokenValue } from './tokenValidation';
import {
  resolveTokensFor,
  LIVE,
  type TokenSource,
  type Tokens as AnyTokens,
} from './renderSource';

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
  /**
   * True once the server has a baseline to undo to.
   *
   * Null means "not asked yet", which is why this is a tri-state like the badge:
   * a freshly loaded panel cannot claim a session revert is available before it
   * has spoken to the server.
   */
  canRevertToSession: boolean | null;
  /**
   * True once the *server* has been restarted, so its baseline is gone. Undo then
   * has nothing to restore and says so, instead of silently restoring nothing.
   */
  baselineLost: boolean;
  setToken: (path: string, value: TokenValue) => void;
  setScheme: (scheme: Scheme) => void;
  /** Undo every edit made in this session, back to the file as it was. */
  revert: () => void;
  /** Undo one token, back to its value at session start. */
  revertToken: (path: string) => void;
  /** Back to the last commit. Destroys work the studio never saw. */
  revertToCommitted: () => void;
  /**
   * Ask the server whether it has a baseline. Called on panel mount.
   *
   * `client.ts` owns every fetch to the token server, so this goes through it
   * rather than repeating the URL here — one place knows the address.
   */
  refreshSessionBaseline: () => Promise<void>;
};

export const useTokenStore = create<State>((set, get) => ({
  overrides: {},
  scheme: 'light',
  rejection: null,
  canRevertToSession: null,
  baselineLost: false,
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
    // A session that has written nothing has no baseline, and the server answers
    // 409. Clearing the overrides anyway would leave the file and the store
    // disagreeing about what is in effect, so the panel keeps this disabled
    // until it knows a baseline exists.
    set({ overrides: {}, rejection: null });
    void revertTokens();
  },

  revertToken: (path) => {
    const { overrides } = get();
    if (!(path in overrides)) return;

    // Two halves, and both are needed. Clearing the override stops the store
    // masking the file; restoring the file value is what actually undoes the
    // edit. Do only the first and the token keeps this session's value; do only
    // the second and the store still shows it.
    void (async () => {
      const original = await baselineValueFor(path);
      if (original === undefined) {
        // No baseline: the server was restarted, or never heard of this path.
        // Say so rather than dropping the override and leaving the file wrong.
        set({ baselineLost: true });
        return;
      }
      if (original !== null) {
        const verdict = validateTokenValue(path, original);
        if (verdict.ok) void pushToken(path, original);
      }
      set((s) => {
        const next = { ...s.overrides };
        delete next[path];
        return { overrides: next, rejection: null };
      });
    })();
  },

  revertToCommitted: () => {
    set({ overrides: {}, rejection: null, canRevertToSession: null, baselineLost: false });
    void revertToCommitted();
  },

  refreshSessionBaseline: async () => {
    const hasBaseline = await sessionHasBaseline();
    set({ canRevertToSession: hasBaseline, baselineLost: false });
  },
}));

/**
 * Which token tree everything below this provider renders from.
 *
 * `null` means live, so no provider is needed for ordinary screens — only the
 * baseline column supplies one.
 */
const TokenSourceContext = createContext<TokenSource | null>(null);

/**
 * Render `children` against an explicit token tree instead of the live one.
 *
 * This is the seam that lets the studio draw a screen twice without touching
 * `mobile/src/ui`: `useTheme()` calls `useTokens()`, `useTokens()` reads this
 * context, and every screen inherits it. A pinned source is drawn from *exactly*
 * the given tree — the override layer is not merged in, which is the decision
 * `renderSource.ts` records and explains.
 */
export function TokensFrom({
  source,
  children,
}: {
  source: TokenSource;
  children: React.ReactNode;
}) {
  // createElement rather than JSX: this file is a .ts, and renaming it to .tsx
  // would touch every importer across the app for no benefit.
  return createElement(TokenSourceContext.Provider, { value: source }, children);
}

/** The whole token tree for this render, with the right edits applied to it. */
export function useTokens(): Tokens {
  const overrides = useTokenStore((s) => s.overrides);
  const source = useContext(TokenSourceContext);
  const resolved = useMemo(
    () => resolveTokensFor(source ?? LIVE, base as AnyTokens, overrides),
    [source, overrides],
  );
  // The memo returns AnyTokens; the cast is because the live source always
  // produces the real Tokens shape, and a pinned one is supplied by the caller
  // who fetched it from the same source.
  return resolved as Tokens;
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
