import { create } from 'zustand';
import {
  pushToken,
  revertTokens,
  revertToCommitted as commitRevert,
  sessionHasBaseline,
  serverIsReachable,
  baselineValueFor,
  type TokenValue,
} from './client';
import { validateTokenValue } from './tokenValidation';

export type Scheme = 'light' | 'dark';

/**
 * The studio's editing session, in a module whose Fast Refresh cannot be
 * triggered by writing `tokens.json`.
 *
 * This is why the store is not in `store.ts`. That file imports `tokens.json` for
 * `useTokens`, and it has to: `mobile/src/ui/index.tsx` is byte-identical and
 * imports `useTheme` from there, so the import can never move. But the token
 * server's whole job is to rewrite `tokens.json`, and every rewrite makes Metro
 * re-evaluate `store.ts` — which rebuilt this store from scratch and silently
 * emptied it.
 *
 * The visible damage was that the ` •` marker and the per-token `undo` button
 * vanished the instant a write landed, because they are driven by `overrides`.
 * Changing the colour scheme reset to light for the same reason. Stopping the
 * token server made both symptoms disappear, which is how it was traced.
 *
 * Nothing here imports `tokens.json`, so nothing here is in the invalidated
 * import graph. Metro re-runs `store.ts`; it re-imports this module and gets the
 * same instance back. The session survives the file it is editing.
 */
type State = {
  overrides: Record<string, TokenValue>;
  scheme: Scheme;
  /** The last value the studio refused, with the reason. */
  rejection: { path: string; value: TokenValue; error: string } | null;
  /** Null means "not asked yet" — a tri-state, like the badge. */
  canRevertToSession: boolean | null;
  /**
   * What the last per-token undo actually managed to do, so the panel can explain
   * itself instead of appearing to do nothing.
   */
  undoNote: string | null;
  setToken: (path: string, value: TokenValue) => void;
  /**
   * Show a shared link's overrides. The caller validated them. Nothing goes to
   * the token server: a link shows a view of committed tokens, it does not edit
   * the codebase.
   */
  applySharedOverrides: (overrides: Record<string, TokenValue>) => void;
  setScheme: (scheme: Scheme) => void;
  revert: () => void;
  revertToken: (path: string) => void;
  revertToCommitted: () => void;
  refreshSessionBaseline: () => Promise<void>;
};

export const useEditorStore = create<State>((set, get) => ({
  overrides: {},
  scheme: 'light',
  rejection: null,
  canRevertToSession: null,
  undoNote: null,

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
    set((s) => ({ overrides: { ...s.overrides, [path]: value }, rejection: null, undoNote: null }));
    void pushToken(path, value);
  },

  setScheme: (scheme) => set({ scheme }),

  applySharedOverrides: (overrides) =>
    set({ overrides: { ...overrides }, rejection: null, undoNote: null }),

  revert: () => {
    set({ overrides: {}, rejection: null, undoNote: null });
    void revertTokens();
  },

  /**
   * Undo one token.
   *
   * The earlier version treated "the server gave no baseline" as one case and
   * refused, which made the button inert on the deployed build — it showed, and
   * clicking it did nothing but name a server that was never there. There are
   * three cases and they want different things.
   */
  revertToken: (path) => {
    if (!(path in get().overrides)) return;

    void (async () => {
      const original = await baselineValueFor(path);

      if (original === undefined) {
        // No answer from the server.
        if (serverIsReachable() === false) {
          // Known unreachable, so nothing was ever written: `tokens.json` is
          // untouched and the override *is* the whole edit. Dropping it is a true
          // revert, and this is the deployed build — the common case, not an edge.
          set((s) => {
            const next = { ...s.overrides };
            delete next[path];
            return {
              overrides: next,
              rejection: null,
              undoNote: `${path} back to the file value — no server, so it was never written`,
            };
          });
        } else {
          // Reachable earlier, so a write may well have landed. Refusing to guess
          // is the honest move: say the file could not be restored.
          set({
            undoNote: `${path} could not be restored — the server went away, so the file may still hold it`,
          });
        }
        return;
      }

      // A baseline value is known. Write it back, then stop masking the file.
      if (original !== null) {
        const verdict = validateTokenValue(path, original);
        if (verdict.ok) void pushToken(path, original);
      }
      set((s) => {
        const next = { ...s.overrides };
        delete next[path];
        return {
          overrides: next,
          rejection: null,
          undoNote:
            original === null
              ? `${path} was not in the file at session start, so the edit is simply dropped`
              : null,
        };
      });
    })();
  },

  revertToCommitted: () => {
    set({ overrides: {}, rejection: null, canRevertToSession: null, undoNote: null });
    void commitRevert();
  },

  refreshSessionBaseline: async () => {
    set({ canRevertToSession: await sessionHasBaseline() });
  },
}));