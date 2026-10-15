/**
 * The spine: one chronological stream of what the running app did.
 *
 * ## What this is
 *
 * One reducer over one state, fed by three kinds of input — a store difference, a
 * route change, and a press. The shape is the talk's own shape: a stream of
 * events from the running app. It is not an analytics SDK, and the difference is
 * deliberate rather than a smaller version of the same thing. An SDK is a runtime
 * dependency that commits a project token and phones a third party, all of which
 * break a repo whose test command is `node --test` and whose server is stdlib
 * only. This is the same stream with none of those costs.
 *
 * ## Why one reducer, and why it groups by task
 *
 * Because it is one state, ordering is total: a habit change and a scheme change
 * in the same moment appear in the order they happened, which is the only thing
 * that makes a shared stream readable.
 *
 * And because entries are committed at a **task boundary** rather than per input,
 * a press and the change it shares a task with land on one line. Four of the
 * seven push edges mutate state in the same synchronous task as the navigation,
 * so drawn as separate rows they are four things for a reader to correlate by
 * hand — the exact join the original talk listed its state panel and blueprint as
 * separate ideas and so could not show.
 *
 * ## The rule that makes the log worth reading
 *
 * **Differences, never notifications.** A zustand `set` notifies on every call,
 * including one that writes an identical value — `login.tsx` signs in while
 * already signed in. A log of notifications fills with entries that changed
 * nothing within a minute, which is the crying-wolf failure in its purest form: a
 * panel that shouts constantly teaches you to stop reading it.
 *
 * So the comparison is delegated to `ds/drift.ts`, the differ the token drift
 * report already uses. Not reimplemented, because a second differ is a second set
 * of the normalisation bugs the first one carries fixed, and here those bugs are
 * already known and already repaired.
 *
 * "Baseline" in that module means `HEAD`. Here it means *the previous value*, and
 * the row shape is otherwise identical — one vocabulary, so a reader meets a row
 * they already know in two different reports.
 *
 * ## What a press is, and is not
 *
 * A press is **not** a cause. The log reports what changed and where the press
 * landed as two facts side by side and draws no arrow between them, because the
 * change usually repaints a *different* frame than the one pressed. The pairing
 * is scoped to the column the press landed in, for the same reason.
 *
 * A press with no event is inert, and nothing more is inferred from it. A press
 * the studio could not even locate is counted apart from inert, because "I found
 * nothing" and "I looked in the wrong place" must never be the same number.
 *
 * This pure reducer imports the pure tree differ at runtime.
 * Neither module requires React, a browser, or the token server to load.
 * `test/spine.test.ts` loads it directly with the type-stripping runner.
 */

import { diffTrees, type Difference } from '../ds/drift.ts';
import type { Tone } from '../ds/reachability.ts';

/** Which store a difference landed in. The studio has two, and they matter. */
export type StoreName = 'app' | 'editor';

/** Which column of the board. The comparison column renders the same screens. */
export type Column = 'current' | 'comparison';

/** The three input kinds, plus the boundary that commits a task. */
export type SpineInput =
  | { kind: 'store'; store: StoreName; before: unknown; after: unknown }
  | { kind: 'route'; from: string | null; to: string; column: Column }
  | { kind: 'press'; frame: string | null; column: Column; label: string | null; target: string | null }
  /** The board's capture listener came up or went away. A fact about the reader. */
  | { kind: 'listener'; attached: boolean }
  | { kind: 'flush' };

/** What was pressed, as far as the studio could establish. */
export type PressFact = {
  /** The frame's screen key, or null when no frame ancestor was found. */
  frame: string | null;
  column: Column;
  /** The frame's own label, for a row a person can read. */
  label: string | null;
  /** A trimmed, truncated description of the pressed element. */
  target: string | null;
};

/** A route change, as recorded at the navigation seam. */
export type RouteFact = { from: string | null; to: string; column: Column };

/** One store's difference from its own previous value. */
export type ChangeFact = { store: StoreName; differences: Difference[] };

