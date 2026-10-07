/**
 * What the studio is willing to claim about where an edit went.
 *
 * Split out of `client.ts` for the same reason `applyOverrides.ts` exists: this
 * is the half that has to be testable, and a module that reaches for React or
 * `fetch` cannot be imported by `node --test`. There are no runtime imports here.
 *
 * The tri-state is the whole point. `serverIsReachable()` answers
 * `boolean | null`, and `null` means "nothing has tried to talk to the token
 * server yet" — which on a fresh load of the deployed static build is the true
 * answer. Collapsing that to `false` would have the badge claim the studio knows
 * where edits go when it has not yet found out.
 *
 * Colour is not decided here. `Tone` names the three states; `ide/chrome.ts`
 * maps names to hex, so this module stays about meaning and the palette stays
 * in one place for the chrome to share.
 */

/** As `serverIsReachable()` reports it. `null` = not tried yet. */
export type Reachability = boolean | null;

/** Which of the three honest answers this is. */
export type WriteTarget = 'disk' | 'memory' | 'unknown';

/** Semantic colour name, resolved to hex by the chrome palette. */
export type Tone = 'ok' | 'degraded' | 'muted';

export type ReachabilityCopy = {
  target: WriteTarget;
  tone: Tone;
  /** Short enough for a header. Says where the edit went. */
  label: string;
  /** One clause on the consequence, so the state is not just a mood. */
  detail: string;
};

const COPY: Record<WriteTarget, Omit<ReachabilityCopy, 'target'>> = {
  disk: {
    tone: 'ok',
    label: 'writes to disk',
    detail: 'edits land in tokens.json',
  },
  memory: {
    tone: 'degraded',
    label: 'in-memory only',
    detail: 'edits do not reach tokens.json',
  },
  unknown: {
    tone: 'muted',
    label: 'not checked yet',
    detail: 'no edit has been attempted yet',
  },
};

/**
 * Map the raw flag to what the studio says about it.
 *
 * `degraded` is deliberately not an alarm colour. On the deployed static build
 * there is no server and no filesystem, and that is the common case rather than
 * something that went wrong — the badge reports it, it does not apologise for it.
 */
export function describeReachability(reachable: Reachability): ReachabilityCopy {
  const target: WriteTarget = reachable === true ? 'disk' : reachable === false ? 'memory' : 'unknown';
  return { target, ...COPY[target] };
}