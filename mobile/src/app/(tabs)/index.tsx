import { Pressable, View } from 'react-native';
import { useNavigate } from '../../ide/designing';
import { dateLabel, streak, today, useHabits, weekDays } from '../../store/habits';
import { useTheme } from '../../ds/store';
import {
  Brand,
  Button,
  Card,
  Chip,
  Meter,
  Row,
  Screen,
  TabScreen,
  Text,
} from '../../ui';

export default function Today() {
  const t = useTheme();
  const { habits, signedIn, signIn, toggleToday, select } = useHabits();
  const navigate = useNavigate();

  if (!signedIn) {
    return (
      <Screen scroll={false}>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            gap: t.space.lg,
            width: '100%',
            maxWidth: 400,
            alignSelf: 'center',
          }}>
          <View style={{ alignItems: 'center', gap: t.space.md }}>
            <Brand />
            <View style={{ alignItems: 'center', gap: t.space.xs }}>
              <Text role="display">Streak</Text>
              <Text role="body" color="textMuted" style={{ textAlign: 'center' }}>
                Small schedules, kept daily — one habit at a time.
              </Text>
            </View>
          </View>
          <View style={{ gap: t.space.sm }}>
            <Button label="Sign in" onPress={signIn} />
            <Button label="Create account" tone="quiet" />
          </View>
          <Text role="caption" color="textMuted" style={{ textAlign: 'center' }}>
            Demo build — sign in is a prop, no credentials go anywhere.
          </Text>
        </View>
      </Screen>
    );
  }

  const doneCount = habits.filter((h) => h.done.includes(today())).length;
  const bestStreak = habits.reduce((m, h) => Math.max(m, streak(h)), 0);
  const doneSet = new Set(habits.flatMap((h) => h.done));
  const week = weekDays();
  const catOf = {
    health: { fg: t.color.success, soft: t.color.successSoft },
    focus: { fg: t.color.accent, soft: t.color.accentSoft },
    craft: { fg: t.color.warning, soft: t.color.warningSoft },
  } as const;

  return (
    <TabScreen active="/">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ gap: 2 }}>
          <Text role="label" color="textMuted" style={{ textTransform: 'uppercase', letterSpacing: 1.2 }}>
            {dateLabel(today())}
          </Text>
          <Text role="display">Today</Text>
        </View>
        <Pressable
          onPress={() => navigate('/profile')}
          style={({ pressed }) => [
            {
              width: 44,
              height: 44,
              borderRadius: t.radius.pill,
              backgroundColor: t.color.accentSoft,
              alignItems: 'center',
              justifyContent: 'center',
            },
            pressed && { opacity: 0.7 },
          ]}>
          <Text role="label" color="accent">
            MR
          </Text>
        </Pressable>
      </View>

      <Card onPress={() => navigate('/stats')} style={{ flexDirection: 'row' }}>
        {[
          { label: 'DONE TODAY', value: `${doneCount}/${habits.length}`, color: t.color.accent },
          { label: 'BEST STREAK', value: `${bestStreak}d`, color: t.color.success },
        ].map((stat, i) => (
          <View key={stat.label} style={{ flex: 1, gap: 2, paddingLeft: i === 1 ? t.space.md : 0, borderLeftWidth: i === 1 ? 1 : 0, borderLeftColor: t.color.border }}>
            <Text role="caption" color="textMuted" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
              {stat.label}
            </Text>
            <Text role="title" style={{ color: stat.color }}>
              {stat.value}
            </Text>
          </View>
        ))}
      </Card>

      <Card>
        <Text role="label" color="textMuted" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
          This week
        </Text>
        <Row style={{ justifyContent: 'space-between' }}>
          {week.map((w) => {
            const done = doneSet.has(w.iso);
            return (
              <View key={w.iso} style={{ alignItems: 'center', gap: 4 }}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: t.radius.pill,
                    borderWidth: 2,
                    borderColor: done ? t.color.accent : t.color.border,
                    backgroundColor: done ? t.color.accent : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  {done ? <Text role="label" style={{ color: '#fff', fontSize: 13 }}>✓</Text> : null}
                </View>
                <Text role="caption" color="textMuted">
                  {w.weekday}
                </Text>
              </View>
            );
          })}
        </Row>
      </Card>

      <View style={{ gap: t.space.sm }}>
        {habits.map((h) => {
          const isDone = h.done.includes(today());
          const cat = catOf[h.category];
          return (
            <Card
              key={h.id}
              onPress={() => {
                select(h.id);
                navigate('/habit');
              }}>
              <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Row style={{ gap: 12, flex: 1 }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: t.radius.md,
                      backgroundColor: cat.soft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <View style={{ width: 12, height: 12, borderRadius: t.radius.pill, backgroundColor: cat.fg }} />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text role="title">{h.name}</Text>
                    <Row style={{ gap: t.space.sm }}>
                      <Chip
                        label={h.category}
                        active
                        tone={h.category === 'health' ? 'success' : h.category === 'focus' ? 'accent' : 'warning'}
                      />
                      <Text role="caption" color="textMuted">
                        {streak(h)}-day streak
                      </Text>
                    </Row>
                  </View>
                </Row>
                <Pressable
                  onPress={() => toggleToday(h.id)}
                  hitSlop={8}
                  style={({ pressed }) => [
                    {
                      width: 28,
                      height: 28,
                      borderRadius: t.radius.pill,
                      borderWidth: 2,
                      borderColor: isDone ? t.color.success : t.color.border,
                      backgroundColor: isDone ? t.color.success : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    },
                    pressed && { transform: [{ scale: 0.9 }] },
                  ]}>
                  {isDone ? <Text role="label" style={{ color: '#fff', fontSize: 13 }}>✓</Text> : null}
                </Pressable>
              </Row>
              <Meter value={h.done.length} target={h.target} />
            </Card>
          );
        })}
      </View>
    </TabScreen>
  );
}