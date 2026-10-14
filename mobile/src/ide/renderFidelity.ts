/**
 * What the browser actually rendered, decided from facts gathered elsewhere.
 *
 * ## The question
 *
 * The talk hedged its visual-regression idea behind a condition — *do I have
 * reasonable confidence that what is displayed here will be what's displayed on
 * mobile* — and the condition is checkable. Checking it is cheaper than either
 * building a pixel-diff suite or refusing one on taste, and it turns a judgement
 * into a number that can change when a web font ships.
 *
 * ## What the number says today
 *
 * The display stack names two families ahead of the system fallbacks. Neither is
 * installed on the machine this was written on, no `@font-face` is declared
 * anywhere in the app, and the type tokens carry no `fontFamily` at all — so the
 * stack resolves to the system face here, to a different face on a machine that
 * has the named family, and to a third on Linux. Three machines, three rasters,
 * one committed tree.
 *
 * That is worse than a font-loading race, which `document.fonts.ready` solves. It
 * is font *availability*: a per-machine property, already settled, that waiting
 * cannot move. It is also why the answer is a measurement rather than a
 * screenshot suite — every unique thing a pixel diff would catch is
 * font-dependent, and this app has no fixed typeface.
 *
 * ## How a family is judged
 *
 * By width. Render a test string in the candidate and in each of two
 * known-different references, and compare:
 *
 * - differs from every reference → **present**;
 * - matches every reference → **fell through** to its fallback;
 * - matches some → **unknown**. A family that coincidentally matched `serif`
 *   would otherwise be called absent on the strength of a coincidence.
 *
 * Two references rather than one, because one reference cannot distinguish "not
 * installed" from "happens to have the same metrics as the reference". One
 * reference is how a tool gets confidently wrong.
 *
 * ## The rules this module exists to hold
 *
 * - An unanswerable candidate reads as **unknown** or **unmeasured**, never as
 *   fine. A verdict that flatters itself is worse than no verdict.
 * - Every browser-gathered number arrives with a count, and zero never renders as
 *   "nothing found". A sound decision function fed nothing by a broken reader is
 *   a failure this codebase has already shipped once.
 * - No new dependency, here or in the server. If this ever needs a rasterisation
 *   library it has stopped being this work.
 *
 * Pure, and no runtime imports, so `test/renderFidelity.test.ts` can load it. The
 * browser half lives in `renderFidelity.dom.ts` and holds no decisions.
 */

import { normalizeValue } from './detectDrift.ts';

/**
 * The two families every candidate is measured against.
 *
 * Both always resolve, both are guaranteed to be present on every platform the
 * app runs on, and their metrics differ from each other's and from any normal
 * text face. That is the whole requirement: a reference has to be *known
 * different* for "same width as this" to mean anything.
 */
export const REFERENCES = ['monospace', 'serif'] as const;

/**
 * CSS-wide and platform keywords.
 *
 * These are not installable families. `system-ui` means "whatever this platform
 * uses", so probing it produces a number that looks like a measurement of
 * something it cannot measure, and calling it "present" would be true and
 * useless.
 */
const KEYWORDS = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'math',
  'emoji',
  'fangsong',
]);

export const isKeyword = (family: string): boolean => KEYWORDS.has(family.toLowerCase());

/**
 * Split a CSS font stack on top-level commas only.
 *
 * A plain `split(',')` would tear `Noto Color Emoji` into two candidates and then
 * report a verdict about a family nobody asked about. Quoted names lose their
 * quotes; that is presentation, not syntax.
 */
export function parseFontStack(stack: string): string[] {
  const out: string[] = [];
  let current = '';
  let quote: string | null = null;
  let depth = 0;

  for (const char of stack) {
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '(') depth++;
    else if (char === ')') depth--;
    else if (char === ',' && depth === 0) {
      push(out, current);
      current = '';
      continue;
    }
    current += char;
  }
  push(out, current);
  return out;
}

const push = (out: string[], value: string) => {
  const trimmed = value.trim();
  if (trimmed !== '') out.push(trimmed);
};

/** The two references, and the width each of them renders the test string at. */
const REFERENCE_WIDTHS = { monospace: 42, serif: 99 };

/**
 * What the browser measured for one candidate.
 *
 * `widths` is the candidate rendered once per reference *as its fallback*: if the
 * candidate is installed, the same face is measured every time and the numbers
 * match each other; if it is not, the numbers become the reference's own widths.
 * `referenceWidths` is what each reference renders alone, which is what turns
 * "the numbers match each other" into "the numbers match the fallback".
 */
