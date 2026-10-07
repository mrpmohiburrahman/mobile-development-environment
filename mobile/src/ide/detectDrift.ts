/**
 * Which screens drifted, found by comparing the two renders' computed styles.
 *
 * ## Why this exists in this shape
 *
 * "Flags the ones that differ" needs to know which tokens a screen consumes, and
 * there is no way to know that without static analysis — which property 1 of the
 * brief forbids, correctly. So detection happens at render time: draw each screen
 * from the current tokens and from `HEAD`, walk both DOM subtrees in parallel, and
 * compare the properties a token could possibly have moved.
 *
 * The comparison is over **computed styles**, not class names. RNW 0.21 and React
 * 19 generate their own class names and comparing class strings is meaningless.
 * And only token-movable properties are read, so layout noise the two renders may
 * produce nondeterministically is ignored rather than reported as drift.
 *
 * ## Naming the token
 *
 * Attribute is by **value matching**, and the module says so plainly because it
 * is not a proven causal chain. For a property that differs, if one drifted token
 * has a current value equal to the current render's value *and* a baseline value
 * equal to the baseline render's, that token is the best explanation available
 * without static analysis. It is a strong signal, not a proof: two tokens holding
 * the same value would be indistinguishable, and the module returns no token at
 * all rather than a guess it cannot support.
 *
 * The value pairs are always shown too, so a reader can check the attribution
 * rather than trust it.
 *
 * Pure and DOM-free, so `test/detectDrift.test.ts` can load it.
 */

import { diffTrees, type Difference } from '../ds/drift.ts';

/**
 * The only computed properties a token in `tokens.json` can move.
 *
 * Deliberately short. Adding a property the tokens cannot affect would report
 * renderer differences as drift, and "this screen differs" has to mean something
 * specific or it is noise.
 */
export const TOKEN_PROPERTIES = [
  // color.* — and the scheme-switched ones
  'color',
  'backgroundColor',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
  // space.*
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'gap',
  // radius.*
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomRightRadius',
  'borderBottomLeftRadius',
  // type.*
  'fontSize',
  'lineHeight',
  'letterSpacing',
  'fontWeight',
  // elevation.*
  'boxShadow',
] as const;

export type TokenProperty = (typeof TOKEN_PROPERTIES)[number];

/** A flat snapshot of one node: the token-movable properties, read once. */
export type StyleRecord = Partial<Record<TokenProperty, string>>;

/** One property that differs between the two renders. */
export type StyleDifference = {
  property: TokenProperty;
  current: string;
  baseline: string;
  /**
   * The drifted token this value pair most likely came from, or null when no
   * single token explains both sides. Null is a real answer, not a failure.
   */
  token: string | null;
};

/**
 * Read the token-movable properties off one DOM node.
 *
 * `getComputedStyle` is the only source of truth here. Class names are ignored
 * entirely.
 */
export function readStyle(el: Element): StyleRecord {
  const computed = getComputedStyle(el);
  const record: StyleRecord = {};
  for (const property of TOKEN_PROPERTIES) {
    record[property] = computed[property];
  }
  return record;
}

/** Normalise a CSS value so `rgb()` and `#RRGGBB` compare equal. */
/**
 * Canonicalise a box-shadow's *serialisation*, not its content.
 *
 * The browser prints the colour first (`rgba(35, 25, 20, 0.05) 0px 1px 2px 0px`)
 * while the token file writes it last (`0px 1px 2px 0px rgba(35,25,20,0.05)`).
 * Those are the same shadow, so comparing the strings would leave every
 * elevation difference unattributed for a reason that has nothing to do with
 * design drift. Splitting each layer into its colour and its lengths and
 * re-emitting in one order makes the two comparable.
 */
/**
 * Split one layer into parts on whitespace at paren depth 0.
 *
 * Plain `split(/\s+/)` is wrong here: the browser serialises
 * `rgba(35, 25, 20, 0.05)` with spaces after the commas, so splitting on
 * whitespace tore a single colour into four fragments — and the colour then
 * matched no pattern and fell through to "a keyword". Both sides went through it
 * and the two serialisations still differed.
 */
