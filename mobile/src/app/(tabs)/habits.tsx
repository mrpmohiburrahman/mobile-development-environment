import { View } from 'react-native';
import { useNavigate } from '../../ide/designing';
import { streak, useHabits } from '../../store/habits';
import { useTheme } from '../../ds/store';
import { Card, Chip, Meter, Row, TabScreen, Text } from '../../ui';

const CATEGORIES = ['health', 'focus', 'craft'] as const;

export default function AllHabits() {
  const t = useTheme();
  const { habits, select } = useHabits();
  const navigate = useNavigate();

  const toneOf = (cat: (typeof CATEGORIES)[number]) =>
    cat === 'health' ? 'success' : cat === 'focus' ? 'accent' : 'warning';

  return (
    <TabScreen active="/habits">
      <View style={{ gap: t.space.sm }}>
        <View style={{ gap: 2 }}>
          <Text role="label" color="textMuted" style={{ textTransform: 'uppercase', letterSpacing: 1.2 }}>
            Library
          </Text>
          <Text role="display">All habits</Text>
        </View>
        {CATEGORIES.map((cat) => {
          const inCat = habits.filter((h) => h.category === cat);
          if (inCat.length === 0) return null;
          return (
            <View key={cat} style={{ gap: t.space.sm }}>
              <Row style={{ gap: t.space.sm, marginTop: t.space.sm }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: t.radius.pill,
                    backgroundColor: t.color[toneOf(cat)],
                  }}
                />
                <Text role="label" color="textMuted" style={{ textTransform: 'uppercase', letterSpacing: 1.2 }}>
                  {cat}
                </Text>
              </Row>
              {inCat.map((h) => (
                <Card
                  key={h.id}
                  onPress={() => {
                    select(h.id);
                    navigate('/habit');
                  }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Text role="body" style={{ fontWeight: '600' }}>
                      {h.name}
                    </Text>
                    <Chip
                      label={`${streak(h)}d`}
                      active
                      tone={toneOf(h.category)}
                    />
                  </Row>
                  <Meter value={h.done.length} target={h.target} />
                  <Text role="caption" color="textMuted">
                    {h.done.length} of {h.target} this week
                  </Text>
                </Card>
              ))}
            </View>
          );
        })}
      </View>
    </TabScreen>
  );
}