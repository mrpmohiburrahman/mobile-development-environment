import { createElement } from 'react';
import { Pressable, View } from 'react-native';
import { useTokenStore, useTokens, type Scheme } from '../ds/store';
import { Text } from '../ui';

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
      borderRadius: 8,
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
    min,
    max,
    value,
    onChange: (e: any) => onChange(Number(e.target.value)),
    style: { width: 96, accentColor: '#FF7A4C', cursor: 'pointer' },
  });

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View style={{ gap: 6, marginBottom: 18 }}>
    <Text role="caption" style={{ color: '#9C928A', letterSpacing: 1, fontWeight: 600 }}>
      {title.toUpperCase()}
    </Text>
    {children}
  </View>
);

const Line = ({ name, children }: { name: string; children: React.ReactNode }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
    <Text role="caption" style={{ color: '#EDE7E0', fontFamily: 'monospace' }}>
      {name}
    </Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{children}</View>
  </View>
);

export function TokenPanel() {
  const tokens = useTokens();
  const { setToken, scheme, setScheme, revert, overrides } = useTokenStore();
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
              borderRadius: 999,
              backgroundColor: scheme === s ? '#D9481E' : '#2B251F',
            }}>
            <Text role="caption" style={{ color: scheme === s ? '#fff' : '#9C928A' }}>
              {s}
            </Text>
          </Pressable>
        ))}
      </View>

      <Section title={`Colour · ${scheme}`}>
        {Object.entries(tokens.color[scheme]).map(([name, value]) => (
          <Line key={name} name={name}>
            <Text role="caption" style={{ color: '#8A8178', fontFamily: 'monospace' }}>
              {value}
            </Text>
            <ColorInput value={value} onChange={(v) => setToken(`color.${scheme}.${name}`, v)} />
          </Line>
        ))}
      </Section>

      <Section title="Spacing">
        {Object.entries(tokens.space).map(([name, value]) => (
          <Line key={name} name={name}>
            <Text role="caption" style={{ color: '#8A8178' }}>
              {value}
            </Text>
            <RangeInput value={value} min={0} max={64} onChange={(v) => setToken(`space.${name}`, v)} />
          </Line>
        ))}
      </Section>

      <Section title="Radius">
        {Object.entries(tokens.radius).map(([name, value]) => (
          <Line key={name} name={name}>
            <Text role="caption" style={{ color: '#8A8178' }}>
              {value}
            </Text>
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
            <Text role="caption" style={{ color: '#8A8178' }}>
              {spec.size}
            </Text>
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

      {dirty > 0 ? (
        <Pressable
          onPress={revert}
          style={{ paddingVertical: 8, borderRadius: 8, backgroundColor: '#2B251F', alignItems: 'center' }}>
          <Text role="caption" style={{ color: '#EDE7E0' }}>
            Revert {dirty} edit{dirty === 1 ? '' : 's'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
