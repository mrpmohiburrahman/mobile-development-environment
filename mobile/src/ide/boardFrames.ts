/**
 * One way to find the board's frames, and one that reports when it found nothing.
 *
 * ## Why this module exists
 *
 * Three features need the same thing. The drift walk pairs the two columns. The
 * route panel counts the back controls actually rendered on the board. The render
 * verdict reads computed type styles off them. Each grew its own
 * `querySelector('#screen-' + key)` loop, and two of those three were written the
 * same night — which is how a mechanism that has already failed once acquired two
 * more copies of itself.
 *
 * Frames are found by the frame's **own DOM id** — `#screen-<key>` and
 * `#base-<key>`, from `nativeID` — and never by a custom `data-*` attribute,
 * because React Native Web filters unknown props off `View`. A `data-screen-key`
 * silently never reaches the document, and a walk that finds zero pairs while the
 * panel says the comparison has not run yet is the failure this repo already
 * shipped: benign-sounding, and completely wrong.
 *
 * ## Why it returns what it did not find
 *
 * The zero-count rule is the guard for this module's own failure mode. A reader
 * fed nothing cannot tell a quiet board from a broken reader, and a partial result
 * reported as a whole one is the same defect wearing a smaller hat. So every
 * answer carries `found`, `asked` and `missing`, and no caller can report a
 * comparison over fewer frames than the board has without it showing.
 *
 * Pure, and no runtime imports — the one import here is `import type`, which the
 * bundler and the type-stripping test runner both erase — so
 * `test/boardFrames.test.ts` can load it. It reaches the DOM only through the host
 * it is handed, which is also what lets the test drive it with an object that
 * resolves a given set of ids.
 */

import type { Column } from './spine.ts';

/** The id prefix of a frame in the current column, from `ScreenFrame`'s `nativeID`. */
export const FRAME_PREFIX = 'screen-';

/** The id prefix of a frame in the comparison column. */
export const BASELINE_PREFIX = 'base-';

/**
 * The DOM id of one frame. The board builds its ids here and nowhere else.
 *
 * "Here and nowhere else" is a claim about `Blueprint.tsx` as much as about this
 * file: the frame component takes its `nativeID` from this function rather than
 * from its own template literal, so a prefix renamed in one place cannot leave the
 * board's ids and the walks that look for them disagreeing. That disagreement is
 * silent — the walk finds zero frames and the panel reads as an un-run comparison.
 */
export const frameId = (key: string, baseline = false): string =>
  `${baseline ? BASELINE_PREFIX : FRAME_PREFIX}${key}`;

export type BoardFrame = { key: string; element: Element };

export type FramePair = { key: string; current: Element; baseline: Element };

/**
 * Which column of the board a frame belongs to.
 *
 * The spine's `Column`, re-exported rather than restated. Three modules named the
 * same two-value union in three places, and a fourth value added to one of them
 * would type-check against the other two — which is the drift this repo keeps
 * finding the hard way.
 */
export type FrameColumn = Column;

/**
 * A selector matching any frame on either column.
 *
 * The press listener needs a selector rather than resolved elements, because it
 * runs in the capture phase on whatever was actually pressed. The prefixes live
 * here so a second copy cannot be written with one of them wrong.
 */
export const frameSelector = (): string => `[id^="${FRAME_PREFIX}"], [id^="${BASELINE_PREFIX}"]`;

/** Read a frame's key and column back off its DOM id, or null if it is not one. */
export function parseFrameId(id: string): { key: string; column: FrameColumn } | null {
  if (id.startsWith(BASELINE_PREFIX)) return { key: id.slice(BASELINE_PREFIX.length), column: 'comparison' };
  if (id.startsWith(FRAME_PREFIX)) return { key: id.slice(FRAME_PREFIX.length), column: 'current' };
  return null;
}

/**
 * What a frame walk found, and what it was asked for.
 *
 * `found === asked` is the only claim of completeness any caller may make.
 */
export type ResolvedFrames = {
  frames: BoardFrame[];
  /** Keys the board was asked about that are not in the document. */
  missing: string[];
  found: number;
  asked: number;
};

export type ResolvedPairs = {
  pairs: FramePair[];
  /** Keys where one side mounted and the other did not. Not comparable. */
  unpaired: string[];
  found: number;
  asked: number;
};

/**
 * The requested column's frames.
 *
 * Iterates the caller's keys rather than whatever the document contains, so a
 * frame that failed to mount is *reported* rather than quietly dropped — and so
 * the order is the board's order rather than the DOM's.
 */
export function resolveFrames(host: unknown, keys: string[], column: Column = 'current'): ResolvedFrames {
  const frames: BoardFrame[] = [];
  const missing: string[] = [];

  for (const key of keys) {
    const element = query(host, `#${escape(frameId(key, column === 'comparison'))}`);
    if (element) frames.push({ key, element });
    else missing.push(key);
  }

  return { frames, missing, found: frames.length, asked: keys.length };
}

/**
 * Both columns, paired by key.
 *
 * A pair needs **both** sides. Half a pair is not a comparison, and returning it
 * would let a caller draw a verdict from one render — which is the one thing the
 * baseline mode exists not to do. Half-pairs are reported in `unpaired` so the
 * caller can say so rather than quietly having less to compare.
 */
export function resolveFramePairs(host: unknown, keys: string[]): ResolvedPairs {
  const pairs: FramePair[] = [];
  const unpaired: string[] = [];

  for (const key of keys) {
    const current = query(host, `#${escape(frameId(key))}`);
    const baseline = query(host, `#${escape(frameId(key, true))}`);
    if (current && baseline) pairs.push({ key, current, baseline });
    else unpaired.push(key);
  }

  return { pairs, unpaired, found: pairs.length, asked: keys.length };
}

/** `null` for anything that is not a node, which is what a null ref is. */
function query(host: unknown, selector: string): Element | null {
  const node = host as { querySelector?: (s: string) => Element | null } | null | undefined;
  if (typeof node?.querySelector !== 'function') return null;
  return node.querySelector(selector);
}

/**
 * Escape a key for use in an id selector.
 *
 * `CSS.escape` where the browser has it, and a conservative fallback where it
 * does not — which is `node --test`. Keys come from file names, so a key is not
 * guaranteed to be a bare identifier, and an unescaped one makes `querySelector`
 * throw, which here would be a blank panel rather than a reported failure.
 */
function escape(id: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(id);
  return id.replace(/([^\w-])/g, '\\$1');
}