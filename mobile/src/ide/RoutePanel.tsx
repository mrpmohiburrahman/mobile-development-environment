import { useEffect, useState, type RefObject } from 'react';
import { Pressable, View } from 'react-native';
import {
  ROUTE_PROVENANCE,
  ROUTE_PROVENANCES,
  buildRouteList,
  routeCounts,
  backGap,
  describeBackGap,
  exitReport,
  routesOutOf,
  type RouteGap,
  type RouteProvenance,
  type RouteRow,
} from './routes';
import { formatPath } from './spine';
import { useSpine } from './spineStore';
import { routerKeys, screens } from './screens';
import { countBackControls } from './renderFidelity.dom';
import { resolveFrames } from './boardFrames';
import { CHROME, TONE, chipStyle } from './chrome';
import { Label } from './Label';

function Chip({ label, active, pick }: { label: string; active: boolean; pick: () => void }) {
  return (
    <Pressable
      onPress={pick}
      style={({ pressed }) => chipStyle({ active, pressed, size: 'compact' }).container}>
      <Label role="caption" color={chipStyle({ active, pressed: false, size: 'compact' }).textColor}>
        {label}
      </Label>
    </Pressable>
  );
}

function Row({ row }: { row: RouteRow }) {
  return (
    <View style={{ gap: 1, paddingBottom: 4 }}>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <Label role="caption" color={CHROME.textMuted} style={{ fontFamily: 'monospace' }} numberOfLines={1}>
          {row.from ?? 'unknown'} → {row.to}
        </Label>
        <Label role="caption" color={TONE[ROUTE_PROVENANCE[row.provenance].tone]} style={{ fontWeight: '600' }}>
          {ROUTE_PROVENANCE[row.provenance].label}
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
 * The frame picker: pick a screen and the list narrows to its connections.
 *
 * A list of every route answers "how does this app connect", and a board of seven
 * frames answers "which screens exist" — but the question a reader actually arrives
 * with is usually smaller than either: *what can I reach from here*. Highlighting
 * the frame on the board and narrowing the list to it answers that one, and the
 * board-side highlight is what stops the two halves reading as unrelated widgets.
 */
function FramePicker({ focus, onChange }: { focus: string | null; onChange: (key: string | null) => void }) {
  return (
    <View style={{ gap: 6 }}>
      <Label role="caption" color={CHROME.textMuted}>
        ONE FRAME&rsquo;S CONNECTIONS
      </Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
        <Chip label="all" active={focus === null} pick={() => onChange(null)} />
        {screens.map((screen) => (
          <Chip
            key={screen.key}
            label={screen.label}
            active={focus === screen.key}
            pick={() => onChange(focus === screen.key ? null : screen.key)}
          />
        ))}
      </View>
      <Label role="caption" color={CHROME.textMuted}>
        {focus === null
          ? 'pick a frame to narrow the list and highlight it on the board'
          : 'the matching frame is outlined on the board; pick it again, or all, to widen back out'}
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
 * ## Why the observed count is the seam's, not the list's
 *
 * A count taken from the list's own length cannot disagree with the list, so
 * printing it would prove nothing. The headline number is the seam's tally —
 * incremented as a route passes through, never read back off the rows — and the
 * list's own length is printed beside it as the cross-check. When the two differ,
 * the panel says so in words, because that difference is the only evidence anyone
 * would ever get that the list drew a route it never saw.
 *
 * ## Where the sections come from
 *
 * `ROUTE_PROVENANCES`, the runtime table in `routes.ts`. The panel maps over it
 * rather than hard-coding three sections, so a provenance added there appears here
 * with its own heading, colour and wording — and one added to the union *without*
 * a table row is caught by the test that walks the union, instead of being silently
 * dropped from the UI.
 *
 * ## Where the back control sits
 *
 * In the gaps, with a count, and never as a row. `router.back()` resolves against
 * history at press time, so there is no static edge to draw; a gap shown as zero
 * would read as "there are none", so zero is worded differently from a count the
 * studio could not take at all.
 */
export function RoutePanel({
  host,
  focus = null,
  onFocusChange,
}: {
  host: RefObject<View | null>;
  /** The frame whose connections to show, or null for the whole board. */
  focus?: string | null;
  onFocusChange?: (key: string | null) => void;
}) {
  const spine = useSpine();
  const [gap, setGap] = useState<RouteGap>(() => backGap(null));

  // Counted from the board rather than declared from source, so the number is the
  // number actually rendered — and it moves: the habit detail screen only draws a
  // back bar once a habit is selected, which is itself a state change the log
  // knows about. So it is re-read whenever the log moves.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const resolved = resolveFrames(host.current, screens.map((s) => s.key));
      // `null` when the board itself is not there. Zero would be a claim about the
      // app, and the difference matters: the count is a reading, not a finding.
      setGap(backGap(resolved.found === 0 ? null : countBackControls(resolved.frames), resolved.missing));
    });
    return () => cancelAnimationFrame(id);
  }, [host, spine.seq]);

  const rows = buildRouteList(spine.entries, routerKeys);
  // The seam's own tally is the headline; the list's length is the cross-check.
  const counts = routeCounts(rows, [gap], spine.routeEvents);
  const gapCopy = describeBackGap(gap);
  const exits = exitReport(rows, routerKeys, spine.routeEvents);

  // Narrowed to one frame when the reader picked one. `routesOutOf` decides what a
  // frame's connections are — including that a tab screen's exits are declared
  // rather than watched — so the panel is not the place that rule lives.
  const scoped = focus === null ? null : routesOutOf(rows, focus, routerKeys, [gap]);
  const rowsFor = (provenance: RouteProvenance): RouteRow[] => {
    // A gap is a control, not a route, so it never has rows in any scope.
    if (provenance === 'unresolved') return [];
    if (scoped) return scoped[provenance];
    return rows.filter((r) => r.provenance === provenance);
  };

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
        {/* The cross-check, printed when it fails. The headline is the seam's tally
            and this is the list's own length, so a disagreement between them is
            evidence rather than a restatement. */}
        {counts.listed !== counts.observed ? (
          <Label role="caption" color={TONE.degraded}>
            the seam saw {counts.observed} and the list holds {counts.listed} — the list is drawing
            something it did not observe
          </Label>
        ) : null}
      </View>

      {onFocusChange ? <FramePicker focus={focus} onChange={onFocusChange} /> : null}

      {ROUTE_PROVENANCES.map((provenance) => {
        const copy = ROUTE_PROVENANCE[provenance];
        const section = rowsFor(provenance);

        return (
          <View key={provenance} style={{ gap: 6 }}>
            <Label role="caption" color={CHROME.textMuted}>
              {copy.label.toUpperCase()}
            </Label>
            <Label role="caption" color={CHROME.textMuted}>
              {copy.note}
            </Label>

            {/* The gap is the unresolved section's content: a control with a count,
                worded by `describeBackGap` so "none right now", "N unresolvable" and
                "could not count them" never collapse into one line. */}
            {provenance === 'unresolved' ? (
              <View style={{ gap: 3 }}>
                <Label role="caption" color={TONE[gapCopy.tone]} style={{ fontWeight: '600' }}>
                  {gapCopy.label}
                </Label>
                <Label role="caption" color={CHROME.textMuted}>
                  {gapCopy.detail}
                </Label>
                {focus !== null ? (
                  <Label role="caption" color={CHROME.textMuted}>
                    counted board-wide, so the studio cannot say which frames carry one
                  </Label>
                ) : null}
                {gap.missingFrom.length > 0 ? (
                  <Label role="caption" color={TONE.degraded}>
                    {gap.missingFrom.length} frame{gap.missingFrom.length === 1 ? '' : 's'} did not mount, so
                    this count is not the whole board
                  </Label>
                ) : null}
              </View>
            ) : section.length === 0 ? (
              <Label role="caption" color={CHROME.textMuted}>
                {copy.empty}
              </Label>
            ) : (
              section.map((row, i) => <Row key={`${row.to}-${i}`} row={row} />)
            )}
          </View>
        );
      })}

      <View style={{ gap: 3 }}>
        <Label role="caption" color={CHROME.textMuted}>
          NO OUTGOING ROUTE OBSERVED
        </Label>
        {exits.unobserved.length === 0 ? (
          <Label role="caption" color={CHROME.textMuted}>
            every screen off the tab bar has been seen navigating away from
          </Label>
        ) : (
          <>
            <Label role="caption" color={CHROME.textMuted}>
              {exits.unobserved.map((key) => screens.find((s) => s.key === key)?.label ?? key).join(', ')}
            </Label>
            {/* What this list holds is absence of evidence, and it says so. Some of
                these really are the app's exits; the rest have simply not been
                pressed. Naming the difference is cheaper than being wrong about it. */}
            <Label role="caption" color={CHROME.textMuted}>
              {exits.measured
                ? 'the studio never saw these navigate away from. Some are the app’s real exits and some have not been pressed, and from here the two look the same.'
                : 'no route has been observed yet, so this is every screen the tab bar does not cover. Press a card or an avatar on the board and the ones that navigate will leave this list.'}
            </Label>
          </>
        )}
        {exits.viaTabBar.length > 0 ? (
          <Label role="caption" color={CHROME.textMuted}>
            {exits.viaTabBar.map((key) => screens.find((s) => s.key === key)?.label ?? key).join(', ')} are
            off the tab bar, so their exits are declared from the router directory rather than watched
          </Label>
        ) : null}
      </View>
    </View>
  );
}
