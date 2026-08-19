import { View } from 'react-native';
import { useNavigate } from '../ide/designing';
import { streak, useHabits } from '../store/habits';
import { useTheme } from '../ds/store';
import { Card, Chip, Meter, Row, Screen, Text } from '../ui';

const CATEGORIES = ['health', 'focus', 'craft'] as const;

export default function AllHabits() {
  const t = useTheme();
  const { habits, select } = useHabits();
  const navigate = useNavigate();

  return (
    <Screen>
      <Text role="display">All habits</Text>
      {CATEGORIES.map((cat) => {
        const inCat = habits.filter((h) => h.category === cat);
        if (inCat.length === 0) return null;
        return (
          <View key={cat} style={{ gap: t.space.sm }}>
            <Chip label={cat} active />
            {inCat.map((h) => (
              <Card
                key={h.id}
                onPress={() => {
                  select(h.id);
                  navigate('/habit');
                }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text role="body">{h.name}</Text>
                  <Text role="label" color="accent">
                    {streak(h)}d
                  </Text>
                </Row>
                <Meter value={h.done.length} target={h.target} />
              </Card>
            ))}
          </View>
        );
      })}
    </Screen>
  );
}
