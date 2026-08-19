import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useTheme } from '../ds/store';
import { DesigningProvider } from './designing';
import { screens } from './screens';
import { Text } from '../ui';

const PHONE = { width: 390, height: 844 };

/** One screen, constrained to a phone aspect ratio and labelled. */
function ScreenFrame({ label, children }: { label: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: t.space.sm }}>
      <Text role="label" style={{ color: '#8b8b8b' }}>
        {label}
      </Text>
      <View
        style={{
          width: PHONE.width,
          height: PHONE.height,
          borderRadius: 28,
          overflow: 'hidden',
          backgroundColor: t.color.bg,
          borderWidth: 1,
          borderColor: '#3a3a3a',
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
    <View ref={workspaceRef} style={{ flex: 1, backgroundColor: '#1b1b1b' }}>
      <ScrollView horizontal contentContainerStyle={{ padding: 32 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 32,
              transform: [{ scale }],
              transformOrigin: 'top left',
            }}>
            {screens.map(({ key, label, Component }) => (
              <ScreenFrame key={key} label={label}>
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
          backgroundColor: '#2a2a2a',
          borderRadius: t.radius.pill,
          paddingVertical: 6,
          paddingHorizontal: 12,
        }}>
        <Text role="caption" style={{ color: '#aaa' }}>
          {Math.round(scale * 100)}% · ctrl+scroll to zoom
        </Text>
      </View>
    </View>
  );
}
