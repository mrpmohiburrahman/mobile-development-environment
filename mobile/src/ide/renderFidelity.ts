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
 * These pure functions import the drift normalizer at runtime.
 * Module loading requires no React, browser, or token server.
 * `test/renderFidelity.test.ts` loads it directly with the type-stripping runner.
 * `renderFidelity.dom.ts` collects the browser measurements.
 */

import { normalizeValue } from './detectDrift.ts';
import type { Tone } from '../ds/reachability.ts';
import rules from '../ds/tokenRules.json' with { type: 'json' };

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

/**
 * What the browser measured for one candidate.
 *
 * `widths` is the candidate rendered once per reference *as its fallback*: if the
 * candidate is installed, the same face is measured every time and the numbers
 * match each other; if it is not, the numbers become the reference's own widths.
 * `referenceWidths` is what each reference renders alone, which is what turns
 * "the numbers match each other" into "the numbers match the fallback".
 *
 * Optional, and its absence is a verdict rather than a default. There is no
 * hard-coded table of reference widths to fall back on: a width invented here
 * would be compared against a real one out there, and a family judged against
 * invented metrics can be called `present` on a browser that disagrees — which is
 * this module's own rule ("an unanswerable candidate reads as unknown or
 * unmeasured, never as fine") broken in the one place it matters most.
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

  const references = probe.referenceWidths;
  // No reference widths means nothing to compare against, and comparing against
  // invented ones would produce a verdict that looks measured and is not. Unknown,
  // which is the honest answer and reads as unknown in the report.
  if (!references) return 'unknown';
  if (REFERENCES.some((ref) => references[ref] === undefined)) return 'unknown';

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
  tone: Tone;
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
export function fontVerdictCopy(candidates: FontCandidate[], failedWeights: number[] = []): FontCopy {
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

  if (winner && !isKeyword(winner.family)) {
    // Named families sitting *ahead* of the winner that the studio could not
    // resolve. A cascade draws the first family it has, so an unresolved earlier
    // candidate means the winner is a provisional answer: the face that actually
    // drew the glyphs may be the one the probe could not judge. Observed once on a
    // cold load, when a measurement taken before the platform's faces had settled
    // came back inconclusive and the report named `Apple Color Emoji` — sixth in
    // the stack — with total confidence.
    const winnerAt = named.findIndex((c) => c === winner);
    const shadowed = named.slice(0, winnerAt).filter((c) => c.fate === 'unknown' || c.fate === 'unmeasured').map((c) => c.family);
    const provisional =
      shadowed.length > 0
        ? ` ${shadowed.join(' and ')} sit${shadowed.length === 1 ? 's' : ''} ahead of it in the stack and could not be resolved, so this is the first family the studio could judge rather than a proof of which one drew the glyphs.`
        : '';

    if (rules.fontFamily.allowed.includes(winner.family)) {
      return {
        tone: shadowed.length > 0 || failedWeights.length > 0 ? 'degraded' : 'ok',
        answered: true,
        measured: measured.length,
        total: candidates.length,
        label: failedWeights.length > 0
          ? `bundled font weights unavailable: ${failedWeights.join(', ')}`
          : `renders in bundled ${winner.family}${shadowed.length > 0 ? ' (provisional)' : ''}`,
        detail: failedWeights.length > 0
          ? `Font weights ${failedWeights.join(', ')} failed to load. This check does not prove native font loading.`
          : `The browser measured the bundled family. This check does not prove native font loading or identical rasterization.${provisional}`,
      };
    }

    return {
      tone: 'degraded',
      answered: true,
      measured: measured.length,
      total: candidates.length,
      label:
        shadowed.length > 0
          ? `renders in ${winner.family}, which this repo does not ship (provisional)`
          : `renders in ${winner.family}, which this repo does not ship`,
      detail:
        `${winner.family} is not part of the font bundle. The browser measured a fallback family rather than the bundled face. ` +
        `${missing.length} of ${named.length} named families in the stack are absent here.` +
        provisional,
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
 * What happened to one `type.*` role on the real board.
 *
 * - `verified` — every node carrying this role's size and weight agrees with the
 *   rest of the token.
 * - `overridden` — some nodes agree and some do not. The token reaches the screen
 *   *and* something overrides it elsewhere, which is a real observation and not a
 *   failure: the app's uppercase section headings share `type.label`'s size and
 *   weight and deliberately set their own letter spacing.
 * - `mismatch` — **no** node carrying this role agrees. The token's values reach
 *   nothing, which is the broken-render case this check exists for.
 * - `unreached` — no node on the board renders at this role's size.
 * - `unowned` — nodes render at this role's size but none with its weight.
 *   Something is using the size; nothing is using the role. Named apart from the
 *   press verdict `unattributed`, which means a later press in a task was not
 *   credited: two different facts in one diff would otherwise share one word.
 * - `unread` — nothing was read at all. Not a claim.
 */
export type TypeRoleVerdict =
  | 'verified'
  | 'overridden'
  | 'mismatch'
  | 'unreached'
  | 'unowned'
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

/**
 * The properties a `type.*` token carries, and the two of them that are checked.
 *
 * Exported so the browser half reads the same list it is being asked about. It
 * kept its own copy of these four names, and two copies of a list that has to
 * agree is a drift nobody reports: the reader would collect one set of computed
 * styles while the decision function compared another.
 *
 * `ATTRIBUTING` are the two properties that decide *which* role a node carries —
 * size and weight. `CHECKED` are the two that are then compared against the token.
 * The split is the reason `propertiesVerified` counts `CHECKED` and not all four:
 * a property used to find a node was not verified against anything, and counting it
 * would double the sample size on paper.
 */