export type CandidateProbe = {
  family: string;
  widths: Record<string, number>;
  referenceWidths?: Record<string, number>;
};

/**
 * What happened to one candidate in the stack.
 *
 * - `present` — measured, and it rendered itself rather than the fallback.
 * - `fell-through` — measured, and it rendered its fallback instead.
 * - `unknown` — measured, and the result was inconclusive.
 * - `unmeasured` — never measured. Not evidence of anything.
 * - `keyword` — a platform keyword, which always resolves and names no family.
 */
export type FontFate = 'present' | 'fell-through' | 'unknown' | 'unmeasured' | 'keyword';

export type FontCandidate = {
  family: string;
  fate: FontFate;
  /** Exactly one entry carries this, and only when something was measured. */
  winner?: boolean;
};

export function judgeCandidates(stack: string[], probes: CandidateProbe[]): FontCandidate[] {
  const byFamily = new Map(probes.map((p) => [p.family, p]));

  const judged = stack.map((family) => ({
    family,
    fate: judge(family, byFamily.get(family)),
  }));

  // The first family that is really there. A keyword cannot win over a real
  // family: if Spline Sans is installed, it is what renders, whatever sits behind
  // it in the stack.
  const firstPresent = judged.find((c) => c.fate === 'present');
  const winner = firstPresent ?? judged.find((c) => c.fate === 'keyword');
  const measuredSomething = judged.some((c) => c.fate === 'present' || c.fate === 'fell-through');

  // A stack where nothing was probed has no winner. Naming one anyway would be the
  // most confident possible lie.
  if (!measuredSomething) return judged;

  return judged.map((c) => ({ ...c, winner: c === winner }));
}

function judge(family: string, probe: CandidateProbe | undefined): FontFate {
  if (isKeyword(family)) return 'keyword';
  if (!probe) return 'unmeasured';

  const references = probe.referenceWidths ?? REFERENCE_WIDTHS;
  const identical = REFERENCES.filter((ref) => probe.widths[ref] === references[ref]);

  // Equal to every reference: the browser had nothing named here and used the
  // fallback each time. The widths then differ from each other — which is
  // precisely why two references are needed to tell the two cases apart.
  if (identical.length === REFERENCES.length) return 'fell-through';
  // Equal to none: the candidate rendered itself whichever fallback followed.
  if (identical.length === 0) return 'present';
  // Equal to some. A family that happens to share one reference's metrics would
  // be called absent on the strength of a coincidence, so it is not called
  // anything.
  return 'unknown';
}

export type FontCopy = {
  tone: 'ok' | 'degraded' | 'muted';
  /** False when no candidate was measured at all. */
  answered: boolean;
  measured: number;
  total: number;
  label: string;
  detail: string;
};

/**
 * What the font part says about itself.
 *
 * The measured answer today is **no** — which is the finding, and is worth
 * printing rather than assuming. An unmeasured stack says so in different words,
 * because "I found nothing" and "I did not look" are different claims and the
 * difference between them is the difference between a tool and a rumour.
 */
