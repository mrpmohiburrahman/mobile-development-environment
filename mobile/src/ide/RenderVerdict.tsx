import { useEffect, useState, type RefObject } from 'react';
import { Platform, View } from 'react-native';
import { useTokens } from '../ds/store';
import {
  fontVerdictCopy,
  judgeCandidates,
  parseFontStack,
  verifyTypeTokens,
  type FontCandidate,
  type ObservedType,
  type TypeReport,
} from './renderFidelity';
import { observeTypeStyles, probeFontCandidates } from './renderFidelity.dom';
import { resolveFrames } from './boardFrames';
import { screens } from './screens';
import { CHROME, TONE } from './chrome';
import { Label } from './Label';

/**
 * The CSS custom property the whole app's display type resolves through.
 *
 * Read off the document rather than parsed out of `global.css`: the question is
 * what the browser actually applied, and the browser is the only authority on
 * that. A value hard-coded here would be a second copy that drifts.
 */
function readDisplayStack(): string[] {
  if (Platform.OS !== 'web' || typeof getComputedStyle !== 'function') return [];
  const root = getComputedStyle(document.documentElement);
  return parseFontStack(root.getPropertyValue('--font-display'));
}

export type RenderVerdict = {
  candidates: FontCandidate[];
  observed: ObservedType[] | null;
  typeTokens: Record<string, { size: number; weight: string; lineHeight: number; letterSpacing: number }>;
  measured: boolean;
  /** How many frames were read, and how many the board has that were not. */
  framesRead: number;
  framesMissing: number;
};

/**
 * Measure the render, once, after the board has painted.
 *
 * `requestAnimationFrame` rather than an effect, because the whole subject is
 * computed styles of nodes that have to exist first. Re-reads whenever the log
 * moves, so dragging `type.caption.size` moves the verification line — the negative
 * control for the whole feature, and the reason this is a measurement rather than
 * a claim made once at start-up.
 */
