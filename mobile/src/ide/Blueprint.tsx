import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { DesigningProvider } from './designing';
import { screens } from './screens';
import { TokensFrom } from '../ds/store';
import { CHROME, CHROME_RADIUS, TONE, frameShadow } from './chrome';
import { useCommittedTokens } from './BaselinePanel';
import { DiskBadge } from './DiskBadge';
import { Label } from './Label';
import { clipTarget, describePresses } from './presses';
import { recordPress, setPressListening, useSpine } from './spineStore';
import { RenderVerdictBadge } from './RenderVerdict';
import { ControlInventoryBadge } from './ControlInventoryBadge';
import { frameId, frameSelector, parseFrameId } from './boardFrames';

/**
 * How a press listener finds the frame it landed in.
 *
 * The frame's own DOM id — `#screen-<key>` or `#base-<key>` — and never a custom
 * `data-*` attribute. React Native Web filters unknown props off `View`, so a
 * `data-screen-key` silently never reaches the document; a pairing walk that finds
 * zero frames while the panel says the comparison "has not run yet" is the exact
 * failure this repo has already shipped once.
 *
 * The selector and the id prefixes live in `boardFrames.ts`, with the three other
 * walks that need them, so there is one rule rather than four copies of it.
 */
const FRAME_SELECTOR = frameSelector();

const PHONE = { width: 390, height: 820 };

/**
 * One screen, constrained to a phone aspect ratio and labelled.
 *
 * `nativeID` is how the drift walk pairs the two columns' nodes, and it is used
 * rather than a `data-screen-key` prop because RNW filters unknown props off `View`
 * — `data-*` silently never reached the DOM, and a pairing that quietly finds
 * nothing is worse than no pairing at all. `nativeID` maps to a real DOM id.
 *
 * The id comes from `frameId`, the same function the three walks resolve with, so
 * the board cannot build an id the walks do not look for. It embeds the stable key
 * `screens.ts` uses, so pairing does not depend on frame order surviving a
 * re-render.
 */
function ScreenFrame({
  index,
  label,
  screenKey,
  baseline = false,
  focused = false,
  children,
}: {
  index: number;
  label: string;
  screenKey: string;
  baseline?: boolean;
  /** Highlighted because the route panel is showing this frame's connections. */
  focused?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View nativeID={frameId(screenKey, baseline)} style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 999,
            backgroundColor: '#D9481E',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Label role="caption" color="#fff" style={{ fontSize: 11, fontWeight: '800' }}>
            {index}
          </Label>
        </View>
        <Label role="label" color={focused ? '#D9481E' : CHROME.textMuted}>
          {label}
        </Label>
        <View style={{ flex: 1, height: 1, backgroundColor: CHROME.border }} />
      </View>
      <View
        style={{
          width: PHONE.width,
          height: PHONE.height,
          borderRadius: 30,
          overflow: 'hidden',
          backgroundColor: CHROME.bg,
          // The highlight is the panel's selection made visible on the board, so a
          // reader who picks a frame in the list can find it in a row of seven. It
          // is chrome around the artboard and never a style inside it: the render
          // verdict measures what is inside, and a highlight that moved a token
          // would move the measurement it exists to check.
          borderWidth: focused ? 2 : 1,
          borderColor: focused ? '#D9481E' : CHROME.border,
          boxShadow: frameShadow(focused),
        }}>
        {children}
      </View>
    </View>
  );
}

/**
 * How many observed board presses changed something.
 *
 * This count covers observed presses, not distinct controls. The inventory shows
 * control declarations before any press. Both reports name the studio's limits.
 *
 * Read off `spine.tally` rather than re-counted from `spine.entries`: the entries
 * are a ring, so a tally taken from them shrinks when the cap evicts a row, and a
 * number that moves without anything happening is not a measurement. The tally is
 * accumulated at commit and survives eviction; `dropped` says what the ring lost.
 */
function PressBadge() {
  const spine = useSpine();
  const report = describePresses(spine.tally, spine.pressListening);

  return (
    <View style={{ gap: 2, maxWidth: 560 }}>
      <Label role="caption" color={TONE[report.tone]} style={{ fontWeight: '600' }} numberOfLines={1}>
        {report.label}
      </Label>
      <Label role="caption" color={CHROME.textMuted} numberOfLines={2}>
        {report.detail}
        {spine.dropped > 0 ? ` ${spine.dropped} older row${spine.dropped === 1 ? '' : 's'} left the ring; the count still includes them.` : ''}
      </Label>
    </View>
  );
}

/**
 * The board of screens, rendered from the real components.
 *
 * `comparing` adds a second column drawn from the tokens at `HEAD`, via
 * `TokensFrom`. Both columns use the same screen components, which is the whole
 * basis of the comparison — a baseline rendered with different components would
 * prove nothing. The two trees differ only in their tokens.
 *
 * `focus` is the frame the route panel is showing connections for. Owned by the
 * route, not by either side: the panel picks it and the board draws it, and neither
 * is the other's child.
 */
