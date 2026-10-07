// Session-scoped revert: what the token file looked like before this session
// touched it.
//
// The old revert was `git checkout -- tokens.json`, which throws away every
// uncommitted token edit — including half-finished work from before you opened
// the studio today. One colour poked now, yesterday's careful work gone.
//
// The baseline lives here, in module scope, seeded on the first write of the
// process's life. No file on disk, no cleanup path, nothing to garbage collect.
// Restarting the server loses it, which is what "session" honestly means — the
// UI says so rather than pretending the baseline is permanent.
//
// Split out of index.mjs so `node --test` can import it: importing index.mjs
// calls server.listen() and the test runner would wait on a live listener.

/** The token tree as it was before this session's first write. null = no baseline. */
let baseline = null;

/** Tokens at the moment the session started, or null if it has not written yet. */
export function sessionBaseline() {
  return baseline;
}

/**
 * Seed the baseline from a token tree, if there is not one already.
 *
 * Idempotent on purpose: only the *first* write seeds it, so the snapshot is the
 * state at session start rather than the state before the most recent edit.
 * Otherwise reverting would land you one edit ago instead of at the beginning.
 */
export function seedBaseline(tokens) {
  if (baseline === null) {
    // Deep copy, so later writes to the live tree cannot reach into the
    // baseline. structuredClone is Node-stdlib and does not carry prototypes.
    baseline = structuredClone(tokens);
  }
  return baseline;
}

/**
 * Seed the baseline from the *pre-write* tree, discarding any baseline already
 * held.
 *
 * Used by the server's first accepted write. It is a distinct function from
 * `seedBaseline` on purpose: `seedBaseline` is idempotent, and seeding it from an
 * already-mutated tree would capture the first edit inside the snapshot — so
 * "revert to session start" would leave that edit applied. `establishBaseline`
 * also makes the first-write case explicit at the call site rather than relying
 * on the caller passing the right argument in the right order.
 */
export function establishBaseline(tokensBeforeWrite) {
  baseline = structuredClone(tokensBeforeWrite);
  return baseline;
}

/** True once a baseline exists, i.e. once there is something to revert to. */
export function hasBaseline() {
  return baseline !== null;
}

/** Forget the baseline. The next write seeds a fresh one. */
export function resetBaseline() {
  baseline = null;
}

/**
 * The token tree to write for a revert-to-session-start.
 *
 * Returns a copy of the baseline rather than the baseline itself, because the
 * caller is about to mutate it with setPath. Handing out the live object would
 * let a write corrupt the only copy of the session's starting point.
 */
export function restoreBaseline() {
  if (baseline === null) return null;
  return structuredClone(baseline);
}