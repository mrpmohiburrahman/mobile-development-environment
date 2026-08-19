import { View } from 'react-native';
import { useHabits } from '../store/habits';
import { Text } from '../ui';

/** Renders a plain object as an indented tree. */
function Node({ label, value, depth = 0 }: { label: string; value: unknown; depth?: number }) {
  const pad = { paddingLeft: depth * 10 };

  if (Array.isArray(value)) {
    return (
      <View>
        <Text role="caption" style={{ ...pad, color: '#7fb3d5', fontFamily: 'monospace' }}>
          {label} <Text role="caption" style={{ color: '#555' }}>[{value.length}]</Text>
        </Text>
        {value.map((v, i) => (
          <Node key={i} label={String(i)} value={v} depth={depth + 1} />
        ))}
      </View>
    );
  }

  if (value && typeof value === 'object') {
    return (
      <View>
        <Text role="caption" style={{ ...pad, color: '#7fb3d5', fontFamily: 'monospace' }}>
          {label}
        </Text>
        {Object.entries(value).map(([k, v]) => (
          <Node key={k} label={k} value={v} depth={depth + 1} />
        ))}
      </View>
    );
  }

  return (
    <Text role="caption" style={{ ...pad, fontFamily: 'monospace', color: '#ccc' }}>
      {label}: <Text role="caption" style={{ color: typeof value === 'string' ? '#c3e88d' : '#f78c6c' }}>
        {JSON.stringify(value)}
      </Text>
    </Text>
  );
}

/**
 * The live app store. Zustand's state is a plain object, so watching it is a
 * subscription and a tree renderer — no devtools integration needed.
 */
export function StatePanel() {
  const { habits, signedIn, selectedId } = useHabits();
  return (
    <View style={{ gap: 2 }}>
      <Node label="signedIn" value={signedIn} />
      <Node label="selectedId" value={selectedId} />
      <Node label="habits" value={habits} />
    </View>
  );
}
