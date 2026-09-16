import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useTheme } from '../ds/store';
import { DesigningProvider } from './designing';
import { screens } from './screens';
import { Text } from '../ui';

const PHONE = { width: 390, height: 820 };
const CHROME = {
  bg: '#16120F',
  panel: '#211C18',
  panelSoft: '#2B251F',
  border: '#2A231E',
  text: '#F4EFE9',
  textMuted: '#9C928A',
};

/** One screen, constrained to a phone aspect ratio and labelled. */
function ScreenFrame({ index, label, children }: { index: number; label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 999,
            backgroundColor: '#D9481E',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text role="caption" style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>
            {index}
          </Text>
        </View>
        <Text role="label" style={{ color: CHROME.textMuted }}>
          {label}
        </Text>
        <View style={{ flex: 1, height: 1, backgroundColor: CHROME.border }} />
      </View>
      <View
        style={{
          width: PHONE.width,
          height: PHONE.height,
          borderRadius: 30,
          overflow: 'hidden',
          backgroundColor: CHROME.bg,
          borderWidth: 1,
          borderColor: CHROME.border,
          boxShadow: '0px 0px 0px 1px rgba(255,245,235,0.03), 0px 24px 60px rgba(0,0,0,0.55)',
        }}>
        {children}
      </View>
    </View>
  );
}

export function Blueprint() {
  const t = useTheme();
  const [scale, setScale] = useState(0.5);
  const workspaceRef = useRef<View>(null);

  // Ctrl+wheel to zoom, the way a design tool behaves. React Native Web doesn't
  // surface wheel events, so this attaches to the underlying DOM node directly.
  const handleWheel = useCallback((event: WheelEvent) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    setScale((prev) =>
      event.deltaY < 0 ? Math.min(prev + 0.03, 2) : Math.max(prev - 0.03, 0.25),
    );
  }, []);

  useEffect(() => {
    const node = workspaceRef.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;
    node.addEventListener('wheel', handleWheel, { passive: false });
    return () => node.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  return (
    <View ref={workspaceRef} style={{ flex: 1, backgroundColor: CHROME.bg }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text role="label" style={{ color: CHROME.text, letterSpacing: 1.2 }}>
          BLUEPRINT
        </Text>
        <View style={{ height: 16, width: 1, backgroundColor: CHROME.border }} />
        <Text role="caption" style={{ color: CHROME.textMuted }}>
          {screens.length} screens · live from the same components that ship
        </Text>
      </View>

      <ScrollView horizontal contentContainerStyle={{ padding: 24, paddingBottom: 24 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 32,
              transform: [{ scale }],
              transformOrigin: 'top left',
            }}>
            {screens.map(({ key, label, Component }, i) => (
              <ScreenFrame key={key} index={i + 1} label={label}>
                {/* Inside the artboard every screen is in "designing" mode, so a
                    tap renders inline instead of navigating the whole board away. */}
                <DesigningProvider>
                  <Component />
                </DesigningProvider>
              </ScreenFrame>
            ))}
          </View>
        </ScrollView>
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          backgroundColor: CHROME.panel,
          borderRadius: t.radius.pill,
          paddingVertical: 6,
          paddingHorizontal: 12,
        }}>
        <Text role="caption" style={{ color: CHROME.textMuted }}>
          {Math.round(scale * 100)}% · ctrl+scroll to zoom
        </Text>
      </View>
    </View>
  );
}