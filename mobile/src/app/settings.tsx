import { Pressable, View } from 'react-native';
import { useTheme, useTokenStore } from '../ds/store';
import { Card, Row, Screen, Text } from '../ui';

function Toggle({ on, onPress }: { on: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 44,
        height: 26,
        borderRadius: t.radius.pill,
        backgroundColor: on ? t.color.accent : t.color.surfaceAlt,
        padding: 3,
        justifyContent: 'center',
        alignItems: on ? 'flex-end' : 'flex-start',
      }}>
      <View style={{ width: 20, height: 20, borderRadius: t.radius.pill, backgroundColor: '#fff' }} />
    </Pressable>
  );
}

export default function Settings() {
  const t = useTheme();
  const { scheme, setScheme } = useTokenStore();

  return (
    <Screen>
      <Text role="display">Settings</Text>

      <Card>
        <Text role="label" color="textMuted">
          APPEARANCE
        </Text>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text role="body">Dark theme</Text>
          <Toggle on={scheme === 'dark'} onPress={() => setScheme(scheme === 'dark' ? 'light' : 'dark')} />
        </Row>
      </Card>

      <Card>
        <Text role="label" color="textMuted">
          REMINDERS
        </Text>
        {['Daily nudge', 'Weekly summary', 'Streak at risk'].map((label, i) => (
          <Row key={label} style={{ justifyContent: 'space-between' }}>
            <Text role="body">{label}</Text>
            <Toggle on={i !== 2} onPress={() => {}} />
          </Row>
        ))}
      </Card>

      <Card>
        <Text role="label" color="textMuted">
          ABOUT
        </Text>
        <Text role="body" color="textMuted">
          Demo app for a design-token studio built on Expo web. Every colour, space, radius and type
          size on this screen is editable live from the /ide route.
        </Text>
      </Card>
    </Screen>
  );
}
