import { View } from 'react-native';
import { streak, today, useHabits } from '../store/habits';
import { useTheme } from '../ds/store';
import { Button, Card, Chip, Meter, Row, Screen, Text } from '../ui';

export default function HabitDetail() {
  const t = useTheme();
  const { habits, selectedId, toggleToday } = useHabits();
  const habit = habits.find((h) => h.id === selectedId);

  if (!habit) {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: t.space.sm }}>
          <Text role="title">No habit selected</Text>
          <Text role="body" color="textMuted">
            Pick one from Today.
          </Text>
        </View>
      </Screen>
    );
  }

  const isDone = habit.done.includes(today());

  return (
    <Screen>
      <View style={{ gap: t.space.xs }}>
        <Chip label={habit.category} active />
        <Text role="display">{habit.name}</Text>
      </View>

      <Card>
        <Text role="label" color="textMuted">
          THIS WEEK
        </Text>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text role="title">
            {habit.done.length} / {habit.target}
          </Text>
          <Text role="body" color="accent">
            {streak(habit)} day streak
          </Text>
        </Row>
        <Meter value={habit.done.length} target={habit.target} />
      </Card>

      <Card>
        <Text role="label" color="textMuted">
          RECENT
        </Text>
        {habit.done.slice(0, 5).map((d) => (
          <Row key={d} style={{ justifyContent: 'space-between' }}>
            <Text role="body">{d}</Text>
            <Text role="body" color="success">
              ✓
            </Text>
          </Row>
        ))}
      </Card>

      <Button label={isDone ? 'Undo today' : 'Mark done today'} onPress={() => toggleToday(habit.id)} />
    </Screen>
  );
}
