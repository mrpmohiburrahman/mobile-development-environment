import { View } from 'react-native';
import { streak, today, useHabits } from '../store/habits';
import { useTheme } from '../ds/store';
import { BackBar, Button, Card, Chip, Divider, Meter, Row, Screen, Text } from '../ui';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function HabitDetail() {
  const t = useTheme();
  const { habits, selectedId, toggleToday } = useHabits();
  const habit = habits.find((h) => h.id === selectedId);

  if (!habit) {
    return (
      <Screen scroll={false}>
        <BackBar />
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
      <BackBar />

      <View style={{ gap: t.space.sm }}>
        <Chip
          label={habit.category}
          active
          tone={habit.category === 'health' ? 'success' : habit.category === 'focus' ? 'accent' : 'warning'}
        />
        <Text role="display">{habit.name}</Text>
      </View>

      <Card>
        <Text role="label" color="textMuted" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
          This week
        </Text>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ gap: 2 }}>
            <Text role="display">
              {habit.done.length}
              <Text role="title" color="textMuted">
                {' '}
                / {habit.target}
              </Text>
            </Text>
            <Text role="caption" color="textMuted">
              target {habit.target} days
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <Text role="display" style={{ color: t.color.accent, fontSize: 26, lineHeight: 32 }}>
              {streak(habit)}d
            </Text>
            <Text role="caption" color="textMuted">
              current streak
            </Text>
          </View>
        </Row>
        <Meter value={habit.done.length} target={habit.target} />
      </Card>

      <Card>
        <Text role="label" color="textMuted" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
          Recent
        </Text>
        {habit.done.slice(0, 7).map((d, i) => (
          <View key={d}>
            {i > 0 ? <Divider /> : null}
            <Row style={{ justifyContent: 'space-between', paddingVertical: t.space.sm }}>
              <Row style={{ gap: t.space.sm }}>
                <Text role="body" style={{ fontWeight: '600', textTransform: 'none' }}>
                  {WEEKDAYS[new Date(d).getDay()]}
                </Text>
                <Text role="caption" color="textMuted">
                  {d.slice(0, 10)}
                </Text>
              </Row>
              <Text role="label" color="success">
                ✓
              </Text>
            </Row>
          </View>
        ))}
      </Card>

      <Button
        label={isDone ? 'Logged for today · tap to undo' : 'Mark done today'}
        tone={isDone ? 'success' : 'accent'}
        onPress={() => toggleToday(habit.id)}
      />
    </Screen>
  );
}