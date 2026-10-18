/**
 * The browser half of shareable URL state (ticket 22). `urlState.ts` decides
 * what a payload means; this hook moves it between the URL and the stores:
 *
 * - **In.** Once the board can honor a camera command, the hash is decoded and
 *   the valid part applies — scheme and overrides onto the editor store,
 *   screen and present flag onto the screen state. Every rejected part becomes
 *   a banner sentence.
 * - **Out.** Every change to the four shared fields re-encodes the hash
 *   through a debounced `history.replaceState`, so the address bar always
 *   names what is on screen and no history entries pile up. A fully default
 *   view clears the fragment rather than carrying an empty payload.
 * - **Copy.** "Copy link" encodes at click time — ahead of the pending
 *   debounce, so the clipboard gets the latest edits, not a stale value — and
 *   reports success or failure as a button-label swap.
 *
 * Overrides apply through `applySharedOverrides`, never through `setToken`:
 * a shared link reproduces a *view* of the receiving build's committed tokens,
 * it does not write to the codebase. On the static build there is no server
 * either way; in dev this keeps opening a link from rewriting `tokens.json`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../ds/editorState';
import { useScreenState } from './screen.state';
import { screens } from './screens';
import tokens from '../ds/tokens.json';
import {
  compressionSupported,
  decodeSharePayload,
  encodeShareState,
  isDefaultShareState,
  shareHref,
  sharePayloadFromHash,
  SHARE_WARNINGS,
  type ShareState,
} from './urlState';

const SYNC_DEBOUNCE_MS = 400;
const COPY_FEEDBACK_MS = 2400;
const KNOWN_SCREENS = screens.map((s) => s.key);
const COMMITTED = tokens as unknown as Record<string, unknown>;

export type CopyState = 'idle' | 'copied' | 'failed';

function currentShareState(): ShareState {
  const editor = useEditorStore.getState();
  const screen = useScreenState.getState();
  return {
    present: screen.presenting,
    screen: screen.presentedKey,
    scheme: editor.scheme,
    overrides: editor.overrides,
  };
}

function pageBase(): string {
  return window.location.pathname + window.location.search;
}

async function publishCurrentView(): Promise<string | null> {
  const state = currentShareState();
  const payload = await encodeShareState(state);
  if (payload === null && !isDefaultShareState(state)) return null;
  const href = shareHref(pageBase(), payload);
  window.history.replaceState(null, '', href);
  return new URL(href, window.location.href).href;
}

export function useShareLink({
  ready,
  focusScreen,
}: {
  /** The board has real frame positions and a measured viewport. */
  ready: boolean;
  /** Camera command for a linked screen that is not being presented. */
  focusScreen: (key: string) => void;
}) {
  const [warnings, setWarnings] = useState<string[]>([]);
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const [supported, setSupported] = useState(true);
  const applied = useRef(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSync = useCallback(() => {
    if (!applied.current || !compressionSupported()) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      void publishCurrentView();
    }, SYNC_DEBOUNCE_MS);
  }, []);

  // The URL follows the four shared fields and nothing else. Both stores are
  // small, so an unselected subscribe is cheaper than a selector per field.
  useEffect(() => {
    const unEditor = useEditorStore.subscribe(scheduleSync);
    const unScreen = useScreenState.subscribe(scheduleSync);
    return () => {
      unEditor();
      unScreen();
      if (syncTimer.current) clearTimeout(syncTimer.current);
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, [scheduleSync]);

  // A fresh context applies the link once the board can act on it. Applying
  // before frame positions land would fly the camera at a layout that is
  // about to move.
  useEffect(() => {
    if (!ready || applied.current) return;
    applied.current = true;
    if (typeof window === 'undefined') return;
    let cancelled = false;
    void (async () => {
      if (!compressionSupported()) {
        setSupported(false);
        setWarnings([SHARE_WARNINGS.unsupported]);
        return;
      }
      const payload = sharePayloadFromHash(window.location.hash);
      if (!payload) return;
      const outcome = await decodeSharePayload(payload, KNOWN_SCREENS, COMMITTED);
      if (cancelled) return;
      const { state } = outcome;
      if (outcome.warnings.length > 0) setWarnings(outcome.warnings);
      if (Object.keys(state.overrides).length > 0) {
        useEditorStore.getState().applySharedOverrides(state.overrides);
      }
      useEditorStore.getState().setScheme(state.scheme);
      if (state.screen) {
        useScreenState.getState().setPresentedKey(state.screen);
        if (state.present) useScreenState.getState().setPresenting(true);
        else focusScreen(state.screen);
      }
      // Normalize the hash to what actually applied, so an unknown screen or
      // a rejected override does not keep advertising itself in the URL.
      scheduleSync();
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, focusScreen, scheduleSync]);

  const dismissWarnings = useCallback(() => setWarnings([]), []);

  const copyLink = useCallback(async () => {
    if (typeof window === 'undefined') return;
    // The click supersedes any pending debounce: encode now, then publish.
    if (syncTimer.current) {
      clearTimeout(syncTimer.current);
      syncTimer.current = null;
    }
    let ok = false;
    if (compressionSupported() && navigator.clipboard?.writeText) {
      try {
        const href = await publishCurrentView();
        if (href) {
          await navigator.clipboard.writeText(href);
          ok = true;
        }
      } catch {
        ok = false;
      }
    }
    setCopyState(ok ? 'copied' : 'failed');
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopyState('idle'), COPY_FEEDBACK_MS);
  }, []);

  return { warnings, dismissWarnings, copyLink, copyState, supported };
}
