import { useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { Blueprint } from '../ide/Blueprint';
import { StatePanel } from '../ide/StatePanel';
import { TokenPanel } from '../ide/TokenPanel';
import { CHROME, CHROME_RADIUS } from '../ide/chrome';
import { Label } from '../ide/Label';

type Tab = 'tokens' | 'state';

/**
 * The studio. This is a route in the mobile app, not a separate project — which
 * is the point: what you see here is compiled from the same components that
 * ship, so the blueprint cannot drift from the real thing.
 */
export default function IDE() {
  const [tab, setTab] = useState<Tab>('tokens');

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
      <View style={{ width: 280, borderRightWidth: 1, borderRightColor: CHROME.border }}>
        <View style={{ flexDirection: 'row', gap: 6, padding: 12 }}>
          {(['tokens', 'state'] as Tab[]).map((name) => (
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
          {tab === 'tokens' ? <TokenPanel /> : <StatePanel />}
        </ScrollView>
      </View>

      <Blueprint />
    </View>
  );
}
