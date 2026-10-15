import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { diffTrees, type Difference } from '../ds/drift';
import { useTokens } from '../ds/store';
import { screens } from './screens';
import { CHROME, TONE } from './chrome';
import {
  detectDriftInSubtrees,
  summariseDifferences,
  type StyleDifference,
} from './detectDrift';
import { Label } from './Label';
import { useCommittedTokens } from './BaselinePanel';
import { resolveFramePairs } from './boardFrames';

/** One screen's verdict, with whatever could be attributed. */
export type ScreenDrift = {
  key: string;
  label: string;
  /** True when any paired node differed on a token-movable property. */
  drifted: boolean;
  differences: ReturnType<typeof summariseDifferences>;
  nodesCompared: number;
  /** Paired nodes could not be trusted because the trees had different shapes. */
  structureMismatch: boolean;
};

/**
 * Which screens drifted, by comparing each pair of artboards in the DOM.
 *
 * Reads each artboard's wrapper by its `nativeID` — `#screen-<key>` and
 * `#base-<key>` — rather than counting frames, so a screen is identified by the
 * same stable key `screens.ts` already uses. The two columns render the same
 * components in the same order, so pairing by key and then by position within
 * the frame is sound; a shape mismatch is reported rather than silently
 * truncated.
 */
export function useScreenDrift(enabled: boolean) {
  const current = useTokens();
  const { tree: baseline } = useCommittedTokens(enabled);
  // Attach to the DOM node holding *both* columns. Owned by the caller because
  // that node is the blueprint's container, not this panel's.
  const rootRef = useRef<View>(null);
  const [result, setResult] = useState<{
    screens: ScreenDrift[];
    drift: Difference[];
    /** Keys with only one of the two columns mounted, so no pair exists. */
    unpaired: string[];
  } | null>(null);

  // The tree diff is the vocabulary the attribution matches values against.
  const drift = useMemo(
    () => (baseline ? diffTrees(current, baseline) : []),
    [current, baseline],
  );

  useEffect(() => {
    if (!enabled || !baseline) return;

    const read = () => {
      // The board's own screen keys, not the DOM's: iterating `screens.ts` means
      // a frame that failed to mount is *reported* rather than quietly dropping
      // out of the comparison. `resolveFramePairs` needs both columns, and says
      // which keys it could not pair rather than returning half a pair.
      const resolved = resolveFramePairs(
        rootRef.current as unknown as HTMLElement | null,
        screens.map((s) => s.key),
      );

      const verdicts: ScreenDrift[] = resolved.pairs.map(({ current: a, baseline: b, key }) => {
        const label = screens.find((s) => s.key === key)?.label ?? key;
        const found = detectDriftInSubtrees(a, b, drift);
        const differences: StyleDifference[] = found.differences;
        return {
          key,
          label,
          drifted: differences.length > 0,
          differences: summariseDifferences(differences),
          nodesCompared: found.nodesCompared,
          structureMismatch: found.structureMismatch,
        };
      });

      setResult({ screens: verdicts, drift, unpaired: resolved.unpaired });
    };

    // Run after paint, once the second column has mounted.
    const id = requestAnimationFrame(read);
    return () => cancelAnimationFrame(id);
  }, [enabled, baseline, drift, current]);

  return { rootRef, ...(result ?? { screens: [], drift, unpaired: [] }) };
}

/**
 * How many screens drifted, rendered as a list.
 *
 * Exported so the route can put it under the token-level diff in the baseline
 * tab: "which tokens differ" and "which screens that touched" are one report
 * about the same comparison, and splitting them across two tabs would make the
 * reader correlate them by hand.
 */
export function Drifted({ screens, unpaired = [] }: { screens: ScreenDrift[]; unpaired?: string[] }) {
  const drifted = screens.filter((s) => s.drifted);
  const mismatched = screens.filter((s) => s.structureMismatch);

  // A key that could not be paired is reported before anything else, because
  // "no screen drifted" over fewer screens than the board has is the most
  // confident wrong answer this panel could print.
  const pairing = unpaired.length > 0 ? (
    <Label role="caption" color={TONE.degraded}>
      {unpaired.length} frame pair{unpaired.length === 1 ? '' : 's'} had only one column mounted, so
      nothing was compared for {unpaired.join(', ')}
    </Label>
  ) : null;

  if (screens.length === 0) {
    return (
      <View style={{ gap: 4 }}>
        <Label role="caption" color={CHROME.textMuted}>
          turn on the comparison to see which screens drifted
        </Label>
        {pairing}
      </View>
    );
  }

  if (drifted.length === 0) {
    return (
      <View style={{ gap: 4 }}>
        <Label role="caption" color={TONE.ok} style={{ fontWeight: '600' }}>
          no screen drifted
        </Label>
        <Label role="caption" color={CHROME.textMuted}>
          A screen counts as drifted only when a paired node differs on a property a
          token could move.
        </Label>
        <Label role="caption" color={CHROME.textMuted}>
          {screens.length} screens compared node for node — same components, same
          store state, same tokens.
        </Label>
        {pairing}
        {mismatched.length > 0 ? (
          <Label role="caption" color={TONE.degraded}>
            {mismatched.length} frame pair{mismatched.length === 1 ? '' : 's'} had a different
            DOM shape, so their pairing is not trustworthy
          </Label>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      <Label role="caption" color={TONE.degraded} style={{ fontWeight: '600' }}>
        {drifted.length} of {screens.length} screens drifted
      </Label>

      {drifted.map((screen) => (
        <View key={screen.key} style={{ gap: 3 }}>
          <Label role="caption" color={CHROME.text}>
            {screen.label}
          </Label>
          {screen.structureMismatch ? (
            <Label role="caption" color={TONE.degraded}>
              DOM shape differed — this verdict is unreliable
            </Label>
          ) : null}
          {screen.differences.map((diff) => (
            <View key={diff.property} style={{ flexDirection: 'row', gap: 6 }}>
              <Label role="caption" color={CHROME.textMuted} style={{ width: 132 }}>
                {diff.property}
              </Label>
              <Label role="caption" color={CHROME.textMuted} style={{ flex: 1, fontFamily: 'monospace' }}>
                {diff.baseline} → {diff.current}
                {diff.token ? (
                  <Label role="caption" color={CHROME.text} style={{ fontFamily: 'monospace' }}>
                    {`  ${diff.token}`}
                  </Label>
                ) : (
                  <Label role="caption" color={CHROME.textMuted}>
                    {`  (${diff.family}, unattributed)`}
                  </Label>
                )}
              </Label>
            </View>
          ))}
        </View>
      ))}

      <Label role="caption" color={CHROME.textMuted}>
        Compared computed styles, node for node — not a screenshot diff. A token is named
        when its value pair matches on both sides; where it does not, the family is shown
        instead of a guess.
      </Label>
    </View>
  );
}
