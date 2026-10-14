import { useEffect, useState, type RefObject } from 'react';
import { View } from 'react-native';
import {
  buildRouteList,
  routeCounts,
  backGap,
  describeBackGap,
  screensWithoutExits,
  type RouteGap,
  type RouteRow,
} from './routes';
import { formatPath } from './spine';
import { useSpine } from './spineStore';
import { routerKeys, screens } from './screens';
import { countBackControls } from './renderFidelity.dom';
import { CHROME, TONE } from './chrome';
import { Label } from './Label';

/** How a provenance is named in a row. Short enough for a 300px panel. */
const PROVENANCE: Record<string, string> = {
  observed: 'observed',
  declared: 'declared',
  unresolved: 'unresolved',
};

function Row({ row }: { row: RouteRow }) {
  return (
    <View style={{ gap: 1, paddingBottom: 4 }}>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <Label role="caption" color={CHROME.textMuted} style={{ fontFamily: 'monospace' }} numberOfLines={1}>
          {row.from ?? 'unknown'} → {row.to}
        </Label>
        <Label role="caption" color={row.provenance === 'observed' ? TONE.ok : TONE.muted} style={{ fontWeight: '600' }}>
          {PROVENANCE[row.provenance]}
        </Label>
      </View>

      {row.column === 'comparison' ? (
        <Label role="caption" color={TONE.muted}>
          seen in the HEAD column
        </Label>
      ) : null}

      {/* Never an empty field. A blank where a change should be reads as missing
          data, which is a different claim from "nothing moved". */}
      <Label role="caption" color={row.carriedChange ? CHROME.text : CHROME.textMuted}>
        {row.carriedChange
          ? `carried ${row.paths.map(formatPath).join(', ')}`
          : row.provenance === 'declared'
            ? 'not watched — declared from the router directory, so no change was ever measured'
            : 'no state change'}
      </Label>
    </View>
  );
}

/**
 * The route list: what the app can navigate to, and how each fact was learned.
 *
 * ## Why the counts come first
 *
 * A reader who sees "11 routes" believes the studio watched eleven. It watches
 * seven. So the breakdown leads, and a row cannot be drawn without its provenance.
 *
 * ## Where the back control sits
 *
 * In the gaps, with a count, and never as a row. `router.back()` resolves against
 * history at press time, so there is no static edge to draw; a gap shown as zero
 * would read as "there are none", so zero is worded differently from a count the
 * studio could not take at all.
 */
export function RoutePanel({ host }: { host: RefObject<View | null> }) {
  const spine = useSpine();
  const [gap, setGap] = useState<RouteGap>(() => backGap(null));

  // Counted from the board rather than declared from source, so the number is the
  // number actually rendered — and it moves: the habit detail screen only draws a
  // back bar once a habit is selected, which is itself a state change the log
  // knows about. So it is re-read whenever the log moves.
  useEffect(() => {
    const id = requestAnimationFrame(() => setGap(backGap(countBackControls(framesFrom(host.current)))));
    return () => cancelAnimationFrame(id);
  }, [host, spine.seq]);

  const rows = buildRouteList(spine.entries, routerKeys);
  const counts = routeCounts(rows, [gap]);
  const gapCopy = describeBackGap(gap);
  const exits = screensWithoutExits(rows, routerKeys);
  const observed = rows.filter((r) => r.provenance === 'observed');
  const declared = rows.filter((r) => r.provenance === 'declared');

  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 3 }}>
        <Label role="label" color={CHROME.text} style={{ letterSpacing: 1 }}>
          ROUTES
        </Label>
        {/* The breakdown leads, so a headline number can never mislead on its own. */}
        <Label role="caption" color={TONE.ok} style={{ fontWeight: '600' }}>
          {counts.observed} observed
        </Label>
        <Label role="caption" color={TONE.muted}>
          {counts.declared} declared · {counts.unresolved} unresolved
        </Label>
        <Label role="caption" color={CHROME.textMuted}>
          {spine.routeEvents} route change{spine.routeEvents === 1 ? '' : 's'} seen at the navigation seam
        </Label>
        {/* The cross-check, printed when it fails. A list that agrees with its own
            count proves nothing; this is where a disagreement becomes visible. */}
        {spine.routeEvents !== counts.observed ? (
          <Label role="caption" color={TONE.degraded}>
            the seam saw {spine.routeEvents} and the list holds {counts.observed} — the list is
            drawing something it did not observe
          </Label>
        ) : null}
      </View>

      <View style={{ gap: 6 }}>
        <Label role="caption" color={CHROME.textMuted}>
          OBSERVED
        </Label>
        {observed.length === 0 ? (
          <Label role="caption" color={CHROME.textMuted}>
            none yet — press a card or an avatar on the board
          </Label>
        ) : (
          observed.map((row, i) => <Row key={`${row.to}-${i}`} row={row} />)
        )}
      </View>

      <View style={{ gap: 6 }}>
        <Label role="caption" color={CHROME.textMuted}>
          DECLARED
        </Label>
        <Label role="caption" color={CHROME.textMuted}>
          read off the router directory, so the studio knows they exist without ever
          having watched one
        </Label>
        {declared.map((row, i) => <Row key={`${row.to}-${i}`} row={row} />)}
      </View>

      <View style={{ gap: 3 }}>
        <Label role="caption" color={TONE[gapCopy.tone]} style={{ fontWeight: '600' }}>
          {gapCopy.label}
        </Label>
        <Label role="caption" color={CHROME.textMuted}>
          {gapCopy.detail}
        </Label>
      </View>

      {exits.length > 0 ? (
        <View style={{ gap: 3 }}>
          <Label role="caption" color={CHROME.textMuted}>
            NO OUTGOING ROUTE
          </Label>
          <Label role="caption" color={CHROME.textMuted}>
            {exits.map((key) => screens.find((s) => s.key === key)?.label ?? key).join(', ')}
          </Label>
          <Label role="caption" color={CHROME.textMuted}>
            these are the app&rsquo;s exits, and their absence from the lists above is a
            fact about the app rather than missing data
          </Label>
        </View>
      ) : null}
    </View>
  );
}

/**
 * The board's frames, by their real DOM ids.
 *
 * `nativeID`, never a `data-*` prop: React Native Web filters unknown props off
 * `View`, so `data-screen-key` silently never reaches the document — and a walk
 * that finds zero frames while the panel reports something else is the failure this
 * repo has already shipped once.
 */
function framesFrom(host: View | null): { key: string; element: Element }[] {
  const node = host as unknown as HTMLElement | null;
  if (!node?.querySelector) return [];
  const frames: { key: string; element: Element }[] = [];
  for (const { key } of screens) {
    const element = node.querySelector(`#screen-${CSS.escape(key)}`);
    if (element) frames.push({ key, element });
  }
  return frames;
}