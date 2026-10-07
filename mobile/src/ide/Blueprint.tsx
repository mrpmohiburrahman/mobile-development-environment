import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { DesigningProvider } from './designing';
import { screens } from './screens';
import { TokensFrom } from '../ds/store';
import { CHROME, CHROME_RADIUS } from './chrome';
import { useCommittedTokens } from './BaselinePanel';
import { DiskBadge } from './DiskBadge';
import { Label } from './Label';

const PHONE = { width: 390, height: 820 };

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
          <Label role="caption" color="#fff" style={{ fontSize: 11, fontWeight: '800' }}>
            {index}
          </Label>
        </View>
        <Label role="label" color={CHROME.textMuted}>
          {label}
        </Label>
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

/**
 * The board of screens, rendered from the real components.
 *
 * `comparing` adds a second column drawn from the tokens at `HEAD`, via
 * `TokensFrom`. Both columns use the same screen components, which is the whole
 * basis of the comparison — a baseline rendered with different components would
 * prove nothing. The two trees differ only in their tokens.
 */
export function Blueprint({ comparing = false }: { comparing?: boolean }) {
  const [scale, setScale] = useState(0.5);
  const workspaceRef = useRef<View>(null);

  // The committed tree, fetched only when the toggle is on. Null until then, and
  // null forever with no server — which is why the toggle is disabled there
  // rather than the column appearing empty.
  const { tree: baseline } = useCommittedTokens(comparing);

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
      <View style={{ paddingHorizontal: 24, paddingTop: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <Label role="label" color={CHROME.text} style={{ letterSpacing: 1.2 }}>
          BLUEPRINT
        </Label>
        <View style={{ height: 16, width: 1, backgroundColor: CHROME.border }} />
        <Label role="caption" color={CHROME.textMuted}>
          {screens.length} screens · live from the same components that ship
        </Label>
        <View style={{ flex: 1 }} />
        {/* Where an edit went. Lives in the header because that row is the one
            piece of chrome that outlives every ticket in this map, and because
            it sits next to the claim it qualifies. */}
        <DiskBadge />
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

            {/* The same screens again, from the tokens at HEAD. Rendered from the
                same components on purpose: the claim is that the *tokens*
                drifted, and only an identical component tree can support that.
                A pinned source gets no override layer, so this column shows the
                committed state rather than a second copy of the edits. */}
            {baseline ? (
              <>
                <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: CHROME.border, marginVertical: 8 }} />
                <TokensFrom source={{ kind: 'pinned', tree: baseline, label: 'HEAD' }}>
                  <>
                    {screens.map(({ key, label, Component }, i) => (
                      <ScreenFrame key={`base-${key}`} index={i + 1} label={`${label} · HEAD`}>
                        <DesigningProvider>
                          <Component />
                        </DesigningProvider>
                      </ScreenFrame>
                    ))}
                  </>
                </TokensFrom>
              </>
            ) : null}
          </View>
        </ScrollView>
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          backgroundColor: CHROME.panel,
          borderRadius: CHROME_RADIUS.pill,
          paddingVertical: 6,
          paddingHorizontal: 12,
        }}>
        <Label role="caption" color={CHROME.textMuted}>
          {Math.round(scale * 100)}% · ctrl+scroll to zoom
        </Label>
      </View>
    </View>
  );
}