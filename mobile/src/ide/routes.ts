/**
 * The route list: what the app can navigate to, and how each fact was learned.
 *
 * ## Why a list and not a diagram
 *
 * Seven nodes and eleven edges would fit a small radial. They would also be
 * useless, because the frames sit in a horizontally scrolling row under one
 * shared zoom: edges drawn between them cross every other frame and have to be
 * recomputed on every scroll. A list carrying from, to, kind, provenance and the
 * state change that moved is more useful, costs one panel, and does not lie about
 * geometry it cannot hold still.
 *
 * ## Provenance is mandatory, total, and visible
 *
 * Exactly three, and there is no fourth state:
 *
 * - `observed` — seen at the navigation seam. The seam records and returns; it is
 *   the one place every `navigate(...)` in the app already passes through.
 * - `declared` — read off the router's directory listing. Exists, never watched.
 * - `unresolved` — known to exist, cannot be enumerated. The back control
 *   resolves against history at press time, so there is no static edge to draw.
 *
 * A reader who sees a headline number is told how it was arrived at, so the
 * counts come before the list. A reader who saw "11 routes" with no breakdown
 * would believe the studio watched all eleven. It watches seven.
 *
 * ## Why a declared route may not carry a state change
 *
 * A declared route is inferred from a file on disk and has no observation window
 * around it. Pairing one with a measured difference would be a fabricated join —
 * the most confident-looking possible fabrication, because both halves are real
 * and only the connection is invented. `buildRouteList` enforces it, and
 * `test/routes.test.ts` feeds it a declared route carrying a change to prove the
 * enforcement is real rather than merely intended.
 *
 * ## Presses are not routes
 *
 * The tab bar reaches the router directly, behind a guard, in a file that must
 * stay byte-identical. Its presses are therefore *not* route changes this list
 * could observe, and its destinations are declared instead. Tapping a tab and the
 * press report disagreeing is not a curiosity — it is the two halves telling the
 * truth from opposite sides, and the panel says so.
 *
 * These pure functions import the pure router-key helpers at runtime.
 * Neither module requires React, a browser, or the token server to load.
 * `test/routes.test.ts` loads it directly with the type-stripping runner.
 */

import { tabKeys, routeOf, screenKeyOf } from './routerKeys.ts';
import type { Column, SpineEntry } from './spine.ts';
import type { Tone } from '../ds/reachability.ts';

/**
 * How a route came to be known.
 *
 * A union rather than a string, so a row cannot be constructed without one. The
 * compiler is not in CI, so the *runtime* table `ROUTE_PROVENANCE` is what
 * actually holds — and the panel iterates that table, so a value added here shows
 * up in the UI without anyone remembering to add a fourth badge.
 */
export type RouteProvenance = 'observed' | 'declared' | 'unresolved';

/** What the panel prints for a provenance, and the colour it prints it in. */
export type ProvenanceCopy = {
  /** The badge on a row. Short enough for a 300px panel. */
  label: string;
  tone: Tone;
  /** The section's own one-line explanation of how these routes were learned. */
  note: string;
  /** What the section says when it holds nothing. Never an empty field. */
  empty: string;
};

/**
 * The three provenances, as the one runtime table the panel renders from.
 *
 * `RoutePanel` maps over `ROUTE_PROVENANCES` and takes each section's heading,
 * colour, explanation and empty-state wording out of here, so this is not
 * documentation of the panel's behaviour — it *is* the panel's sections. A fourth
 * provenance added to the union without a row here has no badge, no section and no
 * count, and `test/routes.test.ts` fails on the mismatch rather than letting the
 * panel quietly drop it.
 */
export const ROUTE_PROVENANCE: Record<RouteProvenance, ProvenanceCopy> = {
  observed: {
    label: 'observed',
    tone: 'ok',
    note: 'seen at the navigation seam, so the studio watched this one happen',
    empty: 'none yet — press a card or an avatar on the board',
  },
  declared: {
    label: 'declared',
    tone: 'muted',
    note: 'read off the router directory, so the studio knows they exist without ever having watched one',
    empty: 'the router directory lists no destination this section could declare',
  },
  unresolved: {
    label: 'unresolved',
    tone: 'degraded',
    note: 'a control that navigates, but decides where at press time, so there is no static edge to draw',
    empty: 'no control on the board navigates in a way the studio cannot enumerate',
  },
};

/** The table's keys, in the order the panel renders its sections. */
export const ROUTE_PROVENANCES = Object.keys(ROUTE_PROVENANCE) as RouteProvenance[];