/**
 * What happened to a press.
 *
 * - `live` — the press shared a task with a measured change.
 * - `inert` — it did not. Said about **the studio**: the control is real, the
 *   board simply does not navigate from it.
 * - `unattributed` — a later press in a task that already had its change
 *   credited to an earlier one, so crediting this too would inflate the count.
 * - `unlocated` — the press could not be attributed to a frame at all, which is
 *   a failed measurement rather than a quiet control.
 */
export type PressVerdict = 'live' | 'inert' | 'unattributed' | 'unlocated';

/** One line of the log. A task, never an input. */
export type SpineEntry = {
  /** Total order across every entry ever committed. */
  seq: number;
  press: PressFact | null;
  route: RouteFact | null;
  changes: ChangeFact[];
  /** Null when no press was part of this task, so nothing is claimed. */
  verdict: PressVerdict | null;
};

/** Everything gathered between two boundaries. Committed as one entry. */
type Pending = { presses: PressFact[]; routes: RouteFact[]; changes: ChangeFact[] };

export type SpineState = {
  cap: number;
  seq: number;
  /** Newest last, so the panel renders `entries` reversed without copying. */
  entries: SpineEntry[];
  /** Entries the cap evicted. A truncated history must say it is truncated. */
  dropped: number;
  /**
   * Every press ever decided, including the ones the ring has evicted.
   *
   * Deliberately **not** derived from `entries`. A tally read off the ring shrinks
   * the moment the cap evicts a row, so the board's "23 of 48" would quietly become
   * "23 of 47" mid-session — a number that changes without anything happening, which
   * is the one thing a measurement must not do. Accumulated at commit instead, so
   * eviction drops the *rows* and never the *count*.
   */
  tally: PressTally;
  /**
   * Whether the board's capture listener is attached right now.
   *
   * Part of the log's self-report rather than a panel's local state, because the
   * badge and the panel both have to say it and they must not disagree. `false`
   * until the listener really attaches: a press count of zero gathered by a listener
   * that never ran is not "nothing was pressed", it is "nothing was listening".
   */
  pressListening: boolean;
  /**
   * Store writes that diffed to nothing.
   *
   * This is what separates "watching, nothing has happened yet" from "watching,
   * and everything that has happened changed nothing". Without a count the two
   * render identically, and a reader who cannot tell them apart will conclude the
   * app is idle when the log is simply not being told.
   */
  noopWrites: number;
  /** Route events seen at the seam. Deliberately not the list's own length. */
  routeEvents: number;
  pending: Pending;
};

const emptyPending = (): Pending => ({ presses: [], routes: [], changes: [] });

const isEmpty = (p: Pending) => p.presses.length === 0 && p.routes.length === 0 && p.changes.length === 0;

/**
 * How many entries the log keeps.
 *
 * A ring, because an unbounded log on the deployed build is an unbounded heap
 * for something that is a reading tool. The cap is stated in the panel when it is
 * reached: a truncated history that reads as a complete one is worse than no
 * history.
 */
export const SPINE_CAP = 200;

export const emptyTally = (): PressTally => ({
  presses: 0,
  live: 0,
  inert: 0,
  unattributed: 0,
  unlocated: 0,
});

export function createSpine(cap: number = SPINE_CAP): SpineState {
  return {
    cap,
    seq: 0,
    entries: [],
    dropped: 0,
    tally: emptyTally(),
    pressListening: false,
    noopWrites: 0,
    routeEvents: 0,
    pending: emptyPending(),
  };
}

/**
 * One step. Pure, so a test can drive a whole session without a DOM or a store.
 *
 * `flush` is not a fourth kind of event — it is the commit point. Everything
 * between two flushes is one task, which is what lets a press and the change it
 * caused share a line.
 */
