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
 * Pure, and no runtime imports, so `test/routes.test.ts` can load it.
 */

import { tabKeys, routeOf, screenKeyOf } from './routerKeys.ts';
import type { Column, SpineEntry } from './spine.ts';
import type { Tone } from '../ds/reachability.ts';

/**
 * How a route came to be known.
 *
 * A union rather than a string, so a row cannot be constructed without one. The
 * compiler is not in CI, so the *runtime* table `ROUTE_PROVENANCE` is what
 * actually holds — and the panel iterates it, so a value added here shows up in
 * the UI without anyone remembering to add a fourth badge.
 */
export type RouteProvenance = 'observed' | 'declared' | 'unresolved';

export const ROUTE_PROVENANCE: readonly RouteProvenance[] = ['observed', 'declared', 'unresolved'];

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
};

/** The counts, which lead the list. */
export type RouteCounts = { observed: number; declared: number; unresolved: number };

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
 * `unresolved` is the number of gap **controls** on the board, not the number of
 * unresolved edges — because the back control cannot be resolved at all. Reporting
 * it as a count of edges would report zero, and a gap shown as zero reads as
 * "there are none".
 */
export function routeCounts(rows: RouteRow[], gaps: RouteGap[] = []): RouteCounts {
  return {
    observed: rows.filter((r) => r.provenance === 'observed').length,
    declared: rows.filter((r) => r.provenance === 'declared').length,
    unresolved: gaps.reduce((n, gap) => n + (gap.count ?? 0), 0),
  };
}

/**
 * The back control, as a gap.
 *
 * `count` is how many are rendered on the board right now, counted from the DOM by
 * the glyph the back bar draws. `null` when the studio could not look — which is
 * a different claim from zero and is worded differently.
 */
export function backGap(count: number | null): RouteGap {
  return {
    control: 'back',
    count,
    provenance: 'unresolved',
    reason: 'resolves against history at press time, so the studio cannot draw it as an edge',
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
    label: `back controls: ${gap.count} unresolvable`,
    detail: gap.reason,
  };
}

/**
 * Screens with no outgoing route at all, named.
 *
 * A screen with exits of its own needs no such note; a screen without them is
 * where the app's exits are, and leaving it as an absent row makes that
 * unreadable. `settings` is pushed to and pushes nowhere — that is a fact about
 * the app worth being able to see.
 */
export function screensWithoutExits(rows: RouteRow[], routerKeys: string[]): string[] {
  const sources = new Set(rows.filter((r) => r.from !== null).map((r) => r.from as string));
  return routerKeys
    .map(screenKeyOf)
    .filter((key) => !sources.has(key) && key !== 'ide')
    .sort();
}