export type RouteRow = {
  /** The screen key the change left, `(tabs)` for the tab bar, or null. */
  from: string | null;
  to: string;
  provenance: RouteProvenance;
  /** Which column the change was seen in. `null` for a declared row. */
  column: Column | null;
  /** True only when a measured difference rode along with the route. */
  carriedChange: boolean;
  /** The paths that moved. Never populated on a declared row. */
  paths: string[];
};

/**
 * A control that navigates in some way the studio cannot enumerate.
 *
 * Reported rather than drawn. The back control is a real route — it goes
 * somewhere — but *where* is decided by the history stack at press time, so a
 * static list would be a fabrication and an empty row would read as "there are
 * none".
 */
export type RouteGap = {
  control: string;
  /** How many are on the board right now, or null when the studio could not tell. */
  count: number | null;
  provenance: RouteProvenance;
  reason: string;
  /**
   * Frames that did not mount when the count was taken.
   *
   * Carried rather than discarded, because a count read over five of seven frames
   * is not a count of the board. The gap reports what it measured; this says how
   * much board it measured it on.
   */
  missingFrom: string[];
};

/** The counts, which lead the list. */
export type RouteCounts = {
  observed: number;
  declared: number;
  unresolved: number;
  /** How many observed rows the list itself holds. The cross-check, not the claim. */
  listed: number;
};

/**
 * The four tab destinations, declared from the router directory.
 *
 * `from` is the tab bar rather than a screen key, because the tab bar is present
 * on four screens and the directory listing cannot say which one a press came
 * from. Saying "from a screen" would be a guess; saying "from the tab bar" is the
 * truth.
 */
export function declaredTabRoutes(routerKeys: string[]): RouteRow[] {
  return tabKeys(routerKeys).map((key) => ({
    from: '(tabs)',
    to: routeOf(key),
    provenance: 'declared' as const,
    column: null,
    carriedChange: false,
    paths: [],
  }));
}

/**
 * The whole list, newest first, observed rows above declared ones.
 *
 * The panel wants the route just taken at the top and the static knowledge below
 * it, because the two have very different half-lives: an observed row is about
 * this session, a declared row is about the repository.
 */
export function buildRouteList(entries: SpineEntry[], routerKeys: string[] = []): RouteRow[] {
  const observed: RouteRow[] = [];

  for (const entry of entries) {
    if (!entry.route) continue;
    const paths = entry.changes.flatMap((change) => change.differences.map((d) => d.path));
    observed.push({
      from: entry.route.from,
      to: entry.route.to,
      // Every route the spine carries came through the seam, so this is observed
      // by construction rather than by a label somebody chose.
      provenance: 'observed',
      column: entry.route.column,
      carriedChange: paths.length > 0,
      paths,
    });
  }

  // Newest first, so the change just caused is the one on screen.
  observed.reverse();
  return [...observed, ...declaredTabRoutes(routerKeys)];
}

/**
 * Counts, and they lead the list.
 *
 * ## Why `observed` can be an argument rather than a filter
 *
 * A count derived from the list's own length can never disagree with the list, so
 * printing it proves nothing. The check that catches a list drawing routes it never
 * saw has to compare it against a number gathered somewhere else, and
 * `observedEvents` is that number: the seam's own tally, incremented as a route
 * passes through and never read back off the rows. Pass it and the headline is
 * independent. Omit it — a test, or a caller with no seam — and the count falls
 * back to the list.
 *
 * `listed` rides along so the disagreement is a comparison the panel prints rather
 * than a subtraction the reader performs.
 *
 * `unresolved` is the number of gap **controls** on the board, not the number of
 * unresolved edges — because the back control cannot be resolved at all. Reporting
 * it as a count of edges would report zero, and a gap shown as zero reads as
 * "there are none".
 */
export function routeCounts(rows: RouteRow[], gaps: RouteGap[] = [], observedEvents?: number): RouteCounts {
  const listed = rows.filter((r) => r.provenance === 'observed').length;
  return {
    observed: observedEvents ?? listed,
    declared: rows.filter((r) => r.provenance === 'declared').length,
    unresolved: gaps.reduce((n, gap) => n + (gap.count ?? 0), 0),
    listed,
  };
}

/**
 * The back control, as a gap.
 *
 * `count` is how many are rendered on the board right now, counted from the DOM by
 * the glyph the back bar draws. `null` when the studio could not look — which is
 * a different claim from zero and is worded differently.
 */
export function backGap(count: number | null, missingFrom: string[] = []): RouteGap {
  return {
    control: 'back',
    count,
    provenance: 'unresolved',
    reason: 'Back uses board-local history when pressed. Empty history has no destination.',
    missingFrom,
  };
}

