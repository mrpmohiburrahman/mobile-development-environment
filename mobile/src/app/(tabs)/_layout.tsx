import { Tabs } from 'expo-router';

/**
 * The four main screens live in a real tab navigator, so switching between
 * them is an instant in-place swap — not a stack push. The visible tab bar is
 * the token-driven <TabBar /> we draw ourselves (`tabBarStyle display none`
 * hides the navigator's own bar); this exists purely to give the routes tab
 * semantics: no card stack, no back-swipe through tabs.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}
    />
  );
}