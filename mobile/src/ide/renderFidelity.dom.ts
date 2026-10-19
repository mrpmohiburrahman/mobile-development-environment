import { REFERENCES, parseFontStack, type CandidateProbe, type ObservedType } from './renderFidelity.ts';
import type { BoardFrame } from './boardFrames.ts';

/**
 * The browser half of the render verdict: gather facts, decide nothing.
 *
 * Every decision — what a measurement means, what to call an absent family, what
 * counts as verified — lives in `renderFidelity.ts` and is tested there. This file
 * holds no opinions at all, which is the same split `detectDrift.ts` uses and for
 * the same reason: a reader that cannot be tested can only be trusted by the panel
 * that consumes it, and a panel consuming a broken reader looks exactly like a
 * panel reporting nothing found.
 *
 * So every function here reports how much it observed, and returns `null` when it
 * observed nothing. Nothing here needs a driver, a rasterisation library, or a
 * dependency of any kind — which is the constraint that keeps this work from
 * turning into the screenshot suite it declines to build.
 */

export const BUNDLED_FONT_FAMILY = 'Spline Sans';
export const BUNDLED_FONT_WEIGHTS = [400, 600, 700] as const;

export async function loadBundledFontWeights(): Promise<number[]> {
  if (typeof document === 'undefined' || !document.fonts?.load) return [...BUNDLED_FONT_WEIGHTS];
  try {
    const results = await Promise.allSettled(
      BUNDLED_FONT_WEIGHTS.map((weight) => document.fonts.load(`${weight} 16px "${BUNDLED_FONT_FAMILY}"`)),
    );
    await document.fonts.ready;
    return results.flatMap((result, index) =>
      result.status === 'rejected' || result.value.length === 0 || result.value.some((face) => face.status !== 'loaded')
        ? [BUNDLED_FONT_WEIGHTS[index]]
        : [],
    );
  } catch {
    return [...BUNDLED_FONT_WEIGHTS];
  }
}

/**
 * The string every candidate is measured with.
 *
 * Long enough that a width difference cannot be sub-pixel rounding, and full of
 * the characters that distinguish typefaces: ascenders, descenders, and the
 * figures whose default widths differ most between faces.
 */
const TEST_STRING = 'Handgloves 0123 — the quick brown fox jumps';

/**
 * One hidden span, reused.
 *
 * Off-screen rather than `display: none`, because a non-rendered element has no
 * measurable width and the whole method would report zero for everything — the
 * most symmetric, most confidently wrong answer available.
 *
 * The first version of this forgot the test string. Every measurement came back
 * zero, `measure` reported `null`, and the verdict printed **not measured** — which
 * is the one thing it is allowed to print without a reader having found anything.
 * It was caught by hand, not by a test, because a DOM reader cannot be tested
 * under `node --test`. That is why the zero it returns is a distinct state and not
 * a quiet "nothing found".
 */
let probe: HTMLElement | null = null;

function ensureProbe(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  if (probe?.isConnected) return probe;

  const el = document.createElement('span');
  el.setAttribute('aria-hidden', 'true');
  el.textContent = TEST_STRING;
  Object.assign(el.style, {
    position: 'absolute',
    left: '-9999px',
    top: '0',
    whiteSpace: 'nowrap',
    fontSize: '64px',
    fontWeight: '400',
    letterSpacing: '0',
    // A web font of the candidate's own would be the thing being measured, so the
    // probe must not wait for one. `document.fonts` is never consulted: font
    // *loading* is a timing question this is explicitly not asking.
    visibility: 'hidden',
  } as Partial<CSSStyleDeclaration>);

  document.body.appendChild(el);
  probe = el;
  return el;
}

const measure = (family: string): number | null => {
  const el = ensureProbe();
  if (!el) return null;
  el.style.fontFamily = family;
  const width = el.getBoundingClientRect().width;
  return Number.isFinite(width) && width > 0 ? width : null;
};

/** Quote a family name so a multi-word name is one family. */
const quoted = (family: string) => `"${family.replace(/"/g, '')}"`;

/**
 * Measure every named candidate in a stack, each against both references.
 *
 * Two measurements per candidate plus one per reference. Each candidate is
 * rendered twice — once with each reference as its fallback — because a single
 * measurement cannot distinguish "not installed" from "happens to share the
 * reference's metrics", and one reference is how a tool gets confidently wrong.
 *
 * Returns `[]` when there is no DOM or no measurable node. That is a count of
 * zero, and the verdict renders it as *not measured* rather than as nothing found.
 */
export function probeFontCandidates(families: string[]): CandidateProbe[] {
  if (typeof document === 'undefined') return [];

  const referenceWidths: Record<string, number> = {};
  for (const reference of REFERENCES) {
    const width = measure(reference);
    if (width === null) return [];
    referenceWidths[reference] = width;
  }

  const probes: CandidateProbe[] = [];
  for (const family of families) {
    const widths: Record<string, number> = {};
    let measurable = true;
    for (const reference of REFERENCES) {
      const width = measure(`${quoted(family)}, ${reference}`);
      if (width === null) {
        measurable = false;
        break;
      }
      widths[reference] = width;
    }
    if (measurable) probes.push({ family, widths, referenceWidths });
  }

  return probes;
}

/**
 * Read the computed type values off every text-bearing node inside each frame.
 *
 * Only nodes that hold their own text. A container inherits its font from the
 * nearest ancestor, so counting it would inflate every sample size with nodes that
 * say nothing about the type scale.
 *
 * The four properties read below are `TYPE_PROPERTIES`, spelled out as an object
 * literal because a dynamically-built one would lose the `ObservedType['style']`
 * type that makes the decision function's reads safe. `test/mechanisms.test.ts`
 * asserts the literal and the list still name the same four, so the shorthand
 * cannot drift away from the list the way a second copy would.
 *
 * `null` when there is no DOM, which the report renders as *not measured*.
 */
export function observeTypeStyles(frames: BoardFrame[]): ObservedType[] | null {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return null;

  const observed: ObservedType[] = [];
  for (const { key, element } of frames) {
    for (const node of [element, ...element.querySelectorAll('*')]) {
      if (!holdsText(node)) continue;
      const computed = getComputedStyle(node);
      observed.push({
        screen: key,
        style: {
          fontSize: computed.fontSize,
          lineHeight: computed.lineHeight,
          letterSpacing: computed.letterSpacing,
          fontWeight: computed.fontWeight,
        },
      });
    }
  }
  return observed;
}

export function observeFontStack(frames: BoardFrame[]): string[] {
  if (typeof getComputedStyle !== 'function') return [];
  for (const { element } of frames) {
    const text = [element, ...element.querySelectorAll('*')].find(holdsText);
    if (text) return parseFontStack(getComputedStyle(text).fontFamily);
  }
  return [];
}

const holdsText = (node: Element): boolean => {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === 3 && (child.textContent ?? '').trim() !== '') return true;
  }
  return false;
};

/** How many back controls the board is showing, or null when it could not tell. */
export function countBackControls(frames: BoardFrame[]): number | null {
  if (typeof document === 'undefined') return null;
  if (frames.length === 0) return null;

  // Counted by the glyph the back bar draws. It is the only signal in the rendered
  // DOM that identifies the control, and it is byte-identical app code the studio
  // is not allowed to tag — so this is the honest way to count them without
  // crossing the guard.
  let count = 0;
  for (const { element } of frames) {
    for (const node of element.querySelectorAll('*')) {
      if ((node.textContent ?? '').trim() === '‹') count++;
    }
  }
  return count;
}