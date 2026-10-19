import { createContext, createElement, useContext, useMemo } from 'react';
import base from './tokens.json';
import { useEditorStore, type Scheme } from './editorState';
import {
  resolveTokensFor,
  LIVE,
  type TokenSource,
  type Tokens as AnyTokens,
} from './renderSource';

export { applyOverrides, setPath } from './applyOverrides';

/**
 * The editing session lives in `editorState.ts`, not here, and the reason is
 * load-bearing rather than tidiness.
 *
 * This file imports `tokens.json`, and it cannot stop: `mobile/src/ui/index.tsx`
 * is byte-identical and takes `useTheme` from here. The token server rewrites
 * `tokens.json`, so every successful write makes Metro re-evaluate this module —
 * and while the store was defined here, that rebuilt it empty. The ` •` markers,
 * the per-token `undo` buttons and the chosen colour scheme all silently reset
 * the moment an edit landed.
 *
 * `editorState.ts` imports nothing that can change under it, so Metro re-runs
 * this file and gets the same store instance back. Exported under the name the
 * rest of the app already uses, so no call site had to move.
 */
export const useTokenStore = useEditorStore;
export type { Scheme };

export type Tokens = typeof base;
export type TypeRole = Exclude<keyof Tokens['type'], 'family'>;

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
  return { fontFamily: type.family, fontSize: t.size, fontWeight: t.weight as any, lineHeight: t.lineHeight };
}
