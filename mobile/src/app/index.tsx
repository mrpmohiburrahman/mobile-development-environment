import { Pressable, View } from 'react-native';
import { useNavigate } from '../ide/designing';
import { streak, today, useHabits } from '../store/habits';
import { useTheme } from '../ds/store';
import { Card, Chip, Meter, Row, Screen, Text } from '../ui';

export default function Today() {
  const t = useTheme();
  const { habits, signedIn, toggleToday, select } = useHabits();
  const navigate = useNavigate();

  if (!signedIn) {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: t.space.sm }}>
          <Text role="title">Signed out</Text>
          <Text role="body" color="textMuted">
            Sign in to see today.
          </Text>
        </View>
      </Screen>
    );
  }

  const doneCount = habits.filter((h) => h.done.includes(today())).length;

  return (
    <Screen>
      <View style={{ gap: t.space.xs }}>
        <Text role="display">Today</Text>
        <Text role="body" color="textMuted">
          {doneCount} of {habits.length} done
        </Text>
      </View>

      {habits.map((h) => {
        const isDone = h.done.includes(today());
        return (
          <Card
            key={h.id}
            onPress={() => {
              select(h.id);
              navigate('/habit');
            }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text role="title">{h.name}</Text>
              <Pressable
                onPress={() => toggleToday(h.id)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: t.radius.pill,
                  borderWidth: 2,
                  borderColor: isDone ? t.color.success : t.color.border,
                  backgroundColor: isDone ? t.color.success : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                {isDone ? <Text role="label" style={{ color: '#fff' }}>✓</Text> : null}
              </Pressable>
            </Row>
            <Row>
              <Chip label={h.category} active={isDone} />
              <Text role="caption" color="textMuted">
                {streak(h)} day streak
              </Text>
            </Row>
            <Meter value={h.done.length} target={h.target} />
          </Card>
        );
      })}
    </Screen>
  );
}
