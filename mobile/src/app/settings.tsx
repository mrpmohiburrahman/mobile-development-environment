import { Pressable, View } from 'react-native';
import { useTheme, useTokenStore, type Scheme } from '../ds/store';
import { BackBar, Card, Divider, Row, Screen, Text } from '../ui';

function Toggle({ on, onPress }: { on: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: 46,
          height: 27,
          borderRadius: t.radius.pill,
          backgroundColor: on ? t.color.accent : t.color.surfaceAlt,
          padding: 3,
          justifyContent: 'center',
          alignItems: on ? 'flex-end' : 'flex-start',
        },
        pressed && { opacity: 0.8 },
      ]}>
      <View style={{ width: 21, height: 21, borderRadius: t.radius.pill, backgroundColor: '#fff' }} />
    </Pressable>
  );
}

function SchemeToggle() {
  const t = useTheme();
  const { scheme, setScheme } = useTokenStore();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: t.color.surfaceAlt,
        borderRadius: t.radius.md,
        padding: 3,
        gap: 2,
      }}>
      {(['light', 'dark'] as Scheme[]).map((s) => {
        const on = scheme === s;
        return (
          <Pressable
            key={s}
            onPress={() => setScheme(s)}
            style={({ pressed }) => [
              {
                flex: 1,
                paddingVertical: 7,
                borderRadius: t.radius.sm,
                alignItems: 'center',
                backgroundColor: on ? t.color.surface : 'transparent',
                boxShadow: on ? t.elevation.sm : undefined,
              },
              pressed && { opacity: 0.7 },
            ]}>
            <Text
              role="label"
              color={on ? 'text' : 'textMuted'}
              style={{ textTransform: 'capitalize' }}>
              {s}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function Settings() {
  const t = useTheme();

  return (
    <Screen>
      <BackBar />
      <View style={{ gap: t.space.sm }}>
        <View style={{ gap: 2 }}>
          <Text role="label" color="textMuted" style={{ textTransform: 'uppercase', letterSpacing: 1.2 }}>
            Preferences
          </Text>
          <Text role="display">Settings</Text>
        </View>

        <Card>
          <Text role="label" color="textMuted" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
            Appearance
          </Text>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text role="body">Theme</Text>
            <View style={{ width: 120 }}>
              <SchemeToggle />
            </View>
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text role="body">Dark mode follows system</Text>
            <Toggle on={false} onPress={() => {}} />
          </Row>
        </Card>

        <Card>
          <Text role="label" color="textMuted" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
            Reminders
          </Text>
          {['Daily nudge', 'Weekly summary', 'Streak at risk'].map((label, i) => (
            <View key={label}>
              {i > 0 ? <Divider /> : null}
              <Row style={{ justifyContent: 'space-between', paddingVertical: t.space.xs }}>
                <Text role="body">{label}</Text>
                <Toggle on={i !== 2} onPress={() => {}} />
              </Row>
            </View>
          ))}
        </Card>

        <Card>
          <Text role="label" color="textMuted" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
            About
          </Text>
          <Text role="body" color="textMuted">
            A design-token studio sealed inside an Expo app. Every colour, space, radius and type
            size here is live-editable from the /ide blueprint, and edits land as real git diffs.
          </Text>
        </Card>
      </View>
    </Screen>
  );
}