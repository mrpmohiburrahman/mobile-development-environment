import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { useTheme } from '../ds/store';
import '../theme';

export default function RootLayout() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.color.bg }}>
      <StatusBar style={t.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.color.bg } }} />
    </View>
  );
}
