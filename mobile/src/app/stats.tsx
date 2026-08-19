import { View } from 'react-native';
import { streak, useHabits } from '../store/habits';
import { useTheme } from '../ds/store';
import { Card, Row, Screen, Text } from '../ui';

export default function Stats() {
  const t = useTheme();
  const habits = useHabits((s) => s.habits);

  const total = habits.reduce((n, h) => n + h.done.length, 0);
  const best = habits.reduce((a, b) => (streak(a) >= streak(b) ? a : b));
  const rate = Math.round((total / habits.reduce((n, h) => n + h.target, 0)) * 100);

  return (
    <Screen>
      <Text role="display">Stats</Text>

      <Row style={{ gap: t.space.sm }}>
        <Card style={{ flex: 1 }}>
          <Text role="label" color="textMuted">
            COMPLETION
          </Text>
          <Text role="display" style={{ color: t.color.accent }}>
            {rate}%
          </Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text role="label" color="textMuted">
            CHECK-INS
          </Text>
          <Text role="display">{total}</Text>
        </Card>
      </Row>

      <Card>
        <Text role="label" color="textMuted">
          BEST STREAK
        </Text>
        <Text role="title">{best.name}</Text>
        <Text role="body" color="success">
          {streak(best)} days running
        </Text>
      </Card>

      <Card>
        <Text role="label" color="textMuted">
          BY HABIT
        </Text>
        {habits.map((h) => (
          <Row key={h.id} style={{ justifyContent: 'space-between' }}>
            <Text role="body">{h.name}</Text>
            <Text role="body" color="textMuted">
              {h.done.length}/{h.target}
            </Text>
          </Row>
        ))}
      </Card>
    </Screen>
  );
}
