import { View } from 'react-native';
import { CHROME, TONE } from './chrome';
import { Label } from './Label';
import { regressionNote, type RegressionCase } from './regressionNote';
import record from './screenshot-record.json';

function CaseRow({ c }: { c: RegressionCase }) {
  return (
    <View nativeID={`regression-case-${c.id}`} style={{ gap: 2 }}>
      <Label role="label" color={CHROME.text}>
        {c.id}
      </Label>
      <Label role="caption" color={CHROME.textMuted}>
        {`Scheme: ${c.scheme} · State: ${c.state}`}
      </Label>
      <Label role="caption" color={CHROME.textMuted}>
        {`Baseline: ${c.baseline}`}
      </Label>
    </View>
  );
}

export function RegressionPanel() {
  const note = regressionNote(record);
  if (note.kind === 'none') {
    return (
      <View nativeID="regression-note" style={{ gap: 12 }}>
        <View nativeID="regression-none">
          <Label role="title" color={TONE.degraded}>
            {note.headline}
          </Label>
        </View>
        <Label role="body">{note.detail}</Label>
        <Label role="caption" color={CHROME.textMuted}>
          {note.hint}
        </Label>
      </View>
    );
  }
  return (
    <View nativeID="regression-note" style={{ gap: 12 }}>
      <View nativeID="regression-approved">
        <Label role="title" color={CHROME.text}>
          {note.headline}
        </Label>
      </View>
      <View style={{ gap: 2 }}>
        {note.details.map((line) => (
          <Label key={line} role="caption" color={CHROME.textMuted}>
            {line}
          </Label>
        ))}
      </View>
      <Label role="caption" color={CHROME.text}>
        {note.caveat}
      </Label>
      <Label role="label" color={CHROME.text} style={{ letterSpacing: 1 }}>
        CASES
      </Label>
      <View style={{ gap: 10 }}>
        {note.cases.map((c) => (
          <CaseRow key={c.id} c={c} />
        ))}
      </View>
    </View>
  );
}
