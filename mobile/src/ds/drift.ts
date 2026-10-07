/**
 * Drift, as the difference between two token trees.
 *
 * ## What this is, and what it is not
 *
 * It compares two *renders* of the same components against two *token sets*. It
 * is not a pixel diff of two screenshots, and nothing here or in the UI should be
 * described that way: a pixel diff would flag the zoom level, whichever font
 * happened to load, and antialiasing as drift, none of which are drift in the
 * design system.
 *
 * The comparison is done on the token trees rather than on rendered output, which
 * is both cheaper and the more honest answer — it names the *token* that drifted
 * rather than the pixel that moved as a consequence. The two renders exist so the
 * drift is *visible*, not so it can be measured; measuring it needs only the
 * trees.
 *
 * ## Why it lives here and not in the token server
 *
 * Two reasons, both forcing. Metro's project root is `mobile/`, so app code cannot
 * import from `token-server/`. And the current tree includes the in-memory
 * override layer, which only exists in this process — the server has no idea what
 * is unsaved. So the server's whole job is `GET /baseline`, handing over the
 * committed tree; the comparison is done here, once, with no second
 * implementation to keep in step.
 *
 * The walkers are borrowed from `renderSource.ts` rather than reimplemented, so
 * the path set the comparison iterates is by construction the path set the render
 * can read.
 *
 * No runtime imports, so `test/drift.test.ts` can load it.
 */

import { leafPaths, readPath } from './renderSource.ts';

/** How one path differs between the current tree and the committed baseline. */
export type DifferenceKind = 'changed' | 'added' | 'removed';

export type Difference = {
  path: string;
  kind: DifferenceKind;
  /** The value now. `undefined` when the token was removed. */
  current: unknown;
  /** The value at HEAD. `undefined` when the token was added since. */
  baseline: unknown;
};

export type FamilyGroup = {
  family: string;
  count: number;
  differences: Difference[];
};

/**
 * NaN is not equal to itself, so a plain `===` would report permanent phantom
 * drift on any token that had ever held one.
 */
const sameValue = (a: unknown, b: unknown) => a === b || (Number.isNaN(a) && Number.isNaN(b));

/**
 * Compare the current tree against the committed baseline.
 *
 * `current` is `base + overrides` — what the app shows right now, including edits
 * not yet committed. `baseline` is `HEAD`. An edit made seconds ago and never
 * committed *is* drift, which is the point: that is what "uncommitted" means.
 *
 * A path in one tree and absent from the other is reported as `added` or
 * `removed` rather than skipped. A new token nobody committed is exactly as much
 * drift as one whose value moved, and skipping it would lose a whole class of
 * the thing the tool exists to report.
 *
 * Sorted by path so two runs over the same trees are comparable: a drift list
 * that reorders itself is hard to read and harder to diff.
 */
export function diffTrees(current: unknown, baseline: unknown): Difference[] {
  const paths = [...new Set([...leafPaths(current), ...leafPaths(baseline)])].sort();
  const differences: Difference[] = [];

  for (const path of paths) {
    const now = readPath(current, path);
    const was = readPath(baseline, path);
    const here = now !== undefined;
    const there = was !== undefined;

    if (here && !there) {
      differences.push({ path, kind: 'added', current: now, baseline: undefined });
    } else if (!here && there) {
      differences.push({ path, kind: 'removed', current: undefined, baseline: was });
    } else if (!sameValue(now, was)) {
      differences.push({ path, kind: 'changed', current: now, baseline: was });
    }
  }

  return differences;
}

/** True when the two trees render identically. */
export function isInSync(current: unknown, baseline: unknown): boolean {
  return diffTrees(current, baseline).length === 0;
}

/**
 * Group differences by family so the UI can say "3 colours, 1 spacing" rather than
 * listing paths. Derived from the first segment, which is how `tokens.json` is
 * organised and how the validation rules are keyed too.
 *
 * Largest group first, ties broken alphabetically, so the order is stable between
 * runs rather than following object key insertion.
 */
export function groupByFamily(differences: Difference[]): FamilyGroup[] {
  const groups = new Map<string, Difference[]>();
  for (const diff of differences) {
    const family = diff.path.split('.')[0];
    const bucket = groups.get(family);
    if (bucket) bucket.push(diff);
    else groups.set(family, [diff]);
  }
  return [...groups.entries()]
    .map(([family, diffs]) => ({ family, count: diffs.length, differences: diffs }))
    .sort((a, b) => b.count - a.count || a.family.localeCompare(b.family));
}

/** How many leaf tokens a tree holds, for the "N compared" line. */
export function leafCount(tree: unknown): number {
  return leafPaths(tree).length;
}