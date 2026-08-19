import { View } from 'react-native';
import { useNavigate } from '../ide/designing';
import { streak, useHabits } from '../store/habits';
import { useTheme } from '../ds/store';
import { Button, Card, Row, Screen, Text } from '../ui';

export default function Profile() {
  const t = useTheme();
  const { habits, signedIn, signOut } = useHabits();
  const navigate = useNavigate();

  const longest = habits.reduce((n, h) => Math.max(n, streak(h)), 0);

  return (
    <Screen>
      <Row>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: t.radius.pill,
            backgroundColor: t.color.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text role="title" color="accent">
            MR
          </Text>
        </View>
        <View>
          <Text role="title">Mohibur Rahman</Text>
          <Text role="caption" color="textMuted">
            {signedIn ? 'Signed in' : 'Signed out'}
          </Text>
        </View>
      </Row>

      <Card>
        <Text role="label" color="textMuted">
          AT A GLANCE
        </Text>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text role="body">Habits tracked</Text>
          <Text role="body" color="accent">
            {habits.length}
          </Text>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text role="body">Longest streak</Text>
          <Text role="body" color="accent">
            {longest} days
          </Text>
        </Row>
      </Card>

      <Button
        label="Sign out"
        tone="quiet"
        onPress={() => {
          signOut();
          navigate('/login');
        }}
      />
    </Screen>
  );
}