export function fontVerdictCopy(candidates: FontCandidate[]): FontCopy {
  const named = candidates.filter((c) => !isKeyword(c.family));
  const measured = candidates.filter((c) => c.fate === 'present' || c.fate === 'fell-through');
  const winner = candidates.find((c) => c.winner);

  if (measured.length === 0) {
    return {
      tone: 'degraded',
      answered: false,
      measured: 0,
      total: candidates.length,
      label: 'typeface: not measured',
      detail: `the studio did not probe the ${candidates.length} families in the display stack, so it is not making a claim`,
    };
  }

  const missing = named.filter((c) => c.fate === 'fell-through').map((c) => c.family);
  const unknown = named.filter((c) => c.fate === 'unknown' || c.fate === 'unmeasured').map((c) => c.family);

  // A **named** family winning is the finding, not the absence of one. Nothing in
  // this repo ships it, declares it, or names it in `tokens.json` — so whichever
  // face it turns out to be, it came from the machine. That is the whole claim:
  // one committed tree, a different raster per machine, and no way to tell from
  // the repository which one you are looking at.
  if (winner && !isKeyword(winner.family)) {
    return {
      tone: 'degraded',
      answered: true,
      measured: measured.length,
      total: candidates.length,
      label: `renders in ${winner.family}, which this repo does not ship`,
      detail:
        `no font face is declared anywhere in the app, the type tokens carry no font family at all, and ${winner.family} is still what wins — so the face came from whatever this machine happens to have installed, not from the commit. ` +
        `${missing.length} of ${named.length} named families in the stack are absent here. A machine without ${winner.family} renders something else, and Linux renders a third.`,
    };
  }

  // No named family resolved, so a platform keyword did. Still machine-dependent,
  // but at least the report can name what is actually drawing the glyphs.
  if (missing.length > 0) {
    return {
      tone: 'degraded',
      answered: true,
      measured: measured.length,
      total: candidates.length,
      label: `renders in ${winner?.family ?? 'a platform face'}; ${missing.join(' and ')} not installed`,
      detail: `none of the ${named.length} named families in the display stack is available to this browser, so the text falls through to the platform face. The same commit looks different on a machine that has ${missing[0]}, and different again on Linux.`,
    };
  }

  if (unknown.length > 0) {
    return {
      tone: 'degraded',
      answered: true,
      measured: measured.length,
      total: candidates.length,
      label: `${unknown.length} of ${candidates.length} families unmeasured`,
      detail: `the studio could not answer for ${unknown.join(', ')}, so it is not claiming they are present`,
    };
  }

  return {
    tone: 'ok',
    answered: true,
    measured: measured.length,
    total: candidates.length,
    label: `renders in ${winner?.family ?? 'the first named family'}`,
    detail: `all ${named.length} named families in the display stack are installed, so this machine's raster matches the stack as written`,
  };
}

// -- The type tokens, checked against what the screens really render. ----------

export type TypeRoleToken = {
  size: number;
  weight: string;
  lineHeight: number;
  letterSpacing: number;
};

/** One node's computed type values, as the browser reported them. */
export type ObservedType = {
  screen: string;
  style: {
    fontSize: string;
    lineHeight: string;
    letterSpacing: string;
    fontWeight: string;
  };
};

/**
 * - `verified` — nodes carry this role's size and weight, and agree on the rest.
 * - `mismatch` — nodes carry this role's size and weight, and at least one other
 *   property disagrees.
 * - `unreached` — no node on the board renders at this role's size, so the token
 *   did not reach a screen.
/**
 * - `verified` — every node carrying this role's size and weight agrees with the
 *   rest of the token.
 * - `overridden` — some nodes agree and some do not. The token reaches the screen
 *   *and* something overrides it elsewhere, which is a real observation and not a
 *   failure: the app's uppercase section headings share `type.label`'s size and
 *   weight and deliberately set their own letter spacing.
 * - `mismatch` — **no** node carrying this role agrees. The token's values reach
 *   nothing, which is the broken-render case this check exists for.
 * - `unreached` — no node on the board renders at this role's size.
 * - `unattributed` — nodes render at this role's size but none with its weight.
 *   Something is using the size; nothing is using the role.
 * - `unread` — nothing was read at all. Not a claim.
 */
export type TypeRoleVerdict =
  | 'verified'
  | 'overridden'
  | 'mismatch'
  | 'unreached'
  | 'unattributed'
  | 'unread';

export type TypeMismatch = { property: string; expected: string; found: string; nodes: number };

export type TypeRoleReport = {
  role: string;
  verdict: TypeRoleVerdict;
  /** Nodes carrying this role's size *and* weight. */
  nodes: number;
  /** Of those, how many agree with the token on line height and letter spacing. */
  agreeing: number;
  /** Where and how often the token is overridden. Empty when nothing overrides it. */
  overrides: TypeMismatch[];
};

export type TypeReport = {
  roles: TypeRoleReport[];
  /** How many distinct screens contributed a claimed node. Sits beside the claim. */
  screensVerified: number;
  /** How many (role, property) pairs were actually compared. */
  propertiesVerified: number;
  /** False when no node was read, so every verdict is `unread`. */
  measured: boolean;
};

/** The properties a `type.*` token carries. Two identify a role; two are checked. */
const TYPE_PROPERTIES = ['fontSize', 'lineHeight', 'letterSpacing', 'fontWeight'] as const;
const CHECKED = ['lineHeight', 'letterSpacing'] as const;

