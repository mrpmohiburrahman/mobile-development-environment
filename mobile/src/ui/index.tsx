import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text as RNText, View, type ViewStyle } from 'react-native';
import { useTheme, type TypeRole } from '../ds/store';

type ColorKey = keyof ReturnType<typeof useTheme>['color'];

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
          fontSize: spec.size,
          fontWeight: spec.weight as any,
          lineHeight: spec.lineHeight,
          color: t.color[color],
        },
        style,
      ]}>
      {children}
    </RNText>
  );
}

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const t = useTheme();
  const inner = (
    <View style={{ padding: t.space.md, gap: t.space.md, flex: scroll ? undefined : 1 }}>{children}</View>
  );
  if (!scroll) return <View style={{ flex: 1, backgroundColor: t.color.bg }}>{inner}</View>;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.color.bg }} contentContainerStyle={{ paddingBottom: t.space.xl }}>
      {inner}
    </ScrollView>
  );
}

export function Card({ children, onPress, style }: { children: ReactNode; onPress?: () => void; style?: ViewStyle }) {
  const t = useTheme();
  const body = (
    <View
      style={[
        {
          backgroundColor: t.color.surface,
          borderRadius: t.radius.lg,
          borderWidth: 1,
          borderColor: t.color.border,
          padding: t.space.md,
          gap: t.space.sm,
        },
        style,
      ]}>
      {children}
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}

export function Button({
  label,
  onPress,
  tone = 'accent',
}: {
  label: string;
  onPress?: () => void;
  tone?: 'accent' | 'quiet';
}) {
  const t = useTheme();
  const accent = tone === 'accent';
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: accent ? t.color.accent : t.color.surfaceAlt,
        borderRadius: t.radius.md,
        paddingVertical: t.space.sm + 2,
        paddingHorizontal: t.space.md,
        alignItems: 'center',
      }}>
      <RNText
        style={{
          fontSize: t.type.label.size,
          fontWeight: t.type.label.weight as any,
          lineHeight: t.type.label.lineHeight,
          color: accent ? '#fff' : t.color.text,
        }}>
        {label}
      </RNText>
    </Pressable>
  );
}

export function Chip({ label, active = false }: { label: string; active?: boolean }) {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: active ? t.color.accentSoft : t.color.surfaceAlt,
        borderRadius: t.radius.pill,
        paddingVertical: t.space.xs,
        paddingHorizontal: t.space.sm + 2,
        alignSelf: 'flex-start',
      }}>
      <RNText
        style={{
          fontSize: t.type.caption.size,
          fontWeight: '600',
          color: active ? t.color.accent : t.color.textMuted,
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

/** Progress bar for "n of target days this week". */
export function Meter({ value, target }: { value: number; target: number }) {
  const t = useTheme();
  const pct = Math.min(100, Math.round((value / Math.max(1, target)) * 100));
  return (
    <View
      style={{
        height: t.space.sm,
        borderRadius: t.radius.pill,
        backgroundColor: t.color.surfaceAlt,
        overflow: 'hidden',
      }}>
      <View style={{ width: `${pct}%`, flex: 1, backgroundColor: pct >= 100 ? t.color.success : t.color.accent }} />
    </View>
  );
}
