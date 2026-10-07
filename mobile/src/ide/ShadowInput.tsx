import { createElement, useState } from 'react';
import { View } from 'react-native';
import { validateBoxShadow } from '../ds/tokenValidation';
import { CHROME, CHROME_RADIUS, TONE } from './chrome';
import { describeShadow, normalizeShadow, SHADOW_PLACEHOLDER } from './elevationEditor';
import { Label } from './Label';

/**
 * A text field for one `elevation.*` token.
 *
 * A draft-and-commit field rather than a controlled one that writes on every
 * keystroke. Mid-typing, the value is legitimately incomplete — `0px 1px` is a
 * blur with no offset — and writing that on each keystroke would either spam the
 * store's refusal or land a broken shadow in `tokens.json`. So the field keeps a
 * draft, says whether the draft is currently valid, and commits on blur or
 * Enter.
 *
 * This is the honest shape for a composite value. The ticket ruled out a slider
 * because elevation is not a number, and a slider that pretended otherwise would
 * have been worse than no control at all.
 */
export function ShadowInput({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);

  // Adopt the store's value when it changes underneath us — another panel action
  // or a session revert — but never while the author is mid-word.
  //
  // Adjusted during render rather than in an effect: this is React's documented
  // "store the previous value" pattern, and `react-hooks/set-state-in-effect`
  // rejects the effect form because it costs an extra render pass on every
  // keystroke. `seen` is what makes this fire only on a genuine change.
  const [seen, setSeen] = useState(value);
  if (value !== seen && !editing) {
    setSeen(value);
    setDraft(value);
  }

  const summary = describeShadow(draft);
  const dirty = normalizeShadow(draft) !== normalizeShadow(value);

  const commit = () => {
    setEditing(false);
    const next = normalizeShadow(draft);
    // Refuse here as well as in the store, so a bad draft simply stays in the
    // field with its reason rather than being written and then complained about.
    if (validateBoxShadow(next).ok && next !== value) onCommit(next);
    else setDraft(value);
  };

  return (
    <View style={{ gap: 5, flex: 1 }}>
      {createElement('input', {
        type: 'text',
        value: draft,
        placeholder: SHADOW_PLACEHOLDER,
        spellCheck: false,
        onFocus: () => setEditing(true),
        onBlur: commit,
        onChange: (e: any) => setDraft(e.target.value),
        onKeyDown: (e: any) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            // Discard by resetting the draft in place, deliberately *without*
            // blurring. Blurring is what runs `commit`, and React has not applied
            // setDraft by the time that handler fires — so the earlier version of
            // this blurred and committed the very draft Escape was throwing away.
            // Resetting alone is enough: the later blur finds draft === value.
            setDraft(value);
            setEditing(false);
          }
        },
        style: {
          width: '100%',
          padding: '6px 8px',
          fontSize: 11,
          fontFamily: 'monospace',
          color: CHROME.text,
          background: CHROME.bg,
          border: `1px solid ${summary.valid ? CHROME.border : TONE.degraded}`,
          borderRadius: CHROME_RADIUS.sm,
          outline: 'none',
        },
      })}
      {dirty ? (
        <Label role="caption" color={CHROME.textMuted}>
          uncommitted — Enter or click away to apply, Esc to discard
        </Label>
      ) : null}
      {editing && !summary.valid ? (
        <Label role="caption" color={TONE.degraded}>
          {summary.error}
        </Label>
      ) : null}
      {editing && summary.valid && summary.count ? (
        <Label role="caption" color={CHROME.textMuted}>
          {summary.count} · blur {summary.blurs}
        </Label>
      ) : null}
    </View>
  );
}