import { useEffect, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  Text as RNText,
  View,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useDesigning } from '../ide/designing';
import { usePrototypeNavigation } from '../ide/prototypeNavigation';
import { useTheme, type TypeRole } from '../ds/store';

type ColorKey = keyof ReturnType<typeof useTheme>['color'];

/** Content is centred to a phone column on desktop web, full-bleed on device. */
const WEB_MAX = 680;

/**
 * Every component here reads tokens at render time rather than baking values in.
 * That is the whole reason a token edit repaints the entire blueprint at once.
 */

export function Text({
  children,
  role = 'body',
  color = 'text',
  style,
}: {
  children: ReactNode;
  role?: TypeRole;
  color?: ColorKey;
  style?: any;
}) {
  const t = useTheme();
  const spec = t.type[role];
  return (
    <RNText
      style={[
        {
          fontFamily: t.type.family,
          fontSize: spec.size,
          fontWeight: spec.weight as any,
          lineHeight: spec.lineHeight,
          letterSpacing: spec.letterSpacing ?? 0,
          color: t.color[color],
        },
        style,
      ]}>
      {children}
    </RNText>
  );
}

export function Screen({
  children,
  scroll = true,
  bottomPad,
}: {
  children: ReactNode;
  scroll?: boolean;
  bottomPad?: number;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const content: ViewStyle = {
    paddingTop: insets.top + t.space.sm,
    paddingHorizontal: t.space.md,
    paddingBottom: bottomPad ?? t.space.xl,
    gap: t.space.md,
    flex: scroll ? undefined : 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? WEB_MAX : undefined,
    alignSelf: 'center',
  };
  if (!scroll) {
    return (
      <View style={{ flex: 1, backgroundColor: t.color.bg }}>
        <View style={content}>{children}</View>
      </View>
    );
  }
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.color.bg }} contentContainerStyle={content}>
      {children}
    </ScrollView>
  );
}

/** A main screen: token-driven page over a sticky bottom tab bar. */
export function TabScreen({ active, children }: { active: string; children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.color.bg }}>
      <View style={{ flex: 1, width: '100%', maxWidth: Platform.OS === 'web' ? WEB_MAX : undefined, alignSelf: 'center' }}>
        <View style={{ flex: 1 }}>
          <Screen bottomPad={132}>{children}</Screen>
        </View>
        <TabBar active={active} />
      </View>
    </View>
  );
}

type IconName = 'today' | 'grid' | 'bars' | 'user';

/** Tiny vector icons, drawn from Views so they tint with the theme anywhere. */
function Icon({ name, color, size = 20 }: { name: IconName; color: string; size?: number }) {
  const s = size;
  switch (name) {
    case 'today':
      return (
        <View style={{ width: s, height: s, justifyContent: 'center', alignItems: 'center' }}>
          <View
            style={{
              width: s,
              height: s,
              borderRadius: s / 2,
              borderWidth: 2,
              borderColor: color,
            }}
          />
          <View style={{ position: 'absolute', width: s * 0.32, height: s * 0.32, borderRadius: s, backgroundColor: color }} />
        </View>
      );
    case 'grid': {
      const cell = Math.floor((s - 4) / 2);
      return (
        <View style={{ width: s, height: s, flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ width: cell, height: cell, borderRadius: 3, backgroundColor: color }} />
          ))}
        </View>
      );
    }
    case 'bars':
      return (
        <View style={{ width: s, height: s, flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
          {[18, 12, 7, 15].map((k, i) => (
            <View key={i} style={{ flex: 1, height: k, borderRadius: 3, backgroundColor: color }} />
          ))}
        </View>
      );
    case 'user':
      return (
        <View style={{ width: s, height: s }}>
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: s * 0.34,
              width: s * 0.32,
              height: s * 0.32,
              borderRadius: s,
              backgroundColor: color,
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: s * 0.05,
              width: s * 0.9,
              height: s * 0.42,
              borderTopLeftRadius: s,
              borderTopRightRadius: s,
              backgroundColor: color,
            }}
          />
        </View>
      );
  }
}

type TabDef = { key: string; label: string; icon: IconName };

