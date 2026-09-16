import { Pressable, View } from 'react-native';
import { useNavigate } from '../../ide/designing';
import { streak, useHabits } from '../../store/habits';
import { useTheme } from '../../ds/store';
import { Button, Card, Chip, Divider, Row, TabScreen, Text } from '../../ui';

export default function Profile() {
  const t = useTheme();
  const { habits, signedIn, signOut } = useHabits();
  const navigate = useNavigate();

  const longest = habits.reduce((n, h) => Math.max(n, streak(h)), 0);

  return (
    <TabScreen active="/profile">
      <View style={{ gap: t.space.sm }}>
        <View style={{ gap: 2 }}>
          <Text role="label" color="textMuted" style={{ textTransform: 'uppercase', letterSpacing: 1.2 }}>
            Account
          </Text>
          <Text role="display">Profile</Text>
        </View>

        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.md }}>
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: t.radius.pill,
              backgroundColor: t.color.accentSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text role="title" color="accent" style={{ fontSize: 22 }}>
              MR
            </Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text role="title" style={{ fontSize: 22 }}>
              Mohibur Rahman
            </Text>
            <Text role="caption" color="textMuted">
              React Native · Expo
            </Text>
          </View>
          <View style={{ gap: t.space.xs, alignItems: 'flex-end' }}>
            <Chip label={signedIn ? 'Signed in' : 'Signed out'} active={signedIn} tone={signedIn ? 'success' : 'accent'} />
          </View>
        </Card>

        <Card>
          <Text role="label" color="textMuted" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
            At a glance
          </Text>
          {[
            { label: 'Habits tracked', value: `${habits.length}` },
            { label: 'Longest streak', value: `${longest} days` },
            { label: 'This week, total', value: `${habits.reduce((n, h) => n + h.done.length, 0)} check-ins` },
          ].map((row, i) => (
            <View key={row.label}>
              {i > 0 ? <Divider /> : null}
              <Row style={{ justifyContent: 'space-between', paddingVertical: t.space.sm }}>
                <Text role="body" color="textMuted">
                  {row.label}
                </Text>
                <Text role="body" style={{ fontWeight: '600' }}>
                  {row.value}
                </Text>
              </Row>
            </View>
          ))}
        </Card>

        <Card quiet style={{ padding: 0 }}>
          <Pressable
            onPress={() => navigate('/settings')}
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: t.space.md,
                borderRadius: t.radius.lg,
              },
              pressed && { opacity: 0.6 },
            ]}>
            <Text role="body" style={{ fontWeight: '600' }}>
              Settings
            </Text>
            <Text role="title" color="textMuted" style={{ fontSize: 18 }}>
              ›
            </Text>
          </Pressable>
        </Card>

        <Button
          label="Sign out"
          tone="quiet"
          onPress={() => {
            signOut();
            navigate('/login');
          }}
        />
        <Text role="caption" color="textMuted" style={{ textAlign: 'center' }}>
          The token studio lives at /ide — drag a slider, watch every screen repaint.
        </Text>
      </View>
    </TabScreen>
  );
}