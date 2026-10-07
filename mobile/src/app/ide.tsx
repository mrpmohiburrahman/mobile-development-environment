import { useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { Blueprint } from '../ide/Blueprint';
import { StatePanel } from '../ide/StatePanel';
import { TokenPanel } from '../ide/TokenPanel';
import { BaselinePanel, BaselineToggle } from '../ide/BaselinePanel';
import { CHROME, CHROME_RADIUS } from '../ide/chrome';
import { Label } from '../ide/Label';

type Tab = 'tokens' | 'state' | 'baseline';

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

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: CHROME.bg }}>
      <View style={{ width: 300, borderRightWidth: 1, borderRightColor: CHROME.border }}>
        <View style={{ flexDirection: 'row', gap: 6, padding: 12 }}>
          {(['tokens', 'state', 'baseline'] as Tab[]).map((name) => (
            <Pressable
              key={name}
              onPress={() => setTab(name)}
              style={({ pressed }) => ({
                paddingVertical: 5,
                paddingHorizontal: 12,
                borderRadius: CHROME_RADIUS.pill,
                backgroundColor: tab === name ? '#D9481E' : CHROME.panel,
                opacity: pressed ? 0.7 : 1,
              })}>
              <Label role="caption" color={tab === name ? '#fff' : CHROME.textMuted}>
                {name}
              </Label>
            </Pressable>
          ))}
        </View>
        <ScrollView contentContainerStyle={{ padding: 12, paddingTop: 0 }}>
          {tab === 'tokens' ? <TokenPanel /> : tab === 'state' ? <StatePanel /> : <BaselinePanel />}
        </ScrollView>
      </View>

      <View style={{ flex: 1 }}>
        {/* Always rendered, so the toggle sits next to the claim it qualifies. */}
        <View style={{ paddingHorizontal: 24, paddingTop: 16, alignItems: 'flex-start' }}>
          <BaselineToggle on={comparing} onChange={setComparing} />
        </View>
        <Blueprint comparing={comparing} />
      </View>
    </View>
  );
}