export type GapCopy = { tone: Tone; measured: boolean; label: string; detail: string };

/**
 * Three renderings of a gap, and no two alike.
 *
 * "There are two back controls and the studio cannot draw them", "there are none
 * right now", and "the studio did not look" are three different facts. Collapsing
 * them is how a tool acquires false confidence while sounding helpful.
 */
export function describeBackGap(gap: RouteGap): GapCopy {
  if (gap.count === null) {
    return {
      tone: 'degraded',
      measured: false,
      label: 'back controls: not measured',
      detail: 'the studio could not count them, so this is not a claim about the app',
    };
  }

  if (gap.count === 0) {
    return {
      tone: 'muted',
      measured: true,
      label: 'back controls: 0 measured',
      detail: 'none are on the board right now; a control that never mounted is not counted',
    };
  }

  return {
    tone: 'degraded',
    measured: true,
    label: `back controls: ${gap.count} history-dependent`,
    detail: gap.reason,
  };
}

/** Which screens the studio never saw navigate away from, and which it did. */
export type ExitReport = {
  /**
   * Screen keys with no observed outgoing route, and no declared one either.
   *
   * Named as *not observed* rather than as exits. Absence of evidence is what this
   * list holds: `settings` really does push nowhere, and `login` really does
   * navigate to `/` — and until somebody presses on it, the studio cannot tell
   * those two apart. Claiming it could is how the first version of this reported
   * all seven screens as the app's exits on a fresh load, `login` among them.
   */
  unobserved: string[];
  /** Tab screens. Their exits are declared from the router directory, not watched. */
  viaTabBar: string[];
  /** Screens the seam saw navigate away from. Evidence, not inference. */
  observedExits: string[];
  /** Whether the seam has seen a route change at all, so the lists above mean anything. */
  measured: boolean;
};

/**
 * The board's screens, split by what the studio knows about their exits.
 *
 * Three buckets rather than one list, because they rest on different evidence. A
 * tab screen has exits the directory listing proves; an observed screen has exits
 * the seam watched; everything else has neither, and "neither" is not "none".
 *
 * `ide` is excluded: the studio is a route of this app rather than a screen of it,
 * and it is not on the board.
 */
export function exitReport(rows: RouteRow[], routerKeys: string[], observedEvents = 0): ExitReport {
  const keys = [...new Set(routerKeys.map(screenKeyOf))].filter((key) => key !== 'ide').sort();
  const onTabBar = new Set(tabKeys(routerKeys).map(screenKeyOf));
  const sawExit = new Set(
    rows.filter((r) => r.provenance === 'observed' && r.from !== null && r.from !== '(tabs)').map((r) => r.from as string),
  );

  const viaTabBar = keys.filter((key) => onTabBar.has(key));
  const observedExits = keys.filter((key) => sawExit.has(key));
  const unobserved = keys.filter((key) => !onTabBar.has(key) && !sawExit.has(key));

  return { unobserved, viaTabBar, observedExits, measured: observedEvents > 0 || observedExits.length > 0 };
}

/** One frame's connections, for the panel's highlight-a-frame view. */
export type FrameRoutes = {
  /** Observed rows that left this frame. */
  observed: RouteRow[];
  /** Declared tab destinations, present only when this frame hosts the tab bar. */
  declared: RouteRow[];
  /** True when the frame is in the tab group, so it has exits the studio declared. */
  hostsTabBar: boolean;
  /**
   * The board's unresolvable controls.
   *
   * Passed through for every frame rather than attributed to one: the back control
   * is counted board-wide from the glyph it draws, so the studio cannot say which
   * frames carry one, and picking a frame would be a guess. The panel says so.
   */
  gaps: RouteGap[];
};

/**
 * The routes out of one frame.
 *
 * What makes highlighting a frame useful rather than decorative: a reader who wants
 * one screen's connections gets that screen's connections, and gets told which of
 * them were watched and which were read off a directory. A frame on the tab bar has
 * four declared exits and possibly some observed ones; a frame that is not has only
 * what the seam saw, which on a fresh load is nothing at all.
 */
export function routesOutOf(
  rows: RouteRow[],
  key: string,
  routerKeys: string[],
  gaps: RouteGap[] = [],
): FrameRoutes {
  const hostsTabBar = tabKeys(routerKeys).map(screenKeyOf).includes(key);
  return {
    observed: rows.filter((r) => r.provenance === 'observed' && r.from === key),
    declared: hostsTabBar ? rows.filter((r) => r.provenance === 'declared') : [],
    hostsTabBar,
    gaps,
  };
}