export function Blueprint({ comparing = false, focus = null }: { comparing?: boolean; focus?: string | null }) {
  const [scale, setScale] = useState(0.5);
  const workspaceRef = useRef<View>(null);

  // The committed tree, fetched only when the toggle is on. Null until then, and
  // null forever with no server — which is why the toggle is disabled there
  // rather than the column appearing empty.
  const { tree: baseline } = useCommittedTokens(comparing);

  // Ctrl+wheel to zoom, the way a design tool behaves. React Native Web doesn't
  // surface wheel events, so this attaches to the underlying DOM node directly.
  const handleWheel = useCallback((event: WheelEvent) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    setScale((prev) =>
      event.deltaY < 0 ? Math.min(prev + 0.03, 2) : Math.max(prev - 0.03, 0.25),
    );
  }, []);

  useEffect(() => {
    const node = workspaceRef.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;
    node.addEventListener('wheel', handleWheel, { passive: false });
    return () => node.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  /**
   * Every press on the board, recorded — **including presses the component
   * swallows**.
   *
   * Capture phase, and attached to the same workspace node the zoom listener
   * already attaches a wheel handler to, because capture runs before the
   * component's own handler. That is the only way to see a press the app decides
   * to ignore: the tab bar's four items, the avatar, the stats card. Without it
   * those presses leave no trace at all, and the board's silence reads as "nothing
   * is wrong" rather than "half these controls do nothing here".
   *
   * A press outside every frame is not counted. Empty workspace space is not a
   * control, and counting it would inflate the denominator with the one thing the
   * reader definitely did not mean to press.
   */
  const labels = useRef(new Map(screens.map((s) => [s.key, s.label])));
  useEffect(() => {
    const node = workspaceRef.current as unknown as HTMLElement | null;
    // Reported rather than assumed. With no node there is no listener, and a badge
    // that printed "nothing has been pressed yet" over a reader that never ran
    // would be the honest-zero failure wearing a press badge.
    if (!node?.addEventListener) {
      setPressListening(false);
      return;
    }

    const handle = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target?.closest) return;
      const frame = target.closest(FRAME_SELECTOR);
      // `contains` rather than truthiness: a nested frame cannot exist today, but a
      // listener attached to the wrong node would otherwise report it.
      if (!frame || !node.contains(frame)) return;

      const id = frame.id;
      const parsed = parseFrameId(id);
      if (!parsed) return;

      recordPress({
        frame: parsed.key,
        column: parsed.column,
        label: labels.current.get(parsed.key) ?? parsed.key,
        target: clipTarget(target.textContent),
      });
    };

    node.addEventListener('click', handle, true);
    setPressListening(true);
    return () => {
      node.removeEventListener('click', handle, true);
      setPressListening(false);
    };
  }, []);

  return (
    <View ref={workspaceRef} style={{ flex: 1, backgroundColor: CHROME.bg }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <Label role="label" color={CHROME.text} style={{ letterSpacing: 1.2 }}>
          BLUEPRINT
        </Label>
        <View style={{ height: 16, width: 1, backgroundColor: CHROME.border }} />
        <Label role="caption" color={CHROME.textMuted}>
          {screens.length} screens · live from the same components that ship
        </Label>
        <View style={{ flex: 1 }} />
        {/* Where an edit went. Lives in the header because that row is the one
            piece of chrome that outlives every ticket in this map, and because
            it sits next to the claim it qualifies. */}
        <DiskBadge />
      </View>

      {/* Board reports separate control declarations from observed presses and rendered styles. */}
      <View style={{ paddingHorizontal: 24, paddingTop: 10, gap: 8 }}>
        <ControlInventoryBadge host={workspaceRef} comparing={Boolean(baseline)} />
        <PressBadge />
        <RenderVerdictBadge host={workspaceRef} />
      </View>

      <ScrollView horizontal contentContainerStyle={{ padding: 24, paddingBottom: 24 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 32,
              transform: [{ scale }],
              transformOrigin: 'top left',
            }}>
            {screens.map(({ key, label, Component }, i) => (
              <ScreenFrame key={key} index={i + 1} label={label} screenKey={key} focused={focus === key}>
                {/* Inside the artboard every screen is in "designing" mode, so a
                    tap renders inline instead of navigating the whole board away.
                    The frame's key travels with it, so a route change and a press
                    can say where they happened. */}
                <DesigningProvider screenKey={key} column="current">
                  <Component />
                </DesigningProvider>
              </ScreenFrame>
            ))}

            {/* The same screens again, from the tokens at HEAD. Rendered from the
                same components on purpose: the claim is that the *tokens*
                drifted, and only an identical component tree can support that.
                A pinned source gets no override layer, so this column shows the
                committed state rather than a second copy of the edits. */}
            {baseline ? (
              <>
                <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: CHROME.border, marginVertical: 8 }} />
                <TokensFrom source={{ kind: 'pinned', tree: baseline, label: 'HEAD' }}>
                  <>
                    {screens.map(({ key, label, Component }, i) => (
                      <ScreenFrame
                        key={`base-${key}`}
                        index={i + 1}
                        label={`${label} · HEAD`}
                        screenKey={key}
                        baseline>
                        {/* The comparison column shares the same seam and the same
                            log. Marked as its own column, so a press there is never
                            read as evidence about the current one. */}
                        <DesigningProvider screenKey={key} column="comparison">
                          <Component />
                        </DesigningProvider>
                      </ScreenFrame>
                    ))}
                  </>
                </TokensFrom>
              </>
            ) : null}
          </View>
        </ScrollView>
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          backgroundColor: CHROME.panel,
          borderRadius: CHROME_RADIUS.pill,
          paddingVertical: 6,
          paddingHorizontal: 12,
        }}>
        <Label role="caption" color={CHROME.textMuted}>
          {Math.round(scale * 100)}% · ctrl+scroll to zoom
        </Label>
      </View>
    </View>
  );
}