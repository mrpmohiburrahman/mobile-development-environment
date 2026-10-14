import { useSyncExternalStore } from 'react';
import { useHabits } from '../store/habits';
import { useEditorStore } from '../ds/editorState';
import { createSpine, spineReducer, type SpineInput, type SpineState } from './spine';

/**
 * The spine, wired to the two stores and the navigation seam.
 *
 * ## Why this file is so fussy about its imports
 *
 * `mobile/src/ds/store.ts` imports `tokens.json` and cannot stop, because
 * `mobile/src/ui/index.tsx` is byte-identical and takes `useTheme` from there. The
 * token server rewrites that file, so every successful write makes Metro
 * re-evaluate `store.ts` — and while the token editor's store lived there, it was
 * rebuilt empty, silently emptying a whole editing session.
 *
 * So this module imports `../ds/editorState` (which imports nothing that can
 * change under it) and **never** `../ds/store`. One token write must not be able
 * to reach the log. `test/mechanisms.test.ts` reads this file's source and fails
 * if that import ever comes back.
 *
 * ## Why the app store gets every notification and the editor store does not
 *
 * The app store's full state is the log's subject, so every notification is
 * dispatched and the spine's own differ decides whether anything moved. That is
 * what makes "signed in while already signed in" produce no row.
 *
 * The editor store's subject is `scheme`, and only `scheme`. Every token edit also
 * notifies it, and counting those would bury the one row a reader wants — the
 * scheme change repaints the entire board. Override writes are reported by the
 * disk badge and the token panel already.
 *
 * ## Why the flush is a macrotask
 *
 * A task is committed on a `setTimeout`, not a microtask, so a handler that
 * `await`s before it writes still lands in the same task as the press that started
 * it. The four push edges in this app are synchronous, so either would do; the
 * macrotask costs nothing and is right for the case that has not been written yet.
 *
 * Not a test file, and not importable under `node --test` — it pulls in React and
 * two live stores. The decisions it depends on all live in `spine.ts`, which is.
 */

let state: SpineState = createSpine();
let attached = false;
let flushQueued = false;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const dispatch = (input: SpineInput) => {
  const next = spineReducer(state, input);
  // The reducer is pure and returns the same object when nothing happened, so
  // identity is a correct and cheap change check.
  if (next === state) return;
  state = next;
  emit();
  if (input.kind !== 'flush') queueFlush();
};

const queueFlush = () => {
  if (flushQueued) return;
  flushQueued = true;
  setTimeout(() => {
    flushQueued = false;
    dispatch({ kind: 'flush' });
  }, 0);
};

/**
 * What the log is about, as far as the spine is concerned.
 *
 * A projection rather than the raw store, so the log reads as the app's state and
 * not as a zustand implementation detail. Setters are dropped: they are functions,
 * they never differ, and a path pointing at one would be a path nobody can read.
 */
const appState = (s: { habits: unknown; signedIn: boolean; selectedId: string | null }) => ({
  signedIn: s.signedIn,
  selectedId: s.selectedId,
  habits: s.habits,
});

/**
 * Attach the log to both stores.
 *
 * Idempotent, and deliberately *not* called at module scope: until this runs the
 * log is not watching, and the panel says so. That is a real state rather than a
 * formality — "nothing has happened yet" and "the log is not listening" are
 * different sentences, and collapsing them is how a reader concludes the app is
 * idle when nothing was ever wired up.
 */
export function attachSpine(): () => void {
  if (attached) return () => {};
  attached = true;

  const unsubscribeApp = useHabits.subscribe((next, prev) =>
    dispatch({ kind: 'store', store: 'app', before: appState(prev), after: appState(next) }),
  );

  const unsubscribeEditor = useEditorStore.subscribe((next, prev) => {
    if (next.scheme === prev.scheme) return;
    dispatch({
      kind: 'store',
      store: 'editor',
      before: { scheme: prev.scheme },
      after: { scheme: next.scheme },
    });
  });

  emit();
  return () => {
    unsubscribeApp();
    unsubscribeEditor();
  };
}

/** Whether the log is currently listening to anything. */
export const isSpineAttached = (): boolean => attached;

/** Record a press. Called by the blueprint's capture-phase listener. */
export const recordPress = (press: {
  frame: string | null;
  column: 'current' | 'comparison';
  label: string | null;
  target: string | null;
}) => dispatch({ kind: 'press', ...press });

/** Record a route change. Called by the navigation seam in `designing.tsx`. */
export const recordRoute = (route: { from: string | null; to: string; column: 'current' | 'comparison' }) =>
  dispatch({ kind: 'route', ...route });

/** The whole log, for the panels. Stable identity between changes. */
export const useSpine = (): SpineState => useSyncExternalStore(subscribe, getSpineState);

/** The log outside React, for the board chrome. */
export const getSpineState = (): SpineState => state;