export const TYPE_PROPERTIES = ['fontSize', 'lineHeight', 'letterSpacing', 'fontWeight'] as const;
export const ATTRIBUTING = ['fontSize', 'fontWeight'] as const;
export const CHECKED = ['lineHeight', 'letterSpacing'] as const;

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
  /** The nodes each role claimed, kept so the screen count does not re-derive them. */
  const claimedNodes = new Map<string, ObservedType[]>();

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
      return { role, verdict: 'unowned', nodes: 0, agreeing: 0, overrides: [] };
    }
    claimedNodes.set(role, mine);

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

  const screens = new Set([...claimedNodes.values()].flat().map((o) => o.screen));

  return {
    roles,
    screensVerified: screens.size,
    // Compared, not carried. Size and weight found the nodes; line height and
    // letter spacing were checked against the token, and only a check is a
    // verification. Counting all four would print a sample size twice the real one.
    propertiesVerified: claimedNodes.size * CHECKED.length,
    measured,
  };
}

const agrees = (o: ObservedType, token: TypeRoleToken): boolean =>
  CHECKED.every(
    (property) =>
      normalizedStyle(o, property) === (property === 'lineHeight' ? `${token.lineHeight}px` : `${token.letterSpacing}px`),
  );

export type TypeCopy = { tone: Tone; label: string; detail: string };

/**
 * How the type part reports itself, in the studio's own three-state voice.
 *
 * Lives here rather than in the badge that renders it, because turning a report
 * into a sentence is a **decision** and this repo's seam puts decisions in pure
 * modules: the browser half gathers facts, the pure half decides what they mean. A
 * decision inside a `.tsx` file cannot be loaded by the type-stripping test runner,
 * so it could only ever be checked by looking at it — and the wording is the thing
 * most worth checking, because it is what stops a broken measurement reading as a
 * clean one.
 */
export function typeVerdictCopy(report: TypeReport | null, measured: boolean): TypeCopy {
  if (!report || !measured) {
    return {
      tone: 'degraded',
      label: 'type tokens: not measured',
      detail: 'the studio read no screens, so it is not claiming the tokens reached one',
    };
  }

  const unreached = report.roles.filter((r) => r.verdict === 'unreached').map((r) => r.role);
  const unowned = report.roles.filter((r) => r.verdict === 'unowned').map((r) => r.role);
  const overridden = report.roles.filter((r) => r.verdict === 'overridden');
  const broken = report.roles.filter((r) => r.verdict === 'mismatch');
  const verified = report.roles.filter((r) => r.verdict === 'verified').length;

  /**
   * The sample size, appended to every answered verdict.
   *
   * Appended rather than printed only on the clean one, because "the sample size
   * sits next to the claim" is worth least exactly where a report looks most
   * settled. A reader who sees "3 type roles verified, 2 partly overridden" and
   * stops reading has been told the verdict and not how much board it rests on.
   *
   * It names what was compared and what was not: size and weight found the nodes,
   * so counting all four properties would print a sample size twice the size of the
   * measurement behind it.
   */
  const screenWord = report.screensVerified === 1 ? 'screen' : 'screens';
  const sample = `${report.propertiesVerified} properties compared — ${CHECKED.join(' and ')} — on ${report.screensVerified} ${screenWord}. Size and weight found the nodes rather than being checked against them.`;

  if (unreached.length > 0) {
    return {
      tone: 'degraded',
      label: `${unreached.join(', ')} ${unreached.length === 1 ? 'renders' : 'render'} on no screen`,
      detail:
        'no node on the board renders at that role’s size, so the token did not reach a screen. That is a broken render reported as a clean one without this check. ' +
        sample,
    };
  }

  if (broken.length > 0) {
    const [first] = broken;
    const where = first.overrides[0];
    return {
      tone: 'degraded',
      label: `${broken.length} of ${report.roles.length} type roles reach nothing`,
      detail: `${first.role} is used on ${first.nodes} node${first.nodes === 1 ? '' : 's'} and every one of them sets ${where.property} to ${where.found} where the token says ${where.expected}. ${sample}`,
    };
  }

  // The override is an observation, not a fault. The app's uppercase section
  // headings share `type.label`'s size and weight and deliberately set their own
  // letter spacing; saying so is the studio's job, calling it broken is not.
  if (overridden.length > 0) {
    const [first] = overridden;
    const where = first.overrides[0];
    return {
      tone: 'muted',
      label: `${verified} type roles verified, ${overridden.length} partly overridden`,
      detail: `${first.role} reaches ${first.agreeing} node${first.agreeing === 1 ? '' : 's'} exactly and is overridden on ${where?.nodes ?? 0} more, where ${where?.property} is ${where?.found} rather than ${where?.expected}. Whether that is intended is the app's call, not the studio's. ${sample}`,
    };
  }

  return {
    tone: unowned.length > 0 ? 'muted' : 'ok',
    label: `${verified} type roles verified on ${report.screensVerified} ${screenWord}`,
    detail:
      sample +
      (unowned.length > 0
        ? ` ${unowned.join(', ')} share${unowned.length === 1 ? 's' : ''} a size with other text rather than carrying the role, so it was neither checked nor cleared.`
        : ''),
  };
}

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
