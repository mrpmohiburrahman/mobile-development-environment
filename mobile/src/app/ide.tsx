import { useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { Blueprint } from '../ide/Blueprint';
import { StatePanel } from '../ide/StatePanel';
import { TokenPanel } from '../ide/TokenPanel';
import { Text } from '../ui';

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
        <Text role="title">Studio is web-only</Text>
        <Text role="body" color="textMuted">
          Open this route in a browser. Token edits made there show up here live.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#141414' }}>
      <View style={{ width: 280, borderRightWidth: 1, borderRightColor: '#2a2a2a' }}>
        <View style={{ flexDirection: 'row', gap: 6, padding: 12 }}>
          {(['tokens', 'state'] as Tab[]).map((name) => (
            <Pressable
              key={name}
              onPress={() => setTab(name)}
              style={{
                paddingVertical: 5,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: tab === name ? '#E4572E' : '#242424',
              }}>
              <Text role="caption" style={{ color: tab === name ? '#fff' : '#999' }}>
                {name}
              </Text>
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
