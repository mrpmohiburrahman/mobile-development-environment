import { useEffect, useState, type RefObject } from 'react';
import { View } from 'react-native';
import { useTokens } from '../ds/store';
import {
  fontVerdictCopy,
  judgeCandidates,
  typeVerdictCopy,
  verifyTypeTokens,
  type FontCandidate,
  type ObservedType,
  type TypeRoleToken,
} from './renderFidelity';
import {
  loadBundledFontWeights,
  observeFontStack,
  observeTypeStyles,
  probeFontCandidates,
} from './renderFidelity.dom';
import { resolveFrames } from './boardFrames';
import { screens } from './screens';
import { CHROME, TONE } from './chrome';
import { Label } from './Label';

export type RenderVerdict = {
  candidates: FontCandidate[];
  failedWeights: number[];
  observed: ObservedType[] | null;
  typeTokens: Record<string, TypeRoleToken>;
  measured: boolean;
  /** How many frames were read, and how many the board has that were not. */
  framesRead: number;
  framesMissing: number;
};

/**
 * Measure the render, once, after the board has painted.
 *
 * `requestAnimationFrame` rather than an effect, because the whole subject is
 * computed styles of nodes that have to exist first. Re-reads whenever the tokens
 * change, so dragging `type.caption.size` moves the verification line — the
 * negative control for the whole feature, and the reason this is a measurement
 * rather than a claim made once at start-up.
 *
 * The dependency is the token JSON and nothing else. An earlier version folded the
 * verdict's own candidate count into it, which made the effect depend on the state
 * it sets: every measurement re-ran the measurement, and the only thing stopping
 * the loop was that the count happened to settle. A hook that has to be talked out
 * of its own output by an `eslint-disable` is the sign of that, so the disable is
 * gone and the dependency list is complete instead.
 */
export function useRenderVerdict(host: RefObject<View | null>): RenderVerdict | null {
  const tokens = useTokens();
  const [verdict, setVerdict] = useState<RenderVerdict | null>(null);

  const typeJson = JSON.stringify(tokens.type);

  useEffect(() => {
    const node = host.current as unknown as HTMLElement | null;
    if (!node?.querySelector) return;

    let cancelled = false;
    let id = 0;
    const measure = (failedWeights: number[]) => {
      if (cancelled) return;
      id = requestAnimationFrame(() => {
        const resolved = resolveFrames(node, screens.map((s) => s.key));
        const stack = observeFontStack(resolved.frames);
        setVerdict({
          candidates: judgeCandidates(stack, probeFontCandidates(stack)),
          failedWeights,
          observed: observeTypeStyles(resolved.frames),
          typeTokens: Object.fromEntries(
            Object.entries(JSON.parse(typeJson)).filter(([name]) => name !== 'family'),
          ) as RenderVerdict['typeTokens'],
          measured: resolved.found > 0,
          framesRead: resolved.found,
          framesMissing: resolved.missing.length,
        });
      });
    };

    void loadBundledFontWeights().then(measure);

    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [host, typeJson]);

  return verdict;
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

  const font = fontVerdictCopy(verdict.candidates, verdict.failedWeights);
  const type = typeVerdictCopy(
    verdict.observed ? verifyTypeTokens(verdict.typeTokens, verdict.observed) : null,
    verdict.measured,
  );

  return (
    <View style={{ gap: 2, maxWidth: 560 }}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Label role="caption" color={TONE[font.tone]} style={{ fontWeight: '600' }} numberOfLines={1}>
          {font.label}
        </Label>
        <Label role="caption" color={TONE[type.tone]} style={{ fontWeight: '600' }} numberOfLines={1}>
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