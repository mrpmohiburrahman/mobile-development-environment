import { View } from 'react-native';
import { useNavigate } from '../ide/designing';
import { useHabits } from '../store/habits';
import { useTheme } from '../ds/store';
import { Button, Screen, Text } from '../ui';

export default function Login() {
  const t = useTheme();
  const signIn = useHabits((s) => s.signIn);
  const navigate = useNavigate();

  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, justifyContent: 'center', gap: t.space.lg }}>
        <View style={{ gap: t.space.xs }}>
          <Text role="display">Streak</Text>
          <Text role="body" color="textMuted">
            Six habits. One page. No streak anxiety.
          </Text>
        </View>
        <View style={{ gap: t.space.sm }}>
          <Button
            label="Sign in"
            onPress={() => {
              signIn();
              navigate('/');
            }}
          />
          <Button label="Create account" tone="quiet" />
        </View>
        <Text role="caption" color="textMuted">
          Demo build — sign in is a prop, no credentials go anywhere.
        </Text>
      </View>
    </Screen>
  );
}
