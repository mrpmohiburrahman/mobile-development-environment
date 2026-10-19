import { useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { Blueprint } from '../ide/Blueprint';
import { CaptureSurface, useCaptureOutcome } from '../ide/CaptureSurface';
import { StatePanel } from '../ide/StatePanel';
import { RoutePanel } from '../ide/RoutePanel';
import { TokenPanel } from '../ide/TokenPanel';
import { AnalyticsPanel } from '../ide/AnalyticsPanel';
import { RegressionPanel } from '../ide/RegressionPanel';
import { BaselinePanel, BaselineToggle } from '../ide/BaselinePanel';
import { Drifted, useScreenDrift } from '../ide/ScreenDriftPanel';
import { attachSpine } from '../ide/spineStore';
import { useScreenState } from '../ide/screen.state';
import { CHROME, chipStyle } from '../ide/chrome';
import { Label } from '../ide/Label';

type Tab = 'tokens' | 'state' | 'routes' | 'baseline' | 'analytics' | 'regression';

/**
 * The tabs, in the order they are drawn.
 *
 * One list and one switch, and they are the only two places `Tab` is enumerated.
 * The chips used to be an inline array literal and the content a four-deep ternary
 * cascade over the same union, so adding a tab meant editing two unrelated
 * expressions and a missing case in either was silent.
 */
const TABS: Tab[] = ['tokens', 'state', 'routes', 'baseline', 'analytics', 'regression'];

/**
 * The studio. This is a route in the mobile app, not a separate project — which
 * is the point: what you see here is compiled from the same components that
 * ship, so the blueprint cannot drift from the real thing.
 */
export default function IDE() {
  const [tab, setTab] = useState<Tab>('tokens');
  // Whether the blueprint also draws the committed baseline. Kept here rather
  // than in the panel so the chrome owns layout state and the panel owns content.
  const [comparing, setComparing] = useState(false);
  // The frame the route panel is showing connections for. Owned here for the same
  // reason: the panel picks it and the board draws it, and neither is the other's
  // child, so the state has to live above both.
  const [focus, setFocus] = useState<string | null>(null);
  // The ref lands on the node holding both columns, so the drift walk can pair
  // them and the route panel can count the back controls it finds there. Owned
  // here because that node wraps the blueprint, not the panel.
  const { rootRef, screens, unpaired } = useScreenDrift(comparing);
  const presenting = useScreenState((s) => s.presenting);

  // The change log attaches here rather than at module scope, so "nothing has
  // happened yet" and "nothing is listening" stay two different sentences. Both
  // stores: the scheme lives on the other one and repaints every frame on the
  // board, which is the loudest interaction in the studio and used to be the one
  // the log said nothing about.
  //
  // The teardown matters as much as the attach. Leaving this route unsubscribes,
  // and `attachSpine` counts its holders so that coming back really does
  // resubscribe rather than finding a stale flag and reporting "watching" over a
  // subscription that no longer exists.
  useEffect(() => attachSpine(), []);

  const capture = useCaptureOutcome();
  if (Platform.OS === 'web' && capture.kind !== 'inactive') {
    return <CaptureSurface outcome={capture} />;
  }

  if (Platform.OS !== 'web') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 }}>
        <Label role="title">Studio is web-only</Label>
        <Label role="body" color={CHROME.textMuted}>
          Open this route in a browser. Token edits made there show up here live.
        </Label>
      </View>
    );
  }

  const content: Record<Tab, ReactNode> = {
    tokens: <TokenPanel />,
    state: <StatePanel />,
    routes: <RoutePanel host={rootRef} focus={focus} onFocusChange={setFocus} />,
    analytics: <AnalyticsPanel />,
    regression: <RegressionPanel />,
    baseline: (
      <View style={{ gap: 18 }}>
        {/* Two levels of the same comparison: which tokens differ, then
            which screens that touched. */}
        <BaselinePanel />
        <View style={{ gap: 6 }}>
          <Label role="label" color={CHROME.text} style={{ letterSpacing: 1 }}>
            SCREENS
          </Label>
          <Drifted screens={screens} unpaired={unpaired} />
        </View>
      </View>
    ),
  };

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: CHROME.bg }}>
      {!presenting && (
      <View style={{ width: 300, borderRightWidth: 1, borderRightColor: CHROME.border }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 12 }}>
          {TABS.map((name) => (
            <Pressable
              key={name}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === name }}
              onPress={() => setTab(name)}
              style={({ pressed }) => chipStyle({ active: tab === name, pressed, size: 'compact' }).container}>
              <Label
                role="caption"
                color={chipStyle({ active: tab === name, pressed: false, size: 'compact' }).textColor}>
                {name}
              </Label>
            </Pressable>
          ))}
        </View>
        <ScrollView contentContainerStyle={{ padding: 12, paddingTop: 0 }}>{content[tab]}</ScrollView>
      </View>
      )}

      <View ref={rootRef} style={{ flex: 1 }}>
        {/* Always rendered, so the toggle sits next to the claim it qualifies. */}
        {!presenting && (
        <View style={{ paddingHorizontal: 24, paddingTop: 16, alignItems: 'flex-start' }}>
          <BaselineToggle on={comparing} onChange={setComparing} />
        </View>
        )}
        <Blueprint comparing={comparing} focus={focus} />
      </View>
    </View>
  );
}
