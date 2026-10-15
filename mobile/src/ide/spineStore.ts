import { useSyncExternalStore } from 'react';
import { useHabits } from '../store/habits';
import { useEditorStore } from '../ds/editorState';
import { createSpine, spineReducer, type PressFact, type RouteFact, type SpineInput, type SpineState } from './spine';

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

const initialState: SpineState = createSpine();
let state = initialState;
let attached = false;
/** How many callers are holding the subscriptions open. */
let holders = 0;
/** The live teardown, or null when nothing is subscribed. */
let teardown: (() => void) | null = null;
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
  // `flush` is the commit point and `listener` is a fact about the reader: neither
  // is a task, so neither queues one.
  if (input.kind !== 'flush' && input.kind !== 'listener') queueFlush();
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
 * Reference-counted, and deliberately *not* called at module scope: until this
 * runs the log is not watching, and the panel says so. That is a real state rather
 * than a formality — "nothing has happened yet" and "the log is not listening" are
 * different sentences, and collapsing them is how a reader concludes the app is
 * idle when nothing was ever wired up.
 *
 * ## Why the count, and why the teardown resets the flag
 *
 * The first version set `attached = true` and handed back a teardown that
 * unsubscribed from both stores without ever clearing the flag. Leaving `/ide`
 * ran the teardown; coming back called `attachSpine` again, saw `attached`, and
 * returned a no-op — so the log was deaf for the rest of the session while
 * `isSpineAttached()` still said it was watching. A panel that reports "watching"
 * over a subscription that no longer exists is the exact failure this module's
 * docblock exists to prevent, and it was silent.
 *
 * Counting rather than a boolean because two callers can hold the log open at
 * once, and one of them leaving must not deafen the other.
 */
export function attachSpine(): () => void {
  holders += 1;
  if (!teardown) teardown = subscribeToStores();

  let released = false;
  return () => {
    // Idempotent: React runs a cleanup once, but a caller may not, and double-
    // decrementing would tear the subscriptions down under a live holder.
    if (released) return;
    released = true;
    holders -= 1;
    if (holders > 0 || !teardown) return;
    teardown();
    teardown = null;
    emit();
  };
}

/**
 * The subscriptions themselves, and the flag that says they exist.
 *
 * `attached` is set and cleared here and nowhere else, so the flag and the
 * subscriptions can never disagree — which is the whole claim `isSpineAttached()`
 * makes.
 */
function subscribeToStores(): () => void {
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

  attached = true;
  emit();

  return () => {
    unsubscribeApp();
    unsubscribeEditor();
    attached = false;
  };
}

/** Whether the log is currently listening to anything. */
export const isSpineAttached = (): boolean => attached;

/** Record a press. Called by the blueprint's capture-phase listener. */
export const recordPress = (press: PressFact) => dispatch({ kind: 'press', ...press });

/** Record a route change. Called by the navigation seam in `designing.tsx`. */
export const recordRoute = (route: RouteFact) => dispatch({ kind: 'route', ...route });

/**
 * Whether the board's press listener is attached.
 *
 * Reported into the spine rather than kept in the board's local state, because the
 * badge and the panel both print it and two copies of a fact about the reader is
 * how they come to disagree. `false` on cleanup as well as `true` on attach: a
 * listener that was removed is not listening, and a zero count gathered since then
 * must not read as "nothing was pressed".
 */
export const setPressListening = (isListening: boolean) => dispatch({ kind: 'listener', attached: isListening });

/** The whole log, for the panels. Stable identity between changes. */
export const useSpine = (): SpineState => useSyncExternalStore(subscribe, getSpineState, () => initialState);

/** The log outside React, for the board chrome. */
export const getSpineState = (): SpineState => state;