export function useRenderVerdict(host: RefObject<View | null>): RenderVerdict | null {
  const tokens = useTokens();
  const [verdict, setVerdict] = useState<RenderVerdict | null>(null);

  const typeJson = JSON.stringify(tokens.type);
  const signature = `${typeJson}#${verdict?.candidates.length ?? 0}`;

  useEffect(() => {
    const node = host.current as unknown as HTMLElement | null;
    if (!node?.querySelector) return;

    const id = requestAnimationFrame(() => {
      const resolved = resolveFrames(node, screens.map((s) => s.key));

      const stack = readDisplayStack();
      // Every candidate, multi-word ones included. An earlier version filtered out
      // families containing a space, on the theory that quoting them was fiddly —
      // and quietly stopped probing `Spline Sans`, which is the family that is
      // actually missing. Quoting is handled in the reader; the filter was the bug.
      setVerdict({
        candidates: judgeCandidates(stack, probeFontCandidates(stack)),
        // `null` when no frame could be read at all, which the report renders as
        // *not measured*. Zero frames is not "the tokens reached every screen".
        observed: observeTypeStyles(resolved.frames),
        typeTokens: JSON.parse(typeJson) as RenderVerdict['typeTokens'],
        measured: resolved.found > 0,
        framesRead: resolved.found,
        framesMissing: resolved.missing.length,
      });
    });

    return () => cancelAnimationFrame(id);
    // `signature` rather than `verdict`, which would rebuild the effect it set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, signature]);

  return verdict;
}

/** How the type part reports itself, in the studio's own three-state voice. */
function typeCopy(report: TypeReport | null, measured: boolean): { tone: string; label: string; detail: string } {
  if (!report || !measured) {
    return {
      tone: 'degraded',
      label: 'type tokens: not measured',
      detail: 'the studio read no screens, so it is not claiming the tokens reached one',
    };
  }

  const unreached = report.roles.filter((r) => r.verdict === 'unreached').map((r) => r.role);
  const unattributed = report.roles.filter((r) => r.verdict === 'unattributed').map((r) => r.role);
  const overridden = report.roles.filter((r) => r.verdict === 'overridden');
  const broken = report.roles.filter((r) => r.verdict === 'mismatch');

  if (unreached.length > 0) {
    return {
      tone: 'degraded',
      label: `${unreached.join(', ')} ${unreached.length === 1 ? 'renders' : 'render'} on no screen`,
      detail:
        'no node on the board renders at that role’s size, so the token did not reach a screen. That is a broken render reported as a clean one without this check.',
    };
  }

  if (broken.length > 0) {
    const [first] = broken;
    const where = first.overrides[0];
    return {
      tone: 'degraded',
      label: `${broken.length} of ${report.roles.length} type roles reach nothing`,
      detail: `${first.role} is used on ${first.nodes} node${first.nodes === 1 ? '' : 's'} and every one of them sets ${where.property} to ${where.found} where the token says ${where.expected}.`,
    };
  }

  const verified = report.roles.filter((r) => r.verdict === 'verified').length;

  // The override is an observation, not a fault. The app's uppercase section
  // headings share `type.label`'s size and weight and deliberately set their own
  // letter spacing; saying so is the studio's job, calling it broken is not.
  if (overridden.length > 0) {
    const [first] = overridden;
    const where = first.overrides[0];
    return {
      tone: 'muted',
      label: `${verified} type roles verified, ${overridden.length} partly overridden`,
      detail: `${first.role} reaches ${first.agreeing} node${first.agreeing === 1 ? '' : 's'} exactly and is overridden on ${where?.nodes ?? 0} more, where ${where?.property} is ${where?.found} rather than ${where?.expected}. Whether that is intended is the app's call, not the studio's.`,
    };
  }

  return {
    tone: unattributed.length > 0 ? 'muted' : 'ok',
    label: `${verified} type roles verified on ${report.screensVerified} screen${report.screensVerified === 1 ? '' : 's'}`,
    detail:
      `${report.propertiesVerified} properties compared — size, line height, letter spacing and weight, read from computed styles on ${report.screensVerified} screen${report.screensVerified === 1 ? '' : 's'}.` +
      (unattributed.length > 0
        ? ` ${unattributed.join(', ')} share${unattributed.length === 1 ? 's' : ''} a size with other text rather than carrying the role, so it was neither checked nor cleared.`
        : ''),
  };
}

/**
 * The verdict on what is actually on screen.
 *
 * ## Why this sits in the board header
 *
 * It qualifies the board's own claim. The blueprint says "this is what the app
 * renders"; that claim is only as good as the type it is rendered in, and on this
 * machine the answer is no. Putting the verdict next to the thing it qualifies is
 * the whole point — a number in a panel a reader has to go and find is a number
 * nobody revisits.
 *
 * ## What it does not claim
 *
 * It does not say the render is wrong. It says the render is machine-dependent,
 * which is a weaker and more useful statement: it is what makes a pixel-diff suite
 * unsatisfiable here, and it is the number that changes the day a web font ships.
 */
export function RenderVerdictBadge({ host }: { host: RefObject<View | null> }) {
  const verdict = useRenderVerdict(host);

  if (!verdict) {
    return (
      <Label role="caption" color={CHROME.textMuted}>
        render fidelity: measuring…
      </Label>
    );
  }

  const font = fontVerdictCopy(verdict.candidates);
  const type = typeCopy(verdict.observed ? verifyTypeTokens(verdict.typeTokens, verdict.observed) : null, verdict.measured);

  return (
    <View style={{ gap: 2, maxWidth: 560 }}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Label role="caption" color={TONE[font.tone]} style={{ fontWeight: '600' }} numberOfLines={1}>
          {font.label}
        </Label>
        <Label role="caption" color={TONE[type.tone as keyof typeof TONE]} style={{ fontWeight: '600' }} numberOfLines={1}>
          {type.label}
        </Label>
      </View>
      <Label role="caption" color={CHROME.textMuted} numberOfLines={2}>
        {font.detail}
      </Label>
      <Label role="caption" color={CHROME.textMuted} numberOfLines={2}>
        {type.detail}
      </Label>
      <Label role="caption" color={CHROME.textMuted} numberOfLines={1}>
        measured in this browser, not read from a file: {font.measured} of {font.total} stack
        families probed, on {verdict.framesRead} screen
        {verdict.framesRead === 1 ? '' : 's'}
        {verdict.framesMissing > 0 ? ` (${verdict.framesMissing} did not mount)` : ''}.
      </Label>
    </View>
  );
}