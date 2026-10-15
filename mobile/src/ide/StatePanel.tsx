import { View } from 'react-native';
import { useHabits } from '../store/habits';
import { formatPath, describeLog, type SpineEntry } from './spine';
import { habitNameForPath } from './habitLabels';
import { isSpineAttached, useSpine } from './spineStore';
import { CHROME, TONE } from './chrome';
import { pressVerdictCopy } from './presses';
import { Label } from './Label';

/**
 * Renders a plain object as an indented tree.
 *
 * Sizes come from `Label` and so cannot be dragged by a token edit, but the hues
 * are a syntax highlight rather than chrome semantics — a key and its value are a
 * different kind of thing from a section heading — so they stay literal here.
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
 * One line of the change log.
 *
 * A row carries what changed, where the press landed, and how the press was
 * judged — three facts side by side, with **no arrow between them**. The change
 * usually repaints a different frame than the one pressed, so a drawn connection
 * would be a guess wearing a cause's clothing.
 *
 * `habits` is passed in so a path can be named. `habits[2].done[0]` says where the
 * change landed and nothing a reader can act on: the tree below holds six habits,
 * and finding "2" in it means counting. Naming the habit beside the path is what
 * makes the row findable, which is the whole reason to watch a change rather than
 * re-read a tree.
 */
function Row({ entry, habits }: { entry: SpineEntry; habits: { name: string }[] }) {
  const verdict = entry.verdict ? pressVerdictCopy(entry.verdict) : null;
  const tone = verdict?.tone ?? (entry.changes.length > 0 ? TONE.ok : CHROME.textMuted);

  return (
    <View style={{ gap: 2, paddingBottom: 6 }}>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        {verdict ? (
          <Label role="caption" color={TONE[verdict.tone]} style={{ fontWeight: '600' }}>
            {verdict.label}
          </Label>
        ) : null}
        {entry.press ? (
          <Label role="caption" color={CHROME.text} numberOfLines={1}>
            {entry.press.target ?? 'the control'} · {entry.press.label ?? 'unknown frame'}
            {entry.press.column === 'comparison' ? ' · HEAD column' : ''}
          </Label>
        ) : null}
      </View>

      {entry.changes.flatMap((change) =>
        change.differences.map((diff) => {
          // Named where the studio can name it, and left unnamed where it cannot.
          // A habit's name is resolved against the list as it is *now*, so a habit
          // renamed since the row was logged would print the new name — which is
          // why a name it cannot resolve is dropped rather than guessed at.
          const name = habitNameForPath(diff.path, habits);
          return (
            <Label key={`${change.store}-${diff.path}`} role="caption" color={CHROME.textMuted} style={{ fontFamily: 'monospace' }} numberOfLines={1}>
              {change.store} {formatPath(diff.path)}: {JSON.stringify(diff.baseline)} → {JSON.stringify(diff.current)}
              {name ? <Label role="caption" color={CHROME.text}>  · {name}</Label> : null}
            </Label>
          );
        }),
      )}

      {entry.route ? (
        <Label role="caption" color={CHROME.textMuted} style={{ fontFamily: 'monospace' }} numberOfLines={1}>
          route {entry.route.from ?? 'unknown frame'} → {entry.route.to}
        </Label>
      ) : null}

      {/* Never an empty field. "no state change" and "the studio did not look" are
          different facts and only one of them is true here. */}
      {entry.route ? (
        <Label role="caption" color={tone}>
          {entry.changes.length > 0 ? `carried ${entry.changes.length} state change` : 'no state change'}
        </Label>
      ) : null}
    </View>
  );
}

/**
 * What the app did, newest first — and what the state is right now, below it.
 *
 * ## Why both
 *
 * A tree of current values cannot show you what *moved*: `habits` is six objects
 * each holding up to seven ISO date strings, a toggle rewrites one element of one
 * array, and the tree either side looks equally plausible. Watching the change is
 * the whole value of the talk's idea, and it was never built — the panel showed
 * state and stopped there.
 *
 * The tree stays because the log cannot answer a different question: what is the
 * state *now*. Two questions, two sections, in the order a reader asks them.
 *
 * ## Output only
 *
 * No button here drives the store. The blueprint is the input device; a panel that
 * could also drive the store would be a second way to reach the same state, and
 * then every log entry would have two indistinguishable causes.
 */
export function StatePanel() {
  const { habits, signedIn, selectedId } = useHabits();
  const spine = useSpine();

  // Read once, at the moment of render. The distinction this copy makes is between
  // "nothing has happened yet" and "nothing is listening", and the attachment is
  // not a subscription — it happens when the route mounts.
  const copy = describeLog(spine, isSpineAttached());
  // Newest first, so the change just caused is the one on screen.
  const rows = [...spine.entries].reverse();

  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 3 }}>
        <Label role="label" color={CHROME.text} style={{ letterSpacing: 1 }}>
          CHANGE LOG
        </Label>
        <Label role="caption" color={TONE[copy.tone]} style={{ fontWeight: '600' }}>
          {copy.label}
        </Label>
        <Label role="caption" color={CHROME.textMuted}>
          {copy.detail}
        </Label>
        {spine.dropped > 0 ? (
          <Label role="caption" color={TONE.degraded}>
            {spine.dropped} older row{spine.dropped === 1 ? '' : 's'} fell out of the {spine.cap}-row buffer, so this is not the whole history
          </Label>
        ) : null}
      </View>

      {rows.length > 0 ? (
        <View style={{ gap: 2 }}>
          {rows.map((entry) => (
            <Row key={`${entry.seq}-${entry.press?.target ?? ''}-${entry.route?.to ?? ''}`} entry={entry} habits={habits} />
          ))}
        </View>
      ) : null}

      <View style={{ gap: 6 }}>
        <Label role="label" color={CHROME.text} style={{ letterSpacing: 1 }}>
          CURRENT STATE
        </Label>
        <Label role="caption" color={CHROME.textMuted}>
          what it is now — the log above answers what it did
        </Label>
        <View style={{ gap: 2 }}>
          <Node label="signedIn" value={signedIn} />
          <Node label="selectedId" value={selectedId} />
          <Node label="habits" value={habits} />
        </View>
      </View>
    </View>
  );
}