/**
 * Check every `type.*` role against what the screens actually render.
 *
 * ## Attribution is by size **and** weight, and that is a correction
 *
 * The first version attributed by size alone, on the argument that size is the
 * only unambiguous property. The real board said otherwise twice over:
 * `type.caption.size` is 12 and six nodes on the Today frame also render at 12
 * with a different weight, and `type.label` is 13/600 while the app's uppercase
 * section headings are also 13/600 with a letter spacing the token does not
 * describe. Attributing by size alone swept the first group into the caption role
 * and reported them as caption drift — a sound decision fed ambiguous facts,
 * printing a confident wrong answer, which is the exact failure this pass exists
 * to prevent.
 *
 * ## `overridden` is not `mismatch`
 *
 * With attribution fixed, a role can still have some nodes that agree and some
 * that do not. Calling that a failure would be overclaiming: the token *did* reach
 * the screen, and the app overrode part of it on purpose. Calling it a pass would
 * hide a real observation. So it is its own verdict, it prints both counts, and it
 * leaves the judgement to whoever owns the app.
 */
export function verifyTypeTokens(
  tokens: Record<string, TypeRoleToken>,
  observed: ObservedType[],
): TypeReport {
  const measured = observed.length > 0;
  const claimedBy = (role: string): ObservedType[] => {
    const token = tokens[role];
    const weight = normalizeValue('fontWeight', token.weight);
    return observed.filter(
      (o) => px(o.style.fontSize) === token.size && normalizedStyle(o, 'fontWeight') === weight,
    );
  };

  const roles: TypeRoleReport[] = Object.entries(tokens).map(([role, token]) => {
    if (!measured) return { role, verdict: 'unread', nodes: 0, agreeing: 0, overrides: [] };

    const atThisSize = observed.filter((o) => px(o.style.fontSize) === token.size);
    if (atThisSize.length === 0) {
      return { role, verdict: 'unreached', nodes: 0, agreeing: 0, overrides: [] };
    }

    const mine = claimedBy(role);
    if (mine.length === 0) {
      return { role, verdict: 'unattributed', nodes: 0, agreeing: 0, overrides: [] };
    }

    const agreeing = mine.filter((o) => agrees(o, token));
    const disagreeing = mine.filter((o) => !agrees(o, token));

    const overrides: TypeMismatch[] = [];
    for (const property of CHECKED) {
      const expected = property === 'lineHeight' ? `${token.lineHeight}px` : `${token.letterSpacing}px`;
      const wrong = disagreeing.filter((o) => normalizedStyle(o, property) !== expected);
      if (wrong.length > 0) {
        overrides.push({
          property,
          expected,
          found: normalizedStyle(wrong[0], property),
          nodes: wrong.length,
        });
      }
    }

    const verdict: TypeRoleVerdict =
      disagreeing.length === 0 ? 'verified' : agreeing.length === 0 ? 'mismatch' : 'overridden';

    return { role, verdict, nodes: mine.length, agreeing: agreeing.length, overrides };
  });

  const claimed = roles.filter((r) => r.verdict !== 'unreached' && r.verdict !== 'unattributed' && r.verdict !== 'unread');
  const screens = new Set(claimed.flatMap((r) => claimedBy(r.role).map((o) => o.screen)));

  return {
    roles,
    screensVerified: screens.size,
    propertiesVerified: claimed.length * TYPE_PROPERTIES.length,
    measured,
  };
}

const agrees = (o: ObservedType, token: TypeRoleToken): boolean =>
  CHECKED.every(
    (property) =>
      normalizedStyle(o, property) === (property === 'lineHeight' ? `${token.lineHeight}px` : `${token.letterSpacing}px`),
  );

/**
 * Compare a computed value the way the drift detector compares one.
 *
 * Reused rather than reimplemented, for the reason it was not reimplemented there:
 * a second normaliser is a second set of the bugs the first one already carries
 * fixed.
 *
 * Two browser vocabularies matter here. `getComputedStyle` answers `normal` where
 * the file holds `400`, so every bold heading in the app would read as a mismatch
 * if the strings were compared directly. It also answers `normal` for a
 * letter-spacing of zero — where `normal` *means* no additional spacing, so
 * folding it in is a definition rather than a convenience.
 *
 * `line-height: normal` is deliberately **not** folded in. It means the property
 * is unset, which is not the same as rendering at the token's line height, and
 * saying so is the finding.
 */
function normalizedStyle(o: ObservedType, property: (typeof TYPE_PROPERTIES)[number]): string {
  const raw = o.style[property];
  if (property === 'letterSpacing' && raw === 'normal') return '0px';
  return normalizeValue(property, raw);
}

const px = (value: string): number => Number.parseFloat(value);
