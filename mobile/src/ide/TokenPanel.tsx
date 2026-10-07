import { createElement } from 'react';
import { Pressable, View } from 'react-native';
import { useTokenStore, useTokens, type Scheme } from '../ds/store';
import { CHROME, CHROME_RADIUS, TONE } from './chrome';
import { Label } from './Label';

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

const Line = ({ name, children }: { name: string; children: React.ReactNode }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
    <Label role="caption" color={CHROME.text} style={{ fontFamily: 'monospace' }}>
      {name}
    </Label>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{children}</View>
  </View>
);

export function TokenPanel() {
  const tokens = useTokens();
  const { setToken, scheme, setScheme, revert, overrides, rejection } = useTokenStore();
  const dirty = Object.keys(overrides).length;

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
          <Line key={name} name={name}>
            <Label role="caption" color={CHROME.textMuted} style={{ fontFamily: 'monospace' }}>
              {value}
            </Label>
            <ColorInput value={value} onChange={(v) => setToken(`color.${scheme}.${name}`, v)} />
          </Line>
        ))}
      </Section>

      <Section title="Spacing">
        {Object.entries(tokens.space).map(([name, value]) => (
          <Line key={name} name={name}>
            <Label role="caption" color={CHROME.textMuted}>
              {value}
            </Label>
            <RangeInput value={value} min={0} max={64} onChange={(v) => setToken(`space.${name}`, v)} />
          </Line>
        ))}
      </Section>

      <Section title="Radius">
        {Object.entries(tokens.radius).map(([name, value]) => (
          <Line key={name} name={name}>
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

      <Section title="Type scale">
        {Object.entries(tokens.type).map(([name, spec]) => (
          <Line key={name} name={name}>
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

      {dirty > 0 ? (
        <Pressable
          onPress={revert}
          style={{ paddingVertical: 8, borderRadius: CHROME_RADIUS.md, backgroundColor: CHROME.panelSoft, alignItems: 'center' }}>
          <Label role="caption" color={CHROME.text}>
            Revert {dirty} edit{dirty === 1 ? '' : 's'}
          </Label>
        </Pressable>
      ) : null}
    </View>
  );
}