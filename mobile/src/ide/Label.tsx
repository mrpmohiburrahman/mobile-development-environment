import { Text as RNText, type TextStyle } from 'react-native';
import { CHROME, LABEL_SPEC, type LabelRole } from './chrome';

/**
 * The studio's own text. Fixed sizes, never the app's tokens.
 *
 * Every other `Text` in this repo reads `useTheme()`, which is correct for app
 * screens and wrong for the editor around them: dragging `type.caption.size`
 * used to resize the label saying how many screens there were, so the control
 * for a token distorted the studio while you were adjusting it. The sizes come
 * from `LABEL_SPEC` in `chrome.ts`, not from `tokens.json`.
 *
 * Colours come from `CHROME` for the same reason, but `color` accepts any string
 * because the state tree in `StatePanel.tsx` is syntax-highlighted and those
 * hues are not chrome semantics — they are a different job.
 */
export function Label({
  children,
  role = 'body',
  color = CHROME.text,
  style,
  ...rest
}: {
  children: React.ReactNode;
  role?: LabelRole;
  color?: string;
  style?: TextStyle | TextStyle[];
  numberOfLines?: number;
}) {
  const spec = LABEL_SPEC[role];
  return (
    <RNText
      {...rest}
      style={[
        {
          fontSize: spec.size,
          fontWeight: spec.weight as TextStyle['fontWeight'],
          lineHeight: spec.lineHeight,
          letterSpacing: spec.letterSpacing,
          color,
        },
        style,
      ]}>
      {children}
    </RNText>
  );
}