export function TabBar({ active }: { active: string }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const designing = useDesigning();
  const prototypeNavigation = usePrototypeNavigation();
  const tabs: TabDef[] = [
    { key: '/', label: 'Today', icon: 'today' },
    { key: '/habits', label: 'Habits', icon: 'grid' },
    { key: '/stats', label: 'Stats', icon: 'bars' },
    { key: '/profile', label: 'Profile', icon: 'user' },
  ];
  return (
    <View
      style={{
        backgroundColor: t.color.surface,
        borderTopWidth: 1,
        borderTopColor: t.color.border,
        paddingTop: t.space.xs,
        paddingBottom: insets.bottom + t.space.sm,
        boxShadow: t.elevation.md,
      }}>
      <View style={{ flexDirection: 'row' }}>
        {tabs.map((tab) => {
          const on = tab.key === active;
          return (
            <Pressable
              key={tab.key}
              onPress={() => {
                if (designing) {
                  prototypeNavigation?.('tab', tab.key);
                  return;
                }
                router.navigate(tab.key as never);
              }}
              style={({ pressed }) => [
                { flex: 1, alignItems: 'center', gap: 3, paddingVertical: t.space.xs },
                pressed && { opacity: 0.6 },
              ]}>
              <View
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 4,
                  borderRadius: t.radius.pill,
                  backgroundColor: on ? t.color.accentSoft : 'transparent',
                }}>
                <Icon name={tab.icon} color={on ? t.color.accent : t.color.textMuted} />
              </View>
              <RNText
                style={{
                  fontFamily: t.type.family,
                  fontSize: 11,
                  fontWeight: '600',
                  color: on ? t.color.accent : t.color.textMuted,
                }}>
                {tab.label}
              </RNText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Back affordance for pushed screens; safe under the design context. */
export function BackBar({ to = '/' }: { to?: string }) {
  const t = useTheme();
  const router = useRouter();
  const designing = useDesigning();
  const prototypeNavigation = usePrototypeNavigation();
  return (
    <Pressable
      onPress={() => {
        if (designing) {
          prototypeNavigation?.('back');
          return;
        }
        if (router.canGoBack()) router.back();
        else router.replace(to as never);
      }}
      style={({ pressed }) => [
        {
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
          paddingVertical: 6,
          paddingHorizontal: 10,
          marginLeft: -10,
          borderRadius: t.radius.md,
        },
        pressed && { opacity: 0.5 },
      ]}>
      <RNText style={{ fontFamily: t.type.family, fontSize: 22, lineHeight: 22, color: t.color.textMuted }}>‹</RNText>
      <Text role="label" color="textMuted">
        Back
      </Text>
    </Pressable>
  );
}

export function Card({
  children,
  onPress,
  style,
  quiet = false,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  quiet?: boolean;
}) {
  const t = useTheme();
  const body = (
    <View
      style={[
        {
          backgroundColor: quiet ? t.color.surfaceAlt : t.color.surface,
          borderRadius: t.radius.lg,
          borderWidth: 1,
          borderColor: quiet ? 'transparent' : t.color.border,
          padding: t.space.md,
          gap: t.space.sm,
          boxShadow: quiet ? undefined : t.elevation.sm,
        },
        style,
      ]}>
      {children}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }]}>
      {body}
    </Pressable>
  );
}

export function Button({
  label,
  onPress,
  tone = 'accent',
  small = false,
}: {
  label: string;
  onPress?: () => void;
  tone?: 'accent' | 'quiet' | 'success';
  small?: boolean;
}) {
  const t = useTheme();
  const accent = tone === 'accent';
  const success = tone === 'success';
  const quiet = tone === 'quiet';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          height: small ? 40 : 50,
          borderRadius: t.radius.md,
          paddingHorizontal: t.space.lg,
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'stretch',
          backgroundColor: accent ? t.color.accent : success ? t.color.success : t.color.surface,
          borderWidth: quiet || success ? 1 : 0,
          borderColor: quiet ? t.color.border : success ? 'transparent' : undefined,
          boxShadow: accent || success ? t.elevation.sm : undefined,
        },
        pressed && { transform: [{ scale: 0.985 }], opacity: 0.88 },
      ]}>
      <RNText
        style={{
          fontFamily: t.type.family,
          fontSize: t.type.label.size,
          fontWeight: '600',
          lineHeight: t.type.label.lineHeight,
          letterSpacing: 0.2,
          color: accent || success ? '#fff' : t.color.text,
        }}>
        {label}
      </RNText>
    </Pressable>
  );
}

const TONES = { accent: 'accent', success: 'success', warning: 'warning' } as const;
export type ChipTone = keyof typeof TONES;

export function Chip({
  label,
  active = false,
  tone = 'accent',
}: {
  label: string;
  active?: boolean;
  tone?: ChipTone;
}) {
  const t = useTheme();
  const key = TONES[tone];
  const fg = active ? t.color[key] : t.color.textMuted;
  const bg = active ? t.color[`${key}Soft` as 'accentSoft'] : t.color.surfaceAlt;
  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: t.radius.pill,
        paddingVertical: 3,
        paddingHorizontal: t.space.sm + 2,
        alignSelf: 'flex-start',
      }}>
      <RNText
        style={{
          fontFamily: t.type.family,
          fontSize: t.type.caption.size,
          fontWeight: '600',
          lineHeight: t.type.caption.lineHeight,
          color: fg,
        }}>
        {label}
      </RNText>
    </View>
  );
}

export function Row({ children, gap, style }: { children: ReactNode; gap?: number; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: gap ?? t.space.sm }, style]}>{children}</View>
  );
}

export function Divider() {
  const t = useTheme();
  return <View style={{ height: 1, backgroundColor: t.color.border }} />;
}

/** Progress bar for "n of target days this week". */
export function Meter({ value, target }: { value: number; target: number }) {
  const t = useTheme();
  const pct = Math.min(100, Math.round((value / Math.max(1, target)) * 100));
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = withTiming(pct / 100, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [pct, fill]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.value }] }));
  return (
    <View
      style={{
        height: 8,
        borderRadius: t.radius.pill,
        backgroundColor: t.color.surfaceAlt,
        overflow: 'hidden',
      }}>
      <Animated.View
        style={[
          {
            height: '100%',
            borderRadius: t.radius.pill,
            backgroundColor: pct >= 100 ? t.color.success : t.color.accent,
            transformOrigin: 'left',
          },
          animated,
        ]}
      />
    </View>
  );
}

/** Brand mark: the streak bars inside a rounded tile. */
export function Brand({ size = 64 }: { size?: number }) {
  const t = useTheme();
  const bar = (h: number) => (
    <View
      style={{
        width: 8,
        height: h,
        borderRadius: t.radius.pill,
        backgroundColor: t.color.accent,
      }}
    />
  );
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: t.radius.lg,
        backgroundColor: t.color.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 5,
      }}>
      {bar(14)}
      {bar(24)}
      {bar(34)}
    </View>
  );
}