export function spineReducer(state: SpineState, input: SpineInput): SpineState {
  switch (input.kind) {
    case 'store': {
      // The difference, not the notification. A deep-equal pair yields nothing —
      // and is counted, because "watched and it changed nothing" is a real state
      // with its own wording.
      const differences = diffTrees(input.after, input.before);
      if (differences.length === 0) {
        return { ...state, noopWrites: state.noopWrites + 1 };
      }
      return {
        ...state,
        pending: {
          ...state.pending,
          changes: [...state.pending.changes, { store: input.store, differences }],
        },
      };
    }

    case 'route':
      return {
        ...state,
        routeEvents: state.routeEvents + 1,
        pending: {
          ...state.pending,
          routes: [...state.pending.routes, { from: input.from, to: input.to, column: input.column }],
        },
      };

    case 'press':
      return {
        ...state,
        pending: { ...state.pending, presses: [...state.pending.presses, input] },
      };

    case 'listener':
      // Not an event and never a row: nothing happened in the app. It is a fact
      // about the reader, and the badge needs it to tell "nothing was pressed"
      // from "nothing was listening".
      return state.pressListening === input.attached ? state : { ...state, pressListening: input.attached };

    case 'flush': {
      if (isEmpty(state.pending)) return state;
      const seq = state.seq + 1;
      const rows = buildRows(seq, state.pending);
      return {
        ...state,
        seq,
        ...commitRows(state, rows),
        // Accumulated from the rows being committed, never re-read off the ring,
        // so an eviction cannot move a count nothing moved.
        tally: addTally(state.tally, tallyPresses(rows)),
        pending: emptyPending(),
      };
    }
  }
}

/**
 * Decide every press in a task, in one place.
 *
 * A press is credited only when the change it shares a task with is in **its own
 * column**. The comparison column renders the same screens from different tokens,
 * and a press on the left is not evidence about the right.
 *
 * The first productive press takes the credit; later presses in the same task are
 * `unattributed` rather than credited, so the live count cannot be inflated by a
 * control that fires twice.
 */
function verdictsFor(pending: Pending): PressVerdict[] {
  const productive = (press: PressFact) =>
    pending.routes.some((route) => route.column === press.column) || pending.changes.length > 0;

  // Nothing happened, so there is nothing to attribute. Every press is inert.
  if (!pending.presses.some(productive)) return pending.presses.map(() => 'inert');

  let credited = false;
  return pending.presses.map((press) => {
    if (!productive(press)) return 'inert';
    if (credited) return 'unattributed';
    credited = true;
    return 'live';
  });
}

/**
 * One task becomes one row per press **and** one row per route, shared when
 * there is one of each.
 *
 * The common case is the one the talk could not show: one press, one route, one
 * state change, all in the same synchronous task, drawn as one line. Four of the
 * seven push edges are exactly that.
 *
 * When a task holds two presses, they become two rows — crediting both would
 * inflate the live count, and merging them would hide that two presses happened
 * at all. When it holds two routes, same reasoning from the other side: the route
 * tally counts events, so a list that collapsed two of them into one row would
 * disagree with its own count, and a list that agrees with its own count proves
 * nothing.
 *
 * A task with no press at all still commits its rows: a scheme repaint that nobody
 * pressed is exactly the event the single-store log used to miss.
 */
function buildRows(seq: number, pending: Pending): SpineEntry[] {
  const verdicts = verdictsFor(pending);
  // At least one row: a task holding only a store difference is the common case
  // for the scheme repaint, and the redraw nobody pressed.
  const count = Math.max(1, pending.presses.length, pending.routes.length);

  return Array.from({ length: count }, (_, i) => {
    const press = pending.presses[i] ?? null;
    const first = i === 0;
    return {
      seq,
      press,
      // The change rides with the first row only. Attributing the same difference
      // to two rows would make the log claim two causes for one event.
      route: pending.routes[i] ?? null,
      changes: first ? pending.changes : [],
      verdict: press === null ? null : press.frame === null ? 'unlocated' : verdicts[i],
    };
  });
}

/**
 * Push rows into the ring, and count what fell off it.
 *
 * `dropped` counts rows rather than tasks so it lines up with what the reader can
 * see. A history that quietly loses its beginning while continuing to look
 * complete is the failure this exists to prevent, so the panel says so the moment
 * the cap is reached rather than at the end of the session.
 */
