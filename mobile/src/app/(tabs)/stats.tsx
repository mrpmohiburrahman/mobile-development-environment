import { View } from 'react-native';
import { streak, useHabits } from '../../store/habits';
import { useTheme } from '../../ds/store';
import { Card, Divider, Meter, Row, TabScreen, Text } from '../../ui';

export default function Stats() {
  const t = useTheme();
  const habits = useHabits((s) => s.habits);

  const total = habits.reduce((n, h) => n + h.done.length, 0);
  const best = habits.reduce((a, b) => (streak(a) >= streak(b) ? a : b));
  const rate = Math.round((total / habits.reduce((n, h) => n + h.target, 0)) * 100);

  return (
    <TabScreen active="/stats">
      <View style={{ gap: t.space.sm }}>
        <View style={{ gap: 2 }}>
          <Text role="label" color="textMuted" style={{ textTransform: 'uppercase', letterSpacing: 1.2 }}>
            Momentum
          </Text>
          <Text role="display">Stats</Text>
        </View>

        <Row style={{ gap: t.space.md }}>
          <Card style={{ flex: 1 }} quiet>
            <Text role="caption" color="textMuted" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
              Completion
            </Text>
            <Text role="display" style={{ color: t.color.accent }}>
              {rate}%
            </Text>
          </Card>
          <Card style={{ flex: 1 }} quiet>
            <Text role="caption" color="textMuted" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
              Check-ins
            </Text>
            <Text role="display">{total}</Text>
          </Card>
        </Row>

        <Card>
          <Text role="label" color="textMuted" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
            Best streak
          </Text>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ gap: 2 }}>
              <Text role="display" style={{ color: t.color.success }}>
                {streak(best)}d
              </Text>
              <Text role="body">{best.name}</Text>
            </View>
            <Text role="caption" color="textMuted">
              longest active run
            </Text>
          </Row>
        </Card>

        <Card>
          <Text role="label" color="textMuted" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
            By habit
          </Text>
          {habits.map((h, i) => (
            <View key={h.id}>
              {i > 0 ? <Divider /> : null}
              <View style={{ gap: t.space.sm, paddingVertical: t.space.sm }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text role="body" style={{ fontWeight: '600' }}>
                    {h.name}
                  </Text>
                  <Text role="caption" color="textMuted">
                    {h.done.length}/{h.target}
                  </Text>
                </Row>
                <Meter value={h.done.length} target={h.target} />
              </View>
            </View>
          ))}
        </Card>
      </View>
    </TabScreen>
  );
}