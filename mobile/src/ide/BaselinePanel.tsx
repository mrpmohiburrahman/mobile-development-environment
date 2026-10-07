import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { fetchCommittedTokens } from '../ds/client';
import { diffTrees, groupByFamily, leafCount, type Difference } from '../ds/drift';
import { useTokens } from '../ds/store';
import { CHROME, CHROME_RADIUS, TONE } from './chrome';
import { Label } from './Label';

/**
 * Baseline mode: what has drifted from what was last committed.
 *
 * ## What this is
 *
 * The current tree — `tokens.json` plus the in-memory override layer — compared
 * against the tree at `HEAD`. `baseline.mjs` on the server does the comparison,
 * and it is a comparison of *token sets*.
 *
 * ## What this is not
 *
 * It is not a pixel diff of two screenshots. There are no screenshots here at
 * all. A pixel diff would report the zoom level, whichever font happened to load,
 * and antialiasing as drift, none of which are drift in the design system. The
 * claim the studio rests on is narrower and better: it renders the real
 * components against two token sets, so anything it reports traces back to a
 * named token in `tokens.json`.
 *
 * A `removed` token is real drift — one that existed at HEAD and not on disk —
 * even though nothing on screen visibly changed, because the committed file no
 * longer describes what the app would build from.
 */
export function BaselinePanel() {
  const current = useTokens();
  const [committed, setCommitted] = useState<Record<string, any> | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  useEffect(() => {
    let live = true;
    void fetchCommittedTokens().then((tree) => {
      if (!live) return;
      // Null is "no server", which on the deployed build is the normal case and
      // not an error. It disables the toggle rather than showing an empty report.
      setCommitted(tree);
      setStatus(tree ? 'ready' : 'unavailable');
    });
    return () => {
      live = false;
    };
  }, []);

  if (status !== 'ready' || !committed) {
    return (
      <View style={{ gap: 6 }}>
        <Label role="caption" color={CHROME.textMuted}>
          {status === 'loading' ? 'reading the committed tokens…' : 'no token server, so nothing to compare against'}
        </Label>
      </View>
    );
  }

  const differences = diffTrees(current, committed);
  const groups = groupByFamily(differences);

  if (differences.length === 0) {
    return (
      <View style={{ gap: 6 }}>
        <Label role="caption" color={TONE.ok} style={{ fontWeight: '600' }}>
          in sync with HEAD
        </Label>
        <Label role="caption" color={CHROME.textMuted}>
          {leafCount(current)} tokens compared, none differ.
        </Label>
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      <Label role="caption" color={TONE.degraded} style={{ fontWeight: '600' }}>
        {differences.length} drifted from HEAD
      </Label>

      {groups.map((group) => (
        <View key={group.family} style={{ gap: 3 }}>
          <Label role="caption" color={CHROME.textMuted}>
            {group.family} · {group.count}
          </Label>
          {group.differences.map((diff) => (
            <Row key={diff.path} diff={diff} />
          ))}
        </View>
      ))}

      <Label role="caption" color={CHROME.textMuted}>
        Compared token sets, not pixels: every line names a token in tokens.json.
      </Label>
    </View>
  );
}

/** One difference, with the committed value struck through rather than hidden. */
function Row({ diff }: { diff: Difference }) {
  const show = (v: unknown) => (v === undefined ? '—' : JSON.stringify(v));
  const marker = diff.kind === 'added' ? '+' : diff.kind === 'removed' ? '−' : '~';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Label role="caption" color={CHROME.textMuted} style={{ width: 10 }}>
        {marker}
      </Label>
      <Label role="caption" color={CHROME.text} style={{ flex: 1, fontFamily: 'monospace' }}>
        {diff.path}
      </Label>
      {diff.kind === 'changed' ? (
        <Label role="caption" color={CHROME.textMuted} style={{ fontFamily: 'monospace' }}>
          <Label role="caption" color={CHROME.textMuted} style={{ textDecorationLine: 'line-through' }}>
            {show(diff.baseline)}
          </Label>
          {' → '}
          {show(diff.current)}
        </Label>
      ) : (
        <Label role="caption" color={CHROME.textMuted} style={{ fontFamily: 'monospace' }}>
          {show(diff.kind === 'added' ? diff.current : diff.baseline)}
        </Label>
      )}
    </View>
  );
}

/**
 * The compare toggle.
 *
 * Shown always and disabled with a reason when there is no server, rather than
 * hidden — the map left that open, and consistency with the session revert won:
 * a control that vanishes cannot be told apart from one that is merely absent,
 * and "in-memory only" is a claim the studio already makes elsewhere. A hidden
 * toggle on the deployed build would look like the feature was never built.
 */
export function BaselineToggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let live = true;
    void fetchCommittedTokens().then((tree) => live && setAvailable(tree !== null));
    return () => {
      live = false;
    };
  }, []);

  const disabled = available === false;

  return (
    <Pressable
      onPress={() => onChange(!on)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled }}
      accessibilityLabel="Compare current tokens against the tokens at HEAD"
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: CHROME_RADIUS.pill,
        borderWidth: 1,
        borderColor: on ? TONE.ok : CHROME.border,
        backgroundColor: on ? CHROME.panelSoft : 'transparent',
        opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
      })}>
      <View
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          backgroundColor: on ? TONE.ok : disabled ? TONE.muted : CHROME.textMuted,
        }}
      />
      <Label role="caption" color={on ? CHROME.text : CHROME.textMuted}>
        {disabled ? 'no committed baseline' : on ? 'comparing to HEAD' : 'compare to HEAD'}
      </Label>
    </Pressable>
  );
}

/**
 * The committed tree, fetched when `enabled` so the blueprint only asks for it
 * while the comparison is actually on.
 */
export function useCommittedTokens(enabled: boolean) {
  const [tree, setTree] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void fetchCommittedTokens().then((fetched) => live && setTree(fetched));
    return () => {
      live = false;
    };
  }, [enabled]);

  return { tree };
}