function commitRows(state: SpineState, added: SpineEntry[]): Pick<SpineState, 'entries' | 'dropped'> {
  const next = [...state.entries, ...added];
  const overflow = next.length - state.cap;
  return overflow > 0
    ? { entries: next.slice(overflow), dropped: state.dropped + overflow }
    : { entries: next, dropped: state.dropped };
}

/**
 * `habits.0.done.0` → `habits[0].done[0]`.
 *
 * The differ emits dotted paths because it was written for `tokens.json`, which
 * has no arrays. The state tree has six, so a bare path would read as machine
 * vocabulary while the reader is looking at a tree printed with real indices. This
 * is a formatter, not a second differ — the comparison above is still
 * `diffTrees`, unchanged.
 */
export function formatPath(path: string): string {
  return path.replace(/\.(\d+)(?=\.|$)/g, '[$1]');
}

/** What the log says about itself when it has nothing to show. */
export type LogCopy = { tone: Tone; label: string; detail: string };

/**
 * Three states, three strings, and no two of them alike.
 *
 * "Watching with nothing yet" and "not watching" are the pair that matters most:
 * collapse them and a reader who has not wired something up concludes the app is
 * idle. The compiler cannot hold this — types do not run — so the three strings
 * live in one table here and `test/spine.test.ts` asserts they stay distinct.
 */
export function describeLog(state: SpineState, attached: boolean): LogCopy {
  if (!attached) {
    return {
      tone: 'degraded',
      label: 'not watching',
      detail: 'the log has not attached to the store yet',
    };
  }

  if (state.entries.length > 0) {
    const changes = state.entries.reduce((n, e) => n + e.changes.length, 0);
    const kept = `${state.entries.length} row${state.entries.length === 1 ? '' : 's'} kept`;
    return {
      tone: 'ok',
      label: `${changes} change${changes === 1 ? '' : 's'} logged`,
      detail:
        state.dropped > 0
          ? `newest first · ${kept}, ${state.dropped} older dropped`
          : `newest first · ${kept}`,
    };
  }

  if (state.noopWrites > 0) {
    return {
      tone: 'degraded',
      label: 'watching · nothing found',
      detail: `${state.noopWrites} store write${state.noopWrites === 1 ? '' : 's'} changed no value`,
    };
  }

  return {
    tone: 'muted',
    label: 'watching · nothing yet',
    detail: 'no store write and no press since this page loaded',
  };
}

export type PressTally = {
  presses: number;
  live: number;
  inert: number;
  unattributed: number;
  /** Presses the studio could not attribute to a frame. A failed measurement. */
  unlocated: number;
};

/**
 * The board-chrome count.
 *
 * `unlocated` is counted apart from `inert` rather than folded in, and shares the
 * verdict's own name — one concept, one word, so a reader who sees `unlocated` in
 * a row and `unlocated` in a tally is looking at the same thing twice. A sound
 * decision function fed nothing by a broken reader is a defect this codebase has
 * already shipped once, and it presented as "nothing found".
 */
export function tallyPresses(entries: SpineEntry[]): PressTally {
  const tally = emptyTally();

  for (const entry of entries) {
    if (!entry.press) continue;
    const verdict = entry.verdict;
    if (verdict === null) throw new Error('Invalid press verdict.');
    switch (verdict) {
      case 'live':
      case 'inert':
      case 'unattributed':
      case 'unlocated':
        tally[verdict]++;
        break;
      default: {
        const invalid: never = verdict;
        throw new Error(`Invalid press verdict: ${String(invalid)}.`);
      }
    }
    tally.presses++;
  }

  return tally;
}

/** Two tallies summed. Used to accumulate at commit, so the ring cannot lose one. */
export function addTally(a: PressTally, b: PressTally): PressTally {
  return {
    presses: a.presses + b.presses,
    live: a.live + b.live,
    inert: a.inert + b.inert,
    unattributed: a.unattributed + b.unattributed,
    unlocated: a.unlocated + b.unlocated,
  };
}
