import { createElement, useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { useTokenStore, useTokens, type Scheme } from '../ds/store';
import { CHROME, CHROME_RADIUS, TONE } from './chrome';
import { Label } from './Label';
import { ShadowInput } from './ShadowInput';

/**
 * Editors are raw DOM inputs. The IDE only ever runs on web, and the platform
 * already ships a colour picker and a slider — pulling in a picker library to
 * re-draw what the browser gives away would be silly.
 */
const ColorInput = ({ value, onChange }: { value: string; onChange: (v: string) => void }) =>
  createElement('input', {
    type: 'color',
    value: value.slice(0, 7),
    onChange: (e: any) => onChange(e.target.value),
    style: {
      width: 26,
      height: 26,
      padding: 0,
      border: '1px solid #3A3129',
      borderRadius: CHROME_RADIUS.sm,
      background: 'none',
      cursor: 'pointer',
    },
  });

const RangeInput = ({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) =>
  createElement('input', {
    type: 'range',
    value,
    min,
    max,
    onChange: (e: any) => onChange(Number(e.target.value)),
    style: { width: 96, accentColor: '#FF7A4C', cursor: 'pointer' },
  });

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View style={{ gap: 6, marginBottom: 18 }}>
    <Label role="caption" color={CHROME.textMuted} style={{ letterSpacing: 1, fontWeight: '600' }}>
      {title.toUpperCase()}
    </Label>
    {children}
  </View>
);

/**
 * One token row.
 *
 * `edited` drives the per-token undo: it appears only for a token this session
 * changed, so "undo" always has an obvious referent. Per-token undo folds into
 * the session snapshot rather than being a second mechanism — see `store.ts`.
 */
const Line = ({
  name,
  edited,
  onUndo,
  children,
}: {
  name: string;
  edited?: boolean;
  onUndo?: () => void;
  children: React.ReactNode;
}) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
    <Label role="caption" color={CHROME.text} style={{ fontFamily: 'monospace' }}>
      {name}
      {edited ? ' •' : ''}
    </Label>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {children}
      {edited && onUndo ? (
        <Pressable
          onPress={onUndo}
          accessibilityRole="button"
          accessibilityLabel={`Undo this session's edit to ${name}`}
          hitSlop={8}
          style={({ pressed }) => ({
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: CHROME_RADIUS.sm,
            opacity: pressed ? 0.6 : 1,
          })}>
          <Label role="caption" color={CHROME.textMuted}>
            undo
          </Label>
        </Pressable>
      ) : null}
    </View>
  </View>
);