function splitLayerParts(layer: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of layer) {
    if (char === '(') depth++;
    else if (char === ')') depth--;
    if (/\s/.test(char) && depth === 0) {
      if (current) parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  if (current) parts.push(current);
  return parts;
}

export function normalizeShadowValue(value: string): string {
  const layers = splitShadowLayers(String(value ?? ''));
  return layers
    .map((layer) => {
      const parts = splitLayerParts(layer.trim());
      const colors: string[] = [];
      const lengths: string[] = [];
      const keywords: string[] = [];

      for (const part of parts) {
        if (/^(?:rgba?|hsla?|color)\(/i.test(part) || part.startsWith('#')) {
          colors.push(part.replace(/\s+/g, '').toLowerCase());
        } else if (/^-?(?:\d+\.?\d*|\.\d+)(?:px|rem|em|%)?$/.test(part)) {
          lengths.push(normalizeValue('length', part));
        } else {
          keywords.push(part.toLowerCase());
        }
      }
      return [...colors, ...keywords, ...lengths].join(' ');
    })
    .join(', ');
}

/**
 * Split a box-shadow on top-level commas only. `rgba(35,25,20,0.05)` has three
 * commas of its own, and every elevation in this file has one.
 */
function splitShadowLayers(value: string): string[] {
  const layers: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of value) {
    if (char === '(') depth++;
    else if (char === ')') depth--;
    if (char === ',' && depth === 0) {
      layers.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  layers.push(current);
  return layers;
}

export function normalizeValue(property: string, value: string): string {
  const trimmed = String(value ?? '').trim();
  if (trimmed === '') return '';
  if (property === 'boxShadow') return normalizeShadowValue(trimmed);

  // getComputedStyle resolves 400 to `normal` and 700 to `bold`, while the token
  // file holds "400" and "700". Mapped back to the numeric form rather than
  // skipped, because skipping would silently hide every font-weight drift — the
  // one family where the browser's own vocabulary differs from the file's.
  if (property === 'fontWeight') {
    if (trimmed === 'normal') return '400';
    if (trimmed === 'bold') return '700';
    // Returned as-is rather than falling through: the length rule below would
    // canonicalise the bare number 700 into "700px", which is not a weight.
    if (/^[1-9]00$/.test(trimmed)) return trimmed;
  }

  // Colours come back as rgb()/rgba() from getComputedStyle regardless of how
  // they were authored, so they are already comparable. Normalising hex keeps a
  // token's authored value matchable against a rendered one.
  if (/^(color|backgroundColor|border\w*Color)$/.test(property)) {
    const hex = /^#([0-9a-f]{3,8})$/i.exec(trimmed);
    if (hex) return trimmed.toLowerCase();
    return trimmed.toLowerCase().replace(/\s+/g, '');
  }

  // Lengths. Always canonicalised to px, in *both* directions: getComputedStyle
  // reports `16px` while the token file holds the bare number `16`, so a
  // comparison has to fold them together. Canonicalising only the unitless case
  // would have left `16` and `16px` as different strings, which silently
  // defeated attribution for every numeric token.
  const length = /^(-?(?:\d+\.?\d*|\.\d+))(px)?$/.exec(trimmed);
  if (length) return `${parseFloat(length[1])}px`;

  return trimmed;
}

/**
 * The token whose value pair matches both sides of a style difference.
 *
 * Returns null rather than the closest candidate. A confident wrong token name
 * would be worse than none: the tool's whole claim is that its output can be
 * trusted.
 */
export function attributeToToken(difference: StyleDifference, drift: Difference[]): string | null {
  const now = normalizeValue(difference.property, difference.current);
  const was = normalizeValue(difference.property, difference.baseline);

  const matches = drift.filter(
    (d) =>
      normalizeValue(difference.property, String(d.current)) === now &&
      normalizeValue(difference.property, String(d.baseline)) === was,
  );

  // More than one explanation means the value pairs are ambiguous. Say so.
  if (matches.length !== 1) return null;
  return matches[0].path;
}

/** Compare two nodes' styles, attributing each difference to a token. */
export function compareStyles(current: StyleRecord, baseline: StyleRecord, drift: Difference[]): StyleDifference[] {
  const differences: StyleDifference[] = [];

  for (const property of TOKEN_PROPERTIES) {
    const a = normalizeValue(property, current[property] ?? '');
    const b = normalizeValue(property, baseline[property] ?? '');

    if (a === '' && b === '') continue;
    if (a === b) continue;

    const difference: StyleDifference = { property, current: a, baseline: b, token: null };
    differences.push({ ...difference, token: attributeToToken(difference, drift) });
  }

  return differences;
}

/**
 * The token families a property could possibly come from.
 *
 * Used to explain a difference the attribution could not name, so a reader still
 * learns something: "colour, unattributed" is more useful than a bare property.
 */
const PROPERTY_FAMILY: Record<TokenProperty, string> = {
  color: 'color',
  backgroundColor: 'color',
  borderTopColor: 'color',
  borderRightColor: 'color',
  borderBottomColor: 'color',
  borderLeftColor: 'color',
  paddingTop: 'space',
  paddingRight: 'space',
  paddingBottom: 'space',
  paddingLeft: 'space',
  marginTop: 'space',
  marginRight: 'space',
  marginBottom: 'space',
  marginLeft: 'space',
  gap: 'space',
  borderTopLeftRadius: 'radius',
  borderTopRightRadius: 'radius',
  borderBottomRightRadius: 'radius',
  borderBottomLeftRadius: 'radius',
  fontSize: 'type',
  lineHeight: 'type',
  letterSpacing: 'type',
  fontWeight: 'type',
  boxShadow: 'elevation',
};

export function familyOfProperty(property: TokenProperty): string {
  return PROPERTY_FAMILY[property];
}

/**
 * Walk two subtrees in parallel, comparing each paired node.
 *
 * Pairing is by position, which is only sound because both trees were rendered
 * from the same components: identical structure, differing only in tokens. A
 * mismatch in node count is reported rather than silently truncated, because a
 * structural difference would invalidate every pairing after it.
 *
 * The browser-only half of ticket 10. Everything it decides is in
 * `compareStyles`, which is where the tests are.
 */
export function detectDriftInSubtrees(
  currentRoot: Element,
  baselineRoot: Element,
  drift: Difference[],
): { differences: StyleDifference[]; nodesCompared: number; structureMismatch: boolean } {
  const differences: StyleDifference[] = [];
  let nodesCompared = 0;
  let structureMismatch = false;

  const currentNodes = [currentRoot, ...currentRoot.querySelectorAll('*')];
  const baselineNodes = [baselineRoot, ...baselineRoot.querySelectorAll('*')];

  if (currentNodes.length !== baselineNodes.length) {
    structureMismatch = true;
  }

  const count = Math.min(currentNodes.length, baselineNodes.length);
  for (let i = 0; i < count; i++) {
    nodesCompared++;
    differences.push(...compareStyles(readStyle(currentNodes[i]), readStyle(baselineNodes[i]), drift));
  }

  return { differences, nodesCompared, structureMismatch };
}

/**
 * Reduce a node-by-node comparison to the properties that differ, with a count of
 * how many nodes showed each.
 *
 * A screen with fifty matching nodes and one different is *one* thing wrong, and
 * listing it fifty times would bury the signal.
 */
export function summariseDifferences(
  differences: StyleDifference[],
): { property: TokenProperty; family: string; token: string | null; current: string; baseline: string; nodes: number }[] {
  const byProperty = new Map<TokenProperty, StyleDifference & { nodes: number }>();

  for (const diff of differences) {
    const existing = byProperty.get(diff.property);
    if (existing) existing.nodes++;
    else byProperty.set(diff.property, { ...diff, nodes: 1 });
  }

  return [...byProperty.values()]
    .map(({ property, token, current, baseline, nodes }) => ({
      property,
      family: familyOfProperty(property),
      token,
      current,
      baseline,
      nodes,
    }))
    .sort((a, b) => b.nodes - a.nodes || a.property.localeCompare(b.property));
}

/** Drift for the whole token file, which the attribution needs as its vocabulary. */
export function driftVocabulary(current: unknown, baseline: unknown): Difference[] {
  return diffTrees(current, baseline);
}