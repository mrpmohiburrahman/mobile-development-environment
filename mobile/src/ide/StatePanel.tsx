import { View } from 'react-native';
import { useHabits } from '../store/habits';
import { Label } from './Label';

/**
 * Renders a plain object as an indented tree.
 *
 * Sizes come from `Label` and so cannot be dragged by a token edit, but the hues
 * are a syntax highlight rather than chrome semantics — a key and its value are
 * a different kind of thing from a section heading — so they stay literal here.
 * Unifying them into `CHROME` would have meant inventing a second palette to
 * express the same three ideas.
 */
function Node({ label, value, depth = 0 }: { label: string; value: unknown; depth?: number }) {
  const pad = { paddingLeft: depth * 10 };

  if (Array.isArray(value)) {
    return (
      <View>
        <Label role="caption" color="#7fb3d5" style={{ ...pad, fontFamily: 'monospace' }}>
          {label} <Label role="caption" color="#555">[{value.length}]</Label>
        </Label>
        {value.map((v, i) => (
          <Node key={i} label={String(i)} value={v} depth={depth + 1} />
        ))}
      </View>
    );
  }

  if (value && typeof value === 'object') {
    return (
      <View>
        <Label role="caption" color="#7fb3d5" style={{ ...pad, fontFamily: 'monospace' }}>
          {label}
        </Label>
        {Object.entries(value).map(([k, v]) => (
          <Node key={k} label={k} value={v} depth={depth + 1} />
        ))}
      </View>
    );
  }

  return (
    <Label role="caption" color="#ccc" style={{ ...pad, fontFamily: 'monospace' }}>
      {label}: <Label role="caption" color={typeof value === 'string' ? '#c3e88d' : '#f78c6c'}>
        {JSON.stringify(value)}
      </Label>
    </Label>
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