export function TokenPanel() {
  const tokens = useTokens();
  const {
    setToken,
    scheme,
    setScheme,
    revert,
    revertToken,
    revertToCommitted,
    refreshSessionBaseline,
    overrides,
    rejection,
    canRevertToSession,
    baselineLost,
  } = useTokenStore();
  const dirty = Object.keys(overrides).length;
  const edited = (path: string) => path in overrides;

  // Asked once on mount rather than assumed. `canRevertToSession` starts null and
  // the button stays disabled until the server has answered, so the panel never
  // offers an undo that has nothing behind it — including on the deployed build,
  // where there is no server at all.
  useEffect(() => {
    void refreshSessionBaseline();
  }, [refreshSessionBaseline]);

  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
        {(['light', 'dark'] as Scheme[]).map((s) => (
          <Pressable
            key={s}
            onPress={() => setScheme(s)}
            style={{
              paddingVertical: 4,
              paddingHorizontal: 10,
              borderRadius: CHROME_RADIUS.pill,
              backgroundColor: scheme === s ? '#D9481E' : CHROME.panelSoft,
            }}>
            <Label role="caption" color={scheme === s ? '#fff' : CHROME.textMuted}>
              {s}
            </Label>
          </Pressable>
        ))}
      </View>

      <Section title={`Colour · ${scheme}`}>
        {Object.entries(tokens.color[scheme]).map(([name, value]) => (
          <Line
            key={name}
            name={name}
            edited={edited(`color.${scheme}.${name}`)}
            onUndo={() => revertToken(`color.${scheme}.${name}`)}>
            <Label role="caption" color={CHROME.textMuted} style={{ fontFamily: 'monospace' }}>
              {value}
            </Label>
            <ColorInput value={value} onChange={(v) => setToken(`color.${scheme}.${name}`, v)} />
          </Line>
        ))}
      </Section>

      <Section title="Spacing">
        {Object.entries(tokens.space).map(([name, value]) => (
          <Line
            key={name}
            name={name}
            edited={edited(`space.${name}`)}
            onUndo={() => revertToken(`space.${name}`)}>
            <Label role="caption" color={CHROME.textMuted}>
              {value}
            </Label>
            <RangeInput value={value} min={0} max={64} onChange={(v) => setToken(`space.${name}`, v)} />
          </Line>
        ))}
      </Section>

      <Section title="Radius">
        {Object.entries(tokens.radius).map(([name, value]) => (
          <Line
            key={name}
            name={name}
            edited={edited(`radius.${name}`)}
            onUndo={() => revertToken(`radius.${name}`)}>
            <Label role="caption" color={CHROME.textMuted}>
              {value}
            </Label>
            <RangeInput
              value={Math.min(value, 60)}
              min={0}
              max={60}
              onChange={(v) => setToken(`radius.${name}`, v)}
            />
          </Line>
        ))}
      </Section>

      <Section title="Elevation">
        {Object.entries(tokens.elevation).map(([name, value]) => (
          <View key={name} style={{ gap: 4, marginBottom: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Label role="caption" color={CHROME.text} style={{ fontFamily: 'monospace' }}>
                {name}
                {edited(`elevation.${name}`) ? ' •' : ''}
              </Label>
              {edited(`elevation.${name}`) ? (
                <Pressable
                  onPress={() => revertToken(`elevation.${name}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`Undo this session's edit to ${name}`}
                  hitSlop={8}
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                  <Label role="caption" color={CHROME.textMuted}>
                    undo
                  </Label>
                </Pressable>
              ) : null}
            </View>
            <ShadowInput value={value} onCommit={(next) => setToken(`elevation.${name}`, next)} />
          </View>
        ))}
        <Label role="caption" color={CHROME.textMuted}>
          A shadow is a whole CSS value, not a number — so this is a text field, not
          a slider. Validation is the same rule the server uses.
        </Label>
      </Section>

      <Section title="Type scale">
        {Object.entries(tokens.type).map(([name, spec]) => (
          <Line
            key={name}
            name={name}
            edited={edited(`type.${name}.size`)}
            onUndo={() => revertToken(`type.${name}.size`)}>
            <Label role="caption" color={CHROME.textMuted}>
              {spec.size}
            </Label>
            <RangeInput
              value={spec.size}
              min={9}
              max={48}
              onChange={(v) => {
                setToken(`type.${name}.size`, v);
                // Line height tracks size, or the scale falls apart as you drag.
                setToken(`type.${name}.lineHeight`, Math.round(v * 1.25));
              }}
            />
          </Line>
        ))}
      </Section>

      {/* A refused value says so here rather than the slider simply not moving.
          Without this the panel looks broken: the control ignores you and gives
          no reason. */}
      {rejection ? (
        <View
          style={{
            marginBottom: 12,
            padding: CHROME_RADIUS.sm,
            borderRadius: CHROME_RADIUS.sm,
            borderWidth: 1,
            borderColor: TONE.degraded,
            backgroundColor: CHROME.panelSoft,
            gap: 3,
          }}>
          <Label role="caption" color={TONE.degraded} style={{ fontWeight: '600' }}>
            refused {rejection.path}
          </Label>
          <Label role="caption" color={CHROME.textMuted}>
            {rejection.error}
          </Label>
        </View>
      ) : null}

      {/* Uncommitted work from *before* this session is left alone by all of
          this. That is the difference the ticket is about. */}
      {dirty > 0 ? (
        <View style={{ gap: 8, marginTop: 4 }}>
          <Pressable
            onPress={revert}
            disabled={!canRevertToSession}
            accessibilityRole="button"
            style={({ pressed }) => ({
              paddingVertical: 8,
              borderRadius: CHROME_RADIUS.md,
              backgroundColor: CHROME.panelSoft,
              alignItems: 'center',
              opacity: !canRevertToSession ? 0.4 : pressed ? 0.7 : 1,
            })}>
            <Label role="caption" color={CHROME.text}>
              Revert {dirty} edit{dirty === 1 ? '' : 's'} to session start
            </Label>
          </Pressable>
          <Label role="caption" color={CHROME.textMuted}>
            {canRevertToSession === null
              ? 'checking for a session baseline…'
              : canRevertToSession
                ? 'back to this session’s start, not to the last commit'
                : 'no session baseline — the server has not recorded a starting point'}
          </Label>
        </View>
      ) : null}

      {baselineLost ? (
        <Label role="caption" color={TONE.degraded} style={{ marginTop: 8 }}>
          the token server restarted, so this session has nothing to undo to
        </Label>
      ) : null}

      {/* Separate, and deliberately not adjacent to the button above: this one
          destroys uncommitted work the studio never saw. */}
      <Pressable
        onPress={revertToCommitted}
        accessibilityRole="button"
        accessibilityLabel="Discard all uncommitted token changes and go back to the last commit"
        style={({ pressed }) => ({
          marginTop: 14,
          paddingVertical: 7,
          borderRadius: CHROME_RADIUS.md,
          borderWidth: 1,
          borderColor: CHROME.border,
          alignItems: 'center',
          opacity: pressed ? 0.7 : 1,
        })}>
        <Label role="caption" color={CHROME.textMuted}>
          Discard everything → last commit
        </Label>
      </Pressable>
    </View>
  );
}